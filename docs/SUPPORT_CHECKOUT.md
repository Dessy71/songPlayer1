# Support checkout status

## Active integration

`support-checkout` is a separate authenticated Supabase Edge Function. It uses the
existing server-side Paystack secret. Initialization validates the stored recipient
with Paystack before opening checkout. No payment is initiated by deployment.
Every customer must choose an amount, open checkout and authorize payment there.

The app does NOT calculate commission, set bearer/transaction_charge overrides,
or schedule payouts. Paystack subaccount configuration controls allocation and
settlement. This integration uses the subaccount, not the payment-page URL: split
settings stored only on a page/split group will not automatically apply here.
Confirm the SUBACCOUNT itself has the intended setup before authorizing payment.

Admin/server-only config maps K. Badu (Sekyere), existing profile
93fdfca2-aa25-4e6f-ab40-5092a6dbc5c7, to the user-supplied live subaccount
ACCT_ab24mo1pg6dynup. Other artistes and Gyidi direct support fail closed until
configured. The provided page URL is retained as configuration information only.

## Verification and recovery

Orders are stored centrally BEFORE checkout. Check payment fetches Paystack's
verification API; it checks owner, exact reference/amount/GHS, environment, metadata,
email and subaccount. The browser cannot mint verified orders. Atomic fulfillment
uses unique reference and transaction constraints. Pending receipts survive logout,
new devices and reinstalls; recent orders are fetched for the authenticated user.

Checkout opens a separate tab when possible, leaving Check payment accessible in
the app. Return to the app after paying. Do not pay twice if confirmation is slow.
No new automatic support webhook is installed: the existing Premium webhook is
unchanged. Support recognition currently requires Check payment. A future shared
signed-webhook dispatcher must preserve Premium and re-fetch provider verification.

## Support recognition and privacy

Public recognition is opt-in (unchecked by default). Only verified, opted-in orders
appear in the public supporters RPC. It returns display name/avatar, never amounts,
email, phone or account numbers. Anonymous supporters are excluded entirely.
Public artiste support-number displays and hard-coded Gyidi number blocks were
replaced by checkout components. Existing legacy support columns in profiles have
NOT been moved out of the public profile API: database-level payout-detail privacy
requires a follow-up migration and updates to legacy artiste/admin forms. Do not
claim full API-level privacy is complete.

## Remaining product work

- Admin UI for approval and payment configuration (currently server-only seed for
  the one artiste explicitly supplied by the owner).
- Automatic webhook verification and refunds/disputes/reversal recognition handling.
- Profile photo upload/edit after signup (existing avatar_url is displayed only).
- Artiste-private supporter/payment history and anonymous display rules.
- Move legacy payout fields to private storage and remove collection from signup.
- End-to-end live payment validation. Local tests use mocks/isolated PostgreSQL,
  not real money. No charge was made by the agent.

## Sources

https://paystack.com/docs/api/page/ documents page-level metadata and split codes,
not trusted per-visitor identity from arbitrary URL query parameters.
https://paystack.com/docs/api/transaction/ documents backend initialization with
reference, metadata and subaccount, and server-side transaction verification.
