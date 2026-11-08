import React, { useState } from 'react';
import { Disc3, Calendar, Play, ChevronDown, ChevronUp } from 'lucide-react';
import { Album, Song, UserProfile, isAlbumPubliclyPlayable } from '../types/music';
import { CoverArt } from './CoverArt';
import { CountdownBadge } from './CountdownBadge';

interface AlbumPremiereCardProps {
  album: Album;
  tracks: Song[];
  artiste?: UserProfile | null;
  onOpenArtiste?: (artisteId: string) => void;
  onOpenAlbum: (albumId: string) => void;
  onUnlocked?: () => void;
}

export const AlbumPremiereCard: React.FC<AlbumPremiereCardProps> = ({
  album,
  tracks,
  artiste,
  onOpenArtiste,
  onOpenAlbum,
  onUnlocked,
}) => {
  const [showTracks, setShowTracks] = useState(false);
  const unlocked = isAlbumPubliclyPlayable(album);
  const premiereDateStr = album.premiere_at
    ? new Date(album.premiere_at).toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      })
    : '';

  const sortedTracks = [...tracks].sort(
    (a, b) => (a.track_number || 0) - (b.track_number || 0)
  );

  return (
    <div className="group relative flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-zinc-900/75 hover:border-gold-500/40 transition shadow-xl">
      <div className="relative aspect-square w-full overflow-hidden bg-zinc-950">
        <CoverArt
          title={album.title}
          category={album.category}
          theme={album.cover_theme}
          coverUrl={album.cover_url}
          size="lg"
          className="h-full w-full rounded-none object-cover group-hover:scale-105 transition duration-500"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/20 to-transparent" />

        <div className="absolute top-3 left-3 flex items-center gap-1.5">
          <span className="inline-flex items-center gap-1 rounded-full bg-black/75 backdrop-blur-md border border-gold-400/40 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-gold-200">
            <Disc3 className="w-3 h-3 text-gold-400" />
            Album Premiere • {sortedTracks.length} Tracks
          </span>
        </div>

        <div className="absolute bottom-3 left-3 right-3">
          {album.premiere_at && (
            <CountdownBadge targetIso={album.premiere_at} size="sm" onComplete={onUnlocked} />
          )}
        </div>
      </div>

      <div className="flex flex-1 flex-col justify-between p-4 space-y-3">
        <div>
          <h4 className="text-sm font-extrabold text-white truncate">{album.title}</h4>
          <button
            type="button"
            onClick={() => album.artiste_id && onOpenArtiste?.(album.artiste_id)}
            className={`text-xs text-gold-300/90 truncate mt-0.5 text-left ${
              album.artiste_id && onOpenArtiste ? 'hover:underline cursor-pointer' : ''
            }`}
          >
            {artiste?.stage_name || album.artist}
          </button>

          {premiereDateStr && (
            <p className="mt-1.5 flex items-center gap-1 text-[11px] text-zinc-400">
              <Calendar className="w-3 h-3 text-zinc-500 flex-shrink-0" />
              Drops {premiereDateStr}
            </p>
          )}

          {/* Tracklist Preview Toggle */}
          {sortedTracks.length > 0 && (
            <div className="mt-2.5">
              <button
                type="button"
                onClick={() => setShowTracks((v) => !v)}
                className="flex items-center justify-between w-full rounded-lg bg-white/5 px-2.5 py-1.5 text-[11px] font-semibold text-zinc-300 hover:bg-white/10 cursor-pointer"
              >
                <span>Preview Tracklist ({sortedTracks.length})</span>
                {showTracks ? (
                  <ChevronUp className="w-3.5 h-3.5" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5" />
                )}
              </button>

              {showTracks && (
                <ol className="mt-2 max-h-32 overflow-y-auto space-y-1 rounded-lg bg-zinc-950/90 border border-white/5 p-2 text-[11px] text-zinc-300">
                  {sortedTracks.map((t, i) => (
                    <li key={t.id} className="truncate">
                      <span className="text-gold-400 font-bold mr-1.5">
                        {t.track_number || i + 1}.
                      </span>
                      {t.title}
                    </li>
                  ))}
                </ol>
              )}
            </div>
          )}
        </div>

        {unlocked ? (
          <button
            type="button"
            onClick={() => onOpenAlbum(album.id)}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-forest-500 hover:bg-forest-400 py-2 text-xs font-bold text-zinc-950 transition cursor-pointer"
          >
            <Play className="w-3.5 h-3.5 fill-zinc-950" />
            Open & Stream Album
          </button>
        ) : (
          <button
            type="button"
            onClick={() => onOpenAlbum(album.id)}
            className="w-full flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-semibold bg-white/5 border border-white/10 text-zinc-200 hover:bg-white/10 transition cursor-pointer"
          >
            <Disc3 className="w-3.5 h-3.5 text-gold-400" />
            View Album Countdown & Tracklist
          </button>
        )}
      </div>
    </div>
  );
};
