import React, { useEffect, useMemo, useState } from 'react';
import {
  ShieldCheck,
  BarChart3,
  CheckCircle2,
  XCircle,
  Clock,
  Play,
  Pause,
  Users,
  Music2,
  HardDrive,
  TrendingUp,
  BadgeCheck,
  Trash2,
  Search,
  Calendar,
  Zap,
  MapPin,
  Loader2,
  Activity,
  Disc3,
  Edit3,
  Plus,
  GraduationCap,
  MessageSquare,
  BookOpen,
  Megaphone,
  DollarSign,
  KeyRound,
  Crown,
  Wallet, // NEW: Wallet icon for Support Details
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import {
  Album,
  PlayEventItem,
  ProfileClaimCode,
  Song,
  UserProfile,
  UserRole,
  isAlbumUpcomingPremiere,
  isSongUpcomingPremiere,
} from '../types/music';
import { CoverArt } from './CoverArt';
import { CountdownBadge } from './CountdownBadge';
import { EditArtisteModal } from './EditArtisteModal';
import { EditReleaseModal } from './EditReleaseModal';
import { MessagesView } from './MessagesView';
import { AdminContentMonetizationPanel } from './AdminContentMonetizationPanel';
import { ProvisionArtisteLoginModal } from './ProvisionArtisteLoginModal';
import { SupportModal } from './SupportModal'; // NEW: SupportModal import
import { formatBytes, formatDuration } from '../lib/format';
import { usePlayer } from '../context/PlayerContext';

export type AdminSubTab =
  | 'analytics'
  | 'approvals'
  | 'verses'
  | 'announcements'
  | 'messages'
  | 'users'
  | 'catalog'
  | 'premium'
  | 'adsense';

interface AdminDashboardViewProps {
  adminProfile: UserProfile;
  allSongs: Song[];
  allAlbums: Album[];
  profiles: UserProfile[];
  playEvents: PlayEventItem[];
  unreadMessagesCount?: number;
  initialSubTab?: AdminSubTab;
  onUnreadCountChanged?: (count: number) => void;
  onRefreshAll: () => Promise<void>;
  onOpenArtiste: (artisteId: string) => void;
  onPreviewDailyFeed?: (tab: 'verse' | 'announcements') => void;
}

export const AdminDashboardView: React.FC<AdminDashboardViewProps> = ({
  adminProfile,
  allSongs,
  allAlbums,
  profiles,
  playEvents,
  unreadMessagesCount = 0,
  initialSubTab,
  onUnreadCountChanged,
  onRefreshAll,
  onOpenArtiste,
  onPreviewDailyFeed,
}) => {
  const { currentSong, isPlaying, playSong, togglePlay } = usePlayer();

  const [subTab, setSubTab] = useState<AdminSubTab>(initialSubTab || 'analytics');
  useEffect(() => {
    if (initialSubTab) setSubTab(initialSubTab);
  }, [initialSubTab]);
  const [approvalFilter, setApprovalFilter] = useState<'pending' | 'approved' | 'rejected'>('pending');
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [userSearch, setUserSearch] = useState('');
  const [catalogSearch, setCatalogSearch] = useState('');

  // NEW: Support Gyidi / Artiste Paystack URL & Subaccount Dashboard State
  const [supportModalOpen, setSupportModalOpen] = useState(false);
  const [selectedArtisteForSupport, setSelectedArtisteForSupport] = useState<UserProfile | null>(null);

  const [adminSongs, setAdminSongs] = useState<Song[]>(allSongs);
  const [adminAlbums, setAdminAlbums] = useState<Album[]>(allAlbums);
  const [adminProfiles, setAdminProfiles] = useState<UserProfile[]>(profiles);
  const [claimCodes, setClaimCodes] = useState<ProfileClaimCode[]>([]);

  const [editingArtiste, setEditingArtiste] = useState<UserProfile | null>(null);
  const [artisteModalOpen, setArtisteModalOpen] = useState(false);

  const [provisioningArtiste, setProvisioningArtiste] = useState<UserProfile | null>(null);

  const [editingCatalogSong, setEditingCatalogSong] = useState<Song | null>(null);
  const [editReleaseOpen, setEditReleaseOpen] = useState(false);

  const loadFullAdminData = async () => {
    const [{ data: sData }, { data: aData }, { data: pData }, { data: cData }] = await Promise.all([
      supabase.from('songs').select('*').order('submitted_at', { ascending: false }).limit(1000),
      supabase.from('albums').select('*').order('submitted_at', { ascending: false }).limit(300),
      supabase.from('profiles').select('*').order('created_at', { ascending: false }),
      supabase.from('profile_claim_codes').select('*'),
    ]);
    if (sData) setAdminSongs(sData as Song[]);
    if (aData) setAdminAlbums(aData as Album[]);
    if (pData) setAdminProfiles(pData as UserProfile[]);
    if (cData) setClaimCodes(cData as ProfileClaimCode[]);
  };

  useEffect(() => {
    loadFullAdminData();
  }, [allSongs.length, allAlbums.length, profiles.length]);

  const claimCodeMap = useMemo(
    () => new Map(claimCodes.map((c) => [c.profile_id, c.claim_code])),
    [claimCodes]
  );

  const profileMap = useMemo(
    () => new Map(adminProfiles.map((p) => [p.id, p])),
    [adminProfiles]
  );

  const stats = useMemo(() => {
    const now = Date.now();
    const dayAgo = now - 24 * 3600 * 1000;
    const weekAgo = now - 7 * 24 * 3600 * 1000;

    const pendingSingles = adminSongs.filter((s) => !s.album_id && s.approval_status === 'pending');
    const pendingAlbums = adminAlbums.filter((a) => a.approval_status === 'pending');
    const pendingTotal = pendingSingles.length + pendingAlbums.length;

    const approvedSongs = adminSongs.filter((s) => s.approval_status === 'approved');
    const upcomingPremieres =
      approvedSongs.filter((s) => !s.album_id && isSongUpcomingPremiere(s, now)).length +
      adminAlbums.filter((a) => isAlbumUpcomingPremiere(a, now)).length;

    const totalPlays = adminSongs.reduce((acc, s) => acc + (s.plays_count || 0), 0);
    const totalLikes = adminSongs.reduce((acc, s) => acc + (s.likes_count || 0), 0);
    const totalBytes = adminSongs.reduce((acc, s) => acc + (s.file_size_bytes || 0), 0);

    const plays24h = playEvents.filter((e) => new Date(e.played_at).getTime() >= dayAgo).length;
    const plays7d = playEvents.filter((e) => new Date(e.played_at).getTime() >= weekAgo).length;

    const artistes = adminProfiles.filter((p) => p.role === 'artiste' || p.role === 'admin');
    const sacsuCount = artistes.filter((p) => p.is_sacsu).length;

    const dailyBuckets: Array<{ label: string; count: number }> = [];
    for (let i = 6; i >= 0; i--) {
      const dStart = new Date(now - i * 86400000);
      dStart.setHours(0, 0, 0, 0);
      const dEnd = dStart.getTime() + 86400000;
      const cnt = playEvents.filter((e) => {
        const t = new Date(e.played_at).getTime();
        return t >= dStart.getTime() && t < dEnd;
      }).length;
      dailyBuckets.push({
        label: dStart.toLocaleDateString(undefined, { weekday: 'short' }),
        count: cnt,
      });
    }

    const topSongs = [...approvedSongs]
      .sort((a, b) => b.plays_count - a.plays_count || b.likes_count - a.likes_count)
      .slice(0, 8);

    return {
      pendingTotal,
      pendingSingles,
      pendingAlbums,
      approvedSongs,
      upcomingPremieres,
      totalPlays,
      totalLikes,
      totalBytes,
      plays24h,
      plays7d,
      artistesCount: artistes.length,
      sacsuCount,
      usersCount: adminProfiles.length,
      dailyBuckets,
      topSongs,
    };
  }, [adminSongs, adminAlbums, adminProfiles, playEvents]);

  const handleReviewSong = async (song: Song, approve: boolean, reason?: string) => {
    setBusyId(song.id);
    try {
      const { data, error } = await supabase.rpc('review_song_submission', {
        p_song_id: song.id,
        p_approve: approve,
        p_rejection_reason: reason || null,
      });
      if (error) throw error;
      if (data) {
        const updated = data as Song;
        setAdminSongs((prev) => prev.map((s) => (s.id === song.id ? updated : s)));
      }
      setRejectingId(null);
      setRejectReason('');
      await onRefreshAll();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Action failed.');
    } finally {
      setBusyId(null);
    }
  };

  const handleReviewAlbum = async (album: Album, approve: boolean, reason?: string) => {
    setBusyId(album.id);
    try {
      const { data, error } = await supabase.rpc('review_album_submission', {
        p_album_id: album.id,
        p_approve: approve,
        p_rejection_reason: reason || null,
      });
      if (error) throw error;
      if (data) {
        const updated = data as Album;
        setAdminAlbums((prev) => prev.map((a) => (a.id === album.id ? updated : a)));
        setAdminSongs((prev) =>
          prev.map((s) =>
            s.album_id === album.id
              ? { ...s, approval_status: updated.approval_status }
              : s
          )
        );
      }
      setRejectingId(null);
      setRejectReason('');
      await onRefreshAll();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Album review failed.');
    } finally {
      setBusyId(null);
    }
  };

  const handleToggleVerifyArtiste = async (p: UserProfile) => {
    setBusyId(p.id);
    const { data, error } = await supabase
      .from('profiles')
      .update({ is_verified_artiste: !p.is_verified_artiste })
      .eq('id', p.id)
      .select('*')
      .single();
    if (!error && data) {
      setAdminProfiles((prev) => prev.map((x) => (x.id === p.id ? (data as UserProfile) : x)));
      await onRefreshAll();
    }
    setBusyId(null);
  };

  const handleToggleUserPremium = async (p: UserProfile) => {
    setBusyId(p.id);
    const nextPremium = !p.is_premium;
    const { data, error } = await supabase
      .from('profiles')
      .update({
        is_premium: nextPremium,
        premium_plan: nextPremium ? 'lifetime' : null,
        premium_until: null,
      })
      .eq('id', p.id)
      .select('*')
      .single();
    if (!error && data) {
      setAdminProfiles((prev) => prev.map((x) => (x.id === p.id ? (data as UserProfile) : x)));
      await onRefreshAll();
    }
    setBusyId(null);
  };

  const handleRoleChange = async (p: UserProfile, role: UserRole) => {
    setBusyId(p.id);
    const { data, error } = await supabase
      .from('profiles')
      .update({ role })
      .eq('id', p.id)
      .select('*')
      .single();
    if (!error && data) {
      setAdminProfiles((prev) => prev.map((x) => (x.id === p.id ? (data as UserProfile) : x)));
      await onRefreshAll();
    }
    setBusyId(null);
  };

  const handleDeleteSong = async (song: Song) => {
    if (!window.confirm(`Delete "${song.title}" permanently from Gyidi Nwom?`)) return;
    setBusyId(song.id);
    await supabase.from('songs').delete().eq('id', song.id);
    setAdminSongs((prev) => prev.filter((s) => s.id !== song.id));
    await onRefreshAll();
    setBusyId(null);
  };

  const filteredAlbumQueue = useMemo(
    () => adminAlbums.filter((a) => a.approval_status === approvalFilter),
    [adminAlbums, approvalFilter]
  );

  const filteredSingleQueue = useMemo(() => {
    return adminSongs
      .filter((s) => !s.album_id && s.approval_status === approvalFilter)
      .sort((a, b) => {
        const aUp = a.uploaded_by ? 1 : 0;
        const bUp = b.uploaded_by ? 1 : 0;
        if (aUp !== bUp) return bUp - aUp;
        return new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime();
      });
  }, [adminSongs, approvalFilter]);

  const storageQuotaPercent = Math.min(100, (stats.totalBytes / (1000 * 1024 * 1024)) * 100);
  const maxBucket = Math.max(1, ...stats.dailyBuckets.map((b) => b.count));

  return (
    <div className="max-w-[1450px] mx-auto space-y-6">
      {/* Admin Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-amber-500/30 bg-gradient-to-r from-amber-500/15 via-violet-600/15 to-zinc-900 p-6">
        <div className="flex items-center gap-3.5">
          <div className="h-12 w-12 rounded-2xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-amber-300">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-2xl font-extrabold text-white">Master Admin Dashboard</h2>
            <p className="text-xs text-zinc-300">
              Analytics, Album & Song approvals, Broadcasts & 1-on-1 Artiste messages, User
              management
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 rounded-2xl bg-zinc-950/90 border border-white/10 p-1.5">
          <button
            onClick={() => setSubTab('analytics')}
            className={`flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold transition cursor-pointer ${
              subTab === 'analytics'
                ? 'bg-amber-500 text-zinc-950'
                : 'text-zinc-300 hover:bg-white/5'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            Analytics
          </button>

          <button
            onClick={() => setSubTab('approvals')}
            className={`flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold transition cursor-pointer ${
              subTab === 'approvals'
                ? 'bg-amber-500 text-zinc-950'
                : 'text-zinc-300 hover:bg-white/5'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            Approvals
            {stats.pendingTotal > 0 && (
              <span className="rounded-full bg-rose-500 px-1.5 py-0.5 text-[10px] font-extrabold text-white">
                {stats.pendingTotal}
              </span>
            )}
          </button>

          <button
            onClick={() => setSubTab('verses')}
            className={`flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold transition cursor-pointer ${
              subTab === 'verses'
                ? 'bg-amber-500 text-zinc-950'
                : 'text-zinc-300 hover:bg-white/5'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            Daily Verses (7-Day)
          </button>

          <button
            onClick={() => setSubTab('announcements')}
            className={`flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold transition cursor-pointer ${
              subTab === 'announcements'
                ? 'bg-amber-500 text-zinc-950'
                : 'text-zinc-300 hover:bg-white/5'
            }`}
          >
            <Megaphone className="w-3.5 h-3.5" />
            Announcements
          </button>

          <button
            onClick={() => setSubTab('messages')}
            className={`flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold transition cursor-pointer ${
              subTab === 'messages'
                ? 'bg-amber-500 text-zinc-950'
                : 'text-zinc-300 hover:bg-white/5'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            Artiste DMs
            {unreadMessagesCount > 0 && (
              <span className="rounded-full bg-rose-500 px-1.5 py-0.5 text-[10px] font-extrabold text-white">
                {unreadMessagesCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setSubTab('users')}
            className={`flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold transition cursor-pointer ${
              subTab === 'users'
                ? 'bg-amber-500 text-zinc-950'
                : 'text-zinc-300 hover:bg-white/5'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            Artistes & Users ({stats.usersCount})
          </button>

          <button
            onClick={() => setSubTab('catalog')}
            className={`flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold transition cursor-pointer ${
              subTab === 'catalog'
                ? 'bg-amber-500 text-zinc-950'
                : 'text-zinc-300 hover:bg-white/5'
            }`}
          >
            <Music2 className="w-3.5 h-3.5" />
            Catalog ({adminSongs.length})
          </button>

          <button
            onClick={() => setSubTab('premium')}
            className={`flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold transition cursor-pointer ${
              subTab === 'premium'
                ? 'bg-amber-400 text-zinc-950'
                : 'text-amber-300 hover:bg-amber-500/15 border border-amber-400/25'
            }`}
          >
            <Crown className="w-3.5 h-3.5" />
            Premium &amp; Paystack
          </button>

          <button
            onClick={() => setSubTab('adsense')}
            className={`flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold transition cursor-pointer ${
              subTab === 'adsense'
                ? 'bg-emerald-500 text-zinc-950'
                : 'text-emerald-300 hover:bg-emerald-500/10'
            }`}
          >
            <DollarSign className="w-3.5 h-3.5" />
            Google Ads
          </button>
        </div>
      </div>

      {subTab === 'analytics' && stats.pendingTotal > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-400/40 bg-amber-500/15 px-5 py-3.5">
          <div className="flex items-center gap-2.5 text-sm font-semibold text-amber-200">
            <Clock className="w-5 h-5 text-amber-400" />
            You have {stats.pendingAlbums.length} Album(s) and {stats.pendingSingles.length} Single
            track(s) awaiting pre-listening & approval.
          </div>
          <button
            onClick={() => setSubTab('approvals')}
            className="rounded-full bg-amber-400 px-4 py-1.5 text-xs font-extrabold text-zinc-950 hover:bg-amber-300 cursor-pointer"
          >
            Review Queue Now
          </button>
        </div>
      )}

      {/* SUBTAB 1: ANALYTICS */}
      {subTab === 'analytics' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3.5">
            <div className="rounded-2xl border border-white/10 bg-zinc-900/60 p-4">
              <p className="text-[11px] text-zinc-400 font-medium">Total All-Time Plays</p>
              <p className="text-2xl font-extrabold text-white mt-1 tabular-nums">
                {stats.totalPlays.toLocaleString()}
              </p>
              <p className="text-[11px] text-emerald-400 mt-1">+{stats.plays24h} last 24h</p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-zinc-900/60 p-4">
              <p className="text-[11px] text-zinc-400 font-medium">Approved Catalog</p>
              <p className="text-2xl font-extrabold text-white mt-1 tabular-nums">
                {stats.approvedSongs.length}
              </p>
              <p className="text-[11px] text-zinc-400 mt-1">
                {adminAlbums.filter((a) => a.approval_status === 'approved').length} Albums •{' '}
                {stats.totalLikes} ♥
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-zinc-900/60 p-4">
              <p className="text-[11px] text-zinc-400 font-medium">Pending Approvals</p>
              <p className="text-2xl font-extrabold text-amber-400 mt-1 tabular-nums">
                {stats.pendingTotal}
              </p>
              <p className="text-[11px] text-zinc-400 mt-1">
                {stats.pendingAlbums.length} albums • {stats.pendingSingles.length} singles
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-zinc-900/60 p-4">
              <p className="text-[11px] text-zinc-400 font-medium">Active Premieres</p>
              <p className="text-2xl font-extrabold text-pink-400 mt-1 tabular-nums">
                {stats.upcomingPremieres}
              </p>
              <p className="text-[11px] text-zinc-400 mt-1">Counting down</p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-zinc-900/60 p-4">
              <p className="text-[11px] text-zinc-400 font-medium">Artistes & SACSU</p>
              <p className="text-2xl font-extrabold text-white mt-1 tabular-nums">
                {stats.artistesCount}
              </p>
              <p className="text-[11px] text-cyan-400 mt-1">{stats.sacsuCount} SACSU profiles</p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-zinc-900/60 p-4">
              <div className="flex items-center justify-between">
                <p className="text-[11px] text-zinc-400 font-medium">Supabase Storage</p>
                <HardDrive className="w-3.5 h-3.5 text-amber-400" />
              </div>
              <p className="text-lg font-extrabold text-white mt-1">
                {formatBytes(stats.totalBytes)}
              </p>
              <div className="mt-2 h-1.5 w-full rounded-full bg-white/10 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-emerald-400 to-amber-500"
                  style={{ width: `${storageQuotaPercent}%` }}
                />
              </div>
              <p className="text-[10px] text-zinc-500 mt-1">
                {storageQuotaPercent.toFixed(1)}% of 1 GB Free Plan
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-zinc-900/60 p-4">
              <div className="flex items-center justify-between">
                <p className="text-[11px] text-zinc-400 font-medium">Support Gyidi / Artiste</p>
                <Wallet className="w-3.5 h-3.5 text-amber-400" />
              </div>
              <p className="text-lg font-extrabold text-white mt-1">
                {adminProfiles.filter(p => p.role === 'artiste' || p.id === 'support-gyidi').length}
              </p>
              <p className="text-[10px] text-zinc-500 mt-1">
                Paystack & MoMo Configs Active
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-7 rounded-2xl border border-white/10 bg-zinc-900/60 p-5">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-400" />
                7-Day Platform Stream Activity
              </h3>
              <p className="text-xs text-zinc-400 mb-4">{stats.plays7d} tracked stream events</p>

              <div className="grid grid-cols-7 gap-3 items-end h-44 pt-4 px-2">
                {stats.dailyBuckets.map((b, idx) => {
                  const pct = Math.max(8, Math.round((b.count / maxBucket) * 100));
                  return (
                    <div key={idx} className="flex flex-col items-center gap-2 h-full justify-end">
                      <span className="text-[10px] font-bold text-zinc-300 tabular-nums">
                        {b.count}
                      </span>
                      <div className="w-full max-w-[38px] bg-white/5 rounded-t-xl h-28 flex items-end overflow-hidden">
                        <div
                          className="w-full rounded-t-xl bg-gradient-to-t from-amber-500 via-pink-500 to-violet-500 transition-all"
                          style={{ height: `${pct}%` }}
                        />
                      </div>
                      <span className="text-[11px] text-zinc-400 font-medium">{b.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="lg:col-span-5 rounded-2xl border border-white/10 bg-zinc-900/60 p-5 space-y-4">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Activity className="w-4 h-4 text-emerald-400" />
                Top Streamed Songs
              </h3>
              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {stats.topSongs.map((s, idx) => (
                  <div
                    key={s.id}
                    onClick={() => playSong(s, stats.topSongs)}
                    className="flex items-center justify-between gap-3 rounded-xl bg-zinc-950/60 px-3 py-2 hover:bg-zinc-950 cursor-pointer transition"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="text-xs font-bold text-amber-400 w-4">{idx + 1}</span>
                      <CoverArt
                        title={s.title}
                        theme={s.cover_theme}
                        coverUrl={s.cover_url}
                        size="sm"
                        className="h-8 w-8 rounded-lg flex-shrink-0"
                      />
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-white truncate">{s.title}</p>
                        <p className="text-[11px] text-zinc-400 truncate">{s.artist}</p>
                      </div>
                    </div>
                    <span className="text-xs font-bold text-emerald-300 tabular-nums flex-shrink-0">
                      {s.plays_count} plays
                    </span>
                  </div>
                ))}\n              </div>\n            </div>\n          </div>\n        </div>\n      )}\n\n      {/* SUBTAB 2: ALBUM & SINGLE APPROVALS */}\n      {subTab === 'approvals' && (\n        <div className="space-y-5">\n          <div className="flex flex-wrap items-center justify-between gap-3">\n            <div className="flex items-center gap-2">\n              {(['pending', 'approved', 'rejected'] as const).map((st) => (\n                <button\n                  key={st}\n                  onClick={() => setApprovalFilter(st)}\n                  className={`rounded-full px-4 py-1.5 text-xs font-bold capitalize transition cursor-pointer ${
                    approvalFilter === st
                      ? 'bg-white text-zinc-950'
                      : 'bg-white/5 text-zinc-400 hover:text-white'
                  }`}\n                >\n                  {st}\n                </button>\n              ))}\n            </div>\n            <p className=\"text-xs text-zinc-400\">\n              Pre-listen to every submitted single or album track before approving.\n            </p>\n          </div>\n\n          {filteredAlbumQueue.length === 0 && filteredSingleQueue.length === 0 ? (\n            <div className=\"rounded-2xl border border-white/10 bg-zinc-900/40 p-14 text-center\">\n              <CheckCircle2 className=\"w-10 h-10 text-emerald-400 mx-auto mb-2\" />\n              <p className=\"text-sm font-bold text-white\">\n                No {approvalFilter} album or song submissions\n              </p>\n            </div>\n          ) : (\n            <div className=\"space-y-4\">\n              {filteredAlbumQueue.map((album) => {\n                const tracks = adminSongs\n                  .filter((s) => s.album_id === album.id)\n                  .sort((a, b) => (a.track_number || 0) - (b.track_number || 0));\n                const upcoming = isAlbumUpcomingPremiere(album);\n\n                return (\n                  <div\n                    key={album.id}\n                    className=\"rounded-2xl border border-violet-500/35 bg-zinc-900/75 p-5 space-y-4\"\n                  >\n                    <div className=\"flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4\">\n                      <div className=\"flex items-center gap-4 min-w-0\">\n                        <CoverArt\n                          title={album.title}\n                          category={album.category}\n                          theme={album.cover_theme}\n                          coverUrl={album.cover_url}\n                          size=\"md\"\n                          className=\"h-20 w-20 rounded-2xl flex-shrink-0 border border-white/15\"\n                        />\n                        <div className=\"space-y-1 min-w-0\">\n                          <div className=\"flex flex-wrap items-center gap-2\">\n                            <span className=\"inline-flex items-center gap-1 rounded-full bg-violet-500/20 border border-violet-400/40 px-2.5 py-0.5 text-[10px] font-extrabold text-violet-200\">\n                              <Disc3 className=\"w-3 h-3\" />\n                              FULL ALBUM ({tracks.length} TRACKS)\n                            </span>\n                            {album.is_premiere ? (\n                              <span className=\"inline-flex items-center gap-1 rounded-full bg-amber-500/20 border border-amber-400/40 px-2.5 py-0.5 text-[10px] font-bold text-amber-300\">\n                                <Calendar className=\"w-3 h-3\" />\n                                Premiere:{' '}\n                                {album.premiere_at\n                                  ? new Date(album.premiere_at).toLocaleString()\n                                  : ''}\n                              </span>\n                            ) : (\n                              <span className=\"inline-flex items-center gap-1 rounded-full bg-emerald-500/15 border border-emerald-400/30 px-2.5 py-0.5 text-[10px] font-bold text-emerald-300\">\n                                <Zap className=\"w-3 h-3\" />\n                                Instant Album\n                              </span>\n                            )}\n                          </div>\n                          <h4 className=\"text-lg font-extrabold text-white\">{album.title}</h4>\n                          <p className=\"text-xs text-zinc-300\">\n                            Artiste: <strong className=\"text-amber-300\">{album.artist}</strong>\n                          </p>\n                          {upcoming && album.premiere_at && (\n                            <CountdownBadge targetIso={album.premiere_at} size=\"sm\" />\n                          )}\n                        </div>\n                      </div>\n\n                      <div className=\"flex flex-wrap items-center gap-2\">\n                        {album.approval_status !== 'approved' && (\n                          <button\n                            disabled={busyId === album.id}\n                            onClick={() => handleReviewAlbum(album, true)}\n                            className=\"inline-flex items-center gap-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 px-4 py-2 text-xs font-extrabold text-zinc-950 cursor-pointer\"\n                          >\n                            {busyId === album.id ? (\n                              <Loader2 className=\"w-3.5 h-3.5 animate-spin\" />\n                            ) : (\n                              <CheckCircle2 className=\"w-3.5 h-3.5\" />\n                            )}\n                            {album.is_premiere\n                              ? 'Approve Album & Start Countdown'\n                              : 'Approve & Publish Entire Album'}\n                          </button>\n                        )}\n                        {album.approval_status !== 'rejected' && (\n                          <button\n                            onClick={() => {\n                              setRejectingId(rejectingId === album.id ? null : album.id);\n                              setRejectReason('');\n                            }}\n                            className=\"inline-flex items-center gap-1.5 rounded-xl bg-rose-500/15 border border-rose-500/30 px-3.5 py-2 text-xs font-bold text-rose-300 cursor-pointer\"\n                          >\n                            <XCircle className=\"w-3.5 h-3.5\" />\n                            Reject Album\n                          </button>\n                        )}\n                      </div>\n                    </div>\n\n                    <div className=\"grid grid-cols-1 sm:grid-cols-2 gap-2 pt-3 border-t border-white/10\">\n                      {tracks.map((trk, idx) => {\n                        const playingThis = currentSong?.id === trk.id && isPlaying;\n                        return (\n                          <div\n                            key={trk.id}\n                            className=\"flex items-center justify-between rounded-xl bg-zinc-950/80 border border-white/5 px-3 py-2 text-xs\"\n                          >\n                            <span className=\"truncate text-zinc-200\">\n                              <strong className=\"text-amber-400 mr-1.5\">\n                                {trk.track_number || idx + 1}.\n                              </strong>\n                              {trk.title}{' '}\n                              <span className=\"text-zinc-500\">\n                                ({formatDuration(trk.duration_seconds)})\n                              </span>\n                            </span>\n                            <button\n                              onClick={() => {\n                                if (currentSong?.id === trk.id) togglePlay();\n                                else playSong(trk, tracks, { isPrelisten: true });\n                              }}\n                              className=\"inline-flex items-center gap-1 rounded-lg bg-white/10 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-white/15 cursor-pointer\"\n                            >\n                              {playingThis ? (\n                                <>\n                                  <Pause className=\"w-3 h-3 fill-current\" /> Pause Pre-Listen\n                                </>\n                              ) : (\n                                <>\n                                  <Play className=\"w-3 h-3 fill-current\" /> Pre-Listen\n                                </>\n                              )}\n                            </button>\n                          </div>\n                        );\n                      })}\n                    </div>\n\n                    {rejectingId === album.id && (\n                      <div className=\"pt-2 flex flex-col sm:flex-row gap-2\">\n                        <input\n                          type=\"text\"\n                          value={rejectReason}\n                          onChange={(e) => setRejectReason(e.target.value)}\n                          placeholder=\"Reason / note for the Artiste...\"\n                          className=\"flex-1 rounded-xl border border-white/15 bg-zinc-950 px-3 py-2 text-xs text-white\"\n                        />\n                        <button\n                          onClick={() => handleReviewAlbum(album, false, rejectReason)}\n                          className=\"rounded-xl bg-rose-500 px-4 py-2 text-xs font-bold text-white cursor-pointer\"\n                        >\n                          Confirm Album Rejection\n                        </button>\n                      </div>\n                    )}\n                  </div>\n                );\n              })}\n\n              {filteredSingleQueue.slice(0, 50).map((song) => {\n                const submitter = song.artiste_id ? profileMap.get(song.artiste_id) : null;\n                const isPrelisteningThis = currentSong?.id === song.id;\n                const upcoming = isSongUpcomingPremiere(song);\n\n                return (\n                  <div\n                    key={song.id}\n                    className=\"rounded-2xl border border-white/10 bg-zinc-900/65 p-4 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4\"\n                  >\n                    <div className=\"flex items-start sm:items-center gap-4 min-w-0 flex-1\">\n                      <CoverArt\n                        title={song.title}\n                        category={song.category}\n                        theme={song.cover_theme}\n                        coverUrl={song.cover_url}\n                        size=\"md\"\n                        className=\"h-16 w-16 rounded-2xl flex-shrink-0 border border-white/10\"\n                      />\n\n                      <div className=\"min-w-0 space-y-1\">\n                        <div className=\"flex flex-wrap items-center gap-2\">\n                          <h4 className=\"text-base font-extrabold text-white\">{song.title}</h4>\n                          {song.is_premiere ? (\n                            <span className=\"inline-flex items-center gap-1 rounded-full bg-amber-500/20 border border-amber-400/40 px-2.5 py-0.5 text-[10px] font-extrabold text-amber-300\">\n                              <Calendar className=\"w-3 h-3\" />\n                              Premiere:{' '}\n                              {song.premiere_at\n                                ? new Date(song.premiere_at).toLocaleString()\n                                : 'Scheduled'}\n                            </span>\n                          ) : (\n                            <span className=\"inline-flex items-center gap-1 rounded-full bg-emerald-500/15 border border-emerald-400/30 px-2.5 py-0.5 text-[10px] font-bold text-emerald-300\">\n                              <Zap className=\"w-3 h-3\" />\n                              Single Upload\n                            </span>\n                          )}\n                        </div>\n\n                        <p className=\"text-xs text-zinc-300\">\n                          Artiste: <strong className=\"text-white\">{song.artist}</strong> •{' '}\n                          {formatDuration(song.duration_seconds)} •{' '}\n                          {formatBytes(song.file_size_bytes)}\n                        </p>\n\n                        {submitter && (\n                          <div className=\"flex flex-wrap items-center gap-2 text-[11px] text-zinc-400\">\n                            <button\n                              onClick={() => onOpenArtiste(submitter.id)}\n                              className=\"text-amber-300 hover:underline font-semibold cursor-pointer\"\n                            >\n                              {submitter.real_name || submitter.display_name}\n                            </button>\n                            {submitter.tertiary_institution && (\n                              <span className=\"text-cyan-300\">\n                                <GraduationCap className=\"w-3 h-3 inline mr-0.5\" />\n                                {submitter.tertiary_institution}\n                              </span>\n                            )}\n                            {(submitter.scg_zone || submitter.scg_branch) && (\n                              <span>\n                                <MapPin className=\"w-3 h-3 inline mr-0.5 text-amber-400\" />\n                                {[submitter.scg_zone, submitter.scg_branch]\n                                  .filter(Boolean)\n                                  .join(' — ')}\n                              </span>\n                            )}\n                          </div>\n                        )}\n\n                        {upcoming && song.premiere_at && (\n                          <CountdownBadge targetIso={song.premiere_at} size=\"sm\" />\n                        )}\n                      </div>\n                    </div>\n\n                    <div className=\"flex flex-wrap items-center gap-2\">\n                      <button\n                        onClick={() => {\n                          if (isPrelisteningThis) togglePlay();\n                          else playSong(song, [song], { isPrelisten: true });\n                        }}\n                        className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold border transition cursor-pointer ${
                          isPrelisteningThis && isPlaying
                            ? 'bg-amber-500 text-zinc-950 border-amber-400'
                            : 'bg-white/10 text-white border-white/15 hover:bg-white/15'
                        }`}\n                      >\n                        {isPrelisteningThis && isPlaying ? (\n                          <>\n                            <Pause className=\"w-3 h-3 fill-current\" /> Pause Pre-Listen\n                          </>\n                        ) : (\n                          <>\n                            <Play className=\"w-3 h-3 fill-current\" /> Pre-Listen\n                          </>\n                        )}\n                      </button>\n\n                      {song.approval_status !== 'approved' && (\n                        <button\n                          disabled={busyId === song.id}\n                          onClick={() => handleReviewSong(song, true)}\n                          className=\"inline-flex items-center gap-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 px-4 py-2 text-xs font-extrabold text-zinc-950 cursor-pointer\"\n                        >\n                          <CheckCircle2 className=\"w-3.5 h-3.5\" />\n                          {song.is_premiere ? 'Approve & Start Countdown' : 'Approve & Publish'}\n                        </button>\n                      )}\n\n                      {song.approval_status !== 'rejected' && (\n                        <button\n                          onClick={() => {\n                            setRejectingId(rejectingId === song.id ? null : song.id);\n                            setRejectReason('');\n                          }}\n                          className=\"inline-flex items-center gap-1.5 rounded-xl bg-rose-500/15 border border-rose-500/30 px-3.5 py-2 text-xs font-bold text-rose-300 cursor-pointer\"\n                        >\n                          <XCircle className=\"w-3.5 h-3.5\" />\n                          Reject\n                        </button>\n                      )}\n                    </div>\n\n                    {rejectingId === song.id && (\n                      <div className=\"w-full pt-3 border-t border-white/10 flex flex-col sm:flex-row gap-2\">\n                        <input\n                          type=\"text\"\n                          value={rejectReason}\n                          onChange={(e) => setRejectReason(e.target.value)}\n                          placeholder=\"Reason / note for the Artiste...\"\n                          className=\"flex-1 rounded-xl border border-white/15 bg-zinc-950 px-3 py-2 text-xs text-white\"\n                        />\n                        <button\n                          onClick={() => handleReviewSong(song, false, rejectReason)}\n                          className=\"rounded-xl bg-rose-500 px-4 py-2 text-xs font-bold text-white cursor-pointer\"\n                        >\n                          Confirm Rejection\n                        </button>\n                      </div>\n                    )}\n                  </div>\n                );\n              })}\n            </div>\n          )}\n        </div>\n      )}\n\n      {/* SUBTAB: DAILY VERSES (7-DAY SCHEDULER) */}\n      {subTab === 'verses' && (\n        <AdminContentMonetizationPanel\n          mode=\"verses\"\n          adminProfileId={adminProfile.id}\n          onRefreshGlobal={onRefreshAll}\n          onPreviewDailyFeed={onPreviewDailyFeed}\n        />\n      )}\n\n      {/* SUBTAB: GENERAL ANNOUNCEMENTS */}\n      {subTab === 'announcements' && (\n        <AdminContentMonetizationPanel\n          mode=\"announcements\"\n          adminProfileId={adminProfile.id}\n          onRefreshGlobal={onRefreshAll}\n          onPreviewDailyFeed={onPreviewDailyFeed}\n        />\n      )}\n\n      {/* SUBTAB: PREMIUM PRICING & PAYSTACK BILLING */}\n      {subTab === 'premium' && (\n        <AdminContentMonetizationPanel\n          mode=\"premium\"\n          adminProfileId={adminProfile.id}\n          onRefreshGlobal={onRefreshAll}\n        />\n      )}\n\n      {/* SUBTAB: GOOGLE ADSENSE REVENUE */}\n      {subTab === 'adsense' && (\n        <AdminContentMonetizationPanel\n          mode=\"adsense\"\n          adminProfileId={adminProfile.id}\n          onRefreshGlobal={onRefreshAll}\n        />\n      )}\n\n      {/* SUBTAB 3: MESSAGES & BROADCASTS */}\n      {subTab === 'messages' && (\n        <MessagesView\n          currentProfile={adminProfile}\n          allProfiles={adminProfiles}\n          onUnreadCountChanged={onUnreadCountChanged}\n        />\n      )}\n\n      {/* SUBTAB 4: ARTISTES, SACSU & USERS */}\n      {subTab === 'users' && (\n        <div className="space-y-4">\n          <div className=\"rounded-2xl border border-amber-400/25 bg-amber-500/10 px-4 py-3 text-xs text-zinc-200 flex flex-wrap items-center justify-between gap-2\">\n            <div>\n              <strong className=\"text-amber-300\">How Pre-Created Artistes Log In:</strong> Click{' '}\n              <strong className=\"text-emerald-300\">Login Creds</strong> on any pre-created profile\n              below to either <strong>(1)</strong> create ready-made Email + Password credentials to\n              send them, OR <strong>(2)</strong> copy their secret <strong>Claim Code</strong> so\n              they sign up with their own email & password!\n            </div>\n          </div>\n\n          <div className=\"flex flex-wrap items-center justify-between gap-3\">\n            <div className=\"relative flex-1 max-w-md\">\n              <Search className=\"w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2\" />\n              <input\n                type=\"text\"\n                value={userSearch}\n                onChange={(e) => setUserSearch(e.target.value)}\n                placeholder=\"Search artistes, SACSU campuses, SCG zones, emails...\"\n                className=\"w-full rounded-full border border-white/10 bg-zinc-900 pl-10 pr-4 py-2 text-xs text-white focus:border-amber-500 focus:outline-none\"\n              />\n            </div>\n\n            <button\n              onClick={() => {\n                setEditingArtiste(null);\n                setArtisteModalOpen(true);\n              }}\n              className=\"inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-amber-500 to-pink-600 px-4 py-2 text-xs font-extrabold text-white shadow-lg cursor-pointer\"\n            >\n              <Plus className=\"w-4 h-4\" />\n              Create Artiste / SACSU Profile\n            </button>\n          </div>\n\n          <div className=\"grid grid-cols-1 md:grid-cols-2 gap-3.5\">\n            {adminProfiles\n              .filter((p) => {\n                const q = userSearch.trim().toLowerCase();\n                if (!q) return true;\n                return (\n                  (p.stage_name || '').toLowerCase().includes(q) ||\n                  (p.real_name || '').toLowerCase().includes(q) ||\n                  (p.email || '').toLowerCase().includes(q) ||\n                  (p.scg_zone || '').toLowerCase().includes(q) ||\n                  (p.scg_branch || '').toLowerCase().includes(q) ||\n                  (p.tertiary_institution || '').toLowerCase().includes(q)\n                );\n              })\n              .map((p) => {\n                const code = claimCodeMap.get(p.id);\n                return (\n                  <div\n                    key={p.id}\n                    className=\"rounded-2xl border border-white/10 bg-zinc-900/60 p-4 flex items-start justify-between gap-3\"\n                  >\n                    <div className=\"flex items-start gap-3 min-w-0\">\n                      {p.avatar_url ? (\n                        <img\n                          src={p.avatar_url}\n                          alt=\"\"\n                          className=\"h-12 w-12 rounded-xl object-cover flex-shrink-0\"\n                        />\n                      ) : (\n                        <div className=\"h-12 w-12 rounded-xl bg-white/10 flex items-center justify-center text-sm font-bold text-amber-300 flex-shrink-0\">\n                          {(p.stage_name || p.display_name || p.email || 'U')[0]?.toUpperCase()}\n                        </div>\n                      )}\n                      <div className=\"min-w-0\">\n                        <div className=\"flex items-center gap-1.5 flex-wrap\">\n                          <button\n                            onClick={() => onOpenArtiste(p.id)}\n                            className=\"text-sm font-bold text-white hover:text-amber-300 truncate cursor-pointer\"\n                          >\n                            {p.stage_name || p.display_name || 'Listener'}\n                          </button>\n                          {p.is_verified_artiste && (\n                            <BadgeCheck className=\"w-4 h-4 text-sky-400 flex-shrink-0\" />\n                          )}\n                          {p.is_sacsu && (\n                            <span className=\"rounded-full bg-cyan-500/20 px-2 py-0.5 text-[10px] font-bold text-cyan-300\">\n                              SACSU\n                            </span>\n                          )}\n                          {p.is_precreated && !p.claimed_user_id && (\n                            <span className=\"rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-300\">\n                              Pre-Created (Unclaimed)\n                            </span>\n                          )}\n                          {p.is_precreated && p.claimed_user_id && (\n                            <span className=\"rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-semibold text-emerald-300\">\n                              Claimed ✓\n                            </span>\n                          )}\n                        </div>\n                        {p.real_name && <p className=\"text-xs text-zinc-300\">{p.real_name}</p>}\n                        {p.email && <p className=\"text-[11px] text-zinc-400 truncate\">{p.email}</p>}\n                        {p.is_precreated && !p.claimed_user_id && code && (\n                          <p className=\"text-[11px] font-mono font-bold text-amber-300 mt-0.5\">\n                            Claim Code: {code}\n                          </p>\n                        )}\n                        {p.tertiary_institution && (\n                          <p className=\"text-[11px] text-cyan-300 mt-0.5\">\n                            <GraduationCap className=\"w-3 h-3 inline mr-1\" />\n                            {p.tertiary_institution}\n                          </p>\n                        )}\n                        {(p.scg_zone || p.scg_branch) && (\n                          <p className=\"text-[11px] text-amber-300 mt-0.5\">\n                            {[p.scg_zone, p.scg_branch].filter(Boolean).join(' • ')}\n                          </p>\n                        )}\n                        {/* NEW: Admin-only Paystack URL & Subaccount Display in List */}\n                        {isAdminViewer && (p.role === 'artiste' || p.id === 'support-gyidi') && (\n                          <p className=\"text-[11px] text-amber-400 mt-0.5 font-mono\">\n                            {p.support_provider || 'Paystack Payment Page'}: {p.support_number || 'N/A'} \n                            {p.support_account_name && `(Sub: ${p.support_account_name})`}\n                          </p>\n                        )}\n                      </div>\n                    </div>\n\n                    <div className=\"flex flex-col items-end gap-1.5 flex-shrink-0\">\n                      <select\n                        disabled={busyId === p.id}\n                        value={p.role}\n                        onChange={(e) => handleRoleChange(p, e.target.value as UserRole)}\n                        className=\"rounded-lg border border-white/15 bg-zinc-950 px-2.5 py-1 text-xs font-semibold text-white\"\n                      >\n                        <option value=\"listener\">Listener</option>\n                        <option value=\"artiste\">Artiste</option>\n                        <option value=\"admin\">Admin</option>\n                      </select>\n\n                      <div className=\"flex items-center gap-1.5 flex-wrap justify-end\">\n                        {p.is_precreated && (\n                          <button\n                            onClick={() => setProvisioningArtiste(p)}\n                            className=\"inline-flex items-center gap-1 rounded-lg bg-emerald-500/20 border border-emerald-500/35 px-2.5 py-1 text-[11px] font-bold text-emerald-300 hover:bg-emerald-500/30 cursor-pointer\"\n                            title=\"Create Login Email/Password or Copy Claim Code\"\n                          >\n                            <KeyRound className=\"w-3 h-3\" />\n                            Login Creds\n                          </button>\n                        )}\n\n                        <button\n                          onClick={() => {\n                            setEditingArtiste(p);\n                            setArtisteModalOpen(true);\n                          }}\n                          className=\"inline-flex items-center gap-1 rounded-lg bg-white/10 px-2.5 py-1 text-[11px] font-semibold text-amber-300 hover:bg-white/15 cursor-pointer\"\n                        >\n                          <Edit3 className=\"w-3 h-3\" />\n                          Edit\n                        </button>\n\n                        {/* NEW: Support Details Button for Admin */}\n                        {isAdminViewer && (p.role === 'artiste' || p.id === 'support-gyidi') && (\n                          <button\n                            onClick={() => {\n                              setSelectedArtisteForSupport(p);\n                              setSupportModalOpen(true);\n                            }}\n                            className=\"inline-flex items-center gap-1.5 rounded-lg bg-amber-400/10 border border-amber-400/25 px-2.5 py-1 text-[11px] font-bold text-amber-400 hover:bg-amber-400/20 cursor-pointer\"\n                            title=\"Edit Paystack URL & Subaccount\"\n                          >\n                            <Wallet className=\"w-3 h-3\" />\n                            Support Details\n                          </button>\n                        )}\n\n                        <button\n                          disabled={busyId === p.id}\n                          onClick={() => handleToggleUserPremium(p)}\n                          className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold cursor-pointer ${
                            p.is_premium
                              ? 'bg-amber-500/25 text-amber-200 border border-amber-400/40'
                              : 'bg-white/5 text-zinc-400 hover:text-amber-300'
                          }`}\n                          title=\"Grant or revoke Gyidi Nwom Premium\"\n                        >\n                          <Crown className=\"w-3 h-3\" />\n                          {p.is_premium ? 'Premium ✓' : '+ Premium'}\n                        </button>\n\n                        {(p.role === 'artiste' || p.role === 'admin') && (\n                          <button\n                            disabled={busyId === p.id}\n                            onClick={() => handleToggleVerifyArtiste(p)}\n                            className={`rounded-lg px-2 py-1 text-[11px] font-semibold cursor-pointer ${
                              p.is_verified_artiste\n                                ? 'bg-sky-500/20 text-sky-300'\n                                : 'bg-white/5 text-zinc-400 hover:text-white'\n                            }`}\n                          >\n                            {p.is_verified_artiste ? 'Verified ✓' : 'Verify'}\n                          </button>\n                        )}\n                      </div>\n                    </div>\n                  </div>\n                );\n              })}\n          </div>\n        </div>\n      )}\n\n      {/* SUBTAB 5: ALL CATALOG */}\n      {subTab === 'catalog' && (\n        <div className=\"space-y-4\">\n          <div className=\"relative max-w-md\">\n            <Search className=\"w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2\" />\n            <input\n              type=\"text\"\n              value={catalogSearch}\n              onChange={(e) => setCatalogSearch(e.target.value)}\n              placeholder=\"Filter catalog tracks...\"\n              className=\"w-full rounded-full border border-white/10 bg-zinc-900 pl-10 pr-4 py-2 text-xs text-white focus:border-amber-500 focus:outline-none\"\n            />\n          </div>\n\n          <div className=\"rounded-2xl border border-white/10 bg-zinc-900/50 divide-y divide-white/5\">\n            {adminSongs\n              .filter((s) => {\n                const q = catalogSearch.trim().toLowerCase();\n                if (!q) return true;\n                return (\n                  s.title.toLowerCase().includes(q) || s.artist.toLowerCase().includes(q)\n                );\n              })\n              .slice(0, 80)\n              .map((s) => (\n                <div\n                  key={s.id}\n                  className=\"flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-white/[0.03]\"\n                >\n                  <div className=\"min-w-0\">\n                    <p className=\"text-xs font-bold text-white truncate\">{s.title}</p>\n                    <p className=\"text-[11px] text-zinc-400 truncate\">\n                      {s.artist} • {s.category} • {s.plays_count} plays • {s.approval_status}\n                    </p>\n                  </div>\n                  <div className=\"flex items-center gap-2\">\n                    <button\n                      onClick={() => {\n                        setEditingCatalogSong(s);\n                        setEditReleaseOpen(true);\n                      }}\n                      className=\"rounded-lg bg-white/10 p-1.5 text-amber-300 hover:bg-white/15 cursor-pointer\"\n                      title=\"Edit song\"\n                    >\n                      <Edit3 className=\"w-3 h-3\" />\n                    </button>\n                    <button\n                      onClick={() => playSong(s, [s], { isPrelisten: true })}\n                      className=\"rounded-lg bg-white/10 p-1.5 text-white hover:bg-white/15 cursor-pointer\"\n                    >\n                      <Play className=\"w-3 h-3 fill-white\" />\n                    </button>\n                    <button\n                      disabled={busyId === s.id}\n                      onClick={() => handleDeleteSong(s)}\n                      className=\"rounded-lg bg-rose-500/10 p-1.5 text-rose-400 hover:bg-rose-500/20 cursor-pointer\"\n                      title=\"Delete song\"\n                    >\n                      <Trash2 className=\"w-3 h-3\" />\n                    </button>\n                  </div>\n                </div>\n              ))}\n          </div>\n        </div>\n      )}\n\n      {/* NEW: SupportModal Integration */}\n      <SupportModal\n        key={selectedArtisteForSupport?.id || 'support-gyidi'}\n        isOpen={supportModalOpen}\n        onClose={() => { setSupportModalOpen(false); setSelectedArtisteForSupport(null); }}\n        artiste={selectedArtisteForSupport || { id: 'support-gyidi', display_name: 'Support Gyidi', role: 'admin', approval_status: 'approved' } as UserProfile}\n        isAdminViewer={true}\n      />\n\n      <EditArtisteModal\n        key={editingArtiste?.id || 'new-artiste'}\n        isOpen={artisteModalOpen}\n        onClose={() => setArtisteModalOpen(false)}\n        artiste={editingArtiste}\n        isAdminViewer={true}\n        onSaved={async (saved) => {\n          setAdminProfiles((prev) => {\n            const exists = prev.some((x) => x.id === saved.id);\n            return exists ? prev.map((x) => (x.id === saved.id ? saved : x)) : [saved, ...prev];\n          });\n          await loadFullAdminData();\n          await onRefreshAll();\n        }}\n      />\n\n      <ProvisionArtisteLoginModal\n        isOpen={Boolean(provisioningArtiste)}\n        onClose={() => setProvisioningArtiste(null)}\n        artiste={provisioningArtiste}\n        claimCode={provisioningArtiste ? claimCodeMap.get(provisioningArtiste.id) : null}\n        onProvisioned={async () => {\n          await loadFullAdminData();\n          await onRefreshAll();\n        }}\n      />\n\n      <EditReleaseModal\n        isOpen={editReleaseOpen}\n        onClose={() => setEditReleaseOpen(false)}\n        song={editingCatalogSong}\n        onSaved={onRefreshAll}\n        onDeleted={onRefreshAll}\n      />\n    </div>\n  );\n};\n