-- ============================================================================
-- APPLY THESE TO THE LIVE DATABASE (Supabase Dashboard -> SQL Editor)
--
-- This file is a convenience bundle of the migrations that are NOT yet
-- applied to production. It is safe to run more than once.
--
-- Do NOT run 'supabase db push' right now: the remote migration history has
-- 11 versions that do not exist locally, so a push would try to replay every
-- local migration on top of an existing schema and fail partway through.
-- See supabase/production-sql/README.md for the full explanation.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Migration: 202611070009_support_orders_visible_to_all.sql
-- ----------------------------------------------------------------------------
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


-- ----------------------------------------------------------------------------
-- Migration: 202611070010_fix_profile_auto_creation.sql
-- ----------------------------------------------------------------------------
-- Fix: Ensure new user signups auto-create profiles with approval_status set.
-- The profiles table was created outside migrations (likely in Supabase dashboard),
-- and any auth.users trigger that auto-creates profiles may predate the
-- approval_status NOT NULL constraint from migration 202611070001.
-- This migration creates/replaces a reliable handle_new_user trigger that sets
-- approval_status = 'pending' for all non-admin signups.

-- Define is_admin if it doesn't already exist (used by triggers and RLS policies).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'is_admin' AND pronamespace = 'public'::regnamespace
  ) THEN
    CREATE OR REPLACE FUNCTION public.is_admin() RETURNS boolean
    LANGUAGE sql
    STABLE
    SET search_path = 'public'
    AS $function$
      SELECT EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE (p.id = auth.uid() OR p.claimed_user_id = auth.uid())
          AND p.role = 'admin'
      );
    $function$;
  END IF;
END $$;

-- Grant execute on is_admin to authenticated users (used by triggers and RLS).
GRANT EXECUTE ON FUNCTION public.is_admin() TO anon, authenticated;

-- Create/replace the profile auto-creation function.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (
    id,
    email,
    role,
    display_name,
    username,
    approval_status,
    created_at,
    updated_at
  )
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(
      NULLIF(TRIM((NEW.raw_user_meta_data ->> 'role')::text), ''),
      'listener'
    ),
    COALESCE(
      NULLIF(TRIM((NEW.raw_user_meta_data ->> 'display_name')::text), ''),
      NEW.email
    ),
    COALESCE(
      NULLIF(TRIM((NEW.raw_user_meta_data ->> 'username')::text), ''),
      split_part(NEW.email, '@', 1) || '_' || floor(random() * 8999 + 1000)::text
    ),
    'pending',
    now(),
    now()
  );
  RETURN NEW;
END;
$function$;

-- Revoke and re-grant execute to ensure correct permissions.
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO anon, authenticated;

-- Drop any existing trigger on auth.users for profile creation, then recreate.
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();


-- ----------------------------------------------------------------------------
-- Migration: 202611070011_adopt_paystack_page_support.sql
-- ----------------------------------------------------------------------------
-- Attribute Paystack payment-page (storefront) donations to a Gyidi Nwom account.
--
-- Why this exists: the "Support" button on an artiste profile opens the artiste's
-- Paystack payment page (https://paystack.shop/pay/<tag>) directly, so no row is
-- written to support_payment_orders before the money moves. When Paystack then
-- sends charge.success, the reference is Paystack-generated (T0...) and carries
-- none of our metadata, so there is nothing to match. The support-checkout edge
-- function adopts those charges by looking the payer up by the email they typed
-- on Paystack, then re-verifies the charge with Paystack server-to-server before
-- awarding the supporter badge.
--
-- Service-role only: this must never expose auth.users to clients.
CREATE OR REPLACE FUNCTION public.support_user_id_by_email(p_email text)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $function$
  SELECT u.id
  FROM auth.users u
  WHERE lower(u.email) = lower(btrim(p_email))
  ORDER BY u.created_at
  LIMIT 1;
$function$;

REVOKE ALL ON FUNCTION public.support_user_id_by_email(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.support_user_id_by_email(text) TO service_role;


-- ----------------------------------------------------------------------------
-- Migration: 202611070012_recent_plays.sql
-- ----------------------------------------------------------------------------
-- Recently played follows the account across devices.
--
-- It previously lived only in localStorage under one fixed key
-- ('gyidi_recent_ids_v2'), so the list was stranded on whichever device or
-- browser recorded it. Because that key had no user in it, two accounts sharing
-- a browser also shared a single list.
--
-- This table is the source of truth per account. localStorage becomes a
-- per-user cache used for instant paint and for signed-out playback.
--
-- Written to be re-runnable so it can be pasted into the SQL editor more than
-- once alongside the other pending migrations.
CREATE TABLE IF NOT EXISTS public.recent_plays (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  song_id text NOT NULL,
  played_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, song_id)
);

CREATE INDEX IF NOT EXISTS recent_plays_user_recent
  ON public.recent_plays (user_id, played_at DESC);

ALTER TABLE public.recent_plays ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.recent_plays FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.recent_plays TO authenticated;
GRANT ALL ON public.recent_plays TO service_role;

-- A user can only ever read or write their own rows.
DROP POLICY IF EXISTS "Own recent plays" ON public.recent_plays;
CREATE POLICY "Own recent plays" ON public.recent_plays
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Keep the list bounded. Deliberately SECURITY INVOKER (the default): the RLS
-- policy above already restricts visibility to auth.uid(), so passing someone
-- else's id simply matches no rows instead of deleting them.
CREATE OR REPLACE FUNCTION public.prune_recent_plays(p_user_id uuid, p_keep integer DEFAULT 24)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $function$
BEGIN
  IF p_keep IS NULL OR p_keep < 1 THEN
    p_keep := 24;
  END IF;

  DELETE FROM public.recent_plays r
  WHERE r.user_id = p_user_id
    AND r.song_id NOT IN (
      SELECT song_id
      FROM public.recent_plays
      WHERE user_id = p_user_id
      ORDER BY played_at DESC
      LIMIT p_keep
    );
END;
$function$;

REVOKE ALL ON FUNCTION public.prune_recent_plays(uuid, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.prune_recent_plays(uuid, integer) TO authenticated;


