import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { canRotate } from '@/editor/componentPanel/actions';
import { createComponent, createProject, createSize } from '@/model/factories';
import { renderBanner } from '@/renderer';
import { MOUNT_JS, RUNTIME_JS } from '@/runtime/runtime';
import { cube } from './cube';
import { flip } from './flip';
import { listComponents } from './registry';
import { defaultProps, missingSlots, resolveProps, resolveSlots } from './settings';

const ctx = { id: 'x', sel: '#x', width: 300, height: 250 };
const four = { faces: [1, 2, 3, 4].map((i) => ({ kind: 'image' as const, assetId: `a${i}` })) };

describe('cube', () => {
  it('is registered, needs four face images and renders a 3D cube', () => {
    expect(listComponents().map((d) => d.type)).toEqual(expect.arrayContaining(['cube', 'flip']));
    expect(missingSlots(cube, {})).toEqual(['Faces']);
    expect(missingSlots(cube, four)).toEqual([]);
    const out = cube.render(defaultProps(cube), resolveSlots(cube, four, (id) => `images/${id}.png`), ctx);
    expect(out.html.split('class="bc3-f"').length - 1).toBe(4);
    expect(out.html).toContain('src="images/a1.png" alt="" draggable="false"');
    expect(out.css).toContain('translateZ(-150px)');
    expect(out.css).toContain('rotateY(90deg) translateZ(150px)');
  });

  it('half cube is smaller and tilted; the backup is flat', () => {
    const p = resolveProps(cube, {}, 'half');
    const out = cube.render(p, {}, ctx);
    expect(out.css).toContain('width:210px');
    expect(out.css).toContain('rotateX(-12deg)');
    const b = cube.backupState(p, {}, ctx);
    expect(b.html).toContain('bc3-flat');
    expect(b.html).not.toContain('bc3-cube');
  });

  it('is interactive and is never rotated', () => {
    const size = createSize(300, 250, { elements: [createComponent({ id: 'eC', componentType: 'cube', rotation: 30 })] });
    const out = renderBanner(createProject('C', { platform: 'cm360', sizes: [size] }), size.id, { resolveAsset: (id) => id });
    expect(out.html).toContain('class="el el-component bannr-interactive"');
    expect(out.css).not.toContain('rotate:30deg');
    expect(canRotate(createComponent({ componentType: 'cube' }))).toBe(false);
    expect(canRotate(createComponent({ componentType: 'flip' }))).toBe(false);
  });
});

describe('flip card', () => {
  it('needs a front and a back; parallax has two halves', () => {
    expect(missingSlots(flip, {})).toEqual(['Front', 'Back']);
    const html = flip.render(resolveProps(flip, {}, 'parallax'), {}, ctx).html;
    expect(html.split('class="bcf-half').length - 1).toBe(2);
    expect(html.split('class="bcf-card"').length - 1).toBe(2);
    expect(flip.backupState(defaultProps(flip), {}, ctx).html).not.toContain('bcf-card');
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
  const bannr = { exit: vi.fn(), track: vi.fn() };
  const win = { bannr, matchMedia: () => ({ matches: false }), requestAnimationFrame: () => 0, cancelAnimationFrame: () => {}, addEventListener: () => {} };
  const doc = { hidden: false, readyState: 'complete', addEventListener: () => {}, querySelectorAll: () => [node] };
  const run = (code: string) => { (new Function('window', 'document', 'bannr', code) as Fn)(win, doc, bannr); };
  return { bannr, run };
}
const ev = (x: number) => ({ pointerId: 1, clientX: x, clientY: 0, cancelable: true, preventDefault: () => {} });
const nodeAttrs = (type: string, props: object) => (n: string) =>
  (n === 'data-component' ? type : n === 'data-props' ? JSON.stringify(props) : null);

beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(0); });
afterEach(() => { vi.useRealTimers(); });

describe('3D runtimes: tap vs swipe', () => {
  it('cube: a swipe turns to the next face without exiting; a tap exits', () => {
    const props = resolveProps(cube, { autoRotate: false, hint: false });
    const root = target({ getAttribute: (n: string) => (n === 'data-dir' ? 'h' : n === 'data-d' ? '150' : n === 'data-pre' ? '' : null) });
    const cubeEl = { style: {} as Record<string, string>, children: { length: 4 } };
    const el = target({
      offsetWidth: 300, offsetHeight: 250, getAttribute: nodeAttrs('cube', props),
      querySelector: (s: string) => (s === '.bc3' ? root : s === '.bc3-cube' ? cubeEl : null),
    });
    const env = boot(el);
    env.run([RUNTIME_JS, cube.runtime, MOUNT_JS].join('\n'));
    vi.runAllTimers();
    expect(el.style.touchAction).toBe('pan-y');

    el.fire('pointerdown', ev(200)); el.fire('pointermove', ev(0)); el.fire('pointerup', ev(0));
    expect(cubeEl.style.transform).toContain('rotateY(-90deg)');
    expect(env.bannr.track).toHaveBeenCalledWith('interaction_start');
    expect(env.bannr.track).toHaveBeenCalledWith('face_change');
    expect(env.bannr.exit).not.toHaveBeenCalled();

    el.fire('pointerdown', ev(10)); el.fire('pointerup', ev(12));
    expect(env.bannr.exit).toHaveBeenCalledTimes(1);
  });

  it('flip: a tap flips it; a drag flips it; a tap on the back exits', () => {
    const props = resolveProps(flip, { autoPeek: false, hint: false });
    const card = { style: {} as Record<string, string> };
    const root = target({ getAttribute: (n: string) => (n === 'data-dir' ? 'h' : null), querySelectorAll: () => [card] });
    const el = target({
      offsetWidth: 300, offsetHeight: 250, getAttribute: nodeAttrs('flip', props),
      querySelector: (s: string) => (s === '.bcf' ? root : null),
    });
    const env = boot(el);
    env.run([RUNTIME_JS, flip.runtime, MOUNT_JS].join('\n'));
    vi.runAllTimers();

    el.fire('pointerdown', ev(0)); el.fire('pointerup', ev(0));
    expect(card.style.transform).toBe('rotateY(180deg)');
    expect(env.bannr.track).toHaveBeenCalledWith('flip');
    expect(env.bannr.exit).not.toHaveBeenCalled();

    el.fire('pointerdown', ev(0)); el.fire('pointermove', ev(200)); el.fire('pointerup', ev(200));
    expect(card.style.transform).toBe('rotateY(360deg)');
    expect(env.bannr.exit).not.toHaveBeenCalled();

    el.fire('pointerdown', ev(0)); el.fire('pointerup', ev(0));
    expect(env.bannr.exit).not.toHaveBeenCalled();
    el.fire('pointerdown', ev(0)); el.fire('pointerup', ev(0));
    expect(env.bannr.exit).toHaveBeenCalledTimes(1);
  });
});
