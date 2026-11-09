-- Account closure and deletion for listeners and artistes.
--
-- Two distinct actions, deliberately separated:
--
--   Close  — reversible deactivation. Login and studio access stop, the
--            public profile comes down, but songs, albums, audio, cover art
--            and listener history are untouched and the artiste_id /
--            uploaded_by links are preserved. An administrator can reopen it.
--
--   Delete — permanent. Runs after a 30-day recovery window. Personal data
--            and the auth credential go; published music is orphaned rather
--            than destroyed, so a catalogue is never lost because someone
--            left.

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_closed boolean NOT NULL DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS closed_at timestamptz;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS closed_reason text;
-- Set when deletion is requested. The row is purged once this ages past the
-- recovery window.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS delete_requested_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_profiles_is_closed ON public.profiles (is_closed) WHERE is_closed;
CREATE INDEX IF NOT EXISTS idx_profiles_delete_requested
  ON public.profiles (delete_requested_at)
  WHERE delete_requested_at IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Closing is self-service; reopening is admin-only. Without the second half a
-- closed account could flip itself back on and walk straight in.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.guard_profile_updates()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
begin
  new.updated_at := now();
  if new.role = 'admin' and old.role != 'admin' then
    if not public.is_admin() then
      raise exception 'Only an administrator can grant admin privileges.';
    end if;
  end if;
  if new.is_verified_artiste is distinct from old.is_verified_artiste and not public.is_admin() then
    new.is_verified_artiste := old.is_verified_artiste;
  end if;
  if (
    new.is_premium is distinct from old.is_premium or
    new.premium_plan is distinct from old.premium_plan or
    new.premium_until is distinct from old.premium_until
  ) then
    if not public.is_admin() and coalesce(current_setting('app.allow_premium_grant', true), '') != 'true' then
      new.is_premium := old.is_premium;
      new.premium_plan := old.premium_plan;
      new.premium_until := old.premium_until;
    end if;
  end if;
  -- Support approval is admin-only. Payout details are no longer on this table.
  if not public.is_admin() then
    new.approval_status := old.approval_status;
  end if;
  -- Ban state is admin-only.
  if not public.is_admin() then
    new.is_banned := old.is_banned;
    new.ban_reason := old.ban_reason;
    new.banned_at := old.banned_at;
    new.banned_by := old.banned_by;
  end if;
  -- Anyone may close their own account, but only an administrator may reopen
  -- one. Reopening is a verification step, not a self-service toggle.
  if old.is_closed and not new.is_closed and not public.is_admin() then
    new.is_closed := old.is_closed;
    new.closed_at := old.closed_at;
    new.closed_reason := old.closed_reason;
  end if;
  return new;
end;
$function$;

-- ---------------------------------------------------------------------------
-- Close your own account. Reversible by an administrator only.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.close_my_account(p_reason text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_row public.profiles;
BEGIN
  UPDATE public.profiles
  SET is_closed = true,
      closed_at = now(),
      closed_reason = NULLIF(btrim(COALESCE(p_reason, '')), '')
  WHERE id = auth.uid()
  RETURNING * INTO v_row;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile not found';
  END IF;

  RETURN jsonb_build_object(
    'id', v_row.id,
    'is_closed', v_row.is_closed,
    'closed_at', v_row.closed_at
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.close_my_account(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.close_my_account(text) TO authenticated;

-- ---------------------------------------------------------------------------
-- Cancel a pending deletion during the recovery window.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cancel_my_deletion()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE public.profiles
  SET delete_requested_at = NULL
  WHERE id = auth.uid();

  RETURN jsonb_build_object('id', auth.uid(), 'delete_requested_at', NULL);
END;
$function$;

REVOKE ALL ON FUNCTION public.cancel_my_deletion() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_my_deletion() TO authenticated;

-- ---------------------------------------------------------------------------
-- What the signed-in user needs to render their own closure state, including
-- the date the permanent deletion becomes due.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.my_account_state()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT COALESCE(
    (
      SELECT jsonb_build_object(
        'is_banned', p.is_banned,
        'ban_reason', p.ban_reason,
        'is_closed', p.is_closed,
        'closed_at', p.closed_at,
        'closed_reason', p.closed_reason,
        'delete_requested_at', p.delete_requested_at,
        'delete_due_at', CASE
          WHEN p.delete_requested_at IS NULL THEN NULL
          ELSE p.delete_requested_at + interval '30 days'
        END
      )
      FROM public.profiles p
      WHERE p.id = auth.uid()
      LIMIT 1
    ),
    'null'::jsonb
  );
$function$;

REVOKE ALL ON FUNCTION public.my_account_state() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.my_account_state() TO authenticated;

-- ---------------------------------------------------------------------------
-- Administrator: close or reopen an account. Reopening is how a closed
-- artiste gets back in after verification.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_set_account_closed(
  p_profile_id uuid,
  p_closed boolean
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_row public.profiles;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admins only';
  END IF;

  UPDATE public.profiles
  SET is_closed = COALESCE(p_closed, false),
      closed_at = CASE WHEN COALESCE(p_closed, false) THEN now() ELSE NULL END,
      closed_reason = CASE WHEN COALESCE(p_closed, false) THEN closed_reason ELSE NULL END
  WHERE id = p_profile_id
  RETURNING * INTO v_row;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile not found';
  END IF;

  RETURN jsonb_build_object(
    'id', v_row.id,
    'is_closed', v_row.is_closed,
    'closed_at', v_row.closed_at
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.admin_set_account_closed(uuid, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_account_closed(uuid, boolean) TO authenticated;
