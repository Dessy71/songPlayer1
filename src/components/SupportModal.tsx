import React, { useState } from 'react';
import {
  X,
  HeartHandshake,
  Copy,
  Check,
  Link,
  Code2,
} from 'lucide-react';

interface SupportModalProps {
  isOpen: boolean;
  onClose: () => void;
  // Optional: pass admin mode and artiste profile to render admin-only Paystack page/subaccount
  isAdminViewer?: boolean;
  artiste?: {
    support_provider?: string;
    support_number?: string;
    support_account_name?: string;
    stage_name?: string;
  } | null;
}

export const SupportModal: React.FC<SupportModalProps> = ({ isOpen, onClose, isAdminViewer, artiste }) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  // Determine support details
  const isSupportPaystack = isAdminViewer && artiste && artiste.support_provider === 'Paystack Payment Page';
  const supportNumber = isSupportPaystack ? artiste.support_number : '0557394159';
  const supportAccountName = isSupportPaystack ? artiste.support_account_name : 'Desmond Kofi Antwi';
  const reference = isSupportPaystack ? 'gyidi-artiste' : 'gyidi';
  const stageTitle = artiste?.stage_name || 'Gyidi Nwom';

  const copySupport = () => {
    navigator.clipboard.writeText(supportNumber || '');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-md rounded-2xl border border-white/10 bg-zinc-900 p-6 shadow-2xl">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-full p-1.5 text-zinc-400 hover:bg-white/10 hover:text-white transition cursor-pointer"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-pink-500/15 border border-pink-500/30 text-pink-400">
            <HeartHandshake className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">Support {stageTitle}</h2>
            <p className="text-xs text-zinc-400">Help sustain &amp; expand our SCG music library</p>
          </div>
        </div>

        <p className="text-sm text-zinc-300 leading-relaxed">
          Your generous contribution keeps SCG hymns, choir recordings, premieres, and convention
          sermons streaming fast and free for believers everywhere.
        </p>

        <div className="mt-4 rounded-xl border border-amber-500/30 bg-zinc-950 p-4 space-y-2">
          <p className="text-xs uppercase tracking-wider text-amber-400 font-bold">
            {isSupportPaystack ? 'Paystack Payment Page' : 'MTN Mobile Money (MoMo)'}
          </p>
          
          <div className="flex items-center justify-between">
            {isSupportPaystack ? (
              <>
                <span className="text-sm font-bold text-white break-all">
                  {supportNumber}
                </span>
                <button
                  onClick={copySupport}
                  className="flex items-center gap-1.5 rounded-lg bg-amber-500/20 border border-amber-500/30 px-3 py-1.5 text-xs font-semibold text-amber-200 hover:bg-amber-500/30 transition cursor-pointer"
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Link className="w-3.5 h-3.5" />
                      Copy URL
                    </>
                  )}
                </button>
              </>
            ) : (
              <>
                <span className="text-2xl font-extrabold tracking-wide text-white tabular-nums">
                  {supportNumber}
                </span>
                <button
                  onClick={copySupport}
                  className="flex items-center gap-1.5 rounded-lg bg-amber-500/20 border border-amber-500/30 px-3 py-1.5 text-xs font-semibold text-amber-200 hover:bg-amber-500/30 transition cursor-pointer"
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      Copy Number
                    </>
                  )}
                </button>
              </>
            )}
          </div>
          
          <div className="pt-2 border-t border-white/10 flex flex-col gap-1 text-xs text-zinc-300">
            <div>
              <span className="text-zinc-500">Account Name: </span>
              <span className="font-bold text-white">{supportAccountName}</span>
            </div>
            <div>
              <span className="text-zinc-500">Reference: </span>
              <span className="font-semibold text-emerald-400">{reference}</span>
            </div>
          </div>
        </div>

        <div className="mt-5 flex justify-end">
          <button
            onClick={onClose}
            className="rounded-xl bg-zinc-800 px-5 py-2 text-xs font-semibold text-zinc-200 hover:bg-zinc-700 transition cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
