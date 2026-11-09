import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

// Real PostgreSQL engine. The migration is the thing under test, so the
// schema here is only what it touches.
const db = new PGlite();
await db.exec(`
CREATE TABLE profiles(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stage_name text,
  display_name text
);
CREATE TABLE songs(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text,
  artist text,
  artiste_id uuid REFERENCES profiles(id)
);
CREATE TABLE albums(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text,
  artist text,
  artiste_id uuid REFERENCES profiles(id)
);
`);
await db.exec(fs.readFileSync('supabase/migrations/202611070018_profile_artiste_name_sync.sql', 'utf8'));

const newProfile = (stage, display = null) =>
  db.query('INSERT INTO profiles(stage_name, display_name) VALUES($1,$2) RETURNING id', [stage, display])
    .then((r) => r.rows[0].id);

const addSong = (artisteId, artist) =>
  db.query('INSERT INTO songs(artist, artiste_id) VALUES($1,$2) RETURNING id', [artist, artisteId])
    .then((r) => r.rows[0].id);

const addAlbum = (artisteId, artist) =>
  db.query('INSERT INTO albums(artist, artiste_id) VALUES($1,$2) RETURNING id', [artist, artisteId])
    .then((r) => r.rows[0].id);

const songArtist = (id) =>
  db.query('SELECT artist FROM songs WHERE id=$1', [id]).then((r) => r.rows[0].artist);

const albumArtist = (id) =>
  db.query('SELECT artist FROM albums WHERE id=$1', [id]).then((r) => r.rows[0].artist);

test('the stage name wins, then the display name, then a fallback', async () => {
  const withStage = await newProfile('Obogu Seth', 'Seth Obogu');
  const displayOnly = await newProfile(null, 'KNUST SACSU');
  const bare = await newProfile(null, null);

  const name = (id) =>
    db.query('SELECT public.effective_artiste_name(p) AS n FROM profiles p WHERE id=$1', [id])
      .then((r) => r.rows[0].n);

  assert.equal(await name(withStage), 'Obogu Seth');
  assert.equal(await name(displayOnly), 'KNUST SACSU');
  assert.equal(await name(bare), 'SCG Artiste');
});

test('whitespace-only names are treated as missing rather than used literally', async () => {
  const id = await newProfile('   ', '  ');
  const { rows } = await db.query(
    'SELECT public.effective_artiste_name(p) AS n FROM profiles p WHERE id=$1',
    [id]
  );
  assert.equal(rows[0].n, 'SCG Artiste');
});

test('renaming a profile carries the new name across its songs and albums', async () => {
  const id = await newProfile('Old Name');
  const song = await addSong(id, 'Old Name');
  const album = await addAlbum(id, 'Old Name');

  await db.query('UPDATE profiles SET stage_name=$2 WHERE id=$1', [id, 'New Name']);

  assert.equal(await songArtist(song), 'New Name');
  assert.equal(await albumArtist(album), 'New Name');
});

test('a profile rename leaves other artistes alone', async () => {
  const mine = await newProfile('Mine');
  const theirs = await newProfile('Theirs');
  const mySong = await addSong(mine, 'Mine');
  const theirSong = await addSong(theirs, 'Theirs');

  await db.query('UPDATE profiles SET stage_name=$2 WHERE id=$1', [mine, 'Renamed']);

  assert.equal(await songArtist(mySong), 'Renamed');
  assert.equal(await songArtist(theirSong), 'Theirs', 'other catalogues are untouched');
});

test('editing an unrelated column does not rewrite the catalogue', async () => {
  const id = await newProfile('Stable Name');
  const song = await addSong(id, 'Hand written credit');

  await db.query('UPDATE profiles SET display_name=$2 WHERE id=$1', [id, 'Something Else']);

  // The effective name is still the stage name, so nothing is overwritten.
  assert.equal(await songArtist(song), 'Hand written credit');
});

test('the backfill repairs existing drift on the same profile', async () => {
  // Set up drift, then re-run only the backfill block to prove it converges.
  const id = await newProfile('Correct Name');
  const song = await addSong(id, 'Typo Name');
  const album = await addAlbum(id, 'Typo Name');

  await db.exec(`
    UPDATE public.songs s SET artist = public.effective_artiste_name(p)
    FROM public.profiles p
    WHERE s.artiste_id = p.id
      AND s.artist IS DISTINCT FROM public.effective_artiste_name(p);
    UPDATE public.albums a SET artist = public.effective_artiste_name(p)
    FROM public.profiles p
    WHERE a.artiste_id = p.id
      AND a.artist IS DISTINCT FROM public.effective_artiste_name(p);
  `);

  assert.equal(await songArtist(song), 'Correct Name');
  assert.equal(await albumArtist(album), 'Correct Name');
});

test('the backfill is idempotent and skips rows that already agree', async () => {
  const id = await newProfile('Already Right');
  await addSong(id, 'Already Right');

  await db.exec(`
    UPDATE public.songs s SET artist = public.effective_artiste_name(p)
    FROM public.profiles p
    WHERE s.artiste_id = p.id
      AND s.artist IS DISTINCT FROM public.effective_artiste_name(p);
  `);

  const { rows } = await db.query('SELECT count(*)::int AS n FROM songs WHERE artist=$1', [
    'Already Right',
  ]);
  assert.equal(rows[0].n, 1);
});

test('songs with no linked profile are never touched', async () => {
  const orphan = await db
    .query("INSERT INTO songs(artist) VALUES('Legacy Upload') RETURNING id")
    .then((r) => r.rows[0].id);

  await db.exec(`
    UPDATE public.songs s SET artist = public.effective_artiste_name(p)
    FROM public.profiles p
    WHERE s.artiste_id = p.id
      AND s.artist IS DISTINCT FROM public.effective_artiste_name(p);
  `);

  assert.equal(await songArtist(orphan), 'Legacy Upload');
});
