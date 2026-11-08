import React, { useEffect, useState } from 'react';
import {
  Video,
  Radio,
  Bell,
  CheckCircle2,
  Globe2,
  Users,
  Sparkles,
  Wifi,
  ShieldCheck,
  GraduationCap,
  Loader2,
  Crown,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { LiveStreamWaitlistEntry, UserProfile } from '../types/music';

interface LiveStreamUpcomingViewProps {
  userId: string | null;
  userProfile: UserProfile | null;
  isPremium?: boolean;
  onRequireAccount: (reason: string) => void;
  onRequirePremium?: (reason: string) => void;
}

export const LiveStreamUpcomingView: React.FC<LiveStreamUpcomingViewProps> = ({
  userId,
  userProfile,
  isPremium = false,
  onRequireAccount,
  onRequirePremium,
}) => {
  const [waitlist, setWaitlist] = useState<LiveStreamWaitlistEntry[]>([]);
  const [interestType, setInterestType] = useState<'viewer' | 'broadcaster' | 'both'>('viewer');
  const [branchOrCampus, setBranchOrCampus] = useState(
    userProfile?.tertiary_institution || userProfile?.scg_branch || ''
  );
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const loadWaitlist = async () => {
    const { data } = await supabase
      .from('live_stream_waitlist')
      .select('*')
      .order('created_at', { ascending: false });
    if (data) {
      const list = data as LiveStreamWaitlistEntry[];
      setWaitlist(list);
      if (userId) {
        const mine = list.find((w) => w.user_id === userId);
        if (mine) {
          setInterestType(mine.interest_type);
          if (mine.branch_or_campus) setBranchOrCampus(mine.branch_or_campus);
        }
      }
    }
  };

  useEffect(() => {
    loadWaitlist();
  }, [userId]);

  const myEntry = userId ? waitlist.find((w) => w.user_id === userId) : null;
  const broadcasterCount = waitlist.filter(
    (w) => w.interest_type === 'broadcaster' || w.interest_type === 'both'
  ).length;

  const handleJoinWaitlist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) {
      onRequireAccount(
        'Create an account & upgrade to Premium to access Live Convention Video & Sabbath Radio Streaming!'
      );
      return;
    }
    if (!isPremium) {
      onRequirePremium?.(
        'Live Convention Video & Sabbath Radio access is included in Gyidi Nnwom Premium!'
      );
      return;
    }

    setSaving(true);
    setToast(null);
    const { error } = await supabase.from('live_stream_waitlist').upsert(
      {
        user_id: userId,
        profile_id: userProfile?.id || null,
        interest_type: interestType,
        branch_or_campus: branchOrCampus.trim() || null,
      },
      { onConflict: 'user_id' }
    );
    setSaving(false);

    if (!error) {
      await loadWaitlist();
      setToast(
        'You are on the early-access list! We will notify you as soon as Live Video & Sabbath Radio goes live.'
      );
    }
  };

  return (
    <div className="max-w-[1350px] mx-auto space-y-8">
      {/* Hero Banner */}
      <section className="relative overflow-hidden rounded-3xl border border-rose-500/30 bg-gradient-to-br from-rose-600/25 via-amber-500/15 to-zinc-950 p-6 sm:p-10">
        <div className="max-w-3xl space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex items-center gap-2 rounded-full bg-rose-500/20 border border-rose-400/40 px-3.5 py-1 text-xs font-extrabold uppercase tracking-wider text-rose-200">
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              Upcoming Feature • Coming Soon
            </div>
            <div className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/25 border border-amber-400/40 px-3 py-1 text-xs font-extrabold uppercase tracking-wider text-amber-200">
              <Crown className="w-3.5 h-3.5 text-amber-300" />
              Gyidi Nnwom Premium
            </div>
          </div>

          <h2 className="text-2xl sm:text-4xl font-extrabold text-white leading-tight">
            Live Convention Video &amp; Sabbath Radio Broadcasts
          </h2>

          <p className="text-sm sm:text-base text-zinc-200 leading-relaxed">
            Soon, SCG Headquarters, Zones, Branches, Choirs, and SACSU Tertiary Campuses will be
            able to broadcast <strong>Live HD Convention Video</strong> and{' '}
            <strong>Low-Data Sabbath Audio Radio</strong> directly inside Gyidi Nnwom — connecting
            brethren across Ghana and the diaspora in real time!
          </p>

          <div className="flex flex-wrap items-center gap-3 pt-1 text-xs text-zinc-300">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-black/40 border border-white/10 px-3 py-1.5 font-semibold">
              <Video className="w-3.5 h-3.5 text-rose-400" />
              Live Convention Video Stream
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-black/40 border border-white/10 px-3 py-1.5 font-semibold">
              <Radio className="w-3.5 h-3.5 text-amber-400" />
              Low-Data Sabbath Audio Radio
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-black/40 border border-white/10 px-3 py-1.5 font-semibold">
              <Globe2 className="w-3.5 h-3.5 text-emerald-400" />
              Global Diaspora Access
            </span>
          </div>
        </div>
      </section>

      {/* Two Core Upcoming Modes */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="rounded-3xl border border-white/10 bg-zinc-900/60 p-6 space-y-3">
          <div className="h-12 w-12 rounded-2xl bg-rose-500/20 border border-rose-400/30 flex items-center justify-center">
            <Video className="w-6 h-6 text-rose-300" />
          </div>
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-extrabold text-white">
              1. Live Convention Video Streaming
            </h3>
            <span className="rounded-full bg-amber-500/20 px-2.5 py-0.5 text-[10px] font-bold text-amber-300">
              Upcoming
            </span>
          </div>
          <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed">
            Stream National Conventions at Osiem, Regional Youth Rallies, Choir Ministrations, and
            SACSU Campus Services in live video straight from a phone camera or church mixer/OBS to
            thousands of viewers simultaneously.
          </p>
          <ul className="space-y-1.5 text-xs text-zinc-400 pt-1">
            <li>• Live Scripture &amp; Hymn overlay banner controlled by the broadcaster</li>
            <li>• Real-time congregation fellowship count &amp; moderated live comments</li>
            <li>• Automatic replay archive into Sermons &amp; Recordings after the convention</li>
          </ul>
        </div>

        <div className="rounded-3xl border border-white/10 bg-zinc-900/60 p-6 space-y-3">
          <div className="h-12 w-12 rounded-2xl bg-amber-500/20 border border-amber-400/30 flex items-center justify-center">
            <Radio className="w-6 h-6 text-amber-300" />
          </div>
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-extrabold text-white">
              2. Sabbath &amp; Convention Live Radio
            </h3>
            <span className="rounded-full bg-amber-500/20 px-2.5 py-0.5 text-[10px] font-bold text-amber-300">
              Upcoming
            </span>
          </div>
          <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed">
            Travelling or in a low-network town? Switch from Live Video to{' '}
            <strong>Audio-Only Sabbath Radio</strong> with 1 tap so Friday Evening &amp; Saturday
            Sabbath Preachings keep playing smoothly in the background even with your phone screen
            locked.
          </p>
          <ul className="space-y-1.5 text-xs text-zinc-400 pt-1">
            <li>• Uses up to 90% less mobile data than video streaming</li>
            <li>• 24/7 curated SCG Choir &amp; Hymn Radio rotation between live services</li>
            <li>• Instant push alert when Headquarters or your Zone goes live</li>
          </ul>
        </div>
      </div>

      {/* Early Access / Broadcaster Reservation Form */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <form
          onSubmit={handleJoinWaitlist}
          className="lg:col-span-7 rounded-3xl border border-amber-400/30 bg-zinc-900/75 p-6 space-y-4"
        >
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-base sm:text-lg font-extrabold text-white flex items-center gap-2">
              <Bell className="w-5 h-5 text-amber-400" />
              {myEntry
                ? 'You’re Registered for Launch Alerts!'
                : 'Get Notified When Live Streaming Launches'}
            </h3>
            {waitlist.length > 0 && (
              <span className="rounded-full bg-emerald-500/15 border border-emerald-400/30 px-3 py-1 text-[11px] font-bold text-emerald-300">
                {waitlist.length} Interested
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <button
              type="button"
              onClick={() => setInterestType('viewer')}
              className={`rounded-xl border p-3 text-left transition cursor-pointer ${
                interestType === 'viewer'
                  ? 'border-amber-400 bg-amber-500/15 text-white'
                  : 'border-white/10 bg-zinc-950 text-zinc-400'
              }`}
            >
              <Wifi className="w-4 h-4 text-amber-400 mb-1" />
              <p className="text-xs font-bold">Watch &amp; Listen</p>
              <p className="text-[10px] text-zinc-400">Tune into live conventions</p>
            </button>

            <button
              type="button"
              onClick={() => setInterestType('broadcaster')}
              className={`rounded-xl border p-3 text-left transition cursor-pointer ${
                interestType === 'broadcaster'
                  ? 'border-rose-400 bg-rose-500/15 text-white'
                  : 'border-white/10 bg-zinc-950 text-zinc-400'
              }`}
            >
              <Video className="w-4 h-4 text-rose-400 mb-1" />
              <p className="text-xs font-bold">Stream Live</p>
              <p className="text-[10px] text-zinc-400">Branch / Choir / SACSU</p>
            </button>

            <button
              type="button"
              onClick={() => setInterestType('both')}
              className={`rounded-xl border p-3 text-left transition cursor-pointer ${
                interestType === 'both'
                  ? 'border-emerald-400 bg-emerald-500/15 text-white'
                  : 'border-white/10 bg-zinc-950 text-zinc-400'
              }`}
            >
              <Users className="w-4 h-4 text-emerald-400 mb-1" />
              <p className="text-xs font-bold">Both</p>
              <p className="text-[10px] text-zinc-400">Watch &amp; host live streams</p>
            </button>
          </div>

          <div>
            <label className="block text-xs font-bold text-zinc-300 mb-1">
              Your SCG Branch, Zone, or SACSU Campus (Optional)
            </label>
            <input
              type="text"
              value={branchOrCampus}
              onChange={(e) => setBranchOrCampus(e.target.value)}
              placeholder="e.g. Osiem HQ, Obogu Branch, Accra Zone, KNUST SACSU..."
              className="w-full rounded-xl border border-white/15 bg-zinc-950 px-3.5 py-2.5 text-xs text-white focus:border-amber-400 focus:outline-none"
            />
          </div>

          {toast && (
            <div className="rounded-xl border border-emerald-500/35 bg-emerald-500/15 px-3.5 py-2.5 text-xs font-semibold text-emerald-200 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
              {toast}
            </div>
          )}

          <button
            type="submit"
            disabled={saving}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-rose-500 via-amber-500 to-pink-600 py-3 text-xs font-extrabold text-white shadow-lg cursor-pointer disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Bell className="w-4 h-4" />}
            {myEntry ? 'Update My Live Stream Preference' : 'Notify Me When Live Streaming Launches'}
          </button>
        </form>

        <div className="lg:col-span-5 rounded-3xl border border-white/10 bg-zinc-900/50 p-6 space-y-4">
          <h4 className="text-sm font-extrabold text-white flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-amber-400" />
            Who Will Be Able to Stream Live?
          </h4>
          <p className="text-xs text-zinc-300 leading-relaxed">
            To keep every broadcast authentic and edifying, Live Video &amp; Radio broadcasting keys
            will be approved by Master Admin for:
          </p>
          <div className="space-y-2.5 text-xs text-zinc-300">
            <div className="rounded-xl border border-white/10 bg-zinc-950/70 p-3">
              <strong className="text-amber-300">• National &amp; Zonal Conventions:</strong> Live
              multi-day video &amp; audio coverage of Friday, Sabbath, and Sunday gatherings.
            </div>
            <div className="rounded-xl border border-white/10 bg-zinc-950/70 p-3">
              <strong className="text-cyan-300">
                <GraduationCap className="w-3.5 h-3.5 inline mr-1" />
                SACSU Campus Fellowships:
              </strong>{' '}
              Live tertiary student rallies, choir nights, and campus preachings.
            </div>
            <div className="rounded-xl border border-white/10 bg-zinc-950/70 p-3">
              <strong className="text-pink-300">• Verified SCG Choirs &amp; Artistes:</strong> Live
              album launchministrations and praise sessions ({broadcasterCount} broadcasters already
              waiting!).
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
