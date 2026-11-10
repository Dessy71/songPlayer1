/**
 * Optional external origin for audio delivery.
 *
 * Audio normally streams straight from Supabase Storage, which means every byte
 * of every play is billed as Supabase egress — by far the largest cost of
 * running this app at scale, and the one thing that can take the platform down
 * through throttling rather than a crash.
 *
 * Setting VITE_AUDIO_CDN_BASE serves the same files from a cheaper origin (for
 * example a Cloudflare R2 bucket behind a custom domain) WITHOUT touching the
 * database: `songs.stream_url` keeps storing the Supabase URL and the rewrite
 * happens here, at read time.
 *
 * That indirection is deliberate. Because the database is never rewritten:
 *   - flipping the variable off reverts every track instantly,
 *   - there is no migration, no re-upload and no downtime,
 *   - offline caches keyed on the canonical URL survive the switch.
 *
 * Expected layout: the base points at the ROOT of the audio bucket, so
 *   https://<ref>.supabase.co/storage/v1/object/public/songs/tracks/a.mp3
 * becomes
 *   <VITE_AUDIO_CDN_BASE>/tracks/a.mp3
 */

// Optional chaining matters: `import.meta.env` only exists under Vite, and
// this module is unit-tested outside a bundler.
const CDN_BASE = (import.meta.env?.VITE_AUDIO_CDN_BASE ?? '').trim().replace(/\/+$/, '');

/** Supabase Storage public-object URLs, including the bucket segment. */
const STORAGE_PUBLIC_URL = /^https?:\/\/[^/]+\/storage\/v1\/object\/public\/[^/]+\//;

/**
 * The pure rewrite. Exported separately from `resolveAudioUrl` so the
 * transformation can be tested without re-instantiating the module with a
 * different `import.meta.env`.
 */
export function rewriteAudioUrl(streamUrl: string, cdnBase: string): string {
  const base = (cdnBase ?? '').trim().replace(/\/+$/, '');
  if (!streamUrl || !base) return streamUrl;

  const match = STORAGE_PUBLIC_URL.exec(streamUrl);
  // Anything that is not a recognisable Supabase Storage URL is left alone.
  if (!match) return streamUrl;

  // Keep the leading slash so the object path joins cleanly onto the base.
  const objectPath = streamUrl.slice(match[0].length - 1);
  return `${base}${objectPath}`;
}

/** True when audio is currently being served from an external origin. */
export function isAudioCdnEnabled(): boolean {
  return CDN_BASE.length > 0;
}

/**
 * Resolves the URL audio should actually be fetched from.
 *
 * Returns the stored URL unchanged whenever no CDN base is configured, so this
 * is safe to call everywhere and is a no-op until the variable is set.
 */
export function resolveAudioUrl(streamUrl: string | null | undefined): string {
  if (!streamUrl) return '';
  return rewriteAudioUrl(streamUrl, CDN_BASE);
}
