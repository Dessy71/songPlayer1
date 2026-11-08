import React, { useEffect, useRef } from 'react';
import { DollarSign, Settings } from 'lucide-react';
import { PlatformSettings } from '../types/music';

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

export function extractAdSenseClientId(raw?: string | null): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  // Handle full <script ...?client=ca-pub-XXXX...> snippet pasted directly from Google AdSense
  const match = trimmed.match(/ca-pub-\d{10,24}/i);
  if (match) return match[0].toLowerCase();

  // Handle bare pub-XXXX
  const bareMatch = trimmed.match(/^pub-(\d{10,24})$/i);
  if (bareMatch) return `ca-pub-${bareMatch[1]}`;

  if (trimmed.startsWith('ca-pub-')) return trimmed;
  return trimmed;
}

/**
 * Loads the AdSense script, but only for viewers who are not Premium.
 *
 * Gating the script matters as much as gating the banner: Auto Ads inject
 * units on their own once this is on the page, so a Premium account would
 * still see ads if only the banners were hidden.
 */
export function useGoogleAdSenseScript(settings: PlatformSettings | null, enabled: boolean) {
  useEffect(() => {
    if (!enabled || !settings?.adsense_enabled) {
      // Someone who just upgraded should stop being served ads in this tab
      // without needing a reload.
      document
        .querySelectorAll('script[data-gyidi-adsense]')
        .forEach((el) => el.parentElement?.removeChild(el));
      return;
    }
    const clientId = extractAdSenseClientId(settings.adsense_publisher_id);
    if (!clientId || !clientId.startsWith('ca-pub-')) return;

    const existing = document.querySelector(
      `script[data-gyidi-adsense="${clientId}"]`
    ) as HTMLScriptElement | null;
    if (existing) return;

    // Remove any stale script with an older publisher ID
    document
      .querySelectorAll('script[data-gyidi-adsense]')
      .forEach((el) => el.parentElement?.removeChild(el));

    const script = document.createElement('script');
    script.async = true;
    script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(
      clientId
    )}`;
    script.crossOrigin = 'anonymous';
    script.setAttribute('data-gyidi-adsense', clientId);
    document.head.appendChild(script);
  }, [enabled, settings?.adsense_enabled, settings?.adsense_publisher_id]);
}

interface GoogleAdBannerProps {
  settings: PlatformSettings | null;
  slotType: 'home' | 'sidebar';
  /**
   * False for Premium (and admin) accounts. The admin configuration card is
   * still shown to admins — that is setup tooling, not advertising.
   */
  adsEnabled: boolean;
  isAdmin?: boolean;
  onConfigureClick?: () => void;
}

export const GoogleAdBanner: React.FC<GoogleAdBannerProps> = ({
  settings,
  slotType,
  adsEnabled,
  isAdmin = false,
  onConfigureClick,
}) => {
  const pushedRef = useRef(false);
  const clientId = extractAdSenseClientId(settings?.adsense_publisher_id);
  const slotId =
    slotType === 'home'
      ? settings?.adsense_home_slot_id?.trim()
      : settings?.adsense_sidebar_slot_id?.trim();

  const canRenderLiveUnit = Boolean(
    adsEnabled &&
      settings?.adsense_enabled &&
      clientId &&
      clientId.startsWith('ca-pub-') &&
      slotId
  );

  useEffect(() => {
    if (!canRenderLiveUnit || pushedRef.current) return;
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
      pushedRef.current = true;
    } catch {
      // AdSense script still loading or adblocker active
    }
  }, [canRenderLiveUnit, clientId, slotId]);

  if (canRenderLiveUnit) {
    return (
      <div
        className={`rounded-2xl border border-white/10 bg-zinc-900/40 overflow-hidden ${
          slotType === 'home' ? 'p-3 my-2' : 'p-2.5'
        }`}
      >
        <div className="flex items-center justify-between mb-1.5 px-1">
          <span className="text-[9px] uppercase tracking-widest text-zinc-500 font-semibold">
            Sponsored
          </span>
          {isAdmin && onConfigureClick && (
            <button
              onClick={onConfigureClick}
              className="text-[10px] font-semibold text-gold-400 hover:underline cursor-pointer"
            >
              Ad Settings
            </button>
          )}
        </div>
        <ins
          className="adsbygoogle"
          style={{ display: 'block', minHeight: slotType === 'home' ? '90px' : '160px' }}
          data-ad-client={clientId!}
          data-ad-slot={slotId!}
          data-ad-format="auto"
          data-full-width-responsive="true"
        />
      </div>
    );
  }

  // Only show configuration status card to Master Admin so regular listeners see zero clutter when unconfigured
  if (isAdmin && slotType === 'home') {
    const autoAdsActive = Boolean(
      settings?.adsense_enabled && clientId && clientId.startsWith('ca-pub-')
    );
    return (
      <div className="rounded-2xl border border-dashed border-forest-500/30 bg-forest-500/5 px-4 py-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <DollarSign className="w-4 h-4 text-forest-400 flex-shrink-0" />
          <p className="text-xs text-zinc-300">
            {autoAdsActive ? (
              <>
                <strong className="text-forest-300">Google AdSense Active ({clientId})</strong> —
                Auto Ads script is live. Optional: add a Home Banner Slot ID for a fixed placement
                here.
                {!adsEnabled && (
                  <>
                    {' '}
                    <span className="text-zinc-400">
                      Ad units are hidden from your account because Premium and admin accounts
                      are exempt — sign in as a listener to check them.
                    </span>
                  </>
                )}
              </>
            ) : (
              <>
                <strong className="text-gold-300">Admin Preview — Google Ads Ready:</strong> Enter
                your Google AdSense Publisher Key (<code className="text-forest-300">ca-pub-...</code>)
                in Admin Dashboard to start earning ad revenue.
              </>
            )}
          </p>
        </div>
        {onConfigureClick && (
          <button
            onClick={onConfigureClick}
            className="inline-flex items-center gap-1.5 rounded-full bg-forest-500/20 border border-forest-500/35 px-3.5 py-1.5 text-xs font-bold text-forest-300 hover:bg-forest-500/30 cursor-pointer"
          >
            <Settings className="w-3.5 h-3.5" />
            Configure Google Ads
          </button>
        )}
      </div>
    );
  }

  return null;
};
