import React, { useState } from 'react';
import { ArrowLeft, Play, Shuffle, Disc3, Lock, Calendar, Pencil, X } from 'lucide-react';
import {
  Album,
  Song,
  UserProfile,
  isAlbumPubliclyPlayable,
  isAlbumUpcomingPremiere,
} from '../types/music';
import { CoverArt } from './CoverArt';
import { CountdownBadge } from './CountdownBadge';
import { SongRow } from './SongRow';
import { EditReleaseModal } from './EditReleaseModal';
import { formatDuration } from '../lib/format';
import { usePlayer } from '../context/PlayerContext';

interface AlbumViewProps {
  album: Album;
  tracks: Song[];
  artiste?: UserProfile | null;
  viewerProfile?: UserProfile | null;
  favoriteIds: Set<string>;
  offlineSavedIds?: Set<string>;
  onBack: () => void;
  onClose?: () => void;
  onOpenArtiste?: (artisteId: string) => void;
  onToggleFavorite: (song: Song) => void;
  onToggleOfflineSave?: (song: Song) => Promise<void> | void;
  onOpenLyrics?: (song: Song) => void;
  onOpenShareCard?: (song: Song) => void;
  onOpenPlaylistModal: (song: Song) => void;
  onUnlocked?: () => void;
  onRefreshCatalog?: () => void;
}

export const AlbumView: React.FC<AlbumViewProps> = ({
  album,
  tracks,
  artiste,
  viewerProfile,
  favoriteIds,
  offlineSavedIds,
  onBack,
  onClose,
  onOpenArtiste,
  onToggleFavorite,
  onToggleOfflineSave,
  onOpenLyrics,
  onOpenShareCard,
  onOpenPlaylistModal,
  onUnlocked,
  onRefreshCatalog,
}) => {
  const { playSong, isAuthenticated, requireAccount } = usePlayer();
  const [editAlbumOpen, setEditAlbumOpen] = useState(false);

  const sortedTracks = [...tracks].sort(
    (a, b) => (a.track_number || 0) - (b.track_number || 0)
  );
  const totalSeconds = sortedTracks.reduce((sum, s) => sum + (s.duration_seconds || 0), 0);
  const playable = isAlbumPubliclyPlayable(album);
  const upcoming = isAlbumUpcomingPremiere(album);

  const canManageAlbum =
    !!viewerProfile &&
    (viewerProfile.role === 'admin' ||
      viewerProfile.id === album.artiste_id ||
      viewerProfile.id === album.uploaded_by);

  return (
    <div className="max-w-[1350px] mx-auto space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-1.5 rounded-full bg-white/10 border border-white/15 px-3.5 py-1.5 text-xs font-bold text-gold-300 hover:bg-white/15 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            Go Back
          </button>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center gap-1 rounded-full bg-white/5 border border-white/10 px-3 py-1.5 text-xs font-semibold text-zinc-300 hover:bg-white/10 hover:text-white cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
              Close
            </button>
          )}
        </div>

        {canManageAlbum && (
          <button
            onClick={() => setEditAlbumOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-full bg-white/10 border border-white/15 hover:bg-white/15 px-4 py-1.5 text-xs font-bold text-gold-300 cursor-pointer"
          >
            <Pencil className="w-3.5 h-3.5" />
            Edit / Delete Album
          </button>
        )}
      </div>

      {/* Streaming Platform Album Header */}
      <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-gold-500/20 via-gold-600/15 to-zinc-950 p-6 sm:p-8 flex flex-col md:flex-row items-start md:items-end gap-6">
        <CoverArt
          title={album.title}
          category={album.category}
          theme={album.cover_theme}
          coverUrl={album.cover_url}
          size="lg"
          className="h-48 w-48 sm:h-56 sm:w-56 rounded-2xl shadow-2xl border border-white/15 flex-shrink-0"
        />

        <div className="space-y-3 flex-1 min-w-0">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-black/40 border border-white/15 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-gold-300">
            <Disc3 className="w-3.5 h-3.5" />
            {upcoming ? 'Upcoming Album Premiere' : 'Full Album'} • {album.category}
          </div>

          <h2 className="text-2xl sm:text-4xl font-extrabold text-white leading-tight">
            {album.title}
          </h2>

          {album.description && (
            <p className="text-xs sm:text-sm text-zinc-300 max-w-2xl leading-relaxed">
              {album.description}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-300">
            {album.artiste_id && onOpenArtiste ? (
              <button
                onClick={() => onOpenArtiste(album.artiste_id!)}
                className="font-bold text-gold-300 hover:underline cursor-pointer"
              >
                {artiste?.stage_name || album.artist}
              </button>
            ) : (
              <span className="font-bold text-white">{album.artist}</span>
            )}
            <span>•</span>
            <span>{sortedTracks.length} tracks</span>
            <span>•</span>
            <span>{formatDuration(totalSeconds)}</span>
          </div>

          {upcoming && album.premiere_at && (
            <div className="pt-2 space-y-1.5">
              <CountdownBadge
                targetIso={album.premiere_at}
                size="md"
                onComplete={onUnlocked}
              />
              <p className="text-xs text-zinc-400 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-gold-400" />
                Unlocks automatically on {new Date(album.premiere_at).toLocaleString()}
              </p>
            </div>
          )}

          {playable && sortedTracks.length > 0 && (
            <div className="pt-2 flex flex-wrap items-center gap-3">
              <button
                onClick={() => playSong(sortedTracks[0], sortedTracks)}
                className="inline-flex items-center gap-2 rounded-full bg-gold-500 hover:bg-gold-400 px-6 py-2.5 text-xs font-extrabold text-zinc-950 shadow-lg cursor-pointer"
              >
                <Play className="w-4 h-4 fill-zinc-950" />
                Play Album
              </button>

              <button
                onClick={() => {
                  if (!isAuthenticated) {
                    requireAccount(
                      'Create a free account to shuffle albums and unlock all tracks.'
                    );
                    return;
                  }
                  const rnd = sortedTracks[Math.floor(Math.random() * sortedTracks.length)];
                  playSong(rnd, sortedTracks);
                }}
                className="inline-flex items-center gap-2 rounded-full bg-white/10 hover:bg-white/15 px-5 py-2.5 text-xs font-bold text-white cursor-pointer"
              >
                <Shuffle className="w-4 h-4 text-gold-400" />
                Shuffle Album
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Album Tracklist */}
      <div className="rounded-2xl border border-white/10 bg-zinc-900/50 p-2 sm:p-3">
        {playable ? (
          sortedTracks.map((song, idx) => (
            <SongRow
              key={song.id}
              song={song}
              index={idx}
              contextQueue={sortedTracks}
              isFavorite={favoriteIds.has(song.id)}
              isOfflineSaved={offlineSavedIds?.has(song.id)}
              onToggleFavorite={onToggleFavorite}
              onToggleOfflineSave={onToggleOfflineSave}
              onOpenLyrics={onOpenLyrics}
              onOpenShareCard={onOpenShareCard}
              onOpenPlaylistModal={onOpenPlaylistModal}
              onOpenArtiste={onOpenArtiste}
            />
          ))
        ) : (
          /* Locked Countdown Tracklist Preview */
          <div className="divide-y divide-white/5">
            {sortedTracks.map((song, idx) => (
              <div
                key={song.id}
                className="flex items-center justify-between gap-3 px-4 py-3 text-zinc-400"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="w-6 text-xs font-bold text-gold-400/80 tabular-nums">
                    {song.track_number || idx + 1}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-zinc-200 truncate">{song.title}</p>
                    <p className="text-xs text-zinc-500 truncate">{song.artist}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 flex-shrink-0">
                  <span className="text-xs tabular-nums">
                    {formatDuration(song.duration_seconds)}
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-white/5 border border-white/10 px-2.5 py-1 text-[10px] font-semibold text-gold-300">
                    <Lock className="w-3 h-3" />
                    Premiere Locked
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {canManageAlbum && (
        <EditReleaseModal
          isOpen={editAlbumOpen}
          album={album}
          albumTracks={sortedTracks}
          onClose={() => setEditAlbumOpen(false)}
          onSaved={() => {
            onRefreshCatalog?.();
          }}
          onDeleted={() => {
            onRefreshCatalog?.();
            onBack();
          }}
        />
      )}
    </div>
  );
};
