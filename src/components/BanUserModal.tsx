import React, { useEffect, useState } from 'react';
import { AlertTriangle, Ban, Loader2, ShieldCheck, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { UserProfile } from '../types/music';

/**
 * Ban (soft-delete) or reinstate an artiste or listener profile.
 *
 * The profile row is kept and flagged, so the account holder is met with an
 * explanation on their next sign-in and the decision can be reversed. Admin
 * accounts cannot be banned from here.
 */

interface BanUserModalProps {
  isOpen: boolean;
  profile: UserProfile | null;
  onClose: () => void;
  onDone: () => void;
}

const BanUserModal: React.FC<BanUserModalProps> = ({ isOpen, profile, onClose, onDone }) => {
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setReason('');
      setError(null);
      setBusy(false);
    }
  }, [isOpen, profile?.id]);

  if (!isOpen || !profile) return null;

  const name = profile.stage_name || profile.display_name || profile.email || 'this account';
  const alreadyBanned = profile.is_banned === true;

  const submit = async (ban: boolean) => {
    setBusy(true);
    setError(null);
    try {
      const { error: rpcError } = await supabase.rpc('admin_set_user_ban', {
        p_profile_id: profile.id,
        p_banned: ban,
        p_reason: ban ? reason.trim() || null : null,
      });
      if (rpcError) throw rpcError;
      onDone();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not update this account.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-zinc-900 p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div
              className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                alreadyBanned
                  ? 'bg-forest-500/15 text-forest-300'
                  : 'bg-rose-500/15 text-rose-300'
              }`}
            >
              {alreadyBanned ? <ShieldCheck className="h-5 w-5" /> : <Ban className="h-5 w-5" />}
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-white">
                {alreadyBanned ? 'Reinstate Account' : 'Suspend Account'}
              </h3>
              <p className="text-[11px] text-zinc-400">{name}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-1.5 text-zinc-400 hover:bg-white/10 hover:text-white cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {alreadyBanned ? (
          <p className="mt-4 text-xs leading-relaxed text-zinc-300">
            This account is currently suspended. Reinstate it to let{' '}
            <strong className="text-white">{name}</strong> sign in and use the app again.
          </p>
        ) : (
          <>
            <p className="mt-4 text-xs leading-relaxed text-zinc-300">
              Suspending removes access for{' '}
              <strong className="text-white">{name}</strong>. They will see a suspension page
              explaining why the next time they sign in. Their profile, uploads and listening
              history are kept, and you can reinstate them at any time.
            </p>

            <label className="mt-4 block text-[11px] font-semibold text-zinc-300">
              Reason shown to the account holder
            </label>
            <textarea
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Repeated upload of copyrighted material."
              className="mt-1.5 w-full rounded-xl border border-white/10 bg-zinc-950 px-3 py-2 text-xs text-white focus:border-gold-500 focus:outline-none"
            />
            {!reason.trim() && (
              <p className="mt-1.5 flex items-center gap-1.5 text-[10px] text-amber-300">
                <AlertTriangle className="h-3 w-3" />
                Optional, but a reason helps them understand and appeal.
              </p>
            )}
          </>
        )}

        {error && (
          <p className="mt-3 rounded-xl border border-rose-500/30 bg-rose-500/10 p-2.5 text-[11px] text-rose-300">
            {error}
          </p>
        )}

        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded-xl bg-white/5 px-3.5 py-2 text-xs font-semibold text-zinc-300 hover:bg-white/10 disabled:opacity-50 cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void submit(!alreadyBanned)}
            className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold text-white disabled:opacity-50 cursor-pointer ${
              alreadyBanned
                ? 'bg-forest-500 hover:bg-forest-600'
                : 'bg-rose-500 hover:bg-rose-600'
            }`}
          >
            {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {alreadyBanned ? 'Reinstate Account' : 'Suspend Account'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default BanUserModal;
