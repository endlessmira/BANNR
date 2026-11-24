import { describe, expect, it } from 'vitest';
import { animationEnd, defaultStep, elementIssues, fitLoop, loopIssues } from './animation';
import { DEFAULT_SETTINGS, createGroup, createText } from './factories';
import type { AnimationStep } from './types';

const fade = (delay: number, duration: number): AnimationStep => ({ preset: 'fade', delay, duration, easing: 'ease-out' });

describe('animation helpers', () => {
  it('creates sensible default steps', () => {
    expect(defaultStep('in', 'fade', 15)).toEqual({ preset: 'fade', delay: 0, duration: 0.5, easing: 'ease-out' });
    expect(defaultStep('out', 'slide-left', 15)).toEqual({ preset: 'slide-left', delay: 14.5, duration: 0.5, easing: 'ease-in', distance: 50 });
  });

  it('finds the end of all visible animations, including group children', () => {
    const a = createText({ animation: { in: fade(0, 1), out: null } });
    const hidden = createText({ hidden: true, animation: { in: fade(0, 9), out: null } });
    const child = createText({ animation: { in: fade(2, 1.5), out: null } });
    expect(animationEnd([a, hidden, createGroup([child])])).toBe(3.5);
    expect(fitLoop([a, createGroup([child])])).toBe(4.5);
  });

  it('counts the exit from the end of the entrance when they overlap', () => {
    const el = createText({ animation: { in: fade(0, 2), out: fade(1, 1) } });
    expect(animationEnd([el])).toBe(3);
    expect(elementIssues(el, 10)).toEqual(['The exit is set to start before the entrance ends, so it waits until the entrance finishes.']);
  });

  it('reports loop limits and cut-off animations', () => {
    const el = createText({ animation: { in: fade(0, 12), out: null } });
    const issues = loopIssues({ duration: 10, loops: 4 }, DEFAULT_SETTINGS, [el]);
    expect(issues).toHaveLength(3);
    expect(issues[0]).toContain('40 s, over the 30 s limit');
    expect(loopIssues({ duration: 15, loops: 2 }, DEFAULT_SETTINGS, [])).toEqual([]);
  });
});
