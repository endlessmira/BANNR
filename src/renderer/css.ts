import type { Paint, Radius, Shadow, TextShadow } from '@/model/types';

export type Decls = Record<string, string | number | undefined>;

export const round = (n: number, digits = 2): number => {
  const f = 10 ** digits;
  return Math.round((Number.isFinite(n) ? n : 0) * f) / f;
};
export const clamp = (n: number, min: number, max: number): number => Math.min(max, Math.max(min, n));
export const px = (n: number): string => {
  const r = round(n);
  return r === 0 ? '0' : `${r}px`;
};

export function decls(d: Decls): string {
  return Object.entries(d)
    .filter((e): e is [string, string | number] => e[1] !== undefined && e[1] !== '')
    .map(([k, v]) => `${k}:${v}`)
    .join(';');
}
export const rule = (selector: string, d: Decls): string => `${selector}{${decls(d)}}`;

/* ─── Sanitisers: user values never reach CSS unchecked ─── */

const HEX = /^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const COLOR_FN = /^(?:rgba?|hsla?)\(\s*[-0-9.%\s,/]+\)$/i;
const NAMED = /^[a-z]{3,20}$/i;

export function safeColor(value: string | undefined, fallback = 'transparent'): string {
  const v = value?.trim();
  if (!v) return fallback;
  return HEX.test(v) || COLOR_FN.test(v) || NAMED.test(v) ? v : fallback;
}

export const safeFontFamily = (f: string): string => f.replace(/[^\w\s-]/g, '').trim() || 'Arial';
export const fontStack = (f: string): string => `"${safeFontFamily(f)}",Arial,Helvetica,sans-serif`;

export const cssId = (id: string): string => {
  const s = id.replace(/[^a-zA-Z0-9_-]/g, '_');
  return /^[a-zA-Z_]/.test(s) ? s : `e_${s}`;
};

export const cssUrl = (u: string): string => u.replace(/["\\\n\r]/g, (c) => encodeURIComponent(c));

/* ─── Value builders ─── */

export function paintCss(p: Paint | undefined): string | undefined {
  if (!p) return undefined;
  if (p.kind === 'solid') return safeColor(p.color);
  const stops = [...p.stops]
    .sort((a, b) => a.offset - b.offset)
    .map((s) => `${safeColor(s.color, '#000')} ${round(clamp(s.offset, 0, 1) * 100)}%`)
    .join(',');
  return `linear-gradient(${round(p.angle)}deg,${stops})`;
}

export function radiusCss(r: Radius | undefined): string | undefined {
  if (r === undefined) return undefined;
  if (typeof r === 'number') return r > 0 ? px(r) : undefined;
  return r.some((v) => v > 0) ? r.map((v) => px(v)).join(' ') : undefined;
}

export const shadowCss = (s: Shadow): string =>
  `${s.inset ? 'inset ' : ''}${px(s.x)} ${px(s.y)} ${px(s.blur)} ${px(s.spread)} ${safeColor(s.color, '#000')}`;

export const textShadowCss = (s: TextShadow): string =>
  `${px(s.x)} ${px(s.y)} ${px(s.blur)} ${safeColor(s.color, '#000')}`;
