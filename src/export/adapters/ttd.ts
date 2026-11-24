import { PLATFORM_LABELS } from '@/model/platforms';
import { jsString } from '@/renderer/escape';
import { FONT_EXTENSIONS, adSizeMeta, check, entryText, headOf } from './common';
import type { PlatformAdapter } from './types';

/**
 * THE TRADE DESK
 * Spec: https://partner.thetradedesk.com/  (TODO: exact HTML5 creative spec page; partner portal, not verified)
 * From search summaries (not verified on the official page): 300 KB max initial load (200 KB recommended),
 * max 10 files at initial load (100 in total), types html/js/css/mp4/jpg/gif/png/svg, and a separate static
 * backup image of ~150 KB. TTD passes the click URL at serve time and defaults to the casing "clickTAG",
 * so the parameter name is matched case-insensitively. Font files are not on the type list: allowed with
 * a warning. BANNR banners load everything at once, so the initial-load limits apply to the whole banner.
 * Interaction tracking: no-op.
 */
const SPEC_URL = 'https://partner.thetradedesk.com/';

export const ttd: PlatformAdapter = {
  id: 'ttd',
  label: PLATFORM_LABELS.ttd,
  specUrl: SPEC_URL,
  injectHead: (size, project) => [
    adSizeMeta(size),
    '<script type="text/javascript">',
    'function getClickTag(){',
    '  var params = new URLSearchParams(window.location.search);',
    "  for (const [k, v] of params) { if (k.toLowerCase() === 'clicktag') return v; }",
    `  return window.clickTag || ${jsString(project.landingUrl)};`,
    '}',
    'var clickTag = getClickTag();',
    '<\/script>',
  ].join('\n'),
  injectClickScript: () =>
    `<script type="text/javascript">bannr.exit = function(){ window.open(clickTag, '_blank'); };<\/script>`,
  extraFiles: () => ({}),
  validate: (zip) => {
    const head = headOf(entryText(zip, 'index.html') ?? '');
    return [
      check('ad-size-meta', head.includes('<meta name="ad.size"'),
        'The ad.size meta tag is in the head', 'The ad.size meta tag is missing from the head'),
      check('click-tag', head.includes('function getClickTag()') && head.includes("toLowerCase() === 'clicktag'"),
        'The click URL is read from the URL query (clickTag, any casing)',
        'The TTD click-URL reader (getClickTag) is missing from the head'),
    ];
  },
  constraints: {
    maxZipKB: 300,
    maxFiles: 10,
    allowedExtensions: ['html', 'htm', 'js', 'css', 'mp4', 'jpg', 'jpeg', 'gif', 'png', 'svg'],
    warnExtensions: FONT_EXTENSIONS,
    allowedExternalHosts: [],
    backupMaxKB: 150,
  },
};
