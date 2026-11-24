import type { FontFaceRef } from './types';

export const ACCEPT_FONTS = '.woff2,.woff,.ttf,.otf';
export const FONT_WEIGHTS = [100, 200, 300, 400, 500, 600, 700, 800, 900] as const;
export const GOOGLE_CSS = 'https://fonts.googleapis.com/css2';
const GSTATIC = 'https://fonts.gstatic.com/';

/** Suggestions only: any Google Font name can be typed. */
export const POPULAR_GOOGLE_FONTS: readonly string[] = [
  'Roboto', 'Open Sans', 'Montserrat', 'Lato', 'Poppins', 'Inter', 'Oswald', 'Raleway', 'Nunito', 'Playfair Display',
  'Merriweather', 'Rubik', 'Work Sans', 'Noto Sans', 'Source Sans 3', 'PT Sans', 'Bebas Neue', 'Anton', 'Archivo',
  'DM Sans', 'Manrope', 'Barlow', 'Fira Sans', 'Ubuntu', 'Kanit', 'Lora', 'Josefin Sans', 'Quicksand', 'Mulish', 'Space Grotesk',
];

const FONT_MIME: Record<string, string> = { woff2: 'font/woff2', woff: 'font/woff', ttf: 'font/ttf', otf: 'font/otf' };

export function fontMime(fileNameOrUrl: string): string | null {
  const ext = fileNameOrUrl.split('?')[0]?.split('.').pop()?.toLowerCase() ?? '';
  return FONT_MIME[ext] ?? null;
}

const RANGE_PART = 'U\\+[0-9A-F?]{1,6}(?:-[0-9A-F]{1,6})?';
const UNICODE_RANGE = new RegExp(`^${RANGE_PART}(?:\\s*,\\s*${RANGE_PART})*$`, 'i');
/** Only plain unicode-range values may reach the CSS. */
export const isSafeUnicodeRange = (v: string): boolean => UNICODE_RANGE.test(v.trim());

/** Order matters: more specific words first. */
const WEIGHT_WORDS: ReadonlyArray<readonly [RegExp, number]> = [
  [/thin|hairline/, 100], [/extra-?light|ultra-?light/, 200], [/light/, 300], [/medium/, 500],
  [/semi-?bold|demi-?bold/, 600], [/extra-?bold|ultra-?bold/, 800], [/black|heavy/, 900], [/bold/, 700],
];

/** "OpenSans-SemiBoldItalic.woff2" → { family: "Open Sans", weight: 600, style: "italic" } */
export function guessFromFileName(fileName: string): { family: string; weight: number; style: 'normal' | 'italic' } {
  const base = fileName.replace(/\.[^.]+$/, '');
  const lower = base.toLowerCase();
  const style: 'normal' | 'italic' = /italic|oblique/.test(lower) ? 'italic' : 'normal';
  const weight = WEIGHT_WORDS.find(([re]) => re.test(lower))?.[1] ?? 400;
  const first = base.split(/[-_]/)[0] ?? base;
  const family = first
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\s+(thin|light|regular|medium|bold|black|italic)$/i, '')
    .trim();
  return { family: family || 'Custom font', weight, style };
}

const faceKey = (f: FontFaceRef): string => `${f.weight}|${f.style}|${f.unicodeRange ?? ''}`;

/** Merges faces; a new face replaces an existing one with the same weight, style and character range. */
export function mergeFaces(a: readonly FontFaceRef[], b: readonly FontFaceRef[]): FontFaceRef[] {
  const m = new Map<string, FontFaceRef>();
  for (const f of [...a, ...b]) m.set(faceKey(f), f);
  return [...m.values()].sort((x, y) => x.weight - y.weight || x.style.localeCompare(y.style));
}

/** Google Fonts CSS API v2 URL. Axis tuples must be sorted: normal before italic, weights ascending. */
export function googleCssUrl(family: string, weights: readonly number[], italic = false, normal = true): string {
  const ws = [...new Set(weights)].sort((a, b) => a - b);
  const fam = encodeURIComponent(family.trim()).replace(/%20/g, '+');
  const axis = italic
    ? `ital,wght@${[...(normal ? ws.map((w) => `0,${w}`) : []), ...ws.map((w) => `1,${w}`)].join(';')}`
    : `wght@${ws.join(';')}`;
  return `${GOOGLE_CSS}?family=${fam}:${axis}&display=swap`;
}

export interface GoogleFace {
  family: string;
  /** e.g. "latin", "latin-ext", "cyrillic"; "all" if Google didn't label it */
  subset: string;
  style: 'normal' | 'italic';
  weight: number;
  url: string;
  unicodeRange?: string;
}

const BLOCK = /(?:\/\*\s*([\w-]+)\s*\*\/\s*)?@font-face\s*\{([^}]*)\}/g;
const prop = (body: string, name: string): string | undefined =>
  new RegExp(`${name}\\s*:\\s*([^;]+);`).exec(body)?.[1]?.trim();

/** Reads the @font-face blocks Google sends. Only files hosted on fonts.gstatic.com are accepted. */
export function parseGoogleCss(css: string): GoogleFace[] {
  const out: GoogleFace[] = [];
  for (const m of css.matchAll(BLOCK)) {
    const body = m[2] ?? '';
    const url = /url\(\s*['"]?([^'")]+)['"]?\s*\)/.exec(body)?.[1];
    if (!url || !url.startsWith(GSTATIC)) continue;
    const weight = Number.parseInt(prop(body, 'font-weight') ?? '400', 10);
    const range = prop(body, 'unicode-range');
    out.push({
      family: (prop(body, 'font-family') ?? '').replace(/^['"]|['"]$/g, ''),
      subset: m[1] ?? 'all',
      style: prop(body, 'font-style') === 'italic' ? 'italic' : 'normal',
      weight: Number.isFinite(weight) ? weight : 400,
      url,
      ...(range && isSafeUnicodeRange(range) ? { unicodeRange: range } : {}),
    });
  }
  return out;
}
