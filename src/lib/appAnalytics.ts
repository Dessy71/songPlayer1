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
