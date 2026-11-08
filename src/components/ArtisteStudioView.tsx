import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Mic2,
  UploadCloud,
  CheckCircle2,
  Clock,
  XCircle,
  Camera,
  Save,
  Loader2,
  Eye,
  Play,
  MapPin,
  Wallet,
  BarChart3,
  TrendingUp,
  Heart,
  Disc3,
  Bell,
  GraduationCap,
  Music2,
  Edit3,
  Trash2,
  MessageSquare,
  AlertTriangle,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import {
  Album,
  PlayEventItem,
  Song,
  UserProfile,
  isAlbumUpcomingPremiere,
  isSongUpcomingPremiere,
} from '../types/music';
import { CoverArt } from './CoverArt';
import { CountdownBadge } from './CountdownBadge';
import { EditReleaseModal } from './EditReleaseModal';
import { MessagesView } from './MessagesView';
import { usePlayer } from '../context/PlayerContext';

interface ArtisteStudioViewProps {
  profile: UserProfile;
  authUserId: string;
  allProfiles: UserProfile[];
  onProfileUpdated: (updated: UserProfile) => void;
  onCatalogChanged: () => void;
  onOpenUpload: () => void;
  onViewPublicProfile: (artisteId: string) => void;
  onOpenAlbum: (albumId: string) => void;
  onUnreadCountChanged?: (count: number) => void;
}

type StudioSubTab = 'analytics' | 'releases' | 'messages' | 'profile';

export const ArtisteStudioView: React.FC<ArtisteStudioViewProps> = ({
  profile,
  authUserId,
  allProfiles,
  onProfileUpdated,
  onCatalogChanged,
  onOpenUpload,
  onViewPublicProfile,
  onOpenAlbum,
  onUnreadCountChanged,
}) => {
  const { playSong } = usePlayer();
  const isArtisteOrAdmin = profile.role === 'artiste' || profile.role === 'admin';

  const [subTab, setSubTab] = useState<StudioSubTab>(
    isArtisteOrAdmin ? 'analytics' : 'profile'
  );

  // Profile fields
  const [realName, setRealName] = useState(profile.real_name || '');
  const [stageName, setStageName] = useState(profile.stage_name || profile.display_name || '');
  const [bio, setBio] = useState(profile.bio || '');
  const [scgZone, setScgZone] = useState(profile.scg_zone || '');
  const [scgBranch, setScgBranch] = useState(profile.scg_branch || '');
  const [isSacsu, setIsSacsu] = useState(Boolean(profile.is_sacsu));
  const [tertiaryInstitution, setTertiaryInstitution] = useState(
    profile.tertiary_institution || ''
  );
  const [avatarUrl, setAvatarUrl] = useState(profile.avatar_url || '');
  // Payout details for fan support. Stored in the private artiste_payout_details
  // table, so the saved values are loaded through a guarded RPC rather than the
  // public profile row.
  const [paymentMethod, setPaymentMethod] = useState<'bank' | 'momo'>(
    profile.payment_method === 'momo' ? 'momo' : 'bank'
  );
  const [bankName, setBankName] = useState('');
  const [bankAccountNumber, setBankAccountNumber] = useState('');
  const [bankAccountName, setBankAccountName] = useState('');
  const [momoOperator, setMomoOperator] = useState('');
  const [momoPhoneNumber, setMomoPhoneNumber] = useState('');
  const [payoutLoaded, setPayoutLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedToast, setSavedToast] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [newPassword, setNewPassword] = useState('');
  const [pwdMsg, setPwdMsg] = useState<string | null>(null);
  const [claimCodeInput, setClaimCodeInput] = useState('');
  const [claimMsg, setClaimMsg] = useState<string | null>(null);

  const [mySongs, setMySongs] = useState<Song[]>([]);
  const [myAlbums, setMyAlbums] = useState<Album[]>([]);
  const [myPlayEvents, setMyPlayEvents] = useState<PlayEventItem[]>([]);
  const [remindersCount, setRemindersCount] = useState<number>(0);

  // Edit / Delete Release Modal state
  const [editingSong, setEditingSong] = useState<Song | null>(null);
  const [editingAlbum, setEditingAlbum] = useState<Album | null>(null);
  const [editModalOpen, setEditModalOpen] = useState(false);

  // Payout details live in a table with no client access, so read them back
  // through the guarded RPC. A listener upgrading to an artiste has no row yet
  // and simply starts with an empty form.
  useEffect(() => {
    let active = true;
    void supabase
      .rpc('artiste_get_payout_details')
      .then(({ data, error }) => {
        if (!active || error || !data) return;
        const row = data as Record<string, unknown>;
        if (row.payment_method === 'bank' || row.payment_method === 'momo') {
          setPaymentMethod(row.payment_method);
        }
        setBankName(String(row.bank_name ?? ''));
        setBankAccountNumber(String(row.bank_account_number ?? ''));
        setBankAccountName(String(row.bank_account_name ?? ''));
        setMomoOperator(String(row.momo_operator ?? ''));
        setMomoPhoneNumber(String(row.momo_phone_number ?? ''));
        setPayoutLoaded(true);
      });
    return () => {
      active = false;
    };
  }, []);

  const loadMyCatalogAndAnalytics = useCallback(async () => {
    const [{ data: sData }, { data: aData }] = await Promise.all([
      supabase
        .from('songs')
        .select('*')
        .or(`artiste_id.eq.${profile.id},uploaded_by.eq.${authUserId}`)
        .order('submitted_at', { ascending: false }),
      supabase
        .from('albums')
        .select('*')
        .or(`artiste_id.eq.${profile.id},uploaded_by.eq.${authUserId}`)
        .order('submitted_at', { ascending: false }),
    ]);

    const songsList = (sData || []) as Song[];
    setMySongs(songsList);
    setMyAlbums((aData || []) as Album[]);

    if (songsList.length > 0) {
      const songIds = songsList.map((s) => s.id);
      const [{ data: evData }, { count: remCnt }] = await Promise.all([
        supabase
          .from('play_events')
          .select('*')
          .in('song_id', songIds)
          .order('played_at', { ascending: false })
          .limit(500),
        supabase
          .from('premiere_reminders')
          .select('*', { count: 'exact', head: true })
          .in('song_id', songIds),
      ]);
      setMyPlayEvents((evData || []) as PlayEventItem[]);
      setRemindersCount(remCnt || 0);
    } else {
      setMyPlayEvents([]);
      setRemindersCount(0);
    }
  }, [profile.id, authUserId]);

  useEffect(() => {
    loadMyCatalogAndAnalytics();
  }, [loadMyCatalogAndAnalytics]);

  const handleQuickDeleteSong = async (song: Song) => {
    if (!window.confirm(`Permanently delete "${song.title}" from Gyidi Nnwom?`)) return;
    const { error: delErr } = await supabase.from('songs').delete().eq('id', song.id);
    if (!delErr) {
      if (song.storage_path?.startsWith('uploads/')) {
        await supabase.storage.from('songs').remove([song.storage_path]);
      }
      await loadMyCatalogAndAnalytics();
      onCatalogChanged();
    } else {
      alert(delErr.message);
    }
  };

  const handleQuickDeleteAlbum = async (album: Album) => {
    if (!window.confirm(`Permanently delete album "${album.title}" and all its tracks?`)) return;
    const tracks = mySongs.filter((s) => s.album_id === album.id);
    const paths = tracks.map((t) => t.storage_path).filter((p) => p?.startsWith('uploads/'));
    const { error: delErr } = await supabase.from('albums').delete().eq('id', album.id);
    if (!delErr) {
      if (paths.length > 0) {
        await supabase.storage.from('songs').remove(paths);
      }
      await loadMyCatalogAndAnalytics();
      onCatalogChanged();
    } else {
      alert(delErr.message);
    }
  };

  const analytics = useMemo(() => {
    const now = Date.now();
    const dayAgo = now - 24 * 3600 * 1000;
    const weekAgo = now - 7 * 24 * 3600 * 1000;

    const totalPlays = mySongs.reduce((acc, s) => acc + (s.plays_count || 0), 0);
    const totalLikes = mySongs.reduce((acc, s) => acc + (s.likes_count || 0), 0);
    const plays24h = myPlayEvents.filter(
      (e) => new Date(e.played_at).getTime() >= dayAgo
    ).length;
    const plays7d = myPlayEvents.filter(
      (e) => new Date(e.played_at).getTime() >= weekAgo
    ).length;

    const dailyBuckets: Array<{ label: string; count: number }> = [];
    for (let i = 6; i >= 0; i--) {
      const dStart = new Date(now - i * 86400000);
      dStart.setHours(0, 0, 0, 0);
      const dEnd = dStart.getTime() + 86400000;
      const cnt = myPlayEvents.filter((e) => {
        const t = new Date(e.played_at).getTime();
        return t >= dStart.getTime() && t < dEnd;
      }).length;
      dailyBuckets.push({
        label: dStart.toLocaleDateString(undefined, { weekday: 'short' }),
        count: cnt,
      });
    }

    const rankedSongs = [...mySongs].sort(
      (a, b) => b.plays_count - a.plays_count || b.likes_count - a.likes_count
    );

    const albumStats = myAlbums.map((alb) => {
      const tracks = mySongs.filter((s) => s.album_id === alb.id);
      const plays = tracks.reduce((sum, t) => sum + (t.plays_count || 0), 0);
      const likes = tracks.reduce((sum, t) => sum + (t.likes_count || 0), 0);
      return { album: alb, trackCount: tracks.length, plays, likes };
    });

    return {
      totalPlays,
      totalLikes,
      plays24h,
      plays7d,
      dailyBuckets,
      rankedSongs,
      albumStats,
    };
  }, [mySongs, myAlbums, myPlayEvents]);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSaving(true);
    setError(null);
    try {
      const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
      const path = `avatars/${profile.id}-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from('covers')
        .upload(path, file, { cacheControl: '31536000', upsert: true });
      if (upErr) throw upErr;
      setAvatarUrl(supabase.storage.from('covers').getPublicUrl(path).data.publicUrl);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to upload photo.');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!realName.trim() || !stageName.trim()) {
      setError('Real Name and Stage / Choir / SACSU Name are required.');
      return;
    }
    if (isSacsu) {
      if (!tertiaryInstitution.trim()) {
        setError('Please enter your Tertiary Institution for SACSU.');
        return;
      }
    } else if (!scgZone.trim() || !scgBranch.trim()) {
      setError('SCG Zone and SCG Branch are required.');
      return;
    }

    // Payout details are required: an administrator needs them to create the
    // Paystack subaccount and payment page that pays the artiste out.
    if (paymentMethod === 'bank') {
      if (!bankName.trim() || !bankAccountNumber.trim() || !bankAccountName.trim()) {
        setError('Enter your bank name, account number and account name so payouts can reach you.');
        return;
      }
    } else if (!momoOperator.trim() || !momoPhoneNumber.trim()) {
      setError('Select your mobile money network and enter the number so payouts can reach you.');
      return;
    }

    setSaving(true);
    try {
      const nextRole = profile.role === 'admin' ? 'admin' : 'artiste';
      const { data, error: updErr } = await supabase
        .from('profiles')
        .update({
          role: nextRole,
          real_name: realName.trim(),
          stage_name: stageName.trim(),
          display_name: stageName.trim(),
          bio: bio.trim() || null,
          scg_zone: scgZone.trim() || null,
          scg_branch: scgBranch.trim() || null,
          is_sacsu: isSacsu,
          tertiary_institution: tertiaryInstitution.trim() || null,
          avatar_url: avatarUrl || null,
        })
        .eq('id', profile.id)
        .select('*')
        .single();

      if (updErr) throw updErr;
      onProfileUpdated(data as UserProfile);

      // Save payout details after the role has been set to artiste: the RPC
      // rejects anyone whose profile is not an artiste yet.
      const { error: payoutErr } = await supabase.rpc('artiste_set_payout_details', {
        p_payment_method: paymentMethod,
        p_bank_name: paymentMethod === 'bank' ? bankName.trim() : '',
        p_bank_account_number: paymentMethod === 'bank' ? bankAccountNumber.trim() : '',
        p_bank_account_name: paymentMethod === 'bank' ? bankAccountName.trim() : '',
        p_momo_operator: paymentMethod === 'momo' ? momoOperator.trim() : '',
        p_momo_phone_number: paymentMethod === 'momo' ? momoPhoneNumber.trim() : '',
      });
      if (payoutErr) throw payoutErr;
      setPayoutLoaded(true);

      setSavedToast(true);
      setTimeout(() => setSavedToast(false), 2500);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not update Artiste profile.');
    } finally {
      setSaving(false);
    }
  };

  const maxBucket = Math.max(1, ...analytics.dailyBuckets.map((b) => b.count));
  const standaloneSongs = mySongs.filter((s) => !s.album_id);

  return (
    <div className="max-w-[1380px] mx-auto space-y-6">
      {/* Studio Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-white/10 bg-gradient-to-r from-pink-600/20 via-gold-500/15 to-zinc-900 p-6">
        <div className="flex items-center gap-4">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={stageName}
              className="h-16 w-16 rounded-2xl object-cover border border-gold-400/40"
            />
          ) : (
            <div className="h-16 w-16 rounded-2xl bg-pink-500/20 border border-pink-400/30 flex items-center justify-center text-pink-300">
              <Mic2 className="w-8 h-8" />
            </div>
          )}
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-2xl font-extrabold text-white">
                {isArtisteOrAdmin ? 'Artiste & SACSU Studio' : 'Activate Your Artiste Profile'}
              </h2>
              {isSacsu && (
                <span className="rounded-full bg-cyan-500/20 border border-cyan-400/40 px-2.5 py-0.5 text-[10px] font-bold text-cyan-300">
                  SACSU
                </span>
              )}
            </div>
            <p className="text-xs text-zinc-300 mt-0.5">
              {isArtisteOrAdmin
                ? 'View song analytics, edit or delete uploaded tracks/albums, message other Artistes, and manage fan support'
                : 'Register as an SCG Artiste or SACSU Campus Fellowship below to upload songs, albums & sermon preachings'}
            </p>
          </div>
        </div>

      {/* Why an administrator turned the profile down. Sits at the top of the
          studio so it is seen whichever tab the artiste is on. */}
      {profile.approval_status === 'rejected' && (
        <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-rose-300 flex-shrink-0 mt-0.5" />
            <div className="min-w-0">
              <p className="text-sm font-extrabold text-rose-200">
                Your artiste profile was not approved
              </p>
              <p className="mt-1 text-xs leading-relaxed text-rose-100/90">
                {profile.rejection_reason
                  ? profile.rejection_reason
                  : 'An administrator rejected this profile without leaving a reason. Contact the SCG & SACSU streaming team to find out what needs to change.'}
              </p>
              <p className="mt-2 text-[11px] text-rose-200/80">
                Fix the issue and save your profile again — it goes back into the approval
                queue automatically.
              </p>
            </div>
          </div>
        </div>
      )}

        {isArtisteOrAdmin && (
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={() => onViewPublicProfile(profile.id)}
              className="inline-flex items-center gap-1.5 rounded-full bg-white/10 border border-white/15 px-4 py-2 text-xs font-semibold text-white hover:bg-white/15 cursor-pointer"
            >
              <Eye className="w-3.5 h-3.5 text-gold-400" />
              Public Profile
            </button>
            <button
              onClick={onOpenUpload}
              className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-gold-500 to-pink-600 px-5 py-2 text-xs font-bold text-white shadow-lg cursor-pointer"
            >
              <UploadCloud className="w-4 h-4" />
              Upload Song / Album / Premiere
            </button>
          </div>
        )}
      </div>

      {/* Studio Sub-Navigation */}
      {isArtisteOrAdmin && (
        <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-zinc-900/80 border border-white/10 p-1.5 w-fit">
          <button
            onClick={() => setSubTab('analytics')}
            className={`flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold transition cursor-pointer ${
              subTab === 'analytics'
                ? 'bg-gold-500 text-zinc-950'
                : 'text-zinc-300 hover:bg-white/5'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            Analytics
          </button>

          <button
            onClick={() => setSubTab('releases')}
            className={`flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold transition cursor-pointer ${
              subTab === 'releases'
                ? 'bg-gold-500 text-zinc-950'
                : 'text-zinc-300 hover:bg-white/5'
            }`}
          >
            <Disc3 className="w-3.5 h-3.5" />
            My Albums & Songs ({mySongs.length})
          </button>

          <button
            onClick={() => setSubTab('messages')}
            className={`flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold transition cursor-pointer ${
              subTab === 'messages'
                ? 'bg-gold-500 text-zinc-950'
                : 'text-zinc-300 hover:bg-white/5'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            Messages & Broadcasts
          </button>

          <button
            onClick={() => setSubTab('profile')}
            className={`flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold transition cursor-pointer ${
              subTab === 'profile'
                ? 'bg-gold-500 text-zinc-950'
                : 'text-zinc-300 hover:bg-white/5'
            }`}
          >
            <Mic2 className="w-3.5 h-3.5" />
            Profile & Fan Support
          </button>
        </div>
      )}

      {/* TAB 1: ARTISTE ANALYTICS */}
      {isArtisteOrAdmin && subTab === 'analytics' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3.5">
            <div className="rounded-2xl border border-white/10 bg-zinc-900/60 p-4">
              <p className="text-[11px] text-zinc-400 font-medium">Total Song Streams</p>
              <p className="text-2xl font-extrabold text-white mt-1 tabular-nums">
                {analytics.totalPlays.toLocaleString()}
              </p>
              <p className="text-[11px] text-forest-400 mt-1">
                +{analytics.plays24h} in last 24h
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-zinc-900/60 p-4">
              <p className="text-[11px] text-zinc-400 font-medium">7-Day Streams</p>
              <p className="text-2xl font-extrabold text-gold-400 mt-1 tabular-nums">
                {analytics.plays7d.toLocaleString()}
              </p>
              <p className="text-[11px] text-zinc-400 mt-1">Recent listener velocity</p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-zinc-900/60 p-4">
              <p className="text-[11px] text-zinc-400 font-medium flex items-center gap-1">
                <Heart className="w-3 h-3 text-pink-400" /> Total Likes
              </p>
              <p className="text-2xl font-extrabold text-pink-400 mt-1 tabular-nums">
                {analytics.totalLikes.toLocaleString()}
              </p>
              <p className="text-[11px] text-zinc-400 mt-1">Listener favorites</p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-zinc-900/60 p-4">
              <p className="text-[11px] text-zinc-400 font-medium flex items-center gap-1">
                <Bell className="w-3 h-3 text-gold-300" /> Premiere Reminders
              </p>
              <p className="text-2xl font-extrabold text-white mt-1 tabular-nums">
                {remindersCount}
              </p>
              <p className="text-[11px] text-zinc-400 mt-1">Fans waiting on drops</p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-zinc-900/60 p-4">
              <p className="text-[11px] text-zinc-400 font-medium">Your Catalog</p>
              <p className="text-2xl font-extrabold text-white mt-1 tabular-nums">
                {mySongs.length}
              </p>
              <p className="text-[11px] text-gold-300 mt-1">{myAlbums.length} Albums / EPs</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-5 rounded-2xl border border-white/10 bg-zinc-900/60 p-5">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-gold-400" />
                Your 7-Day Stream Trend
              </h3>
              <p className="text-xs text-zinc-400 mt-0.5">
                Daily plays across all your released songs & sermons
              </p>

              <div className="grid grid-cols-7 gap-2.5 items-end h-44 pt-6 px-1">
                {analytics.dailyBuckets.map((b, idx) => {
                  const pct = Math.max(8, Math.round((b.count / maxBucket) * 100));
                  return (
                    <div key={idx} className="flex flex-col items-center gap-2 h-full justify-end">
                      <span className="text-[10px] font-bold text-zinc-300 tabular-nums">
                        {b.count}
                      </span>
                      <div className="w-full max-w-[34px] bg-white/5 rounded-t-xl h-28 flex items-end overflow-hidden">
                        <div
                          className="w-full rounded-t-xl bg-gradient-to-t from-gold-500 via-pink-500 to-gold-500 transition-all"
                          style={{ height: `${pct}%` }}
                        />
                      </div>
                      <span className="text-[11px] text-zinc-400 font-medium">{b.label}</span>
                    </div>
                  );
                })}
              </div>

              {analytics.albumStats.length > 0 && (
                <div className="mt-5 pt-4 border-t border-white/10 space-y-2">
                  <p className="text-xs font-bold text-white">Album Performance</p>
                  {analytics.albumStats.map(({ album, trackCount, plays, likes }) => (
                    <div
                      key={album.id}
                      onClick={() => onOpenAlbum(album.id)}
                      className="flex items-center justify-between rounded-xl bg-zinc-950/70 px-3 py-2 text-xs hover:bg-zinc-950 cursor-pointer"
                    >
                      <span className="font-semibold text-white truncate">
                        {album.title} ({trackCount} tracks)
                      </span>
                      <span className="text-gold-300 font-bold tabular-nums">
                        {plays} plays • {likes} ♥
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="lg:col-span-7 rounded-2xl border border-white/10 bg-zinc-900/60 p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Music2 className="w-4 h-4 text-pink-400" />
                    How Your Songs Are Doing
                  </h3>
                  <p className="text-xs text-zinc-400">
                    Ranked by total streams and listener likes
                  </p>
                </div>
              </div>

              {analytics.rankedSongs.length === 0 ? (
                <div className="rounded-xl border border-dashed border-white/10 py-12 text-center">
                  <p className="text-sm font-semibold text-zinc-300">No songs uploaded yet</p>
                  <p className="text-xs text-zinc-500 mt-1">
                    Upload your first single or album to see real-time listener analytics here!
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5 max-h-96 overflow-y-auto pr-1">
                  {analytics.rankedSongs.map((song, idx) => {
                    const sharePct =
                      analytics.totalPlays > 0
                        ? Math.round(((song.plays_count || 0) / analytics.totalPlays) * 100)
                        : 0;
                    return (
                      <div
                        key={song.id}
                        className="rounded-xl border border-white/10 bg-zinc-950/70 p-3 space-y-2"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <span className="text-xs font-extrabold text-gold-400 w-5">
                              #{idx + 1}
                            </span>
                            <CoverArt
                              title={song.title}
                              category={song.category}
                              theme={song.cover_theme}
                              coverUrl={song.cover_url}
                              size="sm"
                              className="h-9 w-9 rounded-lg flex-shrink-0"
                            />
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-white truncate">{song.title}</p>
                              <p className="text-[11px] text-zinc-400 truncate">
                                {song.approval_status === 'approved'
                                  ? isSongUpcomingPremiere(song)
                                    ? 'Upcoming Premiere'
                                    : 'Live'
                                  : song.approval_status}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2.5 flex-shrink-0 text-xs">
                            <span className="font-extrabold text-forest-300 tabular-nums">
                              {song.plays_count.toLocaleString()} plays
                            </span>
                            <span className="font-semibold text-pink-300 tabular-nums">
                              {song.likes_count} ♥
                            </span>
                            <button
                              onClick={() => {
                                setEditingAlbum(null);
                                setEditingSong(song);
                                setEditModalOpen(true);
                              }}
                              className="rounded-lg bg-white/10 p-1.5 text-gold-300 hover:bg-white/15 cursor-pointer"
                              title="Edit cover art, title or delete"
                            >
                              <Edit3 className="w-3 h-3" />
                            </button>
                            <button
                              onClick={() => playSong(song, [song], { isPrelisten: true })}
                              className="rounded-lg bg-white/10 p-1.5 text-white hover:bg-white/15 cursor-pointer"
                              title="Play track"
                            >
                              <Play className="w-3 h-3 fill-white" />
                            </button>
                          </div>
                        </div>

                        <div className="h-1.5 w-full rounded-full bg-white/5 overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-gold-400 to-pink-500"
                            style={{ width: `${Math.max(3, sharePct)}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: MY ALBUMS & SONGS (WITH POST-UPLOAD EDIT & DELETE!) */}
      {isArtisteOrAdmin && subTab === 'releases' && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-white/10 bg-zinc-900/60 p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Disc3 className="w-4 h-4 text-gold-400" />
                  Your Albums & Album Premieres ({myAlbums.length})
                </h3>
                <p className="text-xs text-zinc-400">
                  Edit album cover art, rename track titles, or delete albums at any time
                </p>
              </div>
              <button
                onClick={onOpenUpload}
                className="rounded-full bg-gold-500/20 border border-gold-400/40 px-3.5 py-1.5 text-xs font-bold text-gold-200 hover:bg-gold-500/30 cursor-pointer"
              >
                + Upload / Premiere Album
              </button>
            </div>

            {myAlbums.length === 0 ? (
              <p className="text-xs text-zinc-500 py-4">
                No albums uploaded yet. Click &ldquo;Upload Song / Album / Premiere&rdquo; to upload
                a full album with general cover art and track titles.
              </p>
            ) : (
              <div className="space-y-3">
                {myAlbums.map((alb) => {
                  const tracks = mySongs
                    .filter((s) => s.album_id === alb.id)
                    .sort((a, b) => (a.track_number || 0) - (b.track_number || 0));
                  const upcoming = isAlbumUpcomingPremiere(alb);

                  return (
                    <div
                      key={alb.id}
                      className="rounded-xl border border-white/10 bg-zinc-950/75 p-4 space-y-3"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-3.5 min-w-0">
                          <CoverArt
                            title={alb.title}
                            category={alb.category}
                            theme={alb.cover_theme}
                            coverUrl={alb.cover_url}
                            size="md"
                            className="h-14 w-14 rounded-xl flex-shrink-0"
                          />
                          <div className="min-w-0">
                            <p className="text-sm font-extrabold text-white truncate">
                              {alb.title}
                            </p>
                            <p className="text-xs text-zinc-400">
                              {tracks.length} tracks •{' '}
                              {alb.is_premiere ? 'Scheduled Album Premiere' : 'Instant Album'}
                            </p>
                            {alb.approval_status === 'rejected' && alb.rejection_reason && (
                              <p className="text-[11px] text-rose-400 mt-0.5">
                                Admin feedback: {alb.rejection_reason}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          {alb.approval_status === 'pending' && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-gold-500/15 border border-gold-400/30 px-2.5 py-1 text-[11px] font-bold text-gold-300">
                              <Clock className="w-3 h-3" />
                              Pending Approval
                            </span>
                          )}
                          {alb.approval_status === 'approved' && upcoming && alb.premiere_at && (
                            <CountdownBadge targetIso={alb.premiere_at} size="sm" />
                          )}
                          {alb.approval_status === 'approved' && !upcoming && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-forest-500/15 border border-forest-400/30 px-2.5 py-1 text-[11px] font-bold text-forest-300">
                              <CheckCircle2 className="w-3 h-3" />
                              Album Live
                            </span>
                          )}
                          {alb.approval_status === 'rejected' && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/15 border border-rose-400/30 px-2.5 py-1 text-[11px] font-bold text-rose-300">
                              <XCircle className="w-3 h-3" />
                              Rejected
                            </span>
                          )}

                          <button
                            onClick={() => {
                              setEditingSong(null);
                              setEditingAlbum(alb);
                              setEditModalOpen(true);
                            }}
                            className="inline-flex items-center gap-1 rounded-lg bg-white/10 px-2.5 py-1.5 text-xs font-semibold text-gold-300 hover:bg-white/15 cursor-pointer"
                            title="Edit album cover art or track titles"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                            Edit
                          </button>

                          <button
                            onClick={() => handleQuickDeleteAlbum(alb)}
                            className="inline-flex items-center gap-1 rounded-lg bg-rose-500/15 px-2.5 py-1.5 text-xs font-semibold text-rose-300 hover:bg-rose-500/25 cursor-pointer"
                            title="Delete album"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            Delete
                          </button>
                        </div>
                      </div>

                      {tracks.length > 0 && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-2 border-t border-white/5">
                          {tracks.map((t, i) => (
                            <div
                              key={t.id}
                              className="flex items-center justify-between rounded-lg bg-white/[0.03] px-2.5 py-1.5 text-xs"
                            >
                              <span className="truncate text-zinc-200">
                                <strong className="text-gold-400 mr-1.5">
                                  {t.track_number || i + 1}.
                                </strong>
                                {t.title}
                              </span>
                              <div className="flex items-center gap-1.5">
                                <button
                                  onClick={() => {
                                    setEditingAlbum(null);
                                    setEditingSong(t);
                                    setEditModalOpen(true);
                                  }}
                                  className="text-zinc-400 hover:text-gold-300 cursor-pointer"
                                  title="Edit or delete single track"
                                >
                                  <Edit3 className="w-3 h-3" />
                                </button>
                                <button
                                  onClick={() => playSong(t, tracks, { isPrelisten: true })}
                                  className="text-gold-300 hover:text-white cursor-pointer"
                                  title="Preview track"
                                >
                                  <Play className="w-3 h-3 fill-current" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Standalone Singles */}
          <div className="rounded-2xl border border-white/10 bg-zinc-900/60 p-5 space-y-4">
            <div>
              <h3 className="text-base font-bold text-white">
                Single Songs & Sermons ({standaloneSongs.length})
              </h3>
              <p className="text-xs text-zinc-400">
                Edit song name, replace cover art, or delete any uploaded track
              </p>
            </div>

            {standaloneSongs.length === 0 ? (
              <p className="text-xs text-zinc-500 py-4">No standalone singles uploaded yet.</p>
            ) : (
              <div className="space-y-2.5">
                {standaloneSongs.map((song) => {
                  const upcoming = isSongUpcomingPremiere(song);
                  return (
                    <div
                      key={song.id}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-zinc-950/70 p-3"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <CoverArt
                          title={song.title}
                          category={song.category}
                          theme={song.cover_theme}
                          coverUrl={song.cover_url}
                          size="md"
                          className="h-12 w-12 rounded-xl flex-shrink-0"
                        />
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-white truncate">{song.title}</p>
                          <p className="text-xs text-zinc-400 truncate">
                            {song.is_premiere ? 'Premiere Release' : 'Instant Release'} •{' '}
                            {song.plays_count} plays
                          </p>
                          {song.approval_status === 'rejected' && song.rejection_reason && (
                            <p className="text-[11px] text-rose-400 mt-0.5">
                              Admin feedback: {song.rejection_reason}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        {song.approval_status === 'pending' && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-gold-500/15 border border-gold-400/30 px-2.5 py-1 text-[11px] font-bold text-gold-300">
                            <Clock className="w-3 h-3" />
                            Pending
                          </span>
                        )}
                        {song.approval_status === 'approved' && upcoming && song.premiere_at && (
                          <CountdownBadge targetIso={song.premiere_at} size="sm" />
                        )}
                        {song.approval_status === 'approved' && !upcoming && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-forest-500/15 border border-forest-400/30 px-2.5 py-1 text-[11px] font-bold text-forest-300">
                            <CheckCircle2 className="w-3 h-3" />
                            Live
                          </span>
                        )}
                        {song.approval_status === 'rejected' && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/15 border border-rose-400/30 px-2.5 py-1 text-[11px] font-bold text-rose-300">
                            <XCircle className="w-3 h-3" />
                            Rejected
                          </span>
                        )}

                        <button
                          onClick={() => {
                            setEditingAlbum(null);
                            setEditingSong(song);
                            setEditModalOpen(true);
                          }}
                          className="inline-flex items-center gap-1 rounded-lg bg-white/10 px-2.5 py-1.5 text-xs font-semibold text-gold-300 hover:bg-white/15 cursor-pointer"
                          title="Edit cover art or song name"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          Edit
                        </button>

                        <button
                          onClick={() => handleQuickDeleteSong(song)}
                          className="inline-flex items-center gap-1 rounded-lg bg-rose-500/15 px-2.5 py-1.5 text-xs font-semibold text-rose-300 hover:bg-rose-500/25 cursor-pointer"
                          title="Delete song"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Delete
                        </button>

                        <button
                          onClick={() => playSong(song, [song], { isPrelisten: true })}
                          title="Preview audio"
                          className="rounded-lg bg-white/10 p-2 text-white hover:bg-white/15 cursor-pointer"
                        >
                          <Play className="w-3.5 h-3.5 fill-white" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: MESSAGES & BROADCASTS */}
      {isArtisteOrAdmin && subTab === 'messages' && (
        <MessagesView
          currentProfile={profile}
          allProfiles={allProfiles}
          onUnreadCountChanged={onUnreadCountChanged}
        />
      )}

      {/* TAB 4: PROFILE & FAN SUPPORT EDITOR */}
      {(!isArtisteOrAdmin || subTab === 'profile') && (
        <form
          onSubmit={handleSaveProfile}
          className="max-w-2xl rounded-2xl border border-white/10 bg-zinc-900/60 p-6 space-y-4"
        >
          <h3 className="text-base font-bold text-white">
            Artiste / SACSU Identity & Fan Support Account
          </h3>

          <div className="flex items-center gap-3">
            <label className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-zinc-950 px-3.5 py-2 text-xs font-semibold text-gold-300 hover:border-gold-400 cursor-pointer transition">
              <Camera className="w-4 h-4" />
              {avatarUrl ? 'Change Profile Photo' : 'Upload Profile Photo'}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleAvatarUpload}
                className="hidden"
              />
            </label>
          </div>

          <div className="rounded-xl border border-cyan-500/25 bg-cyan-500/10 p-3.5 space-y-2.5">
            <label className="flex items-center gap-2 text-xs font-bold text-cyan-300 cursor-pointer">
              <input
                type="checkbox"
                checked={isSacsu}
                onChange={(e) => setIsSacsu(e.target.checked)}
                className="rounded accent-cyan-400"
              />
              <GraduationCap className="w-4 h-4" />
              SACSU (Tertiary Students&apos; Faction of the Church)
            </label>

            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">
                Tertiary Institution {isSacsu ? '*' : '(Optional)'}
              </label>
              <input
                type="text"
                required={isSacsu}
                value={tertiaryInstitution}
                onChange={(e) => setTertiaryInstitution(e.target.value)}
                placeholder="e.g. KNUST, University of Ghana (Legon), UCC, UEW, UENR..."
                className="w-full rounded-xl border border-white/15 bg-zinc-950 px-3 py-2 text-xs text-white focus:border-cyan-400 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">
                Real Name / Leader *
              </label>
              <input
                type="text"
                required
                value={realName}
                onChange={(e) => setRealName(e.target.value)}
                placeholder="e.g. Seth Boateng"
                className="w-full rounded-xl border border-white/10 bg-zinc-950 px-3 py-2 text-xs text-white focus:border-gold-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">
                Stage / Choir / SACSU Name *
              </label>
              <input
                type="text"
                required
                value={stageName}
                onChange={(e) => setStageName(e.target.value)}
                placeholder={isSacsu ? 'e.g. KNUST SACSU' : 'e.g. Obogu Seth'}
                className="w-full rounded-xl border border-white/10 bg-zinc-950 px-3 py-2 text-xs text-white focus:border-gold-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">
                <MapPin className="w-3 h-3 inline mr-1 text-gold-400" />
                SCG Zone {isSacsu ? '(Optional)' : '*'}
              </label>
              <input
                type="text"
                required={!isSacsu}
                value={scgZone}
                onChange={(e) => setScgZone(e.target.value)}
                placeholder="e.g. Obogu Zone, Ashanti Zone"
                className="w-full rounded-xl border border-white/10 bg-zinc-950 px-3 py-2 text-xs text-white focus:border-gold-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">
                SCG Branch {isSacsu ? '(Optional)' : '*'}
              </label>
              <input
                type="text"
                required={!isSacsu}
                value={scgBranch}
                onChange={(e) => setScgBranch(e.target.value)}
                placeholder="e.g. Obogu Branch"
                className="w-full rounded-xl border border-white/10 bg-zinc-950 px-3 py-2 text-xs text-white focus:border-gold-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1">Short Bio</label>
            <textarea
              rows={2}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Tell listeners about your choir, SACSU fellowship, or music ministry..."
              className="w-full rounded-xl border border-white/10 bg-zinc-950 px-3 py-2 text-xs text-white focus:border-gold-500 focus:outline-none"
            />
          </div>

          <div className="pt-2 border-t border-white/10 space-y-3">
            <div className="rounded-xl border border-gold-500/25 bg-gold-500/10 p-3.5">
              <p className="text-xs font-bold text-gold-300 flex items-center gap-1.5">
                <Wallet className="w-4 h-4" />
                Fan Support &amp; Payouts
              </p>
              <p className="mt-1.5 text-[11px] leading-relaxed text-zinc-300">
                When listeners support you, Paystack pays the money out to you — we never
                hold it. To set that up, an administrator creates your Paystack subaccount
                and payment page using the account details below. They are the only details
                we ask for, they are stored privately, and they are never shown on your
                public profile. Your profile stays hidden from listeners until an
                administrator approves it.
              </p>
            </div>

            <div className="rounded-xl border border-white/10 bg-zinc-950 p-3.5 space-y-3">
              <div>
                <p className="text-xs font-bold text-white">How should we pay you?</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {(['bank', 'momo'] as const).map((option) => (
                    <label
                      key={option}
                      className={`inline-flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-xs font-bold transition ${
                        paymentMethod === option
                          ? 'border-gold-400/50 bg-gold-500/15 text-gold-200'
                          : 'border-white/15 bg-zinc-900 text-zinc-300 hover:border-white/25'
                      }`}
                    >
                      <input
                        type="radio"
                        name="payment-method"
                        checked={paymentMethod === option}
                        onChange={() => setPaymentMethod(option)}
                        className="accent-gold-400"
                      />
                      {option === 'bank' ? 'Bank Account' : 'Mobile Money'}
                    </label>
                  ))}
                </div>
              </div>

              {paymentMethod === 'bank' ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-zinc-300 mb-1">
                      Bank Name *
                    </label>
                    <input
                      type="text"
                      value={bankName}
                      onChange={(e) => setBankName(e.target.value)}
                      placeholder="e.g. GCB Bank"
                      className="w-full rounded-xl border border-white/10 bg-zinc-900 px-3 py-2 text-xs text-white focus:border-gold-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-zinc-300 mb-1">
                      Account Number *
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={bankAccountNumber}
                      onChange={(e) => setBankAccountNumber(e.target.value)}
                      placeholder="e.g. 0123456789"
                      className="w-full rounded-xl border border-white/10 bg-zinc-900 px-3 py-2 text-xs text-white focus:border-gold-500 focus:outline-none"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium text-zinc-300 mb-1">
                      Account Name *
                    </label>
                    <input
                      type="text"
                      value={bankAccountName}
                      onChange={(e) => setBankAccountName(e.target.value)}
                      placeholder="Name exactly as it appears on the account"
                      className="w-full rounded-xl border border-white/10 bg-zinc-900 px-3 py-2 text-xs text-white focus:border-gold-500 focus:outline-none"
                    />
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-zinc-300 mb-1">
                      Mobile Money Network *
                    </label>
                    <select
                      value={momoOperator}
                      onChange={(e) => setMomoOperator(e.target.value)}
                      className="w-full rounded-xl border border-white/10 bg-zinc-900 px-3 py-2 text-xs text-white focus:border-gold-500 focus:outline-none"
                    >
                      <option value="">Select network</option>
                      <option value="MTN">MTN Mobile Money</option>
                      <option value="Vodafone">Vodafone Cash</option>
                      <option value="AirtelTigo">AirtelTigo Money</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-zinc-300 mb-1">
                      Mobile Money Number *
                    </label>
                    <input
                      type="tel"
                      inputMode="tel"
                      value={momoPhoneNumber}
                      onChange={(e) => setMomoPhoneNumber(e.target.value)}
                      placeholder="e.g. 0244123456"
                      className="w-full rounded-xl border border-white/10 bg-zinc-900 px-3 py-2 text-xs text-white focus:border-gold-500 focus:outline-none"
                    />
                  </div>
                </div>
              )}

              {profile.approval_status === 'rejected' && profile.rejection_reason && (
                <p className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-2.5 text-[11px] text-rose-300">
                  <strong>Not approved:</strong> {profile.rejection_reason}
                </p>
              )}
              {profile.approval_status === 'pending' && payoutLoaded && (
                <p className="rounded-lg border border-gold-500/30 bg-gold-500/10 p-2.5 text-[11px] text-gold-200">
                  Details received. An administrator will create your Paystack payment page
                  and approve your profile.
                </p>
              )}
            </div>
          </div>

          {error && (
            <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-2.5 text-xs text-rose-300">
              {error}
            </div>
          )}

          {savedToast && (
            <div className="flex items-center gap-1.5 rounded-xl border border-forest-500/30 bg-forest-500/10 p-2.5 text-xs text-forest-300">
              <CheckCircle2 className="w-4 h-4" />
              Artiste profile saved!
            </div>
          )}

          <button
            type="submit"
            disabled={saving}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-gold-500 to-pink-600 py-2.5 text-xs font-bold text-white shadow-lg cursor-pointer disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {isArtisteOrAdmin ? 'Save Profile Changes' : 'Upgrade & Activate Artiste Account'}
          </button>
        </form>
      )}

      {(subTab === 'profile' || !isArtisteOrAdmin) && (
        <div className="max-w-2xl grid grid-cols-1 md:grid-cols-2 gap-4">
          {!isArtisteOrAdmin && (
            <div className="rounded-3xl border border-forest-500/30 bg-forest-500/10 p-5 space-y-3">
              <h4 className="text-sm font-extrabold text-forest-300">
                Have a Pre-Created Profile Claim Code?
              </h4>
              <p className="text-xs text-zinc-300">
                If Admin already created your Artiste profile (e.g. Obogu Seth, Yaw Baidoo), enter
                your Claim Code below to unlock your existing songs & analytics.
              </p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={claimCodeInput}
                  onChange={(e) => setClaimCodeInput(e.target.value.toUpperCase())}
                  placeholder="GN-OBOGU-B15A"
                  className="flex-1 rounded-xl border border-white/15 bg-zinc-950 px-3 py-2 text-xs font-mono font-bold text-forest-300"
                />
                <button
                  type="button"
                  disabled={saving || !claimCodeInput.trim()}
                  onClick={async () => {
                    setSaving(true);
                    setClaimMsg(null);
                    try {
                      const { data, error: rpcErr } = await supabase.rpc(
                        'claim_precreated_profile_by_code',
                        { p_claim_code: claimCodeInput.trim() }
                      );
                      if (rpcErr) throw rpcErr;
                      if (data) {
                        onProfileUpdated(data as UserProfile);
                        onCatalogChanged();
                        setSubTab('analytics');
                      }
                    } catch (err: unknown) {
                      setClaimMsg(
                        err instanceof Error ? err.message : 'Invalid or expired Claim Code.'
                      );
                    } finally {
                      setSaving(false);
                    }
                  }}
                  className="rounded-xl bg-forest-500 hover:bg-forest-400 px-4 py-2 text-xs font-extrabold text-zinc-950 cursor-pointer disabled:opacity-50"
                >
                  Claim
                </button>
              </div>
              {claimMsg && <p className="text-xs text-rose-300">{claimMsg}</p>}
            </div>
          )}

          <div className="rounded-3xl border border-white/10 bg-zinc-900/60 p-5 space-y-3">
            <h4 className="text-sm font-extrabold text-white">Change Account Password</h4>
            <p className="text-xs text-zinc-400">
              Logged in with temporary credentials from Admin? Set your own private password here.
            </p>
            <div className="flex gap-2">
              <input
                type="password"
                minLength={6}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="New password (min 6 chars)"
                className="flex-1 rounded-xl border border-white/15 bg-zinc-950 px-3 py-2 text-xs text-white"
              />
              <button
                type="button"
                disabled={saving || newPassword.length < 6}
                onClick={async () => {
                  setSaving(true);
                  setPwdMsg(null);
                  const { error: pErr } = await supabase.auth.updateUser({
                    password: newPassword,
                  });
                  setSaving(false);
                  if (pErr) {
                    setPwdMsg(`Error: ${pErr.message}`);
                  } else {
                    setNewPassword('');
                    setPwdMsg('✓ Password updated successfully!');
                  }
                }}
                className="rounded-xl bg-gold-500 hover:bg-gold-400 px-4 py-2 text-xs font-extrabold text-zinc-950 cursor-pointer disabled:opacity-50"
              >
                Update
              </button>
            </div>
            {pwdMsg && <p className="text-xs text-gold-300">{pwdMsg}</p>}
          </div>
        </div>
      )}

      <EditReleaseModal
        isOpen={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        song={editingSong}
        album={editingAlbum}
        albumTracks={
          editingAlbum ? mySongs.filter((s) => s.album_id === editingAlbum.id) : []
        }
        onSaved={async () => {
          await loadMyCatalogAndAnalytics();
          onCatalogChanged();
        }}
        onDeleted={async () => {
          await loadMyCatalogAndAnalytics();
          onCatalogChanged();
        }}
      />
    </div>
  );
};
