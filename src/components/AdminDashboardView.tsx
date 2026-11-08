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
  isProfileApproved,
  SupportSummary,
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

const USER_TYPE_FILTERS: Array<{ id: 'all' | 'artiste' | 'listener' | 'sacsu' | 'admin'; label: string }> = [
  { id: 'all', label: 'All Users' },
  { id: 'artiste', label: 'Artistes' },
  { id: 'listener', label: 'Listeners' },
  { id: 'sacsu', label: 'SACSU' },
  { id: 'admin', label: 'Admins' },
];

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
  const refreshAdminData = () => {
    void loadFullAdminData();
    void onRefreshAll();
  };
  const { currentSong, isPlaying, playSong, togglePlay } = usePlayer();

  const [subTab, setSubTab] = useState<AdminSubTab>(initialSubTab || 'analytics');
  useEffect(() => {
    if (initialSubTab) setSubTab(initialSubTab);
  }, [initialSubTab]);
  const [approvalFilter, setApprovalFilter] = useState<'pending' | 'approved' | 'rejected'>(
    'pending'
  );
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [userSearch, setUserSearch] = useState('');
  const [userTypeFilter, setUserTypeFilter] = useState<
    'all' | 'artiste' | 'listener' | 'sacsu' | 'admin'
  >('all');
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

  const userRows = useMemo(() => {
    const q = userSearch.trim().toLowerCase();
    return adminProfiles.filter((p) => {
      const roleMatch =
        userTypeFilter === 'all' ||
        p.role === userTypeFilter ||
        (userTypeFilter === 'sacsu' && Boolean(p.is_sacsu));
      if (!roleMatch) return false;
      if (!q) return true;
      return (
        (p.stage_name || '').toLowerCase().includes(q) ||
        (p.real_name || '').toLowerCase().includes(q) ||
        (p.email || '').toLowerCase().includes(q) ||
        (p.scg_zone || '').toLowerCase().includes(q) ||
        (p.scg_branch || '').toLowerCase().includes(q) ||
        (p.tertiary_institution || '').toLowerCase().includes(q)
      );
    });
  }, [adminProfiles, userSearch, userTypeFilter]);

  // Redacted support summaries keyed by artiste id. Payout details are no longer on
  // profiles, so the dashboard reads this instead of the dropped columns.
  const [supports, setSupports] = useState<Map<string, SupportSummary>>(new Map());

  useEffect(() => {
    const ids = adminProfiles.filter((p) => p.role === 'artiste').map((p) => p.id);
    if (ids.length === 0) {
      setSupports(new Map());
      return;
    }
    let active = true;
    void supabase
      .from('profile_support_summaries')
      .select('artiste_id, approved, has_paystack_page, payment_page_url, provider, is_placeholder')
      .in('artiste_id', ids)
      .then(({ data, error }) => {
        if (!active) return;
        if (error || !data) {
          setSupports(new Map());
          return;
        }
        setSupports(
          new Map(
            data.map((row) => [
              row.artiste_id as string,
              {
                approved: Boolean(row.approved),
                has_paystack_page: Boolean(row.has_paystack_page),
                payment_page_url: (row.payment_page_url as string | null) ?? null,
                provider: (row.provider as string | null) ?? null,
                is_placeholder: Boolean(row.is_placeholder),
              },
            ])
          )
        );
      });
    return () => {
      active = false;
    };
  }, [adminProfiles]);

  const stats = useMemo(() => {
    const now = Date.now();
    const dayAgo = now - 24 * 3600 * 1000;
    const weekAgo = now - 7 * 24 * 3600 * 1000;

    const pendingSingles = adminSongs.filter((s) => !s.album_id && s.approval_status === 'pending');
    const pendingAlbums = adminAlbums.filter((a) => a.approval_status === 'pending');
    const pendingProfiles = adminProfiles.filter(
      (p) => p.role === 'artiste' && p.approval_status === 'pending'
    );
    const pendingTotal = pendingSingles.length + pendingAlbums.length + pendingProfiles.length;

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
    if (!window.confirm(`Delete "${song.title}" permanently from Gyidi Nnwom?`)) return;
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

  // Artiste profile approval queue. Payout details are no longer on the profile, so the
  // "configured" signal comes from the redacted support summary keyed by artiste id.
  const profileApprovalQueue = useMemo(() => {
    const artistes = adminProfiles.filter((p) => p.role === 'artiste');
    if (approvalFilter === 'pending') return artistes.filter((p) => p.approval_status === 'pending');
    if (approvalFilter === 'rejected') return artistes.filter((p) => p.approval_status === 'rejected');
    return artistes.filter((p) => isProfileApproved(p) && supports.has(p.id));
  }, [adminProfiles, approvalFilter, supports]);

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
                {adminAlbums.filter((a) => a.approval_status === 'approved').length} Albums •
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
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-7 rounded-2xl border border-white/10 bg-zinc-900/60 p-5">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-amber-400" />
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
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUBTAB 2: ALBUM & SINGLE APPROVALS */}
      {subTab === 'approvals' && (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              {(['pending', 'approved', 'rejected'] as const).map((st) => (
                <button
                  key={st}
                  onClick={() => setApprovalFilter(st)}
                  className={`rounded-full px-4 py-1.5 text-xs font-bold capitalize transition cursor-pointer ${
                    approvalFilter === st
                      ? 'bg-white text-zinc-950'
                      : 'bg-white/5 text-zinc-400 hover:text-white'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
            <p className="text-xs text-zinc-400">
              Pre-listen to every submitted single or album track before approving.
            </p>
          </div>

          {/* ARTISTE PROFILE APPROVAL QUEUE (Paystack support pages) */}
          {profileApprovalQueue.length > 0 && (
            <section className="space-y-3 rounded-2xl border border-emerald-500/25 bg-emerald-500/5 p-4">
              <div className="flex items-center gap-2">
                <Wallet className="w-4 h-4 text-emerald-400" />
                <h3 className="text-sm font-extrabold text-white">
                  Artiste Profile {approvalFilter === 'approved' ? 'Support Pages' : 'Approval Queue'} (
                  {profileApprovalQueue.length})
                </h3>
              </div>
              <p className="text-xs text-zinc-400">
                Add the Paystack payment page URL and subaccount code, then approve so listeners can
                support this artiste.
              </p>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                {profileApprovalQueue.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-start justify-between gap-3 rounded-xl border border-white/10 bg-zinc-950/60 p-3"
                  >
                    <div className="flex items-start gap-2.5 min-w-0">
                      {p.avatar_url ? (
                        <img
                          src={p.avatar_url}
                          alt=""
                          className="h-10 w-10 flex-shrink-0 rounded-xl object-cover"
                        />
                      ) : (
                        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-white/10 text-xs font-bold text-amber-300">
                          {(p.stage_name || p.display_name || 'A')[0]?.toUpperCase()}
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="truncate text-xs font-bold text-white">
                          {p.stage_name || p.display_name || p.email || 'Artiste'}
                        </p>
                        <p className="truncate text-[11px] text-zinc-400">
                          {supports.get(p.id)?.payment_page_url
                            ? `${supports.get(p.id)?.provider || 'Paystack'}${supports.get(p.id)?.is_placeholder ? ' • Sample' : ''}`
                            : 'No Paystack page configured'}
                        </p>
                        {supports.get(p.id)?.payment_page_url && (
                          <p className="truncate font-mono text-[10px] text-zinc-500">
                            {supports.get(p.id)?.payment_page_url}
                          </p>
                        )}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setSelectedArtisteForSupport(p);
                        setSupportModalOpen(true);
                      }}
                      className="inline-flex flex-shrink-0 items-center gap-1 rounded-lg border border-emerald-400/30 bg-emerald-500/15 px-2.5 py-1.5 text-[11px] font-bold text-emerald-300 hover:bg-emerald-500/25 cursor-pointer"
                    >
                      <Wallet className="w-3 h-3" />
                      {isProfileApproved(p) ? 'Edit Paystack' : 'Configure & Approve'}
                    </button>
                  </div>
                ))}
              </div>
            </section>
          )}

          {filteredAlbumQueue.length === 0 && filteredSingleQueue.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-zinc-900/40 p-14 text-center">
              <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto mb-2" />
              <p className="text-sm font-bold text-white">
                No {approvalFilter} album or song submissions
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredAlbumQueue.map((album) => {
                const tracks = adminSongs
                  .filter((s) => s.album_id === album.id)
                  .sort((a, b) => (a.track_number || 0) - (b.track_number || 0));
                const upcoming = isAlbumUpcomingPremiere(album);

                return (
                  <div
                    key={album.id}
                    className="rounded-2xl border border-violet-500/35 bg-zinc-900/75 p-5 space-y-4"
                  >
                    <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
                      <div className="flex items-center gap-4 min-w-0">
                        <CoverArt
                          title={album.title}
                          category={album.category}
                          theme={album.cover_theme}
                          coverUrl={album.cover_url}
                          size="md"
                          className="h-20 w-20 rounded-2xl flex-shrink-0 border border-white/15"
                        />
                        <div className="space-y-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="inline-flex items-center gap-1 rounded-full bg-violet-500/20 border border-violet-400/40 px-2.5 py-0.5 text-[10px] font-extrabold text-violet-200">
                              <Disc3 className="w-3 h-3" />
                              FULL ALBUM ({tracks.length} TRACKS)
                            </span>
                            {album.is_premiere ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/20 border border-amber-400/40 px-2.5 py-0.5 text-[10px] font-bold text-amber-300">
                                <Calendar className="w-3 h-3" />
                                Premiere:{' '}
                                {album.premiere_at
                                  ? new Date(album.premiere_at).toLocaleString()
                                  : ''}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 border border-emerald-400/30 px-2.5 py-0.5 text-[10px] font-bold text-emerald-300">
                                <Zap className="w-3 h-3" />
                                Instant Album
                              </span>
                            )}
                          </div>
                          <h4 className="text-lg font-extrabold text-white">{album.title}</h4>
                          <p className="text-xs text-zinc-300">
                            Artiste: <strong className="text-amber-300">{album.artist}</strong>
                          </p>
                          {upcoming && album.premiere_at && (
                            <CountdownBadge targetIso={album.premiere_at} size="sm" />
                          )}
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        {album.approval_status !== 'approved' && (
                          <button
                            disabled={busyId === album.id}
                            onClick={() => handleReviewAlbum(album, true)}
                            className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 px-4 py-2 text-xs font-extrabold text-zinc-950 cursor-pointer"
                          >
                            {busyId === album.id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <CheckCircle2 className="w-3.5 h-3.5" />
                            )}
                            {album.is_premiere
                              ? 'Approve Album & Start Countdown'
                              : 'Approve & Publish Entire Album'}
                          </button>
                        )}
                        {album.approval_status !== 'rejected' && (
                          <button
                            onClick={() => {
                              setRejectingId(rejectingId === album.id ? null : album.id);
                              setRejectReason('');
                            }}
                            className="inline-flex items-center gap-1.5 rounded-xl bg-rose-500/15 border border-rose-500/30 px-3.5 py-2 text-xs font-bold text-rose-300 cursor-pointer"
                          >
                            <XCircle className="w-3.5 h-3.5" />
                            Reject Album
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-3 border-t border-white/10">
                      {tracks.map((trk, idx) => {
                        const playingThis = currentSong?.id === trk.id && isPlaying;
                        return (
                          <div
                            key={trk.id}
                            className="flex items-center justify-between rounded-xl bg-zinc-950/80 border border-white/5 px-3 py-2 text-xs"
                          >
                            <span className="truncate text-zinc-200">
                              <strong className="text-amber-400 mr-1.5">
                                {trk.track_number || idx + 1}.
                              </strong>
                              {trk.title}{' '}
                              <span className="text-zinc-500">
                                ({formatDuration(trk.duration_seconds)})
                              </span>
                            </span>
                            <button
                              onClick={() => {
                                if (currentSong?.id === trk.id) togglePlay();
                                else playSong(trk, tracks, { isPrelisten: true });
                              }}
                              className="inline-flex items-center gap-1 rounded-lg bg-white/10 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-white/15 cursor-pointer"
                            >
                              {playingThis ? (
                                <>
                                  <Pause className="w-3 h-3 fill-current" /> Pause
                                </>
                              ) : (
                                <>
                                  <Play className="w-3 h-3 fill-current" /> Pre-Listen
                                </>
                              )}
                            </button>
                          </div>
                        );
                      })}
                    </div>

                    {rejectingId === album.id && (
                      <div className="pt-2 flex flex-col sm:flex-row gap-2">
                        <input
                          type="text"
                          value={rejectReason}
                          onChange={(e) => setRejectReason(e.target.value)}
                          placeholder="Reason / note for the Artiste..."
                          className="flex-1 rounded-xl border border-white/15 bg-zinc-950 px-3 py-2 text-xs text-white"
                        />
                        <button
                          onClick={() => handleReviewAlbum(album, false, rejectReason)}
                          className="rounded-xl bg-rose-500 px-4 py-2 text-xs font-bold text-white cursor-pointer"
                        >
                          Confirm Album Rejection
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}

              {filteredSingleQueue.slice(0, 50).map((song) => {
                const submitter = song.artiste_id ? profileMap.get(song.artiste_id) : null;
                const isPrelisteningThis = currentSong?.id === song.id;
                const upcoming = isSongUpcomingPremiere(song);

                return (
                  <div
                    key={song.id}
                    className="rounded-2xl border border-white/10 bg-zinc-900/65 p-4 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4"
                  >
                    <div className="flex items-start sm:items-center gap-4 min-w-0 flex-1">
                      <CoverArt
                        title={song.title}
                        category={song.category}
                        theme={song.cover_theme}
                        coverUrl={song.cover_url}
                        size="md"
                        className="h-16 w-16 rounded-2xl flex-shrink-0 border border-white/10"
                      />

                      <div className="min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="text-base font-extrabold text-white">{song.title}</h4>
                          {song.is_premiere ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/20 border border-amber-400/40 px-2.5 py-0.5 text-[10px] font-bold text-amber-300">
                              <Calendar className="w-3 h-3" />
                              Premiere:{' '}
                              {song.premiere_at
                                ? new Date(song.premiere_at).toLocaleString()
                                : 'Scheduled'}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 border border-emerald-400/30 px-2.5 py-0.5 text-[10px] font-bold text-emerald-300">
                              <Zap className="w-3 h-3" />
                              Single Upload
                            </span>
                          )}
                        </div>

                        <p className="text-xs text-zinc-300">
                          Artiste: <strong className="text-white">{song.artist}</strong> •
                          {formatDuration(song.duration_seconds)} •
                          {formatBytes(song.file_size_bytes)}
                        </p>

                        {submitter && (
                          <div className="flex flex-wrap items-center gap-2 text-[11px] text-zinc-400">
                            <button
                              onClick={() => onOpenArtiste(submitter.id)}
                              className="text-amber-300 hover:underline font-semibold cursor-pointer"
                            >
                              {submitter.real_name || submitter.display_name}
                            </button>
                            {submitter.tertiary_institution && (
                              <span className="text-cyan-300">
                                <GraduationCap className="w-3 h-3 inline mr-0.5" />
                                {submitter.tertiary_institution}
                              </span>
                            )}
                            {(submitter.scg_zone || submitter.scg_branch) && (
                              <span>
                                <MapPin className="w-3 h-3 inline mr-0.5 text-amber-400" />
                                {[submitter.scg_zone, submitter.scg_branch]
                                  .filter(Boolean)
                                  .join(' — ')}
                              </span>
                            )}
                          </div>
                        )}

                        {upcoming && song.premiere_at && (
                          <CountdownBadge targetIso={song.premiere_at} size="sm" />
                        )}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        onClick={() => {
                          if (isPrelisteningThis) togglePlay();
                          else playSong(song, [song], { isPrelisten: true });
                        }}
                        className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold border transition cursor-pointer ${
                          isPrelisteningThis && isPlaying
                            ? 'bg-amber-500 text-zinc-950 border-amber-400'
                            : 'bg-white/10 text-white border-white/15 hover:bg-white/15'
                        }`}
                      >
                        {isPrelisteningThis && isPlaying ? (
                          <>
                            <Pause className="w-3 h-3 fill-current" /> Pause Pre-Listen
                          </>
                        ) : (
                          <>
                            <Play className="w-3 h-3 fill-current" /> Pre-Listen
                          </>
                        )}
                      </button>

                      {song.approval_status !== 'approved' && (
                        <button
                          disabled={busyId === song.id}
                          onClick={() => handleReviewSong(song, true)}
                          className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 px-4 py-2 text-xs font-extrabold text-zinc-950 cursor-pointer"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          {song.is_premiere ? 'Approve & Start Countdown' : 'Approve & Publish'}
                        </button>
                      )}

                      {song.approval_status !== 'rejected' && (
                        <button
                          onClick={() => {
                            setRejectingId(rejectingId === song.id ? null : song.id);
                            setRejectReason('');
                          }}
                          className="inline-flex items-center gap-1.5 rounded-xl bg-rose-500/15 border border-rose-500/30 px-3.5 py-2 text-xs font-bold text-rose-300 cursor-pointer"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          Reject
                        </button>
                      )}
                    </div>

                    {rejectingId === song.id && (
                      <div className="w-full pt-3 border-t border-white/10 flex flex-col sm:flex-row gap-2">
                        <input
                          type="text"
                          value={rejectReason}
                          onChange={(e) => setRejectReason(e.target.value)}
                          placeholder="Reason / note for the Artiste..."
                          className="flex-1 rounded-xl border border-white/15 bg-zinc-950 px-3 py-2 text-xs text-white"
                        />
                        <button
                          onClick={() => handleReviewSong(song, false, rejectReason)}
                          className="rounded-xl bg-rose-500 px-4 py-2 text-xs font-bold text-white cursor-pointer"
                        >
                          Confirm Rejection
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* SUBTAB: DAILY VERSES (7-DAY SCHEDULER) */}
      {subTab === 'verses' && (
        <AdminContentMonetizationPanel
          mode="verses"
          adminProfileId={adminProfile.id}
          onRefreshGlobal={onRefreshAll}
          onPreviewDailyFeed={onPreviewDailyFeed}
        />
      )}

      {/* SUBTAB: GENERAL ANNOUNCEMENTS */}
      {subTab === 'announcements' && (
        <AdminContentMonetizationPanel
          mode="announcements"
          adminProfileId={adminProfile.id}
          onRefreshGlobal={onRefreshAll}
          onPreviewDailyFeed={onPreviewDailyFeed}
        />
      )}

      {/* SUBTAB: PREMIUM PRICING & PAYSTACK BILLING */}
      {subTab === 'premium' && (
        <AdminContentMonetizationPanel
          mode="premium"
          adminProfileId={adminProfile.id}
          onRefreshGlobal={onRefreshAll}
        />
      )}

      {/* SUBTAB: GOOGLE ADSENSE REVENUE */}
      {subTab === 'adsense' && (
        <AdminContentMonetizationPanel
          mode="adsense"
          adminProfileId={adminProfile.id}
          onRefreshGlobal={onRefreshAll}
        />
      )}

      {/* SUBTAB 3: MESSAGES & BROADCASTS */}
      {subTab === 'messages' && (
        <MessagesView
          currentProfile={adminProfile}
          allProfiles={adminProfiles}
          onUnreadCountChanged={onUnreadCountChanged}
        />
      )}

      {/* SUBTAB 4: ARTISTES, SACSU & USERS */}
      {subTab === 'users' && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-amber-400/25 bg-amber-500/10 px-4 py-3 text-xs text-zinc-200 flex flex-wrap items-center justify-between gap-2">
            <div>
              <strong className="text-amber-300">How Pre-Created Artistes Log In:</strong> Click
              <strong className="text-emerald-300">Login Creds</strong> on any pre-created profile
              below to either <strong>(1)</strong> create ready-made Email + Password credentials to
              send them, OR <strong>(2)</strong> copy their secret <strong>Claim Code</strong> so
              they sign up with their own email & password!
            </div>
          </div>

            <div className="flex flex-wrap items-center gap-2">
              {USER_TYPE_FILTERS.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setUserTypeFilter(t.id)}
                  className={`rounded-full border px-3 py-1 text-xs font-bold transition cursor-pointer ${
                    userTypeFilter === t.id
                      ? 'bg-amber-500 border-amber-500 text-zinc-950'
                      : 'border-white/10 text-zinc-400 hover:text-zinc-200 hover:border-white/20'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  placeholder="Search artistes, SACSU campuses, SCG zones, emails..."
                  className="w-full rounded-full border border-white/10 bg-zinc-900 pl-10 pr-4 py-2 text-xs text-white focus:border-amber-500 focus:outline-none"
                />
              </div>

            <button
              onClick={() => {
                setEditingArtiste(null);
                setArtisteModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-amber-500 to-pink-600 px-4 py-2 text-xs font-extrabold text-white shadow-lg cursor-pointer flex-shrink-0"
            >
              <Plus className="w-4 h-4" />
              Create Artiste / SACSU Profile
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {userRows.map((p) => {
                const code = claimCodeMap.get(p.id);
                return (
                  <div
                    key={p.id}
                    className="rounded-2xl border border-white/10 bg-zinc-900/60 p-4 min-w-0 flex flex-col h-full gap-3"
                  >
                    <div className="flex items-start gap-4 min-w-0">
                      {p.avatar_url ? (
                        <img
                          src={p.avatar_url}
                          alt=""
                          className="h-14 w-14 rounded-xl object-cover flex-shrink-0"
                        />
                      ) : (
                        <div className="h-14 w-14 rounded-xl bg-white/10 flex items-center justify-center text-sm font-bold text-amber-300 flex-shrink-0">
                          {(p.stage_name || p.display_name || p.email || 'U')[0]?.toUpperCase()}
                        </div>
                      )}
                      <div className="min-w-0 flex flex-col gap-1 overflow-hidden">
                        {/* Name + badges row */}
                        <div className="flex items-center gap-1.5 min-w-0 overflow-hidden">
                          <button
                            onClick={() => onOpenArtiste(p.id)}
                            className="text-sm font-bold text-white hover:text-amber-300 truncate cursor-pointer min-w-0"
                          >
                            {p.stage_name || p.display_name || 'Listener'}
                          </button>
                          {p.is_verified_artiste && (
                            <BadgeCheck className="w-4 h-4 text-sky-400 flex-shrink-0 shrink-0" />
                          )}
                          {p.is_sacsu && (
                            <span className="rounded-full bg-cyan-500/20 px-2 py-0.5 text-[10px] font-bold text-cyan-300 shrink-0 whitespace-nowrap">
                              SACSU
                            </span>
                          )}
                          {p.is_precreated && !p.claimed_user_id && (
                            <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-300 shrink-0 whitespace-nowrap">
                              Pre-Created (Unclaimed)
                            </span>
                          )}
                          {p.is_precreated && p.claimed_user_id && (
                            <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-semibold text-emerald-300 shrink-0 whitespace-nowrap">
                              Claimed ✓
                            </span>
                          )}
                        </div>
                        {/* Details row - single horizontal line, no vertical word wrap */}
                        <div className="flex flex-nowrap items-center gap-1 overflow-hidden min-w-0">
                          {p.real_name && (
                            <span className="text-xs text-zinc-300 truncate">
                              {p.real_name}
                            </span>
                          )}
                          {p.email && (
                            <span className="text-xs text-zinc-400 truncate block min-w-0">
                              {p.email}
                            </span>
                          )}
                          {p.is_precreated && !p.claimed_user_id && code && (
                            <span
                              className="text-[11px] font-mono font-bold text-amber-300 truncate"
                              title={`Claim Code: ${code}`}
                            >
                              Claim Code: {code}
                            </span>
                          )}
                          {p.tertiary_institution && (
                            <span className="text-[11px] text-cyan-300 flex items-center gap-1 shrink-0 truncate whitespace-nowrap">
                              <GraduationCap className="w-3 h-3 shrink-0" />
                              {p.tertiary_institution}
                            </span>
                          )}
                          {(p.scg_zone || p.scg_branch) && (
                            <span className="text-[11px] text-amber-300 flex items-center gap-1 shrink-0 truncate whitespace-nowrap">
                              {[p.scg_zone, p.scg_branch].filter(Boolean).join(' • ')}
                            </span>
                          )}
                        </div>
                        {/* Admin-only approval state + Paystack payout configuration */}
                        {(p.role === 'artiste' || p.role === 'admin') && (
                          <div className="mt-1 flex items-center gap-1.5 min-w-0 overflow-hidden">
                            <span
                              className={`rounded-full px-2 py-0.5 text-[10px] font-bold shrink-0 whitespace-nowrap ${
                                isProfileApproved(p)
                                  ? 'bg-emerald-500/15 text-emerald-300'
                                  : p.approval_status === 'rejected'
                                    ? 'bg-rose-500/15 text-rose-300'
                                    : 'bg-amber-500/15 text-amber-300'
                              }`}
                            >
                              {isProfileApproved(p)
                                ? 'Support Approved'
                                : p.approval_status === 'rejected'
                                  ? 'Support Rejected'
                                  : 'Pending Approval'}
                            </span>
                            {supports.get(p.id)?.has_paystack_page ? (
                              <span className="truncate font-mono text-[10px] text-zinc-400 min-w-0">
                                {supports.get(p.id)?.provider || 'Paystack'}
                                {supports.get(p.id)?.is_placeholder ? ' · Sample' : ''}
                              </span>
                            ) : (
                              <span className="text-[10px] text-zinc-500 truncate min-w-0">
                                No Paystack page configured
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-1.5 flex-shrink-0 min-w-0">
                      <select
                        disabled={busyId === p.id}
                        value={p.role}
                        onChange={(e) => handleRoleChange(p, e.target.value as UserRole)}
                        className="min-w-[100px] rounded-lg border border-white/15 bg-zinc-950 px-2.5 py-1 text-xs font-semibold text-white"
                      >
                        <option value="listener">Listener</option>
                        <option value="artiste">Artiste</option>
                        <option value="admin">Admin</option>
                      </select>

                      <div className="flex items-center gap-1 flex-wrap justify-end min-w-0">
                        {p.is_precreated && (
                          <button
                            onClick={() => setProvisioningArtiste(p)}
                              className="inline-flex items-center gap-1 rounded-lg bg-emerald-500/20 border border-emerald-500/35 px-2.5 py-1 text-[11px] font-bold text-emerald-300 hover:bg-emerald-500/30 cursor-pointer shrink-0"
                              title="Create Login Email/Password or Copy Claim Code"
                            >
                              <KeyRound className="w-3 h-3 shrink-0" />
                              Login Creds
                          </button>
                        )}

                        <button
                          onClick={() => {
                            setEditingArtiste(p);
                            setArtisteModalOpen(true);
                          }}
                            className="inline-flex items-center gap-1 rounded-lg bg-white/10 px-2.5 py-1 text-[11px] font-semibold text-amber-300 hover:bg-white/15 cursor-pointer shrink-0"
                          >
                            <Edit3 className="w-3 h-3 shrink-0" />
                            Edit
                        </button>

                        {/* NEW: Support Details Button for Admin */}
                        {p.role === 'artiste' && (
                          <button
                            onClick={() => {
                              setSelectedArtisteForSupport(p);
                              setSupportModalOpen(true);
                            }}
                              className="inline-flex items-center gap-1.5 rounded-lg bg-amber-400/10 border border-amber-400/25 px-2.5 py-1 text-[11px] font-bold text-amber-400 hover:bg-amber-400/20 cursor-pointer shrink-0"
                              title="Edit Paystack URL & Subaccount"
                            >
                              <Wallet className="w-3 h-3 shrink-0" />
                              Support Details
                          </button>
                        )}

                        <button
                          disabled={busyId === p.id}
                          onClick={() => handleToggleUserPremium(p)}
                          className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold cursor-pointer shrink-0 ${
                            p.is_premium
                              ? 'bg-amber-500/25 text-amber-200 border border-amber-400/40'
                              : 'bg-white/5 text-zinc-400 hover:text-amber-300'
                          }`}
                          title="Grant or revoke Gyidi Nnwom Premium"
                        >
                          <Crown className="w-3 h-3 shrink-0" />
                          {p.is_premium ? 'Premium ✓' : '+ Premium'}
                        </button>

                        {(p.role === 'artiste' || p.role === 'admin') && (
                          <button
                            disabled={busyId === p.id}
                            onClick={() => handleToggleVerifyArtiste(p)}
                            className={`rounded-lg px-2 py-1 text-[11px] font-semibold cursor-pointer shrink-0 ${
                              p.is_verified_artiste
                                ? 'bg-sky-500/20 text-sky-300'
                                : 'bg-white/5 text-zinc-400 hover:text-white'
                            }`}
                          >
                            {p.is_verified_artiste ? 'Verified ✓' : 'Verify'}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* SUBTAB 5: ALL CATALOG */}
      {subTab === 'catalog' && (
        <div className="space-y-4">
          <div className="relative max-w-md">
            <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={catalogSearch}
              onChange={(e) => setCatalogSearch(e.target.value)}
              placeholder="Filter catalog tracks..."
              className="w-full rounded-full border border-white/10 bg-zinc-900 pl-10 pr-4 py-2 text-xs text-white focus:border-amber-500 focus:outline-none"
            />
          </div>

          <div className="rounded-2xl border border-white/10 bg-zinc-900/50 divide-y divide-white/5">
            {adminSongs
              .filter((s) => {
                const q = catalogSearch.trim().toLowerCase();
                if (!q) return true;
                return (
                  s.title.toLowerCase().includes(q) || s.artist.toLowerCase().includes(q)
                );
              })
              .slice(0, 80)
              .map((s) => (
                <div
                  key={s.id}
                  className="flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-white/[0.03]"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-white truncate">{s.title}</p>
                    <p className="text-[11px] text-zinc-400 truncate">
                      {s.artist} • {s.category} • {s.plays_count} plays • {s.approval_status}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setEditingCatalogSong(s);
                        setEditReleaseOpen(true);
                      }}
                      className="rounded-lg bg-white/10 p-1.5 text-amber-300 hover:bg-white/15 cursor-pointer"
                      title="Edit song"
                    >
                      <Edit3 className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => playSong(s, [s], { isPrelisten: true })}
                      className="rounded-lg bg-white/10 p-1.5 text-white hover:bg-white/15 cursor-pointer"
                    >
                      <Play className="w-3 h-3 fill-white" />
                    </button>
                    <button
                      disabled={busyId === s.id}
                      onClick={() => handleDeleteSong(s)}
                      className="rounded-lg bg-rose-500/10 p-1.5 text-rose-400 hover:bg-rose-500/20 cursor-pointer"
                      title="Delete song"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))
            }
          </div>
        </div>
      )}

      {/* NEW: SupportModal Integration */}
      <SupportModal
        key={selectedArtisteForSupport?.id || 'support-gyidi'}
        isOpen={supportModalOpen}
        onClose={() => { setSupportModalOpen(false); setSelectedArtisteForSupport(null); }}
        artiste={selectedArtisteForSupport}
        isAdminViewer={true}
        onSaved={(saved) => {
          if (!saved) return;
          setAdminProfiles((prev) => prev.map((x) => (x.id === saved.id ? saved : x)));
          setSelectedArtisteForSupport(saved);
        }}
        onApproved={(saved) => {
          setAdminProfiles((prev) => prev.map((x) => (x.id === saved.id ? saved : x)));
          setSelectedArtisteForSupport(saved);
          refreshAdminData();
        }}
      />

      <EditArtisteModal
        key={editingArtiste?.id || 'new-artiste'}
        isOpen={artisteModalOpen}
        onClose={() => setArtisteModalOpen(false)}
        artiste={editingArtiste}
        isAdminViewer={true}
        onSaved={async (saved) => {
          setAdminProfiles((prev) => {
            const exists = prev.some((x) => x.id === saved.id);
            return exists ? prev.map((x) => (x.id === saved.id ? saved : x)) : [saved, ...prev];
          });
          await loadFullAdminData();
          await onRefreshAll();
        }}
      />

      <ProvisionArtisteLoginModal
        isOpen={Boolean(provisioningArtiste)}
        onClose={() => setProvisioningArtiste(null)}
        artiste={provisioningArtiste}
        claimCode={provisioningArtiste ? claimCodeMap.get(provisioningArtiste.id) : null}
        onProvisioned={async () => {
          await loadFullAdminData();
          await onRefreshAll();
        }}
      />

      <EditReleaseModal
        isOpen={editReleaseOpen}
        onClose={() => setEditReleaseOpen(false)}
        song={editingCatalogSong}
        onSaved={onRefreshAll}
        onDeleted={onRefreshAll}
      />
    </div>
  );
};