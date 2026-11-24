import { describe, expect, it } from 'vitest';
import { getAdapter } from '@/export/adapters/registry';
import { type ExportDeps, buildSizeZip } from '@/export/pipeline';
import { createComponent, createProject, createSize, createText } from '@/model/factories';
import { renderBanner, renderFragment } from '@/renderer';
import { RUNTIME_CSS, RUNTIME_JS } from '@/runtime/runtime';
import { componentChecks } from '@/validation/components';
import { runChecks } from '@/validation/rules';
import { counter, formatNumber } from './counter';
import { getComponent, listComponents } from './registry';
import { defaultProps, missingSlots, resolveProps, schemaIssues } from './settings';
import type { ComponentDefinition } from './types';

const deps: ExportDeps = { loadAsset: async () => undefined, webpToPng: async (b) => b };
const bytes = (s: string): number => new TextEncoder().encode(s).length;

describe('component registry', () => {
  it('every component has a valid schema and stays within its weight budget', () => {
    expect(listComponents().length).toBeGreaterThan(0);
    for (const def of listComponents()) {
      expect(schemaIssues(def)).toEqual([]);
      const out = def.render(defaultProps(def), {}, { id: 'x', sel: '#x', width: def.defaultSize.width, height: def.defaultSize.height });
      expect(bytes(def.runtime + (def.styles ?? '') + out.css)).toBeLessThanOrEqual(def.weightBudgetKB * 1024);
      expect(def.runtime).not.toMatch(/window\.open|location|https?:\/\//);
    }
  });

  it('the shared runtime is under 6 KB and never opens URLs itself', () => {
    expect(bytes(RUNTIME_JS + RUNTIME_CSS)).toBeLessThan(6 * 1024);
    expect(RUNTIME_JS).not.toMatch(/window\.open|location|https?:\/\//);
  });

  it('only finds registered components', () => {
    expect(getComponent('counter')).toBe(counter);
    expect(getComponent('toString')).toBeUndefined();
    expect(getComponent('nope')).toBeUndefined();
  });
});

describe('settings', () => {
  it('resolves defaults, presets and stored props, rejecting invalid values', () => {
    const p = resolveProps(counter, { end: '75', decimals: 9, color: 'red;}', easing: 'bounce', extra: 1 }, 'sold');
    expect(p).toMatchObject({ end: 75, decimals: 3, color: '#111111', easing: 'easeOut', suffix: '+ sold', separator: ',' });
    expect('extra' in p).toBe(false);
    expect(resolveProps(counter, {})).toEqual(defaultProps(counter));
  });

  it('reports empty required slots', () => {
    const withSlot: ComponentDefinition = { ...counter, type: 'x', slots: [{ name: 'img', label: 'Image', kind: 'image', required: true }] };
    expect(missingSlots(withSlot, {})).toEqual(['Image']);
    expect(missingSlots(withSlot, { img: [{ kind: 'image', assetId: 'a1' }] })).toEqual([]);
  });
});

describe('counter', () => {
  it('formats numbers', () => {
    expect(formatNumber(10000, 0, ',')).toBe('10,000');
    expect(formatNumber(-50, 0, '')).toBe('-50');
    expect(formatNumber(1234.5, 2, ' ')).toBe('1 234,50');
    expect(formatNumber(-0.001, 0, ',')).toBe('0');
  });

  it('renders the end value, includes its code once, and is not interactive', () => {
    const size = createSize(300, 250, { elements: [createComponent({ id: 'eC', componentType: 'counter', props: { end: 10000, suffix: '+ sold' } })] });
    const p = createProject('C', { platform: 'cm360', sizes: [size] });
    const out = renderBanner(p, size.id, { resolveAsset: (id) => id });
    expect(out.html).toContain('class="el el-component" data-component="counter"');
    expect(out.html).toContain('<span class="bc-val">10,000</span>');
    expect(out.componentTypes).toEqual(['counter']);
    expect(out.js.split("bannr.define('counter'").length - 1).toBe(1);
    expect(out.js).toContain('bannr.start();');
    expect(out.css).toContain('.bc-counter{');
    expect(renderFragment(p, size.id, { resolveAsset: (id) => id, componentMode: 'backup' }).bodyHtml).toContain('10,000');

    const plain = createProject('P', { platform: 'cm360', sizes: [createSize(300, 250, { elements: [createText()] })] });
    const po = renderBanner(plain, plain.sizes[0]!.id, { resolveAsset: (id) => id });
    expect(po.js).not.toContain('bannr.define');
    expect(po.css).not.toContain('bannr-wiggle');
  });

  it('a banner with a Counter passes every check on every platform', async () => {
    for (const id of ['adform', 'cm360', 'dv360', 'ttd'] as const) {
      const size = createSize(300, 250, { elements: [createComponent({ componentType: 'counter', width: 240, height: 80 })] });
      const p = createProject('C', { platform: id, sizes: [size], landingUrl: 'https://www.example.com' });
      const r = await buildSizeZip(p, size.id, deps);
      const rs = runChecks({ project: p, size, adapter: getAdapter(id), manifest: r.manifest });
      expect(rs.filter((x) => x.level !== 'pass')).toEqual([]);
    }
  });
});

describe('component checks', () => {
  it('checks minimum size, unknown types and fit', () => {
    const size = createSize(300, 250, {
      elements: [
        createComponent({ name: 'Tiny', componentType: 'counter', width: 20, height: 10 }),
        createComponent({ name: 'Off', componentType: 'counter', x: 250, width: 200, height: 80 }),
        createComponent({ name: 'X', componentType: 'nope' }),
      ],
    });
    const rs = componentChecks(size);
    expect(rs.filter((r) => r.level === 'error').map((r) => r.ruleId).sort()).toEqual(['component-min-size', 'component-unknown']);
    expect(rs.filter((r) => r.level === 'warning').map((r) => r.ruleId)).toEqual(['component-fit']);
    expect(componentChecks(createSize(300, 250, { elements: [createComponent({ componentType: 'counter', width: 240, height: 80 })] })))
      .toEqual([expect.objectContaining({ ruleId: 'components', level: 'pass' })]);
    expect(componentChecks(createSize(300, 250))).toEqual([]);
  });
});
