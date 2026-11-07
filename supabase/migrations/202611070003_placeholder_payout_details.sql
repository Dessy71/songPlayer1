-- Sample payout details so the support flow can be exercised end to end before the
-- real Paystack page URLs and subaccount codes are supplied.
--
-- IMPORTANT: these are fake. Paystack rejects ACCT_placeholder0000, and
-- support-checkout validates the subaccount against Paystack before opening
-- checkout, so a listener will get a clean "Recipient unavailable" error rather
-- than a broken or misleading charge. Replace each row from
-- Admin -> Users -> Support Details (or Admin -> Approvals) with the real values.
--
-- is_placeholder = true keeps the admin UI labelled "Sample" so these are never
-- mistaken for live configuration.

INSERT INTO public.artiste_payout_details
  (artiste_id, provider, payment_page_url, subaccount_code, is_placeholder)
SELECT
  p.id,
  'Paystack Payment Page',
  'https://paystack.shop/pay/placeholder-' ||
    substr(replace(p.id::text, '-', ''), 1, 8),
  'ACCT_placeholder0000',
  true
FROM public.profiles p
WHERE p.role = 'artiste'
ON CONFLICT (artiste_id) DO NOTHING;

-- Keep the trusted checkout configuration aligned with the sample rows. Checkout
-- still fails closed at the Paystack subaccount lookup.
INSERT INTO public.support_checkout_config AS c
  (target, artiste_id, subaccount_code, payment_page_url, enabled)
SELECT
  d.artiste_id::text,
  d.artiste_id,
  d.subaccount_code,
  d.payment_page_url,
  true
FROM public.artiste_payout_details d
WHERE d.is_placeholder
ON CONFLICT (target) DO NOTHING;
