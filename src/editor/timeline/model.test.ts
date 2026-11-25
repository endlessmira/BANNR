import { describe, expect, it } from 'vitest';
import { createText } from '@/model/factories';
import type { AnimationStep } from '@/model/types';
import { clampZoom, nextZoom, playheadPosition, prevZoom, rulerTicks, seekMs, snapTime, timelineRow } from './model';

const fade = (delay: number, duration: number): AnimationStep => ({ preset: 'fade', delay, duration, easing: 'ease-out' });
const a = { duration: 3, loops: 2 };

describe('timeline model', () => {
  it('turns animations into bars, with the exit after the entrance', () => {
    const el = createText({ name: 'H', animation: { in: fade(0.5, 1), out: fade(1, 0.5) } });
    expect(timelineRow(el)).toMatchObject({
      name: 'H', in: { start: 0.5, end: 1.5, preset: 'fade' }, out: { start: 1.5, end: 2, preset: 'fade' },
    });
    expect(timelineRow(createText()).in).toBeNull();
  });

  it('maps preview time to loop time and play number', () => {
    expect(playheadPosition(0, a)).toEqual({ t: 0, play: 1, done: false });
    expect(playheadPosition(4500, a)).toEqual({ t: 1.5, play: 2, done: false });
    expect(playheadPosition(9000, a)).toEqual({ t: 3, play: 2, done: true });
  });

  it('builds ruler ticks (finer when zoomed) and snaps to 0.1 s', () => {
    expect(rulerTicks(3)).toEqual([0, 0.5, 1, 1.5, 2, 2.5, 3]);
    expect(rulerTicks(15)).toHaveLength(16);
    expect(rulerTicks(2, 500)).toHaveLength(21);
    expect(rulerTicks(2, 500)).toContain(0.3);
    expect(snapTime(1.234)).toBe(1.2);
    expect(snapTime(1.26)).toBe(1.3);
    expect(snapTime(1.234, 0)).toBe(1.23);
    expect(snapTime(-2)).toBe(0);
  });

  it('seeks within the current play', () => {
    expect(seekMs(1.5, a, 2)).toBe(4500);
    expect(seekMs(10, a, 1)).toBe(3000);
    expect(seekMs(-1, a, 5)).toBe(3000);
  });

  it('steps through the zoom levels', () => {
    expect(nextZoom(1)).toBe(1.5);
    expect(nextZoom(8)).toBe(8);
    expect(prevZoom(1.5)).toBe(1);
    expect(prevZoom(1)).toBe(1);
    expect(prevZoom(5)).toBe(4);
    expect(clampZoom(20)).toBe(8);
    expect(clampZoom(0.5)).toBe(1);
  });
});
