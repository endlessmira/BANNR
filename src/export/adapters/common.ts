import type { Size } from '@/model/types';
import type { ValidationResult, ZipManifest } from './types';

/** File types CM360 accepts (from search summaries of Google's docs). Also assumed for Adform and DV360. */
export const BASE_EXTENSIONS: readonly string[] = [
  'html', 'htm', 'js', 'css', 'json', 'xml', 'jpg', 'jpeg', 'gif', 'png', 'svg', 'eot', 'otf', 'ttf', 'woff', 'woff2',
];
export const FONT_EXTENSIONS: readonly string[] = ['eot', 'otf', 'ttf', 'woff', 'woff2'];

export const adSizeMeta = (s: Size): string =>
  `<meta name="ad.size" content="width=${Math.round(s.width)},height=${Math.round(s.height)}">`;

export const entryText = (zip: ZipManifest, path: string): string | undefined =>
  zip.entries.find((e) => e.path === path)?.text;

/** Everything before the closing head tag. */
export function headOf(html: string): string {
  const i = html.indexOf('</head>');
  return i < 0 ? html : html.slice(0, i);
}

export function check(ruleId: string, ok: boolean, pass: string, fail: string): ValidationResult {
  return ok ? { ruleId, level: 'pass', message: pass } : { ruleId, level: 'error', message: fail };
}

/** CM360 / DV360 style: ad.size meta tag + a readable `var clickTag = "…"` in the head. */
export function clickTagVarChecks(zip: ZipManifest): ValidationResult[] {
  const head = headOf(entryText(zip, 'index.html') ?? '');
  return [
    check('ad-size-meta', head.includes('<meta name="ad.size"'),
      'The ad.size meta tag is in the head', 'The ad.size meta tag is missing from the head'),
    check('click-tag', /var clickTag = "[^"]+";/.test(head),
      'clickTag is declared in the head with the exact casing "clickTag"',
      'clickTag must be declared in the head as: var clickTag = "…";'),
  ];
}
