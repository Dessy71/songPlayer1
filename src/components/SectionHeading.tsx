import React from 'react';

/**
 * One heading shape for every section, so a page reads as a set of blocks
 * rather than a pile of unrelated bits.
 *
 * The icon sits in a tile, the title carries its own count, and an optional
 * line of explanation sits underneath. A rule runs the full width to close
 * the block off from whatever follows.
 */
export interface SectionHeadingProps {
  icon: React.ReactNode;
  title: string;
  count?: number;
  subtitle?: string;
  /** Trailing control, right-aligned on the same line as the title. */
  action?: React.ReactNode;
}

export const SectionHeading: React.FC<SectionHeadingProps> = ({
  icon,
  title,
  count,
  subtitle,
  action,
}) => (
  <div className="flex items-center gap-3 border-b border-white/10 pb-3">
    {icon && (
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-gold-400">
        {icon}
      </span>
    )}
    <div className="min-w-0 flex-1">
      <h3 className="text-base font-extrabold text-white">
        {title}
        {count !== undefined && <span className="ml-1.5 font-bold text-zinc-400">({count})</span>}
      </h3>
      {subtitle && <p className="truncate text-[11px] text-zinc-500">{subtitle}</p>}
    </div>
    {action && <div className="shrink-0">{action}</div>}
  </div>
);

export default SectionHeading;
