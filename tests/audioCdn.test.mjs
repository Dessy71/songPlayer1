import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const context = vm.createContext({ console });
const source = ts.transpileModule(fs.readFileSync('src/lib/audioCdn.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const m = new vm.SourceTextModule(source, { context });
await m.link(() => {
  throw new Error('audioCdn must not import anything');
});
await m.evaluate();

const { rewriteAudioUrl, resolveAudioUrl, isAudioCdnEnabled } = m.namespace;

const SONG =
  'https://neicfighjkzokoxojboz.supabase.co/storage/v1/object/public/songs/tracks/203-bogu-gyata-anum.mp3';
const CDN = 'https://cdn.example.com';

test('with no CDN base the stored URL is returned untouched', () => {
  assert.equal(rewriteAudioUrl(SONG, ''), SONG);
  assert.equal(rewriteAudioUrl(SONG, '   '), SONG);
});

test('a Supabase storage URL is rewritten to the CDN bucket root', () => {
  assert.equal(rewriteAudioUrl(SONG, CDN), 'https://cdn.example.com/tracks/203-bogu-gyata-anum.mp3');
});

test('a trailing slash on the base does not produce a double slash', () => {
  assert.equal(rewriteAudioUrl(SONG, `${CDN}/`), 'https://cdn.example.com/tracks/203-bogu-gyata-anum.mp3');
  assert.equal(rewriteAudioUrl(SONG, `${CDN}///`), 'https://cdn.example.com/tracks/203-bogu-gyata-anum.mp3');
});

test('the bucket and storage prefix are stripped, not carried over', () => {
  const out = rewriteAudioUrl(SONG, CDN);
  assert.ok(!out.includes('/songs/'), 'bucket segment should be stripped');
  assert.ok(!out.includes('/storage/'), 'storage prefix should be stripped');
});

test('any bucket is handled, not just songs', () => {
  const cover =
    'https://neicfighjkzokoxojboz.supabase.co/storage/v1/object/public/covers/art/x.png';
  assert.equal(rewriteAudioUrl(cover, CDN), 'https://cdn.example.com/art/x.png');
});

test('URLs that are not Supabase storage objects are left alone', () => {
  const other = 'https://example.com/audio/track.mp3';
  assert.equal(rewriteAudioUrl(other, CDN), other);
});

test('a query string survives the rewrite', () => {
  assert.equal(
    rewriteAudioUrl(`${SONG}?download=1`, CDN),
    'https://cdn.example.com/tracks/203-bogu-gyata-anum.mp3?download=1'
  );
});

test('nested object paths are preserved exactly', () => {
  const deep =
    'https://neicfighjkzokoxojboz.supabase.co/storage/v1/object/public/songs/a/b/c/d.mp3';
  assert.equal(rewriteAudioUrl(deep, CDN), 'https://cdn.example.com/a/b/c/d.mp3');
});

test('empty, null and undefined input never throw', () => {
  assert.equal(rewriteAudioUrl('', CDN), '');
  assert.equal(rewriteAudioUrl(null, CDN), null);
  assert.equal(rewriteAudioUrl(undefined, CDN), undefined);
  assert.equal(resolveAudioUrl(null), '');
  assert.equal(resolveAudioUrl(undefined), '');
});

test('the CDN is off unless the env var is set, so default behaviour is unchanged', () => {
  assert.equal(isAudioCdnEnabled(), false);
  assert.equal(resolveAudioUrl(SONG), SONG, 'no env var means a no-op passthrough');
});
