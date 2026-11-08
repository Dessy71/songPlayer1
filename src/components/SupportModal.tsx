import React, { useEffect, useState } from 'react';
import {
  X,
  Copy,
  Check,
  Wallet,
  AlertCircle,
  ShieldCheck,
  ExternalLink,
  Loader2,
  BadgeCheck,
  RefreshCw,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import {
  UserProfile,
  PlatformSupportSummary,
  isProfileApproved,
  isPaystackPageUrl,
} from '../types/music';

interface SupportModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Target profile. Omit to configure platform-level "Support Gyidi Nnwom". */
  artiste?: UserProfile | null;
  isAdminViewer?: boolean;
  /** Called after Paystack details are saved and/or the profile is approved. */
  onApproved?: (profile: UserProfile) => void;
  /** Called after any successful save (approval included). */
  onSaved?: (profile: UserProfile | null) => void;
}

/** Platform-level target key used by support_checkout_config for "Support Gyidi Nnwom". */
const GYIDI_TARGET = 'gyidi';
/** Support provider is fixed: the payment surface is always Paystack. */
const DEFAULT_PROVIDER = 'Paystack Payment Page';
const SUBACCOUNT_PATTERN = /^ACCT_[A-Za-z0-9]+$/;
const PAYSTACK_PAGE_PATTERN = /^https:\/\/([a-z0-9-]+\.)*paystack\.(com|shop)\//i;

export const SupportModal: React.FC<SupportModalProps> = ({
  isOpen,
  onClose,
  artiste,
  isAdminViewer = false,
  onApproved,
  onSaved,
}) => {
  const target = artiste?.id || GYIDI_TARGET;
  const isGyidi = !artiste?.id;
  const displayName = artiste?.display_name || artiste?.stage_name || 'Support Gyidi Nnwom';

  const [supportUrl, setSupportUrl] = useState('');
  const [subaccountCode, setSubaccountCode] = useState('');
  const [enabled, setEnabled] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);
  const [platformLoading, setPlatformLoading] = useState(false);

  const isApproved = isProfileApproved(artiste);
  // A legacy MoMo number must never be opened as a payment page.
  const hasPaystackPage = isPaystackPageUrl(supportUrl);
  // Support Badge: shown once approved with a real Paystack page. Profile pictures only.
  const hasSupportBadge = isApproved && hasPaystackPage;

  // Listeners never get the admin RPC, so platform support is read from the redacted
  // summary (page URL only). Gyidi has no profile row, so it is always "live".
  const [platform, setPlatform] = useState<PlatformSupportSummary | null>(null);
  useEffect(() => {
    if (!isOpen || !isGyidi || isAdminViewer) return;
    let active = true;
    void supabase
      .rpc('platform_support_summary')
      .then(({ data, error }) => {
        if (!active) return;
        const row = Array.isArray(data) ? data[0] : data;
        setPlatform(
          error || !row
            ? null
            : {
                has_paystack_page: Boolean(row.has_paystack_page),
                payment_page_url: row.payment_page_url ?? null,
                enabled: Boolean(row.enabled),
                is_placeholder: Boolean(row.is_placeholder),
              }
        );
      });
    return () => {
      active = false;
    };
  }, [isOpen, isGyidi, isAdminViewer]);

  const canShowSupportButton = isGyidi
    ? Boolean(platform?.has_paystack_page && platform?.enabled)
    : hasSupportBadge;

  useEffect(() => {
    if (!isOpen) return;
    let active = true;
    setError(null);
    setNotice(null);
    setCopied(false);
    setSyncResult(null);
    setSupportUrl('');
    setSubaccountCode('');
    setEnabled(true);

    // Admins need the full payout row (including the subaccount) to edit it. It is read
    // through admin_support_details(), which is itself admin-guarded; listeners only ever
    // get the redacted profile_support_summary().
    if (!isAdminViewer) return;
    void supabase
      .rpc('admin_get_support_details', { p_target: target })
      .then(({ data, error }) => {
        if (!active || error) return;
        const row = Array.isArray(data) ? data[0] : data;
        if (!row) return;
        setSupportUrl(row.payment_page_url || '');
        setSubaccountCode(row.subaccount_code || '');
        setEnabled(row.enabled !== false);
      });
    return () => {
      active = false;
    };
  }, [isOpen, isAdminViewer, target]);

  const handleCopy = (text?: string | null) => {
    if (!text) return;
    void navigator.clipboard.writeText(text);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  const openPaymentPage = () => {
    const url = isGyidi ? platform?.payment_page_url : supportUrl;
    if (!isPaystackPageUrl(url)) return;
    window.open((url || '').trim(), '_blank', 'noopener,noreferrer');
  };

  const saveDetails = async (approve: boolean) => {
    if (!isAdminViewer) return;
    setError(null);
    setNotice(null);

    const url = supportUrl.trim();
    const sub = subaccountCode.trim();

    if (approve && !isGyidi && (!url || !sub)) {
      setError('Add the Paystack payment page URL and subaccount code before approving.');
      return;
    }
    if (url && !PAYSTACK_PAGE_PATTERN.test(url)) {
      setError('Enter the Paystack payment page URL, e.g. https://paystack.shop/pay/yourtag');
      return;
    }
    if (sub && !SUBACCOUNT_PATTERN.test(sub)) {
      setError('Enter the Paystack subaccount code exactly as issued (ACCT_...).');
      return;
    }
    if (enabled && !isGyidi && !sub) {
      setError('A Paystack subaccount code is required before listener support can be switched on.');
      return;
    }

    setIsSaving(true);
    try {
      // support_checkout_config is service_role only, so this goes through a guarded RPC.
      const { data, error: rpcError } = await supabase.rpc('admin_set_support_details', {
        p_target: target,
        p_provider: DEFAULT_PROVIDER,
        p_payment_page_url: url || null,
        p_subaccount_code: sub || null,
        p_approve: approve,
        p_enabled: enabled,
        p_is_placeholder: false,
      });

      if (rpcError) throw rpcError;

      const savedProfile = (data as { profile?: UserProfile | null } | null)?.profile ?? null;
      setNotice(
        approve
          ? 'Support page approved and Paystack details saved.'
          : 'Paystack details saved.'
      );
      if (savedProfile) onSaved?.(savedProfile);
      else onSaved?.(null);
      if (approve && savedProfile) onApproved?.(savedProfile);
      if (approve) window.setTimeout(onClose, 900);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Could not save the support details.';
      setError(
        /\bnot (?:found|exist)\b|does not exist|schema cache/i.test(message)
          ? `${message} Apply the latest Supabase migration, then try again.`
          : message
      );
    } finally {
      setIsSaving(false);
    }
  };

  /**
   * Matches successful Paystack charges from the last 30 days against Gyidi Nnwom
   * accounts and awards the supporter badge. Needed for donations made on the
   * Paystack payment page before the webhook was connected, or when every webhook
   * delivery attempt failed.
   */
  const syncPayments = async () => {
    if (!isAdminViewer) return;
    setIsSyncing(true);
    setSyncResult(null);
    try {
      const { data, error: invokeError } = await supabase.functions.invoke(
        'support-checkout',
        { body: { action: 'reconcile', days: 30 } }
      );
      // functions.invoke throws a generic "non-2xx status code" error and keeps the
      // real JSON body on error.context (a Response). Dig it out so the message
      // explains what actually went wrong.
      if (invokeError) {
        let detail = invokeError.message || '';
        try {
          const body = await (
            invokeError as unknown as { context?: Response }
          )?.context?.json();
          if (body?.error) detail = String(body.error);
        } catch {
          /* keep the generic message */
        }
        throw new Error(detail || 'Sync failed.');
      }
      if (data?.error) throw new Error(String(data.error));
      const count = Number(data?.adopted ?? 0);
      setSyncResult(
        count > 0
          ? `${count} payment${count === 1 ? '' : 's'} matched. Supporter badges updated.`
          : `No new payments to match (${Number(data?.scanned ?? 0)} checked).`
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '';
      setSyncResult(
        /unknown action/i.test(message)
          ? 'The deployed function is out of date. Run: npx supabase functions deploy support-checkout'
          : /admins only/i.test(message)
            ? 'Only an admin account can run the sync. Your profile role is not "admin".'
            : /not configured/i.test(message)
              ? 'PAYSTACK_SECRET_KEY is not set. Run: npx supabase secrets set PAYSTACK_SECRET_KEY=sk_live_...'
              : /non-2xx|Failed to (send|fetch)|unavailable/i.test(message)
                ? `${message} — check Dashboard → Edge Functions → support-checkout → Logs for the full error.`
                : message || 'Could not sync Paystack payments.'
      );
    } finally {
      setIsSyncing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-lg rounded-2xl border border-white/10 bg-zinc-900 p-6 shadow-2xl max-h-[85vh] overflow-y-auto">
        <button
          onClick={onClose}
          aria-label="Close support details"
          className="absolute right-4 top-4 rounded-full p-1.5 text-zinc-400 hover:bg-white/10 hover:text-white transition cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header: badge shows profile picture only, never a name */}
        <div className="flex items-center gap-2.5 pr-8">
          {hasSupportBadge && (
            <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center overflow-hidden rounded-full border border-forest-500/40 bg-forest-500/15 text-forest-400">
              {artiste?.avatar_url ? (
                <img src={artiste.avatar_url} alt="" className="h-full w-full object-cover" />
              ) : (
                <BadgeCheck className="w-4 h-4" />
              )}
            </span>
          )}
          <div className="min-w-0">
            <h3 className="truncate text-lg font-bold text-white">Support {displayName}</h3>
            <p className="text-[11px] text-zinc-400">
              {isAdminViewer
                ? 'Admin Paystack configuration and approval'
                : hasSupportBadge
                  ? 'Approved support page'
                  : 'Support details'}
            </p>
          </div>
        </div>

        {/* ADMIN: Paystack configuration + approval */}
        {isAdminViewer && (
          <form
            className="mt-4 space-y-4 rounded-xl border border-gold-400/20 bg-gold-400/5 p-4"
            onSubmit={(e) => {
              e.preventDefault();
              void saveDetails(false);
            }}
          >
            <div className="flex items-center gap-2 text-xs font-bold uppercase text-gold-400">
              <AlertCircle className="w-3.5 h-3.5" />
              Paystack subaccount &amp; payment page
            </div>

            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-bold uppercase text-zinc-400">
                  Paystack Payment Page URL
                </label>
                <div className="relative">
                  <input
                    type="url"
                    inputMode="url"
                    value={supportUrl}
                    onChange={(e) => setSupportUrl(e.target.value)}
                    className="w-full rounded-lg border border-gold-400/20 bg-zinc-800/50 px-3 py-2 pr-10 text-sm text-zinc-200 focus:border-gold-400 focus:outline-none"
                    placeholder="https://paystack.shop/pay/..."
                  />
                  <button
                    type="button"
                    onClick={() => handleCopy(supportUrl)}
                    disabled={!supportUrl}
                    aria-label="Copy payment page URL"
                    className="absolute right-2 top-2 p-1 text-zinc-400 transition-colors hover:text-gold-400 disabled:opacity-30"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold uppercase text-zinc-400">
                  Subaccount Code
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={subaccountCode}
                    onChange={(e) => setSubaccountCode(e.target.value)}
                    className="w-full rounded-lg border border-gold-400/20 bg-zinc-800/50 px-3 py-2 pr-10 font-mono text-sm text-zinc-200 focus:border-gold-400 focus:outline-none"
                    placeholder="ACCT_xxxxxxxxxxxx"
                    spellCheck={false}
                  />
                  <button
                    type="button"
                    onClick={() => handleCopy(subaccountCode)}
                    disabled={!subaccountCode}
                    aria-label="Copy subaccount code"
                    className="absolute right-2 top-2 p-1 text-zinc-400 transition-colors hover:text-gold-400 disabled:opacity-30"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <label className="flex items-start gap-2 rounded-lg border border-white/10 bg-zinc-950/40 p-2.5 text-[11px] text-zinc-300">
                <input
                  type="checkbox"
                  checked={enabled}
                  onChange={(e) => setEnabled(e.target.checked)}
                  className="mt-0.5 accent-forest-400"
                />
                <span>
                  Enable listener checkout for this {isGyidi ? 'platform' : 'artiste'} once the
                  subaccount is verified by Paystack.
                </span>
              </label>
            </div>

            {error && (
              <p role="alert" className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-2.5 text-xs text-rose-300">
                {error}
              </p>
            )}
            {notice && (
              <p role="status" className="rounded-lg border border-forest-500/30 bg-forest-500/10 p-2.5 text-xs text-forest-300">
                {notice}
              </p>
            )}

            <div className="flex flex-wrap justify-end gap-2 border-t border-white/10 pt-3">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-white/10 bg-zinc-800 px-4 py-2 text-sm font-bold text-zinc-200 transition-colors hover:bg-zinc-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="inline-flex items-center gap-1.5 rounded-lg bg-gold-400 px-4 py-2 text-sm font-bold text-zinc-950 transition-colors hover:bg-gold-300 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {isSaving ? 'Saving...' : 'Save Changes'}
              </button>
              {!isGyidi && !isApproved && (
                <button
                  type="button"
                  onClick={() => void saveDetails(true)}
                  disabled={isSaving}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-forest-500 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-forest-600 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <ShieldCheck className="w-4 h-4" />
                  {isSaving ? 'Approving...' : 'Approve & Activate Support'}
                </button>
              )}
            </div>
          </form>
        )}

        {/* ADMIN: adopt Paystack payment-page donations that the webhook missed */}
        {isAdminViewer && (
          <div className="mt-4 space-y-2.5 rounded-xl border border-white/10 bg-zinc-950/40 p-4">
            <div className="flex items-center gap-2 text-xs font-bold uppercase text-zinc-400">
              <RefreshCw className="h-3.5 w-3.5" />
              Supporter sync
            </div>
            <p className="text-[11px] leading-relaxed text-zinc-400">
              Match successful Paystack payments from the last 30 days to Gyidi Nnwom accounts
              by the email the supporter entered, then award their supporter badge. Use this
              for payments made before the webhook was connected, or when Paystack could not
              deliver it.
            </p>
            <button
              type="button"
              onClick={() => void syncPayments()}
              disabled={isSyncing}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-zinc-800 px-3.5 py-2 text-xs font-bold text-zinc-200 transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
            >
              {isSyncing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              {isSyncing ? 'Syncing…' : 'Sync Paystack payments'}
            </button>
            {syncResult && (
              <p role="status" className="text-[11px] text-forest-300">
                {syncResult}
              </p>
            )}
          </div>
        )}

        {/* LISTENER / ARTISTE / PLATFORM VIEW
            One wallet button that goes straight to the payment page. The URL and the
            subaccount code are never rendered for a non-admin. */}
        {!isAdminViewer && (
          <div className="mt-4 space-y-3">
            {/* Without this guard the first open flashes "not configured yet"
                while platform_support_summary() is still in flight. */}
            {platformLoading && !platform ? (
              <div className="flex items-center justify-center rounded-xl border border-white/10 bg-zinc-950/60 px-3.5 py-4">
                <Loader2 className="h-5 w-5 animate-spin text-zinc-500" />
              </div>
            ) : canShowSupportButton ? (
              <>
                <p className="text-xs text-zinc-300">
                  {isGyidi
                    ? 'Partner with the Gyidi Nnwom digital ministry. You authorize every payment on Paystack.'
                    : `Support ${displayName} directly — you authorize every payment on Paystack, and payout details stay private.`}
                </p>
                <button
                  type="button"
                  onClick={openPaymentPage}
                  className="flex w-full items-center justify-between gap-3 rounded-xl border border-forest-500/30 bg-forest-500/10 px-3.5 py-3 text-left transition-colors hover:bg-forest-500/20 cursor-pointer"
                >
                  <span className="flex items-center gap-2.5 min-w-0">
                    <Wallet className="w-5 h-5 flex-shrink-0 text-forest-400" />
                    <span className="min-w-0">
                      <span className="block text-sm font-bold text-forest-300">
                        Support {isGyidi ? 'Gyidi Nnwom' : displayName}
                      </span>
                      <span className="block truncate text-[11px] text-zinc-400">
                        Continue to the payment page
                      </span>
                    </span>
                  </span>
                  <ExternalLink className="w-4 h-4 flex-shrink-0 text-forest-400" />
                </button>
              </>
            ) : (
              <div className="rounded-xl border border-white/10 bg-zinc-950/60 p-3.5 text-xs italic text-zinc-400">
                {isGyidi
                  ? 'Gyidi Nnwom support is not configured yet.'
                  : artiste?.approval_status === 'pending'
                    ? 'This profile is pending admin approval. Support opens once the admin adds the Paystack page and approves it.'
                    : artiste?.approval_status === 'rejected'
                      ? 'Support is not available for this profile.'
                      : supportUrl && !hasPaystackPage
                        ? 'Mobile Money details on file have been retired. A Paystack payment page is being set up.'
                        : 'Support details have not been configured yet.'}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
