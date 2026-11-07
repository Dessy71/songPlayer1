-- Paid access requires a central successful subscription as well as a current
-- profile projection. Explicit administrator lifetime grants remain supported.
CREATE OR REPLACE FUNCTION public.has_active_premium() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
 SET search_path=public AS $$
 SELECT EXISTS(SELECT 1 FROM public.profiles p WHERE (p.id=auth.uid() OR p.claimed_user_id=auth.uid())
 AND (p.role='admin' OR (p.is_premium AND (p.premium_plan='lifetime' OR
 (p.premium_until>now() AND EXISTS(SELECT 1 FROM public.premium_subscriptions s
 WHERE s.user_id=auth.uid() AND s.profile_id=p.id AND s.paystack_status='success' AND s.expires_at>now()))))));
$$;
