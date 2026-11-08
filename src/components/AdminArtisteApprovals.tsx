import { useCallback, useEffect, useState } from 'react';
import {
  Building2,
  CheckCircle2,
  ExternalLink,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  Wallet,
  XCircle,
} from 'lucide-react';
import { supabase } from '../lib/supabase';

/**
 * Artiste application queue.
 *
 * A listener switching to an artiste profile submits bank or mobile-money
 * details. An admin reads them here, creates the Paystack subaccount and
 * payment page from them, then approves or rejects. The payout table is
 * service_role-only, so this reads through admin_artiste_applications().
 */

interface Application {
  artiste_id: string;
  stage_name: string | null;
  display_name: string | null;
  real_name: string | null;
  email: string | null;
  avatar_url: string | null;
  scg_zone: string | null;
  scg_branch: string | null;
  is_sacsu: boolean | null;
  tertiary_institution: string | null;
  approval_status: string | null;
  rejection_reason: string | null;
  created_at: string | null;
  payment_method: 'bank' | 'momo' | null;
  bank_name: string | null;
  bank_account_number: string | null;
  bank_account_name: string | null;
  momo_operator: string | null;
  momo_phone_number: string | null;
  subaccount_code: string | null;
  payment_page_url: string | null;
  is_placeholder: boolean | null;
  has_payout_details: boolean | null;
}

const statusStyles: Record<string, string> = {
  approved: 'bg-forest-500/15 text-forest-300 border-forest-500/30',
  rejected: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
  pending: 'bg-gold-500/15 text-gold-300 border-gold-500/30',
};

function DetailRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-[11px] text-zinc-400">{label}</span>
      <span className="text-[11px] font-semibold text-white break-all text-right">
        {value || '—'}
      </span>
    </div>
  );
}

export const AdminArtisteApprovals: React.FC = () => {
  const [rows, setRows] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<Application | null>(null);
  const [reason, setReason] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error: rpcError } = await supabase.rpc('admin_artiste_applications');
    setLoading(false);
    if (rpcError) {
      setRows([]);
      setError(
        /function .* does not exist|schema cache/i.test(rpcError.message)
          ? 'The approval workflow is not installed yet. Apply migration 202611070014_artiste_approval_workflow.sql, then reload.'
          : rpcError.message
      );
      return;
    }
    setRows((data as Application[]) || []);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const decide = async (application: Application, status: 'approved' | 'rejected') => {
    setBusyId(application.artiste_id);
    setError(null);
    const { error: rpcError } = await supabase.rpc('admin_set_artiste_approval', {
      p_artiste_id: application.artiste_id,
      p_status: status,
      p_reason: status === 'rejected' ? reason.trim() || 'Your application was not approved.' : null,
    });
    setBusyId(null);
    setRejecting(null);
    setReason('');
    if (rpcError) {
      setError(rpcError.message);
      return;
    }
    void load();
  };

  const pending = rows.filter((r) => (r.approval_status || 'pending') === 'pending');

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-bold text-white">
            <ShieldCheck className="w-4 h-4 text-gold-400" />
            Artiste Applications
            {pending.length > 0 && (
              <span className="rounded-full bg-gold-500 px-1.5 py-0.5 text-[10px] font-extrabold text-zinc-950">
                {pending.length}
              </span>
            )}
          </h3>
          <p className="text-[11px] text-zinc-400">
            Create the Paystack subaccount and payment page from these details, then approve.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          aria-label="Refresh applications"
          className="rounded-xl border border-white/10 bg-zinc-900 p-2 text-zinc-300 hover:bg-white/5 disabled:opacity-50 cursor-pointer"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {error && (
        <p role="alert" className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300">
          {error}
        </p>
      )}

      {loading && rows.length === 0 && (
        <div className="rounded-2xl border border-white/10 bg-zinc-900/60 p-8 text-center">
          <Loader2 className="mx-auto w-5 h-5 animate-spin text-zinc-500" />
        </div>
      )}

      {!loading && rows.length === 0 && !error && (
        <p className="rounded-2xl border border-white/10 bg-zinc-900/60 p-6 text-center text-xs italic text-zinc-400">
          No artiste profiles yet.
        </p>
      )}

      <div className="grid gap-3 lg:grid-cols-2">
        {rows.map((application) => {
          const status = application.approval_status || 'pending';
          return (
            <article
              key={application.artiste_id}
              className="rounded-2xl border border-white/10 bg-zinc-900/60 p-4 space-y-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  {application.avatar_url ? (
                    <img
                      src={application.avatar_url}
                      alt=""
                      className="h-11 w-11 rounded-xl object-cover flex-shrink-0"
                    />
                  ) : (
                    <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-gold-500/15 text-gold-300">
                      <Wallet className="w-5 h-5" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="truncate text-sm font-extrabold text-white">
                      {application.stage_name || application.display_name || 'Unnamed'}
                    </p>
                    <p className="truncate text-[11px] text-zinc-400">
                      {application.real_name || application.email || '—'}
                    </p>
                  </div>
                </div>
                <span
                  className={`flex-shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold capitalize ${
                    statusStyles[status] || statusStyles.pending
                  }`}
                >
                  {status}
                </span>
              </div>

              <div className="rounded-xl border border-white/10 bg-zinc-950/60 p-3">
                <p className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                  {application.payment_method === 'momo' ? (
                    <Smartphone className="w-3.5 h-3.5" />
                  ) : (
                    <Building2 className="w-3.5 h-3.5" />
                  )}
                  {application.payment_method === 'momo' ? 'Mobile Money' : 'Bank Account'}
                </p>
                {application.has_payout_details ? (
                  <div className="space-y-1.5">
                    {application.payment_method === 'momo' ? (
                      <>
                        <DetailRow label="Network" value={application.momo_operator} />
                        <DetailRow label="Number" value={application.momo_phone_number} />
                      </>
                    ) : (
                      <>
                        <DetailRow label="Bank" value={application.bank_name} />
                        <DetailRow label="Account number" value={application.bank_account_number} />
                        <DetailRow label="Account name" value={application.bank_account_name} />
                      </>
                    )}
                  </div>
                ) : (
                  <p className="text-[11px] italic text-zinc-500">
                    No payout details submitted yet.
                  </p>
                )}
              </div>

              {application.subaccount_code && (
                <div className="rounded-xl border border-forest-500/25 bg-forest-500/10 p-3 space-y-1.5">
                  <DetailRow label="Subaccount" value={application.subaccount_code} />
                  {application.payment_page_url && (
                    <a
                      href={application.payment_page_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-between gap-2 text-[11px] text-gold-300 hover:underline"
                    >
                      <span className="truncate">{application.payment_page_url}</span>
                      <ExternalLink className="w-3 h-3 flex-shrink-0" />
                    </a>
                  )}
                </div>
              )}

              {status === 'rejected' && application.rejection_reason && (
                <p className="rounded-lg border border-rose-500/25 bg-rose-500/10 p-2 text-[11px] text-rose-300">
                  {application.rejection_reason}
                </p>
              )}

              {status !== 'approved' && (
                <div className="flex flex-wrap gap-2 pt-1">
                  <button
                    type="button"
                    disabled={busyId === application.artiste_id}
                    onClick={() => void decide(application, 'approved')}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-forest-500 px-3 py-2 text-xs font-bold text-white hover:bg-forest-600 disabled:opacity-50 cursor-pointer"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Approve
                  </button>
                  <button
                    type="button"
                    disabled={busyId === application.artiste_id}
                    onClick={() => setRejecting(application)}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs font-bold text-rose-300 hover:bg-rose-500/20 disabled:opacity-50 cursor-pointer"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    Reject
                  </button>
                </div>
              )}

              {rejecting?.artiste_id === application.artiste_id && (
                <div className="space-y-2 rounded-xl border border-white/10 bg-zinc-950/60 p-3">
                  <label className="block text-[11px] font-medium text-zinc-300">
                    Reason shown to the artiste
                  </label>
                  <textarea
                    rows={2}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="e.g. The account name does not match the name on your profile."
                    className="w-full rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-xs text-white focus:border-gold-500 focus:outline-none"
                  />
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={busyId === application.artiste_id}
                      onClick={() => void decide(application, 'rejected')}
                      className="rounded-lg bg-rose-500 px-3 py-1.5 text-xs font-bold text-white hover:bg-rose-600 disabled:opacity-50 cursor-pointer"
                    >
                      Confirm rejection
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setRejecting(null);
                        setReason('');
                      }}
                      className="rounded-lg border border-white/10 bg-zinc-800 px-3 py-1.5 text-xs font-bold text-zinc-200 hover:bg-zinc-700 cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
};
