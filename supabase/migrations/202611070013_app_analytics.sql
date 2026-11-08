-- App analytics: who is using the platform, on what device, and from where.
--
-- Nothing was tracked before this. The table is written by the app-analytics
-- edge function (service role), which also resolves the caller's IP to a
-- country/region/city. Clients never write to it directly, so a visitor cannot
-- forge another visitor's row.
--
-- One row is a browser tab session. Heartbeats update last_seen_at rather than
-- inserting, so "active now" is a time window rather than a guess.

CREATE TABLE IF NOT EXISTS public.app_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id text NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  -- Device, parsed server side from the User-Agent.
  device_type text CHECK (device_type IN ('mobile', 'tablet', 'desktop', 'unknown')),
  os text,
  browser text,
  -- Resolved from the request IP.
  country text,
  country_code text,
  region text,
  city text,
  -- Activity counters.
  plays integer NOT NULL DEFAULT 0,
  is_listening boolean NOT NULL DEFAULT false,
  authenticated boolean NOT NULL DEFAULT false,
  referrer text,
  landing_path text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- One heartbeat per session, not per row.
CREATE UNIQUE INDEX IF NOT EXISTS app_sessions_session_key ON public.app_sessions (session_id);
CREATE INDEX IF NOT EXISTS app_sessions_last_seen ON public.app_sessions (last_seen_at DESC);
CREATE INDEX IF NOT EXISTS app_sessions_user ON public.app_sessions (user_id, last_seen_at DESC);
CREATE INDEX IF NOT EXISTS app_sessions_started ON public.app_sessions (started_at DESC);

ALTER TABLE public.app_sessions ENABLE ROW LEVEL SECURITY;

-- Clients have no access at all: reads go through the admin RPC below, writes
-- go through the edge function's service-role key.
REVOKE ALL ON public.app_sessions FROM anon, authenticated;
GRANT ALL ON public.app_sessions TO service_role;

-- ---------------------------------------------------------------------------
-- Admin summary. Everything the dashboard needs in one call.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_app_analytics(p_days integer DEFAULT 30)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_days integer := GREATEST(1, LEAST(COALESCE(p_days, 30), 365));
  v_since timestamptz := now() - (v_days || ' days')::interval;
  v_result jsonb;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admins only';
  END IF;

  SELECT jsonb_build_object(
    'window_days', v_days,

    -- Right now.
    'listening_now', (
      SELECT count(*) FROM public.app_sessions
      WHERE is_listening AND last_seen_at > now() - interval '5 minutes'
    ),
    'active_now', (
      SELECT count(*) FROM public.app_sessions
      WHERE last_seen_at > now() - interval '5 minutes'
    ),
    'active_hour', (
      SELECT count(DISTINCT session_id) FROM public.app_sessions
      WHERE last_seen_at > now() - interval '1 hour'
    ),

    -- Headline numbers for the selected window.
    'sessions', (
      SELECT count(*) FROM public.app_sessions WHERE started_at >= v_since
    ),
    'unique_users', (
      SELECT count(DISTINCT user_id) FROM public.app_sessions
      WHERE started_at >= v_since AND user_id IS NOT NULL
    ),
    'authenticated_sessions', (
      SELECT count(*) FROM public.app_sessions WHERE started_at >= v_since AND user_id IS NOT NULL
    ),
    'plays', (
      SELECT COALESCE(sum(plays), 0) FROM public.app_sessions WHERE started_at >= v_since
    ),

    -- Breakdowns.
    'devices', (
      SELECT COALESCE(jsonb_agg(t), '[]'::jsonb) FROM (
        SELECT COALESCE(device_type, 'unknown') AS label, count(*) AS value
        FROM public.app_sessions WHERE started_at >= v_since
        GROUP BY 1 ORDER BY value DESC
      ) t
    ),
    'countries', (
      SELECT COALESCE(jsonb_agg(t), '[]'::jsonb) FROM (
        SELECT COALESCE(country, 'Unknown') AS label,
               COALESCE(country_code, '') AS code,
               count(*) AS value
        FROM public.app_sessions WHERE started_at >= v_since
        GROUP BY 1, 2 ORDER BY value DESC LIMIT 12
      ) t
    ),
    'browsers', (
      SELECT COALESCE(jsonb_agg(t), '[]'::jsonb) FROM (
        SELECT COALESCE(browser, 'Unknown') AS label, count(*) AS value
        FROM public.app_sessions WHERE started_at >= v_since
        GROUP BY 1 ORDER BY value DESC LIMIT 8
      ) t
    ),

    -- Daily trend for the chart.
    'daily', (
      SELECT COALESCE(jsonb_agg(t), '[]'::jsonb) FROM (
        SELECT to_char(d.day, 'YYYY-MM-DD') AS day,
               COALESCE(s.sessions, 0) AS sessions,
               COALESCE(s.unique_users, 0) AS unique_users,
               COALESCE(s.plays, 0) AS plays
        FROM generate_series(
               date_trunc('day', now()) - ((v_days - 1) || ' days')::interval,
               date_trunc('day', now()),
               interval '1 day'
             ) AS d(day)
        LEFT JOIN (
          SELECT date_trunc('day', started_at) AS day,
                 count(*) AS sessions,
                 count(DISTINCT user_id) AS unique_users,
                 COALESCE(sum(plays), 0) AS plays
          FROM public.app_sessions
          WHERE started_at >= v_since
          GROUP BY 1
        ) s ON s.day = d.day
        ORDER BY d.day
      ) t
    )
  ) INTO v_result;

  RETURN v_result;
END;
$function$;

REVOKE ALL ON FUNCTION public.admin_app_analytics(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_app_analytics(integer) TO authenticated;

-- ---------------------------------------------------------------------------
-- Merge a heartbeat into a session. Called only by the app-analytics edge
-- function with the service-role key, so a client cannot write rows directly.
-- Absent keys leave the stored value untouched; `plays` accumulates.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.upsert_app_session(p_session_id text, p_payload jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  INSERT INTO public.app_sessions (session_id) VALUES (p_session_id)
  ON CONFLICT (session_id) DO NOTHING;

  UPDATE public.app_sessions SET
    last_seen_at  = COALESCE((p_payload->>'last_seen_at')::timestamptz, last_seen_at),
    ended_at      = COALESCE((p_payload->>'ended_at')::timestamptz, ended_at),
    device_type   = COALESCE(p_payload->>'device_type', device_type),
    os            = COALESCE(p_payload->>'os', os),
    browser       = COALESCE(p_payload->>'browser', browser),
    country       = COALESCE(p_payload->>'country', country),
    country_code  = COALESCE(p_payload->>'country_code', country_code),
    region        = COALESCE(p_payload->>'region', region),
    city          = COALESCE(p_payload->>'city', city),
    is_listening  = COALESCE((p_payload->>'is_listening')::boolean, is_listening),
    authenticated = COALESCE((p_payload->>'authenticated')::boolean, authenticated),
    user_id       = COALESCE((p_payload->>'user_id')::uuid, user_id),
    referrer      = COALESCE(p_payload->>'referrer', referrer),
    landing_path  = COALESCE(p_payload->>'landing_path', landing_path),
    plays         = plays + COALESCE((p_payload->'plays')::integer, 0)
  WHERE session_id = p_session_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.upsert_app_session(text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_app_session(text, jsonb) TO service_role;
