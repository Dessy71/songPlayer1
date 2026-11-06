export interface SavedTrackProgress {
  songId: string;
  positionSec: number;
  durationSec: number;
  updatedAt: number;
}

const PROGRESS_KEY_PREFIX = 'gyidi_sermon_progress_v1_';

export function getSermonProgressMap(userId?: string | null): Record<string, SavedTrackProgress> {
  try {
    const raw = localStorage.getItem(`${PROGRESS_KEY_PREFIX}${userId || 'guest'}`);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, SavedTrackProgress>;
  } catch {
    return {};
  }
}

export function saveSermonProgress(
  userId: string | null | undefined,
  songId: string,
  positionSec: number,
  durationSec: number
) {
  if (!userId || durationSec <= 0) return;
  try {
    const map = getSermonProgressMap(userId);
    // If near completion (>= 96%), clear saved resume marker
    if (positionSec >= durationSec * 0.96 || positionSec < 12) {
      if (positionSec >= durationSec * 0.96 && map[songId]) {
        delete map[songId];
        localStorage.setItem(`${PROGRESS_KEY_PREFIX}${userId}`, JSON.stringify(map));
      }
      return;
    }

    map[songId] = {
      songId,
      positionSec: Math.floor(positionSec),
      durationSec: Math.floor(durationSec),
      updatedAt: Date.now(),
    };
    localStorage.setItem(`${PROGRESS_KEY_PREFIX}${userId}`, JSON.stringify(map));
  } catch {
    // ignore storage errors
  }
}

export function clearSermonProgress(userId: string | null | undefined, songId: string) {
  if (!userId) return;
  try {
    const map = getSermonProgressMap(userId);
    delete map[songId];
    localStorage.setItem(`${PROGRESS_KEY_PREFIX}${userId}`, JSON.stringify(map));
  } catch {
    // ignore
  }
}
