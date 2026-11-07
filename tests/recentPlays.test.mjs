import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

/**
 * recentPlays.ts touches only localStorage, so a bare context is enough.
 * `seed` populates the store before the module is evaluated.
 */
async function load(seed = {}) {
  const storage = new Map(Object.entries(seed));
  const localStorage = {
    getItem: (key) => (storage.has(key) ? storage.get(key) : null),
    setItem: (key, value) => storage.set(key, String(value)),
    removeItem: (key) => storage.delete(key),
  };
  const context = vm.createContext({ localStorage, JSON, Array });
  const source = ts.transpileModule(fs.readFileSync('src/lib/recentPlays.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const module = new vm.SourceTextModule(source, { context });
  await module.link(() => {
    throw new Error('recentPlays must not import anything');
  });
  await module.evaluate();
  return { api: module.namespace, storage };
}

const UID = '11111111-2222-3333-4444-555555555555';
// Spelled out rather than read off the module: these seeds are built before the
// module namespace exists, and hard-coding them also pins the real key format.
const LEGACY_KEY = 'gyidi_recent_ids_v2';
const keyFor = (uid) => `gyidi_recent_ids_v2_${uid}`;

/** Arrays built inside the vm carry a foreign prototype, so normalise them. */
const host = (value) => JSON.parse(JSON.stringify(value));

test('the cache key is scoped per account', async () => {
  const { api } = await load();
  assert.equal(api.LEGACY_RECENT_STORAGE_KEY, LEGACY_KEY);
  assert.equal(api.recentStorageKey(UID), keyFor(UID));
  assert.equal(api.recentStorageKey(null), 'gyidi_recent_ids_v2_guest');
  assert.equal(api.recentStorageKey(undefined), 'gyidi_recent_ids_v2_guest');
  // The point of the change: two accounts must never collide.
  assert.notEqual(api.recentStorageKey('a'), api.recentStorageKey('b'));
});

test('two accounts on one browser keep separate lists', async () => {
  const { api } = await load();
  api.writeRecentCache('aaa', ['song-1']);
  api.writeRecentCache('bbb', ['song-2']);
  assert.deepEqual(host(api.readRecentCache('aaa')), ['song-1']);
  assert.deepEqual(host(api.readRecentCache('bbb')), ['song-2']);
});

test('a legacy list is adopted once and then cleared', async () => {
  const { api, storage } = await load({
    [LEGACY_KEY]: JSON.stringify(['old-1', 'old-2']),
  });

  assert.deepEqual(host(api.loadRecentCache(UID)), ['old-1', 'old-2']);
  // Moved into the account's own key...
  assert.deepEqual(host(api.readRecentCache(UID)), ['old-1', 'old-2']);
  // ...and removed, so it can never be adopted a second time.
  assert.equal(storage.has(LEGACY_KEY), false);
  assert.deepEqual(host(api.loadRecentCache(UID)), ['old-1', 'old-2']);
});

test('a legacy list is not adopted once the account has its own', async () => {
  const { api } = await load({
    [LEGACY_KEY]: JSON.stringify(['old-1']),
    [keyFor(UID)]: JSON.stringify(['mine-1']),
  });
  assert.deepEqual(host(api.loadRecentCache(UID)), ['mine-1']);
});

test('a corrupt or non-array legacy list is discarded, not thrown', async () => {
  for (const bad of ['not json', '{"a":1}', '"a string"']) {
    const { api, storage } = await load({ [LEGACY_KEY]: bad });
    assert.deepEqual(host(api.loadRecentCache(UID)), []);
    assert.equal(storage.has(LEGACY_KEY), false);
  }
});

test('non-string ids are dropped from a legacy list', async () => {
  const { api } = await load({
    [LEGACY_KEY]: JSON.stringify(['ok', 7, null, 'also-ok']),
  });
  assert.deepEqual(host(api.loadRecentCache(UID)), ['ok', 'also-ok']);
});

test('merge keeps device order first, de-duplicates and caps the list', async () => {
  const { api } = await load();
  assert.equal(api.RECENT_LIMIT, 24);
  assert.deepEqual(host(api.mergeRecent(['a', 'b'], ['b', 'c', 'a'])), ['a', 'b', 'c']);
  assert.deepEqual(host(api.mergeRecent([], [])), []);

  // Remote-only entries still arrive when the device knows nothing.
  assert.deepEqual(host(api.mergeRecent([], ['x', 'y'])), ['x', 'y']);

  const long = Array.from({ length: 60 }, (_, i) => `s${i}`);
  assert.equal(api.mergeRecent(long, []).length, api.RECENT_LIMIT);
});
