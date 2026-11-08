import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  BadgeCheck,
  MapPin,
  Wallet,
  Play,
  Calendar,
  Music2,
  User,
  GraduationCap,
  Disc3,
  Edit3,
  Crown,
  X,
  ShieldCheck,
  Clock,
  ExternalLink,
} from 'lucide-react';
import {
  Album,
  Song,
  UserProfile,
  isAlbumPubliclyPlayable,
  isAlbumUpcomingPremiere,
  isSongPubliclyPlayable,
  isSongUpcomingPremiere,
  isProfileApproved,
  hasApprovedSupportPage,
  SupportSummary,
} from '../types/music';
import { supabase } from '../lib/supabase';
import { SongRow } from './SongRow';
import { PremiereCard } from './PremiereCard';
import { AlbumPremiereCard } from './AlbumPremiereCard';
import { CoverArt } from './CoverArt';
import { ArtisteSupporters } from './ArtisteSupporters';
import { EditArtisteModal } from './EditArtisteModal';
import { EditReleaseModal } from './EditReleaseModal';
import { usePlayer } from '../context/PlayerContext';
import { SupportModal } from './SupportModal';

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
  const [editOpen, setEditOpen] = useState(false);
  const [editingSong, setEditingSong] = useState<Song | null>(null);
  const [editingAlbum, setEditingAlbum] = useState<Album | null>(null);
  const [editReleaseOpen, setEditReleaseOpen] = useState(false);
  const [supportModalOpen, setSupportModalOpen] = useState(false);

  const isAdminViewer = viewerProfile?.role === 'admin';
  const stageTitle = artiste.stage_name || artiste.display_name || 'SCG Artiste';
  const canEditThisArtiste = isAdminViewer || viewerProfile?.id === artiste.id;

  // Approval gate: a profile is only reachable/supportable once an admin approved it.
  // Rows from before the approval column existed stay visible (grandfathered).
  const isApproved = isProfileApproved(artiste);

  // Payout details are no longer on the public profile. This redacted summary comes
  // from profile_support_summary(), which never returns the subaccount code or the
  // account holder name.
  const [support, setSupport] = useState<SupportSummary | null>(null);
  const [supportRefreshKey, setSupportRefreshKey] = useState(0);

  useEffect(() => {
    let active = true;
    void supabase
      .rpc('profile_support_summary', { p_artiste_id: artiste.id })
      .then(({ data, error }) => {
        if (!active) return;
        const row = Array.isArray(data) ? data[0] : data;
        setSupport(
          error || !row
            ? null
            : {
                approved: Boolean(row.approved),
                has_paystack_page: Boolean(row.has_paystack_page),
                payment_page_url: row.payment_page_url ?? null,
                provider: row.provider ?? null,
                is_placeholder: Boolean(row.is_placeholder),
              }
        );
      });
    return () => {
      active = false;
    };
  }, [artiste.id, supportRefreshKey]);

  // Support Badge: approved + a real Paystack page. Shown as a profile picture only.
  const showSupportBadge = hasApprovedSupportPage(artiste, support);

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

  const openPaymentPage = () => {
    if (!support?.has_paystack_page || !support.payment_page_url) return;
    window.open(support.payment_page_url, '_blank', 'noopener,noreferrer');
  };

  const requireSupportAccess = () => {
    if (!isAuthenticated) {
      requireAccount('Create an account & upgrade to Premium to support Artistes!');
      return;
    }
    onRequirePremium?.(
      `Upgrade to Gyidi Nnwom Premium to view ${stageTitle}'s direct support details!`
    );
  };

  // Pending / rejected profiles stay closed to the public until an admin approves them.
  if (!isApproved && !isAdminViewer && viewerProfile?.id !== artiste.id) {
    return (
      <div className="mx-auto max-w-xl space-y-4 py-10">
        <div className="rounded-3xl border border-white/10 bg-forest-900/70 p-8 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gold-500/15 text-gold-300">
            <Clock className="w-7 h-7" />
          </div>
          <h2 className="mt-4 text-xl font-extrabold text-white">Profile Not Available Yet</h2>
          <p className="mt-2 text-sm text-zinc-400">
            {artiste.approval_status === 'rejected'
              ? 'This artiste profile was not approved for publication.'
              : 'This artiste profile is awaiting admin approval and will appear here once it goes live.'}
          </p>
          <button
            type="button"
            onClick={onBack}
            className="mt-5 inline-flex items-center gap-1.5 rounded-full bg-white/10 border border-white/15 px-4 py-2 text-xs font-bold text-gold-300 hover:bg-white/15 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[1400px] mx-auto space-y-8">
      {/* Profile Header */}
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

        {canEditThisArtiste && (
          <button
            onClick={() => setEditOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-full bg-gold-500/20 border border-gold-400/40 px-4 py-1.5 text-xs font-bold text-gold-300 hover:bg-gold-500/30 cursor-pointer"
          >
            <Edit3 className="w-3.5 h-3.5" />
            Edit Artiste Details
          </button>
        )}
      </div>

      {/* Artiste Hero Header */}
      <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-gold-500/20 via-pink-600/15 to-forest-900 p-6 sm:p-8">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            {artiste.avatar_url ? (
              <img
                src={artiste.avatar_url}
                alt=""
                className="h-28 w-28 sm:h-32 sm:w-32 rounded-3xl object-cover border-2 border-gold-400/40 shadow-2xl"
              />
            ) : (
              <div className="h-28 w-28 sm:h-32 sm:w-32 rounded-3xl bg-gradient-to-br from-gold-500 to-pink-600 flex items-center justify-center text-white shadow-2xl">
                <User className="w-12 h-12" />
              </div>
            )}

            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-2xl font-extrabold text-white">{stageTitle}</h2>
                {artiste.is_verified_artiste && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-gold-500/20 border border-gold-400/30 px-2.5 py-0.5 text-[10px] font-bold text-gold-300">
                    <BadgeCheck className="w-3.5 h-3.5" />
                    Verified
                  </span>
                )}
                {isAdminViewer && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-gold-500/20 border border-gold-400/30 px-2.5 py-0.5 text-[10px] font-bold text-gold-300">
                    <Wallet className="w-3.5 h-3.5" />
                    Admin View
                  </span>
                )}
              </div>

              <p className="text-sm text-zinc-300 mt-0.5">
                {artiste.bio || 'No bio provided yet.'}
              </p>

              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-zinc-300">
                {artiste.tertiary_institution && (
                  <span className="inline-flex items-center gap-1 rounded-lg bg-cyan-500/15 border border-cyan-400/30 px-2.5 py-1 text-cyan-200 font-semibold">
                    <GraduationCap className="w-3.5 h-3.5" />
                    {artiste.tertiary_institution}
                  </span>
                )}
                {(artiste.scg_zone || artiste.scg_branch) && (
                  <span className="inline-flex items-center gap-1 rounded-lg bg-black/40 border border-white/10 px-2.5 py-1">
                    <MapPin className="w-3.5 h-3.5 text-gold-400" />
                    {[artiste.scg_zone, artiste.scg_branch].filter(Boolean).join(' • ')}
                  </span>
                )}
                <span className="rounded-lg bg-black/40 border border-white/10 px-2.5 py-1">
                  {releasedSongs.length} Tracks
                  {releasedAlbums.length > 0 ? ` • ${releasedAlbums.length} Albums` : ''} •{' '}
                  {totalPlays.toLocaleString()} Plays
                </span>
              </div>

              {releasedSongs.length > 0 && (
                <button
                  onClick={() => playSong(releasedSongs[0], releasedSongs)}
                  className="mt-4 inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-xs font-extrabold text-forest-950 hover:bg-gold-100 transition cursor-pointer shadow-lg"
                >
                  <Play className="w-4 h-4 fill-forest-950" />
                  Play All ({releasedSongs.length})
                </button>
              )}
            </div>
          </div>

          {/* Fan Support Card (Approval + Gyidi Nnwom Premium gated, admin always visible) */}
          <div className="w-full md:w-80 rounded-2xl border border-forest-500/30 bg-forest-950/90 p-4 shadow-xl">
            <div className="flex items-center justify-between gap-2 mb-3">
              <div className="flex items-center gap-2 text-forest-400 text-xs font-bold uppercase tracking-wider">
                <Wallet className="w-4 h-4" />
                Support {stageTitle}
              </div>
              {isAdminViewer && (
                <span
                  className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold ${
                    isApproved
                      ? 'bg-forest-500/20 border-forest-400/35 text-forest-300'
                      : 'bg-rose-500/20 border-rose-400/35 text-rose-300'
                  }`}
                >
                  {isApproved ? 'Approved' : 'Pending Approval'}
                </span>
              )}
            </div>

            {/* Support Badge: profile pictures only, no names */}
            {showSupportBadge && (
              <div className="mb-3 flex items-center gap-2.5 rounded-xl border border-forest-500/30 bg-forest-500/10 p-2.5">
                <span className="flex -space-x-2">
                  <span className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border-2 border-forest-950 bg-forest-500/20">
                    {artiste.avatar_url ? (
                      <img src={artiste.avatar_url} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <User className="w-4 h-4 text-forest-300" />
                    )}
                  </span>
                </span>
                <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-forest-300">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  Support Badge
                </span>
              </div>
            )}

            {!isApproved ? (
              <div className="rounded-xl bg-forest-900 border border-gold-400/25 p-3.5 space-y-2.5">
                <p className="text-xs text-zinc-300 leading-relaxed">
                  {isAdminViewer
                    ? 'Add the Paystack payment page URL and subaccount code, then approve this profile to open listener support.'
                    : `Support for ${stageTitle} opens once an admin approves this profile.`}
                </p>
                {isAdminViewer && (
                  <button
                    type="button"
                    onClick={() => setSupportModalOpen(true)}
                    className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-gold-400 to-pink-500 px-3.5 py-2 text-xs font-extrabold text-forest-950 hover:opacity-95 cursor-pointer"
                  >
                    <ShieldCheck className="w-3.5 h-3.5" />
                    Configure Paystack &amp; Approve
                  </button>
                )}
              </div>
            ) : !showSupportBadge ? (
              <div className="rounded-xl bg-forest-900 border border-white/10 p-3.5 space-y-2.5">
                <p className="text-xs text-zinc-300 leading-relaxed">
                  {isAdminViewer
                    ? support?.is_placeholder
                      ? 'Sample Paystack details are configured. Replace them with the real payment page URL and subaccount before going live.'
                      : 'Profile approved. Add the Paystack payment page URL so listeners can support this artiste.'
                    : 'Approved profile — support details are being finalised.'}
                </p>
                {isAdminViewer && (
                  <button
                    type="button"
                    onClick={() => setSupportModalOpen(true)}
                    className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl bg-gold-400/15 border border-gold-400/30 px-3.5 py-2 text-xs font-extrabold text-gold-300 hover:bg-gold-400/25 cursor-pointer"
                  >
                    <Wallet className="w-3.5 h-3.5" />
                    Add Paystack Details
                  </button>
                )}
              </div>
            ) : !isPremium && !canEditThisArtiste ? (
              <div className="rounded-xl bg-forest-900 border border-white/10 p-3.5 space-y-2.5">
                <p className="text-xs text-zinc-300 leading-relaxed">
                  Direct Artiste Fan Support is part of{' '}
                  <strong className="text-gold-300">Gyidi Nnwom Premium</strong>.
                </p>
                <button
                  type="button"
                  onClick={requireSupportAccess}
                  className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-gold-400 to-pink-500 px-3.5 py-2 text-xs font-extrabold text-forest-950 hover:opacity-95 cursor-pointer"
                >
                  <Crown className="w-3.5 h-3.5" />
                  Unlock Artiste Support
                </button>
              </div>
            ) : (
              <>
                {/* Wallet icon only: click and go straight to the payment page.
                    No URL, no subaccount, no secondary "view details" step. */}
                <button
                  type="button"
                  onClick={openPaymentPage}
                  className="flex w-full items-center justify-between gap-2 rounded-xl border border-forest-500/35 bg-forest-500/10 px-3.5 py-3 text-left hover:bg-forest-500/20 transition cursor-pointer"
                >
                  <span className="flex items-center gap-2.5 min-w-0">
                    <Wallet className="w-5 h-5 flex-shrink-0 text-forest-400" />
                    <span className="min-w-0">
                      <span className="block text-xs font-extrabold uppercase tracking-wider text-forest-300">
                        Support {stageTitle}
                      </span>
                      <span className="block truncate text-[11px] text-zinc-400">
                        Continue to the payment page
                      </span>
                    </span>
                  </span>
                  <ExternalLink className="w-4 h-4 flex-shrink-0 text-forest-400" />
                </button>

                {/* Once a profile is approved and badged the modal is otherwise
                    unreachable from here, which left admins with no way to edit the
                    Paystack details or run the supporter sync. */}
                {isAdminViewer && showSupportBadge && (
                  <button
                    type="button"
                    onClick={() => setSupportModalOpen(true)}
                    className="mt-2.5 flex w-full items-center justify-center gap-1.5 rounded-xl border border-gold-400/30 bg-gold-400/10 px-3.5 py-2 text-xs font-extrabold text-gold-300 hover:bg-gold-400/20 transition cursor-pointer"
                  >
                    <ShieldCheck className="w-3.5 h-3.5" />
                    Support settings
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Listener supporters: profile pictures stacked behind each other, half showing */}
      <ArtisteSupporters artisteId={artiste.id} />

      {/* Upcoming Album & Song Premieres */}
      {(upcomingAlbums.length > 0 || upcomingSingles.length > 0) && (
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-gold-400" />
            <div>
              <h3 className="text-lg font-extrabold text-white">Upcoming Premieres</h3>
              <p className="text-xs text-zinc-400">
                Approved albums &amp; singles counting down to public launch
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
            <Disc3 className="w-5 h-5 text-gold-400" />
            <h3 className="text-lg font-extrabold text-white">
              Albums &amp; EPs ({releasedAlbums.length})
            </h3>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            {releasedAlbums.map((alb) => {
              const albTracks = releasedSongs.filter((s) => s.album_id === alb.id);
              return (
                <div
                  key={alb.id}
                  onClick={() => onOpenAlbum(alb.id)}
                  className="group relative rounded-2xl border border-white/10 bg-forest-900/55 p-3 hover:bg-forest-900 hover:border-gold-500/40 transition cursor-pointer"
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
                      className="absolute top-4 right-4 rounded-full bg-black/75 p-2 text-gold-300 hover:bg-black cursor-pointer"
                      title="Edit or delete album"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <h4 className="mt-2.5 text-sm font-bold text-white truncate group-hover:text-gold-300">
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
            Tracks &amp; Preachings ({releasedSongs.length})
          </h3>
        </div>

        {releasedSongs.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-forest-900/40 p-10 text-center text-sm text-zinc-400">
            No public releases yet. Check back soon for upcoming premieres!
          </div>
        ) : (
          <div className="rounded-2xl border border-white/10 bg-forest-900/40 p-2">
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

      {editOpen && (
        <EditArtisteModal
          isOpen={true}
          onClose={() => setEditOpen(false)}
          artiste={artiste}
          isAdminViewer={isAdminViewer}
          onSaved={(saved) => {
            onArtisteUpdated(saved);
            onRefreshCatalog();
          }}
        />
      )}

      {editReleaseOpen && (
        <EditReleaseModal
          isOpen={true}
          onClose={() => setEditReleaseOpen(false)}
          song={editingSong}
          album={editingAlbum}
          albumTracks={editingAlbum ? songs.filter((s) => s.album_id === editingAlbum.id) : []}
          onSaved={onRefreshCatalog}
          onDeleted={onRefreshCatalog}
        />
      )}

      <SupportModal
        isOpen={supportModalOpen}
        onClose={() => setSupportModalOpen(false)}
        artiste={artiste}
        isAdminViewer={isAdminViewer}
        onApproved={(updated) => {
          onArtisteUpdated(updated);
          onRefreshCatalog();
        }}
        onSaved={() => onRefreshCatalog()}
      />
    </div>
  );
};
