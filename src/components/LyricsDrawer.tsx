import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  X,
  Mic2,
  Copy,
  Check,
  Share2,
  Pencil,
  Sparkles,
  Type,
} from 'lucide-react';
import { Song } from '../types/music';
import { usePlayer } from '../context/PlayerContext';
import { CoverArt } from './CoverArt';
import { formatDuration } from '../lib/format';

interface LyricsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  song: Song | null;
  canEditSong?: boolean;
  onEditLyrics?: (song: Song) => void;
  onOpenShareCard?: (song: Song, selectedQuote?: string) => void;
}

export const LyricsDrawer: React.FC<LyricsDrawerProps> = ({
  isOpen,
  onClose,
  song,
  canEditSong = false,
  onEditLyrics,
  onOpenShareCard,
}) => {
  const { currentSong, currentTime, seekTo, playSong, isAuthenticated, requireAccount } =
    usePlayer();
  const [copied, setCopied] = useState(false);
  const [largeText, setLargeText] = useState(false);
  const activeLineRef = useRef<HTMLButtonElement | null>(null);

  const targetSong = song || currentSong;
  const isPlayingThisSong = Boolean(targetSong && currentSong?.id === targetSong.id);

  const timedLines = useMemo(() => {
    if (!targetSong?.lyrics_timed || !Array.isArray(targetSong.lyrics_timed)) return [];
    return targetSong.lyrics_timed;
  }, [targetSong]);

  const activeLineIndex = useMemo(() => {
    if (!isPlayingThisSong || timedLines.length === 0) return -1;
    let idx = -1;
    for (let i = 0; i < timedLines.length; i++) {
      if (currentTime + 0.25 >= timedLines[i].time) {
        idx = i;
      } else {
        break;
      }
    }
    return idx;
  }, [isPlayingThisSong, timedLines, currentTime]);

  useEffect(() => {
    if (isOpen && activeLineIndex >= 0 && activeLineRef.current) {
      activeLineRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [isOpen, activeLineIndex]);

  if (!isOpen || !targetSong) return null;

  const hasLyrics = Boolean(
    (targetSong.lyrics_text && targetSong.lyrics_text.trim()) || timedLines.length > 0
  );

  const handleCopyLyrics = async () => {
    const body =
      targetSong.lyrics_text ||
      timedLines.map((l) => l.text).join('\n');
    if (!body) return;
    await navigator.clipboard.writeText(
      `${targetSong.title} — ${targetSong.artist}\n\n${body}\n\nStream on Gyidi Nnwom`
    );
    setCopied(true);
    setTimeout(() => setCopied(false), 2200);
  };

  return (
    <div className="safe-overlay fixed inset-0 z-50 flex justify-end bg-black/75 backdrop-blur-sm">
      <div className="w-full max-w-xl bg-gradient-to-b from-zinc-900 via-zinc-950 to-black border-l border-white/10 h-full flex flex-col pb-24 shadow-2xl">
        {/* Go Back & Close Bar */}
        <div className="flex items-center justify-between gap-2 px-5 py-2.5 border-b border-white/10 bg-zinc-950/90">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-1.5 rounded-full bg-white/10 border border-white/15 px-3 py-1.5 text-xs font-bold text-zinc-200 hover:bg-white/15 cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Go Back
          </button>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-1 rounded-full bg-white/10 border border-white/15 px-3 py-1.5 text-xs font-bold text-zinc-200 hover:bg-white/15 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
            Close
          </button>
        </div>

        {/* Top Bar */}
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-white/10 bg-black/30">
          <div className="flex items-center gap-3 min-w-0">
            <CoverArt
              title={targetSong.title}
              category={targetSong.category}
              theme={targetSong.cover_theme}
              coverUrl={targetSong.cover_url}
              size="sm"
              className="h-11 w-11 rounded-xl flex-shrink-0"
            />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-extrabold text-white truncate">
                  {targetSong.title}
                </h3>
                {targetSong.lyrics_language && (
                  <span className="rounded-full bg-gold-500/20 border border-gold-400/30 px-2 py-0.5 text-[10px] font-bold text-gold-300 flex-shrink-0">
                    {targetSong.lyrics_language}
                  </span>
                )}
              </div>
              <p className="text-xs text-zinc-400 truncate">
                {targetSong.artist}
                {timedLines.length > 0 ? ' • Live Synced Lyrics' : ' • Song Lyrics'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 flex-shrink-0">
            {hasLyrics && (
              <>
                <button
                  onClick={() => setLargeText((v) => !v)}
                  className={`rounded-lg p-2 text-xs font-bold transition cursor-pointer ${
                    largeText
                      ? 'bg-gold-500/20 text-gold-300'
                      : 'bg-white/5 text-zinc-400 hover:text-white'
                  }`}
                  title="Toggle font size"
                >
                  <Type className="w-4 h-4" />
                </button>
                <button
                  onClick={handleCopyLyrics}
                  className="rounded-lg bg-white/5 hover:bg-white/10 p-2 text-zinc-300 cursor-pointer"
                  title="Copy lyrics"
                >
                  {copied ? (
                    <Check className="w-4 h-4 text-forest-400" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </button>
                {onOpenShareCard && (
                  <button
                    onClick={() => {
                      const activeQuote =
                        activeLineIndex >= 0
                          ? timedLines[activeLineIndex]?.text
                          : targetSong.lyrics_text?.split('\n').find((l) => l.trim().length > 8);
                      onOpenShareCard(targetSong, activeQuote);
                    }}
                    className="rounded-lg bg-forest-500/20 border border-forest-400/30 hover:bg-forest-500/30 px-2.5 py-1.5 text-[11px] font-bold text-forest-300 inline-flex items-center gap-1 cursor-pointer"
                    title="Share Lyric Card to WhatsApp Status"
                  >
                    <Share2 className="w-3.5 h-3.5" />
                    Status Card
                  </button>
                )}
              </>
            )}

            {canEditSong && onEditLyrics && (
              <button
                onClick={() => {
                  onClose();
                  onEditLyrics(targetSong);
                }}
                className="rounded-lg bg-gold-500/20 border border-gold-400/30 px-2.5 py-1.5 text-[11px] font-bold text-gold-300 inline-flex items-center gap-1 cursor-pointer"
              >
                <Pencil className="w-3 h-3" />
                {hasLyrics ? 'Edit' : 'Add Lyrics'}
              </button>
            )}

            <button
              onClick={onClose}
              className="rounded-full p-1.5 text-zinc-400 hover:bg-white/10 hover:text-white transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-6">
          {!hasLyrics ? (
            <div className="py-20 text-center space-y-3">
              <Mic2 className="w-10 h-10 text-gold-400/60 mx-auto" />
              <p className="text-base font-extrabold text-white">
                Lyrics haven&apos;t been added to this track yet
              </p>
              <p className="text-xs text-zinc-400 max-w-sm mx-auto leading-relaxed">
                SCG & SACSU Artistes (and Admin) can upload lyrics as plain text or any lyrics file
                (<code>.lrc</code>, <code>.srt</code>, <code>.vtt</code>, <code>.txt</code>,{' '}
                <code>.docx</code>) from Artiste Studio!
              </p>
              {canEditSong && onEditLyrics && (
                <button
                  onClick={() => {
                    onClose();
                    onEditLyrics(targetSong);
                  }}
                  className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-gold-500 hover:bg-gold-400 px-5 py-2 text-xs font-extrabold text-zinc-950 cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  Upload Lyrics Now
                </button>
              )}
            </div>
          ) : timedLines.length > 0 ? (
            <div className="space-y-3">
              <p className="text-[11px] font-semibold text-gold-300/80 uppercase tracking-wider mb-2">
                Tap any line to jump directly to that moment
              </p>
              {timedLines.map((line, idx) => {
                const isActive = idx === activeLineIndex;
                return (
                  <button
                    key={`${line.time}-${idx}`}
                    ref={isActive ? activeLineRef : null}
                    onClick={() => {
                      if (!isAuthenticated) {
                        requireAccount('Create a free account to scrub to any lyric verse!');
                        return;
                      }
                      if (!isPlayingThisSong) {
                        playSong(targetSong);
                      }
                      setTimeout(() => seekTo(line.time), isPlayingThisSong ? 0 : 250);
                    }}
                    className={`w-full text-left rounded-2xl px-4 py-2.5 transition cursor-pointer flex items-baseline justify-between gap-3 ${
                      isActive
                        ? 'bg-gold-500/20 border border-gold-400/40 text-gold-200 scale-[1.01] shadow-lg'
                        : 'text-zinc-400 hover:bg-white/5 hover:text-zinc-100'
                    }`}
                  >
                    <span
                      className={`font-extrabold leading-relaxed ${
                        largeText ? 'text-xl sm:text-2xl' : 'text-base sm:text-lg'
                      }`}
                    >
                      {line.text}
                    </span>
                    <span className="text-[11px] font-mono text-zinc-500 flex-shrink-0">
                      {formatDuration(line.time)}
                    </span>
                  </button>
                );
              })}
            </div>
          ) : (
            <div
              className={`whitespace-pre-line font-semibold text-zinc-100 leading-loose tracking-wide ${
                largeText ? 'text-lg sm:text-xl' : 'text-sm sm:text-base'
              }`}
            >
              {targetSong.lyrics_text}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
