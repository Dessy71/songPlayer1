import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { Song, RepeatMode, isSongPubliclyPlayable } from '../types/music';
import { supabase } from '../lib/supabase';
import { resolvePlayableAudioUrl } from '../lib/offlineAudio';
import { applyAudioVolume, usesSystemVolume } from '../lib/audioVolume';
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
  systemVolumeControlled: boolean;
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
}

const PlayerContext = createContext<PlayerContextValue | null>(null);

const VOLUME_STORAGE_KEY = 'gyidi_volume_v2';
/** How many recently-played entries are kept, locally and on the account. */
const RECENT_LIMIT = 24;

/**
 * Recently played is cached per account. The key used to be a single constant,
 * so two accounts sharing a browser shared one list.
 */
const recentStorageKey = (userId: string | null) => `gyidi_recent_ids_v2_${userId || 'guest'}`;

const readRecentCache = (userId: string | null): string[] => {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(recentStorageKey(userId)) || '[]');
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((id: unknown): id is string => typeof id === 'string');
  } catch {
    return [];
  }
};

const writeRecentCache = (userId: string | null, ids: string[]) => {
  try {
    localStorage.setItem(recentStorageKey(userId), JSON.stringify(ids));
  } catch {
    // Storage can be blocked; the account copy is still authoritative.
  }
};

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
    try {
      const saved = Number.parseFloat(localStorage.getItem(VOLUME_STORAGE_KEY) || '');
      return Number.isFinite(saved) ? Math.min(1, Math.max(0, saved)) : 0.9;
    } catch { return 0.9; }
  });
  const [isMuted, setIsMuted] = useState(volume === 0);
  const [systemVolumeControlled] = useState(() => usesSystemVolume(navigator));
  const [shuffle, setShuffle] = useState(false);
  const [repeat, setRepeat] = useState<RepeatMode>('all');
  const [playbackRate, setPlaybackRateState] = useState(1);
  const [startupLatencyMs, setStartupLatencyMs] = useState<number | null>(null);
  const [recentlyPlayedIds, setRecentlyPlayedIds] = useState<string[]>(() => readRecentCache(userId));

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
    applyAudioVolume(audio, volume, isMuted);
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

  /**
   * Recently played is written to two places: a per-account browser cache for
   * instant paint and offline playback, and the account itself so the list
   * follows the user across devices. A failure to reach Supabase must never
   * lose the local list.
   */
  const persistRecent = useCallback((next: string[], uid: string | null) => {
    writeRecentCache(uid, next);
    if (!uid || next.length === 0) return;
    void (async () => {
      try {
        const { error } = await supabase
          .from('recent_plays')
          .upsert({ user_id: uid, song_id: next[0], played_at: new Date().toISOString() }, { onConflict: 'user_id,song_id' });
        if (error) return;
        await supabase.rpc('prune_recent_plays', { p_user_id: uid, p_keep: RECENT_LIMIT });
      } catch {
        // Offline or not migrated yet: the local cache still holds the list.
      }
    })();
  }, []);

  const recordRecent = useCallback((songId: string) => {
    if (typeof songId !== 'string' || !songId) return;
    setRecentlyPlayedIds((prev) => {
      const next = [songId, ...prev.filter((id) => id !== songId)].slice(0, RECENT_LIMIT);
      persistRecent(next, userId);
      return next;
    });
  }, [persistRecent, userId]);

  /**
   * Load the account's history whenever the signed-in user changes, and upload
   * anything this device already recorded so nothing is lost the first time an
   * existing account is used here.
   */
  const recentSyncTokenRef = useRef(0);
  useEffect(() => {
    const token = recentSyncTokenRef.current + 1;
    recentSyncTokenRef.current = token;

    // Swap to this account's own cache straight away so a previous account's
    // list is never shown while the fetch is in flight.
    const local = readRecentCache(userId);
    setRecentlyPlayedIds(local);
    if (!userId) return;

    void (async () => {
      try {
        const { data, error } = await supabase
          .from('recent_plays')
          .select('song_id')
          .eq('user_id', userId)
          .order('played_at', { ascending: false })
          .limit(RECENT_LIMIT * 3);
        if (error || token !== recentSyncTokenRef.current) return;

        const remote = (data || [])
          .map((row: { song_id?: unknown }) => row.song_id)
          .filter((id: unknown): id is string => typeof id === 'string');

        // Device history first, then whatever other devices contributed.
        const merged: string[] = [];
        for (const id of [...local, ...remote]) {
          if (!merged.includes(id)) merged.push(id);
        }
        const next = merged.slice(0, RECENT_LIMIT);
        if (token !== recentSyncTokenRef.current) return;
        setRecentlyPlayedIds(next);
        writeRecentCache(userId, next);

        // Backfill anything this device knows about that the account is missing.
        const missing = next.filter((id) => !remote.includes(id));
        if (missing.length > 0) {
          const now = Date.now();
          await supabase
            .from('recent_plays')
            .upsert(
              missing.map((song_id, index) => ({
                user_id: userId,
                song_id,
                played_at: new Date(now - index * 1000).toISOString(),
              })),
              { onConflict: 'user_id,song_id', ignoreDuplicates: true }
            );
          await supabase.rpc('prune_recent_plays', { p_user_id: userId, p_keep: RECENT_LIMIT });
        }
      } catch {
        // Offline or not migrated yet: keep the local list.
      }
    })();
  }, [userId]);

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
        applyAudioVolume(audio, volume, isMuted);

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

      resolvePlayableAudioUrl(song).then(startPlaybackWithUrl);

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
      const clamped = Number.isFinite(vol) ? Math.max(0, Math.min(1, vol)) : 0.9;
      setVolumeState(clamped);
      setIsMuted(clamped === 0);
      if (audioRef.current) {
        applyAudioVolume(audioRef.current, clamped, clamped === 0);
      }
      try {
        localStorage.setItem(VOLUME_STORAGE_KEY, String(clamped));
      } catch {
        // ignore
      }
    },
    []
  );

  const toggleMute = useCallback(() => {
    const next = !isMuted;
    const restoredVolume = !next && volume === 0 ? 0.8 : volume;
    setIsMuted(next);
    if (restoredVolume !== volume) {
      setVolumeState(restoredVolume);
      try { localStorage.setItem(VOLUME_STORAGE_KEY, String(restoredVolume)); } catch { /* Storage can be blocked. */ }
    }
    if (audioRef.current) applyAudioVolume(audioRef.current, restoredVolume, next);
  }, [volume, isMuted]);

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
        systemVolumeControlled,
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
