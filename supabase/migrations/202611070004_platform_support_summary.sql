-- Listeners need the platform (Gyidi) payment page URL to redirect to, but must never
-- see the subaccount code. profile_support_summary() is keyed by artiste id, so this
-- is the equivalent for the 'gyidi' target.
--
-- Returns only: whether a Paystack page exists, the page URL itself, whether checkout
-- is enabled, and whether the row is a placeholder. No subaccount, no provider name.

CREATE OR REPLACE FUNCTION public.platform_support_summary()
RETURNS TABLE(
  has_paystack_page boolean,
  payment_page_url text,
  enabled boolean,
  is_placeholder boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT
    c.payment_page_url IS NOT NULL
      AND c.payment_page_url ~* '^https://([a-z0-9-]+\.)*paystack\.(com|shop)/',
    c.payment_page_url,
    coalesce(c.enabled, false),
    coalesce((c.subaccount_code = 'ACCT_placeholder0000'), false)
  FROM public.support_checkout_config c
  WHERE c.target = 'gyidi';
$function$;

REVOKE ALL ON FUNCTION public.platform_support_summary() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.platform_support_summary() TO anon, authenticated;
