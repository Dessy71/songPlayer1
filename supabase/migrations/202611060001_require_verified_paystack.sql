-- Only the server-side Paystack verifier may attest payment receipts.
CREATE TABLE public.verified_premium_payments (
  reference text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id),
  plan_interval text NOT NULL CHECK (plan_interval IN ('monthly','yearly')),
  amount_subunits bigint NOT NULL CHECK (amount_subunits > 0),
  verified_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.verified_premium_payments ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.verified_premium_payments FROM anon, authenticated;
GRANT ALL ON public.verified_premium_payments TO service_role;

DO $migration$
DECLARE definition text;
BEGIN
  SELECT pg_get_functiondef('public.activate_premium_subscription(text,text,text)'::regprocedure) INTO definition;
  definition := replace(definition,
    '  SELECT email INTO v_email FROM auth.users WHERE id = v_uid;',
    '  -- Consumption is transactional: failures roll back the receipt deletion.
  DELETE FROM public.verified_premium_payments
  WHERE reference = trim(p_reference) AND user_id = v_uid
    AND plan_interval = p_plan_interval;
  IF NOT FOUND THEN
    RAISE EXCEPTION ''Server-verified Paystack payment required.'';
  END IF;
  SELECT email INTO v_email FROM auth.users WHERE id = v_uid;');
  IF position('Server-verified Paystack payment required.' in definition) = 0 THEN
    RAISE EXCEPTION 'Activation function could not be secured';
  END IF;
  EXECUTE definition;
END;
$migration$;
