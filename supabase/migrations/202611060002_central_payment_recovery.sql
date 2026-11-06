-- Additive to Phase 7. Keep existing receipts/admin grants; never delete paid history.
CREATE TABLE public.premium_payment_orders (
 reference text PRIMARY KEY,
 user_id uuid NOT NULL REFERENCES auth.users(id),
 plan_interval text NOT NULL CHECK (plan_interval IN ('monthly','yearly')),
 amount_subunits bigint NOT NULL CHECK (amount_subunits > 0),
 currency text NOT NULL DEFAULT 'GHS' CHECK (currency = 'GHS'),
 customer_email text NOT NULL,
 status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','initialized','verified')),
 paystack_transaction_id text UNIQUE,
 paystack_customer_code text,
 paid_at timestamptz,
 verified_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX premium_orders_recovery ON public.premium_payment_orders(user_id, created_at DESC);
ALTER TABLE public.premium_payment_orders ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.premium_payment_orders FROM anon, authenticated;
GRANT SELECT ON public.premium_payment_orders TO authenticated;
GRANT ALL ON public.premium_payment_orders TO service_role;
CREATE POLICY "Read own payment orders" ON public.premium_payment_orders FOR SELECT TO authenticated
 USING (user_id = auth.uid() OR public.is_admin());

-- Caller must be the trusted verifier, never a browser. Unique references and a
-- per-account transaction lock make webhook/callback/recovery races idempotent.
CREATE FUNCTION public.fulfill_verified_premium_payment(
 p_reference text, p_transaction_id text, p_customer_code text,
 p_paid_at timestamptz, p_channel text
) RETURNS public.profiles LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE o public.premium_payment_orders; profile public.profiles; receipt public.premium_subscriptions;
 base timestamptz; expiry timestamptz;
BEGIN
 SELECT * INTO o FROM public.premium_payment_orders WHERE reference=p_reference;
 IF NOT FOUND THEN RAISE EXCEPTION 'Payment order not found'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(o.user_id::text, 0));
 SELECT * INTO o FROM public.premium_payment_orders WHERE reference=p_reference FOR UPDATE;
 SELECT * INTO receipt FROM public.premium_subscriptions WHERE paystack_reference=p_reference;
 IF FOUND THEN
   IF receipt.user_id <> o.user_id THEN RAISE EXCEPTION 'Payment ownership mismatch'; END IF;
   UPDATE public.premium_payment_orders SET status='verified', paystack_transaction_id=p_transaction_id,
    paystack_customer_code=p_customer_code,paid_at=p_paid_at,verified_at=now() WHERE reference=p_reference;
   SELECT * INTO profile FROM public.profiles WHERE id=receipt.profile_id;
   RETURN profile;
 END IF;
 IF p_transaction_id IS NULL OR p_paid_at IS NULL OR p_paid_at > now()+interval '5 minutes' THEN
   RAISE EXCEPTION 'Verified transaction details required';
 END IF;
 SELECT * INTO profile FROM public.profiles WHERE id=o.user_id OR claimed_user_id=o.user_id
 ORDER BY (role='admin') DESC, (claimed_user_id=o.user_id AND is_precreated) DESC NULLS LAST,
 (role='artiste') DESC, created_at ASC LIMIT 1 FOR UPDATE;
 IF profile.id IS NULL THEN RAISE EXCEPTION 'Account profile missing'; END IF;
 -- Anchor delayed notifications to the actual paid date, not the retry date.
 -- Renewals extend an existing paid term; replay never extends it a second time.
 base := greatest(p_paid_at, coalesce(profile.premium_until,p_paid_at));
 expiry := base + CASE WHEN o.plan_interval='yearly' THEN interval '1 year' ELSE interval '1 month' END;
 INSERT INTO public.premium_subscriptions(user_id,profile_id,user_email,plan_interval,amount_ghs,currency,
 paystack_reference,paystack_status,payment_channel,starts_at,expires_at)
 VALUES(o.user_id,profile.id,o.customer_email,o.plan_interval,o.amount_subunits/100.0,o.currency,
 o.reference,'success',p_channel,base,expiry);
 UPDATE public.premium_payment_orders SET status='verified', paystack_transaction_id=p_transaction_id,
 paystack_customer_code=p_customer_code,paid_at=p_paid_at,verified_at=now() WHERE reference=p_reference;
 INSERT INTO public.verified_premium_payments(reference,user_id,plan_interval,amount_subunits)
 VALUES(o.reference,o.user_id,o.plan_interval,o.amount_subunits) ON CONFLICT(reference) DO NOTHING;
 PERFORM set_config('app.allow_premium_grant','true',true);
 UPDATE public.profiles SET is_premium=CASE WHEN premium_plan='lifetime' THEN true ELSE expiry>now() END,
 premium_plan=CASE WHEN premium_plan='lifetime' THEN premium_plan ELSE o.plan_interval END,
 premium_until=CASE WHEN premium_plan='lifetime' THEN premium_until ELSE expiry END,last_payment_reference=o.reference WHERE id=profile.id RETURNING * INTO profile;
 RETURN profile;
END $$;
REVOKE ALL ON FUNCTION public.fulfill_verified_premium_payment(text,text,text,timestamptz,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.fulfill_verified_premium_payment(text,text,text,timestamptz,text) TO service_role;
-- Old browser RPC must no longer consume the permanent verified receipts.
REVOKE ALL ON FUNCTION public.activate_premium_subscription(text,text,text) FROM PUBLIC,anon,authenticated;

-- Prevent a new user from inserting their own Premium/admin grant.
CREATE FUNCTION public.guard_profile_entitlement_insert() RETURNS trigger
 LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' AND NOT public.is_admin() THEN
   NEW.is_premium:=false; NEW.premium_plan:=NULL; NEW.premium_until:=NULL; NEW.last_payment_reference:=NULL;
   IF NEW.role='admin' THEN RAISE EXCEPTION 'Only an administrator can grant admin privileges'; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER guard_profile_entitlement_insert BEFORE INSERT ON public.profiles
 FOR EACH ROW EXECUTE FUNCTION public.guard_profile_entitlement_insert();

CREATE FUNCTION public.has_active_premium() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
 SET search_path=public AS $$
 SELECT EXISTS(SELECT 1 FROM public.profiles p WHERE (p.id=auth.uid() OR p.claimed_user_id=auth.uid())
 AND (p.role='admin' OR (p.is_premium AND (p.premium_plan='lifetime' OR p.premium_until>now()))));
$$;
REVOKE ALL ON FUNCTION public.has_active_premium() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_active_premium() TO anon,authenticated,service_role;
-- Restrictive policies AND the existing ownership policies, never replace them.
CREATE POLICY "Premium required" ON public.favorites AS RESTRICTIVE FOR ALL TO authenticated
 USING(public.has_active_premium()) WITH CHECK(public.has_active_premium());
CREATE POLICY "Premium required" ON public.playlists AS RESTRICTIVE FOR ALL TO authenticated
 USING(public.has_active_premium()) WITH CHECK(public.has_active_premium());
CREATE POLICY "Premium required" ON public.playlist_songs AS RESTRICTIVE FOR ALL TO authenticated
 USING(public.has_active_premium()) WITH CHECK(public.has_active_premium());
CREATE POLICY "Premium required" ON public.offline_library AS RESTRICTIVE FOR ALL TO authenticated
 USING(public.has_active_premium()) WITH CHECK(public.has_active_premium());
CREATE POLICY "Premium required" ON public.daily_verse_flyers AS RESTRICTIVE FOR SELECT TO anon,authenticated
 USING(public.has_active_premium());
