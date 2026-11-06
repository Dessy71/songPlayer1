import React, { useState } from 'react';
import {
  ArrowLeft,
  BadgeCheck,
  MapPin,
  Wallet,
  Copy,
  Check,
  Play,
  Calendar,
  Music2,
  User,
  GraduationCap,
  Disc3,
  Edit3,
  Crown,
  X,
} from 'lucide-react';
import {
  Album,
  Song,
  UserProfile,
  isAlbumPubliclyPlayable,
  isAlbumUpcomingPremiere,
  isSongPubliclyPlayable,
  isSongUpcomingPremiere,
} from '../types/music';
import { ArtisteSupporters } from './ArtisteSupporters';
import { SupportCheckout } from './SupportCheckout';
import { SongRow } from './SongRow';
import { PremiereCard } from './PremiereCard';
import { AlbumPremiereCard } from './AlbumPremiereCard';
import { CoverArt } from './CoverArt';
import { EditArtisteModal } from './EditArtisteModal';
import { EditReleaseModal } from './EditReleaseModal';
import { usePlayer } from '../context/PlayerContext';

interface ArtisteProfileViewProps {
  artiste: UserProfile;
  songs: Song[];
  albums: Album[];
  viewerProfile: UserProfile | null;
  isPremium?: boolean;
  favoriteIds: Set<string>;
  offlineSavedIds?: Set<string>;
  remindedIds: Set<string>;
  onBack: () => void;
  onClose?: () => void;
  onRequirePremium?: (reason: string) => void;
  onOpenAlbum: (albumId: string) => void;
  onToggleFavorite: (song: Song) => void;
  onToggleOfflineSave?: (song: Song) => Promise<void> | void;
  onOpenLyrics?: (song: Song) => void;
  onOpenShareCard?: (song: Song) => void;
  onToggleReminder: (song: Song) => void;
  onOpenPlaylistModal: (song: Song) => void;
  onArtisteUpdated: (updated: UserProfile) => void;
  onRefreshCatalog: () => void;
}

export const ArtisteProfileView: React.FC<ArtisteProfileViewProps> = ({
  artiste,
  songs,
  albums,
  viewerProfile,
  isPremium = false,
  favoriteIds,
  offlineSavedIds,
  remindedIds,
  onBack,
  onClose,
  onRequirePremium,
  onOpenAlbum,
  onToggleFavorite,
  onToggleOfflineSave,
  onOpenLyrics,
  onOpenShareCard,
  onToggleReminder,
  onOpenPlaylistModal,
  onArtisteUpdated,
  onRefreshCatalog,
}) => {
  const { playSong, isAuthenticated, requireAccount } = usePlayer();
  const [copiedSupport, setCopiedSupport] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editingSong, setEditingSong] = useState<Song | null>(null);
  const [editingAlbum, setEditingAlbum] = useState<Album | null>(null);
  const [editReleaseOpen, setEditReleaseOpen] = useState(false);

  const stageTitle = artiste.stage_name || artiste.display_name || 'SCG Artiste';
  const canEditThisArtiste =
    viewerProfile?.role === 'admin' || viewerProfile?.id === artiste.id;

  const artisteSongs = songs.filter(
    (s) =>
      s.approval_status === 'approved' &&
      (s.artiste_id === artiste.id ||
        (artiste.stage_name &&
          s.artist.toLowerCase() === artiste.stage_name.trim().toLowerCase()))
  );

  const artisteAlbums = albums.filter(
    (a) => a.approval_status === 'approved' && a.artiste_id === artiste.id
  );

  const upcomingAlbums = artisteAlbums.filter((a) => isAlbumUpcomingPremiere(a));
  const releasedAlbums = artisteAlbums.filter((a) => isAlbumPubliclyPlayable(a));

  const upcomingAlbumIds = new Set(upcomingAlbums.map((a) => a.id));
  const upcomingSingles = artisteSongs.filter(
    (s) => isSongUpcomingPremiere(s) && (!s.album_id || !upcomingAlbumIds.has(s.album_id))
  );

  const releasedSongs = artisteSongs.filter((s) => isSongPubliclyPlayable(s));
  const totalPlays = releasedSongs.reduce((sum, s) => sum + (s.plays_count || 0), 0);



  return (
    <div className="max-w-[1400px] mx-auto space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-1.5 rounded-full bg-white/10 border border-white/15 px-3.5 py-1.5 text-xs font-bold text-amber-300 hover:bg-white/15 cursor-pointer"
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

        {canEditThisArtiste && (
          <button
            onClick={() => setEditOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/20 border border-amber-400/40 px-4 py-1.5 text-xs font-bold text-amber-300 hover:bg-amber-500/30 cursor-pointer"
          >
            <Edit3 className="w-3.5 h-3.5" />
            Edit Artiste Details
          </button>
        )}
      </div>

      {/* Artiste Hero Header */}
      <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-amber-500/20 via-pink-600/15 to-zinc-950 p-6 sm:p-8">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
            {artiste.avatar_url ? (
              <img
                src={artiste.avatar_url}
                alt={stageTitle}
                className="h-28 w-28 sm:h-32 sm:w-32 rounded-3xl object-cover border-2 border-amber-400/40 shadow-2xl"
              />
            ) : (
              <div className="h-28 w-28 sm:h-32 sm:w-32 rounded-3xl bg-gradient-to-br from-amber-500 to-pink-600 flex items-center justify-center text-white shadow-2xl">
                <User className="w-12 h-12" />
              </div>
            )}

            <div>
              <div className="flex items-center gap-2 flex-wrap">
                {artiste.is_sacsu ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-cyan-500/20 border border-cyan-400/40 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-cyan-300">
                    <GraduationCap className="w-3.5 h-3.5" />
                    SACSU • Tertiary Students&apos; Union
                  </span>
                ) : (
                  <span className="rounded-full bg-amber-500/20 border border-amber-400/30 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-300">
                    SCG Artiste Profile
                  </span>
                )}

                {artiste.is_verified_artiste && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-sky-500/20 border border-sky-400/30 px-2.5 py-0.5 text-[10px] font-bold text-sky-300">
                    <BadgeCheck className="w-3.5 h-3.5" />
                    Verified
                  </span>
                )}
              </div>

              <h2 className="mt-2 text-2xl sm:text-4xl font-extrabold text-white">{stageTitle}</h2>

              {artiste.real_name && (
                <p className="text-sm text-zinc-300 mt-0.5">
                  Real / Ministry Name:{' '}
                  <span className="font-semibold text-white">{artiste.real_name}</span>
                </p>
              )}

              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-zinc-300">
                {artiste.tertiary_institution && (
                  <span className="inline-flex items-center gap-1 rounded-lg bg-cyan-500/15 border border-cyan-400/30 px-2.5 py-1 text-cyan-200 font-semibold">
                    <GraduationCap className="w-3.5 h-3.5 text-cyan-400" />
                    {artiste.tertiary_institution}
                  </span>
                )}

                {(artiste.scg_zone || artiste.scg_branch) && (
                  <span className="inline-flex items-center gap-1 rounded-lg bg-black/40 border border-white/10 px-2.5 py-1">
                    <MapPin className="w-3.5 h-3.5 text-amber-400" />
                    {[artiste.scg_zone, artiste.scg_branch].filter(Boolean).join(' • ')}
                  </span>
                )}

                <span className="rounded-lg bg-black/40 border border-white/10 px-2.5 py-1">
                  {releasedSongs.length} Tracks
                  {releasedAlbums.length > 0 ? ` • ${releasedAlbums.length} Albums` : ''} •{' '}
                  {totalPlays.toLocaleString()} Plays
                </span>
              </div>

              {artiste.bio && (
                <p className="mt-3 max-w-xl text-xs sm:text-sm text-zinc-300 leading-relaxed">
                  {artiste.bio}
                </p>
              )}

              {releasedSongs.length > 0 && (
                <button
                  onClick={() => playSong(releasedSongs[0], releasedSongs)}
                  className="mt-4 inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-xs font-extrabold text-zinc-950 hover:bg-amber-100 transition cursor-pointer shadow-lg"
                >
                  <Play className="w-4 h-4 fill-zinc-950" />
                  Play All ({releasedSongs.length})
                </button>
              )}
            </div>
          </div>

          {/* Fan Support Card (Gated behind Gyidi Nwom Premium) */}
          <div className="w-full md:w-80 rounded-2xl border border-emerald-500/30 bg-zinc-950/90 p-4 shadow-xl">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold uppercase tracking-wider">
                <Wallet className="w-4 h-4" />
                Support {stageTitle}
              </div>
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/20 border border-amber-400/35 px-2 py-0.5 text-[10px] font-extrabold text-amber-300">
                <Crown className="w-2.5 h-2.5" />
                Premium
              </span>
            </div>

            {!isPremium && !canEditThisArtiste ? (
              <div className="mt-3 rounded-xl bg-zinc-900 border border-amber-400/25 p-3.5 space-y-2.5">
                <p className="text-xs text-zinc-300 leading-relaxed">
                  Direct Artiste Fan Support (verified Mobile Money &amp; Bank details) is a{' '}
                  <strong className="text-amber-300">Gyidi Nwom Premium</strong> feature.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    if (!isAuthenticated) {
                      requireAccount('Create an account & upgrade to Premium to support Artistes!');
                      return;
                    }
                    onRequirePremium?.(
                      `Upgrade to Gyidi Nwom Premium to support ${stageTitle}!`
                    );
                  }}
                  className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-amber-400 to-pink-500 px-3.5 py-2 text-xs font-extrabold text-zinc-950 hover:opacity-95 cursor-pointer"
                >
                  <Crown className="w-3.5 h-3.5" />
                  Unlock Artiste Support
                </button>
              </div>
            ) : (
              <SupportCheckout target={artiste.id} name={stageTitle} />
            )}
          </div>
        </div>
      </div>

      <ArtisteSupporters artisteId={artiste.id} />

      {/* Upcoming Album & Song Premieres */}
      {(upcomingAlbums.length > 0 || upcomingSingles.length > 0) && (
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-amber-400" />
            <div>
              <h3 className="text-lg font-extrabold text-white">Upcoming Premieres</h3>
              <p className="text-xs text-zinc-400">
                Approved albums & singles counting down to public launch
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {upcomingAlbums.map((alb) => (
              <AlbumPremiereCard
                key={alb.id}
                album={alb}
                tracks={artisteSongs.filter((s) => s.album_id === alb.id)}
                artiste={artiste}
                onOpenAlbum={onOpenAlbum}
                onUnlocked={onRefreshCatalog}
              />
            ))}

            {upcomingSingles.map((song) => (
              <PremiereCard
                key={song.id}
                song={song}
                artiste={artiste}
                reminded={remindedIds.has(song.id)}
                onToggleReminder={(s) => {
                  if (!isAuthenticated) {
                    requireAccount('Create a free account to set premiere reminders!');
                    return;
                  }
                  onToggleReminder(s);
                }}
                onPlayIfUnlocked={(s) => playSong(s, [s, ...releasedSongs])}
                onUnlocked={onRefreshCatalog}
              />
            ))}
          </div>
        </section>
      )}

      {/* Released Albums */}
      {releasedAlbums.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <Disc3 className="w-5 h-5 text-violet-400" />
            <h3 className="text-lg font-extrabold text-white">
              Albums & EPs ({releasedAlbums.length})
            </h3>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            {releasedAlbums.map((alb) => {
              const albTracks = releasedSongs.filter((s) => s.album_id === alb.id);
              return (
                <div
                  key={alb.id}
                  onClick={() => onOpenAlbum(alb.id)}
                  className="group relative rounded-2xl border border-white/10 bg-zinc-900/55 p-3 hover:bg-zinc-900 hover:border-amber-500/40 transition cursor-pointer"
                >
                  <CoverArt
                    title={alb.title}
                    category={alb.category}
                    theme={alb.cover_theme}
                    coverUrl={alb.cover_url}
                    size="lg"
                    className="w-full aspect-square rounded-xl"
                  />
                  {canEditThisArtiste && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingSong(null);
                        setEditingAlbum(alb);
                        setEditReleaseOpen(true);
                      }}
                      className="absolute top-4 right-4 rounded-full bg-black/75 p-2 text-amber-300 hover:bg-black cursor-pointer"
                      title="Edit or delete album"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <h4 className="mt-2.5 text-sm font-bold text-white truncate group-hover:text-amber-300">
                    {alb.title}
                  </h4>
                  <p className="text-[11px] text-zinc-400">{albTracks.length} tracks • Album</p>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Released Songs & Sermons */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Music2 className="w-5 h-5 text-pink-400" />
          <h3 className="text-lg font-extrabold text-white">
            Tracks & Preachings ({releasedSongs.length})
          </h3>
        </div>

        {releasedSongs.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-zinc-900/40 p-10 text-center text-sm text-zinc-400">
            No public releases yet. Check back soon for upcoming premieres!
          </div>
        ) : (
          <div className="rounded-2xl border border-white/10 bg-zinc-900/40 p-2">
            {releasedSongs.map((song, idx) => (
              <SongRow
                key={song.id}
                song={song}
                index={idx}
                contextQueue={releasedSongs}
                isFavorite={favoriteIds.has(song.id)}
                isOfflineSaved={offlineSavedIds?.has(song.id)}
                onToggleFavorite={onToggleFavorite}
                onToggleOfflineSave={onToggleOfflineSave}
                onOpenLyrics={onOpenLyrics}
                onOpenShareCard={onOpenShareCard}
                onOpenPlaylistModal={onOpenPlaylistModal}
                onEditSong={
                  canEditThisArtiste
                    ? (s) => {
                        setEditingAlbum(null);
                        setEditingSong(s);
                        setEditReleaseOpen(true);
                      }
                    : undefined
                }
              />
            ))}
          </div>
        )}
      </section>

      <EditArtisteModal
        isOpen={editOpen}
        onClose={() => setEditOpen(false)}
        artiste={artiste}
        isAdminViewer={viewerProfile?.role === 'admin'}
        onSaved={(saved) => {
          onArtisteUpdated(saved);
          onRefreshCatalog();
        }}
      />

      <EditReleaseModal
        isOpen={editReleaseOpen}
        onClose={() => setEditReleaseOpen(false)}
        song={editingSong}
        album={editingAlbum}
        albumTracks={
          editingAlbum ? songs.filter((s) => s.album_id === editingAlbum.id) : []
        }
        onSaved={onRefreshCatalog}
        onDeleted={onRefreshCatalog}
      />
    </div>
  );
};
