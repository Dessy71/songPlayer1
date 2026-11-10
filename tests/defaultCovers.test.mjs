import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const context = vm.createContext({ console });
const source = ts.transpileModule(fs.readFileSync('src/lib/defaultCovers.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const m = new vm.SourceTextModule(source, { context });
await m.link(() => {
  throw new Error('defaultCovers must not import anything');
});
await m.evaluate();

const { coverSeed, defaultCoverFor, resolveCoverUrl, defaultCoverUrls } = m.namespace;

const URLS = defaultCoverUrls();

test('there are three default covers and they are distinct', () => {
  assert.equal(URLS.length, 3);
  assert.equal(new Set(URLS).size, 3);
  for (const url of URLS) {
    assert.match(url, /^\/default-covers\/cover-\d\.jpg$/);
  }
});

test('a release with its own artwork keeps it', () => {
  const own = 'https://neicfighjkzokoxojboz.supabase.co/storage/v1/object/public/covers/x.png';
  assert.equal(resolveCoverUrl(own, 'Anything'), own);
});

test('null, empty and whitespace-only cover_url all count as missing', () => {
  const expected = defaultCoverFor(coverSeed('Amen'));
  assert.equal(resolveCoverUrl('', 'Amen'), expected);
  assert.equal(resolveCoverUrl('   ', 'Amen'), expected);
  assert.equal(resolveCoverUrl(null, 'Amen'), expected);
  assert.equal(resolveCoverUrl(undefined, 'Amen'), expected);
});

test('the pick is stable, so artwork does not flicker between re-renders', () => {
  // The whole reason this is a hash and not Math.random(): a component renders
  // many times, and a random pick would swap the image on every one.
  const first = resolveCoverUrl(null, 'Onyame Wo Tumi');
  for (let i = 0; i < 50; i += 1) {
    assert.equal(resolveCoverUrl(null, 'Onyame Wo Tumi'), first);
  }
  assert.ok(URLS.includes(first));
});

test('the seed ignores case and surrounding whitespace', () => {
  assert.equal(coverSeed('  Onyame Wo Tumi  '), 'onyame wo tumi');
  assert.equal(
    resolveCoverUrl(null, 'onyame wo tumi'),
    resolveCoverUrl(null, '  ONYAME WO TUMI ')
  );
});

test('a missing seed does not throw and stays deterministic', () => {
  assert.equal(resolveCoverUrl(null, null), resolveCoverUrl(null, undefined));
  assert.equal(resolveCoverUrl(null, ''), URLS[0]);
  assert.ok(URLS.includes(resolveCoverUrl(null, null)));
});

test('a realistic catalogue spreads across all three covers', () => {
  const titles = [];
  for (let i = 0; i < 300; i += 1) titles.push(`Song Number ${i} - Gyidi Nnwom`);

  const counts = new Map(URLS.map((url) => [url, 0]));
  for (const title of titles) {
    const pick = resolveCoverUrl(null, title);
    counts.set(pick, counts.get(pick) + 1);
  }

  for (const url of URLS) {
    assert.ok(counts.get(url) > 0, `${url} should be used at least once`);
    assert.ok(
      counts.get(url) > titles.length / 8,
      `${url} looks under-used: ${counts.get(url)} of ${titles.length}`
    );
  }
});

test('a handful of ordinary titles do not all collapse onto one cover', () => {
  const picks = new Set(
    ['Amen', 'Awurade', 'Onyame', 'Gyidi', 'Nnwom', 'Hallelujah', 'Hosanna', 'Emmanuel'].map(
      (title) => resolveCoverUrl(null, title)
    )
  );
  assert.ok(picks.size >= 2, 'distinct titles should not all share one cover');
});
