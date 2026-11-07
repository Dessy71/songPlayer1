import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { PlatformSupportSummary, isPaystackPageUrl } from '../types/music';
import { SupportCheckout } from './SupportCheckout';

/**
 * "Support Gyidi Nwom" button.
 *
 * Open to everyone — no Premium membership required. When the platform Paystack
 * page is configured, this renders SupportCheckout so any signed-in listener can
 * choose an amount and optionally be recognised publicly as a supporter. The
 * subaccount code is never requested or rendered; the URL comes from the redacted
 * platform_support_summary() RPC.
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

  return <SupportCheckout target="gyidi" name="Gyidi Nwom" />;
}
