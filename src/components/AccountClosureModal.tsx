import React, { useEffect, useState } from 'react';
import { AlertTriangle, Loader2, Moon, Trash2, X } from 'lucide-react';
import {
  AccountState,
  RECOVERY_DAYS,
  cancelDeletion,
  closeAccount,
  formatDueDate,
  reauthenticate,
  scheduleDeletion,
} from '../lib/accountClosure';

/**
 * Close or delete your own account.
 *
 * The two are deliberately different actions with different consequences, so
 * they get different screens rather than one ambiguous button.
 *
 *   Close  — reversible. Login and studio access stop, profile comes down,
 *            music and history stay exactly as they are. An administrator can
 *            reopen it.
 *   Delete — permanent after a 30-day window. Personal data and the login go;
 *            published music is kept but no longer linked to you.
 */

interface AccountClosureModalProps {
  isOpen: boolean;
  email: string | null;
  state: AccountState | null;
  hasUploads: boolean;
  onClose: () => void;
  onClosed: () => void;
  onDeletionChanged: () => void;
}

type Mode = 'choose' | 'close' | 'delete';

const AccountClosureModal: React.FC<AccountClosureModalProps> = ({
  isOpen,
  email,
  state,
  hasUploads,
  onClose,
  onClosed,
  onDeletionChanged,
}) => {
  const [mode, setMode] = useState<Mode>('choose');
  const [reason, setReason] = useState('');
  const [password, setPassword] = useState('');
  const [confirmText, setConfirmText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setMode('choose');
      setReason('');
      setPassword('');
      setConfirmText('');
      setError(null);
      setBusy(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const scheduled = Boolean(state?.delete_requested_at);
  const dueLabel = formatDueDate(state?.delete_due_at ?? null);

  const handleClose = async () => {
    setBusy(true);
    setError(null);
    const result = await closeAccount(reason);
    setBusy(false);
    if (!result.ok) {
      setError(result.error || 'Could not close your account.');
      return;
    }
    onClosed();
  };

  const handleSchedule = async () => {
    setBusy(true);
    setError(null);

    if (!email) {
      setBusy(false);
      setError('Your account email could not be determined.');
      return;
    }
    // Re-authenticate first: deleting an account is not something that should
    // happen off an unattended session.
    const verified = await reauthenticate(email, password);
    if (!verified) {
      setBusy(false);
      setError('That password does not match. Enter your current password to continue.');
      return;
    }
    if (confirmText.trim().toUpperCase() !== 'DELETE') {
      setBusy(false);
      setError('Type DELETE to confirm.');
      return;
    }

    const result = await scheduleDeletion();
    setBusy(false);
    if (!result.ok) {
      setError(result.error || 'Could not schedule your deletion.');
      return;
    }
    onDeletionChanged();
    onClose();
  };

  const handleCancel = async () => {
    setBusy(true);
    setError(null);
    const result = await cancelDeletion();
    setBusy(false);
    if (!result.ok) {
      setError(result.error || 'Could not cancel the scheduled deletion.');
      return;
    }
    onDeletionChanged();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-white/10 bg-zinc-900 p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-sm font-extrabold text-white">
            {mode === 'delete'
              ? 'Delete your account'
              : mode === 'close'
                ? 'Close your account'
                : 'Close or delete your account'}
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-1.5 text-zinc-400 hover:bg-white/10 hover:text-white cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {scheduled && (
          <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3">
            <p className="text-xs font-bold text-amber-200">
              Permanent deletion is scheduled{dueLabel ? ` for ${dueLabel}` : ''}.
            </p>
            <p className="mt-1 text-[11px] text-amber-200/80">
              Until then your account works normally and you can cancel at any time.
            </p>
            <button
              type="button"
              disabled={busy}
              onClick={() => void handleCancel()}
              className="mt-2.5 rounded-lg bg-white/10 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-white/15 disabled:opacity-50 cursor-pointer"
            >
              Cancel deletion
            </button>
          </div>
        )}

        {mode === 'choose' && (
          <div className="mt-4 space-y-2.5">
            <button
              type="button"
              onClick={() => setMode('close')}
              className="w-full rounded-xl border border-white/10 bg-zinc-950/60 p-3.5 text-left hover:border-white/20 cursor-pointer"
            >
              <p className="flex items-center gap-2 text-xs font-bold text-white">
                <Moon className="h-4 w-4 text-gold-400" />
                Close account — reversible
              </p>
              <p className="mt-1 text-[11px] leading-relaxed text-zinc-400">
                Stops login and studio access and takes down your public profile. Your songs,
                albums, audio and listener history stay exactly as they are. An administrator
                can reopen it later.
              </p>
            </button>

            <button
              type="button"
              onClick={() => setMode('delete')}
              disabled={scheduled}
              className="w-full rounded-xl border border-rose-500/25 bg-rose-500/5 p-3.5 text-left hover:border-rose-500/40 disabled:opacity-50 cursor-pointer"
            >
              <p className="flex items-center gap-2 text-xs font-bold text-rose-200">
                <Trash2 className="h-4 w-4" />
                Delete account — permanent
              </p>
              <p className="mt-1 text-[11px] leading-relaxed text-zinc-400">
                Removes your personal data and login after a {RECOVERY_DAYS}-day recovery window.
                Your published music stays on Gyidi Nnwom but is no longer linked to you.
                {scheduled ? ' Already scheduled.' : ''}
              </p>
            </button>
          </div>
        )}

        {mode === 'close' && (
          <div className="mt-4 space-y-3">
            <p className="text-xs leading-relaxed text-zinc-300">
              Your account stops working immediately: you will be signed out and cannot sign
              back in, and your public artiste profile comes down. Nothing is deleted —{' '}
              {hasUploads
                ? 'your uploaded songs and albums stay on the platform, and '
                : ''}
              an administrator can reopen the account after verifying it is you.
            </p>
            <div>
              <label className="block text-[11px] font-semibold text-zinc-300">
                Why are you closing it? (optional)
              </label>
              <textarea
                rows={2}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Helps us improve Gyidi Nnwom."
                className="mt-1.5 w-full rounded-xl border border-white/10 bg-zinc-950 px-3 py-2 text-xs text-white focus:border-gold-500 focus:outline-none"
              />
            </div>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setMode('choose')}
                className="rounded-xl bg-white/5 px-3.5 py-2 text-xs font-semibold text-zinc-300 hover:bg-white/10 cursor-pointer"
              >
                Back
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void handleClose()}
                className="inline-flex items-center gap-1.5 rounded-xl bg-gold-500 px-3.5 py-2 text-xs font-bold text-zinc-950 hover:bg-gold-400 disabled:opacity-50 cursor-pointer"
              >
                {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Close my account
              </button>
            </div>
          </div>
        )}

        {mode === 'delete' && (
          <div className="mt-4 space-y-3">
            <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3">
              <p className="flex items-center gap-1.5 text-xs font-bold text-rose-200">
                <AlertTriangle className="h-4 w-4" />
                This cannot be undone after {RECOVERY_DAYS} days
              </p>
              <ul className="mt-2 space-y-1 text-[11px] leading-relaxed text-rose-100/90">
                <li>• Your profile, personal details and login are removed.</li>
                <li>
                  • {hasUploads
                    ? 'Your songs and albums stay published, but are no longer linked to you.'
                    : 'Listening history linked to you is removed.'}
                </li>
                <li>• You have {RECOVERY_DAYS} days to cancel before it is final.</li>
              </ul>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-zinc-300">
                Your password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                className="mt-1.5 w-full rounded-xl border border-white/10 bg-zinc-950 px-3 py-2 text-xs text-white focus:border-rose-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-zinc-300">
                Type <span className="font-mono text-rose-300">DELETE</span> to confirm
              </label>
              <input
                type="text"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-white/10 bg-zinc-950 px-3 py-2 text-xs text-white focus:border-rose-500 focus:outline-none"
              />
            </div>

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setMode('choose')}
                className="rounded-xl bg-white/5 px-3.5 py-2 text-xs font-semibold text-zinc-300 hover:bg-white/10 cursor-pointer"
              >
                Back
              </button>
              <button
                type="button"
                disabled={busy || !password || confirmText.trim().toUpperCase() !== 'DELETE'}
                onClick={() => void handleSchedule()}
                className="inline-flex items-center gap-1.5 rounded-xl bg-rose-500 px-3.5 py-2 text-xs font-bold text-white hover:bg-rose-600 disabled:opacity-50 cursor-pointer"
              >
                {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Schedule deletion
              </button>
            </div>
          </div>
        )}

        {error && (
          <p className="mt-3 rounded-xl border border-rose-500/30 bg-rose-500/10 p-2.5 text-[11px] text-rose-300">
            {error}
          </p>
        )}
      </div>
    </div>
  );
};

export default AccountClosureModal;
