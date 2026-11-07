-- Attribute Paystack payment-page (storefront) donations to a Gyidi Nwom account.
--
-- Why this exists: the "Support" button on an artiste profile opens the artiste's
-- Paystack payment page (https://paystack.shop/pay/<tag>) directly, so no row is
-- written to support_payment_orders before the money moves. When Paystack then
-- sends charge.success, the reference is Paystack-generated (T0...) and carries
-- none of our metadata, so there is nothing to match. The support-checkout edge
-- function adopts those charges by looking the payer up by the email they typed
-- on Paystack, then re-verifies the charge with Paystack server-to-server before
-- awarding the supporter badge.
--
-- Service-role only: this must never expose auth.users to clients.
CREATE OR REPLACE FUNCTION public.support_user_id_by_email(p_email text)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $function$
  SELECT u.id
  FROM auth.users u
  WHERE lower(u.email) = lower(btrim(p_email))
  ORDER BY u.created_at
  LIMIT 1;
$function$;

REVOKE ALL ON FUNCTION public.support_user_id_by_email(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.support_user_id_by_email(text) TO service_role;
