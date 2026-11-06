import React from 'react';
import { X, Code2, ExternalLink, Globe, Sparkles } from 'lucide-react';

interface DeveloperModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DeveloperModal: React.FC<DeveloperModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

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

        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500/20 to-violet-600/20 border border-amber-500/30 text-amber-400">
            <Code2 className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">Meet the Developer</h2>
            <p className="text-xs text-zinc-400">Creator & Platform Administrator of Gyidi Nwom</p>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-zinc-950 p-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-extrabold text-white">Desmond Kofi Antwi</h3>
              <p className="text-xs text-amber-400 font-medium mt-0.5">
                Software Developer & Founder, Gyidi Nwom
              </p>
            </div>
            <Sparkles className="w-5 h-5 text-amber-400" />
          </div>

          <p className="mt-3 text-xs text-zinc-300 leading-relaxed">
            Passionate about building fast, modern digital experiences and preserving Savior Church
            of Ghana hymns, choir ministries, and teachings for believers around the globe.
          </p>

          <a
            href="https://desmondantwi.vercel.app/"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 w-full inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 via-pink-500 to-violet-600 py-2.5 px-4 text-xs font-bold text-white shadow-lg shadow-pink-500/20 hover:opacity-95 transition"
          >
            <Globe className="w-4 h-4" />
            Visit desmondantwi.vercel.app
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>
    </div>
  );
};
