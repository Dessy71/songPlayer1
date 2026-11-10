import React from 'react';
import { Mic2, Music2, Radio } from 'lucide-react';
import { resolveCoverUrl } from '../lib/defaultCovers';

/**
 * Generated cover art. Every theme now draws from the two brand hues only —
 * forest green and golden yellow — varying by depth rather than by hue, so the
 * catalogue looks like one product instead of eight unrelated gradients.
 */
const THEME_MAP: Record<string, { gradient: string; ring: string; accent: string }> = {
  gold: {
    gradient: 'from-gold-300 via-gold-400 to-gold-600',
    ring: 'border-gold-200/40',
    accent: 'text-forest-950',
  },
  emerald: {
    gradient: 'from-forest-400 via-forest-600 to-forest-800',
    ring: 'border-forest-200/30',
    accent: 'text-forest-100',
  },
  sunset: {
    gradient: 'from-gold-300 via-gold-500 to-forest-700',
    ring: 'border-gold-200/40',
    accent: 'text-forest-950',
  },
  violet: {
    gradient: 'from-forest-500 via-forest-700 to-forest-950',
    ring: 'border-forest-200/30',
    accent: 'text-forest-100',
  },
  ocean: {
    gradient: 'from-forest-600 via-forest-800 to-forest-950',
    ring: 'border-forest-200/30',
    accent: 'text-forest-100',
  },
  crimson: {
    gradient: 'from-gold-400 via-forest-700 to-forest-950',
    ring: 'border-gold-200/40',
    accent: 'text-gold-100',
  },
  amber: {
    gradient: 'from-gold-200 via-gold-400 to-forest-800',
    ring: 'border-gold-200/40',
    accent: 'text-forest-950',
  },
  indigo: {
    gradient: 'from-forest-700 via-forest-900 to-forest-950',
    ring: 'border-forest-200/30',
    accent: 'text-forest-100',
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

  /**
   * Releases without artwork get one of the default covers. Resolved here
   * rather than at the ~21 call sites so that every screen agrees on which
   * artwork a given release shows, seeded on the title because that is the one
   * identifying field every call site has.
   */
  const [failed, setFailed] = React.useState(false);
  const src = React.useMemo(() => resolveCoverUrl(coverUrl, title), [coverUrl, title]);

  // A release whose artwork changes should get a fresh attempt at loading it.
  React.useEffect(() => setFailed(false), [src]);

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

  if (src && !failed) {
    return (
      <div className={`relative overflow-hidden bg-zinc-900 select-none ${className}`}>
        <img
          src={src}
          alt={title}
          loading="lazy"
          decoding="async"
          // Only reachable if a stored URL 404s; keeps a broken-image icon off
          // the screen. Releases with no artwork never reach this branch,
          // because they are given a default cover above.
          onError={() => setFailed(true)}
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
