import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createComponent, createProject, createSize } from '@/model/factories';
import { renderBanner } from '@/renderer';
import { collectFontFamilies } from '@/renderer/fonts';
import { MOUNT_JS, RUNTIME_JS } from '@/runtime/runtime';
import { componentChecks } from '@/validation/components';
import { listComponents } from '../registry';
import { defaultProps, resolveProps, schemaIssues } from '../settings';
import type { ResolvedItem, ResolvedProps } from '../types';
import { carouselset, layerBox } from './index';

const ctx = { id: 'x', sel: '#x', width: 300, height: 250 };
const count = (html: string, s: string) => html.split(s).length - 1;
const slidesOf = (p: ResolvedProps) => p.slides as ResolvedItem[];
const layersOf = (s: ResolvedItem) => s.layers as ResolvedItem[];

describe('carousel set settings', () => {
  it('is registered with a valid schema and three sample slides of two layers', () => {
    expect(listComponents().map((d) => d.type)).toContain('carouselset');
    expect(schemaIssues(carouselset)).toEqual([]);
    const p = defaultProps(carouselset);
    expect(slidesOf(p)).toHaveLength(3);
    expect(layersOf(slidesOf(p)[0]!)).toHaveLength(2);
    expect(layersOf(slidesOf(p)[0]!)[1]).toMatchObject({ kind: 'text', text: 'Headline 1', effect: 'slide-up', fontFamily: 'Arial' });
  });

  it('limits slides to 2–6 and layers to 4, filling in every setting', () => {
    const many = Array.from({ length: 9 }, () => ({ layers: Array.from({ length: 7 }, () => ({ kind: 'text' })) }));
    const p = resolveProps(carouselset, { slides: many });
    expect(slidesOf(p)).toHaveLength(6);
    expect(layersOf(slidesOf(p)[0]!)).toHaveLength(4);
    expect(layersOf(slidesOf(p)[0]!)[0]).toMatchObject({ kind: 'text', effect: 'fade', place: 'center', duration: 0.5 });
    expect(slidesOf(resolveProps(carouselset, { slides: [] }))).toHaveLength(2);
  });

  it('places layers from the quick positions', () => {
    expect(layerBox({ place: 'fill' })).toEqual([0, 0, 100, 100]);
    expect(layerBox({ place: 'center', w: 50, h: 20 })).toEqual([25, 40, 50, 20]);
    expect(layerBox({ place: 'bottom', w: 50, h: 20 })).toEqual([25, 75, 50, 20]);
    expect(layerBox({ place: 'right', w: 50, h: 20 })).toEqual([45, 40, 50, 20]);
    expect(layerBox({ place: 'custom', x: 10, y: 5, w: 50, h: 20 })).toEqual([10, 5, 50, 20]);
  });
});

describe('carousel set render', () => {
  it('renders every slide and layer, the chosen slide in the editor, slide 1 in the backup', () => {
    const p = defaultProps(carouselset);
    const html = carouselset.render(p, {}, ctx).html;
    expect(count(html, 'data-s="')).toBe(3);
    expect(count(html, 'data-fx="')).toBe(6);
    expect(count(html, 'data-i="')).toBe(3);
    expect(html).toContain('class="bcs-s bcs-on" data-s="0"');
    expect(html).toContain('Headline 2');
    expect(carouselset.render(resolveProps(carouselset, { editSlide: 2 }), {}, ctx).html).toContain('class="bcs-s bcs-on" data-s="1"');
    const backup = carouselset.backupState(resolveProps(carouselset, { editSlide: 3 }), {}, ctx).html;
    expect(backup).toContain('class="bcs bcs-still"');
    expect(backup).toContain('class="bcs-s bcs-on" data-s="0"');
  });

  it('uses uploaded images (counted as used assets) and embeds text-layer fonts', () => {
    const el = createComponent({
      componentType: 'carouselset', width: 300, height: 250,
      props: { slides: [{ layers: [{ kind: 'image', image: 'a1' }, { kind: 'text', text: 'Hello', fontFamily: 'Brand' }] }, { layers: [] }] },
    });
    const size = createSize(300, 250, { elements: [el] });
    const out = renderBanner(createProject('S', { platform: 'cm360', sizes: [size] }), size.id, { resolveAsset: (id) => `images/${id}.png` });
    expect(out.usedAssetIds).toContain('a1');
    expect(out.html).toContain('src="images/a1.png"');
    expect(out.html).toContain('<span>Hello</span>');
    expect(collectFontFamilies([el]).has('Brand')).toBe(true);
  });

  it('blocks export while an image layer has no image', () => {
    const empty = componentChecks(createSize(300, 250, { elements: [createComponent({ componentType: 'carouselset', width: 300, height: 250 })] }));
    expect(empty.filter((r) => r.ruleId === 'carouselset-image')).toHaveLength(3);
    const filled = slidesOf(defaultProps(carouselset)).map((s) => ({
      ...s, layers: layersOf(s).map((l) => (l.kind === 'image' ? { ...l, image: 'a1' } : l)),
    }));
    const ok = componentChecks(createSize(300, 250, {
      elements: [createComponent({ componentType: 'carouselset', width: 300, height: 250, props: { slides: filled } })],
    }));
    expect(ok.filter((r) => r.level === 'error')).toEqual([]);
  });
});

// ── Runtime against a minimal fake window/document ──
type Fn = (...a: unknown[]) => unknown;
function cls() {
  const set = new Set<string>();
  return { set, add: (c: string) => { set.add(c); }, remove: (c: string) => { set.delete(c); } };
}
function setup() {
  const slides = Array.from({ length: 3 }, () => ({ style: {} as Record<string, string>, classList: cls() }));
  const dots = Array.from({ length: 3 }, () => ({ classList: cls() }));
  const root = {
    offsetWidth: 300,
    getAttribute: (k: string) => (k === 'data-tr' ? 'slide' : k === 'data-d' ? '150' : null),
    querySelectorAll: (s: string) => (s === '.bcs-s' ? slides : s === '.bcs-dot' ? dots : []),
    classList: cls(),
    addEventListener: () => {},
    removeEventListener: () => {},
  };
  const props = resolveProps(carouselset, { autoAdvance: false, hint: false });
  const ls: Record<string, Fn[]> = {};
  const el = {
    style: {} as Record<string, string>,
    offsetWidth: 300,
    getAttribute: (k: string) => (k === 'data-component' ? 'carouselset' : k === 'data-props' ? JSON.stringify(props) : null),
    querySelector: (s: string) => (s === '.bcs' ? root : null),
    addEventListener: (t: string, f: Fn) => { (ls[t] ??= []).push(f); },
    removeEventListener: () => {},
    setPointerCapture: () => {},
    fire: (t: string, e: object) => { for (const f of ls[t] ?? []) f(e); },
  };
  const bannr = { exit: vi.fn(), track: vi.fn() };
  const win = { bannr, matchMedia: () => ({ matches: false }), requestAnimationFrame: () => 0, cancelAnimationFrame: () => {}, addEventListener: () => {} };
  const doc = { hidden: false, readyState: 'complete', addEventListener: () => {}, querySelectorAll: () => [el] };
  (new Function('window', 'document', 'bannr', [RUNTIME_JS, carouselset.runtime, MOUNT_JS].join('\n')) as Fn)(win, doc, bannr);
  vi.runAllTimers();
  const on = (i: number) => slides[i]!.classList.set.has('bcs-on');
  return { el, slides, on, bannr };
}
const ev = (x: number, target: unknown) => ({ pointerId: 1, clientX: x, clientY: 0, target, cancelable: true, preventDefault: () => {} });
const plain = { closest: () => null };
const nextBtn = { closest: () => ({ getAttribute: (k: string) => (k === 'data-nav' ? 'next' : null) }) };

beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(0); });
afterEach(() => { vi.useRealTimers(); });

describe('carousel set runtime', () => {
  it('starts at slide 1; a swipe moves on and restarts the layer entrances, without exiting', () => {
    const { el, slides, on, bannr } = setup();
    expect(el.style.touchAction).toBe('pan-y');
    expect(on(0)).toBe(true);
    el.fire('pointerdown', ev(200, plain)); el.fire('pointermove', ev(0, plain)); el.fire('pointerup', ev(0, plain));
    expect(on(1)).toBe(true);
    expect(on(0)).toBe(false);
    expect(slides[0]!.style.transform).toBe('translateX(-100%)');
    expect(slides[1]!.style.transform).toBe('translateX(0%)');
    expect(bannr.track).toHaveBeenCalledWith('slide_change');
    expect(bannr.exit).not.toHaveBeenCalled();
  });

  it('arrows change slides, completion is reported once all are seen, a tap elsewhere exits', () => {
    const { el, on, bannr } = setup();
    el.fire('pointerdown', ev(10, nextBtn)); el.fire('pointerup', ev(10, nextBtn));
    el.fire('pointerdown', ev(10, nextBtn)); el.fire('pointerup', ev(10, nextBtn));
    expect(on(2)).toBe(true);
    expect(bannr.track).toHaveBeenCalledWith('carousel_complete');
    expect(bannr.exit).not.toHaveBeenCalled();
    el.fire('pointerdown', ev(10, plain)); el.fire('pointerup', ev(10, plain));
    expect(bannr.exit).toHaveBeenCalledTimes(1);
  });
});
