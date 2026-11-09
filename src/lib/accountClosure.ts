import { supabase } from './supabase';

/**
 * Self-service account closure and deletion.
 *
 * Deletion runs in two stages: requesting it starts a 30-day recovery window,
 * and only after that can the account be purged. Purging happens through the
 * delete-account edge function, because removing an auth user needs the
 * service-role key that a browser must never hold.
 */

const FUNCTION_NAME = 'delete-account';
export const RECOVERY_DAYS = 30;

export interface AccountState {
  is_banned: boolean;
  ban_reason: string | null;
  is_closed: boolean;
  closed_at: string | null;
  closed_reason: string | null;
  delete_requested_at: string | null;
  /** When the permanent deletion becomes due. Null unless one is scheduled. */
  delete_due_at: string | null;
}

export interface ClosureResult {
  ok: boolean;
  error?: string;
  dueAt?: string | null;
}

async function call(action: 'schedule' | 'cancel' | 'finalise'): Promise<ClosureResult> {
  const { data, error } = await supabase.functions.invoke(FUNCTION_NAME, {
    body: { action },
  });
  if (error) {
    return { ok: false, error: error.message };
  }
  const body = (data ?? {}) as { error?: string; detail?: string; delete_requested_at?: string };
  if (body.error) {
    return { ok: false, error: body.detail ? `${body.error} ${body.detail}` : body.error };
  }
  return { ok: true, dueAt: body.delete_requested_at ?? null };
}

export async function loadAccountState(): Promise<AccountState | null> {
  const { data, error } = await supabase.rpc('my_account_state');
  if (error || !data) return null;
  return data as AccountState;
}

export const scheduleDeletion = () => call('schedule');
export const cancelDeletion = () => call('cancel');
export const finaliseDeletion = () => call('finalise');

/** Close the account now. Reversible by an administrator. */
export async function closeAccount(reason?: string): Promise<ClosureResult> {
  const { error } = await supabase.rpc('close_my_account', {
    p_reason: reason?.trim() || null,
  });
  return error ? { ok: false, error: error.message } : { ok: true };
}

/** Re-authenticate before an irreversible action. */
export async function reauthenticate(email: string, password: string): Promise<boolean> {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  return !error;
}

export function formatDueDate(iso: string | null): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });
}

/** True once the recovery window has passed and the account can be purged. */
export function isDeletionDue(state: AccountState | null): boolean {
  if (!state?.delete_due_at) return false;
  const due = new Date(state.delete_due_at).getTime();
  return Number.isFinite(due) && Date.now() >= due;
}
