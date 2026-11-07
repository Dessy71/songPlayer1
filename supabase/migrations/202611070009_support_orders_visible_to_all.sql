-- Allow all users (authenticated and anonymous) to read verified support orders.
-- The artiste_supporters() RPC (SECURITY DEFINER) joins against
-- support_payment_orders to display supporter profile pictures on artiste
-- profile pages. Previously RLS only allowed each user to read their own
-- orders, so a listener visiting another artiste's page saw no supporters
-- (or only themselves). This policy exposes verified support orders for the
-- supporter display use case -- the RPC only returns non-sensitive fields
-- (display_name, avatar_url, total_amount_subunits), never payment amounts
-- or contact details.
-- Guarded so the file can be re-run (e.g. pasted into the SQL editor twice)
-- without failing on "policy already exists".
DO $migration$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'support_payment_orders'
      AND policyname = 'Verified supporters visible to all'
  ) THEN
    CREATE POLICY "Verified supporters visible to all"
      ON public.support_payment_orders
      FOR SELECT TO anon, authenticated
      USING (status = 'verified');
  END IF;
END $migration$;
