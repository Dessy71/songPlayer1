import React, { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Check, Disc3, Link2, Link2Off, Loader2, Music2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { UserProfile } from '../types/music';
import {
  UnlinkedRelease,
  findArtisteCandidates,
  hasExactMatch,
  isAmbiguous,
} from '../lib/artisteMatching';
import { SectionHeading } from './SectionHeading';

/**
 * Reviews releases that carry a text credit but no linked profile.
 *
 * These were uploaded before profiles were linked by id, so they miss out on
 * the name sync and only reach a profile through a fragile text match. The
 * point of this screen is that a person approves each attribution: guessing
 * from a name is unsafe the moment two artistes share one.
 */

interface AdminUnlinkedReleasesProps {
  profiles: UserProfile[];
  onChanged?: () => void;
}

export const AdminUnlinkedReleases: React.FC<AdminUnlinkedReleasesProps> = ({
  profiles,
  onChanged,
}) => {
  const [rows, setRows] = useState<UnlinkedRelease[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error: rpcError } = await supabase.rpc('admin_unlinked_releases');
    if (rpcError) {
      setError(rpcError.message);
    } else {
      setRows((data || []) as UnlinkedRelease[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const submit = async (row: UnlinkedRelease, profileId: string | null) => {
    setBusyId(row.release_id);
    setError(null);
    const { error: rpcError } = await supabase.rpc('admin_link_release', {
      p_release_kind: row.release_kind,
      p_release_id: row.release_id,
      p_profile_id: profileId,
    });
    setBusyId(null);
    if (rpcError) {
      setError(rpcError.message);
      return;
    }
    await load();
    onChanged?.();
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-zinc-900/50 p-6 text-sm text-zinc-400">
        <Loader2 className="h-4 w-4 animate-spin" />
        Checking for unlinked releases...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <SectionHeading
        icon={<Link2 className="w-4.5 h-4.5" />}
        title="Unlinked Releases"
        count={rows.length}
        subtitle="Carries a credit but no profile — approve an owner or mark it reviewed"
      />

      {error && (
        <p className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300">
          {error}
        </p>
      )}

      {rows.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-zinc-900/40 p-10 text-center">
          <Check className="mx-auto h-8 w-8 text-forest-400" />
          <p className="mt-3 text-sm font-bold text-white">Nothing to review</p>
          <p className="mt-1 text-xs text-zinc-400">
            Every release is either linked to a profile or already marked as reviewed.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((row) => {
            const candidates = findArtisteCandidates(row.artist_credit, profiles);
            const ambiguous = isAmbiguous(candidates);
            const busy = busyId === row.release_id;

            return (
              <div
                key={`${row.release_kind}:${row.release_id}`}
                className="rounded-2xl border border-white/10 bg-zinc-900/50 p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="flex items-center gap-1.5 text-sm font-bold text-white">
                      {row.release_kind === 'album' ? (
                        <Disc3 className="h-4 w-4 shrink-0 text-gold-400" />
                      ) : (
                        <Music2 className="h-4 w-4 shrink-0 text-gold-400" />
                      )}
                      <span className="truncate">{row.title}</span>
                    </p>
                    <p className="mt-1 text-xs text-zinc-400">
                      Credited to{' '}
                      <span className="font-semibold text-zinc-200">
                        {row.artist_credit || '—'}
                      </span>
                      {row.category ? ` • ${row.category}` : ''}
                      {` • ${row.release_kind}`}
                    </p>
                  </div>

                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void submit(row, null)}
                    title="Leave this one without a profile"
                    className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-semibold text-zinc-300 hover:bg-white/10 disabled:opacity-50 cursor-pointer"
                  >
                    <Link2Off className="h-3 w-3" />
                    Leave unlinked
                  </button>
                </div>

                {ambiguous && (
                  <p className="mt-3 flex items-start gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 p-2.5 text-[11px] text-amber-200">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    More than one profile matches that name exactly. Pick the right one — nothing
                    is assigned automatically.
                  </p>
                )}

                {candidates.length === 0 ? (
                  <p className="mt-3 text-[11px] text-zinc-500">
                    No profile matches this credit. Search profiles to pick one manually, or mark
                    it reviewed.
                  </p>
                ) : (
                  <div className="mt-3 space-y-1.5">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                      {hasExactMatch(candidates) ? 'Suggested owner' : 'Possible owner'}
                    </p>
                    {candidates.slice(0, 5).map((candidate) => (
                      <button
                        key={candidate.profile.id}
                        type="button"
                        disabled={busy}
                        onClick={() => void submit(row, candidate.profile.id)}
                        className="flex w-full items-center justify-between gap-2 rounded-xl border border-white/10 bg-zinc-950/60 px-3 py-2 text-left hover:border-gold-500/40 hover:bg-zinc-950 disabled:opacity-50 cursor-pointer"
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-xs font-bold text-white">
                            {candidate.profile.stage_name ||
                              candidate.profile.display_name ||
                              'Unnamed'}
                          </span>
                          <span className="block truncate text-[10px] text-zinc-500">
                            matched on “{candidate.matchedOn}”
                          </span>
                        </span>
                        <span
                          className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] font-bold ${
                            candidate.kind === 'exact'
                              ? 'bg-forest-500/20 text-forest-300'
                              : 'bg-white/10 text-zinc-400'
                          }`}
                        >
                          {candidate.kind === 'exact' ? 'EXACT' : 'PARTIAL'}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default AdminUnlinkedReleases;
