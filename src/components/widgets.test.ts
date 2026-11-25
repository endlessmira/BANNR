import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useEditorStore } from '@/editor/store/editorStore';
import { addComponent } from '@/editor/componentPanel/actions';
import { createProject, createSize, createText } from '@/model/factories';
import { MOUNT_JS, RUNTIME_JS } from '@/runtime/runtime';
import { cascade } from './cascade';
import { clock } from './clock';
import { countdown } from './countdown';
import { gradient_ } from './gradient';
import { listComponents } from './registry';
import { defaultProps, missingSlots, resolveProps, resolveSlots } from './settings';
import { zonedToEpoch } from './time';

const ctx = { id: 'x', sel: '#x', width: 300, height: 100 };

describe('registry', () => {
  it('lists the motion and widget components', () => {
    expect(listComponents().map((d) => d.type).sort()).toEqual(['cascade', 'clock', 'countdown', 'counter', 'gradient']);
  });
});

describe('time zones', () => {
  it('converts a wall time in a named zone to the right moment', () => {
    expect(zonedToEpoch('2026-12-31T23:59', 'Europe/Prague')).toBe(Date.UTC(2026, 11, 31, 22, 59));
    expect(zonedToEpoch('2026-07-01T12:00', 'America/New_York')).toBe(Date.UTC(2026, 6, 1, 16, 0));
    expect(zonedToEpoch('2026-07-01T12:00', 'UTC')).toBe(Date.UTC(2026, 6, 1, 12, 0));
    expect(Number.isNaN(zonedToEpoch('nope', 'UTC'))).toBe(true);
  });
});

describe('cascade', () => {
  it('needs images, renders placeholders until filled, and uses the stored files', () => {
    expect(missingSlots(cascade, {})).toEqual(['Images']);
    expect(cascade.render(defaultProps(cascade), {}, ctx).html.split('bc-cas-ph').length - 1).toBe(3);
    const slots = resolveSlots(cascade, { images: [{ kind: 'image', assetId: 'a1' }] }, (id) => `images/${id}.png`);
    const out = cascade.render(defaultProps(cascade), slots, ctx);
    expect(out.html).toContain('<img src="images/a1.png"');
    expect(out.css).toContain('--bc-off:translateY(-80px)');
  });
});

describe('animated gradient', () => {
  it('uses only the chosen colours, stops after its sweeps, and is still in the backup', () => {
    const p = resolveProps(gradient_, { colorCount: 2 });
    const live = gradient_.render(p, {}, ctx).css;
    expect(live).toContain('linear-gradient(135deg,#f2a902,#ff3ea5)');
    expect(live).toContain('bc-grad-move 6s ease-in-out 0s 4 alternate both');
    expect(gradient_.backupState(p, {}, ctx).css).toContain('animation:none');
  });

  it('is added full-banner at the bottom of the layer stack', () => {
    const size = createSize(480, 480, { elements: [createText({ zIndex: 3 })] });
    useEditorStore.getState().load(createProject('G', { platform: 'cm360', sizes: [size] }));
    addComponent('gradient');
    const els = useEditorStore.getState().project!.sizes[0]!.elements;
    expect(els[0]).toMatchObject({ type: 'component', componentType: 'gradient', x: 0, y: 0, width: 480, height: 480, zIndex: 0 });
  });
});

describe('countdown', () => {
  it('renders the end moment, chosen units and labels; the backup shows its own text', () => {
    const p = resolveProps(countdown, { showDays: false, labelHours: 'Hod', timeZone: 'UTC', endDate: '2030-01-01T00:00' });
    const html = countdown.render(p, {}, ctx).html;
    expect(html).toContain(`data-end="${Date.UTC(2030, 0, 1)}"`);
    expect(html).not.toContain('data-u="d"');
    expect(html).toContain('<span class="bc-cd-l">Hod</span>');
    expect(countdown.backupState(p, {}, ctx).html).toContain('Limited time offer');
    const local = countdown.render(resolveProps(countdown, { timeZone: 'local' }), {}, ctx).html;
    expect(local).toContain('data-local="1"');
  });
});

describe('clock', () => {
  it('shows the classic 10:10 in edit mode, in both styles', () => {
    expect(clock.render(defaultProps(clock), {}, ctx).html).toContain('>10:10<');
    expect(clock.render(resolveProps(clock, { format: '12', showSeconds: true }), {}, ctx).html).toContain('10:10:30 AM');
    expect(clock.render(resolveProps(clock, { style: 'analog' }), {}, ctx).html).toContain('class="bc-clk-a"');
  });
});

// ── Countdown runtime against a minimal fake window/document ──
type Fn = (...a: unknown[]) => unknown;
function boot(nodes: unknown[]) {
  const bannr = { exit: vi.fn(), track: vi.fn() };
  const win = { bannr, matchMedia: () => ({ matches: false }), requestAnimationFrame: () => 0, cancelAnimationFrame: () => {}, addEventListener: () => {} };
  const doc = { hidden: false, readyState: 'complete', addEventListener: () => {}, querySelectorAll: () => nodes };
  const run = (code: string) => { (new Function('window', 'document', 'bannr', code) as Fn)(win, doc, bannr); };
  return { bannr, run };
}
function cdNode(end: number) {
  const nums = ['h', 'm', 's'].map((u) => ({ textContent: '', getAttribute: () => u }));
  const add = vi.fn();
  const box = {
    getAttribute: (n: string) => (n === 'data-local' ? '0' : n === 'data-end' ? String(end) : null),
    querySelectorAll: () => nums,
    classList: { add },
  };
  const node = {
    getAttribute: (n: string) => (n === 'data-component' ? 'countdown' : n === 'data-props' ? '{}' : null),
    querySelector: (s: string) => (s === '.bc-cd' ? box : null),
  };
  return { nums, add, node };
}

beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(0); });
afterEach(() => { vi.useRealTimers(); });

describe('countdown runtime', () => {
  it('shows the time left, carrying into the largest unit shown', () => {
    const { nums, node } = cdNode((26 * 3600 + 2 * 60 + 5) * 1000);
    const env = boot([node]);
    env.run([RUNTIME_JS, countdown.runtime, MOUNT_JS].join('\n'));
    vi.runAllTimers();
    expect(nums.map((n) => n.textContent)).toEqual(['26', '02', '05']);
    expect(env.bannr.track).not.toHaveBeenCalled();
  });

  it('switches to the end state once the time has passed', () => {
    const { add, node } = cdNode(-1000);
    const env = boot([node]);
    env.run([RUNTIME_JS, countdown.runtime, MOUNT_JS].join('\n'));
    vi.runAllTimers();
    expect(add).toHaveBeenCalledWith('bc-cd-done');
    expect(env.bannr.track).toHaveBeenCalledWith('countdown_end');
  });
});
