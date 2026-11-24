import { describe, expect, it } from 'vitest';
import { createProject, createSize, createText } from '@/model/factories';
import type { AnimationStep, BannerElement, Easing } from '@/model/types';
import { renderBanner } from '@/renderer';
import { cssKeyframesEngine, elementKeyframes, safeEasing } from './cssKeyframes';

const step = (preset: AnimationStep['preset'], delay: number, duration: number, easing: Easing = 'ease-out'): AnimationStep =>
  ({ preset, delay, duration, easing });
const sizeWith = (els: BannerElement[]) => createSize(300, 250, { elements: els, animationSettings: { duration: 10, loops: 2 } });

describe('CSS keyframes engine', () => {
  it('ignores elements without animation', () => {
    const el = createText({ id: 'eA' });
    expect(elementKeyframes(el, 10)).toBeNull();
    expect(cssKeyframesEngine.elementDecls(el, sizeWith([el]))).toEqual({});
  });

  it('builds a fade-in over the loop with the easing on the moving segment', () => {
    const el = createText({ id: 'eA', animation: { in: step('fade', 1, 0.5), out: null } });
    expect(elementKeyframes(el, 10)).toBe(
      '@keyframes bk-eA{0%{transform:none;opacity:0}10%{transform:none;opacity:0;animation-timing-function:ease-out}' +
        '15%{transform:none;opacity:1}100%{transform:none;opacity:1}}',
    );
    expect(cssKeyframesEngine.elementDecls(el, sizeWith([el]))).toEqual({ animation: 'bk-eA 10s linear 0s 2 both' });
  });

  it('slides in from the far side and out to the near side', () => {
    const el = createText({ id: 'eA', animation: { in: step('slide-left', 0, 1), out: step('slide-left', 8, 1, 'ease-in') } });
    const css = elementKeyframes(el, 10)!;
    expect(css).toContain('0%{transform:translateX(50px);opacity:1;animation-timing-function:ease-out}');
    expect(css).toContain('80%{transform:none;opacity:1;animation-timing-function:ease-in}');
    expect(css).toContain('90%{transform:translateX(-50px);opacity:1}');
  });

  it('starts the exit only after the entrance ends', () => {
    const el = createText({ id: 'eA', animation: { in: step('fade', 0, 2), out: step('fade', 1, 1, 'ease-in') } });
    const css = elementKeyframes(el, 10)!;
    expect(css).toContain('20%{transform:none;opacity:1;animation-timing-function:ease-in}');
    expect(css).toContain('30%{transform:none;opacity:0}');
  });

  it('keeps the element opacity as the resting value and adds filters only for blur', () => {
    const el = createText({ id: 'eA', opacity: 0.5, animation: { in: step('blur', 0, 1), out: null } });
    const css = elementKeyframes(el, 10)!;
    expect(css).toContain('0%{transform:none;opacity:0;filter:blur(12px)');
    expect(css).toContain('10%{transform:none;opacity:0.5;filter:none}');
  });

  it('rejects unsafe easing values', () => {
    expect(safeEasing('ease-in')).toBe('ease-in');
    expect(safeEasing('cubic-bezier(0.34, 1.56, 0.64, 1)')).toBe('cubic-bezier(0.34,1.56,0.64,1)');
    expect(safeEasing('ease;}body{display:none')).toBe('ease');
  });

  it('is used by renderBanner and skips hidden elements', () => {
    const a = createText({ id: 'eA', animation: { in: step('zoom', 0, 1), out: null } });
    const h = createText({ id: 'eH', hidden: true, animation: { in: step('fade', 0, 1), out: null } });
    const size = sizeWith([a, h]);
    const p = createProject('A', { platform: 'cm360', sizes: [size] });
    const out = renderBanner(p, size.id, { resolveAsset: (id) => id, animationEngine: cssKeyframesEngine });
    expect(out.css).toContain('@keyframes bk-eA{');
    expect(out.css).toContain('animation:bk-eA 10s linear 0s 2 both');
    expect(out.css).not.toContain('bk-eH');
    expect(out.externalScripts).toEqual([]);
  });
});
