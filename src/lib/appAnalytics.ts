import { supabase } from './supabase';

/**
 * Lightweight first-party analytics.
 *
 * Deliberately fire-and-forget: a failed beacon must never interrupt playback
 * or surface an error to the listener. Everything is sent to the app-analytics
 * edge function, which is the only thing allowed to write to app_sessions.
 */

const SESSION_KEY = 'gyidi_analytics_session';
const HEARTBEAT_MS = 60_000;
const FUNCTION_NAME = 'app-analytics';

function randomId(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

/** Stable for the lifetime of the tab, so a reload does not double-count. */
function sessionId(): string {
  try {
    const existing = sessionStorage.getItem(SESSION_KEY);
    if (existing && /^[a-f0-9]{32}$/.test(existing)) return existing;
    const fresh = randomId();
    sessionStorage.setItem(SESSION_KEY, fresh);
    return fresh;
  } catch {
    // Private mode can block storage; fall back to a per-load id.
    return randomId();
  }
}

function send(payload: Record<string, unknown>) {
  void supabase.functions
    .invoke(FUNCTION_NAME, { body: { session_id: sessionId(), ...payload } })
    .then(() => undefined)
    .catch(() => undefined); // Analytics is best-effort by design.
}

export interface TrackerOptions {
  getUserId: () => string | null;
  isListening: () => boolean;
}

export function startAnalytics({ getUserId, isListening }: TrackerOptions): () => void {
  if (typeof window === 'undefined') return () => undefined;

  let stopped = false;

  const beat = () => {
    if (stopped || document.visibilityState === 'hidden') return;
    send({
      action: 'beat',
      user_id: getUserId(),
      is_listening: isListening(),
      authenticated: Boolean(getUserId()),
    });
  };

  send({
    action: 'start',
    user_id: getUserId(),
    is_listening: isListening(),
    authenticated: Boolean(getUserId()),
    referrer: document.referrer || null,
    landing_path: window.location.pathname || null,
  });

  const timer = window.setInterval(beat, HEARTBEAT_MS);
  // Catch the case where the user is actively playing when they close the tab.
  const onHide = () => {
    if (stopped) return;
    send({ action: 'beat', user_id: getUserId(), is_listening: isListening(), authenticated: Boolean(getUserId()) });
  };
  document.addEventListener('visibilitychange', onHide);

  return () => {
    stopped = true;
    window.clearInterval(timer);
    document.removeEventListener('visibilitychange', onHide);
    send({ action: 'end', user_id: getUserId(), is_listening: false, authenticated: Boolean(getUserId()) });
  };
}

/** Called once per track start, so plays can be counted server side. */
export function recordPlay(getUserId: () => string | null) {
  send({ action: 'play', user_id: getUserId(), is_listening: true, authenticated: Boolean(getUserId()) });
}

export interface AnalyticsProbe {
  ok: boolean;
  detail: string;
}

/**
 * Checks that the analytics function is deployed and working.
 *
 * The beacon swallows every failure on purpose, so an undeployed function
 * looks exactly like an app nobody is using. The admin dashboard calls this
 * to tell those two cases apart instead of quietly reporting zeros.
 */
export async function probeAnalytics(): Promise<AnalyticsProbe> {
  try {
    const { data, error } = await supabase.functions.invoke(FUNCTION_NAME, {
      body: { session_id: sessionId(), action: 'ping' },
    });

    if (error) {
      const status = (error as { context?: { status?: number } }).context?.status;
      if (status === 404 || status === 502) {
        return {
          ok: false,
          detail:
            'The app-analytics function is not deployed. Run: npx supabase functions deploy app-analytics',
        };
      }
      return { ok: false, detail: `The app-analytics function failed: ${error.message}` };
    }

    if (data && typeof data === 'object' && 'error' in data) {
      return {
        ok: false,
        detail: `The app-analytics function is deployed but not working: ${String(
          (data as { error: unknown }).error
        )}`,
      };
    }

    return { ok: true, detail: 'The app-analytics function is deployed and receiving events.' };
  } catch (err) {
    return {
      ok: false,
      detail: `Could not reach the app-analytics function: ${
        err instanceof Error ? err.message : 'unknown error'
      }`,
    };
  }
}
