# Paystack payments: operations and security

## One-time merchant setup (required)

In **Paystack Dashboard → Settings → API Keys & Webhooks**, save this **Webhook URL** in the mode matching your secret key:

```
https://neicfighjkzokoxojboz.supabase.co/functions/v1/verify-premium-payment?webhook=1
```

The URL is also displayed in **Admin → Premium & Paystack**. This is a server endpoint, not a browser page. Paystack sends signed POST requests for `charge.success`. There is no separate webhook password; signatures use the Paystack secret key. A GET/unsigned request is intentionally rejected. **The merchant dashboard setting cannot be configured by this repository or the available connectors. Saving this URL is an outstanding operator step until confirmed in Paystack.**

Configure `PAYSTACK_SECRET_KEY` in Supabase Edge Function Secrets only. Never put it in a Vite variable, the public settings table, chat, or source control. Use the matching **test** secret for test charges and the **live** secret for live charges. Separate Supabase environments are recommended for staging. Key rotation must be coordinated with the merchant mode/key so webhook signatures keep validating.

Optional server-only `PAYMENT_APP_URL` selects the trusted return origin (default `https://gyidi-nwom.vercel.app`). Set it for a separate staging deployment. It is never taken from a client request. Update Supabase auth redirect allowlists when changing the application domain.

## Deployment order

This checkout extends the existing Phase 7 database; it is not a complete bootstrap of every historical schema migration.

1. Apply `202611060002_central_payment_recovery.sql`, then `202611060003_require_paid_entitlement.sql` to the existing database.
2. Deploy `verify-premium-payment` with gateway JWT verification **disabled** (`supabase/config.toml`). This is required because Paystack does not send Supabase JWTs. The function explicitly authenticates user actions via `auth.getUser()` and webhook actions via HMAC. Do not remove either check.
3. Deploy the frontend. Old callbacks `{ reference, plan }` are still accepted by the new verifier. The old activation RPC is no longer executable by browsers.
4. Save the webhook URL in Paystack and complete the acceptance checks below.

The server function and migrations were applied during implementation. No real charge or dashboard webhook delivery was performed by the agent. Frontend release status is reported separately.

## Admin approval for artiste support pages

`202611070001_admin_support_approval.sql` must be applied with the other migrations.
It adds `profiles.approval_status`, extends `guard_profile_updates` to pin
`approval_status` and the three `support_*` columns for non-admin writers, and adds
`admin_set_support_details(...)`. That RPC is the only supported way for an admin to
save a Paystack payment page URL / subaccount code and approve a profile: it
validates both values, refuses approval without them, and keeps the
`support_checkout_config` row that `support-checkout` reads in sync. Subaccount
codes are treated as case-sensitive.

## Architecture

- `initialize`: authenticated server computes the price from `platform_settings`, creates a random reference, saves an immutable account/plan/price/email snapshot in `premium_payment_orders`, and calls Paystack transaction initialization. Returns only the hosted checkout URL and reference. The browser cannot supply an amount or customer ID. Five checkout attempts per account in ten minutes are permitted by a best-effort check; use gateway rate limits for strict distributed abuse controls.
- `?webhook=1`: verify HMAC-SHA512 using **exact raw body bytes** and constant-work digest comparison before JSON parsing. Ignore unrelated event types. Do not trust webhook status, amount, or customer details; call `transaction/verify/:reference` even for signed success events.
- Shared verification checks success, exact reference, currency, integer amount, stored price, account metadata, plan metadata, customer email and valid paid timestamp. Historical Inline payments can be imported using verified account metadata and the current configured price; if prices changed, legacy payments may need support review. New orders always use the original price snapshot.
- `fulfill_verified_premium_payment`: executable only by `service_role`. A transaction-scoped per-account advisory lock serializes different renewals and webhook/callback races. Unique order references, unique Paystack transaction IDs and existing unique subscription references prevent double activation. Receipt insertion, order verification, permanent verification evidence and profile projection update commit or roll back together.
- `recover`: authenticated lookup of central account orders. Rechecks up to ten newest unfulfilled orders, then loads the account profile; no browser reference is needed. Webhooks process orders independently of this reconciliation limit. Signing in reads central profile state; app visibility changes reconcile pending payments and a visible-tab timer refreshes the profile.
- Subscription identity is the **Supabase Auth account UUID**. A payer phone number is not proof of account ownership and may be shared or recycled. Customers must sign in to the same account (using their normal credentials/account recovery) on any browser/device. A new account with a similar phone/email is not silently given another account's purchases.

## Expiry and access

The paid timestamp is the base for a new term; an existing later expiry is extended for renewals. PostgreSQL calendar intervals add one month or one year. Delayed delivery does not turn an old charge into a fresh subscription starting at retry time. Replaying a reference returns the current profile without extending it. Existing explicit administrator lifetime grants are preserved.

RLS requires active Premium for favorites, playlists, playlist songs, offline-library operations and daily verse records, in addition to existing ownership rules. Paid access requires a current successful central receipt and profile projection; unverified/expired profiles fail these database checks. Profile inserts cannot self-grant Premium/admin. Profile updates retain the existing protected-field trigger. Admin/lifetime access is an intentional exception, not a paid transaction.

The UI checks expiry on its clock and gates Lyrics/Sharing and premium views; disabling new checkout **does not grant free Premium**. `premium_enabled=false` now pauses new checkout rather than bypassing entitlement checks.

**Scope:** the existing product intentionally streams its public music catalog to free accounts. This change does not turn public Storage URLs or catalog text into DRM-protected media, revoke audio already cached on a device, or redesign all public catalog/profile fields. UI lyrics/support-detail gating is not cryptographic protection of data already delivered by the public catalog/profile APIs. If confidentiality of these assets is required, move them to private resources and authorize short-lived delivery separately. Browser callbacks and cached state cannot grant server-side Premium database privileges.

## Failure handling and observability

- Signature failures return 401; no verifier/activation is called.
- Provider timeout/unavailability returns an error, not an entitlement.
- Database failure returns non-2xx to Paystack so delivery can retry. Successful acknowledgment happens after fulfillment commits.
- Duplicate valid events succeed idempotently. Signed merchant events without matching app account metadata are ignored.
- Users retry **Restore my subscription**, not another purchase. Optional reference input remains for historical payments predating durable orders.
- Inspect Supabase function errors and `premium_payment_orders` joined to `premium_subscriptions` by reference. `pending`/`initialized` alone does not mean the customer was debited; abandoned/failed checkout attempts can remain there. Successful processing sets `verified_at`, paid time, customer code and transaction ID. Do not mark a payment paid based on an SMS screenshot alone.
- Keep existing receipt history during rollback. Do not restore browser RPC grants or bypass server verification to repair a charge.

## Acceptance checklist

Automated: `npm test` exercises signatures, mismatched amounts/currency/ownership, provider verification despite a signed webhook, database failure responses, actual PostgreSQL fulfillment/idempotency/rollback/expiry/RLS/privileges, and no-reference recovery with empty local storage. `npm run build` checks the frontend.

Before considering the rollout fully validated, use a controlled test-mode checkout in a staging environment:

1. Pay on account A; close the browser before the callback. Confirm webhook delivery receives 200 and one verified order/receipt is stored.
2. Sign in as A on another browser or reinstall the PWA with no local storage. Restore active access without typing a reference.
3. Replay the same signed event and race a callback with it; check one receipt and unchanged expiry.
4. Sign in as account B; confirm it cannot read A's orders or restore A's membership.
5. Change configured prices after order creation; the original amount snapshot must still verify.
6. Test provider/DB failures and retry delivery. Never grant access on failure.
7. Check month-end/yearly expiry and an expired account against both UI and RLS. Ensure free catalog streaming remains available as intended.
8. Confirm a forged signature is rejected and no secret appears in frontend bundles.

A saved webhook URL, a successful real provider delivery, and a completed debit/activation test must be verified separately; passing local tests does not prove the merchant dashboard is configured.
