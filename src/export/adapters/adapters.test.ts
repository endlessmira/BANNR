import { describe, expect, it } from 'vitest';
import { createProject, createSize, createText } from '@/model/factories';
import type { PlatformId } from '@/model/types';
import { renderBanner } from '@/renderer';
import { ADAPTERS, DEFAULT_TARGET_KB, getAdapter } from './registry';
import type { ZipManifest } from './types';

const LANDING = 'https://example.com/landing?a=1&b=2';
const IDS = ['adform', 'cm360', 'dv360', 'ttd'] as const;

function setup(platform: PlatformId) {
  const size = createSize(300, 250, { elements: [createText({ id: 'eT' })] });
  const project = createProject('Spring Sale', { platform, sizes: [size], landingUrl: LANDING });
  return { project, size };
}

/** index.html + text extra files, the way the exporter (Phase 5b) assembles them. */
function build(platform: PlatformId): ZipManifest {
  const { project, size } = setup(platform);
  const a = getAdapter(platform);
  const { html } = renderBanner(project, size.id, {
    resolveAsset: (id) => id,
    injection: { head: a.injectHead(size, project), bodyEnd: a.injectClickScript(project) },
  });
  const files: Record<string, string> = { 'index.html': html };
  for (const [path, v] of Object.entries(a.extraFiles(size, project))) if (typeof v === 'string') files[path] = v;
  const entries = Object.entries(files).map(([path, text]) => ({ path, text, bytes: new TextEncoder().encode(text).length }));
  return { entries, totalBytes: entries.reduce((s, e) => s + e.bytes, 0) };
}

const scriptBodies = (html: string): string[] =>
  [...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1] ?? '');

describe('platform adapters', () => {
  it('registers all four platforms under their own id', () => {
    expect(Object.keys(ADAPTERS).sort()).toEqual(['adform', 'cm360', 'dv360', 'ttd']);
    for (const id of IDS) expect(ADAPTERS[id].id).toBe(id);
    expect(ADAPTERS.dv360).not.toBe(ADAPTERS.cm360);
    expect(DEFAULT_TARGET_KB).toBe(300);
  });

  it.each(['cm360', 'dv360'] as const)('%s: exact head, click code and no extra files', (id) => {
    const { project, size } = setup(id);
    const a = getAdapter(id);
    expect(a.injectHead(size, project)).toBe(
      '<meta name="ad.size" content="width=300,height=250">\n' +
        '<script type="text/javascript">var clickTag = "https://example.com/landing?a=1&b=2";<\/script>',
    );
    expect(a.injectClickScript(project)).toBe(
      "<script type=\"text/javascript\">bannr.exit = function(){ window.open(window.clickTag, '_blank'); };<\/script>",
    );
    expect(a.extraFiles(size, project)).toEqual({});
  });

  it('adform: exact DHTML loader, click code and manifest.json', () => {
    const { project, size } = setup('adform');
    const a = getAdapter('adform');
    expect(a.injectHead(size, project)).toBe(
      `<script>document.write('<script src="'+ (window.API_URL || 'https://s1.adform.net/banners/scripts/rmb/Adform.DHTML.js?bv=' + Math.random()) +'"><\\/script>');<\/script>`,
    );
    expect(a.injectClickScript(project)).toBe([
      '<script>',
      "var clickTAGvalue = dhtml.getVar('clickTAG', \"https://example.com/landing?a=1&b=2\");",
      "var landingpagetarget = dhtml.getVar('landingPageTarget', '_blank');",
      'bannr.exit = function(){ window.open(clickTAGvalue, landingpagetarget); };',
      '<\/script>',
    ].join('\n'));
    const manifest = a.extraFiles(size, project)['manifest.json'];
    expect(typeof manifest).toBe('string');
    expect(JSON.parse(manifest as string)).toEqual({
      version: '1.0', title: 'Spring Sale', description: '', width: '300', height: '250',
      events: { enabled: 1, list: {} }, clicktags: { clickTAG: LANDING }, source: 'index.html',
    });
  });

  it('adform: a click opens the clickTAG that Adform serves', () => {
    const { project } = setup('adform');
    const body = scriptBodies(getAdapter('adform').injectClickScript(project))[0]!;
    const opened: unknown[][] = [];
    const bannr: { exit?: () => void } = {};
    const run = new Function('dhtml', 'bannr', 'window', body) as (d: unknown, b: unknown, w: unknown) => void;
    run(
      { getVar: (n: string, d: string) => (n === 'clickTAG' ? 'https://track.adform.example/c' : d) },
      bannr,
      { open: (...args: unknown[]) => { opened.push(args); } },
    );
    bannr.exit?.();
    expect(opened).toEqual([['https://track.adform.example/c', '_blank']]);
  });

  it('ttd: exact head and click code', () => {
    const { project, size } = setup('ttd');
    const a = getAdapter('ttd');
    expect(a.injectHead(size, project)).toBe([
      '<meta name="ad.size" content="width=300,height=250">',
      '<script type="text/javascript">',
      'function getClickTag(){',
      '  var params = new URLSearchParams(window.location.search);',
      "  for (const [k, v] of params) { if (k.toLowerCase() === 'clicktag') return v; }",
      '  return window.clickTag || "https://example.com/landing?a=1&b=2";',
      '}',
      'var clickTag = getClickTag();',
      '<\/script>',
    ].join('\n'));
    expect(a.injectClickScript(project)).toBe(
      "<script type=\"text/javascript\">bannr.exit = function(){ window.open(clickTag, '_blank'); };<\/script>",
    );
  });

  it('ttd: reads clickTag from the URL in any casing and falls back to the landing URL', () => {
    const { project, size } = setup('ttd');
    const body = scriptBodies(getAdapter('ttd').injectHead(size, project))[0]!;
    const run = new Function('window', `${body}\nreturn clickTag;`) as (w: unknown) => unknown;
    expect(run({ location: { search: '?ClickTAG=https%3A%2F%2Fttd.example%2Fc' } })).toBe('https://ttd.example/c');
    expect(run({ location: { search: '?clicktag=https://ttd.example/x' } })).toBe('https://ttd.example/x');
    expect(run({ location: { search: '' } })).toBe(LANDING);
  });

  it.each(IDS)('%s: a built banner passes its platform checks and opens URLs only in bannr.exit()', (id) => {
    const zip = build(id);
    const html = zip.entries.find((e) => e.path === 'index.html')!.text!;
    expect(getAdapter(id).validate(zip).filter((r) => r.level !== 'pass')).toEqual([]);
    expect(html.split('window.open').length - 1).toBe(1);
    const marker = id === 'adform' ? 'Adform.DHTML.js' : 'ad.size';
    expect(html.indexOf(marker)).toBeGreaterThan(-1);
    expect(html.indexOf(marker)).toBeLessThan(html.indexOf('</head>'));
  });

  it('adform: a missing manifest.json is an error', () => {
    const zip = build('adform');
    zip.entries = zip.entries.filter((e) => e.path !== 'manifest.json');
    expect(getAdapter('adform').validate(zip).find((r) => r.ruleId === 'adform-manifest')?.level).toBe('error');
  });

  it('constraints: TTD limits, fonts as a warning, WebP never allowed', () => {
    expect(ADAPTERS.ttd.constraints).toMatchObject({ maxZipKB: 300, maxFiles: 10, backupMaxKB: 150 });
    expect(ADAPTERS.ttd.constraints.warnExtensions).toContain('woff2');
    for (const id of IDS) expect(ADAPTERS[id].constraints.allowedExtensions).not.toContain('webp');
    expect(ADAPTERS.adform.constraints.allowedExternalHosts).toEqual(['s1.adform.net']);
    expect(ADAPTERS.cm360.constraints.maxFiles).toBe(100);
  });
});
