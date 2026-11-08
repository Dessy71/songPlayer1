-- Banning (soft-deleting) artiste and listener profiles.
--
-- An administrator removes an account by banning it rather than deleting the
-- row: the auth user still exists, so the next sign-in can be met with a ban
-- page explaining what happened, and the decision stays reversible. A hard
-- delete would leave the user with a valid session and no profile at all,
-- which surfaces as errors rather than an explanation.

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_banned boolean NOT NULL DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS ban_reason text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS banned_at timestamptz;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS banned_by uuid;

CREATE INDEX IF NOT EXISTS idx_profiles_is_banned ON public.profiles (is_banned)
  WHERE is_banned;

-- ---------------------------------------------------------------------------
-- Only an administrator may change ban state. Without this a banned user could
-- clear the flag from their own profile editor and walk straight back in.
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
  return new;
end;
$function$;

-- ---------------------------------------------------------------------------
-- Ban or unban. Banning records who did it, when, and why; unbanning clears
-- all three so the profile comes back exactly as it was.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_set_user_ban(
  p_profile_id uuid,
  p_banned boolean,
  p_reason text DEFAULT NULL
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

  -- An admin cannot ban themselves: locking yourself out of the only account
  -- that can undo the ban is not recoverable from the app.
  IF p_profile_id = auth.uid() THEN
    RAISE EXCEPTION 'You cannot ban your own account.';
  END IF;

  UPDATE public.profiles
  SET is_banned = COALESCE(p_banned, false),
      ban_reason = CASE
        WHEN COALESCE(p_banned, false) THEN NULLIF(btrim(COALESCE(p_reason, '')), '')
        ELSE NULL
      END,
      banned_at = CASE WHEN COALESCE(p_banned, false) THEN now() ELSE NULL END,
      banned_by = CASE WHEN COALESCE(p_banned, false) THEN auth.uid() ELSE NULL END
  WHERE id = p_profile_id
  RETURNING * INTO v_row;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile not found';
  END IF;

  RETURN jsonb_build_object(
    'id', v_row.id,
    'is_banned', v_row.is_banned,
    'ban_reason', v_row.ban_reason,
    'banned_at', v_row.banned_at
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.admin_set_user_ban(uuid, boolean, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_user_ban(uuid, boolean, text) TO authenticated;

-- ---------------------------------------------------------------------------
-- What a signed-in user sees about their own ban. Kept separate so the app can
-- read the reason even if RLS on profiles is tightened later.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.my_ban_status()
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
        'banned_at', p.banned_at
      )
      FROM public.profiles p
      WHERE p.id = auth.uid()
      LIMIT 1
    ),
    'null'::jsonb
  );
$function$;

REVOKE ALL ON FUNCTION public.my_ban_status() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.my_ban_status() TO authenticated;
