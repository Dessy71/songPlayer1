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
