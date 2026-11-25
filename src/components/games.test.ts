import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MOUNT_JS, RUNTIME_JS } from '@/runtime/runtime';
import { catchGame } from './catch';
import { memory, memoryGrid } from './memory';
import { listComponents } from './registry';
import { defaultProps, missingSlots, resolveProps, resolveSlots, schemaIssues } from './settings';

const ctx = { id: 'x', sel: '#x', width: 300, height: 300 };
const count = (html: string, s: string) => html.split(s).length - 1;
const imgs = (n: number) => Array.from({ length: n }, (_, i) => ({ kind: 'image' as const, assetId: `a${i}` }));

describe('game render', () => {
  it('both games are registered with valid schemas and required slots', () => {
    expect(listComponents().map((d) => d.type)).toEqual(expect.arrayContaining(['memory', 'catch']));
    expect(schemaIssues(memory)).toEqual([]);
    expect(schemaIssues(catchGame)).toEqual([]);
    expect(missingSlots(memory, {})).toEqual(['Cards']);
    expect(missingSlots(catchGame, {})).toEqual(['Good items (to catch)']);
  });

  it('every game has start, win and lose screens, an always-visible skip and a CTA', () => {
    for (const def of [memory, catchGame]) {
      const html = def.render(defaultProps(def), {}, ctx).html;
      expect([count(html, 'data-scr="'), count(html, 'data-skip="'), count(html, 'data-cta="'), count(html, 'data-play="')])
        .toEqual([3, 1, 2, 1]);
      expect(html).toContain('class="bgm-scr bgm-show" data-scr="start"');
      expect(def.backupState(resolveProps(def, { backupShows: 'win' }), {}, ctx).html).toContain('class="bgm-scr bgm-show" data-scr="win"');
    }
    const blank = memory.render(resolveProps(memory, { skipLabel: ' ', ctaLabel: '' }), {}, ctx).html;
    expect(blank).toContain('data-skip="1">Shop now</button>');
  });

  it('memory: grid size, pairs, and enough images for the grid', () => {
    expect(memoryGrid('2x3', 300, 300)).toEqual({ cols: 3, rows: 2, pairs: 3 });
    expect(memoryGrid('3x4', 300, 600)).toEqual({ cols: 3, rows: 4, pairs: 6 });
    const out = memory.render(defaultProps(memory), resolveSlots(memory, { cards: imgs(3) }, (id) => `images/${id}.png`), ctx);
    expect(count(out.html, 'data-k="')).toBe(6);
    expect(out.html).toContain('src="images/a2.png"');
    expect(out.css).toContain('grid-template-columns:repeat(3,1fr)');
    expect(count(memory.render(resolveProps(memory, { grid: '3x4' }), {}, ctx).html, 'data-k="')).toBe(12);
    expect(memory.validate!(resolveProps(memory, { grid: '3x4' }), { cards: imgs(4) })).toHaveLength(1);
    expect(memory.validate!(resolveProps(memory, { grid: '3x4' }), { cards: imgs(6) })).toEqual([]);
  });

  it('catch: templates for good and bad items, a catcher and preview items', () => {
    const slots = resolveSlots(catchGame, { good: imgs(2), bad: imgs(1) }, (id) => id);
    const html = catchGame.render(defaultProps(catchGame), slots, ctx).html;
    expect([count(html, 'data-good="1"'), count(html, 'data-good="0"')]).toEqual([2, 1]);
    const empty = catchGame.render(defaultProps(catchGame), {}, ctx);
    expect(count(empty.html, 'data-good="1"')).toBe(1);
    expect(empty.css).toContain('#x .bca-c{left:111px;width:78px;height:46.8px}');
  });
});

// ── Runtimes against a minimal fake window/document ──
type Fn = (...a: unknown[]) => unknown;
function cls() {
  const set = new Set<string>();
  return { set, add: (c: string) => { set.add(c); }, remove: (c: string) => { set.delete(c); }, contains: (c: string) => set.has(c) };
}
function shell() {
  const screens = ['start', 'win', 'lose'].map((k) => ({ k, classList: cls(), getAttribute: () => k }));
  screens[0]!.classList.add('bgm-show');
  const score = { textContent: '' };
  const time = { textContent: '' };
  const root = {
    classList: cls(),
    querySelectorAll: () => screens,
    querySelector: (s: string) => (s === '[data-hud="score"]' ? score : s === '[data-hud="time"]' ? time : null),
    addEventListener: () => {},
    removeEventListener: () => {},
  };
  return { screens, score, time, root };
}
function host(type: string, props: object, one: (s: string) => unknown, all: (s: string) => unknown[] = () => []) {
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
type Host = ReturnType<typeof host>;
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
const ptr = (target: unknown) => ({ pointerId: 1, clientX: 0, clientY: 0, target, cancelable: true, preventDefault: () => {} });
function tap(el: Host, target: unknown) { el.fire('pointerdown', ptr(target)); el.fire('pointerup', ptr(target)); }
const btn = (attr: string) => ({ closest: () => ({ getAttribute: (k: string) => (k === attr ? '1' : null) }) });

function cards(keys: number[]) {
  return keys.map((k) => {
    const c = {
      style: {} as Record<string, string>,
      classList: cls(),
      getAttribute: (a: string) => (a === 'data-k' ? String(k) : null),
      closest: (s: string): unknown => (s === '.bmm-c' ? c : null),
    };
    return c;
  });
}
function setupMemory(props: object) {
  const sh = shell();
  const cs = cards([0, 1, 2, 0, 1, 2]);
  const el = host('memory', resolveProps(memory, { hint: false, ...props }),
    (s) => (s === '.bgm' ? sh.root : null), (s) => (s === '.bmm-c' ? cs : []));
  const env = run(el, memory.runtime);
  const shown = () => sh.screens.filter((s) => s.classList.set.has('bgm-show')).map((s) => s.k);
  const isOpen = (i: number) => cs[i]!.classList.set.has('bmm-open');
  return { ...sh, cs, el, shown, isOpen, ...env };
}

beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(0); });
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

describe('memory runtime', () => {
  it('play, a mismatch flips back, matching all pairs wins, and the CTA exits', () => {
    const m = setupMemory({ timeLimit: 0 });
    expect(m.el.style.touchAction).toBe('pan-y');
    expect(m.shown()).toEqual(['start']);
    tap(m.el, btn('data-play'));
    expect(m.shown()).toEqual([]);
    expect(m.bannr.track).toHaveBeenCalledWith('game_start');
    expect(m.score.textContent).toBe('0/3');

    tap(m.el, m.cs[0]); tap(m.el, m.cs[1]);
    expect(m.isOpen(1)).toBe(true);
    m.tick(20);
    expect(m.isOpen(0)).toBe(false);

    for (const [a, b] of [[0, 3], [1, 4], [2, 5]] as const) { tap(m.el, m.cs[a]); tap(m.el, m.cs[b]); }
    expect(m.score.textContent).toBe('3/3');
    expect(m.shown()).toEqual(['win']);
    expect(m.bannr.track).toHaveBeenCalledWith('match');
    expect(m.bannr.track).toHaveBeenCalledWith('game_won');
    expect(m.bannr.exit).not.toHaveBeenCalled();

    tap(m.el, btn('data-cta'));
    expect(m.bannr.exit).toHaveBeenCalledTimes(1);
  });

  it('skip opens the landing page at any time', () => {
    const m = setupMemory({});
    tap(m.el, btn('data-skip'));
    expect(m.bannr.track).toHaveBeenCalledWith('game_skip');
    expect(m.bannr.exit).toHaveBeenCalledTimes(1);
  });

  it('the game is lost when time runs out, and can be played again', () => {
    const m = setupMemory({ timeLimit: 5 });
    tap(m.el, btn('data-play'));
    expect(m.time.textContent).toBe('5');
    m.tick(90);
    expect(m.shown()).toEqual(['lose']);
    expect(m.bannr.track).toHaveBeenCalledWith('game_lost');
    tap(m.el, btn('data-replay'));
    expect(m.shown()).toEqual([]);
    expect(m.bannr.track).toHaveBeenCalledWith('game_replay');
  });
});

describe('catch runtime', () => {
  it('the catcher follows the pointer; catching enough items wins', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const sh = shell();
    const kids: unknown[] = [];
    const fall = {
      appendChild: vi.fn((c: unknown) => { kids.push(c); }),
      removeChild: (c: unknown) => { kids.splice(kids.indexOf(c), 1); },
    };
    const cat = { style: {} as Record<string, string> };
    const tpl = { getAttribute: (k: string) => (k === 'data-good' ? '1' : null), cloneNode: () => ({ style: {} as Record<string, string> }) };
    const el = host('catch', resolveProps(catchGame, { scoreGoal: 1, hint: false }),
      (s) => (s === '.bgm' ? sh.root : s === '.bca-fall' ? fall : s === '.bca-c' ? cat : null),
      (s) => (s === '.bca-tpl .bca-it' ? [tpl] : []));
    const env = run(el, catchGame.runtime);

    tap(el, btn('data-play'));
    expect(cat.style.left).toBe('111px');
    el.fire('pointermove', { pointerId: 1, clientX: 290, clientY: 0 });
    expect(cat.style.left).toBe('222px');
    el.fire('pointermove', { pointerId: 1, clientX: 150, clientY: 0 });
    expect(cat.style.left).toBe('111px');

    env.tick(40);
    expect(fall.appendChild).toHaveBeenCalled();
    expect(env.bannr.track).toHaveBeenCalledWith('catch');
    expect(env.bannr.track).toHaveBeenCalledWith('game_won');
    expect(sh.score.textContent).toBe('1/1');
    expect(env.bannr.exit).not.toHaveBeenCalled();
  });
});
