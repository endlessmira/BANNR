import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MOUNT_JS, RUNTIME_JS } from '@/runtime/runtime';
import { listComponents } from '../registry';
import { defaultProps, resolveProps, schemaIssues } from '../settings';
import { gesture } from './index';

const ctx = { id: 'x', sel: '#x', width: 300, height: 250 };
const count = (html: string, s: string) => html.split(s).length - 1;

describe('gesture render', () => {
  it('is registered, never catches the pointer, and has valid presets', () => {
    expect(listComponents().map((d) => d.type)).toContain('gesture');
    expect(gesture.capturesPointer).toBe(false);
    expect(schemaIssues(gesture)).toEqual([]);
    for (const pr of gesture.presets ?? []) expect(gesture.render(resolveProps(gesture, {}, pr.id), {}, ctx).html).toContain('bgs-c');
  });

  it('swipe: back and forth, repeats then a pause, stops at the stop time', () => {
    const out = gesture.render(defaultProps(gesture), {}, ctx);
    expect(count(out.html, 'data-g="')).toBe(1);
    expect(out.html).toContain('data-hide="hover"');
    expect(out.html).toContain('data-total="12.7"');
    expect(out.css).toContain('translate(50px,0px) scale(1);opacity:1');
    expect(out.css).toContain('translate(-50px,0px) scale(0.9)');
    expect(out.css).toContain('paint-order:stroke');
    // Hidden during the pause, back at the start position before the next round
    expect(out.css).toContain('67.949%{transform:translate(50px,0px) scale(1);opacity:0');
    expect(out.css).toContain('93.59%{transform:translate(50px,0px) scale(1);opacity:0');
    expect(out.css).toContain('100%{transform:translate(50px,0px) scale(1);opacity:1');
    expect(out.css).toContain('#x .bgs-m{animation:bgs-k-x 3.9s linear 1s 3 both}');
    expect(out.css).toContain('fill:#ffffff');
    expect(out.css).toContain('stroke:#111111');
    expect(out.html).not.toContain('bgs-rp');
    expect(gesture.render(resolveProps(gesture, { ripple: true }), {}, ctx).css).toContain('@keyframes bgs-r-x');
  });

  it('drag uses the target; rotate has no ripple; hover uses the mouse pointer', () => {
    expect(gesture.render(resolveProps(gesture, {}, 'peel'), {}, ctx).css).toContain('translate(-99px,-82.5px)');
    expect(gesture.render(resolveProps(gesture, {}, 'rotate'), {}, ctx).html).not.toContain('bgs-rp');
    expect(gesture.render(resolveProps(gesture, {}, 'hover'), {}, ctx).html).toContain('viewBox="0 0 28 36"');
    const hv = gesture.render(resolveProps(gesture, {}, 'hover'), {}, ctx);
    expect(hv.css).not.toContain('scale(0.9)');
    expect(hv.html).not.toContain('bgs-rp');
    expect(hv.css).toContain('translate(50px,0px) scale(1)');
  });

  it('is left out of the backup image unless switched on', () => {
    expect(gesture.backupState(defaultProps(gesture), {}, ctx).html).toBe('');
    const b = gesture.backupState(resolveProps(gesture, { inBackup: true }), {}, ctx);
    expect(b.html).toContain('bgs-c');
    expect(b.css).not.toContain('@keyframes');
  });
});

// ── Runtime against a minimal fake window/document ──
type Fn = (...a: unknown[]) => unknown;
function setup(hide: string) {
  const ls: Record<string, Fn[]> = {};
  const host = {
    addEventListener: (t: string, f: Fn) => { (ls[t] ??= []).push(f); },
    removeEventListener: (t: string, f: Fn) => { ls[t] = (ls[t] ?? []).filter((x) => x !== f); },
    fire: (t: string, e: object) => { for (const f of [...(ls[t] ?? [])]) f(e); },
  };
  const set = new Set<string>();
  const root = {
    classList: { add: (c: string) => { set.add(c); }, remove: (c: string) => { set.delete(c); } },
    getAttribute: (k: string) => (k === 'data-hide' ? hide : k === 'data-total' ? '2' : null),
  };
  const el = {
    getAttribute: (k: string) => (k === 'data-component' ? 'gesture' : k === 'data-props' ? '{}' : null),
    querySelector: (s: string) => (s === '.bgs' ? root : null),
  };
  const frames: Array<(t: number) => void> = [];
  const bannr = { exit: vi.fn(), track: vi.fn() };
  const win = {
    bannr, matchMedia: () => ({ matches: false }),
    requestAnimationFrame: (f: (t: number) => void) => frames.push(f), cancelAnimationFrame: () => {}, addEventListener: () => {},
  };
  const doc = { hidden: false, readyState: 'complete', addEventListener: () => {}, querySelectorAll: () => [el], getElementById: () => host };
  (new Function('window', 'document', 'bannr', [RUNTIME_JS, gesture.runtime, MOUNT_JS].join('\n')) as Fn)(win, doc, bannr);
  vi.runAllTimers();
  let now = 0;
  const tick = (n: number) => { for (let i = 0; i < n && frames.length > 0; i++) frames.shift()!((now += 64)); };
  return { host, hidden: () => set.has('bgs-off'), bannr, tick };
}

beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(0); });
afterEach(() => { vi.useRealTimers(); });

describe('gesture runtime', () => {
  it('hover mode: a mouse move over the banner hides it', () => {
    const g = setup('hover');
    expect(g.hidden()).toBe(false);
    g.host.fire('pointermove', { pointerType: 'mouse' });
    expect(g.hidden()).toBe(true);
    expect(g.bannr.track).toHaveBeenCalledWith('gesture_dismissed');
    expect(g.bannr.exit).not.toHaveBeenCalled();
  });

  it('touch mode: mouse moves are ignored, a touch hides it', () => {
    const g = setup('touch');
    g.host.fire('pointermove', { pointerType: 'mouse' });
    expect(g.hidden()).toBe(false);
    g.host.fire('pointerdown', { pointerType: 'touch' });
    expect(g.hidden()).toBe(true);
  });

  it('it disappears after the stop time on its own', () => {
    const g = setup('never');
    g.host.fire('pointerdown', { pointerType: 'touch' });
    expect(g.hidden()).toBe(false);
    g.tick(40);
    expect(g.hidden()).toBe(true);
    expect(g.bannr.track).not.toHaveBeenCalled();
  });
});
