import { useCallback, useEffect, useState } from 'react';
import {
  Activity,
  BarChart3,
  Globe2,
  Monitor,
  Play,
  RefreshCw,
  Smartphone,
  Tablet,
  Users,
} from 'lucide-react';
import { supabase } from '../lib/supabase';

/**
 * App usage analytics for the admin dashboard.
 *
 * Reads the admin_app_analytics() RPC, which is the only thing with access to
 * app_sessions — the table itself is closed to clients. If the migration has
 * not been applied yet the RPC is missing, and that is reported explicitly
 * rather than showing an empty dashboard that looks like "nobody is using it".
 */

interface Breakdown {
  label: string;
  code?: string;
  value: number;
}

interface Daily {
  day: string;
  sessions: number;
  unique_users: number;
  plays: number;
}

interface Summary {
  window_days: number;
  listening_now: number;
  active_now: number;
  active_hour: number;
  sessions: number;
  unique_users: number;
  authenticated_sessions: number;
  plays: number;
  devices: Breakdown[];
  countries: Breakdown[];
  browsers: Breakdown[];
  daily: Daily[];
}

const WINDOWS = [7, 30, 90] as const;
const number = (value: number) => new Intl.NumberFormat().format(value);

function deviceIcon(label: string) {
  if (label === 'mobile') return <Smartphone className="w-3.5 h-3.5" />;
  if (label === 'tablet') return <Tablet className="w-3.5 h-3.5" />;
  if (label === 'desktop') return <Monitor className="w-3.5 h-3.5" />;
  return <Globe2 className="w-3.5 h-3.5" />;
}

function StatCard({
  icon,
  label,
  value,
  hint,
  highlight = false,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border p-4 ${
        highlight
          ? 'border-gold-400/40 bg-gold-500/10'
          : 'border-white/10 bg-zinc-900/70'
      }`}
    >
      <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-zinc-400">
        {icon}
        {label}
      </div>
      <p className={`mt-2 text-2xl font-extrabold ${highlight ? 'text-gold-300' : 'text-white'}`}>
        {value}
      </p>
      {hint && <p className="mt-1 text-[11px] text-zinc-400">{hint}</p>}
    </div>
  );
}

function BreakdownBar({ title, rows }: { title: string; rows: Breakdown[] }) {
  const total = rows.reduce((sum, row) => sum + row.value, 0) || 1;
  return (
    <div className="rounded-2xl border border-white/10 bg-zinc-900/70 p-4">
      <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-300">{title}</h4>
      {rows.length === 0 ? (
        <p className="mt-3 text-[11px] italic text-zinc-500">No data yet.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {rows.map((row) => (
            <li key={`${row.label}-${row.code ?? ''}`} className="space-y-1">
              <div className="flex items-center justify-between gap-2 text-[11px] text-zinc-300">
                <span className="flex items-center gap-1.5 truncate">
                  {deviceIcon(row.label.toLowerCase())}
                  <span className="truncate">{row.label}</span>
                </span>
                <span className="font-bold text-white">
                  {number(row.value)}
                  <span className="ml-1 font-normal text-zinc-500">
                    {Math.round((row.value / total) * 100)}%
                  </span>
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-gold-400"
                  style={{ width: `${Math.max(2, (row.value / total) * 100)}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export const AdminAppAnalytics: React.FC = () => {
  const [days, setDays] = useState<number>(30);
  const [data, setData] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data: row, error: rpcError } = await supabase.rpc('admin_app_analytics', {
      p_days: days,
    });
    setLoading(false);
    if (rpcError) {
      setData(null);
      setError(
        /function .* does not exist|schema cache/i.test(rpcError.message)
          ? 'App analytics is not installed yet. Apply migration 202611070013_app_analytics.sql, then reload.'
          : rpcError.message
      );
      return;
    }
    setData(row as Summary);
  }, [days]);

  useEffect(() => {
    void load();
  }, [load]);

  const peak = Math.max(1, ...(data?.daily ?? []).map((d) => d.sessions));

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 text-lg font-extrabold text-white">
            <Activity className="w-5 h-5 text-gold-400" />
            App Usage
          </h3>
          <p className="text-xs text-zinc-400">
            Live sessions, devices and locations. Counted per browser tab.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 rounded-xl border border-white/10 bg-zinc-950 p-1">
            {WINDOWS.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setDays(option)}
                className={`rounded-lg px-2.5 py-1 text-[11px] font-bold transition cursor-pointer ${
                  days === option
                    ? 'bg-gold-500 text-zinc-950'
                    : 'text-zinc-300 hover:bg-white/5'
                }`}
              >
                {option}d
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            aria-label="Refresh app usage"
            className="rounded-xl border border-white/10 bg-zinc-900 p-2 text-zinc-300 hover:bg-white/5 disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {error && (
        <p
          role="alert"
          className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300"
        >
          {error}
        </p>
      )}

      {loading && !data && (
        <div className="rounded-2xl border border-white/10 bg-zinc-900/70 p-8 text-center">
          <RefreshCw className="mx-auto w-5 h-5 animate-spin text-zinc-500" />
        </div>
      )}

      {data && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard
              icon={<Activity className="w-3.5 h-3.5" />}
              label="Listening now"
              value={number(data.listening_now)}
              hint="Played something in the last 5 minutes"
              highlight
            />
            <StatCard
              icon={<Users className="w-3.5 h-3.5" />}
              label="Active now"
              value={number(data.active_now)}
              hint={`${number(data.active_hour)} in the last hour`}
            />
            <StatCard
              icon={<BarChart3 className="w-3.5 h-3.5" />}
              label={`Sessions (${data.window_days}d)`}
              value={number(data.sessions)}
              hint={`${number(data.authenticated_sessions)} signed in`}
            />
            <StatCard
              icon={<Play className="w-3.5 h-3.5" />}
              label={`Plays (${data.window_days}d)`}
              value={number(data.plays)}
              hint={`${number(data.unique_users)} unique listeners`}
            />
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <BreakdownBar title="Devices" rows={data.devices} />
            <BreakdownBar title="Locations" rows={data.countries} />
            <BreakdownBar title="Browsers" rows={data.browsers} />
          </div>

          <div className="rounded-2xl border border-white/10 bg-zinc-900/70 p-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-300">
              Sessions per day
            </h4>
            <div className="mt-4 flex h-32 items-end gap-1">
              {data.daily.map((point) => (
                <div
                  key={point.day}
                  title={`${point.day} — ${point.sessions} sessions, ${point.plays} plays`}
                  className="group flex-1 rounded-t bg-gold-400/80 transition hover:bg-gold-300"
                  style={{ height: `${Math.max(3, (point.sessions / peak) * 100)}%` }}
                />
              ))}
            </div>
            <div className="mt-2 flex justify-between text-[10px] text-zinc-500">
              <span>{data.daily[0]?.day ?? ''}</span>
              <span>{data.daily[data.daily.length - 1]?.day ?? ''}</span>
            </div>
          </div>
        </>
      )}
    </section>
  );
};
