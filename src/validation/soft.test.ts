import { describe, expect, it } from 'vitest';
import { getAdapter } from '@/export/adapters/registry';
import { type ExportDeps, buildSizeZip } from '@/export/pipeline';
import { createProject, createSize, createText } from '@/model/factories';
import { runChecks } from './rules';

const deps: ExportDeps = { loadAsset: async () => undefined, webpToPng: async (b) => b };

describe('over the zip size limit', () => {
  it('is a red error that does not block export', async () => {
    const size = createSize(300, 250, { elements: [createText()] });
    const p = createProject('S', { platform: 'ttd', sizes: [size], landingUrl: 'https://www.example.com' });
    const r = await buildSizeZip(p, size.id, deps);
    const rs = runChecks({ project: p, size, adapter: getAdapter('ttd'), manifest: { ...r.manifest, totalBytes: 400 * 1024 } });
    expect(rs.find((x) => x.ruleId === 'zip-size')).toMatchObject({ level: 'error', blocks: false });
    expect(rs.filter((x) => x.level === 'error' && x.blocks !== false)).toEqual([]);
  });
});
