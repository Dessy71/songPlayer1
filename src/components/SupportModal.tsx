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
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { UserProfile, isProfileApproved, isPaystackPageUrl } from '../types/music';
import { SupportCheckout } from './SupportCheckout';

interface SupportModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Target profile. Omit to configure platform-level "Support Gyidi Nwom". */
  artiste?: UserProfile | null;
  isAdminViewer?: boolean;
  /** Called after Paystack details are saved and/or the profile is approved. */
  onApproved?: (profile: UserProfile) => void;
  /** Called after any successful save (approval included). */
  onSaved?: (profile: UserProfile | null) => void;
}

/** Platform-level target key used by support_checkout_config for "Support Gyidi Nwom". */
const GYIDI_TARGET = 'gyidi';
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
  const displayName = artiste?.display_name || artiste?.stage_name || 'Support Gyidi Nwom';

  const [provider, setProvider] = useState('');
  const [supportUrl, setSupportUrl] = useState('');
  const [subaccountCode, setSubaccountCode] = useState('');
  const [enabled, setEnabled] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const isApproved = isProfileApproved(artiste);
  const hasDetails = Boolean(supportUrl && subaccountCode);
  // A legacy MoMo number must never be opened as a payment page.
  const hasPaystackPage = isPaystackPageUrl(supportUrl);
  // Support Badge: shown once approved with a real Paystack page. Profile pictures only.
  const hasSupportBadge = isApproved && hasPaystackPage;

  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    setNotice(null);
    setCopied(false);
    setProvider(artiste?.support_provider || 'Paystack Payment Page');
    setSupportUrl(artiste?.support_number || '');
    setSubaccountCode(artiste?.support_account_name || '');
    setEnabled(true);
  }, [isOpen, artiste?.id, artiste?.support_provider, artiste?.support_number, artiste?.support_account_name]);

  const handleCopy = (text?: string | null) => {
    if (!text) return;
    void navigator.clipboard.writeText(text);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  const openPaymentPage = () => {
    if (!isPaystackPageUrl(supportUrl)) return;
    window.open(supportUrl.trim(), '_blank', 'noopener,noreferrer');
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
        p_provider: provider.trim() || 'Paystack Payment Page',
        p_payment_page_url: url || null,
        p_subaccount_code: sub || null,
        p_approve: approve,
        p_enabled: enabled,
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
            <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center overflow-hidden rounded-full border border-emerald-500/40 bg-emerald-500/15 text-emerald-400">
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
            className="mt-4 space-y-4 rounded-xl border border-amber-400/20 bg-amber-400/5 p-4"
            onSubmit={(e) => {
              e.preventDefault();
              void saveDetails(false);
            }}
          >
            <div className="flex items-center gap-2 text-xs font-bold uppercase text-amber-400">
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
                    className="w-full rounded-lg border border-amber-400/20 bg-zinc-800/50 px-3 py-2 pr-10 text-sm text-zinc-200 focus:border-amber-400 focus:outline-none"
                    placeholder="https://paystack.shop/pay/..."
                  />
                  <button
                    type="button"
                    onClick={() => handleCopy(supportUrl)}
                    disabled={!supportUrl}
                    aria-label="Copy payment page URL"
                    className="absolute right-2 top-2 p-1 text-zinc-400 transition-colors hover:text-amber-400 disabled:opacity-30"
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
                    className="w-full rounded-lg border border-amber-400/20 bg-zinc-800/50 px-3 py-2 pr-10 font-mono text-sm text-zinc-200 focus:border-amber-400 focus:outline-none"
                    placeholder="ACCT_xxxxxxxxxxxx"
                    spellCheck={false}
                  />
                  <button
                    type="button"
                    onClick={() => handleCopy(subaccountCode)}
                    disabled={!subaccountCode}
                    aria-label="Copy subaccount code"
                    className="absolute right-2 top-2 p-1 text-zinc-400 transition-colors hover:text-amber-400 disabled:opacity-30"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold uppercase text-zinc-400">
                  Support Provider
                </label>
                <input
                  type="text"
                  value={provider}
                  onChange={(e) => setProvider(e.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-zinc-800/50 px-3 py-2 text-sm text-zinc-200 focus:border-amber-400 focus:outline-none"
                  placeholder="Paystack Payment Page"
                />
              </div>

              <label className="flex items-start gap-2 rounded-lg border border-white/10 bg-zinc-950/40 p-2.5 text-[11px] text-zinc-300">
                <input
                  type="checkbox"
                  checked={enabled}
                  onChange={(e) => setEnabled(e.target.checked)}
                  className="mt-0.5 accent-emerald-400"
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
              <p role="status" className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-2.5 text-xs text-emerald-300">
                {notice}
              </p>
            )}

            <div className="flex flex-wrap justify-end gap-2 border-t border-white/10 pt-3">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-white/10 bg-zinc-800 px-4 py-2 text-sm font-bold text-zinc-200 transition-colors hover:bg-zinc-700"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="inline-flex items-center gap-1.5 rounded-lg bg-amber-400 px-4 py-2 text-sm font-bold text-zinc-950 transition-colors hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {isSaving ? 'Saving...' : 'Save Changes'}
              </button>
              {!isGyidi && !isApproved && (
                <button
                  type="button"
                  onClick={() => void saveDetails(true)}
                  disabled={isSaving}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <ShieldCheck className="w-4 h-4" />
                  {isSaving ? 'Approving...' : 'Approve & Activate Support'}
                </button>
              )}
            </div>
          </form>
        )}

        {/* LISTENER / ARTISTE VIEW */}
        {!isAdminViewer && isGyidi && (
          <div className="mt-4">
            {/* Platform-level support uses the verified server checkout, never a raw number. */}
            <SupportCheckout target="gyidi" name="Gyidi Nwom" />
          </div>
        )}

        {!isAdminViewer && !isGyidi && (
          <div className="mt-4 space-y-3">
            {hasSupportBadge ? (
              <>
                <p className="text-xs text-zinc-300">
                  Support {displayName} directly — you authorize every payment on Paystack, and
                  payout details stay private.
                </p>
                <button
                  type="button"
                  onClick={openPaymentPage}
                  className="flex w-full items-center justify-between gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-3 text-left transition-colors hover:bg-emerald-500/20"
                >
                  <span className="flex items-center gap-2.5">
                    <Wallet className="w-5 h-5 flex-shrink-0 text-emerald-400" />
                    <span className="min-w-0">
                      <span className="block text-sm font-bold text-emerald-300">
                        Support {displayName}
                      </span>
                      <span className="block truncate text-[11px] text-zinc-400">
                        {provider || 'Paystack Payment Page'}
                      </span>
                    </span>
                  </span>
                  <ExternalLink className="w-4 h-4 flex-shrink-0 text-emerald-400" />
                </button>
                <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-zinc-800/60 px-3 py-2">
                  <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-zinc-400">
                    {supportUrl}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleCopy(supportUrl)}
                    aria-label="Copy payment page URL"
                    className="flex-shrink-0 p-1 text-zinc-400 transition-colors hover:text-emerald-400"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </>
            ) : (
              <div className="rounded-xl border border-white/10 bg-zinc-950/60 p-3.5 text-xs italic text-zinc-400">
                {artiste?.approval_status === 'pending'
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
