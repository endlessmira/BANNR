import { describe, expect, it } from 'vitest';
import { getAdapter } from '@/export/adapters/registry';
import { type ExportDeps, buildSizeZip } from '@/export/pipeline';
import { createProject, createSize, createText } from '@/model/factories';
import { runChecks } from './rules';

const deps: ExportDeps = { loadAsset: async () => undefined, webpToPng: async (b) => b };

describe('empty landing URL', () => {
  it('new projects start without a landing URL', () => {
    expect(createProject('N', { platform: 'cm360' }).landingUrl).toBe('');
  });

  it.each(['adform', 'cm360', 'dv360', 'ttd'] as const)('%s: exports with only a reminder warning', async (id) => {
    const size = createSize(300, 250, { elements: [createText()] });
    const p = createProject('Empty', { platform: id, sizes: [size] });
    const r = await buildSizeZip(p, size.id, deps);
    const rs = runChecks({ project: p, size, adapter: getAdapter(id), manifest: r.manifest });
    expect(rs.filter((x) => x.level === 'error')).toEqual([]);
    expect(rs.filter((x) => x.level === 'warning').map((x) => x.ruleId)).toEqual(['landing-url']);
  });

  it('writes empty click tags for the ad server to fill in', () => {
    const size = createSize(300, 250);
    const cm = createProject('E', { platform: 'cm360', sizes: [size] });
    expect(getAdapter('cm360').injectHead(size, cm)).toContain('var clickTag = "";');
    const ad = createProject('E', { platform: 'adform', sizes: [size] });
    const manifest = JSON.parse(getAdapter('adform').extraFiles(size, ad)['manifest.json'] as string) as { clicktags: unknown };
    expect(manifest.clicktags).toEqual({ clickTAG: '' });
    expect(getAdapter('adform').injectClickScript(ad)).toContain("dhtml.getVar('clickTAG', \"\")");
    const t = createProject('E', { platform: 'ttd', sizes: [size] });
    expect(getAdapter('ttd').injectHead(size, t)).toContain('return window.clickTag || "";');
  });
});
