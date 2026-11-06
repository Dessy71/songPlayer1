import React from 'react';
import { SupportCheckout } from './SupportCheckout';
import { X, HeartHandshake, Copy, Check } from 'lucide-react';

interface SupportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SupportModal: React.FC<SupportModalProps> = ({ isOpen, onClose }) => {

  if (!isOpen) return null;


  return (
    <div className="safe-overlay fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
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
            <h2 className="text-lg font-bold text-white">Support Gyidi Nwom</h2>
            <p className="text-xs text-zinc-400">Help sustain & expand our SCG music library</p>
          </div>
        </div>

        <p className="text-sm text-zinc-300 leading-relaxed">
          Your generous contribution keeps SCG hymns, choir recordings, premieres, and convention
          sermons streaming fast and free for believers everywhere.
        </p>

        <SupportCheckout target="gyidi" name="Gyidi Nwom" />

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
