import { describe, expect, it } from 'vitest';
import { getAdapter } from '@/export/adapters/registry';
import type { ValidationLevel, ValidationResult, ZipManifest } from '@/export/adapters/types';
import { type ExportDeps, buildSizeZip } from '@/export/pipeline';
import { createComponent, createProject, createSize, createText } from '@/model/factories';
import type { PlatformId, Project, Size } from '@/model/types';
import { externalUrls, runChecks } from './rules';

const deps: ExportDeps = { loadAsset: async () => undefined, webpToPng: async (b) => b };

function project(platform: PlatformId): Project {
  const size = createSize(300, 250, { elements: [createText({ id: 'eT' })] });
  return createProject('Checks', { platform, sizes: [size], landingUrl: 'https://www.example.com' });
}
async function built(p: Project): Promise<{ size: Size; manifest: ZipManifest }> {
  const size = p.sizes[0]!;
  const r = await buildSizeZip(p, size.id, deps);
  return { size, manifest: r.manifest };
}
const check = (p: Project, size: Size, manifest: ZipManifest, missingAssets: string[] = []) =>
  runChecks({ project: p, size, adapter: getAdapter(p.selectedPlatform), manifest, missingAssets });
const ids = (rs: ValidationResult[], level: ValidationLevel): string[] => rs.filter((r) => r.level === level).map((r) => r.ruleId);
const withHtml = (m: ZipManifest, fn: (h: string) => string): ZipManifest => ({
  ...m, entries: m.entries.map((e) => (e.path === 'index.html' ? { ...e, text: fn(e.text ?? '') } : e)),
});

describe('pre-export checks', () => {
  it.each(['adform', 'cm360', 'dv360', 'ttd'] as const)('%s: a simple banner has no errors or warnings', async (id) => {
    const p = project(id);
    const { size, manifest } = await built(p);
    const rs = check(p, size, manifest);
    expect(ids(rs, 'error')).toEqual([]);
    expect(ids(rs, 'warning')).toEqual([]);
    expect(ids(rs, 'pass')).toEqual(expect.arrayContaining([
      'index-html', 'zip-size', 'exit-defined', 'exit-only', 'exit-hardcoded', 'external-requests', 'click-tag',
    ]));
  });

  it('finds external resources but ignores plain links', () => {
    expect(externalUrls('<img src="https://cdn.x.com/a.png"> var clickTag = "https://shop.example.com/";'))
      .toEqual(['https://cdn.x.com/a.png']);
    expect(externalUrls(`document.write('<script src="'+(window.API_URL||'https://s1.adform.net/x/Adform.DHTML.js?bv='+1)+'">')`))
      .toEqual(['https://s1.adform.net/x/Adform.DHTML.js']);
  });

  it('blocks URLs opened outside bannr.exit() and hardcoded landing URLs', async () => {
    const p = project('cm360');
    const { size, manifest } = await built(p);
    const stray = withHtml(manifest, (h) => h.replace('</body>', '<script>window.open("https://x.com")</script></body>'));
    expect(ids(check(p, size, stray), 'error')).toContain('exit-only');
    const loc = withHtml(manifest, (h) => h.replace('</body>', '<script>top.location.href = "https://x.com";</script></body>'));
    expect(ids(check(p, size, loc), 'error')).toContain('exit-only');
    const hard = withHtml(manifest, (h) => h.replace("window.open(window.clickTag, '_blank')", `window.open("https://www.example.com", '_blank')`));
    expect(ids(check(p, size, hard), 'error')).toContain('exit-hardcoded');
    const none = withHtml(manifest, (h) => h.replace('bannr.exit = function', 'bannr.noop = function'));
    expect(ids(check(p, size, none), 'error')).toEqual(expect.arrayContaining(['exit-defined', 'exit-only']));
  });

  it('flags external requests', async () => {
    const p = project('cm360');
    const { size, manifest } = await built(p);
    const ext = withHtml(manifest, (h) => h.replace('</body>', '<img src="https://cdn.example.com/a.png"></body>'));
    expect(check(p, size, ext).find((r) => r.ruleId === 'external-requests'))
      .toMatchObject({ level: 'error', detail: 'https://cdn.example.com/a.png' });
  });

  it('checks file count, file types, size limits and missing files', async () => {
    const p = project('cm360');
    const { size, manifest } = await built(p);
    const many = { ...manifest, entries: [...manifest.entries, ...Array.from({ length: 100 }, (_, i) => ({ path: `images/${i}.png`, bytes: 1 }))] };
    expect(ids(check(p, size, many), 'error')).toContain('file-count');
    const webp = { ...manifest, entries: [...manifest.entries, { path: 'images/a.webp', bytes: 1 }] };
    expect(ids(check(p, size, webp), 'error')).toContain('file-types');
    expect(ids(check(p, size, { ...manifest, totalBytes: 400 * 1024 }), 'warning')).toContain('zip-target');
    p.settings.targetZipKB = 500;
    expect(ids(check(p, size, { ...manifest, totalBytes: 400 * 1024 }), 'warning')).not.toContain('zip-target');
    expect(ids(check(p, size, { ...manifest, totalBytes: 11000 * 1024 }), 'error')).toContain('zip-size');
    const noIndex = { ...manifest, entries: manifest.entries.filter((e) => e.path !== 'index.html') };
    expect(ids(check(p, size, noIndex), 'error')).toContain('index-html');
    expect(ids(check(p, size, manifest, ['aX']), 'error')).toContain('missing-assets');
  });

  it('ttd: font files are a warning, not an error', async () => {
    const p = project('ttd');
    const { size, manifest } = await built(p);
    const rs = check(p, size, { ...manifest, entries: [...manifest.entries, { path: 'fonts/a.woff2', bytes: 1 }] });
    expect(ids(rs, 'warning')).toContain('file-types');
    expect(ids(rs, 'error')).not.toContain('file-types');
  });

  it('checks animation limits, the landing URL and component layers', async () => {
    const p = project('dv360');
    p.sizes[0]!.animationSettings = { duration: 10, loops: 4 };
    const { size, manifest } = await built(p);
    expect(ids(check(p, size, manifest), 'error')).toEqual(expect.arrayContaining(['animation-length', 'animation-loops']));
    p.settings.maxAnimationSeconds = 60;
    p.settings.maxLoops = 5;
    expect(ids(check(p, size, manifest), 'error')).toEqual([]);
    p.landingUrl = 'http://example.com';
    expect(ids(check(p, size, manifest), 'warning')).toContain('landing-url');
    p.landingUrl = 'not a url';
    expect(ids(check(p, size, manifest), 'error')).toContain('landing-url');

    const pc = project('cm360');
    pc.sizes[0]!.elements.push(createComponent({ componentType: 'not-a-component' }));
    const b = await built(pc);
    expect(ids(check(pc, b.size, b.manifest), 'error')).toContain('component-unknown');
  });
});
