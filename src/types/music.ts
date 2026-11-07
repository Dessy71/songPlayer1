export type UserRole = 'listener' | 'artiste' | 'admin';
export type ApprovalStatus = 'pending' | 'approved' | 'rejected';

export interface TimedLyricLine {
  time: number; // seconds
  text: string;
}

export interface Album {
  id: string;
  slug: string;
  title: string;
  artist: string;
  artiste_id?: string | null;
  uploaded_by?: string | null;
  description?: string | null;
  category: 'Songs' | 'Sermons' | 'Recordings' | string;
  choir_group: string;
  cover_url: string;
  cover_theme: string;
  approval_status: ApprovalStatus;
  rejection_reason?: string | null;
  approved_by?: string | null;
  approved_at?: string | null;
  is_premiere: boolean;
  premiere_at?: string | null;
  submitted_at: string;
  published_at?: string | null;
  created_at: string;
}

export interface Song {
  id: string;
  slug: string;
  title: string;
  artist: string;
  original_name?: string | null;
  category: 'Songs' | 'Sermons' | 'Recordings' | string;
  choir_group: string;
  storage_path: string;
  stream_url: string;
  cover_theme: string;
  cover_url?: string | null;
  duration_seconds: number;
  file_size_bytes: number;
  plays_count: number;
  likes_count: number;
  uploaded_by?: string | null;
  artiste_id?: string | null;
  album_id?: string | null;
  track_number?: number | null;
  approval_status: ApprovalStatus;
  rejection_reason?: string | null;
  approved_by?: string | null;
  approved_at?: string | null;
  is_premiere: boolean;
  premiere_at?: string | null;
  submitted_at: string;
  published_at?: string | null;
  created_at: string;
  // Lyrics & Sermon metadata
  lyrics_text?: string | null;
  lyrics_timed?: TimedLyricLine[] | null;
  lyrics_language?: string | null;
  lyrics_format?: string | null;
  bible_book?: string | null;
  sermon_topic?: string | null;
  preacher_name?: string | null;
  convention_year?: number | null;
}

export interface UserProfile {
  id: string;
  claimed_user_id?: string | null;
  email?: string | null;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  role: UserRole;
  real_name?: string | null;
  stage_name?: string | null;
  bio?: string | null;
  scg_zone?: string | null;
  scg_branch?: string | null;
  is_sacsu?: boolean;
  tertiary_institution?: string | null;
  is_precreated?: boolean;
  /** Payout details collected during signup, used by Admin to create Paystack payment pages/subaccounts. */
  payment_method?: 'bank' | 'momo' | null;
  bank_name?: string | null;
  bank_account_number?: string | null;
  bank_account_name?: string | null;
  momo_operator?: string | null;
  momo_phone_number?: string | null;
  /** Admin-controlled: a support page only goes live once approved with Paystack details. */
  approval_status?: ApprovalStatus;
  is_verified_artiste?: boolean;
  is_premium?: boolean;
  premium_plan?: 'monthly' | 'yearly' | 'lifetime' | null;
  premium_until?: string | null;
  last_payment_reference?: string | null;
  created_at: string;
}

export interface ProfileClaimCode {
  profile_id: string;
  claim_code: string;
  claimed_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface PlatformSettings {
  id: string;
  adsense_enabled: boolean;
  adsense_publisher_id?: string | null;
  adsense_home_slot_id?: string | null;
  adsense_sidebar_slot_id?: string | null;
  adsense_popup_slot_id?: string | null;
  adsense_auto_ads: boolean;
  premium_enabled?: boolean;
  premium_monthly_price_ghs?: number;
  premium_yearly_price_ghs?: number;
  paystack_public_key?: string | null;
  premium_currency?: string | null;
  updated_by?: string | null;
  updated_at: string;
}

export interface PremiumSubscription {
  id: string;
  user_id: string;
  profile_id?: string | null;
  user_email?: string | null;
  plan_interval: 'monthly' | 'yearly';
  amount_ghs: number;
  currency: string;
  paystack_reference: string;
  paystack_status: string;
  payment_channel?: string | null;
  starts_at: string;
  expires_at: string;
  created_at: string;
}

export interface DailyVerseFlyer {
  id: string;
  scheduled_date: string; // YYYY-MM-DD
  publish_at: string;
  scripture_ref?: string | null;
  caption?: string | null;
  flyer_url: string;
  show_popup: boolean;
  is_active: boolean;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
}

export interface Announcement {
  id: string;
  title: string;
  body: string;
  flyer_url?: string | null;
  cta_label?: string | null;
  cta_url?: string | null;
  audience: 'all' | 'listeners' | 'artistes';
  priority: 'normal' | 'important' | 'urgent';
  show_popup: boolean;
  is_active: boolean;
  publish_at: string;
  expires_at?: string | null;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
}

export interface LiveStreamWaitlistEntry {
  id: string;
  user_id: string;
  profile_id?: string | null;
  interest_type: 'viewer' | 'broadcaster' | 'both';
  branch_or_campus?: string | null;
  created_at: string;
}

export interface ArtisteMessage {
  id: string;
  sender_profile_id: string;
  recipient_profile_id?: string | null;
  is_broadcast: boolean;
  subject?: string | null;
  body: string;
  is_read: boolean;
  created_at: string;
}

export interface Playlist {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  is_public: boolean;
  cover_theme: string;
  created_at: string;
  song_ids?: string[];
}

export interface PlayEventItem {
  id: string;
  song_id: string;
  user_id?: string | null;
  played_at: string;
}

export type RepeatMode = 'off' | 'all' | 'one';

export type NavTab =
  | 'discover'
  | 'trending'
  | 'new-music'
  | 'upcoming'
  | 'live'
  | 'albums'
  | 'artistes'
  | 'browse'
  | 'choirs'
  | 'sermons'
  | 'favorites'
  | 'playlists'
  | 'recent'
  | 'offline'
  | 'premium'
  | 'messages'
  | 'artiste-studio'
  | 'admin';

/**
 * A profile is publishable once an admin approved it. Rows created before the
 * approval column existed have no status and stay visible (grandfathered), so the
 * existing catalogue never disappears before the migration backfills them.
 */
export function isProfileApproved(profile: Pick<UserProfile, 'approval_status'> | null | undefined): boolean {
  if (!profile) return false;
  return profile.approval_status !== 'pending' && profile.approval_status !== 'rejected';
}

/**
 * Legacy rows stored a MoMo number plus an account NAME in the two support columns.
 * Only a real Paystack page URL is safe to open or show as a support badge; a phone
 * number must never be treated as a checkout link or advertised publicly.
 */
export function isPaystackPageUrl(value?: string | null): boolean {
  if (!value) return false;
  return /^https:\/\/([a-z0-9-]+\.)*paystack\.(com|shop)\//i.test(value.trim());
}

/** Redacted support summary. The subaccount and account name never reach the browser. */
export interface SupportSummary {
  approved: boolean;
  has_paystack_page: boolean;
  payment_page_url: string | null;
  provider: string | null;
  is_placeholder: boolean;
}

/** Redacted platform ("Support Gyidi") summary. Never includes the subaccount code. */
export interface PlatformSupportSummary {
  has_paystack_page: boolean;
  payment_page_url: string | null;
  enabled: boolean;
  is_placeholder: boolean;
}

/** A profile can show the support badge only when approved AND a Paystack page exists. */
export function hasApprovedSupportPage(
  profile: Pick<UserProfile, 'approval_status'> | null | undefined,
  support: Pick<SupportSummary, 'has_paystack_page'> | null | undefined
): boolean {
  if (!profile || !support) return false;
  return isProfileApproved(profile) && support.has_paystack_page === true;
}

export function isUserPremiumActive(
  profile: UserProfile | null,
  settings?: PlatformSettings | null,
  nowMs: number = Date.now()
): boolean {
  if (!profile) return false;
  if (profile.role === 'admin') return true;
  if (!profile.is_premium) return false;
  if (profile.premium_plan === 'lifetime') return true;
  if (!profile.premium_until) return false;
  return new Date(profile.premium_until).getTime() > nowMs;
}

export function isSongUpcomingPremiere(song: Song, nowMs: number = Date.now()): boolean {
  if (song.approval_status !== 'approved') return false;
  if (!song.is_premiere || !song.premiere_at) return false;
  return new Date(song.premiere_at).getTime() > nowMs;
}

export function isSongPubliclyPlayable(song: Song, nowMs: number = Date.now()): boolean {
  if (song.approval_status !== 'approved') return false;
  if (song.is_premiere && song.premiere_at) {
    return new Date(song.premiere_at).getTime() <= nowMs;
  }
  return true;
}

export function isAlbumUpcomingPremiere(album: Album, nowMs: number = Date.now()): boolean {
  if (album.approval_status !== 'approved') return false;
  if (!album.is_premiere || !album.premiere_at) return false;
  return new Date(album.premiere_at).getTime() > nowMs;
}

export function isAlbumPubliclyPlayable(album: Album, nowMs: number = Date.now()): boolean {
  if (album.approval_status !== 'approved') return false;
  if (album.is_premiere && album.premiere_at) {
    return new Date(album.premiere_at).getTime() <= nowMs;
  }
  return true;
}
