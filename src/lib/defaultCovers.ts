/**
 * Default cover art for releases that have none of their own.
 *
 * Roughly 97% of the catalogue (287 of 296 songs) has an empty `cover_url`, and
 * those releases used to fall back to a generated gradient with the title's
 * initials on it. That generated tile is being retired: every release without
 * artwork now shows one of three real covers instead, until an artiste uploads
 * their own.
 *
 * The artwork lives in `public/default-covers/`, so it ships with the app and
 * is served from the same CDN as the site - no Supabase Storage egress.
 */

const DEFAULT_COVER_URLS = [
  '/default-covers/cover-1.jpg',
  '/default-covers/cover-2.jpg',
  '/default-covers/cover-3.jpg',
] as const;

/**
 * FNV-1a. Chosen over `Math.random()` on purpose: the choice has to survive
 * re-renders, or a song's artwork would flicker to a different image every
 * time its parent renders. Hashing makes the pick stable per release while
 * still spreading the catalogue evenly across the three covers.
 */
function hashString(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/**
 * The seed that decides which default cover a release gets.
 *
 * Callers MUST pass the same seed everywhere for the same release, otherwise a
 * song can show one cover in the list and a different one on the lock screen.
 * Title is used because it is the only identifying field every call site has.
 */
export function coverSeed(title?: string | null): string {
  return (title ?? '').trim().toLowerCase();
}

/** Which default cover a release lands on. Stable for a given seed. */
export function defaultCoverFor(seed: string | null | undefined): string {
  if (!seed) return DEFAULT_COVER_URLS[0];
  return DEFAULT_COVER_URLS[hashString(seed) % DEFAULT_COVER_URLS.length];
}

/**
 * The URL to actually render: the release's own artwork when it has one,
 * otherwise its default cover.
 */
export function resolveCoverUrl(
  coverUrl?: string | null,
  seed?: string | null
): string {
  const own = coverUrl?.trim();
  return own ? own : defaultCoverFor(coverSeed(seed));
}

/** Exposed for tests. */
export function defaultCoverUrls(): readonly string[] {
  return DEFAULT_COVER_URLS;
}
