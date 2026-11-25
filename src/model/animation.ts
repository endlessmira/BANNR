import type {
  AnimationPreset, AnimationSettings, AnimationStep, BannerElement, EmphasisPreset, EmphasisStep, ProjectSettings,
} from './types';

export const DEFAULT_DISTANCE = 50;
export const DEFAULT_STEP_SECONDS = 0.5;
const EPS = 1e-9;
const r2 = (n: number): number => Math.round(n * 100) / 100;

/** Slide presets name the direction of movement: "slide-left" enters from the right and exits to the left. */
export const ANIMATION_PRESETS: ReadonlyArray<readonly [AnimationPreset, string]> = [
  ['none', 'None'], ['fade', 'Fade'],
  ['slide-left', 'Slide left ←'], ['slide-right', 'Slide right →'], ['slide-up', 'Slide up ↑'], ['slide-down', 'Slide down ↓'],
  ['scale-up', 'Grow'], ['scale-down', 'Shrink'], ['zoom', 'Zoom'], ['rotate', 'Spin'], ['blur', 'Blur'],
];

/** Emphasis (attention) effects, played between the entrance and the exit. */
export const EMPHASIS_PRESETS: ReadonlyArray<readonly [EmphasisPreset, string]> = [
  ['none', 'None'], ['pulse', 'Pulse'], ['bounce', 'Vertical bounce'], ['wiggle', 'Wiggle'], ['flash', 'Flash'],
];

export interface EmphasisAmount { label: string; suffix: string; min: number; max: number; default: number }
const AMOUNTS: Partial<Record<EmphasisPreset, EmphasisAmount>> = {
  pulse: { label: 'Size', suffix: '%', min: 1, max: 50, default: 8 },
  bounce: { label: 'Height', suffix: 'px', min: 1, max: 200, default: 12 },
  wiggle: { label: 'Angle', suffix: '°', min: 1, max: 45, default: 6 },
};
/** The effect's strength setting (none for Flash). */
export const emphasisAmount = (p: EmphasisPreset): EmphasisAmount | undefined => AMOUNTS[p];

export const isSlide = (p: AnimationPreset): boolean => p.startsWith('slide-');
export const isActive = (s: AnimationStep | null | undefined): s is AnimationStep => !!s && s.preset !== 'none';
export const isEmphasis = (s: EmphasisStep | null | undefined): s is EmphasisStep => !!s && s.preset !== 'none';
export const stepEnd = (s: AnimationStep | null | undefined): number =>
  isActive(s) ? Math.max(0, s.delay) + Math.max(0, s.duration) : 0;
export const hasAnimation = (el: BannerElement): boolean =>
  isActive(el.animation.in) || isActive(el.animation.out) || isEmphasis(el.animation.emphasis);
export const totalSeconds = (a: AnimationSettings): number => a.duration * a.loops;

export interface EmphasisSpan { start: number; end: number; preset: EmphasisPreset }

/** When the emphasis plays: it waits for the entrance to finish. */
export function emphasisSpan(el: BannerElement): EmphasisSpan | null {
  const e = el.animation.emphasis;
  if (!isEmphasis(e)) return null;
  const start = Math.max(0, e.delay, stepEnd(el.animation.in));
  return { start, end: start + Math.max(0.05, e.duration), preset: e.preset };
}
const emphasisEnd = (el: BannerElement): number => emphasisSpan(el)?.end ?? 0;

/** Time (s) when the last animation of the visible elements ends, including group children. */
export function animationEnd(elements: readonly BannerElement[]): number {
  let m = 0;
  for (const el of elements) {
    if (el.hidden) continue;
    m = Math.max(m, stepEnd(el.animation.in), emphasisEnd(el), outEnd(el));
    if (el.type === 'group') m = Math.max(m, animationEnd(el.children));
  }
  return m;
}

/** The exit never starts before the entrance and the emphasis end (the engine waits). */
export function outStart(el: BannerElement): number {
  const o = el.animation.out;
  return isActive(o) ? Math.max(o.delay, stepEnd(el.animation.in), emphasisEnd(el)) : 0;
}
const outEnd = (el: BannerElement): number => {
  const o = el.animation.out;
  return isActive(o) ? outStart(el) + Math.max(0, o.duration) : 0;
};

export function defaultStep(phase: 'in' | 'out', preset: AnimationPreset, loop: number): AnimationStep {
  return {
    preset,
    delay: phase === 'in' ? 0 : r2(Math.max(0, loop - DEFAULT_STEP_SECONDS)),
    duration: DEFAULT_STEP_SECONDS,
    easing: phase === 'in' ? 'ease-out' : 'ease-in',
    ...(isSlide(preset) ? { distance: DEFAULT_DISTANCE } : {}),
  };
}

/** A new emphasis: after the entrance (or at 1 s), 0.6 s long, played twice. */
export function defaultEmphasis(preset: EmphasisPreset, el: BannerElement): EmphasisStep {
  const a = emphasisAmount(preset);
  return {
    preset,
    delay: r2(Math.max(1, stepEnd(el.animation.in))),
    duration: 1.2,
    repeat: 2,
    easing: 'ease-in-out',
    ...(a ? { amount: a.default } : {}),
  };
}

/** Loop length that fits every animation plus a 1 s hold on the last frame. */
export const fitLoop = (elements: readonly BannerElement[]): number =>
  Math.max(1, Math.ceil((animationEnd(elements) + 1) * 10 - EPS) / 10);

export function loopIssues(a: AnimationSettings, s: ProjectSettings, elements: readonly BannerElement[]): string[] {
  const out: string[] = [];
  const total = totalSeconds(a);
  if (total > s.maxAnimationSeconds + EPS) {
    out.push(`Total animation time is ${r2(total)} s, over the ${s.maxAnimationSeconds} s limit. The export check will flag this.`);
  }
  if (a.loops > s.maxLoops) out.push(`${a.loops} plays is over the limit of ${s.maxLoops}.`);
  const end = animationEnd(elements);
  if (end > a.duration + EPS) {
    out.push(`Some animations end at ${r2(end)} s, after the ${r2(a.duration)} s loop, so they get cut off.`);
  }
  return out;
}

export function elementIssues(el: BannerElement, loop: number): string[] {
  const out: string[] = [];
  const i = el.animation.in;
  const o = el.animation.out;
  const em = emphasisSpan(el);
  if (isActive(i) && stepEnd(i) > loop + EPS) out.push(`The entrance ends at ${r2(stepEnd(i))} s, after the ${r2(loop)} s loop.`);
  if (em && em.end > loop + EPS) out.push(`The emphasis ends at ${r2(em.end)} s, after the ${r2(loop)} s loop.`);
  if (isActive(o)) {
    if (isActive(i) && o.delay < stepEnd(i) - EPS) {
      out.push('The exit is set to start before the entrance ends, so it waits until the entrance finishes.');
    } else if (em && o.delay < em.end - EPS) {
      out.push('The exit is set to start before the emphasis ends, so it waits until the emphasis finishes.');
    }
    if (outEnd(el) > loop + EPS) out.push(`The exit ends at ${r2(outEnd(el))} s, after the ${r2(loop)} s loop.`);
  }
  return out;
}
