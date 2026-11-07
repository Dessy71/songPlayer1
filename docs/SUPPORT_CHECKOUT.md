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

## Admin approval and Paystack configuration (implemented)

Artiste support pages are now approved from the app instead of a server-only seed.

- `profiles.approval_status` (`pending` / `approved` / `rejected`) gates a profile.
  Listeners cannot open a pending or rejected profile, and its support card never
  renders a payment link. Existing rows were backfilled to `approved` so no live
  artiste lost support access.
- `admin_set_support_details(target, provider, payment_page_url, subaccount_code,
  approve, enabled)` is the single admin action. It is `SECURITY DEFINER`, refuses
  every non-admin caller, validates the Paystack page URL and `ACCT_` subaccount
  code, refuses approval without both values, writes the public profile fields
  (`support_provider`, `support_number`, `support_account_name`, `approval_status`)
  and syncs the trusted `support_checkout_config` row the checkout function reads.
  Without that sync the listener button would have no working checkout.
- Paystack subaccount codes are **case-sensitive**; they are trimmed but never
  upper-cased.
- `guard_profile_updates` now also pins `approval_status` and the three support
  columns for non-admin writers, so an artiste cannot self-approve or swap payout
  details. `guard_profile_approval_insert` forces `pending` on non-admin inserts.
- Admin entry points: **Admin → Approvals** has an Artiste Profile queue, and
  **Admin → Users** has a per-artiste Support Details button. Both open the same
  modal where an admin saves the URL/subaccount and clicks *Approve & Activate*.
- The listener Support card shows a Support Badge with the artiste's profile
  picture only (no names). Clicking the money icon opens the Paystack payment page
  URL in a new tab. Platform-level "Support Gyidi Nwom" keeps using the verified
  server checkout, never a raw number.

## Payout details are no longer on the public profile

`profiles` is readable by everyone, so the payout columns were exposed to `anon`
through the public API: any visitor could read artiste MoMo numbers and account
names. `202611070002_private_payout_details.sql` closes that.

- Payout details now live in `artiste_payout_details`, which has RLS enabled with
  **no policies** and no `anon`/`authenticated` grants: only `service_role` reads
  it. `REVOKE ALL ... FROM anon, authenticated` is explicit.
- The three columns are **dropped** from `profiles`, so the public API can no longer
  return them, and `UserProfile` no longer declares them. The TypeScript compiler
  found every remaining caller.
- Browser reads use `profile_support_summary(artiste_id)` (single) or the
  `profile_support_summaries` view (bulk, `authenticated` only). Both return an
  `approved` flag, `has_paystack_page`, the payment page URL, the provider and an
  `is_placeholder` flag. **They never return the subaccount code or the account
  holder name.**
- `admin_get_support_details(target)` is the only read that returns the full row,
  including the subaccount, and it refuses non-admins.
- Writes go through `admin_set_support_details(...)`, which updates the restricted
  row and keeps `support_checkout_config` in sync.
- Signup (`AuthModal`) and Artiste Studio no longer collect payout details at all;
  they explain that an administrator configures Paystack after approval.
- Existing values were **archived, not deleted**: `artiste_payout_details_legacy`
  (service_role only) keeps the old provider/number/name so nothing is lost. Those
  values could not be migrated into `subaccount_code` because they are MoMo numbers
  and personal names, not `ACCT_` codes.

### Placeholder configuration

`202611070003_placeholder_payout_details.sql` seeds obvious sample values
(`https://paystack.shop/pay/placeholder-<id>` and `ACCT_placeholder0000`) marked
`is_placeholder = true`, so the admin UI labels them "Sample". Checkout still fails
closed: `support-checkout` validates the subaccount against Paystack before opening
checkout, so a listener gets a clean error rather than a bad charge. Replace each
row from **Admin -> Users -> Support Details** with the real URL and code.

## Remaining product work
- Automatic webhook verification and refunds/disputes/reversal recognition handling.
- Profile photo upload/edit after signup (existing avatar_url is displayed only).
- Artiste-private supporter/payment history and anonymous display rules.
- Legacy payout fields are now in private storage and no longer collected at
  signup (see above). Remaining: delete `artiste_payout_details_legacy` once the
  archived MoMo values have been reviewed and the real Paystack details are set.
- End-to-end live payment validation. Local tests use mocks/isolated PostgreSQL,
  not real money. No charge was made by the agent.

## Sources

https://paystack.com/docs/api/page/ documents page-level metadata and split codes,
not trusted per-visitor identity from arbitrary URL query parameters.
https://paystack.com/docs/api/transaction/ documents backend initialization with
reference, metadata and subaccount, and server-side transaction verification.
