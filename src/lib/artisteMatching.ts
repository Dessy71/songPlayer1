import { UserProfile } from '../types/music';

/**
 * Matching an orphaned release credit back to a profile.
 *
 * A song uploaded before profiles were linked by id carries only a text
 * credit. Guessing the profile from that string is unsafe the moment two
 * artistes share a name, so this never assigns anything: it produces
 * candidates for a person to approve.
 *
 * Kept pure and separate from the UI so the rules can be tested.
 */

export type MatchKind = 'exact' | 'partial';

export interface ArtisteCandidate {
  profile: UserProfile;
  kind: MatchKind;
  /** The profile name that produced the match, e.g. the stage name. */
  matchedOn: string;
}

export interface UnlinkedRelease {
  release_kind: 'song' | 'album';
  release_id: string;
  title: string;
  artist_credit: string | null;
  category: string | null;
  created_at: string | null;
}

/**
 * Case and whitespace are not meaningful in a credit. Nothing else is
 * stripped - "Seth Obogu" and "Obogu Seth" must stay distinct, because
 * collapsing further would invent matches.
 */
export function normaliseCredit(value: string | null | undefined): string {
  return (value || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function profileNames(profile: UserProfile): string[] {
  return [profile.stage_name, profile.display_name]
    .map((name) => (name || '').trim())
    .filter(Boolean);
}

/**
 * The shortest string worth matching on. Below this, "contains" matches
 * become noise - a two-character credit would match half the catalogue.
 */
const MIN_PARTIAL_LENGTH = 4;

export function findArtisteCandidates(
  credit: string | null | undefined,
  profiles: UserProfile[]
): ArtisteCandidate[] {
  const needle = normaliseCredit(credit);
  if (!needle) return [];

  const exact: ArtisteCandidate[] = [];
  const partial: ArtisteCandidate[] = [];

  for (const profile of profiles) {
    // Only artistes and admins can plausibly own a release.
    if (profile.role !== 'artiste' && profile.role !== 'admin') continue;

    let best: { kind: MatchKind; matchedOn: string } | null = null;

    for (const name of profileNames(profile)) {
      const candidate = normaliseCredit(name);
      if (!candidate) continue;

      if (candidate === needle) {
        best = { kind: 'exact', matchedOn: name };
        break;
      }

      const shorter = Math.min(candidate.length, needle.length);
      if (
        shorter >= MIN_PARTIAL_LENGTH &&
        (candidate.includes(needle) || needle.includes(candidate)) &&
        !best
      ) {
        best = { kind: 'partial', matchedOn: name };
      }
    }

    if (!best) continue;
    (best.kind === 'exact' ? exact : partial).push({
      profile,
      kind: best.kind,
      matchedOn: best.matchedOn,
    });
  }

  return [...exact, ...partial];
}

/**
 * More than one exact hit means the credit genuinely is ambiguous - two
 * profiles share a name. The UI must make the admin choose rather than
 * quietly taking the first.
 */
export function isAmbiguous(candidates: ArtisteCandidate[]): boolean {
  return candidates.filter((c) => c.kind === 'exact').length > 1;
}

export function hasExactMatch(candidates: ArtisteCandidate[]): boolean {
  return candidates.some((c) => c.kind === 'exact');
}
