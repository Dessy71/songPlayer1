-- Move artiste payout details out of the publicly readable profiles table.
--
-- profiles has a "viewable by everyone" SELECT policy, so support_number /
-- support_account_name / support_provider were readable by anon through the
-- public API. That exposed personal MoMo numbers and account names.
--
-- Payout details now live in artiste_payout_details, which is service_role only.
-- Browser reads go through profile_support_summary(), which returns a redacted
-- shape: an approved flag and the payment page URL, never the subaccount code or
-- the account holder name.
--
-- This migration does NOT seed placeholder values; see 202611070003.

-- 1. Restricted table.
CREATE TABLE IF NOT EXISTS public.artiste_payout_details (
  artiste_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  provider text,
  payment_page_url text,
  subaccount_code text CHECK (subaccount_code IS NULL OR subaccount_code ~* '^ACCT_[A-Za-z0-9]+$'),
  is_placeholder boolean NOT NULL DEFAULT false,
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.artiste_payout_details ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.artiste_payout_details FROM anon, authenticated;
GRANT ALL ON public.artiste_payout_details TO service_role;

-- No policies are created on purpose: with RLS enabled and no policy, every anon
-- and authenticated read/write is denied. Only service_role bypasses RLS.

-- 2. Archive the legacy values before dropping the columns.
--
-- The existing rows are NOT Paystack configuration: support_number holds a MoMo
-- phone number and support_account_name holds a person's name (for example
-- "desmond kofi antwi"). They cannot be moved into subaccount_code, which only
-- accepts ACCT_ codes. They are preserved here so nothing is lost and the owner
-- can still see what was on file, while the public table stops serving them.
CREATE TABLE IF NOT EXISTS public.artiste_payout_details_legacy (
  artiste_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  support_provider text,
  support_number text,
  support_account_name text,
  archived_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.artiste_payout_details_legacy ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.artiste_payout_details_legacy FROM anon, authenticated;
GRANT ALL ON public.artiste_payout_details_legacy TO service_role;

INSERT INTO public.artiste_payout_details_legacy
  (artiste_id, support_provider, support_number, support_account_name)
SELECT p.id, p.support_provider, p.support_number, p.support_account_name
FROM public.profiles p
WHERE p.support_number IS NOT NULL
   OR p.support_account_name IS NOT NULL
   OR p.support_provider IS NOT NULL
ON CONFLICT (artiste_id) DO NOTHING;

-- Only genuine Paystack configuration (an https Paystack page) is carried into the
-- new table. Everything else stays in the archive until an admin sets real values.
INSERT INTO public.artiste_payout_details
  (artiste_id, provider, payment_page_url, subaccount_code, is_placeholder)
SELECT
  p.id,
  p.support_provider,
  p.support_number,
  null,
  false
FROM public.profiles p
WHERE p.support_number IS NOT NULL
  AND p.support_number ~* '^https://([a-z0-9-]+\.)*paystack\.(com|shop)/'
  AND p.support_account_name ~* '^ACCT_[A-Za-z0-9]+$'
ON CONFLICT (artiste_id) DO NOTHING;

-- The columns must disappear so the public API can no longer return them.
ALTER TABLE public.profiles DROP COLUMN IF EXISTS support_provider;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS support_number;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS support_account_name;

-- 3. The guard no longer has columns to pin for payout details; approval status stays
--    protected. Payout writes are denied outright by RLS on the new table.
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
  -- Support approval is admin-only. Payout details are no longer on this table.
  if not public.is_admin() then
    new.approval_status := old.approval_status;
  end if;
  return new;
end;
$function$;

-- Grandfathered rows (no status yet) stay publishable.
CREATE OR REPLACE FUNCTION public.is_profile_publishable(p_status text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $function$
  SELECT p_status IS NULL OR (p_status <> 'pending' AND p_status <> 'rejected');
$function$;

-- 4. Redacted, safe-to-publish view of support availability.
DROP FUNCTION IF EXISTS public.profile_support_summary(uuid);

CREATE OR REPLACE FUNCTION public.profile_support_summary(p_artiste_id uuid)
RETURNS TABLE(
  approved boolean,
  has_paystack_page boolean,
  payment_page_url text,
  provider text,
  is_placeholder boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT
    public.is_profile_publishable(p.approval_status),
    d.payment_page_url IS NOT NULL AND d.payment_page_url ~* '^https://([a-z0-9-]+\.)*paystack\.(com|shop)/',
    d.payment_page_url,
    d.provider,
    coalesce(d.is_placeholder, false)
  FROM public.profiles p
  LEFT JOIN public.artiste_payout_details d ON d.artiste_id = p.id
  WHERE p.id = p_artiste_id;
$function$;

REVOKE ALL ON FUNCTION public.profile_support_summary(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.profile_support_summary(uuid) TO anon, authenticated;

-- Bulk redacted view for the admin dashboard. Same safe columns; never the
-- subaccount code or account holder name.
DROP VIEW IF EXISTS public.profile_support_summaries;

CREATE VIEW public.profile_support_summaries AS
SELECT
  p.id AS artiste_id,
  public.is_profile_publishable(p.approval_status) AS approved,
  d.payment_page_url IS NOT NULL
    AND d.payment_page_url ~* '^https://([a-z0-9-]+\.)*paystack\.(com|shop)/' AS has_paystack_page,
  d.payment_page_url,
  d.provider,
  coalesce(d.is_placeholder, false) AS is_placeholder
FROM public.profiles p
LEFT JOIN public.artiste_payout_details d ON d.artiste_id = p.id;

REVOKE ALL ON public.profile_support_summaries FROM anon, authenticated;
GRANT SELECT ON public.profile_support_summaries TO authenticated;

-- 5. Admin-only read of the full payout row (needed to edit it in the dashboard).
--    Listeners never get this: it returns the subaccount code.
CREATE OR REPLACE FUNCTION public.admin_get_support_details(p_target text)
RETURNS TABLE(
  provider text,
  payment_page_url text,
  subaccount_code text,
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
      select c.provider_fallback, c.payment_page_url, c.subaccount_code, false, c.enabled, null::timestamptz
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
    select d.provider, d.payment_page_url, d.subaccount_code, d.is_placeholder,
           coalesce(c.enabled, true), d.updated_at
    from public.artiste_payout_details d
    left join public.support_checkout_config c on c.target = d.artiste_id::text
    where d.artiste_id = p_target::uuid;
end;
$function$;

REVOKE ALL ON FUNCTION public.admin_get_support_details(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_get_support_details(text) TO authenticated;

-- 6. One admin action writes payout details to the restricted table and keeps the
--    trusted checkout configuration in sync.
CREATE OR REPLACE FUNCTION public.admin_set_support_details(
  p_target text,
  p_provider text,
  p_payment_page_url text,
  p_subaccount_code text,
  p_approve boolean DEFAULT false,
  p_enabled boolean DEFAULT true,
  p_is_placeholder boolean DEFAULT false
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
    insert into public.artiste_payout_details as d
      (artiste_id, provider, payment_page_url, subaccount_code, is_placeholder, updated_by, updated_at)
    values (
      v_id,
      coalesce(v_provider, 'Paystack Payment Page'),
      v_url,
      v_sub,
      coalesce(p_is_placeholder, false),
      auth.uid(),
      now()
    )
    on conflict (artiste_id) do update
      set provider = excluded.provider,
          payment_page_url = excluded.payment_page_url,
          subaccount_code = excluded.subaccount_code,
          is_placeholder = excluded.is_placeholder,
          updated_by = excluded.updated_by,
          updated_at = now();

    update public.profiles set
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

REVOKE ALL ON FUNCTION public.admin_set_support_details(text, text, text, text, boolean, boolean, boolean)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_support_details(text, text, text, text, boolean, boolean, boolean)
  TO authenticated;

-- Drop the 6-argument version left by the previous migration so PostgREST cannot
-- resolve a stale signature without the placeholder flag.
DROP FUNCTION IF EXISTS public.admin_set_support_details(text, text, text, text, boolean, boolean);
