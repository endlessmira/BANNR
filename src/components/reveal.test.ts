import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MOUNT_JS, RUNTIME_JS } from '@/runtime/runtime';
import { listComponents } from './registry';
import { scratch } from './scratch';
import { defaultProps, missingSlots, resolveProps, resolveSlots, schemaIssues } from './settings';
import { wipe } from './wipe';

const ctx = { id: 'x', sel: '#x', width: 300, height: 250 };
const count = (html: string, s: string) => html.split(s).length - 1;
const img = (id: string) => [{ kind: 'image' as const, assetId: id }];

describe('scratch render', () => {
  it('is registered and needs the hidden content', () => {
    expect(listComponents().map((d) => d.type)).toEqual(expect.arrayContaining(['scratch', 'wipe']));
    expect(schemaIssues(scratch)).toEqual([]);
    expect(missingSlots(scratch, {})).toEqual(['Hidden content']);
  });

  it('live: hidden content, static cover and canvas; backup: hidden content only (or the cover)', () => {
    const slots = resolveSlots(scratch, { reveal: img('a1'), cover: img('a2') }, (id) => `images/${id}.png`);
    const live = scratch.render(defaultProps(scratch), slots, ctx).html;
    expect([count(live, 'data-rv="'), count(live, 'data-cov="'), count(live, 'data-cv="')]).toEqual([1, 1, 1]);
    expect(live).toContain('src="images/a1.png"');
    expect(live).toContain('src="images/a2.png"');
    expect(live).toContain('<span class="bsc-tx">Scratch here!</span>');
    const backup = scratch.backupState(defaultProps(scratch), slots, ctx).html;
    expect([count(backup, 'data-rv="'), count(backup, 'data-cov="'), count(backup, 'data-cv="')]).toEqual([1, 0, 0]);
    const coverBackup = scratch.backupState(resolveProps(scratch, { backupShows: 'cover' }), slots, ctx).html;
    expect([count(coverBackup, 'data-cov="'), count(coverBackup, 'data-cv="')]).toEqual([1, 0]);
    expect(scratch.render(defaultProps(scratch), slots, ctx).css).toContain('font-size:22.5px');
  });
});

describe('wipe render', () => {
  it('needs both images, starts at the start position, labels and handle optional', () => {
    expect(schemaIssues(wipe)).toEqual([]);
    expect(missingSlots(wipe, {})).toEqual(['Before image', 'After image']);
    const html = wipe.render(defaultProps(wipe), {}, ctx).html;
    expect(html).toContain('data-o="v" data-st="wipe" style="--p:50%"');
    expect(count(html, 'data-lb="')).toBe(2);
    expect(html).toContain('<span class="bwp-h">⇔</span>');
    const off = wipe.render(resolveProps(wipe, { showLabels: false, showHandle: false, orientation: 'h', start: 30 }), {}, ctx).html;
    expect(count(off, 'data-lb="')).toBe(0);
    expect(off).not.toContain('bwp-h');
    expect(off).toContain('data-o="h" data-st="wipe" style="--p:30%"');
  });

  it('presets: glowing wipe and the 50:50 box with a play handle', () => {
    expect(wipe.render(resolveProps(wipe, {}, 'wipe'), {}, ctx).css).toContain('box-shadow:0 0 12px 3px #ffffff');
    const box = resolveProps(wipe, {}, 'box');
    expect(box.autoPlay).toBe(true);
    expect(wipe.render(box, {}, ctx).html).toContain('<span class="bwp-h">▶</span>');
    expect(wipe.backupState(box, {}, ctx).html).toBe(wipe.render(box, {}, ctx).html);
  });
});

// ── Runtimes against a minimal fake window/document ──
type Fn = (...a: unknown[]) => unknown;
function host(type: string, props: object, query: (s: string) => unknown) {
  const ls: Record<string, Fn[]> = {};
  return {
    style: {} as Record<string, string>,
    offsetWidth: 300,
    offsetHeight: 250,
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 300, height: 250 }),
    getAttribute: (k: string) => (k === 'data-component' ? type : k === 'data-props' ? JSON.stringify(props) : null),
    querySelector: query,
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
  return { bannr, frames };
}
const ev = (x: number, y = 100) => ({ pointerId: 1, clientX: x, clientY: y, cancelable: true, preventDefault: () => {} });
const noop = () => {};
const cls = { add: noop, remove: noop };

beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(0); });
afterEach(() => { vi.useRealTimers(); });

describe('scratch runtime', () => {
  it('scratching reveals without exiting, then a tap exits', () => {
    const c2 = {
      setTransform: vi.fn(), fillRect: vi.fn(), drawImage: vi.fn(), fillText: vi.fn(), beginPath: vi.fn(),
      moveTo: vi.fn(), lineTo: vi.fn(), stroke: vi.fn(),
      getImageData: () => ({ data: new Uint8ClampedArray(64 * 4) }),
    };
    const cv = { width: 0, height: 0, style: {} as Record<string, string>, getContext: () => c2 };
    const cov = { style: {} as Record<string, string>, querySelector: () => null };
    const root = { classList: cls, addEventListener: noop, removeEventListener: noop };
    const el = host('scratch', resolveProps(scratch, { hint: false }),
      (s) => (s === '.bsc' ? root : s === '.bsc-cv' ? cv : s === '.bsc-cov' ? cov : null));
    const { bannr } = run(el, scratch.runtime);
    expect(el.style.touchAction).toBe('none');
    expect(cv.width).toBe(300);
    expect(cov.style.visibility).toBe('hidden');
    expect(c2.fillText).toHaveBeenCalled();

    el.fire('pointerdown', ev(100)); el.fire('pointermove', ev(200)); el.fire('pointerup', ev(200));
    expect(c2.stroke).toHaveBeenCalled();
    expect(bannr.track).toHaveBeenCalledWith('interaction_start');
    expect(bannr.track).toHaveBeenCalledWith('reveal_complete');
    expect(cv.style.opacity).toBe('0');
    expect(el.style.touchAction).toBe('pan-y');
    expect(bannr.exit).not.toHaveBeenCalled();

    el.fire('pointerdown', ev(50)); el.fire('pointerup', ev(50));
    expect(bannr.exit).toHaveBeenCalledTimes(1);
  });
});

describe('wipe runtime', () => {
  function setup(props: object) {
    const vars: Record<string, string> = {};
    const root = {
      getAttribute: (k: string) => (k === 'data-o' ? 'v' : null),
      style: { setProperty: (k: string, v: string) => { vars[k] = v; } },
      classList: cls, addEventListener: noop, removeEventListener: noop,
    };
    const el = host('wipe', resolveProps(wipe, { hint: false, ...props }), (s) => (s === '.bwp' ? root : null));
    return { el, vars, ...run(el, wipe.runtime) };
  }

  it('a drag moves the divider without exiting; a tap exits', () => {
    const { el, vars, bannr } = setup({});
    expect(el.style.touchAction).toBe('pan-y');
    el.fire('pointerdown', ev(150)); el.fire('pointermove', ev(60)); el.fire('pointerup', ev(60));
    expect(vars['--p']).toBe('20%');
    expect(bannr.track).toHaveBeenCalledWith('interaction_start');
    expect(bannr.track).toHaveBeenCalledWith('wipe');
    expect(bannr.exit).not.toHaveBeenCalled();
    el.fire('pointerdown', ev(10)); el.fire('pointerup', ev(10));
    expect(bannr.exit).toHaveBeenCalledTimes(1);
  });

  it('auto-play sweeps the line until someone touches it', () => {
    const { el, vars, frames } = setup({ autoPlay: true, playSpeed: 3 });
    frames.shift()!(1);
    expect(vars['--p']).toBe('51%');
    el.fire('pointerdown', ev(10));
    frames.shift()?.(17);
    expect(frames).toHaveLength(0);
  });
});
