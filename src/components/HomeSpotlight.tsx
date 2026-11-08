import React, { useEffect, useRef, useState } from 'react';
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

/** Height of one slide in px. Matches h-24 so the card never resizes. */
const SLIDE_HEIGHT = 96;
/** How long a slide sits still before moving on. */
const HOLD_MS = 5000;
/** How long the slide takes to travel down into place. */
const TRANSITION_MS = 3000;

/**
 * A single fixed-height card replaces the three stacked homepage promotions.
 *
 * Slides travel top-to-bottom: the incoming slide enters from above and the
 * outgoing one continues down and out, so the movement reads as one downward
 * motion rather than a swap. Both slides are on screen together only for the
 * length of the transition.
 */
export function HomeSpotlight({ slides }: { slides: SpotlightSlide[] }) {
  const [index, setIndex] = useState(0);
  const [outgoingIndex, setOutgoingIndex] = useState<number | null>(null);
  const [paused, setPaused] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const prevIndexRef = useRef(0);
  const mountedRef = useRef(false);

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
      if (document.visibilityState === 'visible') {
        setIndex((value) => (value + 1) % slides.length);
      }
    }, HOLD_MS);
    return () => window.clearInterval(timer);
  }, [paused, hovered, reducedMotion, slides.length]);

  // Hold the outgoing slide on screen for the length of the travel so the
  // movement is visible from start to finish.
  useEffect(() => {
    const previous = prevIndexRef.current;
    if (previous === index) return;
    prevIndexRef.current = index;
    if (reducedMotion) return;
    setOutgoingIndex(previous);
    const timer = window.setTimeout(() => setOutgoingIndex(null), TRANSITION_MS);
    return () => window.clearTimeout(timer);
  }, [index, reducedMotion]);

  useEffect(() => {
    mountedRef.current = true;
  }, []);

  const current = slides[index];
  if (!current) return null;

  const step = (delta: number) => {
    setPaused(true);
    setIndex((value) => (value + delta + slides.length) % slides.length);
  };

  const animate = !reducedMotion && mountedRef.current;

  const renderSlide = (slide: SpotlightSlide, slideIndex: number, isActive: boolean) => (
    <button
      key={slide.id}
      type="button"
      data-active={isActive ? 'true' : 'false'}
      aria-hidden={isActive ? undefined : true}
      tabIndex={isActive ? 0 : -1}
      onClick={slide.onOpen}
      style={{ height: SLIDE_HEIGHT }}
      className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-white/5 cursor-pointer"
    >
      {slide.image ? (
        <img src={slide.image} alt="" className="h-14 w-14 shrink-0 rounded-xl object-cover" />
      ) : (
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-gold-400/10 text-gold-300">
          {slide.icon}
        </span>
      )}
      <span
        className="min-w-0 flex-1"
        role="group"
        aria-roledescription="slide"
        aria-label={`${slideIndex + 1} of ${slides.length}`}
      >
        <span className="block truncate text-[10px] font-extrabold uppercase tracking-wide text-gold-300">
          {slide.label}
        </span>
        <span className="block line-clamp-2 text-sm font-extrabold leading-5 text-white">
          {slide.title}
        </span>
        <span className="block truncate text-xs text-zinc-400">{slide.description}</span>
      </span>
    </button>
  );

  return (
    <section
      aria-label="Church spotlight"
      aria-roledescription="carousel"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocusCapture={(event) => {
        if (!(event.target as HTMLElement).closest('[data-rotation-toggle]')) setPaused(true);
      }}
    >
      <style>{`
        @keyframes spotlight-enter { from { transform: translateY(-100%); } to { transform: translateY(0); } }
        @keyframes spotlight-exit  { from { transform: translateY(0); } to { transform: translateY(100%); } }
      `}</style>

      <div
        data-testid="spotlight-card"
        className="flex overflow-hidden rounded-2xl border border-gold-400/30 bg-gradient-to-r from-gold-500/15 via-zinc-900 to-zinc-950"
        style={{ height: SLIDE_HEIGHT }}
      >
        <div className="relative min-w-0 flex-1 overflow-hidden">
          {outgoingIndex !== null && slides[outgoingIndex] && (
            <div
              key={`exit-${outgoingIndex}-${index}`}
              className="absolute inset-x-0 top-0"
              style={{
                animation: `spotlight-exit ${TRANSITION_MS}ms ease-in-out forwards`,
              }}
            >
              {renderSlide(slides[outgoingIndex], outgoingIndex, false)}
            </div>
          )}

          <div
            key={`enter-${index}`}
            data-testid="spotlight-current"
            className="absolute inset-x-0 top-0"
            style={{
              animation: animate
                ? `spotlight-enter ${TRANSITION_MS}ms ease-in-out forwards`
                : undefined,
            }}
          >
            {renderSlide(current, index, true)}
          </div>
        </div>

        <div className="flex w-11 shrink-0 flex-col items-center justify-center border-l border-white/10 text-zinc-300">
          <button
            type="button"
            aria-label="Next spotlight"
            onClick={() => step(1)}
            className="flex h-11 w-11 items-center justify-center hover:bg-white/10"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <button
            type="button"
            data-rotation-toggle
            aria-label={
              paused || reducedMotion ? 'Play spotlight rotation' : 'Pause spotlight rotation'
            }
            onClick={() => {
              setReducedMotion(false);
              setPaused((value) => !value);
            }}
            className="flex h-11 w-11 items-center justify-center hover:bg-white/10"
          >
            {paused || reducedMotion ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>
    </section>
  );
}
