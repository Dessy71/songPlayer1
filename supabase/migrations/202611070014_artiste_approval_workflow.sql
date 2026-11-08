-- Artiste application workflow.
--
-- A listener switching to an artiste profile submits bank or mobile-money
-- payout details. An administrator reviews them, creates the Paystack
-- subaccount and payment page from them, and then approves or rejects.
--
-- Nothing here is readable by the public: artiste_payout_details has RLS
-- enabled with no policies, so only service_role can see it. These functions
-- are the single guarded door.

-- Why a rejection happened, shown back to the artiste.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS rejection_reason text;

-- ---------------------------------------------------------------------------
-- The approval queue: every artiste profile with the payout details an admin
-- needs in order to create the Paystack subaccount and payment page.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_artiste_applications()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admins only';
  END IF;

  RETURN (
    SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb)
    FROM (
      SELECT
        p.id AS artiste_id,
        p.stage_name,
        p.display_name,
        p.real_name,
        p.email,
        p.avatar_url,
        p.scg_zone,
        p.scg_branch,
        p.is_sacsu,
        p.tertiary_institution,
        p.role,
        COALESCE(p.approval_status, 'pending') AS approval_status,
        p.rejection_reason,
        p.created_at,
        d.payment_method,
        d.bank_name,
        d.bank_account_number,
        d.bank_account_name,
        d.momo_operator,
        d.momo_phone_number,
        -- What the admin has already set up on Paystack.
        d.subaccount_code,
        d.payment_page_url,
        COALESCE(d.is_placeholder, false) AS is_placeholder,
        (d.payment_method IS NOT NULL
           OR d.bank_account_number IS NOT NULL
           OR d.momo_phone_number IS NOT NULL) AS has_payout_details
      FROM public.profiles p
      LEFT JOIN public.artiste_payout_details d ON d.artiste_id = p.id
      WHERE p.role = 'artiste'
      ORDER BY
        CASE COALESCE(p.approval_status, 'pending')
          WHEN 'pending' THEN 0
          WHEN 'rejected' THEN 1
          ELSE 2
        END,
        p.created_at DESC
    ) t
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.admin_artiste_applications() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_artiste_applications() TO authenticated;

-- ---------------------------------------------------------------------------
-- Approve or reject. Rejection records a reason shown to the artiste.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_set_artiste_approval(
  p_artiste_id uuid,
  p_status text,
  p_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_row public.profiles;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admins only';
  END IF;
  IF p_status NOT IN ('approved', 'rejected', 'pending') THEN
    RAISE EXCEPTION 'Invalid approval status';
  END IF;

  UPDATE public.profiles
  SET approval_status = p_status,
      rejection_reason = CASE WHEN p_status = 'rejected' THEN NULLIF(btrim(COALESCE(p_reason, '')), '') ELSE NULL END
  WHERE id = p_artiste_id AND role = 'artiste'
  RETURNING * INTO v_row;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Artiste profile not found';
  END IF;

  RETURN jsonb_build_object(
    'artiste_id', v_row.id,
    'approval_status', v_row.approval_status,
    'rejection_reason', v_row.rejection_reason
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.admin_set_artiste_approval(uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_artiste_approval(uuid, text, text) TO authenticated;

-- ---------------------------------------------------------------------------
-- Let an artiste read back only their own payout row. The table itself has no
-- policies, so without this the form could never be pre-filled and an artiste
-- could not tell whether their details were saved.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.artiste_get_payout_details()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_profile_id uuid;
  v_row public.artiste_payout_details;
BEGIN
  SELECT id INTO v_profile_id
  FROM public.profiles
  WHERE id = auth.uid() OR claimed_user_id = auth.uid()
  LIMIT 1;

  IF v_profile_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT * INTO v_row FROM public.artiste_payout_details WHERE artiste_id = v_profile_id;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  RETURN jsonb_build_object(
    'payment_method', v_row.payment_method,
    'bank_name', v_row.bank_name,
    'bank_account_number', v_row.bank_account_number,
    'bank_account_name', v_row.bank_account_name,
    'momo_operator', v_row.momo_operator,
    'momo_phone_number', v_row.momo_phone_number
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.artiste_get_payout_details() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.artiste_get_payout_details() TO authenticated;
