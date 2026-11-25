import { emphasisSpan, isActive, outStart, stepEnd } from '@/model/animation';
import type { AnimationSettings, BannerElement, ID } from '@/model/types';

const EPS = 1e-6;

export interface Span { start: number; end: number; preset: string }
export interface TimelineRow { id: ID; name: string; locked: boolean; hidden: boolean; in: Span | null; emphasis: Span | null; out: Span | null }

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
    emphasis: emphasisSpan(el),
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

/** Snap grid for the bars and the playhead, in seconds. */
export const SNAP_STEP = 0.1;
/** Zoom levels of the timeline (1 = the whole loop fits). */
export const ZOOMS: readonly number[] = [1, 1.5, 2, 3, 4, 6, 8];
export const MAX_ZOOM = 8;
export const clampZoom = (z: number): number => Math.min(MAX_ZOOM, Math.max(1, Math.round(z * 100) / 100));
export const nextZoom = (z: number): number => ZOOMS.find((x) => x > z + EPS) ?? MAX_ZOOM;
export const prevZoom = (z: number): number => [...ZOOMS].reverse().find((x) => x < z - EPS) ?? 1;

const TICK_STEPS: readonly number[] = [0.1, 0.25, 0.5, 1, 2, 5, 10];

/** Ruler step: by loop length, or (when pixels per second are known) the finest step with about 44 px between labels. */
export function tickStep(loop: number, pps?: number): number {
  if (pps !== undefined && pps > 0) return TICK_STEPS.find((s) => s * pps >= 44) ?? 10;
  if (loop <= 2) return 0.25;
  if (loop <= 5) return 0.5;
  if (loop <= 15) return 1;
  if (loop <= 40) return 5;
  return 10;
}

export function rulerTicks(loop: number, pps?: number): number[] {
  const step = tickStep(loop, pps);
  const out: number[] = [];
  for (let i = 0; i * step <= loop + EPS; i++) out.push(Math.round(i * step * 100) / 100);
  return out;
}

/** Snaps to `step` seconds (0 = free, 0.01 s precision), never negative. */
export function snapTime(t: number, step: number = SNAP_STEP): number {
  const s = step > 0 ? step : 0.01;
  return Math.max(0, Math.round(Math.round(t / s) * s * 1000) / 1000);
}

/** Where to seek (ms) for loop time t, staying within the current play. */
export function seekMs(t: number, a: AnimationSettings, currentPlay: number): number {
  const loop = a.duration;
  const clamped = Math.min(Math.max(0, t), loop);
  const play = Math.min(Math.max(1, currentPlay), Math.max(1, Math.round(a.loops)));
  return Math.round(((play - 1) * loop + clamped) * 1000);
}
