-- Admin approval for artiste support pages + server-side Paystack configuration.
-- Additive only: no payment ledger, order, subaccount or subscription rows are touched.

-- 1. Approval status on profiles.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS approval_status text;

-- Grandfather profiles that are already live so no existing artiste loses support access.
UPDATE public.profiles SET approval_status = 'approved' WHERE approval_status IS NULL;

ALTER TABLE public.profiles
  ALTER COLUMN approval_status SET DEFAULT 'pending',
  ALTER COLUMN approval_status SET NOT NULL;

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_approval_status_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_approval_status_check
  CHECK (approval_status IN ('pending', 'approved', 'rejected'));

-- 2. Approval status and payout details are admin-controlled (same pattern as role/premium).
CREATE OR REPLACE FUNCTION public.guard_profile_updates()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
begin
  new.updated_at := now();
  if new.role = 'admin' and old.role != 'admin' then
    if not public.is_admin() then
      raise exception 'Only an administrator can grant admin privileges.';
    end if;
  end if;
  if new.is_verified_artiste is distinct from old.is_verified_artiste and not public.is_admin() then
    new.is_verified_artiste := old.is_verified_artiste;
  end if;
  if (
    new.is_premium is distinct from old.is_premium or
    new.premium_plan is distinct from old.premium_plan or
    new.premium_until is distinct from old.premium_until
  ) then
    if not public.is_admin() and coalesce(current_setting('app.allow_premium_grant', true), '') != 'true' then
      new.is_premium := old.is_premium;
      new.premium_plan := old.premium_plan;
      new.premium_until := old.premium_until;
    end if;
  end if;
  -- Support approval and Paystack payout details may only be changed by an admin.
  if not public.is_admin() then
    new.approval_status := old.approval_status;
    new.support_provider := old.support_provider;
    new.support_number := old.support_number;
    new.support_account_name := old.support_account_name;
  end if;
  return new;
end;
$function$;

-- Nobody can self-approve on insert either.
CREATE OR REPLACE FUNCTION public.guard_profile_approval_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
begin
  if not public.is_admin() then
    new.approval_status := 'pending';
  end if;
  return new;
end;
$function$;

DROP TRIGGER IF EXISTS trg_guard_profile_approval_insert ON public.profiles;
CREATE TRIGGER trg_guard_profile_approval_insert
  BEFORE INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.guard_profile_approval_insert();

-- 3. One admin action keeps the public profile fields and the trusted checkout
--    configuration (support_checkout_config) in sync. The client cannot write
--    support_checkout_config directly; it is service_role only.
CREATE OR REPLACE FUNCTION public.admin_set_support_details(
  p_target text,
  p_provider text,
  p_payment_page_url text,
  p_subaccount_code text,
  p_approve boolean DEFAULT false,
  p_enabled boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  v_is_gyidi boolean := (p_target = 'gyidi');
  v_id uuid;
  v_provider text := nullif(btrim(coalesce(p_provider, '')), '');
  v_url text := nullif(btrim(coalesce(p_payment_page_url, '')), '');
  -- Paystack subaccount codes are case-sensitive: trim only, never normalise the case.
  v_sub text := nullif(btrim(coalesce(p_subaccount_code, '')), '');
  v_enabled boolean := coalesce(p_enabled, true);
  v_row public.profiles;
begin
  if not public.is_admin() then
    raise exception 'Only an administrator can configure artiste support.' using errcode = '42501';
  end if;

  if v_is_gyidi then
    v_id := null;
  else
    if p_target is null
       or p_target !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      raise exception 'Invalid support target.' using errcode = '22023';
    end if;
    v_id := p_target::uuid;
    if not exists (select 1 from public.profiles where id = v_id) then
      raise exception 'That artiste profile no longer exists.' using errcode = 'P0002';
    end if;
  end if;

  if v_url is not null
     and v_url !~* '^https://([a-z0-9-]+\.)*paystack\.(com|shop)/' then
    raise exception 'Enter a Paystack payment page URL such as https://paystack.shop/pay/yourtag.'
      using errcode = '22023';
  end if;

  if v_sub is not null and v_sub !~* '^ACCT_[A-Za-z0-9]+$' then
    raise exception 'Enter the Paystack subaccount code exactly as issued (ACCT_...).'
      using errcode = '22023';
  end if;

  if p_approve and not v_is_gyidi and (v_url is null or v_sub is null) then
    raise exception 'Add the Paystack payment page URL and subaccount code before approving this profile.'
      using errcode = '22023';
  end if;

  if v_enabled and not v_is_gyidi and v_sub is null then
    raise exception 'A Paystack subaccount code is required before support can be enabled.'
      using errcode = '22023';
  end if;

  insert into public.support_checkout_config as c
    (target, artiste_id, subaccount_code, payment_page_url, enabled)
  values (
    case when v_is_gyidi then 'gyidi' else v_id::text end,
    v_id,
    v_sub,
    v_url,
    v_enabled and (v_is_gyidi or v_sub is not null)
  )
  on conflict (target) do update
    set subaccount_code = excluded.subaccount_code,
        payment_page_url = excluded.payment_page_url,
        enabled = excluded.enabled;

  if not v_is_gyidi then
    update public.profiles set
      support_provider = coalesce(
        v_provider,
        case when v_sub is not null or v_url is not null then 'Paystack Payment Page'
             else support_provider end
      ),
      support_number = v_url,
      support_account_name = v_sub,
      approval_status = case when p_approve then 'approved' else approval_status end
    where id = v_id
    returning * into v_row;
  end if;

  return jsonb_build_object(
    'target', case when v_is_gyidi then 'gyidi' else v_id::text end,
    'enabled', v_enabled,
    'approved', (v_row.id is not null and v_row.approval_status = 'approved'),
    'profile', case when v_row.id is null then null else to_jsonb(v_row) end
  );
end;
$function$;

REVOKE ALL ON FUNCTION public.admin_set_support_details(text, text, text, text, boolean, boolean)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_support_details(text, text, text, text, boolean, boolean)
  TO authenticated;
