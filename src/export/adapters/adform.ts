import { PLATFORM_LABELS } from '@/model/platforms';
import type { Project, Size } from '@/model/types';
import { jsString } from '@/renderer/escape';
import { BASE_EXTENSIONS, check, entryText } from './common';
import type { PlatformAdapter } from './types';

/**
 * ADFORM
 * Spec: https://www.adformhelp.com/  (TODO: link the exact HTML5 banner spec article)
 * From search summaries (not verified on the official page): manifest.json at the zip root, clickTAG read
 * with dhtml.getVar(), the DHTML library loaded in the head, ~150 KB recommended zip size.
 * NOT verified: the hard zip limit (300 KB assumed), file count (100 assumed), allowed file types
 * (CM360 list assumed), and the DHTML event-tracking call (added in Phase 7, when components emit events).
 */
const SPEC_URL = 'https://www.adformhelp.com/';

/** Exactly as in Adform's docs. The escaped closing tag inside document.write must stay as it is. */
const DHTML_LOADER =
  `<script>document.write('<script src="'+ (window.API_URL || 'https://s1.adform.net/banners/scripts/rmb/Adform.DHTML.js?bv=' + Math.random()) +'"><\\/script>');<\/script>`;

export function adformManifest(size: Size, project: Project): string {
  return JSON.stringify({
    version: '1.0',
    title: project.name,
    description: '',
    width: String(Math.round(size.width)),
    height: String(Math.round(size.height)),
    events: { enabled: 1, list: {} },
    clicktags: { clickTAG: project.landingUrl },
    source: 'index.html',
  }, null, 2);
}

interface Manifest { source?: unknown; clicktags?: Record<string, unknown> }

export const adform: PlatformAdapter = {
  id: 'adform',
  label: PLATFORM_LABELS.adform,
  specUrl: SPEC_URL,
  injectHead: () => DHTML_LOADER,
  injectClickScript: (project) => [
    '<script>',
    `var clickTAGvalue = dhtml.getVar('clickTAG', ${jsString(project.landingUrl)});`,
    "var landingpagetarget = dhtml.getVar('landingPageTarget', '_blank');",
    'bannr.exit = function(){ window.open(clickTAGvalue, landingpagetarget); };',
    '<\/script>',
  ].join('\n'),
  extraFiles: (size, project) => ({ 'manifest.json': adformManifest(size, project) }),
  validate: (zip) => {
    const html = entryText(zip, 'index.html') ?? '';
    const raw = entryText(zip, 'manifest.json');
    let m: Manifest | null = null;
    try {
      m = raw === undefined ? null : (JSON.parse(raw) as Manifest);
    } catch {
      m = null;
    }
    return [
      check('adform-manifest', m !== null, 'manifest.json is at the zip root',
        raw === undefined ? 'manifest.json is missing from the zip root' : 'manifest.json is not valid JSON'),
      check('adform-manifest-source', m?.source === 'index.html',
        'manifest.json points to index.html', 'manifest.json must have "source": "index.html"'),
      check('adform-manifest-clicktag', typeof m?.clicktags?.clickTAG === 'string',
        'manifest.json defines clickTAG', 'manifest.json must define clicktags.clickTAG'),
      check('adform-dhtml', html.includes('Adform.DHTML.js'),
        'The Adform DHTML library is loaded', 'The Adform DHTML library is missing from the head'),
      check('click-tag', html.includes("dhtml.getVar('clickTAG'"),
        'clickTAG is read with dhtml.getVar()', "clickTAG must be read with dhtml.getVar('clickTAG', …)"),
    ];
  },
  constraints: {
    maxZipKB: 300, recommendedZipKB: 150, maxFiles: 100,
    allowedExtensions: BASE_EXTENSIONS, allowedExternalHosts: ['s1.adform.net'],
  },
  // Preview: never load Adform's script; dhtml.getVar() returns the fallback URL.
  previewGlobals: "window.API_URL='data:text/javascript,';window.dhtml=window.dhtml||{getVar:function(n,d){return d;}};",
};
