-- Mobile Money details collected from artistes during signup, alongside bank details.
-- Stored in artiste_payout_details (service_role only) so they are NOT publicly readable.
ALTER TABLE public.artiste_payout_details
  ADD COLUMN IF NOT EXISTS payment_method text CHECK (payment_method IS NULL OR payment_method IN ('bank', 'momo')),
  ADD COLUMN IF NOT EXISTS momo_operator text,
  ADD COLUMN IF NOT EXISTS momo_phone_number text;

-- Update the artiste_set_bank_details RPC to also accept Mobile Money details.
-- Renamed to artiste_set_payout_details to cover both bank and momo.
CREATE OR REPLACE FUNCTION public.artiste_set_payout_details(
  p_payment_method text,
  p_bank_name text,
  p_bank_account_number text,
  p_bank_account_name text,
  p_momo_operator text,
  p_momo_phone_number text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=public
AS $function$
declare
  v_profile_id uuid;
begin
  select id into v_profile_id
  from public.profiles
  where id = auth.uid() or claimed_user_id = auth.uid()
  limit 1;

  if v_profile_id is null then
    raise exception 'No profile found for this account.' using errcode = 'P0002';
  end if;

  if (select role from public.profiles where id = v_profile_id) <> 'artiste' then
    raise exception 'Only artistes can set payout details.' using errcode = '42501';
  end if;

  insert into public.artiste_payout_details
    (artiste_id, payment_method, bank_name, bank_account_number, bank_account_name,
     momo_operator, momo_phone_number, updated_by, updated_at)
  values
    (v_profile_id,
     nullif(trim(p_payment_method), ''),
     nullif(trim(p_bank_name), ''),
     nullif(trim(p_bank_account_number), ''),
     nullif(trim(p_bank_account_name), ''),
     nullif(trim(p_momo_operator), ''),
     nullif(trim(p_momo_phone_number), ''),
     auth.uid(), now())
  on conflict (artiste_id) do update
    set payment_method = coalesce(excluded.payment_method, artiste_payout_details.payment_method),
        bank_name = coalesce(excluded.bank_name, artiste_payout_details.bank_name),
        bank_account_number = coalesce(excluded.bank_account_number, artiste_payout_details.bank_account_number),
        bank_account_name = coalesce(excluded.bank_account_name, artiste_payout_details.bank_account_name),
        momo_operator = coalesce(excluded.momo_operator, artiste_payout_details.momo_operator),
        momo_phone_number = coalesce(excluded.momo_phone_number, artiste_payout_details.momo_phone_number),
        updated_by = excluded.updated_by,
        updated_at = now();

  return jsonb_build_object('artiste_id', v_profile_id, 'ok', true);
end;
$function$;

REVOKE ALL ON FUNCTION public.artiste_set_payout_details(text, text, text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.artiste_set_payout_details(text, text, text, text, text, text) TO authenticated;

-- Update admin_get_support_details to return momo columns as well.
CREATE OR REPLACE FUNCTION public.admin_get_support_details(p_target text)
RETURNS TABLE(
  provider text,
  payment_page_url text,
  subaccount_code text,
  bank_name text,
  bank_account_number text,
  bank_account_name text,
  payment_method text,
  momo_operator text,
  momo_phone_number text,
  is_placeholder boolean,
  enabled boolean,
  updated_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
begin
  if not public.is_admin() then
    raise exception 'Only an administrator can read payout details.' using errcode = '42501';
  end if;

  if p_target is null or p_target = 'gyidi' then
    return query
      select c.provider_fallback, c.payment_page_url, c.subaccount_code,
             null, null, null, null, null, null, false, c.enabled, null::timestamptz
      from (
        select 'Paystack Payment Page'::text as provider_fallback,
               s.payment_page_url, s.subaccount_code, s.enabled
        from public.support_checkout_config s
        where s.target = 'gyidi'
      ) c;
    return;
  end if;

  if p_target !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    raise exception 'Invalid support target.' using errcode = '22023';
  end if;

  return query
    select d.provider, d.payment_page_url, d.subaccount_code,
           d.bank_name, d.bank_account_number, d.bank_account_name,
           d.payment_method, d.momo_operator, d.momo_phone_number,
           coalesce(d.is_placeholder, false),
           coalesce(c.enabled, true), d.updated_at
    from public.artiste_payout_details d
    left join public.support_checkout_config c on c.target = d.artiste_id::text
    where d.artiste_id = p_target::uuid;
end;
$function$;

REVOKE ALL ON FUNCTION public.admin_get_support_details(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_get_support_details(text) TO authenticated;
