import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MOUNT_JS, RUNTIME_JS } from '@/runtime/runtime';
import { dragdrop, ddLayout } from './dragdrop';
import { listComponents } from './registry';
import { defaultProps, missingSlots, resolveProps, resolveSlots, schemaIssues } from './settings';
import { slice } from './slice';

const ctx = { id: 'x', sel: '#x', width: 300, height: 300 };
const count = (html: string, s: string) => html.split(s).length - 1;
const imgs = (n: number) => Array.from({ length: n }, (_, i) => ({ kind: 'image' as const, assetId: `a${i}` }));

describe('slice render', () => {
  it('is registered with templates, preview items and a skip button', () => {
    expect(listComponents().map((d) => d.type)).toEqual(expect.arrayContaining(['slice', 'dragdrop']));
    expect(schemaIssues(slice)).toEqual([]);
    expect(missingSlots(slice, {})).toEqual(['Products (to slice)']);
    const html = slice.render(defaultProps(slice), resolveSlots(slice, { good: imgs(2), bad: imgs(1) }, (id) => id), ctx).html;
    expect([count(html, 'data-good="1"'), count(html, 'data-good="0"'), count(html, 'data-skip="')]).toEqual([2, 1, 1]);
    expect(count(html, 'bsl-it bsl-slashed')).toBe(1);
    expect(slice.render(defaultProps(slice), {}, ctx).css).toContain('#x .bsl-stage{--trail:#ffffff}');
  });
});

describe('drag and drop render', () => {
  it('lays out products and the target for square and wide sizes', () => {
    expect(schemaIssues(dragdrop)).toEqual([]);
    expect(missingSlots(dragdrop, {})).toEqual(['Products (to drag)']);
    const sq = ddLayout(3, 300, 300, 22, 40);
    expect(sq.target).toEqual({ x: 90, y: 140, s: 120 });
    expect(sq.items[0]).toEqual({ x: 31.5, y: 36, s: 66 });
    const wide = ddLayout(3, 970, 250, 22, 40);
    expect(wide.target).toEqual({ x: 854, y: 75, s: 100 });
    expect(wide.items.every((b) => b.y === 97.5)).toBe(true);
  });

  it('renders an item per product and a labelled target, or the target image', () => {
    const html = dragdrop.render(defaultProps(dragdrop), {}, ctx).html;
    expect([count(html, 'data-it="'), count(html, 'data-target="')]).toEqual([3, 1]);
    expect(html).toContain('<span>Drop here</span>');
    const slots = resolveSlots(dragdrop, { items: imgs(5), target: imgs(1) }, (id) => `images/${id}.png`);
    const full = dragdrop.render(defaultProps(dragdrop), slots, ctx).html;
    expect(count(full, 'data-it="')).toBe(5);
    expect(full).toContain('class="bdd-tg bdd-tg-img"');
  });
});

// ── Runtimes against a minimal fake window/document ──
type Fn = (...a: unknown[]) => unknown;
function cls() {
  const set = new Set<string>();
  return { set, add: vi.fn((c: string) => { set.add(c); }), remove: (c: string) => { set.delete(c); }, contains: (c: string) => set.has(c) };
}
function shell() {
  const screens = ['start', 'win', 'lose'].map((k) => ({ k, classList: cls(), getAttribute: () => k }));
  const score = { textContent: '' };
  const root = {
    classList: cls(),
    querySelectorAll: () => screens,
    querySelector: (s: string) => (s === '[data-hud="score"]' ? score : s === '[data-hud="time"]' ? { textContent: '' } : null),
    addEventListener: () => {},
    removeEventListener: () => {},
  };
  return { screens, score, root };
}
function host(type: string, props: object, one: (s: string) => unknown, all: (s: string) => unknown[]) {
  const ls: Record<string, Fn[]> = {};
  return {
    style: {} as Record<string, string>,
    offsetWidth: 300,
    offsetHeight: 300,
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 300, height: 300 }),
    getAttribute: (k: string) => (k === 'data-component' ? type : k === 'data-props' ? JSON.stringify(props) : null),
    querySelector: one,
    querySelectorAll: all,
    addEventListener: (t: string, f: Fn) => { (ls[t] ??= []).push(f); },
    removeEventListener: () => {},
    setPointerCapture: () => {},
    fire: (t: string, e: object) => { for (const f of ls[t] ?? []) f(e); },
  };
}
function run(el: unknown, runtime: string) {
  const frames: Array<(t: number) => void> = [];
  const bannr = { exit: vi.fn(), track: vi.fn() };
  const win = {
    bannr, matchMedia: () => ({ matches: false }),
    requestAnimationFrame: (f: (t: number) => void) => frames.push(f), cancelAnimationFrame: () => {}, addEventListener: () => {},
  };
  const doc = { hidden: false, readyState: 'complete', addEventListener: () => {}, querySelectorAll: () => [el] };
  (new Function('window', 'document', 'bannr', [RUNTIME_JS, runtime, MOUNT_JS].join('\n')) as Fn)(win, doc, bannr);
  vi.runAllTimers();
  let now = 0;
  const tick = (n: number) => { for (let i = 0; i < n && frames.length > 0; i++) frames.shift()!((now += 64)); };
  return { bannr, tick };
}
const ptr = (x: number, y: number, target: unknown) => ({ pointerId: 1, clientX: x, clientY: y, target, cancelable: true, preventDefault: () => {} });
const plain = { closest: () => null };
const playBtn = { closest: () => ({ getAttribute: (k: string) => (k === 'data-play' ? '1' : null) }) };

beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(0); });
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

describe('slice runtime', () => {
  it('a swipe across a flying product slices it and wins; page scrolling is paused only while playing', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const sh = shell();
    const kids: Array<{ style: Record<string, string>; classList: ReturnType<typeof cls> }> = [];
    const fly = {
      appendChild: (c: (typeof kids)[number]) => { kids.push(c); },
      removeChild: (c: (typeof kids)[number]) => { kids.splice(kids.indexOf(c), 1); },
    };
    const tpl = { getAttribute: (k: string) => (k === 'data-good' ? '1' : null), cloneNode: () => ({ style: {}, classList: cls() }) };
    const el = host('slice', resolveProps(slice, { scoreGoal: 1, hint: false }),
      (s) => (s === '.bgm' ? sh.root : s === '.bsl-fly' ? fly : null),
      (s) => (s === '.bsl-tpl .bsl-it' ? [tpl] : []));
    const env = run(el, slice.runtime);
    expect(el.style.touchAction).toBe('pan-y');

    el.fire('pointerdown', ptr(0, 0, playBtn)); el.fire('pointerup', ptr(0, 0, playBtn));
    expect(el.style.touchAction).toBe('none');
    env.tick(3);
    expect(kids).toHaveLength(1);
    const y = Number.parseFloat(kids[0]!.style.top!) + 27;
    el.fire('pointerdown', ptr(0, y, plain)); el.fire('pointermove', ptr(300, y, plain)); el.fire('pointerup', ptr(300, y, plain));
    expect(kids[0]!.classList.add).toHaveBeenCalledWith('bsl-cut');
    expect(env.bannr.track).toHaveBeenCalledWith('slice');
    expect(env.bannr.track).toHaveBeenCalledWith('game_won');
    expect(sh.score.textContent).toBe('1/1');
    expect(el.style.touchAction).toBe('pan-y');
    expect(env.bannr.exit).not.toHaveBeenCalled();
  });
});

describe('drag and drop runtime', () => {
  function setup(props: object = {}) {
    const sh = shell();
    const item = {
      style: {} as Record<string, string>,
      classList: cls(),
      getAttribute: (k: string) => (k === 'data-it' ? '0' : null),
      getBoundingClientRect: () => ({ left: 0, top: 0, width: 50, height: 50 }),
      closest: (s: string): unknown => (s === '[data-it]' ? item : null),
    };
    const target = { classList: cls(), getBoundingClientRect: () => ({ left: 200, top: 200, width: 80, height: 80 }) };
    const el = host('dragdrop', resolveProps(dragdrop, { hint: false, ...props }),
      (s) => (s === '.bgm' ? sh.root : s === '[data-target]' ? target : null),
      (s) => (s === '[data-it]' ? [item] : []));
    const env = run(el, dragdrop.runtime);
    el.fire('pointerdown', ptr(0, 0, playBtn)); el.fire('pointerup', ptr(0, 0, playBtn));
    return { sh, item, target, el, ...env };
  }

  it('dropping a product on the target counts it and wins', () => {
    const d = setup();
    expect(d.el.style.touchAction).toBe('none');
    d.el.fire('pointerdown', ptr(25, 25, d.item)); d.el.fire('pointermove', ptr(240, 240, d.item)); d.el.fire('pointerup', ptr(240, 240, d.item));
    expect(d.item.style.transform).toBe('translate(215px,215px) scale(0.2)');
    expect(d.item.style.opacity).toBe('0');
    expect(d.target.classList.add).toHaveBeenCalledWith('bdd-pop');
    expect(d.bannr.track).toHaveBeenCalledWith('drop');
    expect(d.bannr.track).toHaveBeenCalledWith('game_won');
    expect(d.sh.score.textContent).toBe('1/1');
    expect(d.bannr.exit).not.toHaveBeenCalled();
  });

  it('a drop outside the target springs back', () => {
    const d = setup();
    d.el.fire('pointerdown', ptr(25, 25, d.item)); d.el.fire('pointermove', ptr(45, 45, d.item)); d.el.fire('pointerup', ptr(45, 45, d.item));
    expect(d.item.style.transform).toBe('');
    expect(d.bannr.track).toHaveBeenCalledWith('drop_miss');
    expect(d.bannr.track).not.toHaveBeenCalledWith('game_won');
  });
});
