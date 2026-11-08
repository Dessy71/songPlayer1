import React, { useState } from 'react';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Shuffle,
  Repeat,
  Repeat1,
  Volume2,
  VolumeX,
  Heart,
  ListMusic,
  ListPlus,
  Loader2,
  RotateCcw,
  RotateCw,
  Maximize2,
  ArrowLeft,
  X,
  Zap,
  Lock,
  FileText,
  Share2,
  CloudDownload,
  CheckCircle2,
} from 'lucide-react';
import { Song } from '../types/music';
import { usePlayer } from '../context/PlayerContext';
import { CoverArt } from './CoverArt';
import { formatDuration } from '../lib/format';

interface PlayerBarProps {
  isFavorite: boolean;
  isOfflineSaved: boolean;
  onToggleFavorite: () => void;
  onToggleOfflineSave: (song: Song) => Promise<void> | void;
  onOpenPlaylistModal: (song: Song) => void;
  onToggleQueue: () => void;
  onOpenLyrics?: (song: Song) => void;
  onOpenShareCard?: (song: Song) => void;
}

export const PlayerBar: React.FC<PlayerBarProps> = ({
  isFavorite,
  isOfflineSaved,
  onToggleFavorite,
  onToggleOfflineSave,
  onOpenPlaylistModal,
  onToggleQueue,
  onOpenLyrics,
  onOpenShareCard,
}) => {
  const {
    currentSong,
    queue,
    isPlaying,
    isBuffering,
    isPrelistenMode,
    isAuthenticated,
    currentTime,
    duration,
    bufferedPercent,
    volume,
    isMuted,
    systemVolumeControlled,
    shuffle,
    repeat,
    playbackRate,
    startupLatencyMs,
    requireAccount,
    togglePlay,
    playNext,
    playPrev,
    seekTo,
    skipBy,
    setVolume,
    toggleMute,
    toggleShuffle,
    cycleRepeat,
    setPlaybackRate,
  } = usePlayer();

  const [expanded, setExpanded] = useState(false);
  const [savingOffline, setSavingOffline] = useState(false);
  const [volumeHelp, setVolumeHelp] = useState(false);

  if (!currentSong) {
    return null;
  }

  const progressPercent = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;
  const hasLyrics = Boolean(
    (currentSong.lyrics_text && currentSong.lyrics_text.trim().length > 0) ||
      (currentSong.lyrics_timed && currentSong.lyrics_timed.length > 0)
  );

  const handleSeekBarClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isAuthenticated) {
      requireAccount('Create a free account to forward or seek through songs!');
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    seekTo(ratio * (duration || currentSong.duration_seconds || 0));
  };

  const nextSpeed = () => {
    if (!isAuthenticated) {
      requireAccount('Create a free account to change playback speed!');
      return;
    }
    const speeds = [1, 1.25, 1.5, 0.9];
    const idx = speeds.indexOf(playbackRate);
    setPlaybackRate(speeds[(idx + 1) % speeds.length]);
  };

  const handleOfflineClick = async () => {
    if (!isAuthenticated) {
      requireAccount('Create an account and upgrade to Premium to save songs offline!');
      return;
    }
    setSavingOffline(true);
    try {
      await onToggleOfflineSave(currentSong);
    } finally {
      setSavingOffline(false);
    }
  };

  return (
    <>
      {/* Fullscreen Now Playing Modal */}
      {expanded && (
        <div className="safe-overlay fixed inset-0 z-50 flex flex-col justify-between bg-gradient-to-b from-zinc-900 via-zinc-950 to-black p-4 sm:p-8 stable-scroll">
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setExpanded(false)}
              className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3.5 py-1.5 text-xs font-bold text-zinc-100 hover:bg-white/20 transition cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              Go Back
            </button>

            <span className="text-[11px] font-bold uppercase tracking-widest text-gold-400 truncate">
              Now Streaming • {currentSong.category}
            </span>

            <button
              type="button"
              onClick={() => setExpanded(false)}
              className="rounded-full bg-white/10 p-2 text-zinc-200 hover:bg-white/20 transition cursor-pointer"
              aria-label="Close expanded player"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="my-auto flex flex-col items-center text-center max-w-md mx-auto w-full py-4">
            <CoverArt
              title={currentSong.title}
              category={currentSong.category}
              theme={currentSong.cover_theme}
              coverUrl={currentSong.cover_url}
              size="lg"
              className="w-52 h-52 sm:w-68 sm:h-68 shadow-2xl mb-6 rounded-3xl"
            />
            <h2 className="text-xl sm:text-2xl font-extrabold text-white line-clamp-2 px-2">
              {currentSong.title}
            </h2>
            <p className="mt-1 text-xs sm:text-sm font-medium text-gold-300/90">
              {currentSong.artist} • {currentSong.choir_group}
            </p>

            {/* Seek bar */}
            <div className="w-full mt-6">
              <div
                onClick={handleSeekBarClick}
                title={
                  isAuthenticated ? 'Seek' : 'Create a free account to forward or seek through songs'
                }
                className="relative h-2.5 w-full rounded-full bg-white/15 cursor-pointer overflow-hidden"
              >
                <div
                  className="absolute inset-y-0 left-0 bg-white/20"
                  style={{ width: `${bufferedPercent}%` }}
                />
                <div
                  className="absolute inset-y-0 left-0 bg-gradient-to-r from-gold-400 to-pink-500"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <div className="mt-1.5 flex justify-between text-xs tabular-nums text-zinc-400">
                <span>{formatDuration(currentTime)}</span>
                <span>{formatDuration(duration || currentSong.duration_seconds)}</span>
              </div>
            </div>

            {/* Full Transport Controls */}
            <div className="mt-5 flex items-center justify-center gap-4 sm:gap-6">
              <button
                type="button"
                onClick={toggleShuffle}
                className={`p-2 rounded-full transition cursor-pointer ${
                  isAuthenticated && shuffle
                    ? 'text-gold-400 bg-gold-500/15'
                    : 'text-zinc-300 hover:text-white'
                }`}
                title="Shuffle"
              >
                <Shuffle className="w-5 h-5" />
              </button>

              <button
                type="button"
                onClick={() => skipBy(-15)}
                className="p-2 text-zinc-300 hover:text-white transition cursor-pointer"
                title="Back 15s"
              >
                <RotateCcw className="w-5 h-5" />
              </button>

              <button
                type="button"
                onClick={playPrev}
                className="p-2 text-white hover:text-gold-300 transition cursor-pointer"
                title="Previous"
              >
                <SkipBack className="w-7 h-7 fill-current" />
              </button>

              <button
                type="button"
                onClick={togglePlay}
                className="flex h-15 w-15 items-center justify-center rounded-full bg-gradient-to-br from-gold-400 to-pink-600 text-white shadow-xl shadow-pink-500/25 transition cursor-pointer"
                title={isPlaying ? 'Pause' : 'Play'}
              >
                {isBuffering ? (
                  <Loader2 className="w-7 h-7 animate-spin" />
                ) : isPlaying ? (
                  <Pause className="w-7 h-7 fill-white" />
                ) : (
                  <Play className="w-7 h-7 fill-white ml-0.5" />
                )}
              </button>

              <button
                type="button"
                onClick={playNext}
                className="p-2 text-white hover:text-gold-300 transition cursor-pointer"
                title="Next"
              >
                <SkipForward className="w-7 h-7 fill-current" />
              </button>

              <button
                type="button"
                onClick={() => skipBy(15)}
                className="p-2 text-zinc-300 hover:text-white transition cursor-pointer"
                title="Forward 15s"
              >
                <RotateCw className="w-5 h-5" />
              </button>

              <button
                type="button"
                onClick={cycleRepeat}
                className={`p-2 rounded-full transition cursor-pointer ${
                  isAuthenticated && repeat !== 'off'
                    ? 'text-gold-400 bg-gold-500/15'
                    : 'text-zinc-300 hover:text-white'
                }`}
                title={`Repeat: ${repeat}`}
              >
                {repeat === 'one' ? (
                  <Repeat1 className="w-5 h-5" />
                ) : (
                  <Repeat className="w-5 h-5" />
                )}
              </button>
            </div>

            {!isAuthenticated && (
              <button
                type="button"
                onClick={() =>
                  requireAccount(
                    'Create a free account to unlock forwarding/seeking and all 295+ tracks!'
                  )
                }
                className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-gold-500/20 border border-gold-400/40 px-4 py-1.5 text-xs font-bold text-gold-300 hover:bg-gold-500/30 cursor-pointer"
              >
                <Lock className="w-3.5 h-3.5" />
                Preview Mode (5 Songs) • Create Account
              </button>
            )}
          </div>

          {/* All Action Controls Visible in Expanded View (No Device Download — Offline Save to Profile Only) */}
          <div className="flex flex-wrap items-center justify-center gap-2.5 pb-2">
            <button
              type="button"
              onClick={() => {
                if (!isAuthenticated) {
                  requireAccount('Create an account to like songs!');
                  return;
                }
                onToggleFavorite();
              }}
              className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-semibold border transition cursor-pointer ${
                isAuthenticated && isFavorite
                  ? 'border-pink-500/40 bg-pink-500/15 text-pink-300'
                  : 'border-white/10 bg-white/5 text-zinc-200'
              }`}
            >
              <Heart
                className={`w-4 h-4 ${isAuthenticated && isFavorite ? 'fill-pink-500' : ''}`}
              />
              {isAuthenticated && isFavorite ? 'Liked' : 'Like'}
            </button>

            <button
              type="button"
              disabled={savingOffline}
              onClick={handleOfflineClick}
              className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-semibold border transition cursor-pointer ${
                isAuthenticated && isOfflineSaved
                  ? 'border-forest-400/45 bg-forest-500/15 text-forest-300'
                  : 'border-white/10 bg-white/5 text-zinc-200'
              }`}
            >
              {savingOffline ? (
                <Loader2 className="w-4 h-4 animate-spin text-gold-400" />
              ) : isAuthenticated && isOfflineSaved ? (
                <CheckCircle2 className="w-4 h-4 text-forest-400" />
              ) : (
                <CloudDownload className="w-4 h-4 text-forest-400" />
              )}
              {isAuthenticated && isOfflineSaved ? 'Saved Offline' : 'Save Offline'}
            </button>

            <button
              type="button"
              onClick={() => {
                if (!isAuthenticated) {
                  requireAccount('Create an account to add songs to playlists!');
                  return;
                }
                setExpanded(false);
                onOpenPlaylistModal(currentSong);
              }}
              className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3.5 py-2 text-xs font-semibold text-zinc-200 hover:bg-white/10 transition cursor-pointer"
            >
              <ListPlus className="w-4 h-4 text-gold-400" />
              Playlist
            </button>

            {onOpenLyrics && (
              <button
                type="button"
                onClick={() => {
                  if (!isAuthenticated) {
                    requireAccount('Create a free account to read Twi & English lyrics!');
                    return;
                  }
                  setExpanded(false);
                  onOpenLyrics(currentSong);
                }}
                className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3.5 py-2 text-xs font-semibold text-zinc-200 hover:bg-white/10 transition cursor-pointer"
              >
                <FileText className="w-4 h-4 text-gold-300" />
                Lyrics
              </button>
            )}

            {onOpenShareCard && (
              <button
                type="button"
                onClick={() => {
                  if (!isAuthenticated) {
                    requireAccount('Create a free account to share WhatsApp Status cards!');
                    return;
                  }
                  setExpanded(false);
                  onOpenShareCard(currentSong);
                }}
                className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3.5 py-2 text-xs font-semibold text-zinc-200 hover:bg-white/10 transition cursor-pointer"
              >
                <Share2 className="w-4 h-4 text-forest-300" />
                Share
              </button>
            )}
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3 text-xs text-zinc-300">
            <button type="button" onClick={toggleMute} className="min-h-11 rounded-full bg-white/10 px-4">{isMuted ? 'Unmute audio' : 'Mute audio'}</button>
            {systemVolumeControlled ? <span>Adjust loudness with your device&rsquo;s volume buttons.</span> :
              <input aria-label="Expanded playback volume" type="range" min={0} max={1} step={0.02} value={isMuted ? 0 : volume} onChange={(event) => setVolume(Number(event.target.value))} className="w-28 accent-gold-400" />}
          </div>
        </div>
      )}

      {/* Persistent Bottom Bar — ALL Controls Visible on Mobile & Desktop */}
      <div className="safe-player fixed bottom-0 inset-x-0 z-30 w-full max-w-full overflow-hidden border-t border-white/15 bg-zinc-950/98 backdrop-blur-xl px-3 sm:px-5 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] lg:left-64 lg:w-auto">
        <div className="mx-auto max-w-[1600px] space-y-1.5">
          {/* Top Row: Track Info + Seek Bar (Visible on Mobile & Desktop) */}
          <div className="flex items-center justify-between gap-2.5 min-w-0">
            <div
              onClick={() => setExpanded(true)}
              className="flex items-center gap-2.5 min-w-0 flex-1 cursor-pointer"
            >
              <CoverArt
                title={currentSong.title}
                category={currentSong.category}
                theme={currentSong.cover_theme}
                coverUrl={currentSong.cover_url}
                size="sm"
                className="h-9 w-9 sm:h-11 sm:w-11 rounded-xl flex-shrink-0"
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 min-w-0">
                  <p className="text-xs sm:text-sm font-bold text-white truncate">
                    {currentSong.title}
                  </p>
                  {isPrelistenMode && (
                    <span className="rounded-full bg-gold-500/20 border border-gold-400/40 px-1.5 py-0.5 text-[9px] font-extrabold uppercase text-gold-300 flex-shrink-0">
                      Pre-Listen
                    </span>
                  )}
                  {startupLatencyMs !== null && isAuthenticated && (
                    <span className="hidden lg:inline-flex items-center gap-0.5 rounded-full bg-forest-500/15 border border-forest-500/30 px-1.5 py-0.5 text-[10px] font-semibold text-forest-300 flex-shrink-0">
                      <Zap className="w-2.5 h-2.5" />
                      {(startupLatencyMs / 1000).toFixed(2)}s
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-zinc-400 truncate">{currentSong.artist}</p>
              </div>
            </div>

            {/* Seek Bar + Timestamps */}
            <div className="flex items-center gap-2 flex-1 max-w-[180px] sm:max-w-md">
              <span className="text-[10px] sm:text-[11px] tabular-nums text-zinc-400 flex-shrink-0">
                {formatDuration(currentTime)}
              </span>
              <div
                onClick={handleSeekBarClick}
                title={
                  isAuthenticated ? 'Seek' : 'Create a free account to forward or seek through songs'
                }
                className="relative h-2 flex-1 rounded-full bg-white/15 cursor-pointer overflow-hidden"
              >
                <div
                  className="absolute inset-y-0 left-0 bg-white/20"
                  style={{ width: `${bufferedPercent}%` }}
                />
                <div
                  className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-gold-400 via-pink-500 to-gold-500"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <span className="text-[10px] sm:text-[11px] tabular-nums text-zinc-400 flex-shrink-0">
                {formatDuration(duration || currentSong.duration_seconds)}
              </span>
            </div>
          </div>

          {/* Bottom Row: ALL Transport & Feature Controls Always Visible */}
          <div className="flex flex-wrap items-center justify-between gap-1 sm:gap-3 min-w-0">
            {/* Transport Controls */}
            <div className="flex items-center gap-0.5 sm:gap-2">
              <button
                type="button"
                onClick={toggleShuffle}
                title="Shuffle"
                className={`p-1.5 rounded-full transition cursor-pointer ${
                  isAuthenticated && shuffle
                    ? 'text-gold-400 bg-gold-500/15'
                    : isAuthenticated
                    ? 'text-zinc-300 hover:text-white'
                    : 'text-zinc-500'
                }`}
              >
                <Shuffle className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </button>

              <button
                type="button"
                onClick={() => skipBy(-15)}
                title="Rewind 15s"
                className={`p-1.5 rounded-full transition cursor-pointer ${
                  isAuthenticated ? 'text-zinc-300 hover:text-white' : 'text-zinc-500'
                }`}
              >
                <RotateCcw className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </button>

              <button
                type="button"
                onClick={playPrev}
                title="Previous"
                className="p-1.5 text-zinc-100 hover:text-white transition cursor-pointer"
              >
                <SkipBack className="w-4 h-4 sm:w-5 sm:h-5 fill-current" />
              </button>

              <button
                type="button"
                onClick={togglePlay}
                title={isPlaying ? 'Pause' : 'Play'}
                className="flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-full bg-white text-zinc-950 shadow-md transition cursor-pointer flex-shrink-0"
              >
                {isBuffering ? (
                  <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin text-zinc-900" />
                ) : isPlaying ? (
                  <Pause className="w-4 h-4 sm:w-5 sm:h-5 fill-zinc-950" />
                ) : (
                  <Play className="w-4 h-4 sm:w-5 sm:h-5 fill-zinc-950 ml-0.5" />
                )}
              </button>

              <button
                type="button"
                onClick={playNext}
                title="Next"
                className="p-1.5 text-zinc-100 hover:text-white transition cursor-pointer"
              >
                <SkipForward className="w-4 h-4 sm:w-5 sm:h-5 fill-current" />
              </button>

              <button
                type="button"
                onClick={() => skipBy(15)}
                title="Forward 15s"
                className={`p-1.5 rounded-full transition cursor-pointer ${
                  isAuthenticated ? 'text-zinc-300 hover:text-white' : 'text-zinc-500'
                }`}
              >
                <RotateCw className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </button>

              <button
                type="button"
                onClick={cycleRepeat}
                title={`Repeat: ${repeat}`}
                className={`p-1.5 rounded-full transition cursor-pointer ${
                  isAuthenticated && repeat !== 'off'
                    ? 'text-gold-400 bg-gold-500/15'
                    : isAuthenticated
                    ? 'text-zinc-300 hover:text-white'
                    : 'text-zinc-500'
                }`}
              >
                {repeat === 'one' ? (
                  <Repeat1 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                ) : (
                  <Repeat className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                )}
              </button>
            </div>

            {/* Right Action Controls — Always Visible (Like, Offline Save, Playlist, Lyrics, Share, Queue, Expand) */}
            <div className="flex flex-wrap items-center gap-0.5 sm:gap-1.5">
              {currentSong.category === 'Sermons' && (
                <button
                  type="button"
                  onClick={nextSpeed}
                  title="Playback speed"
                  className="rounded-lg bg-white/10 px-1.5 py-1 text-[10px] font-bold text-gold-300 cursor-pointer"
                >
                  {playbackRate}x
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
                  onToggleFavorite();
                }}
                title="Like song (Premium)"
                className={`rounded-full p-1.5 transition cursor-pointer ${
                  isAuthenticated && isFavorite
                    ? 'text-pink-500 bg-pink-500/10'
                    : 'text-zinc-300 hover:bg-white/10 hover:text-white'
                }`}
              >
                <Heart
                  className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${
                    isAuthenticated && isFavorite ? 'fill-pink-500' : ''
                  }`}
                />
              </button>

              {/* Save to Profile for In-App Offline Listening (Premium — No Device File Download) */}
              <button
                type="button"
                disabled={savingOffline}
                onClick={handleOfflineClick}
                title={
                  isAuthenticated && isOfflineSaved
                    ? 'Saved to profile for offline listening'
                    : 'Save to profile for offline listening (Premium)'
                }
                className={`rounded-full p-1.5 transition cursor-pointer ${
                  isAuthenticated && isOfflineSaved
                    ? 'text-forest-400 bg-forest-500/15'
                    : 'text-zinc-300 hover:bg-white/10 hover:text-forest-300'
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

              {/* Add to Playlist (Premium) */}
              <button
                type="button"
                onClick={() => {
                  if (!isAuthenticated) {
                    requireAccount('Create a free account to add songs to playlists!');
                    return;
                  }
                  onOpenPlaylistModal(currentSong);
                }}
                title="Add to playlist (Premium)"
                className="rounded-full p-1.5 text-zinc-300 hover:bg-white/10 hover:text-gold-300 transition cursor-pointer"
              >
                <ListPlus className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </button>

              {/* Lyrics */}
              {onOpenLyrics && (
                <button
                  type="button"
                  onClick={() => {
                    if (!isAuthenticated) {
                      requireAccount('Create a free account to view Twi & English song lyrics!');
                      return;
                    }
                    onOpenLyrics(currentSong);
                  }}
                  title="Twi & English Song Lyrics"
                  className={`rounded-full p-1.5 transition cursor-pointer ${
                    hasLyrics
                      ? 'text-gold-300 bg-gold-500/15'
                      : 'text-zinc-300 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <FileText className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </button>
              )}

              {/* Share WhatsApp Status Card */}
              {onOpenShareCard && (
                <button
                  type="button"
                  onClick={() => {
                    if (!isAuthenticated) {
                      requireAccount('Create a free account to share WhatsApp Status cards!');
                      return;
                    }
                    onOpenShareCard(currentSong);
                  }}
                  title="Share WhatsApp Status Card"
                  className="rounded-full p-1.5 text-zinc-300 hover:bg-forest-500/15 hover:text-forest-300 transition cursor-pointer"
                >
                  <Share2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </button>
              )}

              {/* Up Next Queue */}
              <button
                type="button"
                onClick={onToggleQueue}
                title="Up Next Queue"
                className="relative rounded-full p-1.5 text-zinc-300 hover:bg-white/10 hover:text-white transition cursor-pointer"
              >
                <ListMusic className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                {isAuthenticated && queue.length > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 rounded-full bg-gold-500 px-1 text-[8px] font-bold text-zinc-950">
                    {queue.length}
                  </span>
                )}
              </button>

              {/* Phones and tablets control loudness with the hardware buttons, not HTMLMediaElement.volume. */}
              <div className={`relative flex items-center gap-1.5 ${systemVolumeControlled ? 'w-28' : 'w-24'}`}>
                <button
                  type="button"
                  onClick={toggleMute}
                  className="min-h-11 min-w-8 p-1 text-zinc-300 hover:text-white transition cursor-pointer"
                  title={isMuted ? 'Unmute' : 'Mute'}
                >
                  {isMuted || volume === 0 ? (
                    <VolumeX className="w-4 h-4" />
                  ) : (
                    <Volume2 className="w-4 h-4" />
                  )}
                </button>
                {systemVolumeControlled ? (
                  <>
                    <button type="button" onClick={() => setVolumeHelp((value) => !value)}
                      aria-label="Device volume instructions" aria-expanded={volumeHelp}
                      className="min-h-8 text-[10px] font-semibold leading-tight text-gold-200">Device volume</button>

                  </>
                ) : (
                  <input aria-label="Playback volume" type="range" min={0} max={1} step={0.02}
                    value={isMuted ? 0 : volume} onChange={(e) => setVolume(parseFloat(e.target.value))}
                    className="w-full accent-gold-400 h-1 cursor-pointer" />
                )}
              </div>

              {/* Expand Fullscreen Player */}
              <button
                type="button"
                onClick={() => setExpanded(true)}
                title="Expand player"
                className="rounded-full p-1.5 text-zinc-300 hover:bg-white/10 hover:text-white transition cursor-pointer"
              >
                <Maximize2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </button>
            </div>
          </div>
          {systemVolumeControlled && volumeHelp && <p role="status" className="mt-1 rounded-lg bg-gold-400/10 px-2 py-1 text-[11px] text-gold-200">Use your device’s volume buttons for loudness. The speaker button mutes or unmutes this app.</p>}
        </div>
      </div>
    </>
  );
};
