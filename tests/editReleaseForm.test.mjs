import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { JSDOM } from 'jsdom';
import * as esbuild from 'esbuild';

/**
 * Regression cover for the release editor wiping itself while you type.
 *
 * The form re-synced from its props on every render, and the modal received a
 * new `albumTracks` array - often a new `song` object too - on each one. So a
 * background refresh or a clock tick threw away whatever had been typed, and
 * freshly picked cover art reverted to the old image.
 *
 * These tests render the real component and drive it the way a browser does.
 */

// --- DOM -------------------------------------------------------------------

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
  url: 'http://localhost/',
});

// React's scheduler wants a clock; a real rAF loop would keep the process
// alive after the tests finish.
dom.window.requestAnimationFrame = (cb) => setTimeout(() => cb(Date.now()), 0);
dom.window.cancelAnimationFrame = (id) => clearTimeout(id);

const assign = (key, value) => {
  Object.defineProperty(globalThis, key, { value, writable: true, configurable: true });
};

assign('window', dom.window);
assign('document', dom.window.document);
for (const key of [
  'navigator', 'Event', 'CustomEvent', 'MouseEvent', 'KeyboardEvent',
  'HTMLInputElement', 'HTMLTextAreaElement', 'Node', 'getComputedStyle',
  'requestAnimationFrame', 'cancelAnimationFrame',
]) {
  assign(key, dom.window[key]);
}
assign('IS_REACT_ACT_ENVIRONMENT', true);

// --- Bundle the harness ----------------------------------------------------

const cacheDir = path.join(process.cwd(), 'node_modules', '.cache', 'gyidi-tests');
fs.mkdirSync(cacheDir, { recursive: true });
const bundlePath = path.join(cacheDir, `edit-release-${process.pid}.mjs`);

// React stays external so the bundle stays small, which means it has to sit
// somewhere that resolves bare specifiers. node_modules/.cache is both.
const built = await esbuild.build({
  entryPoints: ['tests/fixtures/EditReleaseHarness.tsx'],
  bundle: true,
  write: false,
  format: 'esm',
  platform: 'node',
  jsx: 'automatic',
  define: { 'import.meta.env': '{}' },
  external: ['react', 'react-dom', 'react-dom/client', 'react/jsx-runtime'],
});
fs.writeFileSync(bundlePath, built.outputFiles[0].text);

const Harness = (await import(bundlePath)).default;
const React = (await import('react')).default;
const { useState } = await import('react');
const { act } = await import('react');
const { createRoot } = await import('react-dom/client');

// --- Fixtures --------------------------------------------------------------

const SONG_A = '11111111-1111-4111-8111-111111111111';
const SONG_B = '22222222-2222-4222-8222-222222222222';

const makeSong = (overrides = {}) => ({
  id: SONG_A,
  slug: 'onnyame-wo-tumi',
  title: 'Onyame Wo Tumi',
  artist: 'Obogu Seth',
  category: 'Songs',
  choir_group: 'SCG Hymns',
  cover_url: 'https://example.com/old-cover.jpg',
  storage_path: 'uploads/old.mp3',
  lyrics_text: 'Old lyrics',
  lyrics_language: 'Twi',
  lyrics_format: 'text',
  preacher_name: null,
  sermon_topic: null,
  bible_book: null,
  convention_year: null,
  ...overrides,
});

const makeAlbum = (overrides = {}) => ({
  id: '33333333-3333-4333-8333-333333333333',
  slug: 'osoro-asomdwoe',
  title: 'Osoro Asomdwoe',
  artist: 'Obogu Seth',
  artiste_id: SONG_A,
  uploaded_by: SONG_A,
  description: 'Recorded live in Kumawu',
  category: 'Songs',
  choir_group: 'SCG Hymns',
  cover_url: 'https://example.com/album-cover.jpg',
  cover_theme: 'gold',
  approval_status: 'approved',
  rejection_reason: null,
  approved_by: null,
  approved_at: null,
  is_premiere: false,
  premiere_at: null,
  submitted_at: '2026-01-01T00:00:00Z',
  published_at: '2026-01-02T00:00:00Z',
  created_at: '2026-01-01T00:00:00Z',
  ...overrides,
});

const makeTrack = (id, title, trackNumber) =>
  makeSong({ id, title, track_number: trackNumber, album_id: '33333333-3333-4333-8333-333333333333' });

// --- Mount -----------------------------------------------------------------

// The parent owns the re-render, exactly as App does, so changing what the
// modal is editing is a real prop change rather than a state nudge.
const props = { current: { song: makeSong() } };
let forceParentRender = () => {};

const Parent = () => {
  const [, setTick] = useState(0);
  forceParentRender = () => setTick((t) => t + 1);
  return React.createElement(Harness, props.current);
};

const container = document.getElementById('root');
const root = createRoot(container);
await act(async () => {
  root.render(React.createElement(Parent));
});

after(async () => {
  await act(async () => {
    root.unmount();
  });
  dom.window.close();
  // esbuild keeps a service child process alive, which would hang the suite.
  await esbuild.stop();
  fs.rmSync(bundlePath, { force: true });
});

// --- Helpers ---------------------------------------------------------------

const textInputs = () => [...container.querySelectorAll('input[type="text"]')];
const titleInput = () => textInputs()[0];
const artistInput = () => textInputs()[1];

/** Track title inputs live in their own section, so find them by heading. */
const trackInputs = () => {
  const heading = [...container.querySelectorAll('p')].find((el) =>
    (el.textContent || '').includes('Edit Track Titles')
  );
  if (!heading || !heading.parentElement) return [];
  return [...heading.parentElement.querySelectorAll('input[type="text"]')];
};

const valueSetter = Object.getOwnPropertyDescriptor(
  dom.window.HTMLInputElement.prototype,
  'value'
).set;

const setInput = async (input, value) => {
  await act(async () => {
    valueSetter.call(input, value);
    input.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
  });
};

/** Types one character at a time, the way a person does. */
const type = async (input, text) => {
  for (const char of text) {
    await setInput(input, input.value + char);
  }
};

const rerender = async () => {
  await act(async () => {
    forceParentRender();
  });
};

const showSong = async (song) => {
  props.current = { song };
  await rerender();
};

// --- Song editing ----------------------------------------------------------

test('the form loads the song being edited', () => {
  assert.equal(titleInput().value, 'Onyame Wo Tumi');
  assert.equal(artistInput().value, 'Obogu Seth');
});

test('each keystroke sticks instead of reverting on the next', async () => {
  await setInput(titleInput(), '');
  await type(titleInput(), 'Awurade');
  assert.equal(titleInput().value, 'Awurade');
});

test('typing survives a parent re-render', async () => {
  await setInput(titleInput(), 'Onyame Wo Tumi (Live)');
  await rerender();
  assert.equal(titleInput().value, 'Onyame Wo Tumi (Live)');
});

test('a background refresh that swaps in new song data does not clobber edits', async () => {
  await setInput(titleInput(), 'Edited Title');

  // fetchPlatformData() replacing every song object was the exact moment
  // edits used to disappear.
  props.current = { song: makeSong({ title: 'Whatever the database says' }) };
  await rerender();

  assert.equal(titleInput().value, 'Edited Title');
});

test('switching to a different record still loads that record', async () => {
  await showSong(makeSong({ id: SONG_B, title: 'Second Song' }));
  assert.equal(titleInput().value, 'Second Song');
});

test('closing and reopening discards edits from a cancelled attempt', async () => {
  await setInput(titleInput(), 'Abandoned edit');
  assert.equal(titleInput().value, 'Abandoned edit');

  await showSong(null);
  await showSong(makeSong({ id: SONG_B, title: 'Second Song' }));

  assert.equal(titleInput().value, 'Second Song');
});

// --- Album editing ---------------------------------------------------------

const TRACK_1 = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const TRACK_2 = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

test('album track titles survive a parent re-render', async () => {
  props.current = {
    album: makeAlbum(),
    albumTracks: [makeTrack(TRACK_1, 'Osoro', 1), makeTrack(TRACK_2, 'Asomdwoe', 2)],
  };
  await rerender();

  assert.equal(trackInputs().length, 2, 'both tracks are editable');
  await setInput(trackInputs()[0], 'Osoro (Live)');
  await rerender();

  assert.equal(trackInputs()[0].value, 'Osoro (Live)');
});

test('the album title survives a parent re-render', async () => {
  await setInput(titleInput(), 'Osoro Asomdwoe Vol. 2');
  await rerender();
  assert.equal(titleInput().value, 'Osoro Asomdwoe Vol. 2');
});

test('tracks that arrive after the form opened are still seeded', async () => {
  props.current = { album: makeAlbum(), albumTracks: [makeTrack(TRACK_1, 'Osoro', 1)] };
  await rerender();
  assert.equal(trackInputs().length, 1);

  // The full track list lands after the modal was already open.
  props.current = {
    album: makeAlbum(),
    albumTracks: [makeTrack(TRACK_1, 'Osoro', 1), makeTrack(TRACK_2, 'Asomdwoe', 2)],
  };
  await rerender();

  assert.equal(trackInputs().length, 2);
  assert.equal(trackInputs()[1].value, 'Asomdwoe', 'the late track gets its title');
});

test('seeding late tracks does not overwrite a title being edited', async () => {
  props.current = { album: makeAlbum(), albumTracks: [makeTrack(TRACK_1, 'Osoro', 1)] };
  await rerender();

  await setInput(trackInputs()[0], 'Half typed');

  props.current = {
    album: makeAlbum(),
    albumTracks: [makeTrack(TRACK_1, 'Osoro', 1), makeTrack(TRACK_2, 'Asomdwoe', 2)],
  };
  await rerender();

  assert.equal(trackInputs().length, 2);
  assert.equal(trackInputs()[0].value, 'Half typed', 'the in-progress edit is kept');
});
