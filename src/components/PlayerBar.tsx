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
  Download,
  Heart,
  ListMusic,
  Loader2,
  RotateCcw,
  RotateCw,
  Maximize2,
  X,
  Zap,
  Lock,
  FileText,
  Share2,
} from 'lucide-react';
import { Song } from '../types/music';
import { usePlayer } from '../context/PlayerContext';
import { CoverArt } from './CoverArt';
import { formatDuration } from '../lib/format';

interface PlayerBarProps {
  isFavorite: boolean;
  onToggleFavorite: () => void;
  onToggleQueue: () => void;
  onOpenLyrics?: (song: Song) => void;
  onOpenShareCard?: (song: Song) => void;
}

export const PlayerBar: React.FC<PlayerBarProps> = ({
  isFavorite,
  onToggleFavorite,
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
    downloadSong,
  } = usePlayer();

  const [expanded, setExpanded] = useState(false);

  if (!currentSong) {
    return null;
  }

  const progressPercent = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;

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

  return (
    <>
      {/* Fullscreen Now Playing Modal */}
      {expanded && (
        <div className="fixed inset-0 z-50 flex flex-col justify-between bg-gradient-to-b from-zinc-900 via-zinc-950 to-black p-6 sm:p-10">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-widest text-amber-400">
              Now Streaming • {currentSong.category}
            </span>
            <button
              onClick={() => setExpanded(false)}
              className="rounded-full bg-white/10 p-2 text-zinc-200 hover:bg-white/20 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="my-auto flex flex-col items-center text-center max-w-md mx-auto w-full">
            <CoverArt
              title={currentSong.title}
              category={currentSong.category}
              theme={currentSong.cover_theme}
              coverUrl={currentSong.cover_url}
              size="lg"
              className="w-60 h-60 sm:w-72 sm:h-72 shadow-2xl mb-8"
            />
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white line-clamp-2">
              {currentSong.title}
            </h2>
            <p className="mt-1.5 text-sm font-medium text-amber-300/90">
              {currentSong.artist} • {currentSong.choir_group}
            </p>

            {/* Progress bar (gated for guests) */}
            <div className="w-full mt-8">
              <div
                onClick={handleSeekBarClick}
                title={
                  isAuthenticated ? 'Seek' : 'Create a free account to forward or seek through songs'
                }
                className="relative h-2 w-full rounded-full bg-white/15 cursor-pointer overflow-hidden"
              >
                <div
                  className="absolute inset-y-0 left-0 bg-white/20"
                  style={{ width: `${bufferedPercent}%` }}
                />
                <div
                  className="absolute inset-y-0 left-0 bg-gradient-to-r from-amber-400 to-pink-500"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <div className="mt-2 flex justify-between text-xs tabular-nums text-zinc-400">
                <span>{formatDuration(currentTime)}</span>
                <span>{formatDuration(duration || currentSong.duration_seconds)}</span>
              </div>
            </div>

            {/* Big controls */}
            <div className="mt-6 flex items-center justify-center gap-6">
              <button
                onClick={() => skipBy(-15)}
                className={`p-2 transition cursor-pointer ${
                  isAuthenticated ? 'text-zinc-300 hover:text-white' : 'text-zinc-600'
                }`}
                title={isAuthenticated ? 'Back 15s' : 'Sign up to rewind/forward'}
              >
                <RotateCcw className="w-5 h-5" />
              </button>
              <button
                onClick={playPrev}
                className="p-2 text-white hover:text-amber-300 transition cursor-pointer"
                title="Previous"
              >
                <SkipBack className="w-7 h-7 fill-current" />
              </button>
              <button
                onClick={togglePlay}
                className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-pink-600 text-white shadow-xl shadow-pink-500/25 hover:scale-105 transition cursor-pointer"
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
                onClick={playNext}
                className="p-2 text-white hover:text-amber-300 transition cursor-pointer"
                title="Next"
              >
                <SkipForward className="w-7 h-7 fill-current" />
              </button>
              <button
                onClick={() => skipBy(15)}
                className={`p-2 transition cursor-pointer ${
                  isAuthenticated ? 'text-zinc-300 hover:text-white' : 'text-zinc-600'
                }`}
                title={isAuthenticated ? 'Forward 15s' : 'Sign up to forward'}
              >
                <RotateCw className="w-5 h-5" />
              </button>
            </div>

            {!isAuthenticated && (
              <button
                onClick={() =>
                  requireAccount(
                    'Create a free account to unlock forwarding/seeking, likes, downloads, playlists & all 295+ tracks!'
                  )
                }
                className="mt-5 inline-flex items-center gap-1.5 rounded-full bg-amber-500/20 border border-amber-400/40 px-4 py-1.5 text-xs font-bold text-amber-300 hover:bg-amber-500/30 cursor-pointer"
              >
                <Lock className="w-3.5 h-3.5" />
                Preview Mode (5 Songs) • Create Account for Full Controls
              </button>
            )}
          </div>

          <div className="flex items-center justify-center gap-6">
            <button
              onClick={() => {
                if (!isAuthenticated) {
                  requireAccount('Create a free account to like songs!');
                  return;
                }
                onToggleFavorite();
              }}
              className={`flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold border transition cursor-pointer ${
                isAuthenticated && isFavorite
                  ? 'border-pink-500/40 bg-pink-500/15 text-pink-300'
                  : 'border-white/10 bg-white/5 text-zinc-300'
              }`}
            >
              <Heart
                className={`w-4 h-4 ${isAuthenticated && isFavorite ? 'fill-pink-500' : ''}`}
              />
              {isAuthenticated && isFavorite ? 'Liked' : 'Like'}
            </button>
            <button
              onClick={() => downloadSong(currentSong)}
              className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-zinc-300 hover:bg-white/10 transition cursor-pointer"
            >
              <Download className="w-4 h-4" />
              Download MP3
            </button>
          </div>
        </div>
      )}

      {/* Persistent Bottom Bar */}
      <div className="fixed bottom-0 inset-x-0 z-30 border-t border-white/10 bg-zinc-950/95 backdrop-blur-xl px-3 sm:px-6 py-2.5">
        {/* Top thin seek line on mobile (gated for guests) */}
        <div
          onClick={handleSeekBarClick}
          className="sm:hidden -mt-2.5 mb-2 h-1.5 w-full bg-white/10 cursor-pointer overflow-hidden rounded-full"
        >
          <div
            className="h-full bg-gradient-to-r from-amber-400 to-pink-500"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        <div className="mx-auto max-w-[1600px] grid grid-cols-12 items-center gap-2 sm:gap-4">
          {/* Left: Track info */}
          <div className="col-span-7 sm:col-span-4 flex items-center gap-3 min-w-0">
            <div onClick={() => setExpanded(true)} className="cursor-pointer flex-shrink-0">
              <CoverArt
                title={currentSong.title}
                category={currentSong.category}
                theme={currentSong.cover_theme}
                coverUrl={currentSong.cover_url}
                size="md"
                className="h-11 w-11 sm:h-12 sm:w-12 rounded-xl"
              />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setExpanded(true)}
                  className="text-sm font-bold text-white hover:text-amber-300 truncate text-left cursor-pointer"
                >
                  {currentSong.title}
                </button>
                {isPrelistenMode && (
                  <span className="inline-flex items-center rounded-full bg-amber-500/20 border border-amber-400/40 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-amber-300 flex-shrink-0">
                    Pre-Listen
                  </span>
                )}
                {startupLatencyMs !== null && isAuthenticated && (
                  <span
                    title="Stream start latency"
                    className="hidden xl:inline-flex items-center gap-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-300 flex-shrink-0"
                  >
                    <Zap className="w-2.5 h-2.5" />
                    {(startupLatencyMs / 1000).toFixed(2)}s
                  </span>
                )}
              </div>
              <p className="text-xs text-zinc-400 truncate">{currentSong.artist}</p>
            </div>
            <button
              onClick={() => {
                if (!isAuthenticated) {
                  requireAccount('Create a free account to like songs!');
                  return;
                }
                onToggleFavorite();
              }}
              className={`hidden sm:inline-flex rounded-full p-1.5 transition cursor-pointer ${
                isAuthenticated && isFavorite
                  ? 'text-pink-500'
                  : 'text-zinc-400 hover:text-white'
              }`}
              title="Like"
            >
              <Heart
                className={`w-4 h-4 ${isAuthenticated && isFavorite ? 'fill-pink-500' : ''}`}
              />
            </button>
          </div>

          {/* Center: Transport & Seek */}
          <div className="col-span-5 sm:col-span-5 flex flex-col items-end sm:items-center justify-center">
            <div className="flex items-center gap-2 sm:gap-4">
              <button
                onClick={toggleShuffle}
                title={isAuthenticated ? 'Shuffle' : 'Create account to shuffle'}
                className={`hidden md:inline-flex p-1.5 rounded-full transition cursor-pointer ${
                  isAuthenticated && shuffle
                    ? 'text-amber-400 bg-amber-500/10'
                    : isAuthenticated
                    ? 'text-zinc-400 hover:text-white'
                    : 'text-zinc-600 hover:text-zinc-400'
                }`}
              >
                <Shuffle className="w-4 h-4" />
              </button>

              <button
                onClick={() => skipBy(-15)}
                title={isAuthenticated ? 'Rewind 15s' : 'Create account to rewind/forward'}
                className={`hidden lg:inline-flex p-1.5 transition cursor-pointer ${
                  isAuthenticated
                    ? 'text-zinc-400 hover:text-white'
                    : 'text-zinc-600 hover:text-zinc-400'
                }`}
              >
                <RotateCcw className="w-4 h-4" />
              </button>

              {/* Allowed for guests: Previous */}
              <button
                onClick={playPrev}
                title="Previous"
                className="p-1.5 text-zinc-200 hover:text-white transition cursor-pointer"
              >
                <SkipBack className="w-5 h-5 fill-current" />
              </button>

              {/* Allowed for guests: Play / Pause */}
              <button
                onClick={togglePlay}
                title={isPlaying ? 'Pause' : 'Play'}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-zinc-950 shadow-lg hover:scale-105 transition cursor-pointer"
              >
                {isBuffering ? (
                  <Loader2 className="w-5 h-5 animate-spin text-zinc-900" />
                ) : isPlaying ? (
                  <Pause className="w-5 h-5 fill-zinc-950" />
                ) : (
                  <Play className="w-5 h-5 fill-zinc-950 ml-0.5" />
                )}
              </button>

              {/* Allowed for guests: Next */}
              <button
                onClick={playNext}
                title="Next"
                className="p-1.5 text-zinc-200 hover:text-white transition cursor-pointer"
              >
                <SkipForward className="w-5 h-5 fill-current" />
              </button>

              <button
                onClick={() => skipBy(15)}
                title={isAuthenticated ? 'Forward 15s' : 'Create account to forward'}
                className={`hidden lg:inline-flex p-1.5 transition cursor-pointer ${
                  isAuthenticated
                    ? 'text-zinc-400 hover:text-white'
                    : 'text-zinc-600 hover:text-zinc-400'
                }`}
              >
                <RotateCw className="w-4 h-4" />
              </button>

              <button
                onClick={cycleRepeat}
                title={isAuthenticated ? `Repeat: ${repeat}` : 'Create account to repeat'}
                className={`hidden md:inline-flex p-1.5 rounded-full transition cursor-pointer ${
                  isAuthenticated && repeat !== 'off'
                    ? 'text-amber-400 bg-amber-500/10'
                    : isAuthenticated
                    ? 'text-zinc-400 hover:text-white'
                    : 'text-zinc-600 hover:text-zinc-400'
                }`}
              >
                {repeat === 'one' ? (
                  <Repeat1 className="w-4 h-4" />
                ) : (
                  <Repeat className="w-4 h-4" />
                )}
              </button>
            </div>

            {/* Desktop seek bar (clicking when guest pops up Create Account) */}
            <div className="hidden sm:flex w-full max-w-md items-center gap-2.5 mt-1">
              <span className="text-[11px] tabular-nums text-zinc-400 w-9 text-right">
                {formatDuration(currentTime)}
              </span>
              <div
                onClick={handleSeekBarClick}
                title={
                  isAuthenticated ? 'Seek' : 'Create a free account to forward or seek through songs'
                }
                className="group relative h-1.5 flex-1 rounded-full bg-white/15 cursor-pointer overflow-hidden"
              >
                <div
                  className="absolute inset-y-0 left-0 bg-white/20 transition-all"
                  style={{ width: `${bufferedPercent}%` }}
                />
                <div
                  className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-amber-400 via-pink-500 to-violet-500"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <span className="text-[11px] tabular-nums text-zinc-400 w-9">
                {formatDuration(duration || currentSong.duration_seconds)}
              </span>
            </div>
          </div>

          {/* Right: Extra controls (gated for guests) */}
          <div className="hidden sm:flex sm:col-span-3 items-center justify-end gap-1.5">
            {!isAuthenticated ? (
              <button
                onClick={() =>
                  requireAccount(
                    'Create a free account to unlock all 295+ songs, likes, downloads, playlists, and seeking!'
                  )
                }
                className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/20 border border-amber-400/40 px-3 py-1.5 text-[11px] font-bold text-amber-300 hover:bg-amber-500/30 transition cursor-pointer"
              >
                <Lock className="w-3 h-3" />
                5-Song Preview • Unlock All
              </button>
            ) : (
              <>
                {currentSong.category === 'Sermons' && (
                  <button
                    onClick={nextSpeed}
                    title="Playback speed"
                    className="rounded-lg bg-white/5 border border-white/10 px-2 py-1 text-[11px] font-bold text-amber-300 hover:bg-white/10 transition cursor-pointer"
                  >
                    {playbackRate}x
                  </button>
                )}

                {onOpenLyrics && (
                  <button
                    onClick={() => onOpenLyrics(currentSong)}
                    title="Twi & English Song Lyrics"
                    className={`rounded-full p-2 transition cursor-pointer ${
                      (currentSong.lyrics_text && currentSong.lyrics_text.trim().length > 0) ||
                      (currentSong.lyrics_timed && currentSong.lyrics_timed.length > 0)
                        ? 'text-amber-300 bg-amber-500/15 border border-amber-400/30 hover:bg-amber-500/25'
                        : 'text-zinc-400 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    <FileText className="w-4 h-4" />
                  </button>
                )}

                {onOpenShareCard && (
                  <button
                    onClick={() => onOpenShareCard(currentSong)}
                    title="1-Tap WhatsApp Status Poster"
                    className="rounded-full p-2 text-zinc-400 hover:bg-emerald-500/15 hover:text-emerald-300 transition cursor-pointer"
                  >
                    <Share2 className="w-4 h-4" />
                  </button>
                )}

                <button
                  onClick={() => downloadSong(currentSong)}
                  title="Download MP3"
                  className="rounded-full p-2 text-zinc-400 hover:bg-white/10 hover:text-white transition cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                </button>

                <button
                  onClick={onToggleQueue}
                  title="Up Next Queue"
                  className="relative rounded-full p-2 text-zinc-400 hover:bg-white/10 hover:text-white transition cursor-pointer"
                >
                  <ListMusic className="w-4 h-4" />
                  {queue.length > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 rounded-full bg-amber-500 px-1 text-[9px] font-bold text-zinc-950">
                      {queue.length}
                    </span>
                  )}
                </button>

                <div className="hidden lg:flex items-center gap-1.5 w-24">
                  <button
                    onClick={toggleMute}
                    className="p-1.5 text-zinc-400 hover:text-white transition cursor-pointer"
                    title={isMuted ? 'Unmute' : 'Mute'}
                  >
                    {isMuted || volume === 0 ? (
                      <VolumeX className="w-4 h-4" />
                    ) : (
                      <Volume2 className="w-4 h-4" />
                    )}
                  </button>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.02}
                    value={isMuted ? 0 : volume}
                    onChange={(e) => setVolume(parseFloat(e.target.value))}
                    className="w-full accent-amber-400 h-1 cursor-pointer"
                  />
                </div>

                <button
                  onClick={() => setExpanded(true)}
                  title="Expand player"
                  className="rounded-full p-2 text-zinc-400 hover:bg-white/10 hover:text-white transition cursor-pointer"
                >
                  <Maximize2 className="w-4 h-4" />
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
};
