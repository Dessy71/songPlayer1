-- The artiste name on a song or album belongs to the profile, not to the
-- upload form.
--
-- Songs and albums keep a denormalised `artist` text column because it is read
-- on almost every screen. That column can drift out of step with the profile
-- it belongs to, which is how an artiste ends up appearing under two names.
--
-- This makes the profile authoritative: renaming a profile carries the new
-- name across its catalogue, and the backfill below repairs existing drift.

-- The name the rest of the app shows for a profile. Mirrors the client's
-- defaultStageName fallback (src/components/UploadModal.tsx).
CREATE OR REPLACE FUNCTION public.effective_artiste_name(p_profile public.profiles)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $function$
  SELECT coalesce(
    nullif(btrim(coalesce(p_profile.stage_name, '')), ''),
    nullif(btrim(coalesce(p_profile.display_name, '')), ''),
    'SCG Artiste'
  );
$function$;

-- ---------------------------------------------------------------------------
-- Rename a profile, rename its catalogue with it.
--
-- SECURITY DEFINER because songs and albums are RLS-protected and the person
-- editing their own profile has no write access to the catalogue rows.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sync_artiste_catalogue_name()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_name text;
BEGIN
  -- Only renamed profiles do work. Nothing else about a profile touches the
  -- catalogue, so everything else exits immediately.
  IF public.effective_artiste_name(NEW) IS NOT DISTINCT FROM public.effective_artiste_name(OLD) THEN
    RETURN NULL;
  END IF;

  v_name := public.effective_artiste_name(NEW);

  UPDATE public.songs
  SET artist = v_name
  WHERE artiste_id = NEW.id
    AND artist IS DISTINCT FROM v_name;

  UPDATE public.albums
  SET artist = v_name
  WHERE artiste_id = NEW.id
    AND artist IS DISTINCT FROM v_name;

  RETURN NULL;
END;
$function$;

DROP TRIGGER IF EXISTS trg_profiles_sync_catalogue_name ON public.profiles;
CREATE TRIGGER trg_profiles_sync_catalogue_name
AFTER UPDATE OF stage_name, display_name ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.sync_artiste_catalogue_name();

-- ---------------------------------------------------------------------------
-- Repair existing drift. Idempotent: rows that already agree are skipped by
-- the IS DISTINCT FROM guards, so this is safe to re-run.
-- ---------------------------------------------------------------------------
DO $backfill$
BEGIN
  UPDATE public.songs s
  SET artist = public.effective_artiste_name(p)
  FROM public.profiles p
  WHERE s.artiste_id = p.id
    AND s.artist IS DISTINCT FROM public.effective_artiste_name(p);

  UPDATE public.albums a
  SET artist = public.effective_artiste_name(p)
  FROM public.profiles p
  WHERE a.artiste_id = p.id
    AND a.artist IS DISTINCT FROM public.effective_artiste_name(p);
END;
$backfill$;
