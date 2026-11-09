import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const context = vm.createContext({ console });
const source = ts.transpileModule(
  fs.readFileSync('src/lib/artisteMatching.ts', 'utf8'),
  { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }
).outputText;
const m = new vm.SourceTextModule(source, { context });
await m.link(() => {
  throw new Error('artisteMatching must not import anything');
});
await m.evaluate();

const { normaliseCredit, findArtisteCandidates, isAmbiguous, hasExactMatch } = m.namespace;

const profile = (id, stageName, displayName = null, role = 'artiste') => ({
  id,
  stage_name: stageName,
  display_name: displayName,
  role,
});

test('case and stray whitespace do not matter', () => {
  assert.equal(normaliseCredit('  Obogu   SETH '), 'obogu seth');
  assert.equal(normaliseCredit(null), '');
  assert.equal(normaliseCredit(undefined), '');
});

test('an exact match is found and ranked above a partial one', () => {
  const profiles = [
    profile('1', 'Obogu Seth'),
    profile('2', 'Obogu Seth Junior'),
  ];
  const candidates = findArtisteCandidates('obogu seth', profiles);

  assert.equal(candidates.length, 2);
  assert.equal(candidates[0].profile.id, '1');
  assert.equal(candidates[0].kind, 'exact');
  assert.equal(candidates[1].kind, 'partial', 'the longer name is only a partial hit');
});

test('a display name counts when there is no stage name', () => {
  const candidates = findArtisteCandidates('KNUST SACSU', [profile('1', null, 'KNUST SACSU')]);
  assert.equal(candidates.length, 1);
  assert.equal(candidates[0].kind, 'exact');
  assert.equal(candidates[0].matchedOn, 'KNUST SACSU');
});

test('reversed word order does not match, because that would invent authorship', () => {
  const candidates = findArtisteCandidates('Seth Obogu', [profile('1', 'Obogu Seth')]);
  assert.equal(candidates.length, 0);
});

test('very short credits are not matched by containment', () => {
  // Two characters would otherwise match a large share of the catalogue.
  const candidates = findArtisteCandidates('Al', [profile('1', 'Alhaji Kwame')]);
  assert.equal(candidates.length, 0);
});

test('a short but complete name still matches exactly', () => {
  const candidates = findArtisteCandidates('Kwame', [profile('1', 'Kwame')]);
  assert.equal(candidates.length, 1);
  assert.equal(candidates[0].kind, 'exact');
});

test('an empty credit produces no candidates rather than every profile', () => {
  const profiles = [profile('1', 'Obogu Seth'), profile('2', 'KNUST SACSU')];
  assert.equal(findArtisteCandidates('', profiles).length, 0);
  assert.equal(findArtisteCandidates('   ', profiles).length, 0);
  assert.equal(findArtisteCandidates(null, profiles).length, 0);
});

test('two profiles sharing a name is reported as ambiguous, not silently resolved', () => {
  const candidates = findArtisteCandidates('Obogu Seth', [
    profile('1', 'Obogu Seth'),
    profile('2', 'Obogu Seth'),
  ]);

  assert.equal(candidates.length, 2);
  assert.ok(isAmbiguous(candidates), 'the admin must be told to choose');
  assert.ok(hasExactMatch(candidates));
});

test('listeners are never suggested as the owner of a release', () => {
  const candidates = findArtisteCandidates('Kwesi', [
    profile('1', 'Kwesi', null, 'listener'),
    profile('2', 'Kwesi', null, 'artiste'),
  ]);

  assert.equal(candidates.length, 1);
  assert.equal(candidates[0].profile.id, '2');
});

test('one profile matches at most once even when both its names hit', () => {
  const candidates = findArtisteCandidates('Obogu Seth', [
    profile('1', 'Obogu Seth', 'Obogu Seth'),
  ]);
  assert.equal(candidates.length, 1, 'stage and display name are not two candidates');
});
