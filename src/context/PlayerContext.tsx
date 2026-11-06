import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { Song, RepeatMode, isSongPubliclyPlayable } from '../types/music';
import { supabase } from '../lib/supabase';
import { resolvePlayableAudioUrl } from '../lib/offlineAudio';
import { clearSermonProgress, saveSermonProgress } from '../lib/sermonProgress';

interface PlayOptions {
  isPrelisten?: boolean;
  startAtSeconds?: number;
}

interface PlayerProviderProps {
  children: React.ReactNode;
  userId?: string | null;
  isAuthenticated: boolean;
  guestUnlockedIds: Set<string>;
  onRequireAccount: (reason?: string) => void;
}

interface PlayerContextValue {
  currentSong: Song | null;
  queue: Song[];
  isPlaying: boolean;
  isBuffering: boolean;
  isPrelistenMode: boolean;
  isAuthenticated: boolean;
  currentTime: number;
  duration: number;
  bufferedPercent: number;
  volume: number;
  isMuted: boolean;
  shuffle: boolean;
  repeat: RepeatMode;
  playbackRate: number;
  startupLatencyMs: number | null;
  recentlyPlayedIds: string[];
  isSongLockedForGuest: (songId: string) => boolean;
  requireAccount: (reason?: string) => void;
  playSong: (song: Song, contextQueue?: Song[], options?: PlayOptions) => void;
  togglePlay: () => void;
  playNext: () => void;
  playPrev: () => void;
  seekTo: (seconds: number) => void;
  skipBy: (deltaSeconds: number) => void;
  setVolume: (vol: number) => void;
  toggleMute: () => void;
  toggleShuffle: () => void;
  cycleRepeat: () => void;
  setPlaybackRate: (rate: number) => void;
  warmTrack: (song: Song) => void;
  addToQueue: (song: Song) => void;
  removeFromQueue: (songId: string) => void;
  downloadSong: (song: Song) => Promise<void>;
}

const PlayerContext = createContext<PlayerContextValue | null>(null);

const RECENT_STORAGE_KEY = 'gyidi_recent_ids_v2';
const VOLUME_STORAGE_KEY = 'gyidi_volume_v2';

export const PlayerProvider: React.FC<PlayerProviderProps> = ({
  children,
  userId = null,
  isAuthenticated,
  guestUnlockedIds,
  onRequireAccount,
}) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const prefetchAudioRef = useRef<HTMLAudioElement | null>(null);
  const lastPrefetchedUrlRef = useRef<string>('');
  const clickStartRef = useRef<number | null>(null);
  const countedPlayIdRef = useRef<string | null>(null);
  const pendingSeekSecRef = useRef<number | null>(null);
  const lastProgressSaveMsRef = useRef<number>(0);

  const [currentSong, setCurrentSong] = useState<Song | null>(null);
  const [queue, setQueue] = useState<Song[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [isPrelistenMode, setIsPrelistenMode] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [bufferedPercent, setBufferedPercent] = useState(0);
  const [volume, setVolumeState] = useState<number>(() => {
    const saved = localStorage.getItem(VOLUME_STORAGE_KEY);
    return saved ? Math.min(1, Math.max(0, parseFloat(saved))) : 0.9;
  });
  const [isMuted, setIsMuted] = useState(false);
  const [shuffle, setShuffle] = useState(false);
  const [repeat, setRepeat] = useState<RepeatMode>('all');
  const [playbackRate, setPlaybackRateState] = useState(1);
  const [startupLatencyMs, setStartupLatencyMs] = useState<number | null>(null);
  const [recentlyPlayedIds, setRecentlyPlayedIds] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(RECENT_STORAGE_KEY) || '[]');
    } catch {
      return [];
    }
  });

  const isSongLockedForGuest = useCallback(
    (songId: string) => {
      if (isAuthenticated) return false;
      return !guestUnlockedIds.has(songId);
    },
    [isAuthenticated, guestUnlockedIds]
  );

  const requireAccount = useCallback(
    (reason?: string) => {
      onRequireAccount(reason);
    },
    [onRequireAccount]
  );

  useEffect(() => {
    const audio = new Audio();
    audio.preload = 'auto';
    audio.crossOrigin = 'anonymous';
    audio.volume = volume;
    audioRef.current = audio;

    const prefetcher = new Audio();
    prefetcher.preload = 'metadata';
    prefetcher.crossOrigin = 'anonymous';
    prefetcher.muted = true;
    prefetchAudioRef.current = prefetcher;

    return () => {
      audio.pause();
      audio.src = '';
      prefetcher.src = '';
    };
  }, []);

  const recordRecent = useCallback((songId: string) => {
    setRecentlyPlayedIds((prev) => {
      const next = [songId, ...prev.filter((id) => id !== songId)].slice(0, 24);
      try {
        localStorage.setItem(RECENT_STORAGE_KEY, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  const warmTrack = useCallback(
    (song: Song) => {
      if (isBuffering) return;
      if (!isSongPubliclyPlayable(song)) return;
      if (!isAuthenticated && !guestUnlockedIds.has(song.id)) return;
      if (!song?.stream_url || lastPrefetchedUrlRef.current === song.stream_url) return;
      if (currentSong?.stream_url === song.stream_url) return;
      const prefetcher = prefetchAudioRef.current;
      if (!prefetcher) return;
      lastPrefetchedUrlRef.current = song.stream_url;
      prefetcher.preload = 'auto';
      prefetcher.src = song.stream_url;
      prefetcher.load();
    },
    [isBuffering, currentSong, isAuthenticated, guestUnlockedIds]
  );

  const playSong = useCallback(
    (song: Song, contextQueue?: Song[], options?: PlayOptions) => {
      const audio = audioRef.current;
      if (!audio) return;

      const prelisten = Boolean(options?.isPrelisten);
      if (!prelisten && !isSongPubliclyPlayable(song)) {
        return;
      }

      // Guest 5-song lock check
      if (!prelisten && !isAuthenticated && !guestUnlockedIds.has(song.id)) {
        onRequireAccount(
          'Guests can preview 5 songs. Create a free account to unlock the entire Gyidi Nwom catalog!'
        );
        return;
      }

      if (contextQueue && contextQueue.length > 0) {
        const playableQueue = prelisten
          ? contextQueue
          : contextQueue.filter(
              (s) =>
                isSongPubliclyPlayable(s) &&
                (isAuthenticated || guestUnlockedIds.has(s.id))
            );
        setQueue(playableQueue.length > 0 ? playableQueue : [song]);
      } else {
        setQueue((prev) => {
          const allowedPrev = isAuthenticated
            ? prev
            : prev.filter((s) => guestUnlockedIds.has(s.id));
          return allowedPrev.some((s) => s.id === song.id)
            ? allowedPrev
            : [song, ...allowedPrev];
        });
      }

      setIsPrelistenMode(prelisten);
      clickStartRef.current = performance.now();
      setStartupLatencyMs(null);
      setIsBuffering(true);
      setCurrentSong(song);
      const targetStart =
        isAuthenticated && options?.startAtSeconds && options.startAtSeconds > 0
          ? options.startAtSeconds
          : 0;
      pendingSeekSecRef.current = targetStart > 0 ? targetStart : null;
      setCurrentTime(targetStart);
      setDuration(song.duration_seconds || 0);
      setBufferedPercent(0);

      const startPlaybackWithUrl = (urlToPlay: string) => {
        if (audio.src !== urlToPlay) {
          audio.src = urlToPlay;
        }
        if (targetStart > 0) {
          try {
            audio.currentTime = targetStart;
          } catch {
            // Applied once metadata loads via pendingSeekSecRef
          }
        } else {
          audio.currentTime = 0;
        }
        audio.playbackRate = isAuthenticated ? playbackRate : 1;
        audio.volume = isMuted ? 0 : volume;

        const playPromise = audio.play();
        if (playPromise !== undefined) {
          playPromise
            .then(() => {
              setIsPlaying(true);
            })
            .catch((err) => {
              console.warn('Playback prevented or interrupted:', err);
              setIsBuffering(false);
              setIsPlaying(false);
            });
        }
      };

      if (!navigator.onLine) {
        resolvePlayableAudioUrl(song).then(startPlaybackWithUrl);
      } else {
        startPlaybackWithUrl(song.stream_url);
      }

      if (!prelisten) {
        recordRecent(song.id);
        if (countedPlayIdRef.current !== song.id) {
          countedPlayIdRef.current = song.id;
          supabase.rpc('increment_play_count', { track_id: song.id }).then(() => {});
        }
      }
    },
    [
      isAuthenticated,
      guestUnlockedIds,
      onRequireAccount,
      playbackRate,
      isMuted,
      volume,
      recordRecent,
    ]
  );

  // Allowed for guests: Play / Pause
  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || !currentSong) return;
    if (audio.paused) {
      if (!audio.src) {
        audio.src = currentSong.stream_url;
      }
      clickStartRef.current = performance.now();
      audio
        .play()
        .then(() => setIsPlaying(true))
        .catch(() => setIsPlaying(false));
    } else {
      audio.pause();
      setIsPlaying(false);
    }
  }, [currentSong]);

  const getNextSong = useCallback(
    (direction: 1 | -1): Song | null => {
      const allowedQueue = isAuthenticated
        ? queue
        : queue.filter((s) => guestUnlockedIds.has(s.id));
      if (!currentSong || allowedQueue.length === 0) return null;

      if (isAuthenticated && shuffle && allowedQueue.length > 1 && direction === 1) {
        const candidates = allowedQueue.filter((s) => s.id !== currentSong.id);
        return candidates[Math.floor(Math.random() * candidates.length)] || allowedQueue[0];
      }

      const idx = allowedQueue.findIndex((s) => s.id === currentSong.id);
      if (idx === -1) return allowedQueue[0];
      const nextIdx = idx + direction;
      if (nextIdx >= allowedQueue.length) {
        return repeat === 'off' && direction === 1 && isAuthenticated
          ? null
          : allowedQueue[0];
      }
      if (nextIdx < 0) {
        return allowedQueue[allowedQueue.length - 1];
      }
      return allowedQueue[nextIdx];
    },
    [currentSong, queue, isAuthenticated, guestUnlockedIds, shuffle, repeat]
  );

  // Allowed for guests: Next (cycles within the 5 unlocked preview tracks)
  const playNext = useCallback(() => {
    const next = getNextSong(1);
    if (next) {
      playSong(next, undefined, { isPrelisten: isPrelistenMode });
    } else {
      setIsPlaying(false);
    }
  }, [getNextSong, playSong, isPrelistenMode]);

  // Allowed for guests: Previous (cycles within the 5 unlocked preview tracks)
  const playPrev = useCallback(() => {
    const audio = audioRef.current;
    if (isAuthenticated && audio && audio.currentTime > 4) {
      audio.currentTime = 0;
      setCurrentTime(0);
      return;
    }
    const prev = getNextSong(-1);
    if (prev) playSong(prev, undefined, { isPrelisten: isPrelistenMode });
  }, [getNextSong, playSong, isPrelistenMode, isAuthenticated]);

  // GATED for guests: Seeking / Forwarding
  const seekTo = useCallback(
    (seconds: number) => {
      if (!isAuthenticated) {
        onRequireAccount('Create a free account to forward or seek through songs!');
        return;
      }
      const audio = audioRef.current;
      if (!audio) return;
      const target = Math.max(0, Math.min(seconds, audio.duration || duration || seconds));
      audio.currentTime = target;
      setCurrentTime(target);
    },
    [duration, isAuthenticated, onRequireAccount]
  );

  // GATED for guests: Forwarding (+15s / -15s)
  const skipBy = useCallback(
    (deltaSeconds: number) => {
      if (!isAuthenticated) {
        onRequireAccount('Create a free account to forward or rewind songs!');
        return;
      }
      const audio = audioRef.current;
      if (!audio) return;
      seekTo((audio.currentTime || 0) + deltaSeconds);
    },
    [seekTo, isAuthenticated, onRequireAccount]
  );

  const setVolume = useCallback(
    (vol: number) => {
      if (!isAuthenticated) {
        onRequireAccount('Create a free account to unlock full player controls!');
        return;
      }
      const clamped = Math.max(0, Math.min(1, vol));
      setVolumeState(clamped);
      setIsMuted(clamped === 0);
      if (audioRef.current) {
        audioRef.current.volume = clamped;
      }
      try {
        localStorage.setItem(VOLUME_STORAGE_KEY, String(clamped));
      } catch {
        // ignore
      }
    },
    [isAuthenticated, onRequireAccount]
  );

  const toggleMute = useCallback(() => {
    if (!isAuthenticated) {
      onRequireAccount('Create a free account to unlock full player controls!');
      return;
    }
    const audio = audioRef.current;
    setIsMuted((prev) => {
      const next = !prev;
      if (audio) {
        audio.volume = next ? 0 : volume || 0.8;
      }
      return next;
    });
  }, [volume, isAuthenticated, onRequireAccount]);

  const toggleShuffle = useCallback(() => {
    if (!isAuthenticated) {
      onRequireAccount('Create a free account to shuffle tracks!');
      return;
    }
    setShuffle((s) => !s);
  }, [isAuthenticated, onRequireAccount]);

  const cycleRepeat = useCallback(() => {
    if (!isAuthenticated) {
      onRequireAccount('Create a free account to use repeat modes!');
      return;
    }
    setRepeat((r) => (r === 'all' ? 'one' : r === 'one' ? 'off' : 'all'));
  }, [isAuthenticated, onRequireAccount]);

  const setPlaybackRate = useCallback(
    (rate: number) => {
      if (!isAuthenticated) {
        onRequireAccount('Create a free account to adjust playback speed!');
        return;
      }
      setPlaybackRateState(rate);
      if (audioRef.current) {
        audioRef.current.playbackRate = rate;
      }
    },
    [isAuthenticated, onRequireAccount]
  );

  const addToQueue = useCallback(
    (song: Song) => {
      if (!isAuthenticated) {
        onRequireAccount('Create a free account to build custom play queues!');
        return;
      }
      if (!isSongPubliclyPlayable(song)) return;
      setQueue((prev) => (prev.some((s) => s.id === song.id) ? prev : [...prev, song]));
    },
    [isAuthenticated, onRequireAccount]
  );

  const removeFromQueue = useCallback((songId: string) => {
    setQueue((prev) => prev.filter((s) => s.id !== songId));
  }, []);

  // GATED for guests: Downloading
  const downloadSong = useCallback(
    async (song: Song) => {
      if (!isAuthenticated) {
        onRequireAccount('Create a free account to download songs & sermons!');
        return;
      }
      if (!isSongPubliclyPlayable(song)) return;
      try {
        const res = await fetch(song.stream_url);
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const safeName = `${song.title} - ${song.artist}`.replace(/[/\\?%*:|"<>]/g, '').trim();
        a.download = `${safeName || song.slug}.mp3`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 5000);
      } catch {
        window.open(song.stream_url, '_blank', 'noopener,noreferrer');
      }
    },
    [isAuthenticated, onRequireAccount]
  );

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onPlaying = () => {
      setIsBuffering(false);
      setIsPlaying(true);
      if (clickStartRef.current !== null) {
        const elapsed = Math.max(15, Math.round(performance.now() - clickStartRef.current));
        setStartupLatencyMs(elapsed);
        clickStartRef.current = null;
      }
    };

    const onWaiting = () => setIsBuffering(true);
    const onCanPlay = () => setIsBuffering(false);
    const onPause = () => setIsPlaying(false);

    const onTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
      if (audio.duration && Number.isFinite(audio.duration)) {
        setDuration(audio.duration);
        if (audio.buffered.length > 0) {
          const end = audio.buffered.end(audio.buffered.length - 1);
          setBufferedPercent(Math.min(100, (end / audio.duration) * 100));
        }
        if (audio.currentTime > 8 && audio.currentTime < 10) {
          const next = getNextSong(1);
          if (next) warmTrack(next);
        }
        // Automatically save Sermon / long-audio progress every ~3 seconds for logged-in users
        if (
          userId &&
          currentSong &&
          (currentSong.category === 'Sermons' || audio.duration >= 240)
        ) {
          const nowMs = Date.now();
          if (nowMs - lastProgressSaveMsRef.current >= 3000) {
            lastProgressSaveMsRef.current = nowMs;
            saveSermonProgress(userId, currentSong.id, audio.currentTime, audio.duration);
          }
        }
      }
    };

    const onLoadedMetadata = () => {
      if (audio.duration && Number.isFinite(audio.duration)) {
        setDuration(audio.duration);
      }
      if (pendingSeekSecRef.current !== null && pendingSeekSecRef.current > 0) {
        try {
          audio.currentTime = pendingSeekSecRef.current;
          pendingSeekSecRef.current = null;
        } catch {
          // ignore
        }
      }
    };

    const onEnded = () => {
      if (userId && currentSong) {
        clearSermonProgress(userId, currentSong.id);
      }
      if (isAuthenticated && repeat === 'one' && currentSong) {
        audio.currentTime = 0;
        audio.play().catch(() => {});
        return;
      }
      playNext();
    };

    const onError = () => {
      setIsBuffering(false);
      setIsPlaying(false);
    };

    audio.addEventListener('playing', onPlaying);
    audio.addEventListener('waiting', onWaiting);
    audio.addEventListener('canplay', onCanPlay);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('loadedmetadata', onLoadedMetadata);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('error', onError);

    return () => {
      audio.removeEventListener('playing', onPlaying);
      audio.removeEventListener('waiting', onWaiting);
      audio.removeEventListener('canplay', onCanPlay);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('error', onError);
    };
  }, [currentSong, repeat, playNext, getNextSong, warmTrack, isAuthenticated, userId]);

  useEffect(() => {
    if (!('mediaSession' in navigator) || !currentSong) return;
    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: currentSong.title,
        artist: currentSong.artist,
        album: `Gyidi Nwom • ${currentSong.choir_group}`,
        artwork: currentSong.cover_url
          ? [{ src: currentSong.cover_url, sizes: '512x512', type: 'image/png' }]
          : [{ src: '/logo-mark.png', sizes: '256x256', type: 'image/png' }],
      });

      navigator.mediaSession.setActionHandler('play', togglePlay);
      navigator.mediaSession.setActionHandler('pause', togglePlay);
      navigator.mediaSession.setActionHandler('previoustrack', playPrev);
      navigator.mediaSession.setActionHandler('nexttrack', playNext);
      navigator.mediaSession.setActionHandler(
        'seekbackward',
        isAuthenticated ? () => skipBy(-15) : null
      );
      navigator.mediaSession.setActionHandler(
        'seekforward',
        isAuthenticated ? () => skipBy(15) : null
      );
      navigator.mediaSession.setActionHandler(
        'seekto',
        isAuthenticated
          ? (details) => {
              if (typeof details.seekTime === 'number') seekTo(details.seekTime);
            }
          : null
      );
    } catch {
      // ignore
    }
  }, [currentSong, togglePlay, playPrev, playNext, skipBy, seekTo, isAuthenticated]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return;
      }
      if (e.code === 'Space' && currentSong) {
        e.preventDefault();
        togglePlay();
      } else if (e.code === 'ArrowRight' && currentSong) {
        e.preventDefault();
        skipBy(10);
      } else if (e.code === 'ArrowLeft' && currentSong) {
        e.preventDefault();
        skipBy(-10);
      } else if (e.key.toLowerCase() === 'm' && currentSong) {
        toggleMute();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [currentSong, togglePlay, skipBy, toggleMute]);

  return (
    <PlayerContext.Provider
      value={{
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
        recentlyPlayedIds,
        isSongLockedForGuest,
        requireAccount,
        playSong,
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
        warmTrack,
        addToQueue,
        removeFromQueue,
        downloadSong,
      }}
    >
      {children}
    </PlayerContext.Provider>
  );
};

export function usePlayer() {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error('usePlayer must be used inside PlayerProvider');
  return ctx;
}
