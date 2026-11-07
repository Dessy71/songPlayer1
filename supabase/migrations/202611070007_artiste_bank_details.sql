-- Bank account details collected from artistes during signup.
-- Stored in artiste_payout_details (service_role only) so they are NOT publicly readable.
-- Admin reads them via admin_get_support_details to create Paystack payment pages
-- and subaccounts during artiste approval. Bank details are optional -- an admin can
-- still create a payment page URL without them.
ALTER TABLE public.artiste_payout_details
  ADD COLUMN IF NOT EXISTS bank_name text,
  ADD COLUMN IF NOT EXISTS bank_account_number text,
  ADD COLUMN IF NOT EXISTS bank_account_name text;

-- Artistes can set their own bank details through this SECURITY DEFINER RPC.
-- Matched by auth.uid() against profiles.claimed_user_id or profiles.id.
-- Only artistes may call this.
CREATE OR REPLACE FUNCTION public.artiste_set_bank_details(
  p_bank_name text,
  p_bank_account_number text,
  p_bank_account_name text
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
    raise exception 'Only artistes can set bank details.' using errcode = '42501';
  end if;

  insert into public.artiste_payout_details
    (artiste_id, bank_name, bank_account_number, bank_account_name, updated_by, updated_at)
  values
    (v_profile_id, nullif(trim(p_bank_name), ''),
     nullif(trim(p_bank_account_number), ''),
     nullif(trim(p_bank_account_name), ''),
     auth.uid(), now())
  on conflict (artiste_id) do update
    set bank_name = coalesce(excluded.bank_name, artiste_payout_details.bank_name),
        bank_account_number = coalesce(excluded.bank_account_number, artiste_payout_details.bank_account_number),
        bank_account_name = coalesce(excluded.bank_account_name, artiste_payout_details.bank_account_name),
        updated_by = excluded.updated_by,
        updated_at = now();

  return jsonb_build_object('artiste_id', v_profile_id, 'ok', true);
end;
$function$;

REVOKE ALL ON FUNCTION public.artiste_set_bank_details(text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.artiste_set_bank_details(text, text, text) TO authenticated;

-- Update admin_get_support_details to also return bank details so the admin
-- dashboard can see them during approval and create payment pages/subaccounts.
CREATE OR REPLACE FUNCTION public.admin_get_support_details(p_target text)
RETURNS TABLE(
  provider text,
  payment_page_url text,
  subaccount_code text,
  bank_name text,
  bank_account_number text,
  bank_account_name text,
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
             null, null, null, false, c.enabled, null::timestamptz
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
           coalesce(d.is_placeholder, false),
           coalesce(c.enabled, true), d.updated_at
    from public.artiste_payout_details d
    left join public.support_checkout_config c on c.target = d.artiste_id::text
    where d.artiste_id = p_target::uuid;
end;
$function$;

REVOKE ALL ON FUNCTION public.admin_get_support_details(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_get_support_details(text) TO authenticated;
