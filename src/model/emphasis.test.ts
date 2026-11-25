import { describe, expect, it } from 'vitest';
import { cssKeyframesEngine, elementKeyframes } from '@/renderer/animation/cssKeyframes';
import { animationEnd, elementIssues, emphasisSpan, outStart } from './animation';
import { createSize, createText } from './factories';
import type { AnimationStep, EmphasisStep } from './types';

const fade = (delay: number, duration: number, easing: AnimationStep['easing'] = 'ease-out'): AnimationStep =>
  ({ preset: 'fade', delay, duration, easing });
const emph = (preset: EmphasisStep['preset'], delay: number, duration: number, repeat: number): EmphasisStep =>
  ({ preset, delay, duration, repeat });

describe('emphasis animations', () => {
  it('Length is the total time; it plays after the entrance and the exit waits for it', () => {
    const el = createText({ animation: { in: fade(0, 1), emphasis: emph('wiggle', 0, 1, 3), out: fade(1, 0.5, 'ease-in') } });
    expect(emphasisSpan(el)).toEqual({ start: 1, end: 2, preset: 'wiggle' });
    expect(outStart(el)).toBe(2);
    expect(animationEnd([el])).toBe(2.5);
    expect(elementIssues(el, 1.8)).toContain('The emphasis ends at 2 s, past the end of the 1.8 s animation.');
  });

  it('one pulse in 1 s', () => {
    const el = createText({ id: 'eA', animation: { in: null, out: null, emphasis: emph('pulse', 1, 1, 1) } });
    const css = elementKeyframes(el, 10)!;
    expect(css).toContain('10%{transform:none;opacity:1;animation-timing-function:ease-in-out}');
    expect(css).toContain('15%{transform:scale(1.08);opacity:1;animation-timing-function:ease-in-out}');
    expect(css).toContain('20%{transform:none;opacity:1;animation-timing-function:ease-in-out}');
    const size = createSize(300, 250, { elements: [el], animationSettings: { duration: 10, loops: 1 } });
    expect(cssKeyframesEngine.elementDecls(el, size)).toEqual({ animation: 'bk-eA 10s linear 0s 1 both' });
  });

  it('three pulses in 1 s, with the chosen easing', () => {
    const css = elementKeyframes(createText({ animation: { in: null, out: null, emphasis: { ...emph('pulse', 0, 1, 3), easing: 'linear' } } }), 10)!;
    expect(css).toContain('1.667%{transform:scale(1.08)');
    expect(css).toContain('5%{transform:scale(1.08)');
    expect(css).toContain('8.333%{transform:scale(1.08)');
    expect(css).toContain('10%{transform:none;opacity:1;animation-timing-function:linear}');
    expect(css).not.toContain('ease-in-out');
  });

  it('bounce, flash and wiggle; the exit starts when the emphasis Length is over', () => {
    const b = elementKeyframes(createText({ animation: { in: null, out: null, emphasis: { ...emph('bounce', 0, 1, 1), amount: 20 } } }), 10)!;
    expect(b).toContain('transform:translateY(-20px)');
    expect(b).toContain('transform:translateY(-8px)');
    const f = elementKeyframes(createText({ animation: { in: null, out: null, emphasis: emph('flash', 0, 1, 1) } }), 10)!;
    expect(f).toContain('2.5%{transform:none;opacity:0;');
    const w = elementKeyframes(createText({ animation: { in: fade(0, 1), emphasis: emph('wiggle', 0, 1, 2), out: fade(1, 0.5, 'ease-in') } }), 10)!;
    expect(w).toContain('rotate(6deg)');
    expect(w).toContain('20%{transform:none;opacity:1;animation-timing-function:ease-in}');
  });
});
