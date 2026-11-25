import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MOUNT_JS, RUNTIME_JS } from '@/runtime/runtime';
import { listComponents } from '../registry';
import { defaultProps, missingSlots, resolveProps, resolveSlots } from '../settings';
import { carousel, offsetOf, placeUnit } from './index';

const ctx = { id: 'x', sel: '#x', width: 300, height: 250 };
const imgs = (n: number) => Array.from({ length: n }, (_, i) => ({ kind: 'image' as const, assetId: `a${i}` }));
const count = (html: string, s: string) => html.split(s).length - 1;

describe('carousel render', () => {
  it('is registered and needs at least two products', () => {
    expect(listComponents().map((d) => d.type)).toContain('carousel');
    expect(missingSlots(carousel, { items: imgs(1) })).toEqual(['Products']);
    expect(missingSlots(carousel, { items: imgs(2) })).toEqual([]);
  });

  it('classic: one slide per product, arrows and a dot per slide', () => {
    const slots = resolveSlots(carousel, { items: imgs(5) }, (id) => `images/${id}.png`);
    const html = carousel.render(defaultProps(carousel), slots, ctx).html;
    expect(count(html, 'class="bcc-i"')).toBe(5);
    expect(count(html, 'data-i="')).toBe(5);
    expect(html).toContain('data-nav="next"');
    expect(html).toContain('src="images/a0.png"');
    expect(html).toContain('style="transform:translateX(0%);opacity:1;z-index:1"');
  });

  it('double without loop has one dot per position; cube flow pairs products', () => {
    const p = resolveProps(carousel, { loop: false }, 'double');
    expect(count(carousel.render(p, resolveSlots(carousel, { items: imgs(4) }, (id) => id), ctx).html, 'data-i="')).toBe(3);
    const cf = carousel.render(resolveProps(carousel, {}, 'cubeflow'), resolveSlots(carousel, { items: imgs(5) }, (id) => id), ctx).html;
    expect(count(cf, 'class="bcc-i bcc-pair"')).toBe(3);
    expect(carousel.backupState(resolveProps(carousel, {}, 'cubeflow'), {}, ctx).html).toContain('transform:none');
  });

  it('double change and blur have a background layer per slide; card deck hides arrows', () => {
    expect(carousel.render(resolveProps(carousel, {}, 'change'), {}, ctx).html.match(/class="bc3-ph" style="background:[^"]*;opacity:/g)).toHaveLength(4);
    expect(carousel.render(resolveProps(carousel, {}, 'blur'), {}, ctx).html).toContain('class="bcc-bg bcc-blur"');
    expect(carousel.render(resolveProps(carousel, {}, 'deck'), {}, ctx).html).not.toContain('data-nav');
  });

  it('wraps offsets around when looping', () => {
    expect(offsetOf(3, 0, 4, true, 0)).toBe(-1);
    expect(offsetOf(3, 0, 4, false, 0)).toBe(3);
    expect(offsetOf(3, 0, 4, true, 1)).toBe(-1);
    expect(placeUnit('deck', 1, 150)).toEqual({ t: 'translate(6%,4%) scale(0.92)', op: 1, z: 90 });
  });
});

// ── Runtime against a minimal fake window/document ──
type Fn = (...a: unknown[]) => unknown;
function setup(style: string, props: Record<string, unknown>) {
  const n = 4;
  const units = Array.from({ length: n }, () => ({ style: {} as Record<string, string> }));
  const dots = Array.from({ length: n }, () => ({ classList: { add: vi.fn(), remove: vi.fn() } }));
  const root = {
    getAttribute: (k: string) => (k === 'data-style' ? style : k === 'data-d' ? '150' : null),
    querySelectorAll: (s: string) => (s === '.bcc-i' ? units : s === '.bcc-dot' ? dots : []),
    classList: { add: () => {}, remove: () => {} },
    addEventListener: () => {},
    removeEventListener: () => {},
  };
  const ls: Record<string, Fn[]> = {};
  const resolved = resolveProps(carousel, { autoAdvance: false, hint: false, ...props });
  const el = {
    style: {} as Record<string, string>,
    offsetWidth: 300,
    getAttribute: (k: string) => (k === 'data-component' ? 'carousel' : k === 'data-props' ? JSON.stringify(resolved) : null),
    querySelector: (s: string) => (s === '.bcc' ? root : null),
    addEventListener: (t: string, f: Fn) => { (ls[t] ??= []).push(f); },
    removeEventListener: () => {},
    setPointerCapture: () => {},
    fire: (t: string, e: object) => { for (const f of ls[t] ?? []) f(e); },
  };
  const bannr = { exit: vi.fn(), track: vi.fn() };
  const win = { bannr, matchMedia: () => ({ matches: false }), requestAnimationFrame: () => 0, cancelAnimationFrame: () => {}, addEventListener: () => {} };
  const doc = { hidden: false, readyState: 'complete', addEventListener: () => {}, querySelectorAll: () => [el] };
  (new Function('window', 'document', 'bannr', [RUNTIME_JS, carousel.runtime, MOUNT_JS].join('\n')) as Fn)(win, doc, bannr);
  vi.runAllTimers();
  return { el, units, dots, bannr };
}
const ev = (x: number, target: unknown) => ({ pointerId: 1, clientX: x, clientY: 0, target, cancelable: true, preventDefault: () => {} });
const plain = { closest: () => null };
const nextBtn = { closest: () => ({ getAttribute: (k: string) => (k === 'data-nav' ? 'next' : null) }) };

beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(0); });
afterEach(() => { vi.useRealTimers(); });

describe('carousel runtime', () => {
  it('a swipe moves to the next slide (same placement as the editor) without exiting', () => {
    const { el, units, dots, bannr } = setup('classic', {});
    expect(el.style.touchAction).toBe('pan-y');
    el.fire('pointerdown', ev(200, plain)); el.fire('pointermove', ev(0, plain)); el.fire('pointerup', ev(0, plain));
    expect(units[0]!.style.transform).toBe(placeUnit('classic', -1, 150).t);
    expect(units[1]!.style.transform).toBe('translateX(0%)');
    expect(dots[1]!.classList.add).toHaveBeenCalledWith('bcc-on');
    expect(bannr.track).toHaveBeenCalledWith('interaction_start');
    expect(bannr.track).toHaveBeenCalledWith('slide_change');
    expect(bannr.exit).not.toHaveBeenCalled();
  });

  it('a tap on an arrow changes the slide; a tap elsewhere exits', () => {
    const { el, units, bannr } = setup('classic', {});
    el.fire('pointerdown', ev(10, nextBtn)); el.fire('pointerup', ev(10, nextBtn));
    expect(units[0]!.style.transform).toBe('translateX(-100%)');
    expect(bannr.exit).not.toHaveBeenCalled();
    el.fire('pointerdown', ev(10, plain)); el.fire('pointerup', ev(10, plain));
    expect(bannr.exit).toHaveBeenCalledTimes(1);
  });

  it('card deck throws the top card away', () => {
    const { el, units } = setup('deck', {});
    el.fire('pointerdown', ev(200, plain)); el.fire('pointermove', ev(0, plain)); el.fire('pointerup', ev(0, plain));
    expect(units[0]!.style.transform).toBe(placeUnit('deck', -1, 150).t);
    expect(units[1]!.style.transform).toBe(placeUnit('deck', 0, 150).t);
  });
});
