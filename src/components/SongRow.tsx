import React, { useState } from 'react';
import {
  Play,
  Pause,
  Heart,
  ListPlus,
  Loader2,
  Share2,
  Lock,
  Edit3,
  FileText,
  CloudDownload,
  CheckCircle2,
  RotateCw,
} from 'lucide-react';
import { Song } from '../types/music';
import { CoverArt } from './CoverArt';
import { formatDuration } from '../lib/format';
import { usePlayer } from '../context/PlayerContext';

interface SongRowProps {
  song: Song;
  index: number;
  contextQueue: Song[];
  isFavorite: boolean;
  savedResumeSec?: number;
  isOfflineSaved?: boolean;
  onToggleFavorite: (song: Song) => void;
  onOpenPlaylistModal: (song: Song) => void;
  onOpenArtiste?: (artisteId: string) => void;
  onEditSong?: (song: Song) => void;
  onOpenLyrics?: (song: Song) => void;
  onOpenShareCard?: (song: Song) => void;
  onToggleOfflineSave?: (song: Song) => Promise<void> | void;
}

export const SongRow: React.FC<SongRowProps> = React.memo(
  ({
    song,
    index,
    contextQueue,
    isFavorite,
    savedResumeSec,
    isOfflineSaved = false,
    onToggleFavorite,
    onOpenPlaylistModal,
    onOpenArtiste,
    onEditSong,
    onOpenLyrics,
    onOpenShareCard,
    onToggleOfflineSave,
  }) => {
    const {
      currentSong,
      isPlaying,
      isBuffering,
      isAuthenticated,
      isSongLockedForGuest,
      requireAccount,
      playSong,
      togglePlay,
      warmTrack,
    } = usePlayer();

    const [savingOffline, setSavingOffline] = useState(false);

    const lockedForGuest = isSongLockedForGuest(song.id);
    const isActive = currentSong?.id === song.id;
    const hasLyrics = Boolean(
      (song.lyrics_text && song.lyrics_text.trim().length > 0) ||
        (song.lyrics_timed && song.lyrics_timed.length > 0)
    );

    const handleRowClick = () => {
      if (lockedForGuest) {
        requireAccount(
          'Guests can preview 5 songs. Create a free account to unlock all 295+ Gyidi Nnwom songs!'
        );
        return;
      }
      if (isActive) {
        togglePlay();
      } else {
        playSong(song, contextQueue);
      }
    };

    const handleShareAction = (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!isAuthenticated) {
        requireAccount('Create a free account to share WhatsApp Status cards & song links!');
        return;
      }
      if (onOpenShareCard) {
        onOpenShareCard(song);
        return;
      }
      const url = `${window.location.origin}${window.location.pathname}?track=${encodeURIComponent(
        song.slug
      )}`;
      navigator.clipboard?.writeText(url).catch(() => {});
    };

    return (
      <div
        onMouseEnter={() => {
          if (!lockedForGuest) warmTrack(song);
        }}
        onClick={handleRowClick}
        className={`group flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3.5 rounded-xl px-2.5 sm:px-3.5 py-2.5 transition cursor-pointer min-w-0 max-w-full overflow-hidden ${
          isActive
            ? 'bg-gold-500/12 border border-gold-500/30'
            : lockedForGuest
            ? 'opacity-80 hover:opacity-95 hover:bg-white/[0.03] border border-transparent'
            : 'hover:bg-white/[0.05] border border-transparent'
        }`}
      >
        {/* Primary Track Info Line */}
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
          {/* Index / Play / Lock indicator (GPU-only equalizer so mobile never reflows) */}
          <button type="button" onClick={(event) => { event.stopPropagation(); handleRowClick(); }}
            aria-label={`${isActive && isPlaying ? 'Pause' : 'Play'} ${song.title}`}
            className="h-11 w-8 flex-shrink-0 flex items-center justify-center rounded-lg text-xs font-medium text-gold-300 hover:bg-white/10 overflow-hidden">
            {lockedForGuest ? (
              <Lock className="w-3.5 h-3.5 text-gold-400/80" />
            ) : isActive ? (
              isBuffering ? (
                <Loader2 className="w-4 h-4 text-gold-400 animate-spin" />
              ) : isPlaying ? (
                <span className="flex items-end gap-0.5 h-3.5 w-3.5 justify-center overflow-hidden">
                  <span className="w-0.5 h-3.5 bg-gold-400 rounded-full eq-bar-1" />
                  <span className="w-0.5 h-3.5 bg-gold-400 rounded-full eq-bar-2" />
                  <span className="w-0.5 h-3.5 bg-gold-400 rounded-full eq-bar-3" />
                </span>
              ) : (
                <Play className="w-4 h-4 text-gold-400 fill-gold-400" />
              )
            ) : (
              <Play className="w-4 h-4 fill-current" />
            )}
          </button>

          {/* Cover */}
          <div className="relative flex-shrink-0">
            <CoverArt
              title={song.title}
              category={song.category}
              theme={song.cover_theme}
              coverUrl={song.cover_url}
              size="sm"
              className="h-10 w-10 rounded-lg"
            />
            {isActive && isPlaying && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  togglePlay();
                }}
                className="absolute inset-0 flex items-center justify-center rounded-lg bg-black/45 text-white"
              >
                <Pause className="w-4 h-4 fill-white" />
              </button>
            )}
          </div>

          {/* Title & Artist */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 min-w-0">
              <p
                className={`truncate text-sm font-semibold ${
                  isActive ? 'text-gold-300' : 'text-zinc-100'
                }`}
              >
                {song.title}
              </p>
              {isAuthenticated && isOfflineSaved && (
                <span className="inline-flex items-center rounded-full bg-forest-500/15 border border-forest-400/30 px-1.5 py-0.5 text-[9px] font-bold text-forest-300 flex-shrink-0">
                  Offline ✓
                </span>
              )}
              {lockedForGuest && (
                <span className="inline-flex items-center gap-0.5 rounded-full bg-gold-500/15 border border-gold-400/30 px-1.5 py-0.5 text-[9px] font-bold text-gold-300 flex-shrink-0">
                  <Lock className="w-2.5 h-2.5" />
                  Locked
                </span>
              )}
            </div>
            <p className="truncate text-xs text-zinc-400">
              {song.artiste_id && onOpenArtiste ? (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenArtiste(song.artiste_id!);
                  }}
                  className="text-gold-300/90 hover:text-gold-200 hover:underline font-medium cursor-pointer"
                >
                  {song.artist}
                </button>
              ) : (
                song.artist
              )}
              <span className="text-zinc-600">
                {' '}
                • {song.sermon_topic || song.choir_group}
              </span>
            </p>
          </div>

          {/* Mobile Duration */}
          <span className="sm:hidden text-right text-[11px] tabular-nums text-zinc-400 flex-shrink-0">
            {formatDuration(song.duration_seconds)}
          </span>
        </div>

        {/* Action Controls Row — ALWAYS VISIBLE on Mobile & Desktop (No Device Download) */}
        <div
          className="flex items-center justify-between sm:justify-end gap-1 pl-7 sm:pl-0 flex-shrink-0"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center gap-1">
            {isAuthenticated && savedResumeSec && savedResumeSec > 10 && (
              <button
                type="button"
                onClick={() => playSong(song, contextQueue, { startAtSeconds: savedResumeSec })}
                className="inline-flex items-center gap-1 rounded-full bg-cyan-500/20 border border-cyan-400/35 px-2 py-0.5 text-[10px] font-extrabold text-cyan-200 hover:bg-cyan-500/30 cursor-pointer"
                title="Resume from where you paused"
              >
                <RotateCw className="w-2.5 h-2.5 text-cyan-300" />
                {formatDuration(savedResumeSec)}
              </button>
            )}

            {onEditSong && (
              <button
                type="button"
                onClick={() => onEditSong(song)}
                title="Edit song, cover art, or lyrics"
                className="rounded-full p-1.5 text-gold-300 hover:bg-gold-500/15 transition cursor-pointer"
              >
                <Edit3 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </button>
            )}

            {/* Like Song (Premium) */}
            <button
              type="button"
              onClick={() => {
                if (!isAuthenticated) {
                  requireAccount('Create a free account to like songs!');
                  return;
                }
                onToggleFavorite(song);
              }}
              title="Like song (Premium)"
              className={`rounded-full p-1.5 transition cursor-pointer ${
                isAuthenticated && isFavorite
                  ? 'text-pink-500 bg-pink-500/10'
                  : 'text-zinc-400 hover:text-zinc-100 hover:bg-white/10'
              }`}
            >
              <Heart
                className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${
                  isAuthenticated && isFavorite ? 'fill-pink-500' : ''
                }`}
              />
            </button>

            {/* Add to Playlist (Premium) */}
            <button
              type="button"
              onClick={() => {
                if (!isAuthenticated) {
                  requireAccount('Create a free account to add songs to playlists!');
                  return;
                }
                onOpenPlaylistModal(song);
              }}
              title="Add to playlist (Premium)"
              className="rounded-full p-1.5 text-zinc-400 hover:text-gold-300 hover:bg-white/10 transition cursor-pointer"
            >
              <ListPlus className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </button>

            {/* Offline Save to Profile (Premium — No Device File Download) */}
            {onToggleOfflineSave && (
              <button
                type="button"
                disabled={savingOffline}
                onClick={async () => {
                  if (!isAuthenticated) {
                    requireAccount('Create a free account to save songs for offline listening!');
                    return;
                  }
                  setSavingOffline(true);
                  try {
                    await onToggleOfflineSave(song);
                  } finally {
                    setSavingOffline(false);
                  }
                }}
                title={
                  isOfflineSaved
                    ? 'Saved to profile for offline listening'
                    : 'Save to profile for offline listening (Premium)'
                }
                className={`rounded-full p-1.5 transition cursor-pointer ${
                  isAuthenticated && isOfflineSaved
                    ? 'text-forest-400 bg-forest-500/15'
                    : 'text-zinc-400 hover:text-forest-300 hover:bg-white/10'
                }`}
              >
                {savingOffline ? (
                  <Loader2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 animate-spin text-gold-400" />
                ) : isAuthenticated && isOfflineSaved ? (
                  <CheckCircle2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                ) : (
                  <CloudDownload className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                )}
              </button>
            )}

            {/* Lyrics */}
            {onOpenLyrics && (
              <button
                type="button"
                onClick={() => {
                  if (!isAuthenticated) {
                    requireAccount('Create a free account to view Twi & English song lyrics!');
                    return;
                  }
                  onOpenLyrics(song);
                }}
                title="View song lyrics"
                className={`rounded-full p-1.5 transition cursor-pointer ${
                  hasLyrics
                    ? 'text-gold-300 bg-gold-500/15'
                    : 'text-zinc-400 hover:text-zinc-100 hover:bg-white/10'
                }`}
              >
                <FileText className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </button>
            )}

            {/* Share WhatsApp Status Card */}
            <button
              type="button"
              onClick={handleShareAction}
              title="Share WhatsApp Status Card"
              className="rounded-full p-1.5 text-zinc-400 hover:text-forest-300 hover:bg-white/10 transition cursor-pointer"
            >
              <Share2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </button>
          </div>

          {/* Desktop Duration */}
          <span className="hidden sm:inline-block w-11 text-right text-xs tabular-nums text-zinc-400 flex-shrink-0">
            {formatDuration(song.duration_seconds)}
          </span>
        </div>
      </div>
    );
  }
);
