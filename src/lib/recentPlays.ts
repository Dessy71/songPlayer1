/**
 * Recently played: local cache plus the merge rules used when the account's own
 * copy arrives from the server.
 *
 * Kept free of React and Supabase imports so it can be unit tested directly.
 */

/** How many recently-played entries are kept, locally and on the account. */
export const RECENT_LIMIT = 24;

/**
 * The cache key used to be a single constant shared by every account on a
 * browser. Anything still stored there is adopted once, on the first run after
 * that change, so the upgrade does not look like it wiped the list.
 */
export const LEGACY_RECENT_STORAGE_KEY = 'gyidi_recent_ids_v2';

/** Cached per account, so two accounts on one browser never share a list. */
export const recentStorageKey = (userId: string | null | undefined) =>
  `gyidi_recent_ids_v2_${userId || 'guest'}`;

const onlyStrings = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.filter((id: unknown): id is string => typeof id === 'string')
    : [];

export const readRecentCache = (userId: string | null | undefined): string[] => {
  try {
    return onlyStrings(JSON.parse(localStorage.getItem(recentStorageKey(userId)) || '[]'));
  } catch {
    return [];
  }
};

export const writeRecentCache = (userId: string | null | undefined, ids: string[]) => {
  try {
    localStorage.setItem(recentStorageKey(userId), JSON.stringify(ids));
  } catch {
    // Storage can be blocked; the account copy is still authoritative.
  }
};

/**
 * Moves the pre-per-account list into this account's key. The legacy entry is
 * removed before it is parsed so it is only ever adopted once per browser,
 * even if something throws half way through.
 */
export const adoptLegacyRecentCache = (userId: string | null | undefined): string[] => {
  try {
    const legacy = localStorage.getItem(LEGACY_RECENT_STORAGE_KEY);
    if (!legacy) return [];
    localStorage.removeItem(LEGACY_RECENT_STORAGE_KEY);
    return onlyStrings(JSON.parse(legacy)).slice(0, RECENT_LIMIT);
  } catch {
    return [];
  }
};

/** Local cache, adopting the legacy list on the first run after the upgrade. */
export const loadRecentCache = (userId: string | null | undefined): string[] => {
  const stored = readRecentCache(userId);
  if (stored.length > 0) return stored;
  const legacy = adoptLegacyRecentCache(userId);
  if (legacy.length === 0) return stored;
  writeRecentCache(userId, legacy);
  return legacy;
};

/**
 * Merges a device's list with the account's copy. Device entries come first
 * because they are the freshest thing this browser knows about; whatever is
 * left keeps the account's ordering.
 */
export const mergeRecent = (local: string[], remote: string[]): string[] => {
  const merged: string[] = [];
  for (const id of [...local, ...remote]) {
    if (!merged.includes(id)) merged.push(id);
  }
  return merged.slice(0, RECENT_LIMIT);
};
