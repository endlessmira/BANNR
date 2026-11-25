import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MOUNT_JS, RUNTIME_JS } from '@/runtime/runtime';
import { hoverreveal } from './hoverreveal';
import { peel, peelPolygons } from './peel';
import { listComponents } from './registry';
import { defaultProps, missingSlots, resolveProps, schemaIssues } from './settings';
import { zoom } from './zoom';

const ctx = { id: 'x', sel: '#x', width: 300, height: 250 };
const count = (html: string, s: string) => html.split(s).length - 1;

describe('peel render', () => {
  it('is registered, needs both images, and computes the peel shapes', () => {
    expect(listComponents().map((d) => d.type)).toEqual(expect.arrayContaining(['peel', 'hoverreveal', 'zoom']));
    expect(schemaIssues(peel)).toEqual([]);
    expect(missingSlots(peel, {})).toEqual(['Sticker (top)', 'Underneath']);
    expect(peelPolygons('br', 20)).toEqual({
      top: 'polygon(0% 0%,100% 0%,100% 80%,80% 100%,0% 100%)',
      flap: 'polygon(80% 100%,100% 80%,80% 80%)',
    });
    expect(peelPolygons('tl', 20).top).toBe('polygon(100% 100%,0% 100%,0% 20%,20% 0%,100% 0%)');
  });

  it('shows the sticker with a peeked corner; the backup can show the content underneath', () => {
    const html = peel.render(defaultProps(peel), {}, ctx).html;
    expect([count(html, 'data-pt="'), count(html, 'data-pu="')]).toEqual([1, 1]);
    expect(html).toContain('clip-path:polygon(0% 0%,100% 0%,100% 85%,85% 100%,0% 100%)');
    const under = peel.backupState(resolveProps(peel, { backupShows: 'under' }), {}, ctx).html;
    expect([count(under, 'data-pt="'), count(under, 'data-pu="')]).toEqual([0, 1]);
  });
});

describe('hover reveal render', () => {
  it('a covered grid with an end screen; the backup can show everything revealed or the end screen', () => {
    expect(schemaIssues(hoverreveal)).toEqual([]);
    expect(missingSlots(hoverreveal, { images: [{ kind: 'image', assetId: 'a1' }] })).toEqual(['Images to reveal']);
    const out = hoverreveal.render(defaultProps(hoverreveal), {}, ctx);
    expect([count(out.html, 'data-t="'), count(out.html, 'data-cta="')]).toEqual([4, 1]);
    expect(out.css).toContain('grid-template-columns:repeat(2,1fr);grid-template-rows:repeat(2,1fr)');
    expect(count(out.html, 'bhr-t bhr-on')).toBe(0);
    expect(count(hoverreveal.backupState(defaultProps(hoverreveal), {}, ctx).html, 'bhr-t bhr-on')).toBe(4);
    expect(hoverreveal.backupState(resolveProps(hoverreveal, { backupShows: 'end' }), {}, ctx).html).toContain('bhr-end bhr-show');
  });
});

describe('zoom render', () => {
  it('shows the lens in the centre with a scaled copy of the image', () => {
    expect(schemaIssues(zoom)).toEqual([]);
    expect(missingSlots(zoom, {})).toEqual(['Product image']);
    const out = zoom.render(defaultProps(zoom), {}, ctx);
    expect(count(out.html, 'data-lens="')).toBe(1);
    expect(out.html).toContain('style="left:90px;top:65px"');
    expect(out.html).toContain('transform:translate(-315px,-252.5px) scale(2.5)');
    expect(out.html).toContain('Hover to zoom');
    expect(out.css).toContain('border-radius:50%');
    expect(zoom.backupState(defaultProps(zoom), {}, ctx).html).not.toContain('bzm-tip');
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
const ev = (x: number, y: number, target: unknown = null, pointerType = 'touch') =>
  ({ pointerId: 1, clientX: x, clientY: y, target, pointerType, cancelable: true, preventDefault: () => {} });
const noop = () => {};

beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(0); });
afterEach(() => { vi.useRealTimers(); });

describe('peel runtime', () => {
  it('a long drag peels the sticker off without exiting; then a tap exits', () => {
    const top = { style: {} as Record<string, string> };
    const flap = { style: {} as Record<string, string> };
    const root = { getAttribute: () => 'br', classList: { add: vi.fn(), remove: noop }, addEventListener: noop, removeEventListener: noop };
    const el = host('peel', resolveProps(peel, { autoPeek: false, hint: false }),
      (s) => (s === '.bpl' ? root : s === '.bpl-top' ? top : s === '.bpl-flap' ? flap : null));
    const { bannr } = run(el, peel.runtime);
    expect(el.style.touchAction).toBe('none');
    expect(top.style.clipPath).toBe('polygon(0% 0%,100% 0%,100% 100%,100% 100%,0% 100%)');

    el.fire('pointerdown', ev(250, 200)); el.fire('pointermove', ev(50, 50)); el.fire('pointerup', ev(50, 50));
    expect(top.style.clipPath).toContain('36.67%');
    expect(root.classList.add).toHaveBeenCalledWith('bpl-off');
    expect(bannr.track).toHaveBeenCalledWith('interaction_start');
    expect(bannr.track).toHaveBeenCalledWith('peel_complete');
    expect(el.style.touchAction).toBe('pan-y');
    expect(bannr.exit).not.toHaveBeenCalled();

    el.fire('pointerdown', ev(10, 10)); el.fire('pointerup', ev(10, 10));
    expect(bannr.exit).toHaveBeenCalledTimes(1);
  });

  it('a short drag springs back and a tap does nothing before the peel', () => {
    const top = { style: {} as Record<string, string> };
    const flap = { style: {} as Record<string, string> };
    const root = { getAttribute: () => 'br', classList: { add: vi.fn(), remove: noop }, addEventListener: noop, removeEventListener: noop };
    const el = host('peel', resolveProps(peel, { autoPeek: false, hint: false }),
      (s) => (s === '.bpl' ? root : s === '.bpl-top' ? top : s === '.bpl-flap' ? flap : null));
    const { bannr } = run(el, peel.runtime);
    el.fire('pointerdown', ev(250, 200)); el.fire('pointermove', ev(220, 170)); el.fire('pointerup', ev(220, 170));
    expect(root.classList.add).not.toHaveBeenCalled();
    expect(top.style.clipPath).toBe('polygon(0% 0%,100% 0%,100% 100%,100% 100%,0% 100%)');
    el.fire('pointerdown', ev(10, 10)); el.fire('pointerup', ev(10, 10));
    expect(bannr.exit).not.toHaveBeenCalled();
  });
});

describe('hover reveal runtime', () => {
  it('a tap and a hover reveal tiles, the end screen follows, and its CTA exits', () => {
    const tiles = [0, 1].map((i) => ({ getAttribute: () => String(i), classList: { add: vi.fn() } }));
    const end = { classList: { add: vi.fn() } };
    const root = {
      querySelectorAll: () => tiles, querySelector: () => end,
      classList: { add: noop, remove: noop }, addEventListener: noop, removeEventListener: noop,
    };
    const el = host('hoverreveal', resolveProps(hoverreveal, { timeout: 0, endDelay: 0, hint: false }), (s) => (s === '.bhr' ? root : null));
    const { bannr, frames } = run(el, hoverreveal.runtime);
    expect(el.style.touchAction).toBe('pan-y');
    const onTile = (i: number) => ({ closest: (s: string) => (s === '[data-t]' ? tiles[i] : null) });

    el.fire('pointerdown', ev(10, 10, onTile(0))); el.fire('pointerup', ev(10, 10, onTile(0)));
    expect(tiles[0]!.classList.add).toHaveBeenCalledWith('bhr-on');
    expect(bannr.exit).not.toHaveBeenCalled();

    el.fire('pointermove', ev(200, 100, onTile(1), 'mouse'));
    expect(bannr.track).toHaveBeenCalledWith('reveal_all');
    frames.shift()!(1);
    expect(end.classList.add).toHaveBeenCalledWith('bhr-show');
    expect(bannr.track).toHaveBeenCalledWith('end_screen');

    const cta = { closest: (s: string) => (s === '[data-cta]' ? {} : null) };
    el.fire('pointerdown', ev(10, 10, cta)); el.fire('pointerup', ev(10, 10, cta));
    expect(bannr.exit).toHaveBeenCalledTimes(1);
  });
});

describe('zoom runtime', () => {
  it('on touch, the first tap shows the lens there; the next tap exits', () => {
    const lens = { style: {} as Record<string, string> };
    const inner = { style: {} as Record<string, string> };
    const root = { classList: { add: vi.fn(), remove: vi.fn() }, addEventListener: noop, removeEventListener: noop };
    const el = host('zoom', resolveProps(zoom, { zoom: 2, lensSize: 100, hint: false }),
      (s) => (s === '.bzm' ? root : s === '.bzm-lens' ? lens : s === '.bzm-in' ? inner : null));
    const { bannr } = run(el, zoom.runtime);
    expect(root.classList.remove).toHaveBeenCalledWith('bzm-on');

    el.fire('pointerdown', ev(150, 125)); el.fire('pointerup', ev(150, 125));
    expect([lens.style.left, lens.style.top]).toEqual(['100px', '75px']);
    expect(inner.style.transform).toBe('translate(-250px,-200px) scale(2)');
    expect(root.classList.add).toHaveBeenCalledWith('bzm-on');
    expect(bannr.track).toHaveBeenCalledWith('zoom');
    expect(bannr.exit).not.toHaveBeenCalled();

    el.fire('pointerdown', ev(150, 125)); el.fire('pointerup', ev(150, 125));
    expect(bannr.exit).toHaveBeenCalledTimes(1);
  });
});
