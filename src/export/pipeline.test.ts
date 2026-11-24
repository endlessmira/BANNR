import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';
import { createImage, createProject, createSize, createText } from '@/model/factories';
import type { AssetRef, PlatformId, Project } from '@/model/types';
import { getAdapter } from './adapters/registry';
import {
  type ExportDeps, allSizesName, buildMasterZip, buildSizeZip, exportBaseName, planAssetPaths, safeName,
} from './pipeline';

const bin = (n: number, type: string) => new Blob([new Uint8Array(n).fill(7)], { type });
const ref = (id: string, fileName: string, mimeType: string, kind: AssetRef['kind'] = 'image'): AssetRef =>
  ({ id, kind, fileName, mimeType, bytes: 10, hash: id });

function fixture(platform: PlatformId): Project {
  const size = createSize(300, 250, {
    elements: [
      createImage({ id: 'eLogo', assetId: 'aLogo' }),
      createImage({ id: 'eLogo2', assetId: 'aLogo2' }),
      createImage({ id: 'ePhoto', assetId: 'aPhoto' }),
      createImage({ id: 'eHidden', assetId: 'aHidden', hidden: true }),
      createText({
        id: 'eText', textStyle: { fontFamily: 'Brand' },
        animation: { in: { preset: 'fade', delay: 0, duration: 1, easing: 'ease-out' }, out: null },
      }),
    ],
  });
  const p = createProject('Jarní výprodej', { platform, sizes: [size], landingUrl: 'https://example.com/' });
  for (const r of [
    ref('aLogo', 'logo.png', 'image/png'), ref('aLogo2', 'logo.png', 'image/png'), ref('aPhoto', 'photo.webp', 'image/webp'),
    ref('aHidden', 'hidden.png', 'image/png'), ref('aUnused', 'unused.png', 'image/png'), ref('aFont', 'brand.woff2', 'font/woff2', 'font'),
  ]) p.assets[r.id] = r;
  p.fonts.push({ id: 'f1', family: 'Brand', source: 'upload', faces: [{ weight: 400, style: 'normal', assetId: 'aFont' }] });
  return p;
}

const deps = (skip: string[] = []): ExportDeps => ({
  loadAsset: async (id) => (skip.includes(id) ? undefined : bin(20, id === 'aFont' ? 'font/woff2' : 'image/png')),
  webpToPng: async () => bin(30, 'image/png'),
});

async function files(buf: ArrayBuffer) {
  const z = await JSZip.loadAsync(buf);
  return { z, names: Object.values(z.files).filter((f) => !f.dir).map((f) => f.name).sort() };
}

describe('export pipeline', () => {
  it('names files {{PROJECT_NAME}}_{{PLATFORM}}_{{WIDTH}}x{{HEIGHT}}', () => {
    expect(safeName('Spring Sale')).toBe('Spring-Sale');
    expect(safeName('Jarní výprodej!')).toBe('Jarni-vyprodej');
    expect(safeName('   ')).toBe('banner');
    const p = fixture('cm360');
    expect(exportBaseName(p, p.sizes[0]!)).toBe('Jarni-vyprodej_cm360_300x250');
    expect(allSizesName(p)).toBe('Jarni-vyprodej_cm360_all-sizes.zip');
  });

  it('plans unique relative paths, with WebP turned into PNG', () => {
    const plan = planAssetPaths(fixture('adform'));
    expect(plan.get('aLogo')?.path).toBe('images/logo.png');
    expect(plan.get('aLogo2')?.path).toBe('images/logo-2.png');
    expect(plan.get('aPhoto')).toEqual({ path: 'images/photo.png', convertWebp: true });
    expect(plan.get('aFont')?.path).toBe('fonts/brand.woff2');
  });

  it('adform: index.html and manifest.json at the root, only used assets, relative paths', async () => {
    const p = fixture('adform');
    const r = await buildSizeZip(p, p.sizes[0]!.id, deps());
    expect(r.fileName).toBe('Jarni-vyprodej_adform_300x250.zip');
    const { z, names } = await files(r.zip);
    expect(names).toEqual([
      'fonts/brand.woff2', 'images/logo-2.png', 'images/logo.png', 'images/photo.png', 'index.html', 'manifest.json',
    ]);
    const html = await z.file('index.html')!.async('string');
    expect(html).toContain('src="images/photo.png"');
    expect(html).toContain('url("fonts/brand.woff2")');
    expect(html).toContain('@keyframes');
    expect(html).not.toMatch(/data:|blob:/);
    expect(r.convertedWebp).toEqual(['photo.webp']);
    expect(r.missingAssets).toEqual([]);
    expect(r.manifest.totalBytes).toBe(r.zip.byteLength);
    expect(getAdapter('adform').validate(r.manifest).filter((x) => x.level !== 'pass')).toEqual([]);
  });

  it('cm360: no manifest, readable clickTag in the head, missing files reported', async () => {
    const p = fixture('cm360');
    const r = await buildSizeZip(p, p.sizes[0]!.id, deps(['aLogo']));
    const { z, names } = await files(r.zip);
    expect(names).not.toContain('manifest.json');
    expect(names).not.toContain('images/logo.png');
    expect(r.missingAssets).toEqual(['aLogo']);
    const html = await z.file('index.html')!.async('string');
    expect(html).toContain('<script type="text/javascript">var clickTag = "https://example.com/";<\/script>');
    expect(getAdapter('cm360').validate(r.manifest).filter((x) => x.level !== 'pass')).toEqual([]);
  });

  it('builds the all-sizes zip from size zips and backup images', async () => {
    const p = fixture('ttd');
    const r = await buildSizeZip(p, p.sizes[0]!.id, deps());
    const master = await buildMasterZip([r], [{ name: 'x_backup.jpg', blob: bin(5, 'image/jpeg') }]);
    const { names } = await files(master);
    expect(names).toEqual(['Jarni-vyprodej_ttd_300x250.zip', 'x_backup.jpg']);
  });
});
