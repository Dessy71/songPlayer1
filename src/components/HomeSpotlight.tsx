import React, { useEffect, useState } from 'react';
import { ChevronRight, Pause, Play } from 'lucide-react';

export interface SpotlightSlide {
  id: string;
  label: string;
  title: string;
  description: string;
  image?: string;
  icon: React.ReactNode;
  onOpen: () => void;
}

/** A single fixed-height card replaces the three stacked homepage promotions. */
export function HomeSpotlight({ slides }: { slides: SpotlightSlide[] }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReducedMotion(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  useEffect(() => {
    if (paused || hovered || reducedMotion || slides.length < 2) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') setIndex((value) => (value + 1) % slides.length);
    }, 3000);
    return () => window.clearInterval(timer);
  }, [paused, hovered, reducedMotion, slides.length]);
  const current = slides[index % slides.length];
  if (!current) return null;
  const step = (delta: number) => {
    setPaused(true);
    setIndex((value) => (value + delta + slides.length) % slides.length);
  };
  return (
    <section aria-label="Church spotlight" aria-roledescription="carousel"
      onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
      onFocusCapture={(event) => { if (!(event.target as HTMLElement).closest('[data-rotation-toggle]')) setPaused(true); }}>
      <div data-testid="spotlight-card" className="flex h-24 overflow-hidden rounded-2xl border border-gold-400/30 bg-gradient-to-r from-gold-500/15 via-zinc-900 to-zinc-950">
      <button type="button" onClick={current.onOpen}
        className="flex h-full min-w-0 flex-1 items-center gap-3 px-3 py-2 text-left hover:bg-white/5 cursor-pointer">
        {current.image ? <img src={current.image} alt="" className="h-14 w-14 shrink-0 rounded-xl object-cover" />
          : <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-gold-400/10 text-gold-300">{current.icon}</span>}
        <span className="min-w-0 flex-1" role="group" aria-roledescription="slide" aria-label={`${index % slides.length + 1} of ${slides.length}`}>
          <span className="block truncate text-[10px] font-extrabold uppercase tracking-wide text-gold-300">{current.label}</span>
          <span className="block line-clamp-2 text-sm font-extrabold leading-5 text-white">{current.title}</span>
          <span className="block truncate text-xs text-zinc-400">{current.description}</span>
        </span>
      </button>
      <div className="flex w-11 shrink-0 flex-col items-center justify-center border-l border-white/10 text-zinc-300">
        <button type="button" aria-label="Next spotlight" onClick={() => step(1)} className="flex h-11 w-11 items-center justify-center hover:bg-white/10"><ChevronRight className="h-4 w-4" /></button>
        <button type="button" data-rotation-toggle aria-label={paused || reducedMotion ? 'Play spotlight rotation' : 'Pause spotlight rotation'}
          onClick={() => { setReducedMotion(false); setPaused((value) => !value); }} className="flex h-11 w-11 items-center justify-center hover:bg-white/10">
          {paused || reducedMotion ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
        </button>
      </div>
      </div>
    </section>
  );
}
