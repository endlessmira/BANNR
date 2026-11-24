import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { counter, formatNumber } from '@/components/counter';
import { resolveProps } from '@/components/settings';
import { MOUNT_JS, RUNTIME_JS } from './runtime';

type Fn = (...args: unknown[]) => unknown;
interface Bannr {
  exit: ReturnType<typeof vi.fn>;
  track: ReturnType<typeof vi.fn>;
  gesture: (el: unknown, h: Record<string, Fn>, opts?: { tapToExit?: boolean }) => () => void;
}

function fakeEl() {
  const ls: Record<string, Fn[]> = {};
  return {
    classList: { add: () => {}, remove: () => {} },
    addEventListener: (t: string, f: Fn) => { (ls[t] ??= []).push(f); },
    removeEventListener: (t: string, f: Fn) => { ls[t] = (ls[t] ?? []).filter((x) => x !== f); },
    setPointerCapture: () => {},
    fire: (t: string, e: object) => { for (const f of ls[t] ?? []) f(e); },
  };
}

/** Runs banner code against a minimal fake window/document (no browser needed). */
function boot(opts: { reduced?: boolean; nodes?: unknown[] } = {}) {
  const frames: Array<(t: number) => void> = [];
  const bannr = { exit: vi.fn(), track: vi.fn() } as unknown as Bannr;
  const win = {
    bannr,
    matchMedia: () => ({ matches: Boolean(opts.reduced) }),
    requestAnimationFrame: (f: (t: number) => void) => frames.push(f),
    cancelAnimationFrame: () => {},
    addEventListener: () => {},
  };
  const doc = { hidden: false, readyState: 'complete', addEventListener: () => {}, querySelectorAll: () => opts.nodes ?? [] };
  const run = (code: string) => { (new Function('window', 'document', 'bannr', code) as Fn)(win, doc, bannr); };
  return { bannr, frames, run };
}

const ev = (x: number) => ({ pointerId: 1, clientX: x, clientY: 0, cancelable: true, preventDefault: () => {} });

function counterNode(props: object) {
  const val = { textContent: '' };
  const node = {
    getAttribute: (n: string) => (n === 'data-component' ? 'counter' : n === 'data-props' ? JSON.stringify(props) : null),
    querySelector: (s: string) => (s === '.bc-val' ? val : null),
  };
  return { val, node };
}

beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(0); });
afterEach(() => { vi.useRealTimers(); });

describe('shared runtime: tap vs drag', () => {
  it('a tap calls bannr.exit(); a drag or a long press never does', () => {
    const env = boot();
    env.run(RUNTIME_JS);
    const el = fakeEl();
    const move = vi.fn();
    const end = vi.fn();
    env.bannr.gesture(el, { move, end });

    el.fire('pointerdown', ev(0)); vi.advanceTimersByTime(100); el.fire('pointerup', ev(4));
    expect(env.bannr.exit).toHaveBeenCalledTimes(1);

    el.fire('pointerdown', ev(0)); el.fire('pointermove', ev(25)); el.fire('pointerup', ev(25));
    expect(move).toHaveBeenCalled();
    expect(end).toHaveBeenCalledTimes(1);
    expect(env.bannr.exit).toHaveBeenCalledTimes(1);

    el.fire('pointerdown', ev(0)); vi.advanceTimersByTime(400); el.fire('pointerup', ev(0));
    expect(env.bannr.exit).toHaveBeenCalledTimes(1);
  });

  it('a handled tap, or tapToExit off, does not exit', () => {
    const env = boot();
    env.run(RUNTIME_JS);
    const a = fakeEl();
    env.bannr.gesture(a, { tap: () => true });
    a.fire('pointerdown', ev(0)); a.fire('pointerup', ev(0));
    const b = fakeEl();
    env.bannr.gesture(b, {}, { tapToExit: false });
    b.fire('pointerdown', ev(0)); b.fire('pointerup', ev(0));
    expect(env.bannr.exit).not.toHaveBeenCalled();
  });
});

describe('counter runtime', () => {
  it('with reduced motion, shows the end value at once (same format as the editor)', () => {
    const { val, node } = counterNode(resolveProps(counter, { end: -12345.6, decimals: 1, separator: '.' }));
    const env = boot({ reduced: true, nodes: [node] });
    env.run([RUNTIME_JS, counter.runtime, MOUNT_JS].join('\n'));
    vi.runAllTimers();
    expect(val.textContent).toBe(formatNumber(-12345.6, 1, '.'));
    expect(env.bannr.track).toHaveBeenCalledWith('counter_complete');
  });

  it('counts from start to end with requestAnimationFrame and reports completion once', () => {
    const { val, node } = counterNode(resolveProps(counter, { start: 0, end: 100, duration: 1 }));
    const env = boot({ nodes: [node] });
    env.run([RUNTIME_JS, counter.runtime, MOUNT_JS].join('\n'));
    vi.runAllTimers();
    expect(val.textContent).toBe('0');
    for (let i = 0; i < 60 && env.frames.length > 0; i++) env.frames.shift()!(1 + i * 64);
    expect(val.textContent).toBe('100');
    expect(env.bannr.track).toHaveBeenCalledTimes(1);
  });
});
