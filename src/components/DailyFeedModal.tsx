import React, { useEffect, useMemo, useState } from 'react';
import {
  X,
  BookOpen,
  Megaphone,
  Share2,
  ExternalLink,
  Calendar,
  Sparkles,
  AlertTriangle,
  Crown,
} from 'lucide-react';
import { Announcement, DailyVerseFlyer, UserRole } from '../types/music';

interface DailyFeedModalProps {
  isOpen: boolean;
  onClose: () => void;
  verseFlyers: DailyVerseFlyer[];
  announcements: Announcement[];
  viewerRole?: UserRole | null;
  isPremium?: boolean;
  onUpgradeToPremium?: () => void;
  initialTab?: 'verse' | 'announcements';
}

export function getTodayUtcDateStr(): string {
  return new Date().toISOString().slice(0, 10);
}

export const DailyFeedModal: React.FC<DailyFeedModalProps> = ({
  isOpen,
  onClose,
  verseFlyers,
  announcements,
  viewerRole,
  isPremium = false,
  onUpgradeToPremium,
  initialTab,
}) => {
  const todayStr = getTodayUtcDateStr();

  // Filter flyers that are unlocked (scheduled_date <= today and publish_at <= now)
  const unlockedFlyers = useMemo(() => {
    const nowMs = Date.now();
    return verseFlyers
      .filter(
        (f) =>
          f.is_active &&
          f.scheduled_date <= todayStr &&
          new Date(f.publish_at).getTime() <= nowMs
      )
      .sort((a, b) => b.scheduled_date.localeCompare(a.scheduled_date));
  }, [verseFlyers, todayStr]);

  const todaysFlyer = useMemo(() => {
    return (
      unlockedFlyers.find((f) => f.scheduled_date === todayStr) || unlockedFlyers[0] || null
    );
  }, [unlockedFlyers, todayStr]);

  // Filter announcements matching viewer role & publish/expiry window
  const visibleAnnouncements = useMemo(() => {
    const nowMs = Date.now();
    return announcements
      .filter((a) => {
        if (!a.is_active) return false;
        if (new Date(a.publish_at).getTime() > nowMs) return false;
        if (a.expires_at && new Date(a.expires_at).getTime() <= nowMs) return false;
        if (viewerRole === 'admin') return true;
        if (a.audience === 'all') return true;
        if (a.audience === 'artistes' && viewerRole === 'artiste') return true;
        if (a.audience === 'listeners' && (!viewerRole || viewerRole === 'listener')) return true;
        return false;
      })
      .sort((a, b) => {
        const prioRank = { urgent: 0, important: 1, normal: 2 };
        if (prioRank[a.priority] !== prioRank[b.priority]) {
          return prioRank[a.priority] - prioRank[b.priority];
        }
        return new Date(b.publish_at).getTime() - new Date(a.publish_at).getTime();
      });
  }, [announcements, viewerRole]);

  const [activeTab, setActiveTab] = useState<'verse' | 'announcements'>('verse');
  const [selectedFlyerId, setSelectedFlyerId] = useState<string | null>(null);
  const [shareCopied, setShareCopied] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    if (initialTab) {
      setActiveTab(initialTab);
    } else if (todaysFlyer) {
      setActiveTab('verse');
    } else if (visibleAnnouncements.length > 0) {
      setActiveTab('announcements');
    }
    setSelectedFlyerId(todaysFlyer?.id || null);
  }, [isOpen, initialTab, todaysFlyer, visibleAnnouncements.length]);

  if (!isOpen) return null;

  const activeFlyer =
    unlockedFlyers.find((f) => f.id === selectedFlyerId) || todaysFlyer || null;

  const handleShareFlyer = async (flyer: DailyVerseFlyer) => {
    const shareText = `${flyer.scripture_ref ? `📖 ${flyer.scripture_ref} — ` : ''}Daily Bible Verse on Gyidi Nnwom${
      flyer.caption ? `\n"${flyer.caption}"` : ''
    }\n${window.location.origin}`;
    try {
      if (navigator.share) {
        await navigator.share({
          title: flyer.scripture_ref || 'Daily Bible Verse — Gyidi Nnwom',
          text: shareText,
          url: window.location.origin,
        });
      } else {
        await navigator.clipboard.writeText(shareText);
        setShareCopied(true);
        setTimeout(() => setShareCopied(false), 2500);
      }
    } catch {
      // User dismissed native share sheet
    }
  };

  return (
    <div className="safe-overlay fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-3 sm:p-5">
      <div className="relative w-full max-w-2xl rounded-3xl border border-gold-400/25 bg-forest-950 shadow-2xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Top Header */}
        <div className="flex items-center justify-between gap-3 border-b border-white/10 bg-gradient-to-r from-gold-500/15 via-gold-500/10 to-forest-950 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-gold-500/20 border border-gold-400/30 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-gold-300" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-extrabold text-white">
                Daily Word & Church Announcements
              </h2>
              <p className="text-xs text-zinc-400">
                Spiritual nourishment & official updates on Gyidi Nnwom
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-2 text-zinc-400 hover:bg-white/10 hover:text-white transition cursor-pointer"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mode Switch Tabs */}
        <div className="grid grid-cols-2 gap-2 p-3 bg-forest-900/70 border-b border-white/10">
          <button
            onClick={() => setActiveTab('verse')}
            className={`flex items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-extrabold transition cursor-pointer ${
              activeTab === 'verse'
                ? 'bg-gold-500 text-forest-950 shadow'
                : 'text-zinc-300 hover:bg-white/5'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            Daily Bible Verse
            {todaysFlyer?.scheduled_date === todayStr && (
              <span
                className={`rounded-full px-1.5 py-0.5 text-[10px] font-black ${
                  activeTab === 'verse'
                    ? 'bg-forest-950 text-gold-300'
                    : 'bg-gold-500/20 text-gold-300'
                }`}
              >
                Today
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('announcements')}
            className={`flex items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-extrabold transition cursor-pointer ${
              activeTab === 'announcements'
                ? 'bg-gold-500 text-forest-950 shadow'
                : 'text-zinc-300 hover:bg-white/5'
            }`}
          >
            <Megaphone className="w-4 h-4" />
            Announcements
            {visibleAnnouncements.length > 0 && (
              <span
                className={`rounded-full px-1.5 py-0.5 text-[10px] font-black ${
                  activeTab === 'announcements'
                    ? 'bg-forest-950 text-gold-300'
                    : 'bg-rose-500 text-white'
                }`}
              >
                {visibleAnnouncements.length}
              </span>
            )}
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {activeTab === 'verse' ? (
            !isPremium ? (
              <div className="py-10 px-4 text-center space-y-4 rounded-2xl border border-gold-400/35 bg-gradient-to-br from-gold-500/15 via-forest-900 to-pink-500/10">
                <div className="h-12 w-12 rounded-2xl bg-gold-500/20 border border-gold-400/40 flex items-center justify-center mx-auto">
                  <Crown className="w-6 h-6 text-gold-300" />
                </div>
                <div className="space-y-1.5 max-w-md mx-auto">
                  <h4 className="text-base font-extrabold text-white">
                    Daily Bible Verse Flyers are a Premium Feature
                  </h4>
                  <p className="text-xs text-zinc-300 leading-relaxed">
                    Upgrade to Gyidi Nnwom Premium to unlock daily scheduled Scripture flyers,
                    Offline Saved songs, Playlists, Liked Songs, Artiste Support, and Live Streams.
                  </p>
                </div>
                {onUpgradeToPremium && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onUpgradeToPremium();
                    }}
                    className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-gold-400 to-pink-500 px-5 py-2.5 text-xs font-extrabold text-forest-950 hover:opacity-95 cursor-pointer shadow-lg"
                  >
                    <Crown className="w-4 h-4" />
                    View Premium Plans &amp; Upgrade
                  </button>
                )}
              </div>
            ) : !activeFlyer ? (
              <div className="py-12 text-center space-y-2">
                <BookOpen className="w-10 h-10 text-gold-400/70 mx-auto" />
                <p className="text-sm font-bold text-white">No Daily Bible Verse posted yet</p>
                <p className="text-xs text-zinc-400">
                  Check back soon for today&apos;s scripture flyer!
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-gold-500/15 border border-gold-400/30 px-3 py-1 text-xs font-bold text-gold-300">
                      <Calendar className="w-3.5 h-3.5" />
                      {activeFlyer.scheduled_date === todayStr
                        ? "Today's Verse"
                        : new Date(activeFlyer.scheduled_date + 'T00:00:00Z').toLocaleDateString(
                            undefined,
                            { weekday: 'short', month: 'short', day: 'numeric' }
                          )}
                    </span>
                    {activeFlyer.scripture_ref && (
                      <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-extrabold text-white">
                        📖 {activeFlyer.scripture_ref}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleShareFlyer(activeFlyer)}
                      className="inline-flex items-center gap-1.5 rounded-full bg-gold-500/20 border border-gold-400/30 hover:bg-gold-500/30 px-3 py-1.5 text-xs font-bold text-gold-300 cursor-pointer transition"
                    >
                      <Share2 className="w-3.5 h-3.5" />
                      {shareCopied ? 'Copied!' : 'Share'}
                    </button>
                  </div>
                </div>

                {/* Main Flyer Image */}
                <div className="rounded-2xl border border-white/15 bg-black overflow-hidden flex items-center justify-center">
                  <img
                    src={activeFlyer.flyer_url}
                    alt={activeFlyer.scripture_ref || 'Daily Bible Verse Flyer'}
                    className="max-h-[54vh] w-auto object-contain mx-auto"
                  />
                </div>

                {activeFlyer.caption && (
                  <p className="rounded-2xl border border-white/10 bg-forest-900/70 p-4 text-xs sm:text-sm text-zinc-200 leading-relaxed">
                    {activeFlyer.caption}
                  </p>
                )}

                {/* Earlier Flyers Strip */}
                {unlockedFlyers.length > 1 && (
                  <div className="pt-2 space-y-2">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                      Recent Daily Flyers
                    </p>
                    <div className="flex items-center gap-2.5 overflow-x-auto pb-1">
                      {unlockedFlyers.slice(0, 7).map((f) => (
                        <button
                          key={f.id}
                          onClick={() => setSelectedFlyerId(f.id)}
                          className={`flex-shrink-0 rounded-xl border p-1.5 text-left transition cursor-pointer ${
                            f.id === activeFlyer.id
                              ? 'border-gold-400 bg-gold-500/15'
                              : 'border-white/10 bg-forest-900 hover:border-white/25'
                          }`}
                        >
                          <img
                            src={f.flyer_url}
                            alt={f.scripture_ref || f.scheduled_date}
                            className="h-14 w-14 rounded-lg object-cover"
                          />
                          <p className="text-[10px] font-bold text-zinc-300 mt-1 text-center">
                            {f.scheduled_date.slice(5)}
                          </p>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )
          ) : visibleAnnouncements.length === 0 ? (
            <div className="py-12 text-center space-y-2">
              <Megaphone className="w-10 h-10 text-gold-400/70 mx-auto" />
              <p className="text-sm font-bold text-white">No active announcements right now</p>
              <p className="text-xs text-zinc-400">
                Convention dates, church notices, and platform updates appear here.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {visibleAnnouncements.map((ann) => (
                <div
                  key={ann.id}
                  className={`rounded-2xl border p-4 space-y-3 ${
                    ann.priority === 'urgent'
                      ? 'border-rose-500/40 bg-rose-500/10'
                      : ann.priority === 'important'
                      ? 'border-gold-400/40 bg-gold-500/10'
                      : 'border-white/10 bg-forest-900/70'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        {ann.priority === 'urgent' && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-rose-500 px-2.5 py-0.5 text-[10px] font-extrabold uppercase text-white">
                            <AlertTriangle className="w-3 h-3" />
                            Urgent Notice
                          </span>
                        )}
                        {ann.priority === 'important' && (
                          <span className="rounded-full bg-gold-400 px-2.5 py-0.5 text-[10px] font-extrabold uppercase text-forest-950">
                            Important
                          </span>
                        )}
                        <span className="text-[11px] text-zinc-400">
                          {new Date(ann.publish_at).toLocaleDateString(undefined, {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </span>
                      </div>
                      <h3 className="text-base font-extrabold text-white">{ann.title}</h3>
                    </div>
                  </div>

                  {ann.flyer_url && (
                    <div className="rounded-xl overflow-hidden border border-white/10 bg-black">
                      <img
                        src={ann.flyer_url}
                        alt={ann.title}
                        className="max-h-72 w-auto mx-auto object-contain"
                      />
                    </div>
                  )}

                  <p className="text-xs sm:text-sm text-zinc-200 whitespace-pre-line leading-relaxed">
                    {ann.body}
                  </p>

                  {ann.cta_url && (
                    <div>
                      <a
                        href={ann.cta_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-full bg-gold-500 hover:bg-gold-400 px-4 py-2 text-xs font-extrabold text-forest-950 transition"
                      >
                        {ann.cta_label || 'Learn More'}
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer Dismiss Button */}
        <div className="border-t border-white/10 bg-forest-900/80 px-5 py-3.5 flex items-center justify-between gap-3">
          <p className="text-[11px] text-zinc-400">
            Re-open anytime from the <strong className="text-gold-300">Daily Word</strong> button
            at the top.
          </p>
          <button
            onClick={onClose}
            className="rounded-full bg-gradient-to-r from-gold-500 to-pink-600 px-5 py-2 text-xs font-extrabold text-white shadow-lg hover:opacity-95 cursor-pointer"
          >
            Amen • Continue Listening
          </button>
        </div>
      </div>
    </div>
  );
};
