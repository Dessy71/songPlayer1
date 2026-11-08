# Applying migrations to production

## The situation

`npx supabase db push` currently fails with:

```
Remote migration versions not found in local migrations directory.
20261106083408 20261106093733 20261106101913 20261106104755 20261106113037
20261106115746 20261106144911 20261106151110 20261106161918 20261106162133
20261106203451
```

The remote project has **11 migrations recorded**, all named with a full
timestamp (`20261106083408`). The local `supabase/migrations/` folder has **15
files** named with a sequence number (`202611060001`, `202611070009`, …). No
version appears on both sides, so Supabase cannot tell which migrations are
already applied.

On top of that, some local migrations (0001–0008) were applied by pasting them
into the SQL editor in earlier sessions, which does **not** add anything to the
migration history table.

## Do not run the suggested repair command

```
# DO NOT RUN THIS (yet)
supabase migration repair --status reverted 20261106083408 ... --remote
```

`--status reverted` tells Supabase "these migrations are not applied" without
changing the schema. The very next `db push` would then try to run **all 15
local migrations** against a database that already contains their objects —
`CREATE TABLE support_checkout_config` (migration 0004) and friends would fail,
leaving the push half-finished.

## Safe path: apply the three pending migrations by hand

1. Open the Supabase Dashboard → **SQL Editor**.
2. Paste the whole contents of `apply-pending-migrations.sql` (in this folder).
3. Run it.

It bundles exactly the migrations that are not yet live:

| Migration | What it does |
| --- | --- |
| `202611070009_support_orders_visible_to_all.sql` | RLS policy so visitors can read verified support orders (needed for the supporter list to render at all) |
| `202611070010_fix_profile_auto_creation.sql` | `handle_new_user()` trigger that sets `approval_status = 'pending'` — fixes "Database error saving new user" on listener signup |
| `202611070011_adopt_paystack_page_support.sql` | `support_user_id_by_email()` RPC used by the support-checkout webhook to attribute Paystack payment-page donations |
| `202611070012_recent_plays.sql` | `recent_plays` table + `prune_recent_plays()` so recently played follows the account across devices |
| `202611070013_app_analytics.sql` | `app_sessions` table, `upsert_app_session()` and `admin_app_analytics()` for the App Usage dashboard |

All three are idempotent, so re-running them is harmless.

## After that: deploy the edge function

```powershell
npx supabase secrets set PAYSTACK_SECRET_KEY=sk_live_...
npx supabase functions deploy support-checkout
```

Then, as admin, open K Badu's support settings and click **Sync Paystack
payments** to adopt the GHS 2.00 donation whose 6 webhook attempts have already
been spent.

## Optional: reconcile the migration history later

Once the app is stable and you want `db push` working again:

1. See what the 11 remote migrations actually are:
   ```powershell
   npx supabase migration list --remote
   ```
2. Record the migrations you applied by hand as applied (marks history without
   running any SQL):
   ```powershell
   npx supabase migration repair --status applied 202611070001 202611070002 202611070003 202611070004 202611070005 202611070006 202611070007 202611070008 202611070009 202611070010 202611070011 --remote
   ```
3. Only once you have confirmed from step 1 that the 11 orphaned versions are
   already represented by the local files, mark them reverted:
   ```powershell
   npx supabase migration repair --status reverted 20261106083408 20261106093733 20261106101913 20261106104755 20261106113037 20261106115746 20261106144911 20261106151110 20261106161918 20261106162133 20261106203451 --remote
   ```

Do not run `supabase db pull --remote` — it would generate a migration that
tries to reconcile the diff and can easily produce destructive statements.
