import React from 'react';
import { Bell, BellRing, Calendar, MapPin, Play } from 'lucide-react';
import { Song, UserProfile, isSongUpcomingPremiere } from '../types/music';
import { CoverArt } from './CoverArt';
import { CountdownBadge } from './CountdownBadge';

interface PremiereCardProps {
  song: Song;
  artiste?: UserProfile | null;
  reminded: boolean;
  onToggleReminder: (song: Song) => void;
  onOpenArtiste?: (artisteId: string) => void;
  onPlayIfUnlocked?: (song: Song) => void;
  onUnlocked?: () => void;
}

export const PremiereCard: React.FC<PremiereCardProps> = ({
  song,
  artiste,
  reminded,
  onToggleReminder,
  onOpenArtiste,
  onPlayIfUnlocked,
  onUnlocked,
}) => {
  const stillUpcoming = isSongUpcomingPremiere(song);
  const premiereDate = song.premiere_at
    ? new Date(song.premiere_at).toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '';

  return (
    <div className="group relative flex flex-col overflow-hidden rounded-2xl border border-gold-500/25 bg-gradient-to-b from-forest-900/90 to-forest-950 shadow-xl">
      {/* Premiere Cover Art */}
      <div className="relative aspect-square w-full overflow-hidden bg-forest-900">
        <CoverArt
          title={song.title}
          artist={song.artist}
          category={song.category}
          theme={song.cover_theme}
          coverUrl={song.cover_url}
          size="xl"
          className="w-full h-full transition duration-500 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/25 to-transparent" />

        <div className="absolute top-3 left-3">
          <span className="inline-flex items-center gap-1 rounded-full bg-gold-500 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider text-forest-950 shadow">
            Premiere
          </span>
        </div>

        {song.premiere_at && (
          <div className="absolute bottom-3 inset-x-3">
            <CountdownBadge
              targetIso={song.premiere_at}
              size="lg"
              onComplete={onUnlocked}
            />
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-4 flex-1 flex flex-col justify-between gap-3">
        <div>
          <h4 className="text-base font-extrabold text-white truncate">{song.title}</h4>
          <div className="mt-1 flex items-center gap-2">
            {artiste && onOpenArtiste ? (
              <button
                onClick={() => onOpenArtiste(artiste.id)}
                className="flex items-center gap-1.5 text-xs font-semibold text-gold-300 hover:underline cursor-pointer truncate"
              >
                {artiste.avatar_url && (
                  <img
                    src={artiste.avatar_url}
                    alt={artiste.stage_name || song.artist}
                    className="w-4 h-4 rounded-full object-cover"
                  />
                )}
                <span>{artiste.stage_name || song.artist}</span>
              </button>
            ) : (
              <span className="text-xs font-medium text-zinc-300 truncate">{song.artist}</span>
            )}
          </div>

          {artiste && (artiste.scg_zone || artiste.scg_branch) && (
            <p className="mt-1.5 flex items-center gap-1 text-[11px] text-zinc-400 truncate">
              <MapPin className="w-3 h-3 text-gold-400 flex-shrink-0" />
              {[artiste.scg_branch, artiste.scg_zone].filter(Boolean).join(' • ')}
            </p>
          )}

          {premiereDate && (
            <p className="mt-1 flex items-center gap-1 text-[11px] text-zinc-500">
              <Calendar className="w-3 h-3" />
              Drops {premiereDate}
            </p>
          )}
        </div>

        {stillUpcoming ? (
          <button
            onClick={() => onToggleReminder(song)}
            className={`w-full flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-bold transition cursor-pointer ${
              reminded
                ? 'bg-gold-500/20 border border-gold-400/40 text-gold-300'
                : 'bg-white/10 hover:bg-white/15 text-white border border-white/10'
            }`}
          >
            {reminded ? (
              <>
                <BellRing className="w-3.5 h-3.5 text-gold-400" />
                Reminder Set
              </>
            ) : (
              <>
                <Bell className="w-3.5 h-3.5" />
                Remind Me
              </>
            )}
          </button>
        ) : (
          <button
            onClick={() => onPlayIfUnlocked?.(song)}
            className="w-full flex items-center justify-center gap-1.5 rounded-xl bg-forest-500 py-2 text-xs font-bold text-forest-950 hover:bg-forest-400 transition cursor-pointer"
          >
            <Play className="w-3.5 h-3.5 fill-forest-950" />
            Stream Premiere Now
          </button>
        )}
      </div>
    </div>
  );
};
