import React, { useEffect, useMemo, useState, useRef, useCallback } from 'react';
import {
  Search,
  Play,
  Shuffle,
  Menu,
  X,
  Sparkles,
  Zap,
  Plus,
  Trash2,
  Music2,
  Mic2,
  Users,
  UploadCloud,
  Heart,
  Flame,
  CalendarClock,
  BadgeCheck,
  MapPin,
  ShieldCheck,
  HeartHandshake,
  Code2,
  ExternalLink,
  Copy,
  Check,
  Radio,
  Disc3,
  GraduationCap,
  Lock,
  BookOpen,
  Megaphone,
  Video,
  CloudDownload,
  RotateCw,
  Smartphone,
  ArrowLeft,
} from 'lucide-react';
import { supabase } from './lib/supabase';
import { recoverPremiumAccount } from './lib/premiumPayment';
import {
  Album,
  Announcement,
  DailyVerseFlyer,
  NavTab,
  PlatformSettings,
  PlayEventItem,
  Playlist,
  Song,
  UserProfile,
  isAlbumPubliclyPlayable,
  isAlbumUpcomingPremiere,
  isSongPubliclyPlayable,
  isSongUpcomingPremiere,
  isUserPremiumActive,
} from './types/music';
import { PlayerProvider, usePlayer } from './context/PlayerContext';
import { Sidebar } from './components/Sidebar';
import { HomeSpotlight } from './components/HomeSpotlight';
import { SongRow } from './components/SongRow';
import { PlayerBar } from './components/PlayerBar';
import { QueueDrawer } from './components/QueueDrawer';
import { CoverArt } from './components/CoverArt';
import { PremiereCard } from './components/PremiereCard';
import { AlbumPremiereCard } from './components/AlbumPremiereCard';
import { AlbumView } from './components/AlbumView';
import { ArtisteProfileView } from './components/ArtisteProfileView';
import { ArtisteStudioView } from './components/ArtisteStudioView';
import { AdminDashboardView, AdminSubTab } from './components/AdminDashboardView';
import { MessagesView } from './components/MessagesView';
import { EditArtisteModal } from './components/EditArtisteModal';
import { AuthModal } from './components/AuthModal';
import { UploadModal } from './components/UploadModal';
import { ThemeToggle } from './components/ThemeToggle';
import { SupportGyidiButton } from './components/SupportGyidiButton';
import BannedScreen from './components/BannedScreen';
import { SupportModal } from './components/SupportModal';
import { DeveloperModal } from './components/DeveloperModal';
import { PlaylistModal } from './components/PlaylistModal';
import { GoogleAdBanner, useGoogleAdSenseScript } from './components/GoogleAdBanner';
import { DailyFeedModal, getTodayUtcDateStr } from './components/DailyFeedModal';
import { LyricsDrawer } from './components/LyricsDrawer';
import { ShareCardModal } from './components/ShareCardModal';
import { LiveStreamUpcomingView } from './components/LiveStreamUpcomingView';
import { InstallAppModal, BeforeInstallPromptEvent } from './components/InstallAppModal';
import { EditReleaseModal } from './components/EditReleaseModal';
import { PremiumBillingView } from './components/PremiumBillingView';
import {
  getOfflineSavedIds,
  removeSongFromOffline,
  saveSongForOffline,
  syncProfileOfflineLibrary,
} from './lib/offlineAudio';
import { clearSermonProgress, getSermonProgressMap } from './lib/sermonProgress';
import { recordPlay, startAnalytics } from './lib/appAnalytics';
import { formatDuration } from './lib/format';

const CATALOG_CACHE_KEY = 'gyidi_catalog_cache_v5';

interface MainAppInnerProps {
  songs: Song[];
  setSongs: React.Dispatch<React.SetStateAction<Song[]>>;
  albums: Album[];
  setAlbums: React.Dispatch<React.SetStateAction<Album[]>>;
  artistes: UserProfile[];
  setArtistes: React.Dispatch<React.SetStateAction<UserProfile[]>>;
  playEvents: PlayEventItem[];
  platformSettings: PlatformSettings | null;
  verseFlyers: DailyVerseFlyer[];
  announcements: Announcement[];
  loadingCatalog: boolean;
  userId: string | null;
  userEmail: string | null;
  userProfile: UserProfile | null;
  setUserProfile: React.Dispatch<React.SetStateAction<UserProfile | null>>;
  playableSongs: Song[];
  trendingSongs: Song[];
  listeningNowFeed: Array<{ song: Song; playedAt: string }>;
  guestUnlockedIds: Set<string>;
  fetchPlatformData: () => Promise<void>;
  openAccountPrompt: (reason?: string, defaultArtiste?: boolean) => void;
}

const MainAppInner: React.FC<MainAppInnerProps> = ({
  songs,
  setSongs,
  albums,
  setAlbums,
  artistes,
  setArtistes,
  playEvents,
  platformSettings,
  verseFlyers,
  announcements,
  loadingCatalog,
  userId,
  userEmail,
  userProfile,
  setUserProfile,
  playableSongs,
  trendingSongs,
  listeningNowFeed,
  guestUnlockedIds,
  fetchPlatformData,
  openAccountPrompt,
}) => {
  const {
    currentSong,
    startupLatencyMs,
    recentlyPlayedIds,
    playSong,
    warmTrack,
    isPlaying,
    autoplayBlocked,
    resumePlayback,
  } = usePlayer();

  // Read through refs so the analytics session is registered once on mount
  // rather than being torn down every time playback pauses or resumes.
  const userIdRef = useRef(userId);
  userIdRef.current = userId;
  const isPlayingRef = useRef(isPlaying);
  isPlayingRef.current = isPlaying;

  // First-party usage analytics. Fire-and-forget by design: a failed beacon
  // must never interrupt playback or surface an error to the listener.
  useEffect(
    () =>
      startAnalytics({
        getUserId: () => userIdRef.current,
        isListening: () => isPlayingRef.current,
      }),
    []
  );

  // One play per track start, not per second of playback.
  useEffect(() => {
    if (!currentSong?.id) return;
    recordPlay(() => userIdRef.current);
  }, [currentSong?.id]);

  const isAuthenticated = Boolean(userId);
  const [nowTick, setNowTick] = useState<number>(() => Date.now());
  const isPremium = useMemo(
    () => isUserPremiumActive(userProfile, platformSettings, nowTick),
    [userProfile, platformSettings, nowTick]
  );

  const [activeTab, setActiveTab] = useState<NavTab>(() => new URLSearchParams(window.location.search).has('payment_return') ? 'premium' : 'discover');
  const [tabHistory, setTabHistory] = useState<NavTab[]>([]);
  const [premiumPromptReason, setPremiumPromptReason] = useState<string | null>(null);
  const [selectedArtisteId, setSelectedArtisteId] = useState<string | null>(null);
  const [selectedAlbumId, setSelectedAlbumId] = useState<string | null>(null);
  const [artisteDirectoryFilter, setArtisteDirectoryFilter] = useState<
    'all' | 'curated' | 'sacsu'
  >('all');
  const [institutionFilter, setInstitutionFilter] = useState<string>('');

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedChoir, setSelectedChoir] = useState<string>('All');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [sortBy, setSortBy] = useState<'title' | 'popular' | 'duration' | 'newest'>('title');
  const [visibleCount, setVisibleCount] = useState(80);
  const [copiedInlineMomo, setCopiedInlineMomo] = useState(false);
  const [unreadMessagesCount, setUnreadMessagesCount] = useState(0);

  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [remindedIds, setRemindedIds] = useState<Set<string>>(new Set());
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [activePlaylistId, setActivePlaylistId] = useState<string | null>(null);

  const navigateToTab = useCallback(
    (nextTab: NavTab) => {
      setActiveTab((prev) => {
        if (prev !== nextTab) {
          setTabHistory((h) => [...h.slice(-15), prev]);
        }
        return nextTab;
      });
    },
    []
  );

  const handleGoBack = useCallback(() => {
    if (selectedAlbumId) {
      setSelectedAlbumId(null);
      return;
    }
    if (selectedArtisteId) {
      setSelectedArtisteId(null);
      return;
    }
    if (activePlaylistId) {
      setActivePlaylistId(null);
      return;
    }
    setTabHistory((prev) => {
      if (prev.length === 0) {
        setActiveTab('discover');
        return [];
      }
      const nextHist = [...prev];
      const previousTab = nextHist.pop() || 'discover';
      setActiveTab(previousTab);
      return nextHist;
    });
  }, [selectedAlbumId, selectedArtisteId, activePlaylistId]);

  const handleCloseSection = useCallback(() => {
    setSelectedAlbumId(null);
    setSelectedArtisteId(null);
    setActivePlaylistId(null);
    setPremiumPromptReason(null);
    setTabHistory([]);
    setActiveTab('discover');
  }, []);

  const openPremiumPrompt = useCallback(
    (reason: string) => {
      setPremiumPromptReason(reason);
      navigateToTab('premium');
    },
    [navigateToTab]
  );

  // Modals & Drawers
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [queueOpen, setQueueOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [createArtisteOpen, setCreateArtisteOpen] = useState(false);
  const [supportOpen, setSupportOpen] = useState(false);
  const [developerOpen, setDeveloperOpen] = useState(false);
  const [playlistModalSong, setPlaylistModalSong] = useState<Song | null>(null);
  const [playlistModalOpen, setPlaylistModalOpen] = useState(false);
  const [dailyFeedOpen, setDailyFeedOpen] = useState(false);
  const [dailyFeedInitialTab, setDailyFeedInitialTab] = useState<
    'verse' | 'announcements' | undefined
  >(undefined);
  const [adminInitialSubTab, setAdminInitialSubTab] = useState<AdminSubTab | undefined>(undefined);
  const [seenFeedCounter, setSeenFeedCounter] = useState(0);

  // Phase 6: Lyrics, Share Status Card, Offline PWA, & Sermon Filters + Resume
  const [lyricsDrawerSong, setLyricsDrawerSong] = useState<Song | null>(null);
  const [shareCardSong, setShareCardSong] = useState<Song | null>(null);
  const [shareCardInitialQuote, setShareCardInitialQuote] = useState<string>('');
  const [editingLyricsSong, setEditingLyricsSong] = useState<Song | null>(null);
  const [installAppOpen, setInstallAppOpen] = useState(false);
  const [deferredInstallPrompt, setDeferredInstallPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [isAppInstalled, setIsAppInstalled] = useState<boolean>(() =>
    typeof window !== 'undefined' &&
    window.matchMedia?.('(display-mode: standalone)').matches
  );
  const [offlineSavedIds, setOfflineSavedIds] = useState<Set<string>>(() =>
    getOfflineSavedIds(userId)
  );
  const [sermonPreacherFilter, setSermonPreacherFilter] = useState<string>('All');
  const [sermonTopicFilter, setSermonTopicFilter] = useState<string>('All');
  const [sermonBookFilter, setSermonBookFilter] = useState<string>('All');
  const [sermonProgressTick, setSermonProgressTick] = useState(0);

  useEffect(() => {
    if (!userId) {
      setOfflineSavedIds(new Set());
      return;
    }
    setOfflineSavedIds(getOfflineSavedIds(userId));
    syncProfileOfflineLibrary(userId).then((synced) => {
      setOfflineSavedIds(synced);
    });
  }, [userId]);

  useEffect(() => {
    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredInstallPrompt(e as BeforeInstallPromptEvent);
    };
    const onAppInstalled = () => {
      setIsAppInstalled(true);
      setDeferredInstallPrompt(null);
    };
    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onAppInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onAppInstalled);
    };
  }, []);

  const sermonProgressMap = useMemo(() => {
    void nowTick;
    void sermonProgressTick;
    return getSermonProgressMap(userId);
  }, [userId, nowTick, sermonProgressTick, currentSong?.id]);

  const handleToggleOfflineSave = useCallback(
    async (song: Song) => {
      if (!userId) {
        openAccountPrompt('Create an account to save songs to your profile for offline listening!');
        return;
      }
      if (!isPremium) {
        openPremiumPrompt(
          'Saving songs & sermons to your profile for zero-data offline listening is a Gyidi Nnwom Premium feature.'
        );
        return;
      }
      const currentlySaved = offlineSavedIds.has(song.id);
      if (currentlySaved) {
        await removeSongFromOffline(song, userId);
      } else {
        await saveSongForOffline(song, userId);
      }
      setOfflineSavedIds(getOfflineSavedIds(userId));
    },
    [offlineSavedIds, userId, isPremium, openAccountPrompt, openPremiumPrompt]
  );

  const handleRequestPlaylistModal = useCallback(
    (song: Song | null) => {
      if (!userId) {
        openAccountPrompt('Create an account to create and manage playlists!');
        return;
      }
      if (!isPremium) {
        openPremiumPrompt(
          'Adding songs to playlists and building custom worship sets is a Gyidi Nnwom Premium feature.'
        );
        return;
      }
      setPlaylistModalSong(song);
      setPlaylistModalOpen(true);
    },
    [userId, isPremium, openAccountPrompt, openPremiumPrompt]
  );

  const handleOpenLyrics = (song: Song) => {
    if (!isPremium) {
      openPremiumPrompt('Viewing song lyrics is a Gyidi Nnwom Premium feature.');
      return;
    }
    setLyricsDrawerSong(song);
  };

  const handleOpenShareCard = (song: Song, quote = '') => {
    if (!isPremium) {
      openPremiumPrompt('Sharing songs and WhatsApp Status cards is a Gyidi Nnwom Premium feature.');
      return;
    }
    setShareCardInitialQuote(quote);
    setShareCardSong(song);
  };

  const canViewerEditSong = useCallback(
    (song: Song | null) => {
      if (!song || !userProfile) return false;
      if (userProfile.role === 'admin') return true;
      return Boolean(song.artiste_id && song.artiste_id === userProfile.id);
    },
    [userProfile]
  );

  const todayDateStr = useMemo(() => getTodayUtcDateStr(), [nowTick]);

  const activePopupVerse = useMemo(() => {
    return (
      verseFlyers.find(
        (f) =>
          f.is_active &&
          f.show_popup &&
          f.scheduled_date === todayDateStr &&
          new Date(f.publish_at).getTime() <= nowTick
      ) || null
    );
  }, [verseFlyers, todayDateStr, nowTick]);

  const activeRoleAnnouncements = useMemo(() => {
    const role = userProfile?.role || 'listener';
    return announcements.filter((a) => {
      if (!a.is_active) return false;
      if (new Date(a.publish_at).getTime() > nowTick) return false;
      if (a.expires_at && new Date(a.expires_at).getTime() <= nowTick) return false;
      if (role === 'admin') return true;
      if (a.audience === 'all') return true;
      if (a.audience === 'artistes' && role === 'artiste') return true;
      if (a.audience === 'listeners' && role === 'listener') return true;
      return false;
    });
  }, [announcements, userProfile?.role, nowTick]);

  const unseenFeedState = useMemo(() => {
    void seenFeedCounter;
    const storageKey = `gyidi_seen_feed_v1_${userId || 'guest'}`;
    let seenIds: string[] = [];
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) seenIds = JSON.parse(raw) as string[];
    } catch {
      seenIds = [];
    }
    const seenSet = new Set(seenIds);
    const hasUnseenVerse = Boolean(activePopupVerse && !seenSet.has(activePopupVerse.id));
    const hasUnseenAnn = activeRoleAnnouncements.some((a) => a.show_popup && !seenSet.has(a.id));
    return {
      storageKey,
      hasUnseenVerse,
      hasUnseenAnn,
      hasAnyUnseen: hasUnseenVerse || hasUnseenAnn,
    };
  }, [userId, activePopupVerse, activeRoleAnnouncements, seenFeedCounter]);

  const markCurrentFeedSeen = useCallback(() => {
    const storageKey = `gyidi_seen_feed_v1_${userId || 'guest'}`;
    try {
      const raw = localStorage.getItem(storageKey);
      const list = raw ? (JSON.parse(raw) as string[]) : [];
      const set = new Set(list);
      if (activePopupVerse) set.add(activePopupVerse.id);
      for (const a of activeRoleAnnouncements) {
        set.add(a.id);
      }
      localStorage.setItem(storageKey, JSON.stringify(Array.from(set).slice(-120)));
      setSeenFeedCounter((c) => c + 1);
    } catch {
      // ignore storage errors
    }
  }, [userId, activePopupVerse, activeRoleAnnouncements]);

  // Automatically pop up Daily Bible Verse Flyer (Premium) & Announcements on Listener & Artiste accounts!
  useEffect(() => {
    if (!isAuthenticated || !userId) return;
    if (isPremium && unseenFeedState.hasUnseenVerse) {
      setDailyFeedInitialTab('verse');
      setDailyFeedOpen(true);
    } else if (unseenFeedState.hasUnseenAnn) {
      setDailyFeedInitialTab('announcements');
      setDailyFeedOpen(true);
    }
  }, [
    isAuthenticated,
    userId,
    isPremium,
    unseenFeedState.hasUnseenVerse,
    unseenFeedState.hasUnseenAnn,
  ]);

  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const handledDeepLinkRef = useRef(false);
  const [sharedTrackTitle, setSharedTrackTitle] = useState<string | null>(null);

  useEffect(() => {
    const id = window.setInterval(() => setNowTick(Date.now()), 10000);
    return () => window.clearInterval(id);
  }, []);

  // Poll unread messages count for Artistes & Admin
  useEffect(() => {
    if (!userProfile || (userProfile.role !== 'artiste' && userProfile.role !== 'admin')) {
      setUnreadMessagesCount(0);
      return;
    }

    const fetchUnread = async () => {
      const [{ data: msgs }, { data: reads }] = await Promise.all([
        supabase.from('messages').select('id,sender_profile_id,recipient_profile_id,is_broadcast,is_read'),
        supabase
          .from('broadcast_reads')
          .select('message_id')
          .eq('profile_id', userProfile.id),
      ]);
      if (!msgs) return;
      const readSet = new Set(
        ((reads || []) as Array<{ message_id: string }>).map((r) => r.message_id)
      );
      let cnt = 0;
      for (const m of msgs as Array<{
        id: string;
        sender_profile_id: string;
        recipient_profile_id: string | null;
        is_broadcast: boolean;
        is_read: boolean;
      }>) {
        if (!m.is_broadcast && m.recipient_profile_id === userProfile.id && !m.is_read) cnt++;
        if (m.is_broadcast && m.sender_profile_id !== userProfile.id && !readSet.has(m.id)) cnt++;
      }
      setUnreadMessagesCount(cnt);
    };

    fetchUnread();
    const t = window.setInterval(fetchUnread, 15000);
    return () => window.clearInterval(t);
  }, [userProfile]);

  const upcomingAlbums = useMemo(
    () =>
      albums
        .filter((a) => isAlbumUpcomingPremiere(a, nowTick))
        .sort(
          (a, b) =>
            new Date(a.premiere_at || 0).getTime() - new Date(b.premiere_at || 0).getTime()
        ),
    [albums, nowTick]
  );

  const playableAlbums = useMemo(
    () => albums.filter((a) => isAlbumPubliclyPlayable(a, nowTick)),
    [albums, nowTick]
  );

  const upcomingAlbumIdSet = useMemo(
    () => new Set(upcomingAlbums.map((a) => a.id)),
    [upcomingAlbums]
  );

  const upcomingSinglePremieres = useMemo(
    () =>
      songs
        .filter(
          (s) =>
            isSongUpcomingPremiere(s, nowTick) &&
            (!s.album_id || !upcomingAlbumIdSet.has(s.album_id))
        )
        .sort(
          (a, b) =>
            new Date(a.premiere_at || 0).getTime() - new Date(b.premiere_at || 0).getTime()
        ),
    [songs, nowTick, upcomingAlbumIdSet]
  );

  const pendingCount = useMemo(
    () =>
      songs.filter((s) => !s.album_id && s.approval_status === 'pending').length +
      albums.filter((a) => a.approval_status === 'pending').length,
    [songs, albums]
  );

  const artisteMap = useMemo(() => new Map(artistes.map((a) => [a.id, a])), [artistes]);

  const artisteTrackCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of playableSongs) {
      if (s.artiste_id) {
        map.set(s.artiste_id, (map.get(s.artiste_id) || 0) + 1);
      }
    }
    return map;
  }, [playableSongs]);

  useEffect(() => {
    if (handledDeepLinkRef.current || playableSongs.length === 0) return;
    const params = new URLSearchParams(window.location.search);
    const slug = params.get('track');
    if (slug) {
      // The share link falls back to the id when a song has no slug, so match
      // either. Playback is marked shared so signed-out visitors can hear the
      // track they were sent instead of hitting the guest limit.
      const found = playableSongs.find((s) => s.slug === slug || s.id === slug);
      // No match yet: the catalogue may still be filling, so leave the ref
      // unset and try again when playableSongs changes.
      if (found) {
        handledDeepLinkRef.current = true;
        setSharedTrackTitle(found.title);
        playSong(found, playableSongs, { shared: true });
      }
    } else {
      handledDeepLinkRef.current = true;
      const firstUnlocked =
        playableSongs.find((s) => guestUnlockedIds.has(s.id)) || playableSongs[0];
      if (firstUnlocked) warmTrack(firstUnlocked);
    }
  }, [playableSongs, guestUnlockedIds, playSong, warmTrack]);

  // Sync favorites, reminders & playlists strictly for logged-in users
  useEffect(() => {
    if (!userId) {
      setFavoriteIds(new Set());
      setRemindedIds(new Set());
      setPlaylists([]);
      return;
    }
    const loadUserLibrary = async () => {
      const [{ data: favData }, { data: remData }, { data: plData }] = await Promise.all([
        supabase.from('favorites').select('song_id').eq('user_id', userId),
        supabase.from('premiere_reminders').select('song_id').eq('user_id', userId),
        supabase
          .from('playlists')
          .select('*, playlist_songs(song_id)')
          .eq('user_id', userId)
          .order('created_at', { ascending: false }),
      ]);

      if (favData) {
        setFavoriteIds(new Set(favData.map((f: { song_id: string }) => f.song_id)));
      }
      if (remData) {
        setRemindedIds(new Set(remData.map((r: { song_id: string }) => r.song_id)));
      }
      if (plData) {
        const formatted: Playlist[] = plData.map((p: Record<string, unknown>) => ({
          id: p.id as string,
          user_id: p.user_id as string,
          name: p.name as string,
          description: (p.description as string) || null,
          is_public: Boolean(p.is_public),
          cover_theme: (p.cover_theme as string) || 'sunset',
          created_at: p.created_at as string,
          song_ids: Array.isArray(p.playlist_songs)
            ? (p.playlist_songs as Array<{ song_id: string }>).map((x) => x.song_id)
            : [],
        }));
        setPlaylists(formatted);
      }
    };
    loadUserLibrary();
  }, [userId]);

  const handleToggleFavorite = useCallback(
    async (song: Song) => {
      if (!userId) {
        openAccountPrompt('Create an account to like and save your favorite songs!');
        return;
      }
      if (!isPremium) {
        openPremiumPrompt(
          'Liking songs and saving to your Liked Songs library is a Gyidi Nnwom Premium feature.'
        );
        return;
      }
      const exists = favoriteIds.has(song.id);
      setFavoriteIds((prev) => {
        const next = new Set(prev);
        if (exists) next.delete(song.id);
        else next.add(song.id);
        return next;
      });

      if (exists) {
        await supabase.from('favorites').delete().match({ user_id: userId, song_id: song.id });
      } else {
        await supabase.from('favorites').upsert({ user_id: userId, song_id: song.id });
      }
    },
    [favoriteIds, userId, isPremium, openAccountPrompt, openPremiumPrompt]
  );

  const handleToggleReminder = useCallback(
    async (song: Song) => {
      if (!userId) {
        openAccountPrompt('Create a free account to set premiere reminders!');
        return;
      }
      const exists = remindedIds.has(song.id);
      setRemindedIds((prev) => {
        const next = new Set(prev);
        if (exists) next.delete(song.id);
        else next.add(song.id);
        return next;
      });

      if (exists) {
        await supabase
          .from('premiere_reminders')
          .delete()
          .match({ user_id: userId, song_id: song.id });
      } else {
        await supabase
          .from('premiere_reminders')
          .upsert({ user_id: userId, song_id: song.id });
      }
    },
    [remindedIds, userId, openAccountPrompt]
  );

  const handleUploadTrigger = () => {
    if (!userId || !userProfile) {
      openAccountPrompt('Create an SCG or SACSU Artiste account to upload songs & albums!', true);
      return;
    }
    if (userProfile.role !== 'artiste' && userProfile.role !== 'admin') {
      setActiveTab('artiste-studio');
      return;
    }
    setUploadOpen(true);
  };

  const handleOpenArtisteProfile = (artisteId: string) => {
    setSelectedAlbumId(null);
    setSelectedArtisteId(artisteId);
    navigateToTab('artistes');
  };

  const handleOpenAlbumView = (albumId: string) => {
    setSelectedAlbumId(albumId);
    navigateToTab('albums');
  };

  const handleCreatePlaylist = async (
    name: string,
    description: string
  ): Promise<Playlist | null> => {
    if (!userId) {
      openAccountPrompt('Create a free account to create and save playlists!');
      return null;
    }
    const themes = ['gold', 'emerald', 'sunset', 'violet', 'ocean', 'crimson'];
    const cover_theme = themes[playlists.length % themes.length];
    const { data, error } = await supabase
      .from('playlists')
      .insert({
        user_id: userId,
        name,
        description: description || null,
        cover_theme,
      })
      .select('*')
      .single();

    if (error || !data) return null;
    const created: Playlist = { ...(data as Playlist), song_ids: [] };
    setPlaylists((prev) => [created, ...prev]);
    return created;
  };

  const handleAddSongToPlaylist = async (playlistId: string, songId: string) => {
    if (!userId) {
      openAccountPrompt('Create a free account to add songs to playlists!');
      return;
    }
    await supabase.from('playlist_songs').upsert({
      playlist_id: playlistId,
      song_id: songId,
    });
    setPlaylists((prev) =>
      prev.map((pl) =>
        pl.id === playlistId && !pl.song_ids?.includes(songId)
          ? { ...pl, song_ids: [...(pl.song_ids || []), songId] }
          : pl
      )
    );
  };

  const handleDeletePlaylist = async (playlistId: string) => {
    await supabase.from('playlists').delete().eq('id', playlistId);
    setPlaylists((prev) => prev.filter((p) => p.id !== playlistId));
    if (activePlaylistId === playlistId) setActivePlaylistId(null);
  };

  const newMusicSongs = useMemo(() => {
    return [...playableSongs]
      .sort((a, b) => {
        const aRecentUpload = a.uploaded_by ? 1 : 0;
        const bRecentUpload = b.uploaded_by ? 1 : 0;
        if (aRecentUpload !== bRecentUpload) return bRecentUpload - aRecentUpload;
        return (
          new Date(b.published_at || b.created_at).getTime() -
          new Date(a.published_at || a.created_at).getTime()
        );
      })
      .slice(0, 40);
  }, [playableSongs]);

  const choirGroups = useMemo(() => {
    const counts = new Map<string, number>();
    for (const s of playableSongs) {
      counts.set(s.choir_group, (counts.get(s.choir_group) || 0) + 1);
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({ name, count }));
  }, [playableSongs]);

  const allSermons = useMemo(
    () => playableSongs.filter((s) => s.category === 'Sermons'),
    [playableSongs]
  );

  const sermonFilterOptions = useMemo(() => {
    const preachers = new Set<string>();
    const topics = new Set<string>();
    const books = new Set<string>();
    for (const s of allSermons) {
      if (s.preacher_name?.trim()) preachers.add(s.preacher_name.trim());
      else if (s.artist?.trim()) preachers.add(s.artist.trim());
      if (s.sermon_topic?.trim()) topics.add(s.sermon_topic.trim());
      if (s.bible_book?.trim()) books.add(s.bible_book.trim());
    }
    return {
      preachers: Array.from(preachers).sort(),
      topics: Array.from(topics).sort(),
      books: Array.from(books).sort(),
    };
  }, [allSermons]);

  const inProgressSermons = useMemo(() => {
    if (!isAuthenticated) return [];
    const entries = Object.values(sermonProgressMap).sort((a, b) => b.updatedAt - a.updatedAt);
    const map = new Map(playableSongs.map((s) => [s.id, s]));
    return entries
      .map((entry) => {
        const song = map.get(entry.songId);
        return song ? { song, entry } : null;
      })
      .filter(Boolean) as Array<{
      song: Song;
      entry: { songId: string; positionSec: number; durationSec: number; updatedAt: number };
    }>;
  }, [isAuthenticated, sermonProgressMap, playableSongs]);

  const filteredSongs = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    let list = playableSongs;

    if (activeTab === 'trending') {
      list = trendingSongs;
    } else if (activeTab === 'new-music') {
      list = newMusicSongs;
    } else if (activeTab === 'sermons') {
      list = allSermons.filter((s) => {
        const preacher = (s.preacher_name || s.artist || '').trim();
        if (sermonPreacherFilter !== 'All' && preacher !== sermonPreacherFilter) return false;
        if (sermonTopicFilter !== 'All' && (s.sermon_topic || '') !== sermonTopicFilter)
          return false;
        if (sermonBookFilter !== 'All' && (s.bible_book || '') !== sermonBookFilter) return false;
        return true;
      });
    } else if (activeTab === 'offline') {
      list = playableSongs.filter((s) => offlineSavedIds.has(s.id));
    } else if (activeTab === 'favorites') {
      list = playableSongs.filter((s) => favoriteIds.has(s.id));
    } else if (activeTab === 'recent') {
      const map = new Map(playableSongs.map((s) => [s.id, s]));
      list = recentlyPlayedIds.map((id) => map.get(id)).filter(Boolean) as Song[];
    } else if (activeTab === 'playlists' && activePlaylistId) {
      const pl = playlists.find((p) => p.id === activePlaylistId);
      const set = new Set(pl?.song_ids || []);
      list = playableSongs.filter((s) => set.has(s.id));
    }

    if (selectedCategory !== 'All' && activeTab === 'browse') {
      list = list.filter((s) => s.category === selectedCategory);
    }

    if (selectedChoir !== 'All' && (activeTab === 'browse' || activeTab === 'choirs')) {
      list = list.filter((s) => s.choir_group === selectedChoir);
    }

    if (q) {
      list = list.filter(
        (s) =>
          s.title.toLowerCase().includes(q) ||
          s.artist.toLowerCase().includes(q) ||
          s.choir_group.toLowerCase().includes(q) ||
          (s.original_name && s.original_name.toLowerCase().includes(q)) ||
          (s.lyrics_text && s.lyrics_text.toLowerCase().includes(q)) ||
          (s.sermon_topic && s.sermon_topic.toLowerCase().includes(q)) ||
          (s.bible_book && s.bible_book.toLowerCase().includes(q)) ||
          (s.preacher_name && s.preacher_name.toLowerCase().includes(q))
      );
    }

    if (activeTab !== 'recent' && activeTab !== 'trending' && activeTab !== 'new-music') {
      list = [...list].sort((a, b) => {
        // For guests on All Songs, surface the 5 unlocked preview songs right at the top so they can see & play them immediately, with the remaining 290 locked right below!
        if (!isAuthenticated && sortBy === 'title') {
          const aFree = guestUnlockedIds.has(a.id) ? 1 : 0;
          const bFree = guestUnlockedIds.has(b.id) ? 1 : 0;
          if (aFree !== bFree) return bFree - aFree;
        }
        if (sortBy === 'popular') return b.plays_count - a.plays_count;
        if (sortBy === 'duration') return b.duration_seconds - a.duration_seconds;
        if (sortBy === 'newest')
          return (
            new Date(b.published_at || b.created_at).getTime() -
            new Date(a.published_at || a.created_at).getTime()
          );
        return a.title.localeCompare(b.title);
      });
    }

    return list;
  }, [
    playableSongs,
    allSermons,
    trendingSongs,
    newMusicSongs,
    searchQuery,
    activeTab,
    selectedCategory,
    selectedChoir,
    sermonPreacherFilter,
    sermonTopicFilter,
    sermonBookFilter,
    offlineSavedIds,
    sortBy,
    favoriteIds,
    recentlyPlayedIds,
    playlists,
    activePlaylistId,
    isAuthenticated,
    guestUnlockedIds,
  ]);

  useEffect(() => {
    setVisibleCount(80);
  }, [searchQuery, activeTab, selectedCategory, selectedChoir, sortBy, activePlaylistId]);

  useEffect(() => {
    const el = loadMoreRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setVisibleCount((c) => Math.min(filteredSongs.length, c + 80));
        }
      },
      { rootMargin: '300px' }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [filteredSongs.length]);

  const curatedMixes = useMemo(() => {
    const pick = (group: string, fallbackCat?: string) =>
      playableSongs.filter((s) =>
        fallbackCat ? s.category === fallbackCat : s.choir_group === group
      );

    const findArtisteByUsername = (uname: string) =>
      artistes.find((a) => a.username === uname)?.id || null;

    return [
      {
        title: 'Obogu Seth & Choir Essentials',
        subtitle: '48+ Obogu Seth Classics',
        theme: 'gold',
        tracks: pick('Obogu Choir'),
        artisteId: findArtisteByUsername('obogu_seth'),
      },
      {
        title: 'Accra Boysco & Choir',
        subtitle: 'Uplifting Greater Accra Hymns',
        theme: 'sunset',
        tracks: pick('Accra Choir'),
        artisteId: findArtisteByUsername('accra_boysco_choir'),
      },
      {
        title: 'Yaw Baidoo Collection',
        subtitle: 'Timeless SCG Worship',
        theme: 'emerald',
        tracks: pick('Yaw Baidoo'),
        artisteId: findArtisteByUsername('yaw_baidoo'),
      },
      {
        title: 'Mponua & Kumawu Voices',
        subtitle: 'Deep Traditional Choir Harmonies',
        theme: 'violet',
        tracks: [...pick('Mponua Choir'), ...pick('Kumawu Choir')],
        artisteId: findArtisteByUsername('kumawu_choir'),
      },
      {
        title: 'Osiem & Sekyere Hymns',
        subtitle: 'K. Badu & Osiem Favorites',
        theme: 'ocean',
        tracks: [...pick('Osiem Choir'), ...pick('Sekyere Choir')],
        artisteId: findArtisteByUsername('osiem_choir'),
      },
      {
        title: 'Op. Abraham & Sermons',
        subtitle: 'Sabbath & Convention Teachings',
        theme: 'crimson',
        tracks: pick('', 'Sermons'),
        artisteId: findArtisteByUsername('op_abraham'),
      },
    ].filter((m) => m.tracks.length > 0);
  }, [playableSongs, artistes]);

  const selectedArtiste = useMemo(
    () => (selectedArtisteId ? artisteMap.get(selectedArtisteId) || null : null),
    [selectedArtisteId, artisteMap]
  );

  const selectedAlbum = useMemo(
    () => (selectedAlbumId ? albums.find((a) => a.id === selectedAlbumId) || null : null),
    [selectedAlbumId, albums]
  );

  const directoryArtistes = useMemo(() => {
    const base = artistes
      .filter((a) => a.stage_name || a.role === 'artiste')
      .sort((a, b) => (artisteTrackCounts.get(b.id) || 0) - (artisteTrackCounts.get(a.id) || 0));

    return base.filter((a) => {
      if (artisteDirectoryFilter === 'curated') {
        return (artisteTrackCounts.get(a.id) || 0) >= 5;
      }
      if (artisteDirectoryFilter === 'sacsu') {
        const matchesSacsu = Boolean(a.is_sacsu || a.tertiary_institution);
        if (!matchesSacsu) return false;
        if (institutionFilter.trim()) {
          return (a.tertiary_institution || '')
            .toLowerCase()
            .includes(institutionFilter.trim().toLowerCase());
        }
        return true;
      }
      return true;
    });
  }, [artistes, artisteTrackCounts, artisteDirectoryFilter, institutionFilter]);

  const handleShuffleAll = (pool: Song[]) => {
    if (!isAuthenticated) {
      openAccountPrompt('Create a free account to shuffle songs and unlock the full catalog!');
      return;
    }
    if (pool.length === 0) return;
    const rnd = pool[Math.floor(Math.random() * pool.length)];
    playSong(rnd, pool);
  };

  const nextPremiere = [...upcomingAlbums, ...upcomingSinglePremieres]
    .sort((a, b) => new Date(a.premiere_at || 0).getTime() - new Date(b.premiere_at || 0).getTime())[0];

  return (
    <div className="app-shell flex w-full max-w-full overflow-hidden bg-zinc-950 text-zinc-100">
      <Sidebar
        activeTab={activeTab}
        onSelectTab={(t) => {
          if (
            !isAuthenticated &&
            (t === 'favorites' || t === 'playlists' || t === 'offline' || t === 'live')
          ) {
            openAccountPrompt(
              t === 'favorites'
                ? 'Create an account to access Liked Songs!'
                : t === 'offline'
                ? 'Create an account to save songs to your profile for offline listening!'
                : t === 'live'
                ? 'Create an account to access Live Convention Video & Sabbath Radio!'
                : 'Create an account to build and save Playlists!'
            );
            return;
          }
          if (
            isAuthenticated &&
            !isPremium &&
            (t === 'favorites' || t === 'playlists' || t === 'offline' || t === 'live')
          ) {
            openPremiumPrompt(
              t === 'favorites'
                ? 'Liked Songs is a Gyidi Nnwom Premium feature.'
                : t === 'offline'
                ? 'Offline Saved (in-app profile offline listening) is a Gyidi Nnwom Premium feature.'
                : t === 'live'
                ? 'Live Convention Video & Sabbath Radio access is a Gyidi Nnwom Premium feature.'
                : 'Custom Playlists are a Gyidi Nnwom Premium feature.'
            );
            return;
          }
          if (t !== 'premium') setPremiumPromptReason(null);
          navigateToTab(t);
          setActivePlaylistId(null);
          setSelectedArtisteId(null);
          setSelectedAlbumId(null);
        }}
        totalSongs={playableSongs.length}
        albumsCount={playableAlbums.length + upcomingAlbums.length}
        upcomingCount={upcomingAlbums.length + upcomingSinglePremieres.length}
        pendingCount={pendingCount}
        unreadMessagesCount={unreadMessagesCount}
        favoritesCount={favoriteIds.size}
        playlistsCount={playlists.length}
        offlineCount={offlineSavedIds.size}
        userEmail={userEmail}
        profile={userProfile}
        platformSettings={platformSettings}
        hasUnseenDailyFeed={
          (isPremium && unseenFeedState.hasUnseenVerse) || unseenFeedState.hasUnseenAnn
        }
        onOpenDailyFeed={() => {
          if (!isAuthenticated && activeRoleAnnouncements.length === 0) {
            openAccountPrompt('Create an account & upgrade to Premium to view Daily Bible Verses!');
            return;
          }
          if (!isPremium && activeRoleAnnouncements.length === 0) {
            openPremiumPrompt('Daily Bible Verse flyers are a Gyidi Nnwom Premium feature.');
            return;
          }
          setDailyFeedInitialTab(isPremium ? undefined : 'announcements');
          setDailyFeedOpen(true);
        }}
        onOpenInstallApp={() => setInstallAppOpen(true)}
        onOpenAuth={(defaultArtiste = false) => openAccountPrompt(undefined, defaultArtiste)}
        onSignOut={() => supabase.auth.signOut()}
        onOpenUpload={handleUploadTrigger}
        onOpenSupport={() => setSupportOpen(true)}
        onOpenDeveloper={() => setDeveloperOpen(true)}
        mobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
      />

      <div className="flex-1 flex flex-col min-h-0 min-w-0 overflow-hidden">
        {/* Top Bar */}
        <header className="mobile-header shrink-0 z-30 flex items-center justify-between gap-2 sm:gap-3 border-b border-white/10 bg-zinc-950/85 backdrop-blur-xl px-4 sm:px-7 py-3">
          <div className="flex items-center gap-2 sm:gap-3 flex-1 basis-full sm:basis-auto min-w-0 sm:max-w-xl">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden rounded-xl p-2 bg-white/5 text-zinc-300 hover:bg-white/10 cursor-pointer"
              aria-label="Open menu"
            >
              <Menu className="w-5 h-5" />
            </button>

            <div className="relative flex-1 min-w-0">
              <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  if (
                    e.target.value.trim() &&
                    (activeTab === 'discover' ||
                      activeTab === 'admin' ||
                      activeTab === 'artiste-studio' ||
                      activeTab === 'messages' ||
                      activeTab === 'live' ||
                      activeTab === 'premium')
                  ) {
                    navigateToTab('browse');
                  }
                }}
                placeholder="Search songs, Twi/English lyrics, artistes, campuses, sermons..."
                className="w-full rounded-full border border-white/10 bg-zinc-900/90 pl-10 pr-9 py-2 text-sm text-white placeholder-zinc-500 focus:border-gold-500/70 focus:outline-none transition"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          <ThemeToggle />

          <div className="ml-auto hidden sm:flex flex-wrap items-center justify-end gap-1.5 sm:gap-2 flex-shrink-0 max-w-full">
            {!isAppInstalled && (
              <button
                onClick={() => setInstallAppOpen(true)}
                className="hidden xl:inline-flex items-center gap-1.5 rounded-full bg-forest-500/15 border border-forest-400/35 px-3 py-1.5 text-xs font-bold text-forest-200 hover:bg-forest-500/25 cursor-pointer"
                title="Install Gyidi Nnwom as a mobile app + offline listening"
              >
                <Smartphone className="w-3.5 h-3.5 text-forest-400" />
                Install App
              </button>
            )}

            {!isAuthenticated && (
              <button
                onClick={() =>
                  openAccountPrompt(
                    'Create a free account to unlock all 295+ tracks, likes, downloads, playlists & full controls!'
                  )
                }
                className="hidden md:inline-flex items-center gap-1.5 rounded-full bg-gold-500/15 border border-gold-400/35 px-3 py-1.5 text-xs font-bold text-gold-300 hover:bg-gold-500/25 cursor-pointer"
              >
                <Lock className="w-3.5 h-3.5" />
                5 Free Songs • Unlock All
              </button>
            )}

            {startupLatencyMs !== null && isAuthenticated && (
              <div className="hidden md:flex items-center gap-1.5 rounded-full bg-forest-500/10 border border-forest-500/25 px-3 py-1 text-xs font-medium text-forest-300">
                <Zap className="w-3.5 h-3.5 text-forest-400" />
                <span>{(startupLatencyMs / 1000).toFixed(2)}s stream</span>
              </div>
            )}

            {userProfile?.role === 'admin' && (
              <button
                onClick={() => {
                  setAdminInitialSubTab(undefined);
                  navigateToTab('admin');
                }}
                className="hidden sm:inline-flex items-center gap-1.5 rounded-full bg-gold-500/20 border border-gold-400/40 px-3.5 py-1.5 text-xs font-bold text-gold-300 hover:bg-gold-500/30 cursor-pointer"
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                Admin
                {pendingCount + unreadMessagesCount > 0 && (
                  <span className="rounded-full bg-rose-500 px-1.5 text-[10px] text-white">
                    {pendingCount + unreadMessagesCount}
                  </span>
                )}
              </button>
            )}


          </div>
        </header>

        {/* Main Scroll Area */}
        <main className="flex-1 min-h-0 min-w-0 max-w-full stable-scroll px-3.5 sm:px-7 py-5 pb-36">
          {/* Persistent Section Navigation Bar: Go Back & Close Buttons on Every Section */}
          {activeTab !== 'discover' &&
            !(activeTab === 'albums' && selectedAlbum) &&
            !(activeTab === 'artistes' && selectedArtiste) && (
              <div className="max-w-[1400px] mx-auto mb-5 flex items-center justify-between gap-2 rounded-2xl border border-white/10 bg-zinc-900/75 px-3.5 py-2.5">
                <button
                  type="button"
                  onClick={handleGoBack}
                  className="inline-flex items-center gap-1.5 rounded-full bg-white/10 border border-white/15 px-3.5 py-1.5 text-xs font-bold text-gold-300 hover:bg-white/15 transition cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Go Back
                </button>

                <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 truncate">
                  {activeTab.replace('-', ' ')}
                </span>

                <button
                  type="button"
                  onClick={handleCloseSection}
                  className="inline-flex items-center gap-1 rounded-full bg-white/5 border border-white/10 px-3 py-1.5 text-xs font-semibold text-zinc-300 hover:bg-white/10 hover:text-white transition cursor-pointer"
                  title="Close section and return to Discover"
                >
                  <X className="w-3.5 h-3.5" />
                  Close
                </button>
              </div>
            )}

          {loadingCatalog && songs.length === 0 ? (
            <div className="space-y-6 animate-pulse">
              <div className="h-52 rounded-3xl bg-white/5" />
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {[1, 2, 3, 4, 5, 6].map((n) => (
                  <div key={n} className="h-24 rounded-2xl bg-white/5" />
                ))}
              </div>
            </div>
          ) : activeTab === 'premium' || (!isPremium && ['favorites', 'playlists', 'offline', 'live'].includes(activeTab)) ? (
            <PremiumBillingView
              userId={userId}
              userEmail={userEmail}
              profile={userProfile}
              platformSettings={platformSettings}
              promptReason={premiumPromptReason}
              onOpenAuth={(reason) => openAccountPrompt(reason, false)}
              onSubscriptionActivated={(updatedProfile) => {
                setUserProfile(updatedProfile);
                setPremiumPromptReason(null);
                fetchPlatformData();
              }}
              onOpenAdminPremiumSettings={
                userProfile?.role === 'admin'
                  ? () => {
                      setAdminInitialSubTab('premium');
                      navigateToTab('admin');
                    }
                  : undefined
              }
            />
          ) : activeTab === 'live' ? (
            <LiveStreamUpcomingView
              userId={userId}
              userProfile={userProfile}
              isPremium={isPremium}
              onRequireAccount={(reason: string) => openAccountPrompt(reason, false)}
              onRequirePremium={(reason: string) => openPremiumPrompt(reason)}
            />
          ) : activeTab === 'admin' && userProfile?.role === 'admin' ? (
            <AdminDashboardView
              adminProfile={userProfile}
              allSongs={songs}
              allAlbums={albums}
              profiles={artistes}
              playEvents={playEvents}
              unreadMessagesCount={unreadMessagesCount}
              initialSubTab={adminInitialSubTab}
              onUnreadCountChanged={setUnreadMessagesCount}
              onRefreshAll={fetchPlatformData}
              onOpenArtiste={handleOpenArtisteProfile}
              onPreviewDailyFeed={(tab) => {
                setDailyFeedInitialTab(tab);
                setDailyFeedOpen(true);
              }}
            />
          ) : activeTab === 'messages' &&
            userProfile &&
            (userProfile.role === 'artiste' || userProfile.role === 'admin') ? (
            <MessagesView
              currentProfile={userProfile}
              allProfiles={artistes}
              onUnreadCountChanged={setUnreadMessagesCount}
            />
          ) : activeTab === 'artiste-studio' && userProfile && userId ? (
            <ArtisteStudioView
              profile={userProfile}
              authUserId={userId}
              allProfiles={artistes}
              onProfileUpdated={(updated) => {
                setUserProfile(updated);
                fetchPlatformData();
              }}
              onCatalogChanged={fetchPlatformData}
              onOpenUpload={() => setUploadOpen(true)}
              onViewPublicProfile={handleOpenArtisteProfile}
              onOpenAlbum={handleOpenAlbumView}
              onUnreadCountChanged={setUnreadMessagesCount}
            />
          ) : activeTab === 'albums' && selectedAlbum ? (
            <AlbumView
              album={selectedAlbum}
              tracks={songs.filter(
                (s) => s.album_id === selectedAlbum.id && s.approval_status === 'approved'
              )}
              artiste={selectedAlbum.artiste_id ? artisteMap.get(selectedAlbum.artiste_id) : null}
              viewerProfile={userProfile}
              favoriteIds={favoriteIds}
              offlineSavedIds={offlineSavedIds}
              onBack={() => setSelectedAlbumId(null)}
              onClose={handleCloseSection}
              onOpenArtiste={handleOpenArtisteProfile}
              onToggleFavorite={handleToggleFavorite}
              onToggleOfflineSave={handleToggleOfflineSave}
              onOpenLyrics={handleOpenLyrics}
              onOpenShareCard={(s) => handleOpenShareCard(s)}
              onOpenPlaylistModal={(s) => handleRequestPlaylistModal(s)}
              onUnlocked={() => setNowTick(Date.now())}
              onRefreshCatalog={fetchPlatformData}
            />
          ) : activeTab === 'albums' ? (
            <div className="max-w-[1400px] mx-auto space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-2xl font-extrabold text-white flex items-center gap-2">
                    <Disc3 className="w-6 h-6 text-gold-400" />
                    Albums, EPs & Sermon Series
                  </h2>
                  <p className="text-xs text-zinc-400 mt-1">
                    Stream complete albums or follow upcoming 7-day album premieres
                  </p>
                </div>
                <button
                  onClick={handleUploadTrigger}
                  className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-gold-500 to-pink-600 px-4 py-2 text-xs font-bold text-white shadow-lg cursor-pointer"
                >
                  <UploadCloud className="w-4 h-4" />
                  Upload or Premiere an Album
                </button>
              </div>

              {upcomingAlbums.length === 0 && playableAlbums.length === 0 ? (
                <div className="rounded-2xl border border-white/10 bg-zinc-900/50 p-12 text-center">
                  <Disc3 className="w-10 h-10 text-gold-400 mx-auto mb-3" />
                  <h3 className="text-base font-bold text-white">No full albums published yet</h3>
                  <p className="text-xs text-zinc-400 max-w-md mx-auto mt-1">
                    SCG & SACSU Artistes can upload full albums with general album cover art and
                    individual track titles — either as Instant Releases or 7-day Album Premieres!
                  </p>
                  <button
                    onClick={handleUploadTrigger}
                    className="mt-4 rounded-full bg-white px-5 py-2 text-xs font-extrabold text-zinc-950 hover:bg-gold-100 cursor-pointer"
                  >
                    Upload First Album
                  </button>
                </div>
              ) : (
                <div className="space-y-8">
                  {upcomingAlbums.length > 0 && (
                    <section className="space-y-3">
                      <h3 className="text-base font-bold text-gold-300">
                        Upcoming Album Premieres ({upcomingAlbums.length})
                      </h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        {upcomingAlbums.map((alb) => (
                          <AlbumPremiereCard
                            key={alb.id}
                            album={alb}
                            tracks={songs.filter((s) => s.album_id === alb.id)}
                            artiste={alb.artiste_id ? artisteMap.get(alb.artiste_id) : null}
                            onOpenArtiste={handleOpenArtisteProfile}
                            onOpenAlbum={handleOpenAlbumView}
                            onUnlocked={() => setNowTick(Date.now())}
                          />
                        ))}
                      </div>
                    </section>
                  )}

                  {playableAlbums.length > 0 && (
                    <section className="space-y-3">
                      <h3 className="text-base font-bold text-white">
                        Released Albums ({playableAlbums.length})
                      </h3>
                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                        {playableAlbums.map((alb) => {
                          const cnt = playableSongs.filter((s) => s.album_id === alb.id).length;
                          return (
                            <div
                              key={alb.id}
                              onClick={() => handleOpenAlbumView(alb.id)}
                              className="group rounded-2xl border border-white/10 bg-zinc-900/55 p-3 hover:bg-zinc-900 hover:border-gold-500/40 transition cursor-pointer"
                            >
                              <CoverArt
                                title={alb.title}
                                category={alb.category}
                                theme={alb.cover_theme}
                                coverUrl={alb.cover_url}
                                size="lg"
                                className="w-full aspect-square rounded-xl"
                              />
                              <h4 className="mt-2.5 text-sm font-bold text-white truncate group-hover:text-gold-300">
                                {alb.title}
                              </h4>
                              <p className="text-xs text-zinc-400 truncate">{alb.artist}</p>
                              <p className="text-[11px] text-zinc-500 mt-0.5">{cnt} tracks</p>
                            </div>
                          );
                        })}
                      </div>
                    </section>
                  )}
                </div>
              )}
            </div>
          ) : activeTab === 'artistes' && selectedArtiste ? (
            <ArtisteProfileView
              artiste={selectedArtiste}
              songs={songs}
              albums={albums}
              viewerProfile={userProfile}
              isPremium={isPremium}
              favoriteIds={favoriteIds}
              offlineSavedIds={offlineSavedIds}
              remindedIds={remindedIds}
              onBack={() => setSelectedArtisteId(null)}
              onClose={handleCloseSection}
              onRequirePremium={(reason) => openPremiumPrompt(reason)}
              onOpenAlbum={handleOpenAlbumView}
              onToggleFavorite={handleToggleFavorite}
              onToggleOfflineSave={handleToggleOfflineSave}
              onOpenLyrics={handleOpenLyrics}
              onOpenShareCard={(s) => handleOpenShareCard(s)}
              onToggleReminder={handleToggleReminder}
              onOpenPlaylistModal={(s) => handleRequestPlaylistModal(s)}
              onArtisteUpdated={(updated) => {
                setArtistes((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
              }}
              onRefreshCatalog={fetchPlatformData}
            />
          ) : activeTab === 'artistes' ? (
            <div className="max-w-[1400px] mx-auto space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-2xl font-extrabold text-white flex items-center gap-2">
                    <BadgeCheck className="w-6 h-6 text-gold-400" />
                    SCG Artistes & SACSU Tertiary Catalogue
                  </h2>
                  <p className="text-xs text-zinc-400 mt-1">
                    Explore SCG choirs, psalmists, preachers, and SACSU tertiary student ministries
                    across Ghana
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {userProfile?.role === 'admin' && (
                    <button
                      onClick={() => setCreateArtisteOpen(true)}
                      className="inline-flex items-center gap-1.5 rounded-full bg-white/10 border border-white/15 px-4 py-2 text-xs font-bold text-gold-300 hover:bg-white/15 cursor-pointer"
                    >
                      <Plus className="w-4 h-4" />
                      New Pre-Created Profile
                    </button>
                  )}
                  <button
                    onClick={handleUploadTrigger}
                    className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-gold-500 to-pink-600 px-4 py-2 text-xs font-bold text-white shadow-lg cursor-pointer"
                  >
                    <UploadCloud className="w-4 h-4" />
                    Register Artiste / SACSU Profile
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => setArtisteDirectoryFilter('all')}
                    className={`rounded-full px-4 py-1.5 text-xs font-bold transition cursor-pointer ${
                      artisteDirectoryFilter === 'all'
                        ? 'bg-white text-zinc-950'
                        : 'bg-white/5 text-zinc-300 hover:bg-white/10'
                    }`}
                  >
                    All Artistes ({artistes.filter((a) => a.stage_name || a.role === 'artiste').length})
                  </button>

                  <button
                    onClick={() => setArtisteDirectoryFilter('curated')}
                    className={`rounded-full px-4 py-1.5 text-xs font-bold transition cursor-pointer ${
                      artisteDirectoryFilter === 'curated'
                        ? 'bg-gold-500 text-zinc-950'
                        : 'bg-gold-500/10 border border-gold-500/30 text-gold-300 hover:bg-gold-500/20'
                    }`}
                  >
                    Curated SCG Collections (5+ Tracks)
                  </button>

                  <button
                    onClick={() => setArtisteDirectoryFilter('sacsu')}
                    className={`inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-bold transition cursor-pointer ${
                      artisteDirectoryFilter === 'sacsu'
                        ? 'bg-cyan-400 text-zinc-950'
                        : 'bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/20'
                    }`}
                  >
                    <GraduationCap className="w-3.5 h-3.5" />
                    SACSU & Tertiary Institutions
                  </button>
                </div>

                {artisteDirectoryFilter === 'sacsu' && (
                  <input
                    type="text"
                    value={institutionFilter}
                    onChange={(e) => setInstitutionFilter(e.target.value)}
                    placeholder="Filter by Tertiary Institution (e.g. KNUST, UG, UCC)..."
                    className="w-full sm:w-72 rounded-full border border-cyan-500/30 bg-zinc-900 px-4 py-1.5 text-xs text-white focus:border-cyan-400 focus:outline-none"
                  />
                )}
              </div>

              {artisteDirectoryFilter === 'sacsu' && (
                <div className="rounded-2xl border border-cyan-500/30 bg-gradient-to-r from-cyan-500/10 via-zinc-900 to-zinc-900 p-4 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-extrabold uppercase tracking-wider text-cyan-300 flex items-center gap-1.5">
                      <GraduationCap className="w-4 h-4" />
                      SACSU — Savior Church Students&apos; Union (Tertiary Institutions)
                    </p>
                    <p className="text-xs text-zinc-300 mt-0.5">
                      Campus fellowships and tertiary student artistes can create profiles to upload
                      choir songs, albums, and student sermon preachings!
                    </p>
                  </div>
                  <button
                    onClick={() =>
                      openAccountPrompt(
                        'Register your campus SACSU profile to upload songs & preachings!',
                        true
                      )
                    }
                    className="rounded-full bg-cyan-400 px-4 py-1.5 text-xs font-extrabold text-zinc-950 hover:bg-cyan-300 cursor-pointer"
                  >
                    Create Campus SACSU Profile
                  </button>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {directoryArtistes.map((art) => {
                  const trackCount = artisteTrackCounts.get(art.id) || 0;
                  const artUpcoming =
                    upcomingSinglePremieres.filter((s) => s.artiste_id === art.id).length +
                    upcomingAlbums.filter((a) => a.artiste_id === art.id).length;

                  return (
                    <div
                      key={art.id}
                      onClick={() => handleOpenArtisteProfile(art.id)}
                      className="group flex items-center gap-4 rounded-2xl border border-white/10 bg-zinc-900/60 p-4 hover:bg-zinc-900 hover:border-gold-500/40 transition cursor-pointer"
                    >
                      {art.avatar_url ? (
                        <img
                          src={art.avatar_url}
                          alt={art.stage_name || 'Artiste'}
                          className="h-16 w-16 rounded-2xl object-cover border border-gold-400/30 flex-shrink-0"
                        />
                      ) : (
                        <div
                          className={`h-16 w-16 rounded-2xl flex items-center justify-center text-lg font-extrabold text-white flex-shrink-0 ${
                            art.is_sacsu
                              ? 'bg-gradient-to-br from-cyan-500 to-blue-600'
                              : 'bg-gradient-to-br from-gold-500 to-pink-600'
                          }`}
                        >
                          {(art.stage_name || art.display_name || 'A')[0]?.toUpperCase()}
                        </div>
                      )}

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <h4 className="text-sm font-extrabold text-white truncate group-hover:text-gold-300">
                            {art.stage_name || art.display_name}
                          </h4>
                          {art.is_verified_artiste && (
                            <BadgeCheck className="w-4 h-4 text-gold-400 flex-shrink-0" />
                          )}
                        </div>

                        {art.tertiary_institution ? (
                          <p className="text-xs text-cyan-300 truncate mt-0.5">
                            <GraduationCap className="w-3 h-3 inline mr-1" />
                            {art.tertiary_institution}
                          </p>
                        ) : (
                          art.real_name && (
                            <p className="text-xs text-zinc-400 truncate">{art.real_name}</p>
                          )
                        )}

                        <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-gold-300/90">
                          {(art.scg_zone || art.scg_branch) && (
                            <span className="truncate">
                              <MapPin className="w-3 h-3 inline mr-0.5" />
                              {[art.scg_branch, art.scg_zone].filter(Boolean).join(' • ')}
                            </span>
                          )}
                          <span className="rounded-md bg-white/5 px-1.5 py-0.5 text-[10px] font-bold text-zinc-200">
                            {trackCount} {trackCount === 1 ? 'track' : 'tracks'}
                          </span>
                        </div>

                        {artUpcoming > 0 && (
                          <span className="mt-1.5 inline-block rounded-full bg-gold-500/20 px-2 py-0.5 text-[10px] font-bold text-gold-300">
                            {artUpcoming} Upcoming Premiere{artUpcoming > 1 ? 's' : ''}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : activeTab === 'upcoming' ? (
            <div className="max-w-[1400px] mx-auto space-y-6">
              <div>
                <h2 className="text-2xl font-extrabold text-white flex items-center gap-2.5">
                  <CalendarClock className="w-6 h-6 text-gold-400" />
                  Upcoming Song & Album Premieres
                </h2>
                <p className="text-xs text-zinc-400 mt-1">
                  Approved SCG & SACSU premieres counting down to global release. Tracks and albums
                  unlock automatically when the timer hits zero!
                </p>
              </div>

              {upcomingAlbums.length === 0 && upcomingSinglePremieres.length === 0 ? (
                <div className="rounded-2xl border border-white/10 bg-zinc-900/40 p-12 text-center">
                  <CalendarClock className="w-10 h-10 text-gold-400 mx-auto mb-3" />
                  <p className="text-sm font-bold text-white">
                    No scheduled premieres counting down
                  </p>
                  <p className="text-xs text-zinc-400 mt-1 max-w-md mx-auto">
                    Artistes can schedule single or full album premieres at least 7 days in advance
                    with cover art. Once approved by Admin, they count down right here!
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {upcomingAlbums.map((alb) => (
                    <AlbumPremiereCard
                      key={alb.id}
                      album={alb}
                      tracks={songs.filter((s) => s.album_id === alb.id)}
                      artiste={alb.artiste_id ? artisteMap.get(alb.artiste_id) : null}
                      onOpenArtiste={handleOpenArtisteProfile}
                      onOpenAlbum={handleOpenAlbumView}
                      onUnlocked={() => setNowTick(Date.now())}
                    />
                  ))}

                  {upcomingSinglePremieres.map((song) => (
                    <PremiereCard
                      key={song.id}
                      song={song}
                      artiste={song.artiste_id ? artisteMap.get(song.artiste_id) : null}
                      reminded={remindedIds.has(song.id)}
                      onToggleReminder={handleToggleReminder}
                      onOpenArtiste={handleOpenArtisteProfile}
                      onPlayIfUnlocked={(s) => playSong(s, [s, ...playableSongs])}
                      onUnlocked={() => setNowTick(Date.now())}
                    />
                  ))}
                </div>
              )}
            </div>
          ) : activeTab === 'discover' ? (
            <div className="space-y-4 sm:space-y-6 max-w-[1400px] mx-auto">
              <HomeSpotlight slides={[
                {
                  id: 'welcome', label: 'SCG & SACSU · Gyidi Nnwom',
                  title: 'Savior Church of Ghana Digital Sanctuary',
                  description: `Stream ${playableSongs.length} hymns, choir recordings & convention sermons.`,
                  image: '/logo-mark.png', icon: <Music2 className="h-6 w-6" />,
                  onOpen: () => navigateToTab('browse'),
                },
                {
                  id: 'verse', label: "Today's Bible Verse · Premium",
                  title: activePopupVerse?.scripture_ref || 'Your daily word & encouragement',
                  description: activePopupVerse?.caption || 'View today’s Scripture flyer',
                  image: isPremium ? activePopupVerse?.flyer_url : undefined,
                  icon: <BookOpen className="h-6 w-6" />,
                  onOpen: () => {
                    if (!isPremium) { openPremiumPrompt('Daily Bible Verse flyers are a Gyidi Nnwom Premium feature.'); return; }
                    setDailyFeedInitialTab('verse'); setDailyFeedOpen(true);
                  },
                },
                {
                  id: 'live', label: 'Coming soon · Live Video & Radio',
                  title: 'Live conventions & Sabbath Radio',
                  description: 'HD video & low-data audio · Preview and join the waitlist',
                  icon: <Video className="h-6 w-6" />,
                  onOpen: () => {
                    if (!isPremium) { openPremiumPrompt('Live Convention Video & Sabbath Radio is a Premium feature.'); return; }
                    navigateToTab('live');
                  },
                },
                {
                  id: 'premieres', label: `Upcoming Premieres · ${upcomingAlbums.length + upcomingSinglePremieres.length}`,
                  title: nextPremiere?.title || 'New singles & albums are on the way',
                  description: nextPremiere?.premiere_at
                    ? `${nextPremiere.artist} · ${new Date(nextPremiere.premiere_at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}`
                    : 'Explore scheduled releases and premiere countdowns',
                  image: nextPremiere?.cover_url || undefined,
                  icon: <CalendarClock className="h-6 w-6" />,
                  onOpen: () => navigateToTab('upcoming'),
                },
                ...(activeRoleAnnouncements.length ? [{
                  id: 'announcement', label: 'Official church & platform notice',
                  title: activeRoleAnnouncements[0].title,
                  description: activeRoleAnnouncements[0].body,
                  icon: <Megaphone className="h-6 w-6" />,
                  onOpen: () => { setDailyFeedInitialTab('announcements'); setDailyFeedOpen(true); },
                }] : []),
              ]} />

              {/* TRENDING & WHAT EVERYBODY IS LISTENING TO */}
              <section aria-label="Trending and what everyone is listening to" data-testid="home-trending">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2.5">
                    <Flame className="w-5 h-5 text-gold-400" />
                    <div>
                      <h3 aria-label="Trending & What Everyone Is Listening To" className="font-extrabold text-white">
                        <span className="block text-base sm:inline sm:text-lg">Trending</span>
                        <span className="block text-[11px] font-medium text-zinc-300 sm:inline sm:text-lg sm:font-extrabold sm:text-white"> &amp; What Everyone Is Listening To</span>
                      </h3>
                      <p className="hidden sm:block text-xs text-zinc-400">
                        {isAuthenticated
                          ? 'Most streamed hymns & live community listening pulse'
                          : 'First 5 tracks are unlocked for Guest Preview — sign up free to unlock #6+'}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => navigateToTab('trending')}
                    aria-label="Full Trending Chart"
                    className="shrink-0 min-h-11 text-[11px] sm:text-xs font-semibold text-gold-400 hover:text-gold-300 cursor-pointer"
                  >
                    Full chart →
                  </button>
                </div>

                {listeningNowFeed.length > 0 && (
                  <div className="mb-4 flex items-center gap-2.5 overflow-x-auto pb-1">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-forest-500/15 border border-forest-400/30 px-3 py-1 text-[11px] font-bold text-forest-300 flex-shrink-0">
                      <Radio className="w-3.5 h-3.5 animate-pulse" />
                      Listening Now
                    </span>
                    {listeningNowFeed.slice(0, 5).map(({ song }) => (
                      <button
                        key={song.id}
                        onClick={() => playSong(song, trendingSongs)}
                        className="flex items-center gap-2 rounded-full bg-zinc-900 border border-white/10 px-3 py-1 text-xs text-zinc-200 hover:border-gold-400/50 transition flex-shrink-0 cursor-pointer"
                      >
                        {!isAuthenticated && !guestUnlockedIds.has(song.id) && (
                          <Lock className="w-3 h-3 text-gold-400" />
                        )}
                        <span className="font-semibold truncate max-w-[150px]">{song.title}</span>
                        <span className="text-zinc-500">• {song.artist}</span>
                      </button>
                    ))}
                  </div>
                )}

                <div className="rounded-2xl border border-white/10 bg-zinc-900/40 p-2">
                  {trendingSongs.slice(0, 7).map((song, i) => (
                    <SongRow
                      key={song.id}
                      song={song}
                      index={i}
                      contextQueue={trendingSongs}
                      isFavorite={favoriteIds.has(song.id)}
                      savedResumeSec={sermonProgressMap[song.id]?.positionSec}
                      isOfflineSaved={offlineSavedIds.has(song.id)}
                      onToggleFavorite={handleToggleFavorite}
                      onOpenArtiste={handleOpenArtisteProfile}
                      onEditSong={canViewerEditSong(song) ? (s) => setEditingLyricsSong(s) : undefined}
                      onOpenLyrics={handleOpenLyrics}
                      onOpenShareCard={(s) => handleOpenShareCard(s)}
                      onToggleOfflineSave={handleToggleOfflineSave}
                      onOpenPlaylistModal={(s) => handleRequestPlaylistModal(s)}
                    />
                  ))}
                </div>
              </section>

              {/* GOOGLE ADSENSE HOME BANNER (Live Ad Unit or Admin Quick-Setup Preview) */}
              <GoogleAdBanner
                settings={platformSettings}
                slotType="home"
                adsEnabled={!isPremium}
                isAdmin={userProfile?.role === 'admin'}
                onConfigureClick={() => {
                  setAdminInitialSubTab('adsense');
                  navigateToTab('admin');
                }}
              />

              {/* FEATURED SCG & SACSU ARTISTES */}
              <section>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2.5">
                    <BadgeCheck className="w-5 h-5 text-gold-400" />
                    <div>
                      <h3 className="text-lg font-extrabold text-white">
                        Featured SCG & SACSU Artistes
                      </h3>
                      <p className="text-xs text-zinc-400">
                        Open any Artiste Profile to view their catalog, upcoming premieres, or edit
                        details
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => navigateToTab('artistes')}
                    className="text-xs font-semibold text-gold-400 hover:text-gold-300 cursor-pointer"
                  >
                    View all ({artistes.length})
                  </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
                  {artistes
                    .slice()
                    .sort(
                      (a, b) =>
                        (artisteTrackCounts.get(b.id) || 0) -
                        (artisteTrackCounts.get(a.id) || 0)
                    )
                    .slice(0, 6)
                    .map((art) => (
                      <div
                        key={art.id}
                        onClick={() => handleOpenArtisteProfile(art.id)}
                        className="group rounded-2xl border border-white/10 bg-zinc-900/55 p-3.5 text-center hover:bg-zinc-900 hover:border-gold-500/40 transition cursor-pointer"
                      >
                        {art.avatar_url ? (
                          <img
                            src={art.avatar_url}
                            alt=""
                            className="h-16 w-16 rounded-full object-cover mx-auto border border-gold-400/30"
                          />
                        ) : (
                          <div className="h-16 w-16 rounded-full bg-gradient-to-br from-gold-500 to-pink-600 flex items-center justify-center text-lg font-extrabold text-white mx-auto shadow-lg">
                            {(art.stage_name || art.display_name || 'A')[0]?.toUpperCase()}
                          </div>
                        )}
                        <p className="mt-2.5 text-xs font-extrabold text-white truncate group-hover:text-gold-300">
                          {art.stage_name || art.display_name}
                        </p>
                        <p className="text-[11px] text-zinc-400 truncate">
                          {artisteTrackCounts.get(art.id) || 0} tracks
                        </p>
                      </div>
                    ))}
                </div>
              </section>

              {/* NEW MUSIC */}
              <section>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2.5">
                    <Sparkles className="w-5 h-5 text-gold-400" />
                    <div>
                      <h3 className="text-lg font-extrabold text-white">New Music</h3>
                      <p className="text-xs text-zinc-400">
                        Freshly approved Artiste uploads & newly unlocked premieres
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => navigateToTab('new-music')}
                    className="text-xs font-semibold text-gold-400 hover:text-gold-300 cursor-pointer"
                  >
                    Explore New Releases
                  </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
                  {newMusicSongs.slice(0, 6).map((song) => {
                    const locked = !isAuthenticated && !guestUnlockedIds.has(song.id);
                    return (
                      <div
                        key={song.id}
                        onMouseEnter={() => !locked && warmTrack(song)}
                        onClick={() => playSong(song, newMusicSongs)}
                        className="group rounded-2xl border border-white/10 bg-zinc-900/50 p-3 hover:bg-zinc-900 hover:border-gold-500/35 transition cursor-pointer"
                      >
                        <div className="relative">
                          <CoverArt
                            title={song.title}
                            category={song.category}
                            theme={song.cover_theme}
                            coverUrl={song.cover_url}
                            size="lg"
                            className="w-full aspect-square rounded-xl"
                          />
                          {locked ? (
                            <span className="absolute top-2 right-2 rounded-full bg-black/75 border border-gold-400/40 p-1.5 text-gold-300">
                              <Lock className="w-3.5 h-3.5" />
                            </span>
                          ) : (
                            <span className="absolute bottom-2 right-2 h-9 w-9 rounded-full bg-gold-500 text-zinc-950 flex items-center justify-center shadow-lg opacity-0 group-hover:opacity-100 transition">
                              <Play className="w-4 h-4 fill-zinc-950 ml-0.5" />
                            </span>
                          )}
                        </div>
                        <p className="mt-2.5 text-xs font-bold text-white truncate">{song.title}</p>
                        <p className="text-[11px] text-zinc-400 truncate">{song.artist}</p>
                      </div>
                    );
                  })}
                </div>
              </section>

              {/* CURATED SCG COLLECTIONS */}
              <section>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-bold text-white">Curated SCG Collections</h3>
                    <p className="text-xs text-zinc-400">
                      One-tap streaming mixes — or open each featured Artiste Profile
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setArtisteDirectoryFilter('curated');
                      navigateToTab('artistes');
                    }}
                    className="text-xs font-semibold text-gold-400 hover:text-gold-300 cursor-pointer"
                  >
                    View Curated Profiles
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                  {curatedMixes.map((mix) => {
                    const playableMixTrack =
                      mix.tracks.find((t) => isAuthenticated || guestUnlockedIds.has(t.id)) ||
                      mix.tracks[0];
                    return (
                      <div
                        key={mix.title}
                        onClick={() => playableMixTrack && playSong(playableMixTrack, mix.tracks)}
                        className="group flex items-center gap-4 rounded-2xl border border-white/10 bg-zinc-900/60 p-3 hover:bg-zinc-900 hover:border-gold-500/35 transition cursor-pointer"
                      >
                        <CoverArt
                          title={mix.title}
                          category={mix.title.includes('Sermon') ? 'Sermons' : 'Songs'}
                          theme={mix.theme}
                          size="md"
                          className="h-16 w-16 rounded-xl flex-shrink-0 shadow-lg"
                        />
                        <div className="min-w-0 flex-1">
                          <h4 className="text-sm font-bold text-white truncate group-hover:text-gold-300 transition">
                            {mix.title}
                          </h4>
                          <p className="text-xs text-zinc-400 truncate mt-0.5">{mix.subtitle}</p>
                          <div className="mt-1 flex items-center gap-2">
                            <span className="text-[11px] text-zinc-500 font-medium">
                              {mix.tracks.length} tracks
                            </span>
                            {mix.artisteId && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleOpenArtisteProfile(mix.artisteId!);
                                }}
                                className="text-[11px] font-bold text-gold-400 hover:underline cursor-pointer"
                              >
                                • Artiste Profile
                              </button>
                            )}
                          </div>
                        </div>
                        <div className="h-10 w-10 rounded-full bg-gold-500 text-zinc-950 flex items-center justify-center opacity-90 group-hover:scale-105 shadow-md transition flex-shrink-0 mr-1">
                          <Play className="w-4 h-4 fill-zinc-950 ml-0.5" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>

              {/* SUPPORT GYIDI NNWOM */}
              <section className="rounded-3xl border border-pink-500/25 bg-gradient-to-r from-pink-500/10 via-zinc-900 to-zinc-900 p-6">
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-5">
                  <div className="space-y-1.5 max-w-xl">
                    <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-pink-400">
                      <HeartHandshake className="w-4 h-4" />
                      Support Gyidi Nnwom
                    </div>
                    <h3 className="text-xl font-extrabold text-white">
                      Partner With the Gyidi Nnwom Digital Ministry
                    </h3>
                    <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed">
                      Help us maintain high-speed cloud streaming and archive more SCG choirs,
                      SACSU fellowships, and convention teachings across every zone and branch.
                    </p>
                  </div>

                  <div className="w-full md:max-w-sm">
                    {/* Same surface as the sidebar entry: one wallet button that
                        opens the support modal and goes straight to the Paystack
                        payment page. No hard-coded amount. */}
                    <SupportGyidiButton onOpenSupport={() => setSupportOpen(true)} />
                  </div>
                </div>
              </section>

              {/* MEET THE DEVELOPER (Separate Standalone Section Below Support Gyidi) */}
              <section className="rounded-3xl border border-gold-500/25 bg-gradient-to-r from-gold-500/10 via-zinc-900 to-zinc-950 p-6">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-gold-400">
                      <Code2 className="w-4 h-4" />
                      Meet the Developer
                    </div>
                    <h3 className="text-lg font-extrabold text-white">Desmond Kofi Antwi</h3>
                    <p className="text-xs text-zinc-300 max-w-xl">
                      Designed and engineered by Desmond Kofi Antwi. Explore his portfolio, projects,
                      and contact information on his official website.
                    </p>
                  </div>

                  <a
                    href="https://desmondantwi.vercel.app/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full sm:w-auto flex items-center gap-2.5 rounded-xl px-3 py-3 text-xs font-semibold text-gold-200 bg-gold-500/10 border border-gold-500/20 hover:bg-gold-500/20 transition cursor-pointer flex-shrink-0"
                  >
                    <Code2 className="w-4 h-4 text-gold-400 flex-shrink-0" />
                    <span className="flex-1 text-left">Visit Developer Website</span>
                    <ExternalLink className="w-3.5 h-3.5 text-gold-300 flex-shrink-0" />
                  </a>
                </div>
              </section>
            </div>
          ) : activeTab === 'playlists' && !activePlaylistId ? (
            <div className="max-w-[1400px] mx-auto space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-2xl font-extrabold text-white">Your Playlists</h2>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    Organize Sabbath worship sets, choir favorites, and study sermons
                  </p>
                </div>
                <button
                  onClick={() => handleRequestPlaylistModal(null)}
                  className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-gold-500 to-pink-600 px-4 py-2 text-xs font-bold text-white shadow-lg cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  New Playlist
                </button>
              </div>

              {playlists.length === 0 ? (
                <div className="rounded-2xl border border-white/10 bg-zinc-900/50 p-10 text-center">
                  <Music2 className="w-10 h-10 text-gold-400 mx-auto mb-3" />
                  <p className="text-sm text-zinc-300 font-medium">No playlists yet</p>
                  <p className="text-xs text-zinc-500 mt-1">
                    Click &ldquo;New Playlist&rdquo; or use the + icon on any song row.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {playlists.map((pl) => (
                    <div
                      key={pl.id}
                      onClick={() => setActivePlaylistId(pl.id)}
                      className="group relative flex items-center gap-4 rounded-2xl border border-white/10 bg-zinc-900/60 p-4 hover:bg-zinc-900 hover:border-gold-500/35 transition cursor-pointer"
                    >
                      <CoverArt
                        title={pl.name}
                        theme={pl.cover_theme}
                        size="md"
                        className="h-16 w-16 rounded-xl flex-shrink-0"
                      />
                      <div className="min-w-0 flex-1">
                        <h4 className="text-sm font-bold text-white truncate">{pl.name}</h4>
                        {pl.description && (
                          <p className="text-xs text-zinc-400 truncate mt-0.5">{pl.description}</p>
                        )}
                        <p className="text-[11px] text-zinc-500 mt-1">
                          {pl.song_ids?.length || 0} tracks
                        </p>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeletePlaylist(pl.id);
                        }}
                        className="rounded-lg p-2 text-zinc-500 hover:bg-rose-500/15 hover:text-rose-400 transition cursor-pointer"
                        title="Delete playlist"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            /* Track List Views */
            <div className="max-w-[1400px] mx-auto space-y-5">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  {activeTab === 'playlists' && activePlaylistId && (
                    <button
                      onClick={() => setActivePlaylistId(null)}
                      className="text-xs font-semibold text-gold-400 hover:underline mb-1 block cursor-pointer"
                    >
                      ← Back to Playlists
                    </button>
                  )}
                  <h2 className="text-2xl font-extrabold text-white flex items-center gap-2.5">
                    {activeTab === 'trending' && (
                      <>
                        <Flame className="w-6 h-6 text-gold-400" /> Trending & What Everybody Is
                        Listening To
                      </>
                    )}
                    {activeTab === 'new-music' && (
                      <>
                        <Sparkles className="w-6 h-6 text-gold-400" /> New Music Releases
                      </>
                    )}
                    {activeTab === 'browse' && 'All Gyidi Nnwom Tracks'}
                    {activeTab === 'choirs' && 'Choirs & Singers'}
                    {activeTab === 'sermons' && (
                      <>
                        <Mic2 className="w-6 h-6 text-gold-400" /> Sermons & Convention Teachings
                      </>
                    )}
                    {activeTab === 'offline' && (
                      <>
                        <CloudDownload className="w-6 h-6 text-forest-400" /> Offline Saved Audio
                      </>
                    )}
                    {activeTab === 'favorites' && (
                      <>
                        <Heart className="w-6 h-6 text-pink-500 fill-pink-500" /> Liked Songs
                      </>
                    )}
                    {activeTab === 'recent' && 'Recently Played'}
                    {activeTab === 'playlists' &&
                      activePlaylistId &&
                      playlists.find((p) => p.id === activePlaylistId)?.name}
                  </h2>
                  <p className="text-xs text-zinc-400 mt-1">
                    Showing {filteredSongs.length} tracks •{' '}
                    {formatDuration(
                      filteredSongs.reduce((acc, s) => acc + (s.duration_seconds || 0), 0)
                    )}{' '}
                    total audio
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {filteredSongs.length > 0 && (
                    <>
                      <button
                        onClick={() => {
                          const target = isAuthenticated
                            ? filteredSongs[0]
                            : filteredSongs.find((s) => guestUnlockedIds.has(s.id)) ||
                              filteredSongs[0];
                          playSong(target, filteredSongs);
                        }}
                        className="inline-flex items-center gap-1.5 rounded-full bg-gold-500 px-4 py-2 text-xs font-bold text-zinc-950 hover:bg-gold-400 transition cursor-pointer"
                      >
                        <Play className="w-3.5 h-3.5 fill-zinc-950" />
                        Play
                      </button>
                      <button
                        onClick={() => handleShuffleAll(filteredSongs)}
                        className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3.5 py-2 text-xs font-semibold text-white hover:bg-white/15 transition cursor-pointer"
                      >
                        <Shuffle className="w-3.5 h-3.5 text-gold-400" />
                        Shuffle
                      </button>
                    </>
                  )}

                  {activeTab !== 'trending' && activeTab !== 'new-music' && (
                    <select
                      value={sortBy}
                      onChange={(e) =>
                        setSortBy(
                          e.target.value as 'title' | 'popular' | 'duration' | 'newest'
                        )
                      }
                      className="rounded-full border border-white/10 bg-zinc-900 px-3.5 py-2 text-xs font-medium text-zinc-200 focus:border-gold-500 focus:outline-none"
                    >
                      <option value="title">Sort: A – Z</option>
                      <option value="popular">Sort: Most Played</option>
                      <option value="duration">Sort: Longest</option>
                      <option value="newest">Sort: Newest</option>
                    </select>
                  )}
                </div>
              </div>

              {activeTab === 'sermons' && (
                <div className="space-y-4">
                  {/* CONTINUE LISTENING SERMON RESUME SHELF */}
                  {inProgressSermons.length > 0 && (
                    <div className="rounded-2xl border border-cyan-500/30 bg-gradient-to-r from-cyan-500/12 via-zinc-900 to-zinc-950 p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <RotateCw className="w-4 h-4 text-cyan-400" />
                          <h3 className="text-xs font-extrabold uppercase tracking-wider text-cyan-200">
                            Continue Listening (Auto-Saved Sermon Progress)
                          </h3>
                        </div>
                        <span className="text-[11px] text-zinc-400">
                          Pick up right where you paused
                        </span>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {inProgressSermons.slice(0, 3).map(({ song, entry }) => {
                          const pct = Math.min(
                            99,
                            Math.max(
                              3,
                              Math.round((entry.positionSec / Math.max(1, entry.durationSec)) * 100)
                            )
                          );
                          return (
                            <div
                              key={song.id}
                              onClick={() =>
                                playSong(song, filteredSongs, {
                                  startAtSeconds: entry.positionSec,
                                })
                              }
                              className="group rounded-xl border border-white/10 bg-zinc-950/85 p-3 hover:border-cyan-400/50 transition cursor-pointer"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <p className="text-xs font-bold text-white truncate">
                                  {song.title}
                                </p>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    clearSermonProgress(userId, song.id);
                                    setSermonProgressTick((t) => t + 1);
                                  }}
                                  className="text-[10px] text-zinc-500 hover:text-zinc-300 cursor-pointer"
                                  title="Clear saved progress"
                                >
                                  Clear
                                </button>
                              </div>
                              <p className="text-[11px] text-zinc-400 truncate mt-0.5">
                                {song.preacher_name || song.artist}
                                {song.sermon_topic ? ` • ${song.sermon_topic}` : ''}
                              </p>
                              <div className="mt-2.5 h-1.5 w-full rounded-full bg-white/10 overflow-hidden">
                                <div
                                  className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-gold-400"
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                              <div className="mt-2 flex items-center justify-between text-[11px]">
                                <span className="font-extrabold text-cyan-300">
                                  ▶ Resume from {formatDuration(entry.positionSec)}
                                </span>
                                <span className="text-zinc-500">
                                  {formatDuration(entry.durationSec)}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* SERMON PREACHER, TOPIC & BIBLE BOOK FILTERS */}
                  <div className="rounded-2xl border border-white/10 bg-zinc-900/55 p-3.5 grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-gold-300/90 mb-1">
                        Preacher / Speaker
                      </label>
                      <select
                        value={sermonPreacherFilter}
                        onChange={(e) => setSermonPreacherFilter(e.target.value)}
                        className="w-full rounded-xl border border-white/10 bg-zinc-950 px-3 py-2 text-xs font-semibold text-white focus:border-gold-500 focus:outline-none"
                      >
                        <option value="All">All Preachers ({allSermons.length})</option>
                        {sermonFilterOptions.preachers.map((p) => (
                          <option key={p} value={p}>
                            {p}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-gold-300/90 mb-1">
                        Sermon Topic / Convention Theme
                      </label>
                      <select
                        value={sermonTopicFilter}
                        onChange={(e) => setSermonTopicFilter(e.target.value)}
                        className="w-full rounded-xl border border-white/10 bg-zinc-950 px-3 py-2 text-xs font-semibold text-white focus:border-gold-500 focus:outline-none"
                      >
                        <option value="All">All Topics</option>
                        {sermonFilterOptions.topics.map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-gold-300/90 mb-1">
                        Bible Book / Scripture
                      </label>
                      <select
                        value={sermonBookFilter}
                        onChange={(e) => setSermonBookFilter(e.target.value)}
                        className="w-full rounded-xl border border-white/10 bg-zinc-950 px-3 py-2 text-xs font-semibold text-white focus:border-gold-500 focus:outline-none"
                      >
                        <option value="All">All Bible Books</option>
                        {sermonFilterOptions.books.map((b) => (
                          <option key={b} value={b}>
                            {b}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'offline' && (
                <div className="rounded-2xl border border-forest-500/25 bg-forest-500/8 px-4 py-3 flex flex-wrap items-center justify-between gap-3">
                  <p className="text-xs text-forest-200">
                    <strong>Zero-Data Offline Vault:</strong> Any song or sermon you save with the{' '}
                    <CloudDownload className="w-3.5 h-3.5 inline mx-0.5 text-forest-300" /> cloud
                    button is stored inside your device&apos;s app cache so you can play it with zero
                    internet.
                  </p>
                  <button
                    onClick={() => setInstallAppOpen(true)}
                    className="rounded-full bg-forest-500/20 border border-forest-400/35 px-3.5 py-1 text-xs font-bold text-forest-200 hover:bg-forest-500/30 cursor-pointer"
                  >
                    Install App Mode
                  </button>
                </div>
              )}

              {activeTab === 'browse' && (
                <div className="flex flex-wrap items-center gap-2">
                  {['All', 'Songs', 'Sermons', 'Recordings'].map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setSelectedCategory(cat)}
                      className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition cursor-pointer ${
                        selectedCategory === cat
                          ? 'bg-white text-zinc-950'
                          : 'bg-white/5 text-zinc-300 hover:bg-white/10'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              )}

              {(activeTab === 'browse' || activeTab === 'choirs') && (
                <div className="flex items-center gap-2 overflow-x-auto pb-1">
                  <button
                    onClick={() => setSelectedChoir('All')}
                    className={`flex-shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold border transition cursor-pointer ${
                      selectedChoir === 'All'
                        ? 'bg-gold-500/20 border-gold-400 text-gold-300'
                        : 'bg-zinc-900/70 border-white/10 text-zinc-400 hover:text-white'
                    }`}
                  >
                    <Users className="w-3.5 h-3.5 inline mr-1" />
                    All Choirs ({playableSongs.length})
                  </button>
                  {choirGroups.map((g) => (
                    <button
                      key={g.name}
                      onClick={() => setSelectedChoir(g.name)}
                      className={`flex-shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold border transition cursor-pointer ${
                        selectedChoir === g.name
                          ? 'bg-gold-500/20 border-gold-400 text-gold-300'
                          : 'bg-zinc-900/70 border-white/10 text-zinc-400 hover:text-white'
                      }`}
                    >
                      {g.name} ({g.count})
                    </button>
                  ))}
                </div>
              )}

              {filteredSongs.length === 0 ? (
                <div className="rounded-2xl border border-white/10 bg-zinc-900/40 p-12 text-center">
                  <p className="text-sm font-semibold text-zinc-300">No matching tracks found</p>
                  <p className="text-xs text-zinc-500 mt-1">
                    Try clearing your search or selecting another filter.
                  </p>
                </div>
              ) : (
                <div className="rounded-2xl border border-white/10 bg-zinc-900/40 p-2">
                  {filteredSongs.slice(0, visibleCount).map((song, idx) => (
                    <SongRow
                      key={song.id}
                      song={song}
                      index={idx}
                      contextQueue={filteredSongs}
                      isFavorite={favoriteIds.has(song.id)}
                      savedResumeSec={sermonProgressMap[song.id]?.positionSec}
                      isOfflineSaved={offlineSavedIds.has(song.id)}
                      onToggleFavorite={handleToggleFavorite}
                      onOpenArtiste={handleOpenArtisteProfile}
                      onEditSong={canViewerEditSong(song) ? (s) => setEditingLyricsSong(s) : undefined}
                      onOpenLyrics={handleOpenLyrics}
                      onOpenShareCard={(s) => handleOpenShareCard(s)}
                      onToggleOfflineSave={handleToggleOfflineSave}
                      onOpenPlaylistModal={(s) => handleRequestPlaylistModal(s)}
                    />
                  ))}
                  {visibleCount < filteredSongs.length && (
                    <div ref={loadMoreRef} className="py-4 text-center text-xs text-zinc-500">
                      Loading more tracks ({visibleCount} of {filteredSongs.length})...
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </main>
      </div>

      {/* The browser blocks audio on a fresh page load because there has been
          no user gesture yet, which is exactly what arriving from a shared
          link looks like. Offer the single tap it is waiting for rather than
          silently landing on Discover with a paused track. */}
      {autoplayBlocked && currentSong && (
        <div className="fixed inset-x-0 bottom-24 z-40 flex justify-center px-4 lg:left-64">
          <button
            type="button"
            onClick={resumePlayback}
            className="flex w-full max-w-md items-center gap-3 rounded-2xl border border-gold-400/30 bg-zinc-900/95 p-3 text-left shadow-2xl backdrop-blur cursor-pointer hover:bg-zinc-900"
          >
            <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-gold-500 text-zinc-950">
              <Play className="h-5 w-5 fill-zinc-950" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-xs font-extrabold text-white">
                Tap to play{sharedTrackTitle ? ` ${sharedTrackTitle}` : ' this track'}
              </span>
              <span className="block truncate text-[11px] text-zinc-400">
                {sharedTrackTitle
                  ? 'You were sent this track. Your browser needs one tap before audio can start.'
                  : 'Your browser needs one tap before audio can start.'}
              </span>
            </span>
          </button>
        </div>
      )}

      <PlayerBar
        isFavorite={currentSong ? favoriteIds.has(currentSong.id) : false}
        isOfflineSaved={currentSong ? offlineSavedIds.has(currentSong.id) : false}
        onToggleFavorite={() => currentSong && handleToggleFavorite(currentSong)}
        onToggleOfflineSave={handleToggleOfflineSave}
        onOpenPlaylistModal={(s) => handleRequestPlaylistModal(s)}
        onToggleQueue={() => {
          if (!isAuthenticated) {
            openAccountPrompt('Create a free account to manage your Up Next queue!');
            return;
          }
          setQueueOpen((o) => !o);
        }}
        onOpenLyrics={handleOpenLyrics}
        onOpenShareCard={(s) => handleOpenShareCard(s)}
      />

      <QueueDrawer isOpen={queueOpen} onClose={() => setQueueOpen(false)} />

      <LyricsDrawer
        isOpen={isPremium && Boolean(lyricsDrawerSong)}
        song={lyricsDrawerSong}
        canEditSong={canViewerEditSong(lyricsDrawerSong)}
        onClose={() => setLyricsDrawerSong(null)}
        onEditLyrics={(s) => {
          setLyricsDrawerSong(null);
          setEditingLyricsSong(s);
        }}
        onOpenShareCard={handleOpenShareCard}
      />

      <ShareCardModal
        isOpen={isPremium && Boolean(shareCardSong)}
        song={shareCardSong}
        initialQuote={shareCardInitialQuote}
        onClose={() => setShareCardSong(null)}
      />

      <InstallAppModal
        isOpen={installAppOpen}
        onClose={() => setInstallAppOpen(false)}
        deferredPrompt={deferredInstallPrompt}
        onInstalled={() => {
          setIsAppInstalled(true);
          setDeferredInstallPrompt(null);
        }}
      />

      <EditReleaseModal
        isOpen={Boolean(editingLyricsSong)}
        onClose={() => setEditingLyricsSong(null)}
        song={editingLyricsSong}
        onSaved={() => {
          fetchPlatformData();
          setEditingLyricsSong(null);
        }}
        onDeleted={() => {
          fetchPlatformData();
          setEditingLyricsSong(null);
        }}
      />

      {userProfile &&
        userId &&
        (userProfile.role === 'artiste' || userProfile.role === 'admin') && (
          <UploadModal
            isOpen={uploadOpen}
            onClose={() => setUploadOpen(false)}
            profile={userProfile}
            authUserId={userId}
            onSubmitted={({ songs: newSongs, album: newAlbum }) => {
              setSongs((prev) => [...newSongs, ...prev]);
              if (newAlbum) setAlbums((prev) => [newAlbum, ...prev]);
              fetchPlatformData();
            }}
          />
        )}

      <EditArtisteModal
        isOpen={createArtisteOpen}
        onClose={() => setCreateArtisteOpen(false)}
        artiste={null}
        isAdminViewer={userProfile?.role === 'admin'}
        onSaved={(saved) => {
          setArtistes((prev) => [saved, ...prev]);
          fetchPlatformData();
        }}
      />

      <SupportModal
        isOpen={supportOpen}
        onClose={() => setSupportOpen(false)}
        isAdminViewer={userProfile?.role === 'admin'}
        onSaved={() => fetchPlatformData()}
      />
      <DeveloperModal isOpen={developerOpen} onClose={() => setDeveloperOpen(false)} />

      <PlaylistModal
        isOpen={playlistModalOpen}
        onClose={() => setPlaylistModalOpen(false)}
        song={playlistModalSong}
        playlists={playlists}
        onCreatePlaylist={handleCreatePlaylist}
        onAddSongToPlaylist={handleAddSongToPlaylist}
      />

      <DailyFeedModal
        isOpen={dailyFeedOpen}
        onClose={() => {
          markCurrentFeedSeen();
          setDailyFeedOpen(false);
        }}
        verseFlyers={verseFlyers}
        announcements={announcements}
        viewerRole={userProfile?.role || null}
        isPremium={isPremium}
        onUpgradeToPremium={() =>
          openPremiumPrompt('Daily Bible Verse flyers are a Gyidi Nnwom Premium feature.')
        }
        initialTab={dailyFeedInitialTab}
      />
    </div>
  );
};

export default function App() {
  const [songs, setSongs] = useState<Song[]>(() => {
    try {
      const cached = localStorage.getItem(CATALOG_CACHE_KEY);
      return cached ? (JSON.parse(cached) as Song[]) : [];
    } catch {
      return [];
    }
  });
  const [albums, setAlbums] = useState<Album[]>([]);
  const [artistes, setArtistes] = useState<UserProfile[]>([]);
  const [playEvents, setPlayEvents] = useState<PlayEventItem[]>([]);
  const [platformSettings, setPlatformSettings] = useState<PlatformSettings | null>(null);
  const [verseFlyers, setVerseFlyers] = useState<DailyVerseFlyer[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loadingCatalog, setLoadingCatalog] = useState<boolean>(() => songs.length === 0);

  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);

  // Dynamically load Google AdSense script whenever Admin activates it, but
  // never for Premium accounts. Gating the script matters as much as gating
  // the banners: Auto Ads inject units on their own once this is on the page.
  const adsAllowed = !isUserPremiumActive(userProfile, platformSettings);
  useGoogleAdSenseScript(platformSettings, adsAllowed);

  // Auth modal state hoisted so PlayerProvider & every action gate can open Create Account!
  const [authOpen, setAuthOpen] = useState(false);
  const [authDefaultArtiste, setAuthDefaultArtiste] = useState(false);
  const [authForceSignup, setAuthForceSignup] = useState(false);
  const [authPromptReason, setAuthPromptReason] = useState<string | null>(null);

  const openAccountPrompt = useCallback((reason?: string, defaultArtiste = false) => {
    setAuthPromptReason(reason || null);
    setAuthDefaultArtiste(defaultArtiste);
    setAuthForceSignup(true);
    setAuthOpen(true);
  }, []);

  const fetchPlatformData = useCallback(async () => {
    const [
      { data: songRows },
      { data: albumRows },
      { data: profileRows },
      { data: eventRows },
      { data: settingsRow },
      { data: flyerRows },
      { data: annRows },
    ] = await Promise.all([
      supabase.from('songs').select('*').order('title', { ascending: true }).limit(1000),
      supabase
        .from('albums')
        .select('*')
        .order('submitted_at', { ascending: false })
        .limit(300),
      supabase
        .from('profiles')
        .select('*')
        .in('role', ['artiste', 'admin'])
        .order('created_at', { ascending: false }),
      supabase
        .from('play_events')
        .select('*')
        .order('played_at', { ascending: false })
        .limit(150),
      supabase.from('platform_settings').select('*').eq('id', 'global').maybeSingle(),
      supabase
        .from('daily_verse_flyers')
        .select('*')
        .order('scheduled_date', { ascending: false })
        .limit(30),
      supabase
        .from('announcements')
        .select('*')
        .order('publish_at', { ascending: false })
        .limit(30),
    ]);

    if (songRows) {
      const typed = songRows as Song[];
      setSongs(typed);
      try {
        localStorage.setItem(CATALOG_CACHE_KEY, JSON.stringify(typed));
      } catch {
        // ignore
      }
    }
    if (albumRows) setAlbums(albumRows as Album[]);
    // Suspended accounts drop out of the public directory.
    if (profileRows) setArtistes((profileRows as UserProfile[]).filter((p) => !p.is_banned));
    if (eventRows) setPlayEvents(eventRows as PlayEventItem[]);
    if (settingsRow) setPlatformSettings(settingsRow as PlatformSettings);
    if (flyerRows) setVerseFlyers(flyerRows as DailyVerseFlyer[]);
    if (annRows) setAnnouncements(annRows as Announcement[]);
    setLoadingCatalog(false);
  }, []);

  useEffect(() => {
    fetchPlatformData();
  }, [fetchPlatformData]);

  const fetchOwnProfile = useCallback(async (uid: string) => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .or(`claimed_user_id.eq.${uid},id.eq.${uid}`);

    if (data && data.length > 0) {
      const rows = data as UserProfile[];
      const preferred =
        rows.find((r) => r.role === 'admin') ||
        rows.find((r) => r.claimed_user_id === uid && r.is_precreated) ||
        rows.find((r) => r.role === 'artiste') ||
        rows[0];
      setUserProfile(preferred);
    }
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      const u = session?.user ?? null;
      setUserId(u?.id ?? null);
      setUserEmail(u?.email ?? null);
      if (u?.id) fetchOwnProfile(u.id);
      else setUserProfile(null);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const u = session?.user ?? null;
      setUserId(u?.id ?? null);
      setUserEmail(u?.email ?? null);
      if (u?.id) {
        fetchOwnProfile(u.id);
        fetchPlatformData();
      } else {
        setUserProfile(null);
      }
    });

    return () => subscription.unsubscribe();
  }, [fetchOwnProfile, fetchPlatformData]);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    const restore = async () => {
      try {
        const result = await recoverPremiumAccount();
        if (!cancelled) setUserProfile(result.profile);
      } catch { if (!cancelled) void fetchOwnProfile(userId); }
    };
    void restore();
    const refresh = () => { if (document.visibilityState === 'visible') void restore(); };
    document.addEventListener('visibilitychange', refresh);
    const interval = window.setInterval(() => { if (document.visibilityState === 'visible') void fetchOwnProfile(userId); }, 60000);
    return () => { cancelled = true; document.removeEventListener('visibilitychange', refresh); window.clearInterval(interval); };
  }, [userId, fetchOwnProfile]);

  const playableSongs = useMemo(
    () => songs.filter((s) => isSongPubliclyPlayable(s)),
    [songs]
  );

  const { trendingSongs, listeningNowFeed } = useMemo(() => {
    const recentCounts = new Map<string, number>();
    for (const ev of playEvents) {
      recentCounts.set(ev.song_id, (recentCounts.get(ev.song_id) || 0) + 1);
    }

    const songMap = new Map(playableSongs.map((s) => [s.id, s]));
    const feed: Array<{ song: Song; playedAt: string }> = [];
    const seenFeed = new Set<string>();
    for (const ev of playEvents) {
      const s = songMap.get(ev.song_id);
      if (s && !seenFeed.has(s.id)) {
        seenFeed.add(s.id);
        feed.push({ song: s, playedAt: ev.played_at });
        if (feed.length >= 8) break;
      }
    }

    const sortedTrending = [...playableSongs]
      .sort((a, b) => {
        const scoreA = (recentCounts.get(a.id) || 0) * 5 + a.plays_count * 2 + a.likes_count * 3;
        const scoreB = (recentCounts.get(b.id) || 0) * 5 + b.plays_count * 2 + b.likes_count * 3;
        return scoreB - scoreA || a.title.localeCompare(b.title);
      })
      .slice(0, 40);

    return { trendingSongs: sortedTrending, listeningNowFeed: feed };
  }, [playableSongs, playEvents]);

  // Strictly 5 songs unlocked for unauthenticated guests; the rest of the catalog is locked!
  const guestUnlockedIds = useMemo(() => {
    const topFive = trendingSongs.slice(0, 5).map((s) => s.id);
    return new Set(topFive);
  }, [trendingSongs]);

  // A banned account is met with an explanation rather than the app. The
  // profile row is kept (only flagged), which is what makes this page — and
  // reversing the decision — possible.
  if (userProfile?.is_banned) {
    return (
      <BannedScreen
        reason={userProfile.ban_reason}
        bannedAt={userProfile.banned_at}
        displayName={userProfile.stage_name || userProfile.display_name}
        onSignOut={() => void supabase.auth.signOut()}
      />
    );
  }

  return (
    <PlayerProvider
      userId={userId}
      isAuthenticated={Boolean(userId)}
      guestUnlockedIds={guestUnlockedIds}
      onRequireAccount={(reason) => openAccountPrompt(reason, false)}
    >
      <MainAppInner
        songs={songs}
        setSongs={setSongs}
        albums={albums}
        setAlbums={setAlbums}
        artistes={artistes}
        setArtistes={setArtistes}
        playEvents={playEvents}
        platformSettings={platformSettings}
        verseFlyers={verseFlyers}
        announcements={announcements}
        loadingCatalog={loadingCatalog}
        userId={userId}
        userEmail={userEmail}
        userProfile={userProfile}
        setUserProfile={setUserProfile}
        playableSongs={playableSongs}
        trendingSongs={trendingSongs}
        listeningNowFeed={listeningNowFeed}
        guestUnlockedIds={guestUnlockedIds}
        fetchPlatformData={fetchPlatformData}
        openAccountPrompt={openAccountPrompt}
      />

      <AuthModal
        isOpen={authOpen}
        defaultSignupArtiste={authDefaultArtiste}
        forceSignupMode={authForceSignup}
        promptReason={authPromptReason}
        onClose={() => {
          setAuthOpen(false);
          setAuthPromptReason(null);
        }}
        onSuccess={() => fetchPlatformData()}
      />
    </PlayerProvider>
  );
}
