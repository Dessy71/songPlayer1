import React from 'react';
import { Mic2, Music2, Radio } from 'lucide-react';

const THEME_MAP: Record<string, { gradient: string; ring: string; accent: string }> = {
  gold: {
    gradient: 'from-amber-500 via-orange-600 to-rose-700',
    ring: 'border-amber-300/30',
    accent: 'text-amber-100',
  },
  emerald: {
    gradient: 'from-emerald-500 via-teal-600 to-cyan-800',
    ring: 'border-emerald-300/30',
    accent: 'text-emerald-100',
  },
  sunset: {
    gradient: 'from-pink-500 via-rose-600 to-purple-800',
    ring: 'border-pink-300/30',
    accent: 'text-pink-100',
  },
  violet: {
    gradient: 'from-violet-500 via-purple-600 to-indigo-900',
    ring: 'border-violet-300/30',
    accent: 'text-violet-100',
  },
  ocean: {
    gradient: 'from-sky-500 via-blue-600 to-indigo-900',
    ring: 'border-sky-300/30',
    accent: 'text-sky-100',
  },
  crimson: {
    gradient: 'from-rose-500 via-red-600 to-amber-800',
    ring: 'border-rose-300/30',
    accent: 'text-rose-100',
  },
  amber: {
    gradient: 'from-yellow-500 via-amber-600 to-stone-800',
    ring: 'border-yellow-300/30',
    accent: 'text-yellow-100',
  },
  indigo: {
    gradient: 'from-indigo-500 via-fuchsia-600 to-slate-900',
    ring: 'border-indigo-300/30',
    accent: 'text-indigo-100',
  },
};

interface CoverArtProps {
  title: string;
  artist?: string;
  category?: string;
  theme?: string;
  coverUrl?: string | null;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  isPlaying?: boolean;
  className?: string;
}

export const CoverArt: React.FC<CoverArtProps> = ({
  title,
  category = 'Songs',
  theme = 'sunset',
  coverUrl,
  size = 'md',
  isPlaying = false,
  className = '',
}) => {
  const style = THEME_MAP[theme] || THEME_MAP.sunset;

  const initials = React.useMemo(() => {
    const cleaned = title.replace(/[^a-zA-Z0-9\s]/g, ' ').trim();
    const parts = cleaned.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return (cleaned.slice(0, 2) || 'GN').toUpperCase();
  }, [title]);

  const iconSizes = {
    sm: 'w-3.5 h-3.5',
    md: 'w-5 h-5',
    lg: 'w-8 h-8',
    xl: 'w-12 h-12',
  };

  if (coverUrl) {
    return (
      <div className={`relative overflow-hidden bg-zinc-900 select-none ${className}`}>
        <img
          src={coverUrl}
          alt={title}
          loading="lazy"
          decoding="async"
          className="w-full h-full object-cover"
        />
      </div>
    );
  }

  const Icon = category === 'Sermons' ? Mic2 : category === 'Recordings' ? Radio : Music2;

  return (
    <div
      className={`relative overflow-hidden bg-gradient-to-br ${style.gradient} select-none flex items-center justify-center ${className}`}
    >
      {/* Decorative geometric Ghanaian Kente / Vinyl motif — pure CSS, 0 network bytes */}
      <div
        className="absolute inset-0 opacity-20"
        style={{
          backgroundImage:
            'radial-gradient(circle at 20% 20%, rgba(255,255,255,0.45) 0%, transparent 45%), repeating-linear-gradient(45deg, rgba(0,0,0,0.12) 0px, rgba(0,0,0,0.12) 2px, transparent 2px, transparent 8px)',
        }}
      />
      <div
        className={`relative flex flex-col items-center justify-center rounded-full border ${style.ring} bg-black/25 backdrop-blur-[2px] ${
          size === 'sm'
            ? 'w-7 h-7'
            : size === 'md'
            ? 'w-10 h-10'
            : size === 'lg'
            ? 'w-20 h-20'
            : 'w-32 h-32'
        } ${isPlaying && (size === 'lg' || size === 'xl') ? 'animate-spin-slow' : ''}`}
      >
        {size === 'sm' ? (
          <Icon className={`${iconSizes.sm} ${style.accent}`} />
        ) : size === 'md' ? (
          <span className={`text-[11px] font-bold tracking-wider ${style.accent}`}>{initials}</span>
        ) : (
          <>
            <Icon className={`${iconSizes[size]} ${style.accent} mb-1 opacity-90`} />
            <span className="text-xs font-extrabold tracking-widest text-white/90">{initials}</span>
          </>
        )}
      </div>
    </div>
  );
};
