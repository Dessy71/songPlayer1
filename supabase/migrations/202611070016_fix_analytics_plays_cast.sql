-- Fix play counting in app analytics.
--
-- upsert_app_session cast the `plays` value with (p_payload->'plays')::integer.
-- Postgres has no direct cast from jsonb to integer — it requires ->> (text)
-- first — so every 'play' heartbeat raised "cannot cast type jsonb to integer"
-- and the edge function answered 503. Session heartbeats carried no `plays`
-- key, which is why sessions could still be created while plays stayed at 0.

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
    -- ->> returns text, which does cast to integer.
    plays         = plays + COALESCE((p_payload->>'plays')::integer, 0)
  WHERE session_id = p_session_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.upsert_app_session(text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_app_session(text, jsonb) TO service_role;
