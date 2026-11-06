import React, { useState } from 'react';
import {
  Play,
  Pause,
  Heart,
  Download,
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
      downloadSong,
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
          'Guests can preview 5 songs. Create a free account to unlock all 295+ Gyidi Nwom songs!'
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
        className={`group flex items-center gap-3 sm:gap-4 rounded-xl px-2.5 sm:px-3.5 py-2 transition cursor-pointer ${
          isActive
            ? 'bg-amber-500/12 border border-amber-500/30'
            : lockedForGuest
            ? 'opacity-75 hover:opacity-95 hover:bg-white/[0.03] border border-transparent'
            : 'hover:bg-white/[0.05] border border-transparent'
        }`}
      >
        {/* Index / Play / Lock indicator */}
        <div className="w-6 flex-shrink-0 flex items-center justify-center text-xs font-medium text-zinc-500">
          {lockedForGuest ? (
            <Lock className="w-3.5 h-3.5 text-amber-400/80" />
          ) : isActive ? (
            isBuffering ? (
              <Loader2 className="w-4 h-4 text-amber-400 animate-spin" />
            ) : isPlaying ? (
              <span className="flex items-end gap-0.5 h-3.5">
                <span className="w-0.5 bg-amber-400 animate-[bounce_0.8s_infinite] h-3.5 rounded-full" />
                <span className="w-0.5 bg-amber-400 animate-[bounce_0.6s_infinite] h-2 rounded-full" />
                <span className="w-0.5 bg-amber-400 animate-[bounce_0.9s_infinite] h-3 rounded-full" />
              </span>
            ) : (
              <Play className="w-4 h-4 text-amber-400 fill-amber-400" />
            )
          ) : (
            <>
              <span className="group-hover:hidden">{index + 1}</span>
              <Play className="w-4 h-4 text-white fill-white hidden group-hover:block" />
            </>
          )}
        </div>

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
          <div className="flex items-center gap-1.5 flex-wrap">
            <p
              className={`truncate text-sm font-semibold ${
                isActive ? 'text-amber-300' : 'text-zinc-100'
              }`}
            >
              {song.title}
            </p>
            {hasLyrics && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  if (!isAuthenticated) {
                    requireAccount('Create a free account to view Twi & English song lyrics!');
                    return;
                  }
                  onOpenLyrics?.(song);
                }}
                className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 border border-amber-400/30 px-2 py-0.5 text-[10px] font-bold text-amber-300 hover:bg-amber-500/25 flex-shrink-0 cursor-pointer"
              >
                <FileText className="w-2.5 h-2.5" />
                Lyrics
              </button>
            )}
            {isAuthenticated && isOfflineSaved && (
              <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-500/15 border border-emerald-400/30 px-2 py-0.5 text-[10px] font-bold text-emerald-300 flex-shrink-0">
                Offline ✓
              </span>
            )}
            {lockedForGuest && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 border border-amber-400/30 px-2 py-0.5 text-[10px] font-bold text-amber-300 flex-shrink-0">
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
                className="text-amber-300/90 hover:text-amber-200 hover:underline font-medium cursor-pointer"
              >
                {song.artist}
              </button>
            ) : (
              song.artist
            )}
            <span className="hidden md:inline text-zinc-600">
              {' '}
              • {song.sermon_topic || song.choir_group}
              {song.bible_book ? ` • ${song.bible_book}` : ''}
            </span>
          </p>
        </div>

        {/* Sermon Resume Pill */}
        {isAuthenticated && savedResumeSec && savedResumeSec > 10 && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              playSong(song, contextQueue, { startAtSeconds: savedResumeSec });
            }}
            className="hidden sm:inline-flex items-center gap-1 rounded-full bg-cyan-500/20 border border-cyan-400/35 px-2.5 py-1 text-[10px] font-extrabold text-cyan-200 hover:bg-cyan-500/30 flex-shrink-0 cursor-pointer"
            title="Resume from where you paused"
          >
            <RotateCw className="w-3 h-3 text-cyan-300" />
            Resume {formatDuration(savedResumeSec)}
          </button>
        )}

        {/* Category pill */}
        {song.category !== 'Songs' && !savedResumeSec && (
          <span className="hidden sm:inline-flex rounded-full bg-white/5 border border-white/10 px-2.5 py-0.5 text-[10px] font-medium text-zinc-300">
            {song.category}
          </span>
        )}

        {/* Action buttons — Gated behind account creation for guests */}
        <div className="flex items-center gap-0.5 sm:gap-1" onClick={(e) => e.stopPropagation()}>
          {onEditSong && (
            <button
              type="button"
              onClick={() => onEditSong(song)}
              title="Edit song, cover art, or lyrics"
              className="rounded-full p-1.5 text-amber-300 hover:bg-amber-500/15 transition cursor-pointer"
            >
              <Edit3 className="w-4 h-4" />
            </button>
          )}

          {onOpenLyrics && (hasLyrics || onEditSong) && (
            <button
              type="button"
              onClick={() => {
                if (!isAuthenticated) {
                  requireAccount('Create a free account to open song lyrics!');
                  return;
                }
                onOpenLyrics(song);
              }}
              title="View song lyrics"
              className={`hidden sm:inline-flex rounded-full p-1.5 transition cursor-pointer ${
                hasLyrics
                  ? 'text-amber-300 hover:bg-amber-500/15'
                  : 'text-zinc-500 hover:text-zinc-200 hover:bg-white/10 opacity-0 group-hover:opacity-100'
              }`}
            >
              <FileText className="w-4 h-4" />
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              if (!isAuthenticated) {
                requireAccount('Create a free account to like and save your favorite songs!');
                return;
              }
              onToggleFavorite(song);
            }}
            title="Like track"
            className={`rounded-full p-1.5 transition cursor-pointer ${
              isAuthenticated && isFavorite
                ? 'text-pink-500 hover:bg-pink-500/10'
                : 'text-zinc-500 hover:text-zinc-200 hover:bg-white/10'
            }`}
          >
            <Heart
              className={`w-4 h-4 ${isAuthenticated && isFavorite ? 'fill-pink-500' : ''}`}
            />
          </button>

          <button
            type="button"
            onClick={() => {
              if (!isAuthenticated) {
                requireAccount('Create a free account to add songs to playlists!');
                return;
              }
              onOpenPlaylistModal(song);
            }}
            title="Add to playlist"
            className="hidden sm:inline-flex rounded-full p-1.5 text-zinc-500 hover:text-zinc-200 hover:bg-white/10 opacity-0 group-hover:opacity-100 focus:opacity-100 transition cursor-pointer"
          >
            <ListPlus className="w-4 h-4" />
          </button>

          {onToggleOfflineSave && (
            <button
              type="button"
              disabled={savingOffline}
              onClick={async () => {
                if (!isAuthenticated) {
                  requireAccount('Create a free account to save songs for offline playback!');
                  return;
                }
                setSavingOffline(true);
                try {
                  await onToggleOfflineSave(song);
                } finally {
                  setSavingOffline(false);
                }
              }}
              title={isOfflineSaved ? 'Saved for offline listening' : 'Save offline in app'}
              className={`hidden md:inline-flex rounded-full p-1.5 transition cursor-pointer ${
                isAuthenticated && isOfflineSaved
                  ? 'text-emerald-400 hover:bg-emerald-500/15'
                  : 'text-zinc-500 hover:text-zinc-200 hover:bg-white/10 opacity-0 group-hover:opacity-100'
              }`}
            >
              {savingOffline ? (
                <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
              ) : isAuthenticated && isOfflineSaved ? (
                <CheckCircle2 className="w-4 h-4" />
              ) : (
                <CloudDownload className="w-4 h-4" />
              )}
            </button>
          )}

          <button
            type="button"
            onClick={handleShareAction}
            title="Share WhatsApp Status Card"
            className="hidden md:inline-flex rounded-full p-1.5 text-zinc-500 hover:text-emerald-300 hover:bg-white/10 opacity-0 group-hover:opacity-100 focus:opacity-100 transition cursor-pointer"
          >
            <Share2 className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => downloadSong(song)}
            title="Download MP3"
            className="hidden sm:inline-flex rounded-full p-1.5 text-zinc-500 hover:text-zinc-200 hover:bg-white/10 opacity-0 group-hover:opacity-100 focus:opacity-100 transition cursor-pointer"
          >
            <Download className="w-4 h-4" />
          </button>
        </div>

        {/* Duration */}
        <span className="w-11 text-right text-xs tabular-nums text-zinc-400 flex-shrink-0">
          {formatDuration(song.duration_seconds)}
        </span>
      </div>
    );
  }
);
