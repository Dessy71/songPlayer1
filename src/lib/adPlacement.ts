import type { NavTab } from '../types/music';

/**
 * Decides which screens are allowed to serve Google ads.
 *
 * AdSense policy prohibits Google-served ads on screens that have no publisher
 * content or only low-value content, that are under construction, or that exist
 * for alerts, navigation or other behavioural purposes.
 *
 * The ad script used to be injected into document.head once and then left
 * there. Because this is a single-page app the script never unloaded, and with
 * Auto Ads enabled Google placed units on whatever the viewer happened to have
 * open - Premium, Messages, the admin dashboard, an empty Playlists tab. That
 * is what produced the policy violation.
 *
 * Ad serving is now decided per screen, and the script is physically removed
 * from the page whenever the viewer moves somewhere ads are not allowed.
 */

/**
 * Screens whose purpose is the published catalogue itself: song, album,
 * artiste, choir and sermon listings. These carry real content of their own.
 */
const CATALOGUE_TABS: ReadonlySet<NavTab> = new Set<NavTab>([
  'discover',
  'trending',
  'new-music',
  'albums',
  'artistes',
  'browse',
  'choirs',
  'sermons',
]);

/**
 * True for a screen that is allowed to show ads.
 *
 * Everything not in CATALOGUE_TABS is excluded on purpose:
 *
 *   premium, messages       - transactional / behavioural screens
 *   admin, artiste-studio   - tooling, not publisher content
 *   live                    - empty whenever nothing is streaming
 *   favorites, playlists,
 *     recent, offline       - a viewer's own library, which is empty until they
 *                             have accumulated something. An empty library is
 *                             exactly what the policy calls low-value content.
 */
export function isAdSafeTab(tab: NavTab | null | undefined): boolean {
  if (!tab) return false;
  return CATALOGUE_TABS.has(tab);
}

/**
 * The full decision.
 *
 * `hasPublishedContent` covers the remaining edge case: a catalogue screen that
 * is still loading, or that has nothing to show yet, is still a screen without
 * content. Without this the home tab would serve an ad above an empty feed
 * during the first few seconds of every cold load.
 */
export function canServeAds(params: {
  tab: NavTab | null | undefined;
  hasPublishedContent: boolean;
}): boolean {
  return isAdSafeTab(params.tab) && params.hasPublishedContent;
}

/** Exposed for tests and for the admin panel. */
export function adSafeTabs(): NavTab[] {
  return [...CATALOGUE_TABS];
}
