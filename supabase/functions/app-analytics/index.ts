import { createClient } from 'npm:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization,x-client-info,apikey,content-type',
  'Access-Control-Allow-Methods': 'POST,OPTIONS',
};

/** Sessions unseen for this long are no longer "active". */
const ACTIVE_WINDOW_MS = 5 * 60 * 1000;

export function classifyDevice(userAgent: string): { device_type: string; os: string; browser: string } {
  const ua = userAgent || '';

  let device_type = 'desktop';
  if (/iPad|Tablet|Silk|Kindle|PlayBook|BB10/i.test(ua)) device_type = 'tablet';
  else if (/Mobi|Android|iPhone|iPod|IEMobile|Opera Mini|Windows Phone/i.test(ua)) device_type = 'mobile';
  // iPadOS 13+ pretends to be a Mac; touch points are the tell.
  else if (/Macintosh/.test(ua) && /Mobile/.test(ua)) device_type = 'tablet';

  let os = 'Unknown';
  if (/Windows/i.test(ua)) os = 'Windows';
  else if (/Android/i.test(ua)) os = 'Android';
  else if (/iPhone|iPad|iPod|iOS|Mac OS X/i.test(ua)) os = /iPhone|iPad|iPod/i.test(ua) ? 'iOS' : 'macOS';
  else if (/Mac OS X|Macintosh/i.test(ua)) os = 'macOS';
  else if (/Linux/i.test(ua)) os = 'Linux';

  let browser = 'Unknown';
  if (/Edg\//.test(ua)) browser = 'Edge';
  else if (/OPR\/|Opera/.test(ua)) browser = 'Opera';
  else if (/Firefox\//.test(ua)) browser = 'Firefox';
  else if (/Chrome\//.test(ua)) browser = 'Chrome';
  else if (/Safari\//.test(ua)) browser = 'Safari';

  return { device_type, os, browser };
}

/** Best-effort IP. Never required — geo is a nice-to-have, not a gate. */
function clientIp(req: Request): string | null {
  const forwarded = req.headers.get('x-forwarded-for');
  const candidate = (forwarded ? forwarded.split(',')[0] : req.headers.get('x-real-ip')) || '';
  const ip = candidate.trim();
  return ip && ip.length <= 45 ? ip : null;
}

async function lookupGeo(ip: string | null): Promise<{ country: string | null; country_code: string | null; region: string | null; city: string | null }> {
  const empty = { country: null, country_code: null, region: null, city: null };
  // Private and loopback addresses resolve to nothing useful.
  if (!ip || /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|127\.|::1|fc00:|fe80:)/.test(ip)) return empty;
  try {
    const response = await fetch(`https://ipapi.co/${encodeURIComponent(ip)}/json/`, {
      headers: { 'User-Agent': 'gyidi-nnwom/1.0' },
      signal: AbortSignal.timeout(4000),
    });
    if (!response.ok) return empty;
    const data = await response.json();
    return {
      country: typeof data.country_name === 'string' ? data.country_name.slice(0, 80) : null,
      country_code: typeof data.country_code === 'string' ? data.country_code.slice(0, 8) : null,
      region: typeof data.region === 'string' ? data.region.slice(0, 80) : null,
      city: typeof data.city === 'string' ? data.city.slice(0, 80) : null,
    };
  } catch {
    return empty;
  }
}

export function createAppAnalyticsHandler(env: (key: string) => string | undefined, clientFactory = createClient, request = fetch) {
  return async (req: Request) => {
    const json = (body: unknown, status = 200) =>
      new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

    if (req.method === 'OPTIONS') return json({});
    if (req.method !== 'POST') return json({ error: 'POST required' }, 405);

    try {
      const url = env('SUPABASE_URL');
      const serviceKey = env('SUPABASE_SERVICE_ROLE_KEY');
      if (!url || !serviceKey) return json({ error: 'Analytics is not configured.' }, 503);
      const admin = clientFactory(url, serviceKey);

      const body = await req.json().catch(() => ({}));
      const sessionId = typeof body?.session_id === 'string' ? body.session_id.slice(0, 64) : '';
      if (!/^[A-Za-z0-9_-]{8,64}$/.test(sessionId)) return json({ error: 'Invalid session id.' }, 400);

      const userAgent = req.headers.get('user-agent') || '';
      const device = classifyDevice(userAgent);

      // Only resolve geo on the first beat, then keep it.
      const { data: existing } = await admin
        .from('app_sessions')
        .select('country')
        .eq('session_id', sessionId)
        .maybeSingle();

      const geo = existing ? null : await lookupGeo(clientIp(req));

      const now = new Date().toISOString();
      const row: Record<string, unknown> = {
        session_id: sessionId,
        last_seen_at: now,
        device_type: device.device_type,
        os: device.os,
        browser: device.browser,
        is_listening: body?.is_listening === true,
        authenticated: body?.authenticated === true,
      };

      if (body?.action === 'play') row.plays = 1;
      if (body?.action === 'end') row.ended_at = now;
      if (geo) Object.assign(row, geo);
      if (typeof body?.user_id === 'string' && /^[0-9a-f-]{36}$/i.test(body.user_id)) row.user_id = body.user_id;
      if (typeof body?.referrer === 'string') row.referrer = body.referrer.slice(0, 300);
      if (typeof body?.landing_path === 'string') row.landing_path = body.landing_path.slice(0, 300);

      // plays is a counter, so merge rather than overwrite.
      const { error } = await admin.rpc('upsert_app_session', {
        p_session_id: sessionId,
        p_payload: row,
      });
      if (error) throw error;

      return json({ ok: true });
    } catch (error) {
      console.error('app-analytics failed:', error instanceof Error ? (error.stack || error.message) : error);
      // Analytics must never break playback.
      return json({ error: 'Analytics unavailable.' }, 503);
    }
  };
}

Deno.serve(createAppAnalyticsHandler((key) => Deno.env.get(key)));
