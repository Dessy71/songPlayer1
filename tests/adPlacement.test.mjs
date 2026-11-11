import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

/**
 * Regression cover for the AdSense policy violation: "Google-served ads on
 * screens without publisher content".
 *
 * The ad script used to be injected once and left in document.head for the
 * whole session. Since this is a single-page app it never unloaded, so Auto Ads
 * could place units on Premium, Messages, the admin dashboard and empty library
 * tabs - none of which are publisher content.
 */

const context = vm.createContext({ console });
const source = ts.transpileModule(fs.readFileSync('src/lib/adPlacement.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const m = new vm.SourceTextModule(source, { context });
await m.link(() => {
  // Type-only imports are erased, so this module must have no runtime imports.
  throw new Error('adPlacement must not import anything at runtime');
});
await m.evaluate();

const { isAdSafeTab, canServeAds, adSafeTabs } = m.namespace;

/** Screens whose purpose is the published catalogue. */
const CATALOGUE = [
  'discover', 'trending', 'new-music', 'albums',
  'artistes', 'browse', 'choirs', 'sermons',
];

/** Behavioural, tooling, or empty-until-used. Ads are not allowed on any. */
const NOT_SAFE = [
  'premium', 'messages', 'admin', 'artiste-studio', 'live',
  'favorites', 'playlists', 'recent', 'offline', 'upcoming',
];

test('every catalogue screen may serve ads', () => {
  for (const tab of CATALOGUE) {
    assert.equal(isAdSafeTab(tab), true, `${tab} is publisher content`);
  }
});

test('behavioural, tooling and empty-until-used screens may not', () => {
  for (const tab of NOT_SAFE) {
    assert.equal(isAdSafeTab(tab), false, `${tab} must not serve ads`);
  }
});

test('the two lists cover every tab, so a new tab forces a decision', () => {
  const ALL_NAV_TABS = [
    'discover', 'trending', 'new-music', 'upcoming', 'live', 'albums',
    'artistes', 'browse', 'choirs', 'sermons', 'favorites', 'playlists',
    'recent', 'offline', 'premium', 'messages', 'artiste-studio', 'admin',
  ];
  assert.equal(ALL_NAV_TABS.length, 18);
  assert.deepEqual([...CATALOGUE, ...NOT_SAFE].sort(), [...ALL_NAV_TABS].sort());
  assert.equal(adSafeTabs().length, CATALOGUE.length);
});

test('serving needs a safe screen AND real content', () => {
  assert.equal(canServeAds({ tab: 'discover', hasPublishedContent: true }), true);
  assert.equal(canServeAds({ tab: 'discover', hasPublishedContent: false }), false);
  assert.equal(canServeAds({ tab: 'premium', hasPublishedContent: true }), false);
  assert.equal(canServeAds({ tab: 'premium', hasPublishedContent: false }), false);
});

test('an empty catalogue blocks ads even on a catalogue screen', () => {
  // A cold load has no songs yet; an ad above an empty feed is the exact
  // "screen without content" the policy calls out.
  assert.equal(canServeAds({ tab: 'discover', hasPublishedContent: false }), false);
  assert.equal(canServeAds({ tab: 'sermons', hasPublishedContent: false }), false);
});

test('a missing or unknown tab never serves ads', () => {
  assert.equal(isAdSafeTab(null), false);
  assert.equal(isAdSafeTab(undefined), false);
  assert.equal(isAdSafeTab(''), false);
  assert.equal(isAdSafeTab('not-a-real-tab'), false);
  assert.equal(canServeAds({ tab: null, hasPublishedContent: true }), false);
  assert.equal(canServeAds({ tab: undefined, hasPublishedContent: true }), false);
});
