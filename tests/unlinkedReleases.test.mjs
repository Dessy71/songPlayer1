import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

// Real PostgreSQL engine. The migration is the thing under test.
const db = new PGlite();
await db.exec(`
CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
CREATE TABLE profiles(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stage_name text,
  display_name text,
  role text DEFAULT 'listener'
);
CREATE TABLE songs(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text,
  artist text,
  category text,
  artiste_id uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now()
);
CREATE TABLE albums(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text,
  artist text,
  category text,
  artiste_id uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now()
);
CREATE FUNCTION public.is_admin() RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT current_setting('test.isadmin', true) = 'yes' $$;
`);
await db.exec(fs.readFileSync('supabase/migrations/202611070019_unlinked_release_review.sql', 'utf8'));

const asAdmin = async () => db.exec("SET test.isadmin='yes'");
const asListener = async () => db.exec("SET test.isadmin='no'");

const newProfile = (role = 'artiste') =>
  db.query('INSERT INTO profiles(role, stage_name) VALUES($1,$2) RETURNING id', [role, 'Obogu Seth'])
    .then((r) => r.rows[0].id);

const addSong = (artist, artisteId = null) =>
  db.query('INSERT INTO songs(title, artist, artiste_id) VALUES($1,$2,$3) RETURNING id', [
    'Orphan Track', artist, artisteId,
  ]).then((r) => r.rows[0].id);

const addAlbum = (artist) =>
  db.query('INSERT INTO albums(title, artist) VALUES($1,$2) RETURNING id', ['Orphan Album', artist])
    .then((r) => r.rows[0].id);

const link = (kind, id, profileId) =>
  db.query('SELECT public.admin_link_release($1,$2,$3) AS r', [kind, id, profileId]);

/** Each test starts from an empty catalogue so counts are meaningful. */
const reset = async () => {
  await db.exec('TRUNCATE songs, albums, profiles RESTART IDENTITY CASCADE');
};

const unlinked = () =>
  db.query('SELECT * FROM public.admin_unlinked_releases()').then((r) => r.rows);

await asAdmin();

test('an admin can attribute a song to a profile', async () => {
  await reset();
  const profile = await newProfile();
  const song = await addSong('Obogu Seth');

  await link('song', song, profile);

  const { rows } = await db.query('SELECT artiste_id FROM songs WHERE id=$1', [song]);
  assert.equal(rows[0].artiste_id, profile);
});

test('attributing an album works the same way', async () => {
  await reset();
  const profile = await newProfile();
  const album = await addAlbum('Obogu Seth');

  await link('album', album, profile);

  const { rows } = await db.query('SELECT artiste_id FROM albums WHERE id=$1', [album]);
  assert.equal(rows[0].artiste_id, profile);
});

test('a non-admin cannot attribute anything', async () => {
  await reset();
  const profile = await newProfile();
  const song = await addSong('Obogu Seth');

  await asListener();
  await assert.rejects(() => link('song', song, profile), /Admins only/i);
  await asAdmin();

  const { rows } = await db.query('SELECT artiste_id FROM songs WHERE id=$1', [song]);
  assert.equal(rows[0].artiste_id, null, 'nothing was changed');
});

test('an unknown release kind is rejected rather than silently ignored', async () => {
  await reset();
  await assert.rejects(
    () => link('mixtape', '33333333-3333-4333-8333-333333333333', null),
    /Unknown release kind/i
  );
});

test('marking a release reviewed never clears an existing link', async () => {
  await reset();
  const profile = await newProfile();
  const song = await addSong('Obogu Seth', profile);

  // Reviewed with no profile chosen: the link must survive.
  await link('song', song, null);

  const { rows } = await db.query('SELECT artiste_id, artiste_link_reviewed_at FROM songs WHERE id=$1', [song]);
  assert.equal(rows[0].artiste_id, profile, 'the existing link is untouched');
  assert.ok(rows[0].artiste_link_reviewed_at, 'and it is marked reviewed');
});

test('a reviewed release drops off the review list even when still unlinked', async () => {
  await reset();
  const song = await addSong('Obogu Seth');
  assert.equal((await unlinked()).length, 1);

  await link('song', song, null);

  assert.equal((await unlinked()).length, 0);
});

test('the review list only contains unreviewed orphans', async () => {
  await reset();
  const linked = await newProfile();
  await addSong('Obogu Seth', linked); // has an owner: not an orphan
  await addSong('Nobody At All'); // orphan
  await addAlbum('Nobody At All'); // orphan album

  const rows = await unlinked();
  assert.equal(rows.length, 2);
  assert.equal(rows.filter((r) => r.release_kind === 'song').length, 1);
  assert.equal(rows.filter((r) => r.release_kind === 'album').length, 1);
  assert.ok(
    rows.every((r) => r.artist_credit === 'Nobody At All'),
    'only the unattributed rows are offered'
  );
});

test('the review list is empty for a non-admin', async () => {
  await reset();
  await addSong('Obogu Seth');
  await asListener();
  const rows = await unlinked();
  await asAdmin();

  assert.equal(rows.length, 0, 'the catalogue is not exposed to ordinary users');
});

test('link release is idempotent and reports what it did', async () => {
  await reset();
  const profile = await newProfile();
  const song = await addSong('Obogu Seth');

  const { rows } = await db.query('SELECT public.admin_link_release($1,$2,$3) AS r', [
    'song', song, profile,
  ]);
  const result = rows[0].r;

  assert.equal(result.kind, 'song');
  assert.equal(result.artiste_id, profile);
  assert.equal(result.title, 'Orphan Track');
});
