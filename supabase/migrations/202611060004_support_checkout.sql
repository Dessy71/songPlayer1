-- Provider-managed splits/settlements. No local commission or payout scheduler.
CREATE TABLE public.support_checkout_config (
 target text PRIMARY KEY,
 artiste_id uuid UNIQUE REFERENCES public.profiles(id),
 subaccount_code text CHECK (subaccount_code ~ '^ACCT_[a-zA-Z0-9]+$'),
 payment_page_url text,
 enabled boolean NOT NULL DEFAULT false,
 CHECK ((target='gyidi' AND artiste_id IS NULL) OR (artiste_id IS NOT NULL AND target=artiste_id::text))
);
ALTER TABLE public.support_checkout_config ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.support_checkout_config FROM anon,authenticated;
GRANT ALL ON public.support_checkout_config TO service_role;
CREATE TABLE public.support_payment_orders (
 reference text PRIMARY KEY,
 user_id uuid NOT NULL REFERENCES auth.users(id),
 artiste_id uuid REFERENCES public.profiles(id),
 amount_subunits bigint NOT NULL CHECK(amount_subunits>=100 AND amount_subunits<=1000000),
 customer_email text NOT NULL,
 subaccount_code text,
 domain text NOT NULL CHECK(domain IN ('test','live')),
 publicly_visible boolean NOT NULL DEFAULT false,
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','verified')),
 transaction_id text UNIQUE,
 paid_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),
 CHECK (artiste_id IS NULL OR subaccount_code IS NOT NULL)
);
CREATE INDEX support_payment_owner ON public.support_payment_orders(user_id,created_at DESC);
ALTER TABLE public.support_payment_orders ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.support_payment_orders FROM anon,authenticated;
GRANT SELECT ON public.support_payment_orders TO authenticated;
GRANT ALL ON public.support_payment_orders TO service_role;
CREATE POLICY "Support owner reads orders" ON public.support_payment_orders FOR SELECT TO authenticated USING(user_id=auth.uid());
CREATE FUNCTION public.fulfill_verified_support(p_reference text,p_transaction_id text,p_paid_at timestamptz)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE o public.support_payment_orders;
BEGIN
 SELECT * INTO o FROM public.support_payment_orders WHERE reference=p_reference FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Unknown support reference'; END IF;
 IF o.status='verified' THEN
  IF o.transaction_id IS DISTINCT FROM p_transaction_id THEN RAISE EXCEPTION 'Transaction mismatch'; END IF;
  RETURN;
 END IF;
 IF p_transaction_id IS NULL OR p_transaction_id !~ '^[1-9][0-9]*$' OR p_paid_at IS NULL OR p_paid_at>now()+interval '5 minutes' THEN RAISE EXCEPTION 'Invalid receipt'; END IF;
 UPDATE public.support_payment_orders SET status='verified',transaction_id=p_transaction_id,paid_at=p_paid_at WHERE reference=p_reference;
END; $$;
REVOKE ALL ON FUNCTION public.fulfill_verified_support(text,text,timestamptz) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.fulfill_verified_support(text,text,timestamptz) TO service_role;
-- Public recognition is opt-in and excludes payment amounts and contact details.
CREATE FUNCTION public.artiste_supporters(p_artiste_id uuid)
RETURNS TABLE(display_name text,avatar_url text) LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT coalesce(p.display_name,p.username,'Supporter'),p.avatar_url FROM public.profiles p
 WHERE EXISTS(SELECT 1 FROM public.support_payment_orders o WHERE o.user_id=coalesce(p.claimed_user_id,p.id) AND o.artiste_id=p_artiste_id AND o.status='verified' AND o.publicly_visible)
 LIMIT 100;
$$;
REVOKE ALL ON FUNCTION public.artiste_supporters(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.artiste_supporters(uuid) TO anon,authenticated;
-- Seed only the artiste identity explicitly matched from existing database metadata.
INSERT INTO public.support_checkout_config(target,artiste_id,subaccount_code,payment_page_url,enabled)
VALUES('93fdfca2-aa25-4e6f-ab40-5092a6dbc5c7','93fdfca2-aa25-4e6f-ab40-5092a6dbc5c7','ACCT_ab24mo1pg6dynup','https://paystack.shop/pay/kbadu',true);
