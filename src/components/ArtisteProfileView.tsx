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
  ShieldCheck,
} from 'lucide-react';
import {
  Album,
  Song,
  UserProfile,
  isAlbumPubliclyPlayable,
  isAlbumUpcomingPremiere,
  isSongPubliclyPlayable,
  isSongUpcomingPremiere,
  ApprovalStatus,
} from '../types/music';
import { SongRow } from './SongRow';
import { PremiereCard } from './PremiereCard';
import { AlbumPremiereCard } from './AlbumPremiereCard';
import { CoverArt } from './CoverArt';
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
  const [copiedSupport, setCopiedSupport] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editingSong, setEditingSong] = useState<Song | null>(null);
  const [editingAlbum, setEditingAlbum] = useState<Album | null>(null);
  const [editReleaseOpen, setEditReleaseOpen] = useState(false);
  const [supportModalOpen, setSupportModalOpen] = useState(false);

  const stageTitle = artiste.stage_name || artiste.display_name || 'SCG Artiste';
  const canEditThisArtiste =
    viewerProfile?.role === 'admin' || viewerProfile?.id === artiste.id;
  
  // Support Badge Logic: Profile pictures only, no names, visible if approved & details exist
  const showSupportBadge = artiste.approval_status === 'approved' 
    && artiste.support_number && artiste.support_account_name;

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

  const copyAccount = () => {
    if (!artiste.support_number) return;
    navigator.clipboard.writeText(artiste.support_number);
    setCopiedSupport(true);
    setTimeout(() => setCopiedSupport(false), 2000);
  };

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
                  {releasedAlbums.length > 0 ? ` • ${releasedAlbums.length} Albums` : ''} •{' '}\n                  {totalPlays.toLocaleString()} Plays
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

          {/* Fan Support Card (Gated behind Gyidi Nwom Premium / Admin View) */}
          <div className="w-full md:w-80 rounded-2xl border border-emerald-500/30 bg-zinc-950/90 p-4 shadow-xl">
            <div className="flex items-center justify-between gap-2 mb-3">
              <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold uppercase tracking-wider">
                {showSupportBadge && <ShieldCheck className="w-3.5 h-3.5" />}
                <Wallet className="w-4 h-4" />
                Support {stageTitle}
              </div>
              {isAdminViewer && artiste.approval_status === 'pending' && (
                <span className="inline-flex items-center gap-1 rounded-full bg-red-500/20 border border-red-400/35 px-2 py-0.5 text-[10px] font-bold text-red-300">
                  Pending Admin Approval
                </span>
              )}
              {isAdminViewer && artiste.approval_status === 'approved' && (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 border border-emerald-400/35 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
                  Approved
                </span>
              )}
            </div>

            {!isPremium && !canEditThisArtiste && artiste.approval_status !== 'approved' ? (
              <div className="mt-3 rounded-xl bg-zinc-900 border border-white/10 p-3.5 space-y-2.5">
                <p className="text-xs text-zinc-300 leading-relaxed">
                  Direct Artiste Fan Support is available once the profile is <strong>Admin Approved</strong> with Paystack details.
                </p>
              </div>
            ) : showSupportBadge ? (
              <div className="mt-3 rounded-xl bg-zinc-900 border border-emerald-500/30 p-3">
                {/* SUPPORT BADGE: Profile Pictures Only (No Names) */}
                <div className="flex items-center gap-3 mb-2">
                  <div className="flex -space-x-2">
                    {/* Show profile pictures of supporters or just the artiste's avatar as badge */}
                    {artiste.avatar_url && (
                      <img
                        src={artiste.avatar_url}
                        alt=""
                        className="h-8 w-8 rounded-full border-2 border-zinc-900 object-cover"
                      />
                    )}
                    {/* Additional supporter avatars could go here if data existed */}
                  </div>
                  <span className="text-[10px] uppercase font-bold text-emerald-400">
                    Support Badge Active
                  </span>
                </div>
                
                <p className=\"text-[11px] text-zinc-400 mt-1\">
                  Click the Money Icon to support via Paystack:
                </p>
                <div className=\"mt-2 flex items-center justify-between gap-2 cursor-pointer\" onClick={() => setSupportModalOpen(true)}>
                  <div className=\"flex items-center gap-2 text-emerald-400 text-xs font-bold uppercase tracking-wider\">
                    <Wallet className=\"w-4 h-4\" />
                    Support {stageTitle}
                  </div>
                  <div className=\"bg-emerald-500/10 border border-emerald-500/30 rounded-lg px-3 py-1.5 text-xs text-emerald-300 flex items-center gap-1\">
                    <Check className=\"w-3 h-3\" />
                    Redirect to Payment Page
                  </div>
                </div>
              </>
            ) : artiste.approval_status === 'pending' && canEditThisArtiste ? (
              <div className=\"mt-3 rounded-xl bg-zinc-900 border border-amber-400/25 p-3.5 space-y-2.5\">
                <p className=\"text-xs text-zinc-300 leading-relaxed\">
                  Profile is <strong>Pending Approval</strong>. Admin must input Paystack URL & Subaccount Code before listeners can support.
                </p>
                <button
                  type=\"button\"
                  onClick={() => setSupportModalOpen(true)}
                  className=\"w-full inline-flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-amber-400 to-pink-500 px-3.5 py-2 text-xs font-extrabold text-zinc-950 hover:opacity-95 cursor-pointer\"
                >
                  <ShieldCheck className=\"w-3.5 h-3.5\" />
                  Configure Paystack & Approve
                </button>
              </div>
            ) : (!artiste.support_number && !canEditThisArtiste) ? (
              <div className=\"mt-3 rounded-xl bg-zinc-900 border border-white/10 p-3.5 space-y-2.5\">
                <p className=\"text-xs text-zinc-300 leading-relaxed\">
                  Direct Artiste Fan Support (verified Mobile Money &amp; Bank details) is a{' '}\
                  <strong className=\"text-amber-300\">Gyidi Nwom Premium</strong> feature.
                </p>
                <button
                  type=\"button\"
                  onClick={() => {\n                    if (!isAuthenticated) {\n                      requireAccount('Create an account & upgrade to Premium to support Artistes!');\n                      return;\n                    }\n                    onRequirePremium?.(\n                      `Upgrade to Gyidi Nwom Premium to view ${stageTitle}'s direct MoMo/Bank support details!`\n                    );\n                  }}\n                  className=\"w-full inline-flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-amber-400 to-pink-500 px-3.5 py-2 text-xs font-extrabold text-zinc-950 hover:opacity-95 cursor-pointer\"\n                >\n                  <Crown className=\"w-3.5 h-3.5\" />\n                  Unlock Artiste Support
                </button>
              </div>
            ) : (
              <div className=\"mt-3 rounded-xl bg-zinc-900 border border-white/10 p-3\">
                 <p className=\"text-[11px] text-zinc-400 mt-1\">
                   Support details configured. Click icon to redirect to payment page.
                 </p>
                 <button
                   onClick={() => setSupportModalOpen(true)}
                   className=\"mt-2 w-full inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 px-3 py-2 text-xs font-bold text-emerald-300 hover:bg-emerald-500/20 cursor-pointer\"
                 >
                   <Wallet className=\"w-3.5 h-3.5\" />
                   Redirect to Payment Page (URL: {artiste.support_number})
                 </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Upcoming Album & Song Premieres */}
      {(upcomingAlbums.length > 0 || upcomingSingles.length > 0) && (\n        <section className=\"space-y-4\">\n          <div className=\"flex items-center gap-2\">\n            <Calendar className=\"w-5 h-5 text-amber-400\" />\n            <div>\n              <h3 className=\"text-lg font-extrabold text-white\">Upcoming Premieres</h3>\n              <p className=\"text-xs text-zinc-400\">\n                Approved albums & singles counting down to public launch\n              </p>\n            </div>\n          </div>\n\n          <div className=\"grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4\">\n            {upcomingAlbums.map((alb) => (\n              <AlbumPremiereCard\n                key={alb.id}\n                album={alb}\n                tracks={artisteSongs.filter((s) => s.album_id === alb.id)}\n                artiste={artiste}\n                onOpenAlbum={onOpenAlbum}\n                onUnlocked={onRefreshCatalog}\n              />\n            ))}\n\n            {upcomingSingles.map((song) => (\n              <PremiereCard\n                key={song.id}\n                song={song}\n                artiste={artiste}\n                reminded={remindedIds.has(song.id)}\n                onToggleReminder={(s) => {\n                  if (!isAuthenticated) {\n                    requireAccount('Create a free account to set premiere reminders!');\n                    return;\n                  }\n                  onToggleReminder(s);\n                }}\n                onPlayIfUnlocked={(s) => playSong(s, [s, ...releasedSongs])}\n                onUnlocked={onRefreshCatalog}\n              />\n            ))}\n          </div>\n        </section>\n      )}\n\n      {/* Released Albums */}\n      {releasedAlbums.length > 0 && (\n        <section className=\"space-y-3\">\n          <div className=\"flex items-center gap-2\">\n            <Disc3 className=\"w-5 h-5 text-violet-400\" />\n            <h3 className=\"text-lg font-extrabold text-white\">\n              Albums & EPs ({releasedAlbums.length})\n            </h3>\n          </div>\n\n          <div className=\"grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4\">\n            {releasedAlbums.map((alb) => {\n              const albTracks = releasedSongs.filter((s) => s.album_id === alb.id);\n              return (\n                <div\n                  key={alb.id}\n                  onClick={() => onOpenAlbum(alb.id)}\n                  className=\"group relative rounded-2xl border border-white/10 bg-zinc-900/55 p-3 hover:bg-zinc-900 hover:border-amber-500/40 transition cursor-pointer\"\n                >\n                  <CoverArt\n                    title={alb.title}\n                    category={alb.category}\n                    theme={alb.cover_theme}\n                    coverUrl={alb.cover_url}\n                    size=\"lg\"\n                    className=\"w-full aspect-square rounded-xl\"\n                  />\n                  {canEditThisArtiste && (\n                    <button\n                      type=\"button\"\n                      onClick={(e) => {\n                        e.stopPropagation();\n                        setEditingSong(null);\n                        setEditingAlbum(alb);\n                        setEditReleaseOpen(true);\n                      }}\n                      className=\"absolute top-4 right-4 rounded-full bg-black/75 p-2 text-amber-300 hover:bg-black cursor-pointer\"\n                      title=\"Edit or delete album\"\n                    >\n                      <Edit3 className=\"w-3.5 h-3.5\" />\n                    </button>\n                  )}\n                  <h4 className=\"mt-2.5 text-sm font-bold text-white truncate group-hover:text-amber-300\">\n                    {alb.title}\n                  </h4>\n                  <p className=\"text-[11px] text-zinc-400\">{albTracks.length} tracks • Album</p>\n                </div>\n              );\n            })}\n          </div>\n        </section>\n      )}\n\n      {/* Released Songs & Sermons */}\n      <section className=\"space-y-3\">\n        <div className=\"flex items-center gap-2\">\n          <Music2 className=\"w-5 h-5 text-pink-400\" />\n          <h3 className=\"text-lg font-extrabold text-white\">\n            Tracks & Preachings ({releasedSongs.length})\n          </h3>\n        </div>\n\n        {releasedSongs.length === 0 ? (\n          <div className=\"rounded-2xl border border-white/10 bg-zinc-900/40 p-10 text-center text-sm text-zinc-400\">\n            No public releases yet. Check back soon for upcoming premieres!\n          </div>\n        ) : (\n          <div className=\"rounded-2xl border border-white/10 bg-zinc-900/40 p-2\">\n            {releasedSongs.map((song, idx) => (\n              <SongRow\n                key={song.id}\n                song={song}\n                index={idx}\n                contextQueue={releasedSongs}\n                isFavorite={favoriteIds.has(song.id)}\n                isOfflineSaved={offlineSavedIds?.has(song.id)}\n                onToggleFavorite={onToggleFavorite}\n                onToggleOfflineSave={onToggleOfflineSave}\n                onOpenLyrics={onOpenLyrics}\n                onOpenShareCard={onOpenShareCard}\n                onOpenPlaylistModal={onOpenPlaylistModal}\n                onEditSong={\n                  canEditThisArtiste\n                    ? (s) => {\n                        setEditingAlbum(null);\n                        setEditingSong(s);\n                        setEditReleaseOpen(true);\n                      }\n                    : undefined\n                }\n              />\n            ))}\n          </div>\n        )}\n      </section>\n\n      <EditArtisteModal\n        isOpen={editOpen}\n        onClose={() => setEditOpen(false)}\n        artiste={artiste}\n        isAdminViewer={viewerProfile?.role === 'admin'}\n        onSaved={(saved) => {\n          onArtisteUpdated(saved);\n          onRefreshCatalog();\n        }}\n      />\n\n      <EditReleaseModal\n        isOpen={editReleaseOpen}\n        onClose={() => setEditReleaseOpen(false)}\n        song={editingSong}\n        album={editingAlbum}\n        albumTracks={\n          editingAlbum ? songs.filter((s) => s.album_id === editingAlbum.id) : []\n        }\n        onSaved={onRefreshCatalog}\n        onDeleted={onRefreshCatalog}\n      />\n\n      <SupportModal\n        isOpen={supportModalOpen}\n        onClose={() => setSupportModalOpen(false)}\n        artiste={artiste}\n        isAdminViewer={viewerProfile?.role === 'admin'}\n        onApproved={(updated) => {\n          onArtisteUpdated(updated);\n          onRefreshCatalog();\n        }}\n      />\n    </div>\n  );\n};\n