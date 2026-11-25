/** Colour with an alpha channel. a: 0 (transparent) to 1 (opaque). */
export interface Rgba { r: number; g: number; b: number; a: number }

const clamp = (n: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, n));
const round2 = (n: number): number => Math.round(n * 100) / 100;

/** Reads #rgb, #rgba, #rrggbb, #rrggbbaa, rgb(), rgba() and "transparent". Other names return null. */
export function parseColor(value: string): Rgba | null {
  const s = value.trim().toLowerCase();
  if (s === 'transparent') return { r: 0, g: 0, b: 0, a: 0 };
  const short = /^#([0-9a-f]{3,4})$/.exec(s);
  if (short) {
    const d = (short[1] ?? '').split('').map((c) => parseInt(c + c, 16));
    return { r: d[0] ?? 0, g: d[1] ?? 0, b: d[2] ?? 0, a: d[3] === undefined ? 1 : round2(d[3] / 255) };
  }
  const long = /^#([0-9a-f]{6}|[0-9a-f]{8})$/.exec(s);
  if (long) {
    const x = long[1] ?? '';
    const p = (i: number): number => parseInt(x.slice(i, i + 2), 16);
    return { r: p(0), g: p(2), b: p(4), a: x.length === 8 ? round2(p(6) / 255) : 1 };
  }
  const fn = /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)(%?)\s*)?\)$/.exec(s);
  if (fn) {
    const n = (i: number): number => clamp(Number(fn[i]), 0, 255);
    const raw = fn[4] === undefined ? 1 : Number(fn[4]) / (fn[5] === '%' ? 100 : 1);
    return { r: n(1), g: n(2), b: n(3), a: clamp(round2(raw), 0, 1) };
  }
  return null;
}

const hex2 = (n: number): string => clamp(Math.round(n), 0, 255).toString(16).padStart(2, '0');

/** #rrggbb, ignoring alpha (for the native colour picker). */
export const toHex = (c: Rgba): string => `#${hex2(c.r)}${hex2(c.g)}${hex2(c.b)}`;

/** Opaque colours stay plain hex (no change for existing projects); others become rgba(). */
export function formatColor(c: Rgba): string {
  const a = clamp(round2(c.a), 0, 1);
  return a >= 1 ? toHex(c) : `rgba(${Math.round(c.r)},${Math.round(c.g)},${Math.round(c.b)},${a})`;
}
