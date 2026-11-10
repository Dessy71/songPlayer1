import { supabase } from './supabase';
import { Song } from '../types/music';
import { resolveAudioUrl } from './audioCdn';

const AUDIO_CACHE_NAME = 'gyidi-offline-audio-v1';

function storageKeyForUser(userId: string | null | undefined): string {
  return `gyidi_offline_profile_v2_${userId || 'none'}`;
}

/**
 * Reads the profile-scoped Offline Saved song IDs from localStorage.
 * Audio stays strictly inside the app's internal CacheStorage for in-app offline
 * playback and NEVER downloads an .mp3 file to the user's device storage/Downloads folder.
 */
export function getOfflineSavedIds(userId?: string | null): Set<string> {
  if (!userId) return new Set();
  try {
    const raw = localStorage.getItem(storageKeyForUser(userId));
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return new Set();
  }
}

function persistOfflineSavedIds(userId: string, ids: Set<string>) {
  try {
    localStorage.setItem(storageKeyForUser(userId), JSON.stringify(Array.from(ids)));
  } catch {
    // ignore storage quota
  }
}

/**
 * Syncs the user's profile-bound offline library with Supabase `public.offline_library`
 * and ensures locally cached streams match the profile's saved list.
 */
export async function syncProfileOfflineLibrary(userId: string): Promise<Set<string>> {
  const localIds = getOfflineSavedIds(userId);
  try {
    const { data, error } = await supabase
      .from('offline_library')
      .select('song_id')
      .eq('user_id', userId);
    if (!error && data) {
      const merged = new Set<string>(localIds);
      for (const row of data as Array<{ song_id: string }>) {
        merged.add(row.song_id);
      }
      persistOfflineSavedIds(userId, merged);
      return merged;
    }
  } catch {
    // Offline mode: fall back to cached profile IDs
  }
  return localIds;
}

/**
 * Saves a song to the user's Gyidi Nnwom profile for in-app offline listening ONLY.
 * Does NOT trigger a file download to the user's phone/computer.
 */
export async function saveSongForOffline(song: Song, userId: string): Promise<void> {
  if (!userId) {
    throw new Error('Sign in to save songs to your profile for offline listening.');
  }
  if (!('caches' in window)) {
    throw new Error('In-app offline audio storage is not supported in this browser.');
  }
  const cache = await caches.open(AUDIO_CACHE_NAME);
  // Fetch from the CDN when one is configured, but always cache under the
  // canonical Supabase URL so already-saved tracks keep working even if the
  // CDN base is changed or switched off later.
  const res = await fetch(resolveAudioUrl(song.stream_url), { mode: 'cors' });
  if (!res.ok) {
    throw new Error('Could not cache audio stream for offline listening.');
  }
  await cache.put(song.stream_url, res.clone());

  const ids = getOfflineSavedIds(userId);
  ids.add(song.id);
  persistOfflineSavedIds(userId, ids);

  try {
    await supabase.from('offline_library').upsert({
      user_id: userId,
      song_id: song.id,
    });
  } catch {
    // ignore if network drops right after caching
  }
}

export async function removeSongFromOffline(song: Song, userId: string): Promise<void> {
  if (!userId) return;
  if ('caches' in window) {
    try {
      const cache = await caches.open(AUDIO_CACHE_NAME);
      await cache.delete(song.stream_url);
    } catch {
      // ignore
    }
  }
  const ids = getOfflineSavedIds(userId);
  ids.delete(song.id);
  persistOfflineSavedIds(userId, ids);

  try {
    await supabase
      .from('offline_library')
      .delete()
      .match({ user_id: userId, song_id: song.id });
  } catch {
    // ignore if offline
  }
}

export async function resolvePlayableAudioUrl(song: Song): Promise<string> {
  if (!('caches' in window)) return resolveAudioUrl(song.stream_url);
  try {
    const cache = await caches.open(AUDIO_CACHE_NAME);
    const cached = await cache.match(song.stream_url, { ignoreVary: true });
    if (cached) {
      const blob = await cached.blob();
      return URL.createObjectURL(blob);
    }
  } catch {
    // fallback to stream_url
  }
  return resolveAudioUrl(song.stream_url);
}
