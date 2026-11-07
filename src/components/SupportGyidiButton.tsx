import type { FC } from 'react';
import { ExternalLink, HeartHandshake } from 'lucide-react';

interface SupportGyidiButtonProps {
  /** Opens the support modal — the same surface the sidebar entry uses. */
  onOpenSupport: () => void;
}

/**
 * "Support Gyidi Nwom" entry point.
 *
 * Open to everyone — no Premium membership required. This mirrors the sidebar
 * entry: a single wallet button that opens the support modal, which shows the
 * platform Paystack page link. No amount is hard-coded and the subaccount code
 * is never requested or rendered.
 */
export const SupportGyidiButton: FC<SupportGyidiButtonProps> = ({ onOpenSupport }) => (
  <button
    type="button"
    onClick={onOpenSupport}
    className="w-full flex items-center gap-2.5 rounded-xl px-3 py-3 text-xs font-semibold text-pink-200 bg-pink-500/10 border border-pink-500/20 hover:bg-pink-500/20 transition cursor-pointer"
  >
    <HeartHandshake className="w-4 h-4 text-pink-400 flex-shrink-0" />
    <span className="flex-1 text-left">Support Gyidi Nwom</span>
    <ExternalLink className="w-3.5 h-3.5 text-pink-300 flex-shrink-0" />
  </button>
);
