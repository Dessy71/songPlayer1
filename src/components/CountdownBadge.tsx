import React, { useEffect, useState } from 'react';
import { Clock, Sparkles } from 'lucide-react';

interface CountdownBadgeProps {
  targetIso: string;
  onComplete?: () => void;
  size?: 'sm' | 'md' | 'lg';
}

export const CountdownBadge: React.FC<CountdownBadgeProps> = ({
  targetIso,
  onComplete,
  size = 'md',
}) => {
  const [remainingMs, setRemainingMs] = useState<number>(() =>
    Math.max(0, new Date(targetIso).getTime() - Date.now())
  );

  useEffect(() => {
    const target = new Date(targetIso).getTime();
    const tick = () => {
      const diff = target - Date.now();
      if (diff <= 0) {
        setRemainingMs(0);
        onComplete?.();
      } else {
        setRemainingMs(diff);
      }
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [targetIso, onComplete]);

  if (remainingMs <= 0) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-forest-500/20 border border-forest-400/40 px-2.5 py-1 text-xs font-bold text-forest-300">
        <Sparkles className="w-3.5 h-3.5" />
        Premiered — Live Now!
      </span>
    );
  }

  const totalSec = Math.floor(remainingMs / 1000);
  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;

  const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);

  if (size === 'lg') {
    return (
      <div className="grid grid-cols-4 gap-2 text-center">
        {[
          { label: 'Days', val: pad(days) },
          { label: 'Hours', val: pad(hours) },
          { label: 'Mins', val: pad(mins) },
          { label: 'Secs', val: pad(secs) },
        ].map((unit) => (
          <div
            key={unit.label}
            className="rounded-xl bg-black/60 border border-gold-400/30 px-2 py-2 backdrop-blur-md"
          >
            <p className="text-base sm:text-lg font-extrabold tabular-nums text-gold-300 leading-none">
              {unit.val}
            </p>
            <p className="text-[9px] uppercase tracking-wider text-zinc-400 mt-1">{unit.label}</p>
          </div>
        ))}
      </div>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full bg-gold-500/15 border border-gold-400/35 font-bold tabular-nums text-gold-300 ${
        size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-3 py-1 text-xs'
      }`}
    >
      <Clock className={size === 'sm' ? 'w-3 h-3' : 'w-3.5 h-3.5'} />
      {days}d : {pad(hours)}h : {pad(mins)}m : {pad(secs)}s
    </span>
  );
};
