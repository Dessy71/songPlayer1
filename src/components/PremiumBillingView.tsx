import React, { useEffect, useRef, useState } from 'react';
import {
  Crown,
  CheckCircle2,
  CloudDownload,
  Heart,
  ListPlus,
  Wallet,
  BookOpen,
  Video,
  CreditCard,
  ShieldCheck,
  Sparkles,
  Loader2,
  Receipt,
  Settings,
  AlertCircle,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { initializePremiumPayment, recoverPremiumAccount, pendingPayment, rememberPayment, verifyPremiumPayment, PremiumPlan } from '../lib/premiumPayment';
import {
  PlatformSettings,
  PremiumSubscription,
  UserProfile,
  isUserPremiumActive,
} from '../types/music';

interface PremiumBillingViewProps {
  userId: string | null;
  userEmail: string | null;
  profile: UserProfile | null;
  platformSettings: PlatformSettings | null;
  promptReason?: string | null;
  onOpenAuth: (reason?: string) => void;
  onSubscriptionActivated: (updatedProfile: UserProfile) => void;
  onOpenAdminPremiumSettings?: () => void;
}

export const PREMIUM_BENEFITS = [
  {
    icon: Sparkles,
    title: 'Song Lyrics & Sharing',
    description: 'Read song lyrics and share songs or branded WhatsApp Status cards with your community.',
    accent: 'text-gold-400 bg-gold-500/15 border-gold-400/30',
  },
  {
    icon: CloudDownload,
    title: 'In-App Offline Profile Vault',
    description:
      'Save unlimited songs & convention sermons directly to your Gyidi Nnwom profile for zero-data offline listening inside the app — without downloading files to your phone storage.',
    accent: 'text-forest-400 bg-forest-500/15 border-forest-400/30',
  },
  {
    icon: Heart,
    title: 'Like & Curate Favorite Songs',
    description:
      'Heart your favorite SCG & SACSU hymns and access your personal Liked Songs library across every device.',
    accent: 'text-pink-400 bg-pink-500/15 border-pink-400/30',
  },
  {
    icon: ListPlus,
    title: 'Create & Add to Custom Playlists',
    description:
      'Build unlimited Sabbath worship sets, branch choir collections, and convention sermon study playlists.',
    accent: 'text-gold-400 bg-gold-500/15 border-gold-400/30',
  },
  {
    icon: Wallet,
    title: 'Direct Support for SCG & SACSU Artistes',
    description:
      'Unlock verified Artiste Mobile Money & Bank account details to send direct ministry love and support to choirs & singers.',
    accent: 'text-cyan-400 bg-cyan-500/15 border-cyan-400/30',
  },
  {
    icon: BookOpen,
    title: 'Daily Bible Verse Flyers & Devotionals',
    description:
      'Receive and browse scheduled daily church Scripture flyers, memory verses, and spiritual encouragement.',
    accent: 'text-gold-400 bg-gold-500/15 border-gold-400/30',
  },
  {
    icon: Video,
    title: 'Live Convention Video & Sabbath Radio',
    description:
      'Priority access & early broadcaster/viewer privileges for HD Live Convention Video streams and low-data Sabbath Radio.',
    accent: 'text-rose-400 bg-rose-500/15 border-rose-400/30',
  },
];

export const PremiumBillingView: React.FC<PremiumBillingViewProps> = ({
  userId,
  userEmail,
  profile,
  platformSettings,
  promptReason,
  onOpenAuth,
  onSubscriptionActivated,
  onOpenAdminPremiumSettings,
}) => {
  const autoVerifiedAccount = useRef<string | null>(null);
  const verificationInFlight = useRef(false);
  const [celebrating, setCelebrating] = useState(false);
  const [recoveryReference, setRecoveryReference] = useState('');
  const [recoveryPlan, setRecoveryPlan] = useState<PremiumPlan>('monthly');
  const [verifying, setVerifying] = useState(false);
  useEffect(() => {
    const pending = userId ? pendingPayment(userId) : null;
    setRecoveryReference(pending?.reference || '');
    setRecoveryPlan(pending?.plan || 'monthly');
  }, [userId]);
  useEffect(() => {
    if (!celebrating) return;
    const timeout = window.setTimeout(() => window.location.reload(), 3500);
    return () => window.clearTimeout(timeout);
  }, [celebrating]);

  const [subscriptions, setSubscriptions] = useState<PremiumSubscription[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [payingPlan, setPayingPlan] = useState<'monthly' | 'yearly' | null>(null);
  const [statusMessage, setStatusMessage] = useState<{
    type: 'ok' | 'err';
    text: string;
  } | null>(null);

  const monthlyPrice = Number(platformSettings?.premium_monthly_price_ghs ?? 5);
  const yearlyPrice = Number(platformSettings?.premium_yearly_price_ghs ?? 50);
  const currency = platformSettings?.premium_currency || 'GHS';
  const isPremium = isUserPremiumActive(profile, platformSettings);
  const isAdmin = profile?.role === 'admin';

  const yearlySavingsPercent =
    monthlyPrice > 0 && yearlyPrice < monthlyPrice * 12
      ? Math.round(((monthlyPrice * 12 - yearlyPrice) / (monthlyPrice * 12)) * 100)
      : 0;

  const loadSubscriptions = async () => {
    if (!userId) {
      setSubscriptions([]);
      return;
    }
    setLoadingHistory(true);
    const { data } = await supabase
      .from('premium_subscriptions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(20);
    if (data) setSubscriptions(data as PremiumSubscription[]);
    setLoadingHistory(false);
  };

  useEffect(() => {
    loadSubscriptions();
  }, [userId]);

  const activatePayment = async (reference: string, plan: PremiumPlan) => {
    if (!userId) {
      onOpenAuth('Sign in to the account used for this payment.');
      return;
    }
    if (verificationInFlight.current) return;
    verificationInFlight.current = true;
    setVerifying(true);
    setStatusMessage(null);
    setRecoveryReference(reference);
    setRecoveryPlan(plan);
    rememberPayment(userId, { reference, plan });
    try {
      const updatedProfile = await verifyPremiumPayment({ reference, plan });
      onSubscriptionActivated(updatedProfile);
      rememberPayment(userId, null);
      setStatusMessage({ type: 'ok', text: `Premium activated! Payment reference: ${reference}` });
      setCelebrating(true);
    } catch (error) {
      setStatusMessage({ type: 'err', text: `${error instanceof Error ? error.message : 'Unable to verify payment.'} Reference: ${reference}. Do not pay again; use Verify existing payment below.` });
    } finally {
      verificationInFlight.current = false;
      setVerifying(false);
      setPayingPlan(null);
    }
  };

  const recoverAccount = async () => {
    if (!userId) { onOpenAuth('Sign in to the same account used for payment.'); return; }
    if (verificationInFlight.current) return;
    verificationInFlight.current = true;
    setVerifying(true);
    setStatusMessage(null);
    try {
      const { profile: recovered, pending } = await recoverPremiumAccount();
      onSubscriptionActivated(recovered);
      if (isUserPremiumActive(recovered, platformSettings)) {
        setStatusMessage({ type: 'ok', text: 'Your active subscription has been restored from your account.' });
        if (new URLSearchParams(window.location.search).has('payment_return')) {
          window.history.replaceState(null, '', window.location.pathname);
          setCelebrating(true);
        }
      } else {
        setStatusMessage({ type: 'err', text: pending ? 'Your payment has not been confirmed yet. If you were debited, do not pay again; check your payment again shortly.' : 'No active paid subscription was found for this account. Sign in to the account used at checkout.' });
      }
    } catch (error) {
      setStatusMessage({ type: 'err', text: error instanceof Error ? error.message : 'Unable to recover membership. Please retry.' });
    } finally { verificationInFlight.current = false; setVerifying(false); }
  };

  useEffect(() => {
    if (!userId) { autoVerifiedAccount.current = null; return; }
    if (autoVerifiedAccount.current === userId) return;
    autoVerifiedAccount.current = userId;
    // Legacy local references remain a fallback for older Inline checkouts.
    const pending = pendingPayment(userId);
    if (pending) void activatePayment(pending.reference, pending.plan);
    else void recoverAccount();
  }, [userId]);

  const handleSubscribe = async (plan: 'monthly' | 'yearly') => {
    setStatusMessage(null);

    if (!userId || !userEmail) {
      onOpenAuth('Create or sign in to your free Gyidi Nnwom account first to subscribe to Premium.');
      return;
    }

    setPayingPlan(plan);
    try {
      const checkout = await initializePremiumPayment(plan);
      // Convenience only: account recovery and webhook delivery do not need this.
      rememberPayment(userId, { reference: checkout.reference, plan });
      window.location.assign(checkout.authorization_url);
    } catch (err) {
      setPayingPlan(null);
      setStatusMessage({
        type: 'err',
        text: err instanceof Error ? err.message : 'Unable to launch Paystack checkout.',
      });
    }
  };

  return (
    <div className="max-w-[1250px] mx-auto space-y-6 pb-8">
      {celebrating && (
        <div className="safe-overlay fixed inset-0 z-[100] flex items-center justify-center bg-black/85 p-5" role="dialog" aria-modal="true" aria-labelledby="premium-success-title">
          <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
            {Array.from({ length: 65 }, (_, i) => (
              <span key={i} className="premium-confetti" style={{ left: `${(i * 37) % 100}%`, backgroundColor: ['#fbbf24', '#f472b6', '#34d399', '#60a5fa'][i % 4], animationDelay: `${(i % 13) * 0.07}s`, transform: `rotate(${i * 29}deg)` }} />
            ))}
          </div>
          <div className="relative max-w-md rounded-3xl border border-gold-400/50 bg-zinc-900 p-8 text-center shadow-2xl" role="status">
            <Crown className="mx-auto mb-4 h-14 w-14 text-gold-400" />
            <h2 id="premium-success-title" className="text-2xl font-extrabold text-white">Welcome to Premium!</h2>
            <p className="mt-3 text-zinc-300">Medaase! Your payment is verified and your Premium membership is active.</p>
            <p className="mt-3 text-sm text-gold-200">Refreshing to unlock your Premium experience…</p>
            <button onClick={() => window.location.reload()} className="mt-5 rounded-full bg-gold-400 px-5 py-2 font-bold text-zinc-950">Continue now</button>
          </div>
        </div>
      )}
      {/* Contextual Gated Feature Banner */}
      {promptReason && !isPremium && (
        <div className="rounded-2xl border border-gold-400/45 bg-gradient-to-r from-gold-500/20 via-pink-500/15 to-zinc-900 px-4 py-3.5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 text-xs sm:text-sm text-gold-100">
            <Crown className="w-5 h-5 text-gold-400 flex-shrink-0" />
            <span>
              <strong className="text-gold-300">Premium Feature:</strong> {promptReason}
            </span>
          </div>
          <span className="rounded-full bg-gold-400/20 border border-gold-300/40 px-3 py-1 text-[11px] font-extrabold text-gold-200">
            From {currency} {monthlyPrice.toFixed(2)} / month
          </span>
        </div>
      )}

      {/* Hero Header */}
      <section className="relative overflow-hidden rounded-3xl border border-gold-500/30 bg-gradient-to-br from-gold-500/20 via-pink-600/15 to-zinc-950 p-5 sm:p-8">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div className="space-y-2.5 max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full bg-gold-500/20 border border-gold-400/40 px-3.5 py-1 text-xs font-extrabold uppercase tracking-wider text-gold-300">
              <Crown className="w-3.5 h-3.5" />
              Gyidi Nnwom Premium • Pricing &amp; Billing
            </div>
            <h2 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight">
              Unlock Offline Listening, Playlists, Likes, Daily Verses &amp; Live Streams
            </h2>
            <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed">
              Pay securely in Ghana Cedis ({currency}) via{' '}
              <strong className="text-white">
                Paystack (MTN Mobile Money, Telecel Cash, AT Money, or Bank Card)
              </strong>{' '}
              to unlock every Premium feature while sustaining the SCG &amp; SACSU digital gospel
              ministry.
            </p>
          </div>

          {/* Current Account Plan Badge */}
          <div className="rounded-2xl border border-white/15 bg-zinc-950/90 p-4 sm:p-5 min-w-[250px] space-y-2">
            <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
              Your Current Plan
            </p>
            {isPremium ? (
              <>
                <div className="flex items-center gap-2 text-forest-300 font-extrabold text-base">
                  <CheckCircle2 className="w-5 h-5 text-forest-400 flex-shrink-0" />
                  {isAdmin && !profile?.is_premium
                    ? 'Master Admin (Full Access)'
                    : `Premium (${(profile?.premium_plan || 'Active').toUpperCase()})`}
                </div>
                {profile?.premium_until && (
                  <p className="text-xs text-zinc-400">
                    Active until{' '}
                    <strong className="text-white">
                      {new Date(profile.premium_until).toLocaleDateString()}
                    </strong>
                  </p>
                )}
              </>
            ) : (
              <>
                <p className="text-base font-extrabold text-white">
                  {userId ? 'Free Listener Plan' : 'Guest Preview'}
                </p>
                <p className="text-xs text-zinc-400">
                  Upgrade below to unlock all 6 Premium features immediately.
                </p>
              </>
            )}

            {isAdmin && onOpenAdminPremiumSettings && (
              <button
                type="button"
                onClick={onOpenAdminPremiumSettings}
                className="mt-2 w-full inline-flex items-center justify-center gap-1.5 rounded-xl bg-gold-500/20 border border-gold-400/40 px-3 py-2 text-xs font-bold text-gold-200 hover:bg-gold-500/30 cursor-pointer"
              >
                <Settings className="w-3.5 h-3.5" />
                Admin: Edit Prices &amp; Paystack Key
              </button>
            )}
          </div>
        </div>
      </section>

      {statusMessage && (
        <div
          className={`rounded-2xl border p-4 text-xs sm:text-sm flex items-start gap-2.5 ${
            statusMessage.type === 'ok'
              ? 'border-forest-500/40 bg-forest-500/15 text-forest-100'
              : 'border-rose-500/40 bg-rose-500/15 text-rose-100'
          }`}
        >
          {statusMessage.type === 'ok' ? (
            <CheckCircle2 className="w-4 h-4 text-forest-400 flex-shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
          )}
          <span>{statusMessage.text}</span>
        </div>
      )}

      {/* PRICING PLANS: MONTHLY (GHS 5) & YEARLY (GHS 50) */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Monthly Plan */}
        <div className="rounded-3xl border border-white/15 bg-zinc-900/70 p-6 flex flex-col justify-between space-y-5">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-bold text-zinc-200">
                Monthly Plan
              </span>
              <span className="text-xs text-zinc-400">Flexible 30-day billing</span>
            </div>

            <div className="flex items-baseline gap-1.5 pt-1">
              <span className="text-sm font-bold text-gold-400">{currency}</span>
              <span className="text-4xl sm:text-5xl font-extrabold text-white tabular-nums">
                {Number.isInteger(monthlyPrice) ? monthlyPrice : monthlyPrice.toFixed(2)}
              </span>
              <span className="text-sm text-zinc-400 font-medium">/ month</span>
            </div>

            <p className="text-xs text-zinc-300 leading-relaxed">
              Plans are prepaid memberships, renewed manually at expiry (no automatic charges). Full access to Offline Profile Vault, Liked Songs, Unlimited Playlists, Artiste
              Support details, Daily Bible Verses, and Live Convention Video &amp; Radio.
            </p>

            <ul className="space-y-2 pt-2 text-xs text-zinc-200">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-forest-400 flex-shrink-0" />
                Save songs to your profile for in-app offline listening
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-forest-400 flex-shrink-0" />
                Like songs, build playlists &amp; view Daily Bible Verse flyers
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-forest-400 flex-shrink-0" />
                Support Artistes &amp; access Live Video / Sabbath Radio
              </li>
            </ul>
          </div>

          <button
            type="button"
            disabled={payingPlan !== null || verifying || celebrating}
            onClick={() => handleSubscribe('monthly')}
            className="w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-white hover:bg-gold-100 disabled:opacity-60 px-5 py-3.5 text-sm font-extrabold text-zinc-950 transition cursor-pointer shadow-lg"
          >
            {payingPlan === 'monthly' ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Opening Paystack...
              </>
            ) : (
              <>
                <CreditCard className="w-4 h-4" />
                {isPremium && profile?.is_premium
                  ? `Extend Monthly (${currency} ${monthlyPrice})`
                  : `Subscribe Monthly — ${currency} ${monthlyPrice}`}
              </>
            )}
          </button>
        </div>

        {/* Yearly Plan */}
        <div className="relative rounded-3xl border-2 border-gold-400/60 bg-gradient-to-br from-gold-500/15 via-zinc-900 to-pink-600/15 p-6 flex flex-col justify-between space-y-5 shadow-xl shadow-gold-500/10">
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-gold-400 px-3 py-1 text-xs font-extrabold text-zinc-950">
                <Sparkles className="w-3.5 h-3.5" />
                Yearly Plan • Best Value
              </span>
              {yearlySavingsPercent > 0 && (
                <span className="rounded-full bg-forest-500/20 border border-forest-400/40 px-2.5 py-0.5 text-[11px] font-extrabold text-forest-300">
                  Save {yearlySavingsPercent}% (2 Months Free)
                </span>
              )}
            </div>

            <div className="flex items-baseline gap-1.5 pt-1">
              <span className="text-sm font-bold text-gold-300">{currency}</span>
              <span className="text-4xl sm:text-5xl font-extrabold text-white tabular-nums">
                {Number.isInteger(yearlyPrice) ? yearlyPrice : yearlyPrice.toFixed(2)}
              </span>
              <span className="text-sm text-zinc-300 font-medium">/ year</span>
            </div>

            <p className="text-xs text-zinc-200 leading-relaxed">
              12 full months of uninterrupted Gyidi Nnwom Premium across conventions, Sabbath study,
              and offline listening — at just{' '}
              <strong className="text-gold-300">
                {currency} {(yearlyPrice / 12).toFixed(2)}/month
              </strong>
              .
            </p>

            <ul className="space-y-2 pt-2 text-xs text-zinc-100">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-gold-400 flex-shrink-0" />
                Everything in Monthly Premium for 365 days
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-gold-400 flex-shrink-0" />
                Unlimited Offline Profile Vault for hymns &amp; long sermons
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-gold-400 flex-shrink-0" />
                Priority convention live video &amp; Sabbath radio access
              </li>
            </ul>
          </div>

          <button
            type="button"
            disabled={payingPlan !== null || verifying || celebrating}
            onClick={() => handleSubscribe('yearly')}
            className="w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-gold-400 via-gold-500 to-pink-500 hover:opacity-95 disabled:opacity-60 px-5 py-3.5 text-sm font-extrabold text-zinc-950 transition cursor-pointer shadow-lg"
          >
            {payingPlan === 'yearly' ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Opening Paystack...
              </>
            ) : (
              <>
                <Crown className="w-4 h-4" />
                {isPremium && profile?.is_premium
                  ? `Extend Yearly (${currency} ${yearlyPrice})`
                  : `Subscribe Yearly — ${currency} ${yearlyPrice}`}
              </>
            )}
          </button>
        </div>
      </section>

      {/*Paystack Security Strip*/}
      <div className="rounded-2xl border border-white/10 bg-zinc-900/50 px-4 py-3 flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-400">
        <span className="inline-flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-forest-400 flex-shrink-0" />
          Secured by <strong className="text-zinc-200">Paystack</strong> • Pay with MTN MoMo,
          Telecel Cash, AT Money, Visa, or Mastercard
        </span>
        <span>Instant activation upon payment confirmation</span>
      </div>

      {/* ALREADY PAID? CHECK MY PAYMENT */}
      {userId && (
        <section className="rounded-2xl border border-white/15 bg-zinc-900 p-5 space-y-3">
          <h3 className="font-bold text-white">Already paid? Check my payment</h3>
          <button type="button" disabled={verifying || payingPlan !== null || celebrating}
            onClick={() => void recoverAccount()}
            className="rounded-xl bg-forest-400 px-4 py-3 font-bold text-zinc-950 disabled:opacity-50">
            {verifying ? 'Checking your account…' : 'Restore my subscription — no reference needed'}
          </button>
          <p className="text-sm text-zinc-300">Sign in to the same account on any device. Payments are saved securely to your account, even if browser data was cleared or the app was reinstalled.</p>
          <p className="text-sm text-zinc-300">Older payment not found? The reference form below is an optional support fallback for payments made before account-linked checkout. Recovery and verification never charge you.</p>
          <form className="flex flex-wrap gap-3" onSubmit={(event) => { event.preventDefault(); void activatePayment(recoveryReference.trim(), recoveryPlan); }}>
            <input required aria-label="Paystack payment reference" placeholder="Paystack payment reference" value={recoveryReference} onChange={(event) => setRecoveryReference(event.target.value)} className="min-w-0 flex-1 rounded-xl border border-white/20 bg-zinc-950 p-3 text-white" />
            <select aria-label="Paid plan" value={recoveryPlan} onChange={(event) => setRecoveryPlan(event.target.value as PremiumPlan)} className="rounded-xl border border-white/20 bg-zinc-950 p-3 text-white">
              <option value="monthly">Monthly</option><option value="yearly">Yearly</option>
            </select>
            <button disabled={verifying || payingPlan !== null || celebrating} className="rounded-xl bg-gold-400 px-4 py-3 font-bold text-zinc-950 disabled:opacity-50">{verifying ? 'Verifying…' : 'Verify existing payment'}</button>
          </form>
        </section>
      )}

      {/* ALL BENEFITS OF GYIDI NNWOM PREMIUM */}
      <section className="space-y-4">
        <div>
          <h3 className="text-lg sm:text-xl font-extrabold text-white flex items-center gap-2">
            <Crown className="w-5 h-5 text-gold-400" />
            Everything Included in Gyidi Nnwom Premium
          </h3>
          <p className="text-xs text-zinc-400 mt-0.5">
            Every Monthly ({currency} {monthlyPrice}) and Yearly ({currency} {yearlyPrice}) plan
            unlocks all 6 Premium capabilities:
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {PREMIUM_BENEFITS.map((b) => {
            const Icon = b.icon;
            return (
              <div
                key={b.title}
                className="rounded-2xl border border-white/10 bg-zinc-900/55 p-4 space-y-2.5"
              >
                <div
                  className={`inline-flex h-10 w-10 items-center justify-center rounded-xl border ${b.accent}`}
                >
                  <Icon className="w-5 h-5" />
                </div>
                <h4 className="text-sm font-extrabold text-white">{b.title}</h4>
                <p className="text-xs text-zinc-400 leading-relaxed">{b.description}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* BILLING & RECEIPTS HISTORY */}
      {userId && (
        <section className="rounded-2xl border border-white/10 bg-zinc-900/50 p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
              <Receipt className="w-4 h-4 text-gold-400" />
              Billing &amp; Payment History
            </h3>
            <span className="text-[11px] text-zinc-500">{userEmail}</span>
          </div>

          {loadingHistory ? (
            <p className="text-xs text-zinc-400 py-4">Loading billing history...</p>
          ) : subscriptions.length === 0 ? (
            <p className="text-xs text-zinc-500 py-3">
              No Paystack subscription receipts recorded on this account yet.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-white/10 text-zinc-400">
                    <th className="py-2 pr-3">Date</th>
                    <th className="py-2 pr-3">Plan</th>
                    <th className="py-2 pr-3">Amount</th>
                    <th className="py-2 pr-3">Valid Until</th>
                    <th className="py-2">Reference</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-zinc-200">
                  {subscriptions.map((sub) => (
                    <tr key={sub.id}>
                      <td className="py-2.5 pr-3 whitespace-nowrap">
                        {new Date(sub.created_at).toLocaleDateString()}
                      </td>
                      <td className="py-2.5 pr-3 capitalize font-semibold text-gold-300">
                        {sub.plan_interval}
                      </td>
                      <td className="py-2.5 pr-3 font-bold whitespace-nowrap">
                        {sub.currency} {Number(sub.amount_ghs).toFixed(2)}
                      </td>
                      <td className="py-2.5 pr-3 whitespace-nowrap">
                        {new Date(sub.expires_at).toLocaleDateString()}
                      </td>
                      <td className="py-2.5 font-mono text-[11px] text-zinc-400">
                        {sub.paystack_reference}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </div>
  );
};
