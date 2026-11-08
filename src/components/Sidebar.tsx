import React, { useState } from 'react';
import {
  Compass,
  Flame,
  Sparkles,
  CalendarClock,
  Disc3,
  Mic2,
  Library,
  Users,
  Heart,
  ListMusic,
  Clock,
  UploadCloud,
  HeartHandshake,
  Code2,
  ShieldCheck,
  LogIn,
  LogOut,
  BadgeCheck,
  MessageSquare,
  BookOpen,
  Video,
  CloudDownload,
  Smartphone,
  Crown,
  X,
  Camera,
} from 'lucide-react';
import {
  NavTab,
  PlatformSettings,
  UserProfile,
  isUserPremiumActive,
} from '../types/music';
import { GoogleAdBanner } from './GoogleAdBanner';
import { supabase } from '../lib/supabase';

interface SidebarProps {
  activeTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  totalSongs: number;
  albumsCount: number;
  upcomingCount: number;
  pendingCount: number;
  unreadMessagesCount: number;
  favoritesCount: number;
  playlistsCount: number;
  offlineCount?: number;
  userEmail: string | null;
  profile: UserProfile | null;
  platformSettings?: PlatformSettings | null;
  hasUnseenDailyFeed?: boolean;
  onOpenDailyFeed?: () => void;
  onOpenInstallApp?: () => void;
  onOpenAuth: (defaultArtiste?: boolean) => void;
  onSignOut: () => void;
  onOpenUpload: () => void;
  onOpenSupport: () => void;
  onOpenDeveloper: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onSelectTab,
  totalSongs,
  albumsCount,
  upcomingCount,
  pendingCount,
  unreadMessagesCount,
  favoritesCount,
  playlistsCount,
  offlineCount = 0,
  userEmail,
  profile,
  platformSettings,
  hasUnseenDailyFeed,
  onOpenDailyFeed,
  onOpenInstallApp,
  onOpenAuth,
  onSignOut,
  onOpenSupport,
  onOpenDeveloper,
  mobileOpen,
  onCloseMobile,
}) => {
  const isAdmin = profile?.role === 'admin';
  const isArtiste = profile?.role === 'artiste' || isAdmin;
  const isPremium = isUserPremiumActive(profile, platformSettings);
  const monthlyPrice = Number(platformSettings?.premium_monthly_price_ghs ?? 5);

  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);

  const handleListenerPhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !profile) return;
    setPhotoBusy(true);
    setPhotoError(null);
    try {
      const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
      const path = `avatars/listener-${profile.id}-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from('covers')
        .upload(path, file, { cacheControl: '31536000', upsert: true });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from('covers').getPublicUrl(path);
      const { error: updErr } = await supabase
        .from('profiles')
        .update({ avatar_url: pub.publicUrl })
        .eq('id', profile.id);
      if (updErr) throw updErr;
    } catch (err: unknown) {
      setPhotoError(err instanceof Error ? err.message : 'Profile photo upload failed.');
    } finally {
      setPhotoBusy(false);
    }
  };

  const discoverItems: Array<{
    id: NavTab;
    label: string;
    icon: React.ReactNode;
    badge?: number | string;
    isPro?: boolean;
  }> = [
    { id: 'discover', label: 'Discover', icon: <Compass className="w-4 h-4" /> },
    { id: 'trending', label: 'Trending Now', icon: <Flame className="w-4 h-4 text-gold-400" /> },
    { id: 'new-music', label: 'New Music', icon: <Sparkles className="w-4 h-4 text-gold-400" /> },
    {
      id: 'upcoming',
      label: 'Upcoming Premieres',
      icon: <CalendarClock className="w-4 h-4 text-pink-400" />,
      badge: upcomingCount || undefined,
    },
    {
      id: 'albums',
      label: 'Albums & EPs',
      icon: <Disc3 className="w-4 h-4 text-gold-400" />,
      badge: albumsCount || undefined,
    },
    {
      id: 'artistes',
      label: 'SCG & SACSU Artistes',
      icon: <BadgeCheck className="w-4 h-4 text-gold-400" />,
    },
    {
      id: 'live',
      label: 'Live Video & Radio',
      icon: <Video className="w-4 h-4 text-rose-400" />,
      badge: 'PRO',
      isPro: true,
    },
  ];

  const libraryItems: Array<{
    id: NavTab;
    label: string;
    icon: React.ReactNode;
    badge?: number | string;
    isPro?: boolean;
  }> = [
    {
      id: 'browse',
      label: 'All Songs',
      icon: <Library className="w-4 h-4" />,
      badge: totalSongs || undefined,
    },
    { id: 'choirs', label: 'Choirs & Singers', icon: <Users className="w-4 h-4" /> },
    { id: 'sermons', label: 'Sermons', icon: <Mic2 className="w-4 h-4" /> },
    {
      id: 'offline',
      label: 'Offline Saved',
      icon: <CloudDownload className="w-4 h-4 text-forest-400" />,
      badge: isPremium && offlineCount > 0 ? offlineCount : !isPremium ? 'PRO' : undefined,
      isPro: true,
    },
    {
      id: 'favorites',
      label: 'Liked Songs',
      icon: <Heart className="w-4 h-4" />,
      badge: isPremium && favoritesCount > 0 ? favoritesCount : !isPremium ? 'PRO' : undefined,
      isPro: true,
    },
    {
      id: 'playlists',
      label: 'Playlists',
      icon: <ListMusic className="w-4 h-4" />,
      badge: isPremium && playlistsCount > 0 ? playlistsCount : !isPremium ? 'PRO' : undefined,
      isPro: true,
    },
    { id: 'recent', label: 'Recently Played', icon: <Clock className="w-4 h-4" /> },
  ];

  const handleSelect = (tab: NavTab) => {
    onSelectTab(tab);
    onCloseMobile();
  };

  const renderBtn = (item: {
    id: NavTab;
    label: string;
    icon: React.ReactNode;
    badge?: number | string;
  }) => {
    const active = activeTab === item.id;
    return (
      <button
        key={item.id}
        onClick={() => handleSelect(item.id)}
        className={`w-full flex items-center justify-between rounded-xl px-3 py-2 text-xs font-semibold transition cursor-pointer ${
          active
            ? 'bg-gradient-to-r from-gold-500/20 via-pink-500/15 to-transparent text-gold-300 border border-gold-500/25'
            : 'text-zinc-400 hover:bg-white/5 hover:text-zinc-100 border border-transparent'
        }`}
      >
        <span className="flex items-center gap-2.5">
          {item.icon}
          {item.label}
        </span>
        {item.badge !== undefined && (
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
              item.badge === 'PRO'
                ? 'bg-gold-500/20 border border-gold-400/40 text-gold-300 uppercase tracking-wider'
                : item.badge === 'Soon'
                ? 'bg-rose-500/20 border border-rose-400/35 text-rose-200 uppercase tracking-wider'
                : 'bg-white/10 text-zinc-200'
            }`}
          >
            {item.badge}
          </span>
        )}
      </button>
    );
  };

  const sidebarContent = (
    <div className="flex h-full flex-col bg-forest-950 border-r border-white/10 w-64 px-4 py-4 select-none">
      {/* Custom Generated Gyidi Nnwom Logo + Mobile Close Button */}
      <div className="flex items-center justify-between gap-2 px-1.5 mb-4">
        <div
          onClick={() => handleSelect('discover')}
          className="flex items-center gap-3 cursor-pointer group min-w-0"
        >
          <img
            src="/logo-mark.png"
            alt="Gyidi Nnwom Logo"
            className="h-10 w-10 rounded-xl object-cover border border-gold-500/30 shadow-lg shadow-gold-500/15 flex-shrink-0"
          />
          <div className="min-w-0">
            <h1 className="text-base font-extrabold tracking-tight text-white leading-none truncate">
              Gyidi Nnwom
            </h1>
            <p className="text-[11px] text-gold-400/90 font-medium mt-1 truncate">
              SCG &amp; SACSU Streaming
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onCloseMobile}
          className="lg:hidden rounded-full bg-white/10 p-1.5 text-zinc-300 hover:bg-white/20 hover:text-white cursor-pointer"
          aria-label="Close sidebar menu"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Premium Pricing & Billing CTA */}
      <button
        type="button"
        onClick={() => handleSelect('premium')}
        className={`mb-3 w-full flex items-center justify-between rounded-xl px-3 py-2.5 text-xs font-extrabold transition cursor-pointer ${
          activeTab === 'premium'
            ? 'bg-gradient-to-r from-gold-400 to-pink-500 text-forest-950 shadow-lg'
            : 'bg-gradient-to-r from-gold-500/20 via-pink-500/15 to-gold-500/10 text-gold-200 border border-gold-400/35 hover:border-gold-400/60'
        }`}
      >
        <span className="flex items-center gap-2">
          <Crown className="w-4 h-4 flex-shrink-0" />
          Premium &amp; Billing
        </span>
        <span
          className={`rounded-full px-2 py-0.5 text-[10px] font-black ${
            activeTab === 'premium'
              ? 'bg-forest-950 text-gold-300'
              : 'bg-gold-400 text-forest-950'
          }`}
        >
          {isPremium ? 'Active ✓' : `GHS ${monthlyPrice}`}
        </span>
      </button>

      {/* Scrollable Navigation */}
      <nav className="space-y-4 flex-1 min-h-0 overflow-y-auto pr-0.5">
        {(isAdmin || userEmail) && (
          <div className="space-y-1">
            <p className="px-2.5 pb-1 text-[10px] font-bold uppercase tracking-widest text-gold-400/90">
              Creator & Admin
            </p>
            {isAdmin && (
              <button
                onClick={() => handleSelect('admin')}
                className={`w-full flex items-center justify-between rounded-xl px-3 py-2 text-xs font-bold transition cursor-pointer ${
                  activeTab === 'admin'
                    ? 'bg-gold-500 text-forest-950'
                    : 'bg-gold-500/15 text-gold-300 border border-gold-500/30 hover:bg-gold-500/25'
                }`}
              >
                <span className="flex items-center gap-2.5">
                  <ShieldCheck className="w-4 h-4" />
                  Admin Dashboard
                </span>
                {pendingCount > 0 && (
                  <span className="rounded-full bg-rose-500 px-1.5 py-0.5 text-[10px] font-extrabold text-white">
                    {pendingCount}
                  </span>
                )}
              </button>
            )}

            <button
              onClick={() => handleSelect('artiste-studio')}
              className={`w-full flex items-center justify-between rounded-xl px-3 py-2 text-xs font-semibold transition cursor-pointer ${
                activeTab === 'artiste-studio'
                  ? 'bg-pink-500/20 text-pink-200 border border-pink-400/40'
                  : 'text-zinc-300 hover:bg-white/5 border border-transparent'
              }`}
            >
              <span className="flex items-center gap-2.5">
                <UploadCloud className="w-4 h-4 text-pink-400" />
                {isArtiste ? 'Artiste Studio & Analytics' : 'Become an Artiste'}
              </span>
            </button>

            {isArtiste && (
              <button
                onClick={() => handleSelect('messages')}
                className={`w-full flex items-center justify-between rounded-xl px-3 py-2 text-xs font-semibold transition cursor-pointer ${
                  activeTab === 'messages'
                    ? 'bg-gold-500/20 text-gold-200 border border-gold-400/40'
                    : 'text-zinc-300 hover:bg-white/5 border border-transparent'
                }`}
              >
                <span className="flex items-center gap-2.5">
                  <MessageSquare className="w-4 h-4 text-gold-400" />
                  Messages & Broadcasts
                </span>
                {unreadMessagesCount > 0 && (
                  <span className="rounded-full bg-rose-500 px-1.5 py-0.5 text-[10px] font-extrabold text-white">
                    {unreadMessagesCount}
                  </span>
                )}
              </button>
            )}
          </div>
        )}

        <div className="space-y-0.5">
          <p className="px-2.5 pb-1 text-[10px] font-bold uppercase tracking-widest text-zinc-500">
            Discover
          </p>
          {discoverItems.map(renderBtn)}
          {onOpenDailyFeed && (
            <button
              onClick={() => {
                onCloseMobile();
                onOpenDailyFeed();
              }}
              className="w-full flex items-center justify-between rounded-xl px-3 py-2 text-xs font-semibold text-gold-200 hover:bg-white/5 transition cursor-pointer"
            >
              <span className="flex items-center gap-2.5">
                <BookOpen className="w-4 h-4 text-gold-400" />
                Daily Verse & Notices
              </span>
              {hasUnseenDailyFeed && (
                <span className="rounded-full bg-rose-500 px-1.5 py-0.5 text-[9px] font-extrabold text-white">
                  New
                </span>
              )}
            </button>
          )}
        </div>

        <div className="space-y-0.5 pt-2 border-t border-white/10">
          <p className="px-2.5 pb-1 text-[10px] font-bold uppercase tracking-widest text-zinc-500">
            Library
          </p>
          {libraryItems.map(renderBtn)}
        </div>

        {/* Install App + Support Gyidi + Separate Meet the Developer Section Directly Below */}
        <div className="pt-3 border-t border-white/10 space-y-2">
          {onOpenInstallApp && (
            <button
              onClick={() => {
                onCloseMobile();
                onOpenInstallApp();
              }}
              className="w-full flex items-center justify-between rounded-xl px-3 py-2 text-xs font-semibold text-forest-200 bg-forest-500/10 border border-forest-500/20 hover:bg-forest-500/20 transition cursor-pointer"
            >
              <span className="flex items-center gap-2.5">
                <Smartphone className="w-4 h-4 text-forest-400 flex-shrink-0" />
                Install Mobile App
              </span>
              <span className="text-[9px] font-extrabold uppercase tracking-wider text-forest-300">
                PWA
              </span>
            </button>
          )}

          <div>
            <p className="px-2.5 pb-1 text-[10px] font-bold uppercase tracking-widest text-zinc-500">
              Support Gyidi
            </p>
            <button
              onClick={() => {
                onCloseMobile();
                onOpenSupport();
              }}
              className="w-full flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-semibold text-pink-200 bg-pink-500/10 border border-pink-500/20 hover:bg-pink-500/20 transition cursor-pointer"
            >
              <HeartHandshake className="w-4 h-4 text-pink-400 flex-shrink-0" />
              Support Gyidi Nnwom
            </button>
          </div>

          <div className="pt-2 border-t border-white/10">
            <p className="px-2.5 pb-1 text-[10px] font-bold uppercase tracking-widest text-zinc-500">
              Meet the Developer
            </p>
            <button
              onClick={() => {
                onCloseMobile();
                onOpenDeveloper();
              }}
              className="w-full flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-semibold text-gold-200 bg-gold-500/10 border border-gold-500/20 hover:bg-gold-500/20 transition cursor-pointer"
            >
              <Code2 className="w-4 h-4 text-gold-400 flex-shrink-0" />
              Desmond Kofi Antwi
            </button>
          </div>

          <GoogleAdBanner settings={platformSettings || null} slotType="sidebar" />
        </div>
      </nav>

      {/* Account Footer */}
      <div className="pt-3 mt-2 border-t border-white/10 pb-20 lg:pb-16">
        {userEmail ? (
          <div className="rounded-xl bg-forest-900/90 border border-white/10 p-2.5">
            <div className="flex items-center gap-2">
              {profile?.avatar_url && (
                <img
                  src={profile.avatar_url}
                  alt=""
                  className="w-7 h-7 rounded-lg object-cover flex-shrink-0"
                />
              )}
              <div className="min-w-0">
                <p className="text-xs font-bold text-white truncate">
                  {profile?.stage_name || profile?.display_name || userEmail.split('@')[0]}
                </p>
                <p className="text-[10px] uppercase tracking-wider text-gold-400 font-semibold">
                  {profile?.is_sacsu ? 'SACSU Artiste' : profile?.role || 'listener'}
                </p>
              </div>
            </div>
            {profile && profile.role === 'listener' && (
              <div className="mt-3 space-y-1.5">
                <label
                  className="flex w-full items-center gap-2 rounded-xl border border-white/15 bg-forest-950 px-3 py-2 text-xs text-zinc-300 hover:border-gold-400 cursor-pointer transition disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <Camera className="w-3.5 h-3.5 flex-shrink-0" />
                  {photoBusy ? 'Updating…' : 'Change Profile Photo'}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={handleListenerPhotoChange}
                    disabled={photoBusy}
                    className="hidden"
                  />
                </label>
                {photoError && <p className="text-[10px] text-rose-400">{photoError}</p>}
              </div>
            )}

            <button
              onClick={onSignOut}
              className="mt-2 w-full flex items-center justify-center gap-1.5 rounded-lg bg-white/5 py-1.5 text-[11px] font-medium text-zinc-300 hover:bg-white/10 hover:text-white transition cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              Sign Out
            </button>
          </div>
        ) : (
          <div className="space-y-1.5">
            <button
              onClick={() => {
                onCloseMobile();
                onOpenAuth(false);
              }}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-gold-500 hover:bg-gold-400 py-2 text-xs font-extrabold text-forest-950 transition cursor-pointer"
            >
              <LogIn className="w-3.5 h-3.5" />
              Create Account / Sign In
            </button>
            <button
              onClick={() => {
                onCloseMobile();
                onOpenAuth(true);
              }}
              className="w-full flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-gold-500/20 to-pink-500/20 border border-gold-500/30 py-1.5 text-[11px] font-bold text-gold-300 hover:bg-gold-500/30 transition cursor-pointer"
            >
              <UploadCloud className="w-3.5 h-3.5" />
              Artiste / SACSU Sign Up
            </button>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <>
      <aside className="hidden lg:block flex-shrink-0">{sidebarContent}</aside>
      {mobileOpen && (
        <div
          className="safe-insets fixed inset-0 z-40 flex lg:hidden bg-black/70 backdrop-blur-xs"
          onClick={onCloseMobile}
        >
          <div className="h-full min-h-0 max-w-full" onClick={(e) => e.stopPropagation()}>{sidebarContent}</div>
        </div>
      )}
    </>
  );
};
