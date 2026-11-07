import { useEffect, useState } from 'react';
import { Wallet, ExternalLink, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { PlatformSupportSummary, isPaystackPageUrl } from '../types/music';

/**
 * "Support Gyidi Nwom" button.
 *
 * Mirrors artiste support: a wallet icon that opens Gyidi's Paystack payment page.
 * There is no amount picker and no hard-coded figure — the listener chooses on the
 * Paystack page itself. The subaccount code is never requested or rendered; the URL
 * comes from the redacted platform_support_summary() RPC.
 */
export const SupportGyidiButton: React.FC = () => {
  const [summary, setSummary] = useState<PlatformSupportSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    void supabase
      .rpc('platform_support_summary')
      .then(({ data, error }) => {
        if (!active) return;
        const row = Array.isArray(data) ? data[0] : data;
        setSummary(
          error || !row
            ? null
            : {
                has_paystack_page: Boolean(row.has_paystack_page),
                payment_page_url: row.payment_page_url ?? null,
                enabled: Boolean(row.enabled),
                is_placeholder: Boolean(row.is_placeholder),
              }
        );
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center rounded-xl border border-white/10 bg-zinc-950/60 px-3.5 py-3">
        <Loader2 className="h-5 w-5 animate-spin text-zinc-500" />
      </div>
    );
  }

  const url = summary?.payment_page_url ?? null;
  const available = Boolean(summary?.enabled && isPaystackPageUrl(url));

  if (!available) {
    return (
      <div className="rounded-xl border border-white/10 bg-zinc-950/60 px-3.5 py-3 text-[11px] italic text-zinc-400">
        Gyidi Nwom support is not available right now. Please check back soon.
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => window.open((url || '').trim(), '_blank', 'noopener,noreferrer')}
      className="flex w-full items-center justify-between gap-2 rounded-xl border border-emerald-500/35 bg-emerald-500/10 px-3.5 py-3 text-left transition cursor-pointer hover:bg-emerald-500/20"
    >
      <span className="flex items-center gap-2.5 min-w-0">
        <Wallet className="w-5 h-5 flex-shrink-0 text-emerald-400" />
        <span className="min-w-0">
          <span className="block text-xs font-extrabold uppercase tracking-wider text-emerald-300">
            Support Gyidi Nwom
          </span>
          <span className="block truncate text-[11px] text-zinc-400">
            Continue to the payment page
          </span>
        </span>
      </span>
      <ExternalLink className="w-4 h-4 flex-shrink-0 text-emerald-400" />
    </button>
  );
};
