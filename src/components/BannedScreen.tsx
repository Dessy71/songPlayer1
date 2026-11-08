import React from 'react';
import { Ban, LogOut, Mail } from 'lucide-react';

/**
 * Shown instead of the app when a signed-in account has been banned.
 *
 * The account is soft-deleted rather than removed: the profile row survives so
 * we can still explain what happened, and an administrator can reverse it.
 */

interface BannedScreenProps {
  reason?: string | null;
  bannedAt?: string | null;
  displayName?: string | null;
  onSignOut: () => void;
}

function formatDate(value?: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

const BannedScreen: React.FC<BannedScreenProps> = ({
  reason,
  bannedAt,
  displayName,
  onSignOut,
}) => {
  const dateLabel = formatDate(bannedAt);

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950 px-5 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center justify-center gap-3">
          <img
            src="/logo-mark.png"
            alt="Gyidi Nnwom Logo"
            className="h-11 w-11 rounded-xl border border-gold-500/30 object-cover shadow-lg shadow-gold-500/15"
          />
          <div>
            <h1 className="text-base font-extrabold leading-none tracking-tight text-white">
              Gyidi Nnwom
            </h1>
            <p className="mt-1 text-[11px] font-medium text-gold-400/90">
              SCG &amp; SACSU Streaming
            </p>
          </div>
        </div>

        <div className="rounded-3xl border border-rose-500/25 bg-zinc-900/70 p-7 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-500/15 text-rose-300">
            <Ban className="h-8 w-8" />
          </div>

          <h2 className="mt-5 text-xl font-extrabold text-white">Account Suspended</h2>

          <p className="mt-2 text-sm leading-relaxed text-zinc-400">
            {displayName ? `${displayName}, your` : 'Your'} Gyidi Nnwom account has been
            suspended by an administrator and can no longer be used.
          </p>

          {reason && (
            <div className="mt-5 rounded-2xl border border-white/10 bg-zinc-950/70 p-4 text-left">
              <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                Reason given
              </p>
              <p className="mt-1.5 text-sm leading-relaxed text-white">{reason}</p>
            </div>
          )}

          {dateLabel && (
            <p className="mt-4 text-[11px] text-zinc-500">Suspended on {dateLabel}</p>
          )}

          <p className="mt-6 flex items-start gap-2 rounded-2xl border border-white/10 bg-zinc-950/60 p-4 text-left text-[11px] leading-relaxed text-zinc-400">
            <Mail className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-gold-400" />
            <span>
              If you believe this is a mistake, contact the SCG &amp; SACSU streaming team and
              they can review the decision.
            </span>
          </p>

          <button
            type="button"
            onClick={onSignOut}
            className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-white/10 px-4 py-2.5 text-xs font-bold text-white transition hover:bg-white/15 cursor-pointer"
          >
            <LogOut className="h-4 w-4" />
            Sign Out
          </button>
        </div>

        <p className="mt-5 text-center text-[10px] text-zinc-600">
          Your profile and listening data are retained. Suspensions can be lifted by an
          administrator.
        </p>
      </div>
    </div>
  );
};

export default BannedScreen;
