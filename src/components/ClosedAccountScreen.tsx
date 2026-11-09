import React from 'react';
import { LogOut, Mail, Moon } from 'lucide-react';
import { PLATFORM_SUPPORT_EMAIL } from '../lib/constants';

/**
 * Shown instead of the app when a signed-in account has been closed by its
 * owner.
 *
 * Closing is reversible, but only by an administrator — so the page has to
 * tell the person how to get back in rather than leaving them stuck.
 */

interface ClosedAccountScreenProps {
  closedAt?: string | null;
  displayName?: string | null;
  onSignOut: () => void;
}

function formatDate(value?: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });
}

const ClosedAccountScreen: React.FC<ClosedAccountScreenProps> = ({
  closedAt,
  displayName,
  onSignOut,
}) => {
  const dateLabel = formatDate(closedAt);

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

        <div className="rounded-3xl border border-white/10 bg-zinc-900/70 p-7 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gold-500/15 text-gold-300">
            <Moon className="h-8 w-8" />
          </div>

          <h2 className="mt-5 text-xl font-extrabold text-white">Account Closed</h2>

          <p className="mt-2 text-sm leading-relaxed text-zinc-400">
            {displayName ? `${displayName}, your` : 'Your'} account is closed, so the app is not
            available right now.
          </p>

          {dateLabel && (
            <p className="mt-3 text-[11px] text-zinc-500">Closed on {dateLabel}</p>
          )}

          <p className="mt-5 rounded-2xl border border-white/10 bg-zinc-950/60 p-4 text-left text-[11px] leading-relaxed text-zinc-300">
            <strong className="text-white">Nothing has been deleted.</strong> Your songs, albums,
            audio and listening history are all still there. Closing is reversible — an
            administrator just needs to reopen the account for you.
          </p>

          <p className="mt-3 flex items-start gap-2 rounded-2xl border border-white/10 bg-zinc-950/60 p-4 text-left text-[11px] leading-relaxed text-zinc-400">
            <Mail className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-gold-400" />
            <span>
              To come back, email{' '}
              <a
                href={`mailto:${PLATFORM_SUPPORT_EMAIL}`}
                className="font-bold text-gold-300 underline hover:no-underline"
              >
                {PLATFORM_SUPPORT_EMAIL}
              </a>{' '}
              and ask for your account to be reopened.
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
      </div>
    </div>
  );
};

export default ClosedAccountScreen;
