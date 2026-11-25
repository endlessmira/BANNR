import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { canRotate } from '@/editor/componentPanel/actions';
import { createComponent } from '@/model/factories';
import { MOUNT_JS, RUNTIME_JS } from '@/runtime/runtime';
import { orbit, placeItem } from './orbit';
import { listComponents } from './registry';
import { defaultProps, missingSlots, resolveProps, resolveSlots } from './settings';
import { tilt } from './tilt';

const ctx = { id: 'x', sel: '#x', width: 300, height: 250 };
const imgs = (n: number) => Array.from({ length: n }, (_, i) => ({ kind: 'image' as const, assetId: `a${i}` }));

describe('tilt card', () => {
  it('is registered, needs layers, and floats upper layers in depth (flat in the backup)', () => {
    expect(listComponents().map((d) => d.type)).toEqual(expect.arrayContaining(['tilt', 'orbit']));
    expect(missingSlots(tilt, {})).toEqual(['Layers (background first)']);
    const slots = resolveSlots(tilt, { layers: imgs(3) }, (id) => `images/${id}.png`);
    const live = tilt.render(defaultProps(tilt), slots, ctx).html;
    expect(live.split('class="bct-l"').length - 1).toBe(3);
    expect(live).toContain('transform:translateZ(30px)');
    expect(live).toContain('transform:translateZ(60px)');
    expect(tilt.backupState(defaultProps(tilt), slots, ctx).html).not.toContain('translateZ');
    expect(resolveProps(tilt, {}, 'rocker')).toMatchObject({ idleMotion: 'rock', maxTilt: 22 });
    expect(canRotate(createComponent({ componentType: 'tilt' }))).toBe(false);
  });
});

describe('orbit carousel', () => {
  it('needs at least 3 products and puts the front item on top at full size', () => {
    expect(missingSlots(orbit, { items: imgs(2) })).toEqual(['Products']);
    expect(missingSlots(orbit, { items: imgs(3) })).toEqual([]);
    const html = orbit.render(defaultProps(orbit), {}, ctx).html;
    expect(html.split('class="bco-i"').length - 1).toBe(5);
    expect(html).toContain('scale(1.000);opacity:1.00;z-index:101');
    expect(placeItem(0, 4, 90, 100, 0)).toBe('transform:translate(100.0px,0.0px) scale(0.800);opacity:0.73;z-index:51');
    expect(orbit.backupState(defaultProps(orbit), {}, ctx).html).toBe(html);
    expect(canRotate(createComponent({ componentType: 'orbit' }))).toBe(false);
  });
});

// ── Runtimes against a minimal fake window/document ──
type Fn = (...a: unknown[]) => unknown;
function target(extra: Record<string, unknown> = {}) {
  const ls: Record<string, Fn[]> = {};
  return {
    style: {} as Record<string, string>,
    classList: { add: () => {}, remove: () => {} },
    addEventListener: (t: string, f: Fn) => { (ls[t] ??= []).push(f); },
    removeEventListener: (t: string, f: Fn) => { ls[t] = (ls[t] ?? []).filter((x) => x !== f); },
    setPointerCapture: () => {},
    fire: (t: string, e: object) => { for (const f of ls[t] ?? []) f(e); },
    ...extra,
  };
}
function boot(node: unknown) {
  const frames: Array<(t: number) => void> = [];
  const bannr = { exit: vi.fn(), track: vi.fn() };
  const win = {
    bannr, matchMedia: () => ({ matches: false }),
    requestAnimationFrame: (f: (t: number) => void) => frames.push(f), cancelAnimationFrame: () => {}, addEventListener: () => {},
  };
  const doc = { hidden: false, readyState: 'complete', addEventListener: () => {}, querySelectorAll: () => [node] };
  const run = (code: string) => { (new Function('window', 'document', 'bannr', code) as Fn)(win, doc, bannr); };
  return { bannr, frames, run };
}
const ev = (x: number, y = 0, pointerType = 'touch') => ({ pointerId: 1, clientX: x, clientY: y, pointerType, cancelable: true, preventDefault: () => {} });
const attrs = (type: string, props: object) => (n: string) =>
  (n === 'data-component' ? type : n === 'data-props' ? JSON.stringify(props) : null);

beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(0); });
afterEach(() => { vi.useRealTimers(); });

describe('3D runtimes, part 2', () => {
  it('tilt: follows the mouse, a drag never exits, a tap does', () => {
    const props = resolveProps(tilt, { idleMotion: 'none', hint: false });
    const card = { style: {} as Record<string, string> };
    const root = target();
    const el = target({
      getAttribute: attrs('tilt', props),
      getBoundingClientRect: () => ({ left: 0, top: 0, width: 300, height: 250 }),
      querySelector: (s: string) => (s === '.bct' ? root : s === '.bct-card' ? card : null),
    });
    const env = boot(el);
    env.run([RUNTIME_JS, tilt.runtime, MOUNT_JS].join('\n'));
    vi.runAllTimers();
    expect(el.style.touchAction).toBe('pan-y');

    el.fire('pointermove', ev(300, 125, 'mouse'));
    expect(env.bannr.track).toHaveBeenCalledWith('interaction_start');
    for (let i = 0; i < 80 && env.frames.length > 0; i++) env.frames.shift()!(1 + i * 16);
    const y = Number(/rotateY\(([-\d.]+)deg\)/.exec(card.style.transform ?? '')?.[1]);
    expect(y).toBeGreaterThan(11);

    el.fire('pointerdown', ev(100)); el.fire('pointermove', ev(200)); el.fire('pointerup', ev(200));
    expect(env.bannr.exit).not.toHaveBeenCalled();
    el.fire('pointerdown', ev(50)); el.fire('pointerup', ev(52));
    expect(env.bannr.exit).toHaveBeenCalledTimes(1);
  });

  it('orbit: a drag spins it without exiting, a tap exits', () => {
    const props = resolveProps(orbit, { autoRotate: false, hint: false });
    const items = Array.from({ length: 4 }, () => ({ style: {} as Record<string, string> }));
    const root = target({
      getAttribute: (n: string) => (n === 'data-r' ? '100' : n === 'data-tilt' ? '0' : null),
      querySelectorAll: () => items,
    });
    const el = target({ offsetWidth: 300, getAttribute: attrs('orbit', props), querySelector: (s: string) => (s === '.bco' ? root : null) });
    const env = boot(el);
    env.run([RUNTIME_JS, orbit.runtime, MOUNT_JS].join('\n'));
    vi.runAllTimers();

    el.fire('pointerdown', ev(300)); el.fire('pointermove', ev(150)); el.fire('pointerup', ev(150));
    expect(items[0]!.style.transform).toBe('translate(-100.0px,0.0px) scale(0.800)');
    expect(env.bannr.track).toHaveBeenCalledWith('interaction_start');
    expect(env.bannr.track).toHaveBeenCalledWith('spin');
    expect(env.bannr.exit).not.toHaveBeenCalled();

    el.fire('pointerdown', ev(10)); el.fire('pointerup', ev(12));
    expect(env.bannr.exit).toHaveBeenCalledTimes(1);
  });
});
