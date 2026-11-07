-- Allow all authenticated users to read verified support orders.
-- The artiste_supporters() RPC (SECURITY DEFINER) joins against
-- support_payment_orders to display supporter profile pictures on artiste
-- profile pages. Previously RLS only allowed each user to read their own
-- orders, so a listener visiting another artiste's page saw no supporters
-- (or only themselves). This policy exposes verified support orders for the
-- supporter display use case -- the RPC only returns non-sensitive fields
-- (display_name, avatar_url, total_amount_subunits), never payment amounts
-- or contact details.
CREATE POLICY "Verified supporters visible to all"
  ON public.support_payment_orders
  FOR SELECT TO authenticated
  USING (status = 'verified');
