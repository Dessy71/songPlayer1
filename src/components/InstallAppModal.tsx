import React, { useEffect, useState } from 'react';
import { X, Smartphone, Download, Share, PlusSquare, CheckCircle2 } from 'lucide-react';

export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

interface InstallAppModalProps {
  isOpen: boolean;
  onClose: () => void;
  deferredPrompt: BeforeInstallPromptEvent | null;
  onInstalled: () => void;
}

export const InstallAppModal: React.FC<InstallAppModalProps> = ({
  isOpen,
  onClose,
  deferredPrompt,
  onInstalled,
}) => {
  const [installing, setInstalling] = useState(false);
  const [installedNow, setInstalledNow] = useState(false);
  const [isIos, setIsIos] = useState(false);

  useEffect(() => {
    const ua = window.navigator.userAgent.toLowerCase();
    setIsIos(/iphone|ipad|ipod/.test(ua));
  }, []);

  if (!isOpen) return null;

  const handleNativeInstall = async () => {
    if (!deferredPrompt) return;
    setInstalling(true);
    try {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === 'accepted') {
        setInstalledNow(true);
        onInstalled();
      }
    } finally {
      setInstalling(false);
    }
  };

  return (
    <div className="safe-overlay fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-md rounded-3xl border border-gold-400/30 bg-zinc-950 p-6 shadow-2xl space-y-5">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-full p-2 text-zinc-400 hover:bg-white/10 hover:text-white cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3.5">
          <img
            src="/logo-mark.png"
            alt="Gyidi Nnwom App"
            className="h-14 w-14 rounded-2xl border border-gold-400/40 object-cover shadow-lg"
          />
          <div>
            <span className="rounded-full bg-gold-500/20 px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-gold-300">
              Mobile &amp; Desktop App
            </span>
            <h3 className="text-lg font-extrabold text-white mt-1">Install Gyidi Nnwom App</h3>
            <p className="text-xs text-zinc-400">
              Fast home-screen launch &amp; offline saved songs!
            </p>
          </div>
        </div>

        {installedNow ? (
          <div className="rounded-2xl border border-forest-500/40 bg-forest-500/15 p-4 text-center space-y-2">
            <CheckCircle2 className="w-8 h-8 text-forest-400 mx-auto" />
            <p className="text-sm font-extrabold text-white">Gyidi Nnwom App Installed!</p>
            <p className="text-xs text-zinc-300">
              You can now open Gyidi Nnwom directly from your Home Screen anytime.
            </p>
          </div>
        ) : deferredPrompt ? (
          <div className="space-y-3">
            <p className="text-xs text-zinc-300 leading-relaxed">
              Install Gyidi Nnwom directly onto your phone or computer for 1-tap access, full-screen
              playback, lock-screen controls, and offline saved hymns &amp; sermons.
            </p>
            <button
              disabled={installing}
              onClick={handleNativeInstall}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-gold-500 to-pink-600 py-3 text-xs font-extrabold text-white shadow-lg cursor-pointer"
            >
              <Download className="w-4 h-4" />
              {installing ? 'Installing...' : 'Install Gyidi Nnwom Now'}
            </button>
          </div>
        ) : isIos ? (
          <div className="rounded-2xl border border-white/10 bg-zinc-900/70 p-4 space-y-3 text-xs text-zinc-200">
            <p className="font-bold text-gold-300">Install on iPhone / iPad in 2 quick steps:</p>
            <div className="flex items-center gap-2.5">
              <Share className="w-4 h-4 text-gold-400 flex-shrink-0" />
              <span>
                1. Tap the <strong>Share</strong> icon at the bottom of Safari.
              </span>
            </div>
            <div className="flex items-center gap-2.5">
              <PlusSquare className="w-4 h-4 text-gold-400 flex-shrink-0" />
              <span>
                2. Scroll down and tap <strong>Add to Home Screen</strong>.
              </span>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-white/10 bg-zinc-900/70 p-4 space-y-2.5 text-xs text-zinc-300">
            <div className="flex items-center gap-2 text-gold-300 font-bold">
              <Smartphone className="w-4 h-4" />
              Add to Your Home Screen / Desktop
            </div>
            <p className="leading-relaxed">
              Open your browser menu (<strong>⋮</strong> in Chrome/Edge or Share on mobile) and tap{' '}
              <strong>&ldquo;Install App&rdquo;</strong> or{' '}
              <strong>&ldquo;Add to Home screen&rdquo;</strong> for instant app access &amp; offline
              playback!
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
