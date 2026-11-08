import React, { useEffect, useMemo, useState } from 'react';
import {
  BookOpen,
  Megaphone,
  DollarSign,
  Calendar,
  Upload,
  Trash2,
  Loader2,
  CheckCircle2,
  Save,
  Sparkles,
  Image as ImageIcon,
  ChevronLeft,
  ChevronRight,
  Eye,
  Crown,
  CreditCard,
} from 'lucide-react';
import { supabase, SUPABASE_URL } from '../lib/supabase';
import {
  Announcement,
  DailyVerseFlyer,
  PlatformSettings,
  PremiumSubscription,
} from '../types/music';
import { extractAdSenseClientId } from './GoogleAdBanner';

interface AdminContentMonetizationPanelProps {
  mode: 'verses' | 'announcements' | 'adsense' | 'premium';
  adminProfileId: string;
  onRefreshGlobal: () => Promise<void>;
  onPreviewDailyFeed?: (tab: 'verse' | 'announcements') => void;
}

interface DayDraft {
  file: File | null;
  previewUrl: string | null;
  scriptureRef: string;
  caption: string;
  showPopup: boolean;
}

function addDaysIso(baseIsoDate: string, offsetDays: number): string {
  const d = new Date(baseIsoDate + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

export const AdminContentMonetizationPanel: React.FC<AdminContentMonetizationPanelProps> = ({
  mode,
  adminProfileId,
  onRefreshGlobal,
  onPreviewDailyFeed,
}) => {
  const todayIso = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [weekStartIso, setWeekStartIso] = useState<string>(todayIso);

  const [flyers, setFlyers] = useState<DailyVerseFlyer[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [settings, setSettings] = useState<PlatformSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  // 7-Day Planner drafts keyed by YYYY-MM-DD
  const [dayDrafts, setDayDrafts] = useState<Record<string, DayDraft>>({});

  // Announcement composer state
  const [annTitle, setAnnTitle] = useState('');
  const [annBody, setAnnBody] = useState('');
  const [annAudience, setAnnAudience] = useState<'all' | 'listeners' | 'artistes'>('all');
  const [annPriority, setAnnPriority] = useState<'normal' | 'important' | 'urgent'>('normal');
  const [annShowPopup, setAnnShowPopup] = useState(true);
  const [annScheduleMode, setAnnScheduleMode] = useState<'now' | 'scheduled'>('now');
  const [annPublishAt, setAnnPublishAt] = useState('');
  const [annExpiresAt, setAnnExpiresAt] = useState('');
  const [annCtaLabel, setAnnCtaLabel] = useState('');
  const [annCtaUrl, setAnnCtaUrl] = useState('');
  const [annFlyerFile, setAnnFlyerFile] = useState<File | null>(null);

  // AdSense state
  const [adsEnabled, setAdsEnabled] = useState(false);
  const [adsPublisherInput, setAdsPublisherInput] = useState('');
  const [adsAutoAds, setAdsAutoAds] = useState(true);
  const [adsHomeSlot, setAdsHomeSlot] = useState('');
  const [adsSidebarSlot, setAdsSidebarSlot] = useState('');

  // Premium & Paystack state
  const [premiumEnabled, setPremiumEnabled] = useState(true);
  const [monthlyPriceInput, setMonthlyPriceInput] = useState('5');
  const [yearlyPriceInput, setYearlyPriceInput] = useState('50');
  const [paystackKeyInput, setPaystackKeyInput] = useState('');
  const [subscriptions, setSubscriptions] = useState<PremiumSubscription[]>([]);

  const loadData = async () => {
    setLoading(true);
    const [{ data: fData }, { data: aData }, { data: sData }, { data: subData }] =
      await Promise.all([
        supabase
          .from('daily_verse_flyers')
          .select('*')
          .order('scheduled_date', { ascending: true }),
        supabase.from('announcements').select('*').order('publish_at', { ascending: false }),
        supabase.from('platform_settings').select('*').eq('id', 'global').maybeSingle(),
        supabase
          .from('premium_subscriptions')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(50),
      ]);

    if (fData) setFlyers(fData as DailyVerseFlyer[]);
    if (aData) setAnnouncements(aData as Announcement[]);
    if (subData) setSubscriptions(subData as PremiumSubscription[]);
    if (sData) {
      const cfg = sData as PlatformSettings;
      setSettings(cfg);
      setAdsEnabled(Boolean(cfg.adsense_enabled));
      setAdsPublisherInput(cfg.adsense_publisher_id || '');
      setAdsAutoAds(cfg.adsense_auto_ads !== false);
      setAdsHomeSlot(cfg.adsense_home_slot_id || '');
      setAdsSidebarSlot(cfg.adsense_sidebar_slot_id || '');
      setPremiumEnabled(cfg.premium_enabled !== false);
      setMonthlyPriceInput(String(cfg.premium_monthly_price_ghs ?? 5));
      setYearlyPriceInput(String(cfg.premium_yearly_price_ghs ?? 50));
      setPaystackKeyInput(cfg.paystack_public_key || '');
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const weekDates = useMemo(
    () => Array.from({ length: 7 }, (_, idx) => addDaysIso(weekStartIso, idx)),
    [weekStartIso]
  );

  const flyersByDate = useMemo(() => {
    const map = new Map<string, DailyVerseFlyer>();
    for (const f of flyers) {
      if (!map.has(f.scheduled_date)) map.set(f.scheduled_date, f);
    }
    return map;
  }, [flyers]);

  const updateDayDraft = (dateStr: string, patch: Partial<DayDraft>) => {
    setDayDrafts((prev) => {
      const current: DayDraft = prev[dateStr] || {
        file: null,
        previewUrl: null,
        scriptureRef: '',
        caption: '',
        showPopup: true,
      };
      return {
        ...prev,
        [dateStr]: { ...current, ...patch },
      };
    });
  };

  const pendingDraftCount = useMemo(
    () => Object.values(dayDrafts).filter((d) => d.file !== null).length,
    [dayDrafts]
  );

  const uploadSingleFlyerForDate = async (dateStr: string, draft: DayDraft) => {
    if (!draft.file) return;
    const ext = (draft.file.name.split('.').pop() || 'jpg').toLowerCase();
    const path = `daily-verses/verse-${dateStr}-${Date.now()}.${ext}`;

    const { error: upErr } = await supabase.storage
      .from('covers')
      .upload(path, draft.file, { cacheControl: '31536000', upsert: true });
    if (upErr) throw upErr;

    const publicUrl = supabase.storage.from('covers').getPublicUrl(path).data.publicUrl;
    const existing = flyersByDate.get(dateStr);
    const publishIso = `${dateStr}T00:00:00.000Z`;

    if (existing) {
      const { error: updErr } = await supabase
        .from('daily_verse_flyers')
        .update({
          flyer_url: publicUrl,
          scripture_ref: draft.scriptureRef.trim() || existing.scripture_ref || null,
          caption: draft.caption.trim() || existing.caption || null,
          show_popup: draft.showPopup,
          is_active: true,
          publish_at: publishIso,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id);
      if (updErr) throw updErr;
    } else {
      const { error: insErr } = await supabase.from('daily_verse_flyers').insert({
        scheduled_date: dateStr,
        publish_at: publishIso,
        scripture_ref: draft.scriptureRef.trim() || null,
        caption: draft.caption.trim() || null,
        flyer_url: publicUrl,
        show_popup: draft.showPopup,
        is_active: true,
        created_by: adminProfileId,
      });
      if (insErr) throw insErr;
    }
  };

  const handleScheduleSelectedWeekFlyers = async () => {
    const entries = Object.entries(dayDrafts).filter(([, d]) => d.file !== null);
    if (entries.length === 0) {
      setFeedback({
        type: 'err',
        text: 'Select at least 1 flyer image in any of the 7 day slots above first.',
      });
      return;
    }

    setSaving(true);
    setFeedback(null);
    try {
      for (const [dateStr, draft] of entries) {
        await uploadSingleFlyerForDate(dateStr, draft);
      }
      setDayDrafts({});
      await loadData();
      await onRefreshGlobal();
      setFeedback({
        type: 'ok',
        text: `Scheduled ${entries.length} Daily Bible Verse flyer(s)! Each flyer will automatically unlock & pop up on Listener and Artiste accounts on its scheduled day.`,
      });
    } catch (err: unknown) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Failed to upload scheduled flyers.',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteFlyer = async (id: string) => {
    setSaving(true);
    await supabase.from('daily_verse_flyers').delete().eq('id', id);
    await loadData();
    await onRefreshGlobal();
    setSaving(false);
  };

  const handleToggleFlyerPopup = async (flyer: DailyVerseFlyer) => {
    await supabase
      .from('daily_verse_flyers')
      .update({ show_popup: !flyer.show_popup })
      .eq('id', flyer.id);
    await loadData();
    await onRefreshGlobal();
  };

  const handlePublishAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!annTitle.trim() || !annBody.trim()) {
      setFeedback({ type: 'err', text: 'Please enter an announcement title and message.' });
      return;
    }
    setSaving(true);
    setFeedback(null);
    try {
      let flyerUrl: string | null = null;
      if (annFlyerFile) {
        const ext = (annFlyerFile.name.split('.').pop() || 'jpg').toLowerCase();
        const path = `announcements/ann-${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from('covers')
          .upload(path, annFlyerFile, { cacheControl: '31536000', upsert: true });
        if (upErr) throw upErr;
        flyerUrl = supabase.storage.from('covers').getPublicUrl(path).data.publicUrl;
      }

      const publishIso =
        annScheduleMode === 'scheduled' && annPublishAt
          ? new Date(annPublishAt).toISOString()
          : new Date().toISOString();

      const expiresIso = annExpiresAt ? new Date(annExpiresAt).toISOString() : null;

      const { error: insErr } = await supabase.from('announcements').insert({
        title: annTitle.trim(),
        body: annBody.trim(),
        flyer_url: flyerUrl,
        cta_label: annCtaLabel.trim() || null,
        cta_url: annCtaUrl.trim() || null,
        audience: annAudience,
        priority: annPriority,
        show_popup: annShowPopup,
        is_active: true,
        publish_at: publishIso,
        expires_at: expiresIso,
        created_by: adminProfileId,
      });
      if (insErr) throw insErr;

      setAnnTitle('');
      setAnnBody('');
      setAnnCtaLabel('');
      setAnnCtaUrl('');
      setAnnFlyerFile(null);
      setAnnPublishAt('');
      setAnnExpiresAt('');
      setAnnScheduleMode('now');
      await loadData();
      await onRefreshGlobal();
      setFeedback({
        type: 'ok',
        text:
          annScheduleMode === 'scheduled'
            ? 'Announcement scheduled! It will go live and pop up automatically at the scheduled time.'
            : 'Announcement published! Users & Artistes will see it pop up immediately.',
      });
    } catch (err: unknown) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Failed to post announcement.',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleToggleAnnouncementActive = async (ann: Announcement) => {
    await supabase
      .from('announcements')
      .update({ is_active: !ann.is_active })
      .eq('id', ann.id);
    await loadData();
    await onRefreshGlobal();
  };

  const handleDeleteAnnouncement = async (id: string) => {
    await supabase.from('announcements').delete().eq('id', id);
    await loadData();
    await onRefreshGlobal();
  };

  const handleSaveAdSense = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFeedback(null);
    try {
      const normalizedKey = extractAdSenseClientId(adsPublisherInput);
      if (adsEnabled && (!normalizedKey || !normalizedKey.startsWith('ca-pub-'))) {
        throw new Error(
          'Please enter a valid Google AdSense Publisher ID starting with ca-pub- (e.g. ca-pub-1234567890123456) or paste your Google AdSense script tag.'
        );
      }

      const { error: upErr } = await supabase
        .from('platform_settings')
        .update({
          adsense_enabled: adsEnabled,
          adsense_publisher_id: normalizedKey || null,
          adsense_auto_ads: adsAutoAds,
          adsense_home_slot_id: adsHomeSlot.trim() || null,
          adsense_sidebar_slot_id: adsSidebarSlot.trim() || null,
          updated_by: adminProfileId,
          updated_at: new Date().toISOString(),
        })
        .eq('id', 'global');
      if (upErr) throw upErr;

      if (normalizedKey) setAdsPublisherInput(normalizedKey);
      await loadData();
      await onRefreshGlobal();
      setFeedback({
        type: 'ok',
        text: adsEnabled
          ? `Google AdSense (${normalizedKey}) saved and activated across Gyidi Nnwom!`
          : 'Google AdSense settings saved (currently paused).',
      });
    } catch (err: unknown) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Failed to save Google AdSense settings.',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSavePremiumSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFeedback(null);
    try {
      const mPrice = parseFloat(monthlyPriceInput);
      const yPrice = parseFloat(yearlyPriceInput);
      if (!Number.isFinite(mPrice) || mPrice <= 0) {
        throw new Error('Monthly Premium price must be a positive amount in GHS (e.g. 5).');
      }
      if (!Number.isFinite(yPrice) || yPrice <= 0) {
        throw new Error('Yearly Premium price must be a positive amount in GHS (e.g. 50).');
      }
      const cleanPaystackKey = paystackKeyInput.trim();
      if (cleanPaystackKey && !cleanPaystackKey.startsWith('pk_')) {
        throw new Error(
          'Paystack Public Key must start with pk_live_ or pk_test_ (from Paystack Dashboard → Settings → API Keys).'
        );
      }

      const { error: upErr } = await supabase
        .from('platform_settings')
        .update({
          premium_enabled: premiumEnabled,
          premium_monthly_price_ghs: Number(mPrice.toFixed(2)),
          premium_yearly_price_ghs: Number(yPrice.toFixed(2)),
          paystack_public_key: cleanPaystackKey || null,
          premium_currency: 'GHS',
          updated_by: adminProfileId,
          updated_at: new Date().toISOString(),
        })
        .eq('id', 'global');
      if (upErr) throw upErr;

      await loadData();
      await onRefreshGlobal();
      setFeedback({
        type: 'ok',
        text: `Premium pricing updated! Monthly: GHS ${mPrice.toFixed(
          2
        )} • Yearly: GHS ${yPrice.toFixed(2)}${
          cleanPaystackKey ? ' • Paystack Key saved!' : ''
        }`,
      });
    } catch (err: unknown) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Failed to save Premium & Paystack settings.',
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading && !settings && flyers.length === 0) {
    return (
      <div className="rounded-2xl border border-white/10 bg-zinc-900/50 p-12 text-center">
        <Loader2 className="w-6 h-6 text-amber-400 animate-spin mx-auto mb-2" />
        <p className="text-xs text-zinc-400">Loading studio configuration...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {feedback && (
        <div
          className={`rounded-2xl border px-4 py-3 text-xs font-semibold flex items-center justify-between gap-3 ${
            feedback.type === 'ok'
              ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-200'
              : 'border-rose-500/40 bg-rose-500/15 text-rose-200'
          }`}
        >
          <span className="flex items-center gap-2">
            {feedback.type === 'ok' && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
            {feedback.text}
          </span>
          <button
            onClick={() => setFeedback(null)}
            className="text-[11px] underline opacity-80 hover:opacity-100 cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* ==================== MODE 1: 7-DAY DAILY BIBLE VERSE FLYER SCHEDULER ==================== */}
      {mode === 'verses' && (
        <div className="space-y-6">
          <div className="rounded-3xl border border-amber-400/25 bg-gradient-to-br from-amber-500/10 via-zinc-900 to-zinc-950 p-5 sm:p-6 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-extrabold text-white flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-amber-400" />
                  7-Day Weekly Bible Verse Flyer Scheduler
                </h3>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Upload 1 flyer for today or schedule all 7 flyers for the week at once! Each day&apos;s
                  flyer stays hidden until its scheduled date and automatically pops up on Listener
                  and Artiste accounts.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {onPreviewDailyFeed && (
                  <button
                    type="button"
                    onClick={() => onPreviewDailyFeed('verse')}
                    className="inline-flex items-center gap-1.5 rounded-full bg-white/10 hover:bg-white/15 px-3.5 py-2 text-xs font-bold text-amber-300 cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    Preview Pop-Up
                  </button>
                )}

                <button
                  type="button"
                  disabled={saving || pendingDraftCount === 0}
                  onClick={handleScheduleSelectedWeekFlyers}
                  className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-amber-500 to-pink-600 px-5 py-2 text-xs font-extrabold text-white shadow-lg disabled:opacity-45 cursor-pointer"
                >
                  {saving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Sparkles className="w-4 h-4" />
                  )}
                  Schedule Selected Flyers ({pendingDraftCount})
                </button>
              </div>
            </div>

            {/* Week Range Controls */}
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-zinc-950/70 px-4 py-2.5">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setWeekStartIso(addDaysIso(weekStartIso, -7))}
                  className="rounded-lg bg-white/5 hover:bg-white/10 p-1.5 text-zinc-300 cursor-pointer"
                  title="Previous 7 days"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-xs font-bold text-white">
                  7-Day Window: <span className="text-amber-300">{weekDates[0]}</span> →{' '}
                  <span className="text-amber-300">{weekDates[6]}</span>
                </span>
                <button
                  type="button"
                  onClick={() => setWeekStartIso(addDaysIso(weekStartIso, 7))}
                  className="rounded-lg bg-white/5 hover:bg-white/10 p-1.5 text-zinc-300 cursor-pointer"
                  title="Next 7 days"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setWeekStartIso(todayIso)}
                  className="rounded-lg bg-amber-500/15 border border-amber-400/30 px-2.5 py-1 text-[11px] font-bold text-amber-300 hover:bg-amber-500/25 cursor-pointer"
                >
                  Start Today ({todayIso})
                </button>
                <input
                  type="date"
                  value={weekStartIso}
                  onChange={(e) => e.target.value && setWeekStartIso(e.target.value)}
                  className="rounded-lg border border-white/15 bg-zinc-900 px-2.5 py-1 text-xs text-white"
                />
              </div>
            </div>

            {/* 7 Day Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-3">
              {weekDates.map((dateStr, idx) => {
                const existing = flyersByDate.get(dateStr);
                const draft = dayDrafts[dateStr];
                const isToday = dateStr === todayIso;
                const dayLabel = new Date(dateStr + 'T00:00:00Z').toLocaleDateString(undefined, {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                  timeZone: 'UTC',
                });

                return (
                  <div
                    key={dateStr}
                    className={`rounded-2xl border p-3 flex flex-col justify-between gap-2.5 ${
                      isToday
                        ? 'border-amber-400/60 bg-amber-500/10'
                        : existing
                        ? 'border-emerald-500/35 bg-emerald-500/5'
                        : 'border-white/10 bg-zinc-950/75'
                    }`}
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-[11px] font-extrabold text-white">
                          Day {idx + 1} • {dayLabel}
                        </span>
                        {isToday ? (
                          <span className="rounded-full bg-amber-400 px-2 py-0.5 text-[9px] font-black uppercase text-zinc-950">
                            Today
                          </span>
                        ) : existing ? (
                          <span className="rounded-full bg-emerald-500/25 px-2 py-0.5 text-[9px] font-bold text-emerald-300">
                            Scheduled
                          </span>
                        ) : (
                          <span className="rounded-full bg-white/5 px-2 py-0.5 text-[9px] text-zinc-400">
                            Empty
                          </span>
                        )}
                      </div>

                      {/* Preview Image */}
                      <label className="group relative block aspect-[4/5] w-full rounded-xl border border-dashed border-white/15 bg-zinc-900 overflow-hidden cursor-pointer hover:border-amber-400 transition">
                        {draft?.previewUrl ? (
                          <img
                            src={draft.previewUrl}
                            alt="Selected flyer"
                            className="h-full w-full object-cover"
                          />
                        ) : existing?.flyer_url ? (
                          <img
                            src={existing.flyer_url}
                            alt="Scheduled flyer"
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="h-full w-full flex flex-col items-center justify-center p-2 text-center text-zinc-400 group-hover:text-amber-300">
                            <ImageIcon className="w-6 h-6 mb-1.5" />
                            <span className="text-[10px] font-bold">Select Flyer</span>
                            <span className="text-[9px] text-zinc-500">{dateStr}</span>
                          </div>
                        )}
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          className="hidden"
                          onChange={(e) => {
                            const f = e.target.files?.[0] || null;
                            if (f) {
                              updateDayDraft(dateStr, {
                                file: f,
                                previewUrl: URL.createObjectURL(f),
                                scriptureRef:
                                  draft?.scriptureRef ?? existing?.scripture_ref ?? '',
                                caption: draft?.caption ?? existing?.caption ?? '',
                              });
                            }
                          }}
                        />
                      </label>

                      <input
                        type="text"
                        value={draft?.scriptureRef ?? existing?.scripture_ref ?? ''}
                        onChange={(e) =>
                          updateDayDraft(dateStr, { scriptureRef: e.target.value })
                        }
                        placeholder="Verse (e.g. Ps 23:1)"
                        className="w-full rounded-lg border border-white/10 bg-zinc-900 px-2.5 py-1.5 text-[11px] text-white placeholder-zinc-500 focus:border-amber-400 focus:outline-none"
                      />

                      <input
                        type="text"
                        value={draft?.caption ?? existing?.caption ?? ''}
                        onChange={(e) => updateDayDraft(dateStr, { caption: e.target.value })}
                        placeholder="Short note (optional)"
                        className="w-full rounded-lg border border-white/10 bg-zinc-900 px-2.5 py-1.5 text-[11px] text-white placeholder-zinc-500 focus:border-amber-400 focus:outline-none"
                      />
                    </div>

                    <div className="flex items-center justify-between gap-1 pt-1">
                      {draft?.file ? (
                        <button
                          type="button"
                          disabled={saving}
                          onClick={async () => {
                            setSaving(true);
                            setFeedback(null);
                            try {
                              await uploadSingleFlyerForDate(dateStr, draft);
                              setDayDrafts((prev) => {
                                const next = { ...prev };
                                delete next[dateStr];
                                return next;
                              });
                              await loadData();
                              await onRefreshGlobal();
                              setFeedback({
                                type: 'ok',
                                text: `Flyer saved for ${dateStr}!`,
                              });
                            } catch (err: unknown) {
                              setFeedback({
                                type: 'err',
                                text: err instanceof Error ? err.message : 'Upload failed',
                              });
                            } finally {
                              setSaving(false);
                            }
                          }}
                          className="w-full inline-flex items-center justify-center gap-1 rounded-lg bg-amber-500 hover:bg-amber-400 py-1.5 text-[10px] font-extrabold text-zinc-950 cursor-pointer"
                        >
                          <Upload className="w-3 h-3" />
                          Save Day {idx + 1}
                        </button>
                      ) : existing ? (
                        <button
                          type="button"
                          onClick={() => handleDeleteFlyer(existing.id)}
                          className="w-full inline-flex items-center justify-center gap-1 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 py-1 text-[10px] font-bold text-rose-300 cursor-pointer"
                        >
                          <Trash2 className="w-3 h-3" />
                          Remove
                        </button>
                      ) : (
                        <span className="text-[10px] text-zinc-500">Click box to add</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Scheduled & Past Flyers List */}
          <div className="rounded-2xl border border-white/10 bg-zinc-900/50 p-5 space-y-3">
            <h4 className="text-sm font-bold text-white flex items-center gap-2">
              <Calendar className="w-4 h-4 text-amber-400" />
              All Scheduled & Published Daily Verse Flyers ({flyers.length})
            </h4>

            {flyers.length === 0 ? (
              <p className="text-xs text-zinc-400 py-4">
                No Daily Bible Verse flyers scheduled yet. Select up to 7 flyers above to schedule
                your full week!
              </p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {flyers.map((f) => {
                  const isFuture = f.scheduled_date > todayIso;
                  const isToday = f.scheduled_date === todayIso;
                  return (
                    <div
                      key={f.id}
                      className="flex items-center gap-3 rounded-xl border border-white/10 bg-zinc-950/70 p-3"
                    >
                      <img
                        src={f.flyer_url}
                        alt={f.scripture_ref || f.scheduled_date}
                        className="h-16 w-16 rounded-lg object-cover border border-white/10 flex-shrink-0"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs font-extrabold text-white">
                            {f.scheduled_date}
                          </span>
                          {isToday ? (
                            <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
                              Live Today
                            </span>
                          ) : isFuture ? (
                            <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold text-amber-300">
                              Scheduled
                            </span>
                          ) : (
                            <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-zinc-400">
                              Past
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-amber-200 truncate mt-0.5">
                          {f.scripture_ref || 'Daily Bible Verse'}
                        </p>
                        <div className="flex items-center gap-2 mt-1.5">
                          <button
                            type="button"
                            onClick={() => handleToggleFlyerPopup(f)}
                            className={`rounded-md px-2 py-0.5 text-[10px] font-bold cursor-pointer ${
                              f.show_popup
                                ? 'bg-amber-500/20 text-amber-300'
                                : 'bg-white/5 text-zinc-400'
                            }`}
                          >
                            {f.show_popup ? 'Pop-Up ON' : 'Pop-Up OFF'}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteFlyer(f.id)}
                            className="text-[10px] font-bold text-rose-400 hover:underline cursor-pointer"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ==================== MODE 2: PLATFORM ANNOUNCEMENTS ==================== */}
      {mode === 'announcements' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <form
            onSubmit={handlePublishAnnouncement}
            className="lg:col-span-5 rounded-3xl border border-white/10 bg-zinc-900/60 p-5 space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-extrabold text-white flex items-center gap-2">
                <Megaphone className="w-5 h-5 text-amber-400" />
                Post or Schedule Announcement
              </h3>
              {onPreviewDailyFeed && (
                <button
                  type="button"
                  onClick={() => onPreviewDailyFeed('announcements')}
                  className="text-xs font-bold text-amber-300 hover:underline cursor-pointer"
                >
                  Preview Pop-Up
                </button>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-zinc-300 mb-1">
                Announcement Title *
              </label>
              <input
                type="text"
                required
                value={annTitle}
                onChange={(e) => setAnnTitle(e.target.value)}
                placeholder="e.g. National Convention & Sabbath Gathering"
                className="w-full rounded-xl border border-white/10 bg-zinc-950 px-3.5 py-2 text-xs text-white focus:border-amber-400 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-zinc-300 mb-1">
                Announcement Message *
              </label>
              <textarea
                rows={4}
                required
                value={annBody}
                onChange={(e) => setAnnBody(e.target.value)}
                placeholder="Write full announcement details for Listeners and Artistes..."
                className="w-full rounded-xl border border-white/10 bg-zinc-950 px-3.5 py-2 text-xs text-white focus:border-amber-400 focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-zinc-300 mb-1">Audience</label>
                <select
                  value={annAudience}
                  onChange={(e) =>
                    setAnnAudience(e.target.value as 'all' | 'listeners' | 'artistes')
                  }
                  className="w-full rounded-xl border border-white/10 bg-zinc-950 px-3 py-2 text-xs text-white"
                >
                  <option value="all">Everyone (Users & Artistes)</option>
                  <option value="listeners">Listeners Only</option>
                  <option value="artistes">Artistes Only</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-zinc-300 mb-1">Priority</label>
                <select
                  value={annPriority}
                  onChange={(e) =>
                    setAnnPriority(e.target.value as 'normal' | 'important' | 'urgent')
                  }
                  className="w-full rounded-xl border border-white/10 bg-zinc-950 px-3 py-2 text-xs text-white"
                >
                  <option value="normal">Normal</option>
                  <option value="important">Important</option>
                  <option value="urgent">Urgent Notice</option>
                </select>
              </div>
            </div>

            <div>
              <label className="flex items-center gap-2 rounded-xl border border-dashed border-white/15 bg-zinc-950 px-3.5 py-2.5 text-xs text-zinc-300 hover:border-amber-400 cursor-pointer">
                <ImageIcon className="w-4 h-4 text-amber-400 flex-shrink-0" />
                <span className="truncate">
                  {annFlyerFile
                    ? `Attached Flyer: ${annFlyerFile.name}`
                    : 'Attach Event Flyer / Image (Optional)'}
                </span>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(e) => setAnnFlyerFile(e.target.files?.[0] || null)}
                  className="hidden"
                />
              </label>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <input
                type="text"
                value={annCtaLabel}
                onChange={(e) => setAnnCtaLabel(e.target.value)}
                placeholder="Button Label (optional)"
                className="rounded-xl border border-white/10 bg-zinc-950 px-3 py-2 text-xs text-white"
              />
              <input
                type="url"
                value={annCtaUrl}
                onChange={(e) => setAnnCtaUrl(e.target.value)}
                placeholder="https://... (optional)"
                className="rounded-xl border border-white/10 bg-zinc-950 px-3 py-2 text-xs text-white"
              />
            </div>

            <div className="space-y-2 rounded-xl border border-white/10 bg-zinc-950/60 p-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-zinc-300">When to Publish</span>
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => setAnnScheduleMode('now')}
                    className={`rounded-lg px-2.5 py-1 text-[11px] font-bold cursor-pointer ${
                      annScheduleMode === 'now'
                        ? 'bg-amber-500 text-zinc-950'
                        : 'bg-white/5 text-zinc-400'
                    }`}
                  >
                    Post Now
                  </button>
                  <button
                    type="button"
                    onClick={() => setAnnScheduleMode('scheduled')}
                    className={`rounded-lg px-2.5 py-1 text-[11px] font-bold cursor-pointer ${
                      annScheduleMode === 'scheduled'
                        ? 'bg-amber-500 text-zinc-950'
                        : 'bg-white/5 text-zinc-400'
                    }`}
                  >
                    Schedule
                  </button>
                </div>
              </div>

              {annScheduleMode === 'scheduled' && (
                <div>
                  <label className="block text-[11px] text-zinc-400 mb-1">
                    Scheduled Publish Date & Time *
                  </label>
                  <input
                    type="datetime-local"
                    required
                    value={annPublishAt}
                    onChange={(e) => setAnnPublishAt(e.target.value)}
                    className="w-full rounded-lg border border-white/10 bg-zinc-900 px-3 py-1.5 text-xs text-white"
                  />
                </div>
              )}

              <div>
                <label className="block text-[11px] text-zinc-400 mb-1">
                  Auto-Expire Date (Optional)
                </label>
                <input
                  type="datetime-local"
                  value={annExpiresAt}
                  onChange={(e) => setAnnExpiresAt(e.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-zinc-900 px-3 py-1.5 text-xs text-white"
                />
              </div>

              <label className="flex items-center gap-2 pt-1 text-xs font-semibold text-amber-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={annShowPopup}
                  onChange={(e) => setAnnShowPopup(e.target.checked)}
                  className="rounded accent-amber-400"
                />
                Pop up automatically on User & Artiste accounts
              </label>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-pink-600 py-2.5 text-xs font-extrabold text-white shadow-lg cursor-pointer disabled:opacity-50"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Megaphone className="w-4 h-4" />
              )}
              {annScheduleMode === 'scheduled' ? 'Schedule Announcement' : 'Publish Announcement'}
            </button>
          </form>

          {/* Existing Announcements */}
          <div className="lg:col-span-7 rounded-3xl border border-white/10 bg-zinc-900/50 p-5 space-y-3">
            <h3 className="text-base font-extrabold text-white">
              Published & Scheduled Announcements ({announcements.length})
            </h3>

            {announcements.length === 0 ? (
              <p className="text-xs text-zinc-400 py-8 text-center">
                No announcements created yet. Use the form on the left to post church notices,
                convention dates, or platform updates!
              </p>
            ) : (
              <div className="space-y-3 max-h-[620px] overflow-y-auto pr-1">
                {announcements.map((ann) => {
                  const isFuture = new Date(ann.publish_at).getTime() > Date.now();
                  return (
                    <div
                      key={ann.id}
                      className="rounded-2xl border border-white/10 bg-zinc-950/70 p-4 flex items-start justify-between gap-3"
                    >
                      <div className="flex items-start gap-3 min-w-0">
                        {ann.flyer_url && (
                          <img
                            src={ann.flyer_url}
                            alt=""
                            className="h-16 w-16 rounded-xl object-cover border border-white/10 flex-shrink-0"
                          />
                        )}
                        <div className="min-w-0 space-y-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-sm font-bold text-white">{ann.title}</span>
                            <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-semibold text-zinc-300 capitalize">
                              {ann.audience}
                            </span>
                            {isFuture ? (
                              <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold text-amber-300">
                                Scheduled: {new Date(ann.publish_at).toLocaleString()}
                              </span>
                            ) : ann.is_active ? (
                              <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
                                Active
                              </span>
                            ) : (
                              <span className="rounded-full bg-zinc-700 px-2 py-0.5 text-[10px] text-zinc-300">
                                Paused
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-zinc-300 line-clamp-2">{ann.body}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <button
                          onClick={() => handleToggleAnnouncementActive(ann)}
                          className="rounded-lg bg-white/10 px-2.5 py-1 text-[11px] font-bold text-zinc-200 hover:bg-white/15 cursor-pointer"
                        >
                          {ann.is_active ? 'Pause' : 'Resume'}
                        </button>
                        <button
                          onClick={() => handleDeleteAnnouncement(ann.id)}
                          className="rounded-lg bg-rose-500/15 p-1.5 text-rose-400 hover:bg-rose-500/25 cursor-pointer"
                          title="Delete announcement"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
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

      {/* ==================== MODE 3: GOOGLE ADSENSE REVENUE SETTINGS ==================== */}
      {mode === 'adsense' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <form
            onSubmit={handleSaveAdSense}
            className="lg:col-span-7 rounded-3xl border border-emerald-500/30 bg-gradient-to-br from-emerald-500/10 via-zinc-900 to-zinc-950 p-6 space-y-4"
          >
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 rounded-2xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center">
                <DollarSign className="w-6 h-6 text-emerald-300" />
              </div>
              <div>
                <h3 className="text-lg font-extrabold text-white">
                  Google AdSense & Revenue Configuration
                </h3>
                <p className="text-xs text-zinc-400">
                  Paste your Google Ads Publisher Key below anytime to activate monetization across
                  Gyidi Nnwom.
                </p>
              </div>
            </div>

            <label className="flex items-center justify-between rounded-2xl border border-white/10 bg-zinc-950/80 p-4 cursor-pointer">
              <div>
                <p className="text-sm font-bold text-white">Enable Google Ads on Gyidi Nnwom</p>
                <p className="text-xs text-zinc-400">
                  Automatically loads your Google AdSense script and ad banners when switched ON
                </p>
              </div>
              <input
                type="checkbox"
                checked={adsEnabled}
                onChange={(e) => setAdsEnabled(e.target.checked)}
                className="h-5 w-5 accent-emerald-400 rounded cursor-pointer"
              />
            </label>

            <div>
              <label className="block text-xs font-bold text-emerald-300 mb-1">
                Google AdSense Key / Publisher ID (or full Google script snippet) *
              </label>
              <input
                type="text"
                value={adsPublisherInput}
                onChange={(e) => setAdsPublisherInput(e.target.value)}
                placeholder="ca-pub-1234567890123456"
                className="w-full rounded-xl border border-white/15 bg-zinc-950 px-4 py-2.5 text-sm font-mono text-white placeholder-zinc-600 focus:border-emerald-400 focus:outline-none"
              />
              <p className="text-[11px] text-zinc-400 mt-1">
                Tip: You can paste either <code className="text-emerald-300">ca-pub-XXXX...</code>{' '}
                or the entire <code className="text-zinc-300">&lt;script async src=...&gt;</code>{' '}
                tag from Google AdSense — we automatically extract your Publisher ID!
              </p>
            </div>

            <label className="flex items-center gap-2.5 rounded-xl border border-white/10 bg-zinc-950/60 px-3.5 py-2.5 text-xs font-semibold text-zinc-200 cursor-pointer">
              <input
                type="checkbox"
                checked={adsAutoAds}
                onChange={(e) => setAdsAutoAds(e.target.checked)}
                className="rounded accent-emerald-400"
              />
              Enable Google Auto Ads (Recommended — Google automatically places high-earning ads)
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">
                  Home Feed Banner Slot ID (Optional)
                </label>
                <input
                  type="text"
                  value={adsHomeSlot}
                  onChange={(e) => setAdsHomeSlot(e.target.value)}
                  placeholder="e.g. 8923749823"
                  className="w-full rounded-xl border border-white/10 bg-zinc-950 px-3.5 py-2 text-xs font-mono text-white placeholder-zinc-600 focus:border-emerald-400 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">
                  Sidebar Banner Slot ID (Optional)
                </label>
                <input
                  type="text"
                  value={adsSidebarSlot}
                  onChange={(e) => setAdsSidebarSlot(e.target.value)}
                  placeholder="e.g. 5412983741"
                  className="w-full rounded-xl border border-white/10 bg-zinc-950 px-3.5 py-2 text-xs font-mono text-white placeholder-zinc-600 focus:border-emerald-400 focus:outline-none"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 py-3 text-xs font-extrabold text-zinc-950 shadow-lg cursor-pointer disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save Google AdSense Settings
            </button>
          </form>

          <div className="lg:col-span-5 rounded-3xl border border-white/10 bg-zinc-900/60 p-6 space-y-4">
            <h4 className="text-sm font-extrabold text-white">How to Connect Google AdSense</h4>
            <ol className="space-y-3 text-xs text-zinc-300 list-decimal list-inside leading-relaxed">
              <li>
                Create or sign into your account at{' '}
                <strong className="text-emerald-300">google.com/adsense</strong> and add your live
                Gyidi Nnwom domain.
              </li>
              <li>
                Copy your Publisher ID (<code className="text-amber-300">ca-pub-XXXXXXXXXXXX</code>)
                or the verification script Google gives you.
              </li>
              <li>
                Paste it into the <strong>Google AdSense Key</strong> box here, switch{' '}
                <strong>Enable Google Ads</strong> ON, and click Save — no code edits or
                redeployments required!
              </li>
              <li>
                Optional: Once Google approves your site, you can either let{' '}
                <strong>Auto Ads</strong> manage everything or paste custom Display Ad Unit Slot IDs
                for the Home Feed and Sidebar.
              </li>
            </ol>
          </div>
        </div>
      )}

      {/* ==================== MODE 4: PREMIUM PRICING & PAYSTACK BILLING ==================== */}
      {mode === 'premium' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <form
              onSubmit={handleSavePremiumSettings}
              className="lg:col-span-7 rounded-3xl border border-amber-500/35 bg-gradient-to-br from-amber-500/12 via-zinc-900 to-zinc-950 p-6 space-y-4"
            >
              <div className="flex items-center gap-3">
                <div className="h-11 w-11 rounded-2xl bg-amber-500/20 border border-amber-400/30 flex items-center justify-center">
                  <Crown className="w-6 h-6 text-amber-300" />
                </div>
                <div>
                  <h3 className="text-lg font-extrabold text-white">
                    Gyidi Nnwom Premium Pricing &amp; Paystack Integration
                  </h3>
                  <p className="text-xs text-zinc-400">
                    Edit Monthly &amp; Yearly prices in Ghana Cedis (GHS) and configure your
                    Paystack Public Key.
                  </p>
                </div>
              </div>

              <div className="rounded-2xl border border-emerald-400/25 bg-zinc-950 p-4 space-y-2">
                <p className="text-sm font-bold text-emerald-300">Paystack Webhook Setup (one-time)</p>
                <p className="text-xs text-zinc-300">In Paystack Dashboard → Settings → API Keys &amp; Webhooks, set the webhook URL below in the matching Live/Test mode. Keep PAYSTACK_SECRET_KEY only in Supabase Edge Function Secrets.</p>
                <code className="block break-all text-xs text-amber-200 select-all">{`${SUPABASE_URL}/functions/v1/verify-premium-payment?webhook=1`}</code>
                <p className="text-xs text-zinc-400">The endpoint validates the raw-body signature, verifies the transaction with Paystack, and activates the account even when the app is closed.</p>
              </div>

              <label className="flex items-center justify-between rounded-2xl border border-white/10 bg-zinc-950/80 p-4 cursor-pointer">
                <div>
                  <p className="text-sm font-bold text-white">Enable New Premium Checkouts</p>
                  <p className="text-xs text-zinc-400">
                    Pause new checkouts without revoking paid access. Expired accounts remain locked; this setting never grants free Premium.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={premiumEnabled}
                  onChange={(e) => setPremiumEnabled(e.target.checked)}
                  className="h-5 w-5 accent-amber-400 rounded cursor-pointer"
                />
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-amber-300 mb-1">
                    Monthly Price (GHS — Cedis) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    value={monthlyPriceInput}
                    onChange={(e) => setMonthlyPriceInput(e.target.value)}
                    className="w-full rounded-xl border border-white/15 bg-zinc-950 px-4 py-2.5 text-sm font-extrabold text-white focus:border-amber-400 focus:outline-none"
                  />
                  <p className="text-[11px] text-zinc-400 mt-1">Default: 5.00 GHS / month</p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-amber-300 mb-1">
                    Yearly Price (GHS — Cedis) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    value={yearlyPriceInput}
                    onChange={(e) => setYearlyPriceInput(e.target.value)}
                    className="w-full rounded-xl border border-white/15 bg-zinc-950 px-4 py-2.5 text-sm font-extrabold text-white focus:border-amber-400 focus:outline-none"
                  />
                  <p className="text-[11px] text-zinc-400 mt-1">Default: 50.00 GHS / year</p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-emerald-300 mb-1">
                  Paystack Public Key (pk_live_... or pk_test_...)
                </label>
                <input
                  type="text"
                  value={paystackKeyInput}
                  onChange={(e) => setPaystackKeyInput(e.target.value)}
                  placeholder="pk_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                  className="w-full rounded-xl border border-white/15 bg-zinc-950 px-4 py-2.5 text-sm font-mono text-white placeholder-zinc-600 focus:border-emerald-400 focus:outline-none"
                />
                <p className="text-[11px] text-zinc-400 mt-1">
                  Copy your Public Key from{' '}
                  <strong className="text-zinc-200">
                    Paystack Dashboard → Settings → API Keys &amp; Webhooks
                  </strong>
                  . Supports MTN MoMo, Telecel Cash, AT Money, and Cards in GHS!
                </p>
              </div>

              <button
                type="submit"
                disabled={saving}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-amber-500 hover:bg-amber-400 py-3 text-xs font-extrabold text-zinc-950 shadow-lg cursor-pointer disabled:opacity-50"
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                Save Premium Pricing &amp; Paystack Settings
              </button>
            </form>

            <div className="lg:col-span-5 rounded-3xl border border-white/10 bg-zinc-900/60 p-6 space-y-4">
              <div className="flex items-center gap-2 text-sm font-extrabold text-white">
                <CreditCard className="w-4 h-4 text-amber-400" />
                Paystack Subscription Summary
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl border border-white/10 bg-zinc-950 p-3.5">
                  <p className="text-[11px] text-zinc-400">Total Payments</p>
                  <p className="text-2xl font-extrabold text-white mt-0.5">
                    {subscriptions.length}
                  </p>
                </div>
                <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/10 p-3.5">
                  <p className="text-[11px] text-emerald-300">Gross Revenue</p>
                  <p className="text-2xl font-extrabold text-white mt-0.5">
                    GHS{' '}
                    {subscriptions
                      .reduce((sum, s) => sum + Number(s.amount_ghs || 0), 0)
                      .toFixed(2)}
                  </p>
                </div>
              </div>

              <div className="space-y-2 text-xs text-zinc-300 leading-relaxed pt-1">
                <p className="font-bold text-amber-300">How Paystack Works on Gyidi Nnwom:</p>
                <ol className="list-decimal list-inside space-y-1.5 text-zinc-400">
                  <li>
                    Paste your <code className="text-emerald-300">pk_test_...</code> (testing) or{' '}
                    <code className="text-emerald-300">pk_live_...</code> (production) key from
                    Paystack Ghana.
                  </li>
                  <li>
                    Adjust the Monthly (default GHS 5) or Yearly (default GHS 50) prices anytime —
                    the Pricing &amp; Billing page updates immediately.
                  </li>
                  <li>
                    You can also grant complimentary Premium to any user/artiste in the{' '}
                    <strong>Artistes &amp; Users</strong> tab.
                  </li>
                </ol>
              </div>
            </div>
          </div>

          {/* Recent Paystack Transactions */}
          <div className="rounded-2xl border border-white/10 bg-zinc-900/50 p-5 space-y-3">
            <h4 className="text-sm font-extrabold text-white">
              Recent Paystack Subscription Payments ({subscriptions.length})
            </h4>
            {subscriptions.length === 0 ? (
              <p className="text-xs text-zinc-500">No subscription transactions yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-white/10 text-zinc-400">
                      <th className="py-2 pr-3">Date</th>
                      <th className="py-2 pr-3">Member Email</th>
                      <th className="py-2 pr-3">Plan</th>
                      <th className="py-2 pr-3">Amount</th>
                      <th className="py-2 pr-3">Expires</th>
                      <th className="py-2">Paystack Ref</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 text-zinc-200">
                    {subscriptions.map((sub) => (
                      <tr key={sub.id}>
                        <td className="py-2 pr-3 whitespace-nowrap">
                          {new Date(sub.created_at).toLocaleString()}
                        </td>
                        <td className="py-2 pr-3">{sub.user_email || sub.user_id.slice(0, 8)}</td>
                        <td className="py-2 pr-3 capitalize text-amber-300 font-semibold">
                          {sub.plan_interval}
                        </td>
                        <td className="py-2 pr-3 font-bold">
                          {sub.currency} {Number(sub.amount_ghs).toFixed(2)}
                        </td>
                        <td className="py-2 pr-3 whitespace-nowrap">
                          {new Date(sub.expires_at).toLocaleDateString()}
                        </td>
                        <td className="py-2 font-mono text-[11px] text-zinc-400">
                          {sub.paystack_reference}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
