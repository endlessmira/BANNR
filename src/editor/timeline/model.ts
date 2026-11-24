import { isActive, outStart, stepEnd } from '@/model/animation';
import type { AnimationPreset, AnimationSettings, BannerElement, ID } from '@/model/types';

const EPS = 1e-6;

export interface Span { start: number; end: number; preset: AnimationPreset }
export interface TimelineRow { id: ID; name: string; locked: boolean; hidden: boolean; in: Span | null; out: Span | null }

/** Entrance and exit bars for one layer. The exit starts no earlier than the end of the entrance. */
export function timelineRow(el: BannerElement): TimelineRow {
  const i = el.animation.in;
  const o = el.animation.out;
  const os = outStart(el);
  return {
    id: el.id,
    name: el.name,
    locked: el.locked,
    hidden: el.hidden,
    in: isActive(i) ? { start: Math.max(0, i.delay), end: stepEnd(i), preset: i.preset } : null,
    out: isActive(o) ? { start: os, end: os + Math.max(0, o.duration), preset: o.preset } : null,
  };
}

export interface PlayheadPos { t: number; play: number; done: boolean }

/** Preview time (ms since start, across all plays) to position within the loop and play number. */
export function playheadPosition(ms: number, a: AnimationSettings): PlayheadPos {
  const loop = a.duration;
  const plays = Math.max(1, Math.round(a.loops));
  if (!(loop > 0)) return { t: 0, play: 1, done: false };
  const s = Math.max(0, ms / 1000);
  if (s >= loop * plays - EPS) return { t: loop, play: plays, done: true };
  return { t: s % loop, play: Math.floor(s / loop) + 1, done: false };
}

export function tickStep(loop: number): number {
  if (loop <= 2) return 0.25;
  if (loop <= 5) return 0.5;
  if (loop <= 15) return 1;
  if (loop <= 40) return 5;
  return 10;
}

export function rulerTicks(loop: number): number[] {
  const step = tickStep(loop);
  const out: number[] = [];
  for (let i = 0; i * step <= loop + EPS; i++) out.push(Math.round(i * step * 100) / 100);
  return out;
}

/** Snaps to 0.05 s steps, never negative. */
export const snapTime = (t: number): number => Math.max(0, Math.round(t * 20) / 20);

/** Where to seek (ms) for loop time t, staying within the current play. */
export function seekMs(t: number, a: AnimationSettings, currentPlay: number): number {
  const loop = a.duration;
  const clamped = Math.min(Math.max(0, t), loop);
  const play = Math.min(Math.max(1, currentPlay), Math.max(1, Math.round(a.loops)));
  return Math.round(((play - 1) * loop + clamped) * 1000);
}
