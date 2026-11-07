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
