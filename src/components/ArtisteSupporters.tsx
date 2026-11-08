import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

/**
 * Verified listeners who chose to share their support for an artiste.
 *
 * Supporters are ranked by the total amount they have given (highest first).
 * The top three get a medal badge: gold, silver, bronze. Everyone after that
 * continues in descending contribution order without a medal.
 *
 * Their profile pictures stack behind one another, each one slightly offset
 * so about half of the previous picture still shows.
 */
export function ArtisteSupporters({ artisteId }: { artisteId: string }) {
  const [supporters, setSupporters] = useState<{
    display_name: string;
    avatar_url: string | null;
    total_amount_subunits: number;
  }[]>([]);

  useEffect(() => {
    let active = true;
    void supabase
      .rpc('artiste_supporters', { p_artiste_id: artisteId })
      .then(({ data }) => {
        if (active) {
          const rows = (data || []) as Array<{
            display_name: string;
            avatar_url: string | null;
            total_amount_subunits: number;
          }>;
          // Safety sort by contribution (highest first) in case the RPC
          // ordering ever changes.
          rows.sort((a, b) => b.total_amount_subunits - a.total_amount_subunits);
          setSupporters(rows);
        }
      });
    return () => {
      active = false;
    };
  }, [artisteId]);

  if (!supporters.length) return null;

  const medalByRank = { 1: '🥇', 2: '🥈', 3: '🥉' };

  const MAX_VISIBLE = 6;
  const visible = supporters.slice(0, MAX_VISIBLE);
  const hidden = supporters.length - MAX_VISIBLE;
  // Each avatar shifts left so the one behind it still shows about half.
  const offsetStep = -20;

  return (
    <section className="rounded-2xl border border-white/10 bg-zinc-900 p-3">
      <div className="flex items-center justify-between gap-2 mb-2">
        <h3 className="font-bold text-white">Supporters</h3>
        <p className="text-xs text-zinc-400">
          {supporters.length} {supporters.length === 1 ? 'supporter' : 'supporters'}
        </p>
      </div>

      <div className="flex items-center gap-2">
        {visible.map((s, i) => {
          const rank = i + 1;
          const medal = medalByRank[rank as keyof typeof medalByRank];
          return (
            <div
              key={i}
              className="relative"
              style={{ transform: `translateX(${i * offsetStep}px)` }}
            >
              {medal && (
                <span
                  className="absolute -top-1 -left-1 flex items-center justify-center h-5 w-5 rounded-full bg-white text-zinc-950 text-[9px] font-bold shadow-md z-10"
                  title={`#{rank} supporter`}
                >
                  {medal}
                </span>
              )}
              {s.avatar_url ? (
                <img
                  src={s.avatar_url}
                  alt={s.display_name}
                  className="h-10 w-10 rounded-full object-cover border-2 border-zinc-950 shadow-lg"
                  title={s.display_name}
                />
              ) : (
                <div
                  className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-zinc-950 bg-gold-500/20 text-gold-300 text-xs font-bold shadow-lg"
                  title={s.display_name}
                >
                  {s.display_name.slice(0, 1).toUpperCase()}
                </div>
              )}
            </div>
          );
        })}

        {hidden > 0 && (
          <div
            className="relative"
            style={{ transform: `translateX(${visible.length * offsetStep}px)` }}
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-zinc-950 bg-zinc-800 shadow-lg text-[10px] font-bold text-gold-300">
              +{hidden}
            </span>
          </div>
        )}
      </div>

      {hidden > 0 && (
        <p className="mt-1 text-[10px] text-zinc-500">
          and {hidden} more supporter{hidden > 1 ? 's' : ''}
        </p>
      )}
    </section>
  );
}
