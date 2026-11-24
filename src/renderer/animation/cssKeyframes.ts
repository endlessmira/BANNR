import { DEFAULT_DISTANCE, hasAnimation, isActive } from '@/model/animation';
import type { AnimationPreset, BannerElement, Size } from '@/model/types';
import { type Decls, cssId, decls, round } from '../css';
import type { AnimationEngine } from './engine';

/**
 * Default animation engine: plain CSS @keyframes, no scripts, nothing for ad servers to block.
 * Each animated element gets one @keyframes spanning the whole loop, so all elements stay in sync
 * and the loop count is a simple animation-iteration-count. Element rotation uses the separate
 * CSS `rotate` property, so it combines with the `transform` animated here.
 */
export interface FrameState { transform: string; opacity: number; filter?: string }
interface Stop { pct: number; state: FrameState; easing?: string }

const NAMED_EASINGS = new Set(['linear', 'ease', 'ease-in', 'ease-out', 'ease-in-out']);
const NUM = '\\s*-?\\d*\\.?\\d+\\s*';
const BEZIER = new RegExp(`^cubic-bezier\\(${NUM},${NUM},${NUM},${NUM}\\)$`);

export function safeEasing(e: string): string {
  const v = e.trim();
  if (NAMED_EASINGS.has(v)) return v;
  return BEZIER.test(v) ? v.replace(/\s+/g, '') : 'ease';
}

export const keyframesName = (id: string): string => `bk-${cssId(id)}`;

/** The "away" state: where an entrance starts or an exit ends. */
export function offState(preset: AnimationPreset, phase: 'in' | 'out', distance: number, base: number): FrameState {
  const s = phase === 'in' ? 1 : -1;
  const d = round(distance);
  switch (preset) {
    case 'fade': return { transform: 'none', opacity: 0 };
    case 'slide-left': return { transform: `translateX(${s * d}px)`, opacity: base };
    case 'slide-right': return { transform: `translateX(${-s * d}px)`, opacity: base };
    case 'slide-up': return { transform: `translateY(${s * d}px)`, opacity: base };
    case 'slide-down': return { transform: `translateY(${-s * d}px)`, opacity: base };
    case 'scale-up': return { transform: phase === 'in' ? 'scale(0.5)' : 'scale(1.5)', opacity: base };
    case 'scale-down': return { transform: phase === 'in' ? 'scale(1.5)' : 'scale(0.5)', opacity: base };
    case 'zoom': return { transform: 'scale(0.2)', opacity: 0 };
    case 'rotate': return { transform: `rotate(${-s * 90}deg) scale(0.6)`, opacity: 0 };
    case 'blur': return { transform: 'none', opacity: 0, filter: 'blur(12px)' };
    case 'none': return { transform: 'none', opacity: base };
  }
}

function merge(stops: readonly Stop[]): Stop[] {
  const out: Stop[] = [];
  for (const s of stops) {
    const last = out[out.length - 1];
    if (last && last.pct === s.pct) out[out.length - 1] = { pct: s.pct, state: s.state, easing: s.easing ?? last.easing };
    else out.push(s);
  }
  return out;
}

/** @keyframes for one element over a loop of `loop` seconds, or null if it isn't animated. */
export function elementKeyframes(el: BannerElement, loop: number): string | null {
  const a = el.animation.in;
  const b = el.animation.out;
  const ain = isActive(a) ? a : null;
  const aout = isActive(b) ? b : null;
  if ((!ain && !aout) || !(loop > 0)) return null;

  const base = Math.min(1, Math.max(0, el.opacity));
  const rest: FrameState = { transform: 'none', opacity: base };
  const pct = (t: number): number => round(Math.min(100, Math.max(0, (t / loop) * 100)), 3);
  const stops: Stop[] = [];

  let inEnd = 0;
  if (ain) {
    const off = offState(ain.preset, 'in', ain.distance ?? DEFAULT_DISTANCE, base);
    const t0 = Math.max(0, ain.delay);
    inEnd = t0 + Math.max(0, ain.duration);
    stops.push({ pct: 0, state: off }, { pct: pct(t0), state: off, easing: safeEasing(ain.easing) }, { pct: pct(inEnd), state: rest });
  } else {
    stops.push({ pct: 0, state: rest });
  }
  if (aout) {
    const off = offState(aout.preset, 'out', aout.distance ?? DEFAULT_DISTANCE, base);
    const t0 = Math.max(inEnd, aout.delay);
    const t1 = t0 + Math.max(0, aout.duration);
    stops.push({ pct: pct(t0), state: rest, easing: safeEasing(aout.easing) }, { pct: pct(t1), state: off }, { pct: 100, state: off });
  } else {
    stops.push({ pct: 100, state: rest });
  }

  const frames = merge(stops);
  const withFilter = frames.some((f) => f.state.filter !== undefined);
  const body = frames
    .map((f) =>
      `${f.pct}%{${decls({
        transform: f.state.transform,
        opacity: round(f.state.opacity, 3),
        filter: withFilter ? (f.state.filter ?? 'none') : undefined,
        'animation-timing-function': f.easing,
      })}}`,
    )
    .join('');
  return `@keyframes ${keyframesName(el.id)}{${body}}`;
}

function collect(els: readonly BannerElement[], out: BannerElement[]): BannerElement[] {
  for (const el of els) {
    if (el.hidden) continue;
    out.push(el);
    if (el.type === 'group') collect(el.children, out);
  }
  return out;
}

export const cssKeyframesEngine: AnimationEngine = {
  id: 'css',
  label: 'CSS keyframes',
  externalScripts: [],
  globalCss: (size: Size) =>
    collect(size.elements, [])
      .map((el) => elementKeyframes(el, size.animationSettings.duration))
      .filter((c): c is string => c !== null)
      .join('\n'),
  elementDecls: (el: BannerElement, size: Size): Decls => {
    const loop = size.animationSettings.duration;
    if (!hasAnimation(el) || !(loop > 0)) return {};
    const plays = Math.max(1, Math.round(size.animationSettings.loops));
    return { animation: `${keyframesName(el.id)} ${round(loop, 3)}s linear 0s ${plays} both` };
  },
  runtime: () => '',
};
