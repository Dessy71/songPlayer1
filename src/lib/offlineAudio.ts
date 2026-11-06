import { Song } from '../types/music';

const AUDIO_CACHE_NAME = 'gyidi-offline-audio-v1';
const OFFLINE_META_KEY = 'gyidi_offline_saved_ids_v1';

export function getOfflineSavedIds(): Set<string> {
  try {
    const raw = localStorage.getItem(OFFLINE_META_KEY);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return new Set();
  }
}

function persistOfflineSavedIds(ids: Set<string>) {
  try {
    localStorage.setItem(OFFLINE_META_KEY, JSON.stringify(Array.from(ids)));
  } catch {
    // ignore storage quota
  }
}

export async function saveSongForOffline(song: Song): Promise<void> {
  if (!('caches' in window)) {
    throw new Error('Offline audio caching is not supported in this browser.');
  }
  const cache = await caches.open(AUDIO_CACHE_NAME);
  const res = await fetch(song.stream_url, { mode: 'cors' });
  if (!res.ok) {
    throw new Error('Could not download audio for offline playback.');
  }
  await cache.put(song.stream_url, res.clone());
  const ids = getOfflineSavedIds();
  ids.add(song.id);
  persistOfflineSavedIds(ids);
}

export async function removeSongFromOffline(song: Song): Promise<void> {
  if ('caches' in window) {
    const cache = await caches.open(AUDIO_CACHE_NAME);
    await cache.delete(song.stream_url);
  }
  const ids = getOfflineSavedIds();
  ids.delete(song.id);
  persistOfflineSavedIds(ids);
}

export async function resolvePlayableAudioUrl(song: Song): Promise<string> {
  if (!('caches' in window)) return song.stream_url;
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
  return song.stream_url;
}
