-- Linking orphaned releases to artiste profiles.
--
-- Songs and albums uploaded before profiles were linked by name carry a
-- denormalised `artist` credit but no `artiste_id`. Those releases are
-- invisible to the name sync in 0018 and can only appear on a profile via a
-- fragile text match, so they need to be attributed properly.
--
-- Guessing authorship from a name is unsafe when two artistes share one, so
-- this is deliberately NOT a silent backfill. It adds the pieces an admin
-- needs to review each candidate and approve it one at a time.

ALTER TABLE public.songs ADD COLUMN IF NOT EXISTS artiste_link_reviewed_at timestamptz;
ALTER TABLE public.albums ADD COLUMN IF NOT EXISTS artiste_link_reviewed_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_songs_unlinked
  ON public.songs (id)
  WHERE artiste_id IS NULL AND artiste_link_reviewed_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_albums_unlinked
  ON public.albums (id)
  WHERE artiste_id IS NULL AND artiste_link_reviewed_at IS NULL;

-- ---------------------------------------------------------------------------
-- Attribute one release to a profile.
--
-- SECURITY DEFINER because catalogue rows are RLS-protected and even an
-- administrator cannot rewrite arbitrary songs from the client.
--
-- Pass p_profile_id to link, or NULL to record that the release was looked at
-- and deliberately left alone. The NULL case must never clear an existing
-- link, so it coalesces to the current value.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_link_release(
  p_release_kind text,
  p_release_id uuid,
  p_profile_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_artiste_id uuid;
  v_title text;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admins only';
  END IF;

  IF p_release_kind NOT IN ('song', 'album') THEN
    RAISE EXCEPTION 'Unknown release kind: %', p_release_kind;
  END IF;

  IF p_release_kind = 'song' THEN
    UPDATE public.songs
    SET artiste_id = COALESCE(p_profile_id, artiste_id),
        artiste_link_reviewed_at = now()
    WHERE id = p_release_id
    RETURNING artiste_id, title INTO v_artiste_id, v_title;
  ELSE
    UPDATE public.albums
    SET artiste_id = COALESCE(p_profile_id, artiste_id),
        artiste_link_reviewed_at = now()
    WHERE id = p_release_id
    RETURNING artiste_id, title INTO v_artiste_id, v_title;
  END IF;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Release not found';
  END IF;

  RETURN jsonb_build_object(
    'kind', p_release_kind,
    'id', p_release_id,
    'title', v_title,
    'artiste_id', v_artiste_id
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.admin_link_release(text, uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_link_release(text, uuid, uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- What still needs looking at. Used by the admin review screen.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_unlinked_releases()
RETURNS TABLE (
  release_kind text,
  release_id uuid,
  title text,
  artist_credit text,
  category text,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  -- Without this the function would hand any signed-in user the whole
  -- unattributed catalogue.
  SELECT 'song'::text, s.id, s.title, s.artist, s.category, s.created_at
  FROM public.songs s
  WHERE public.is_admin()
    AND s.artiste_id IS NULL
    AND s.artiste_link_reviewed_at IS NULL
  UNION ALL
  SELECT 'album'::text, a.id, a.title, a.artist, a.category, a.created_at
  FROM public.albums a
  WHERE public.is_admin()
    AND a.artiste_id IS NULL
    AND a.artiste_link_reviewed_at IS NULL
  ORDER BY 6 DESC;
$function$;

REVOKE ALL ON FUNCTION public.admin_unlinked_releases() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_unlinked_releases() TO authenticated;
