import { cloneElement, createSize } from './factories';
import type { BannerElement, BoxStyle, Size, TextStyle } from './types';

const r2 = (n: number): number => Math.round(n * 100) / 100;
const MIN_FONT = 6;
/** Images and rectangles covering at least this share of both dimensions count as backgrounds and are stretched. */
const FILL_RATIO = 0.9;

export interface Dimensions { width: number; height: number }

function scaleText(t: TextStyle, s: number): void {
  t.fontSize = Math.max(MIN_FONT, r2(t.fontSize * s));
  t.letterSpacing = r2(t.letterSpacing * s);
  if (t.textShadow) {
    t.textShadow.x = r2(t.textShadow.x * s);
    t.textShadow.y = r2(t.textShadow.y * s);
    t.textShadow.blur = r2(t.textShadow.blur * s);
  }
}

function scaleBox(b: BoxStyle | undefined, s: number): void {
  if (!b) return;
  if (b.stroke && b.stroke.width > 0) b.stroke.width = Math.max(1, r2(b.stroke.width * s));
  if (typeof b.radius === 'number') b.radius = r2(b.radius * s);
  else if (b.radius) b.radius = b.radius.map((v) => r2(v * s)) as [number, number, number, number];
  if (b.shadows) {
    for (const sh of b.shadows) {
      sh.x = r2(sh.x * s);
      sh.y = r2(sh.y * s);
      sh.blur = r2(sh.blur * s);
      sh.spread = r2(sh.spread * s);
    }
  }
}

/** Scales an element's inner metrics: fonts, strokes, radii, shadows, padding, group children. Mutates. */
export function scaleContent(el: BannerElement, s: number): void {
  switch (el.type) {
    case 'text':
      scaleText(el.textStyle, s);
      scaleBox(el.box, s);
      break;
    case 'button':
      scaleText(el.textStyle, s);
      scaleBox(el.box, s);
      el.padding = { x: r2(el.padding.x * s), y: r2(el.padding.y * s) };
      break;
    case 'image':
    case 'shape':
      scaleBox(el.box, s);
      break;
    case 'group':
      for (const c of el.children) {
        c.x = r2(c.x * s);
        c.y = r2(c.y * s);
        c.width = r2(c.width * s);
        c.height = r2(c.height * s);
        scaleContent(c, s);
      }
      break;
  }
}

const isBackgroundLike = (el: BannerElement, from: Dimensions): boolean =>
  (el.type === 'image' || el.type === 'component' || (el.type === 'shape' && el.shape === 'rect')) &&
  el.width >= from.width * FILL_RATIO &&
  el.height >= from.height * FILL_RATIO;

/**
 * Adapts one element to a new banner size (a deep copy with a new id).
 * - Background-like images/rectangles stretch to fill the new size.
 * - Everything else scales uniformly (so nothing distorts), keeps its relative
 *   position, and stays inside the banner if it started inside.
 */
export function adaptElement(el: BannerElement, from: Dimensions, to: Dimensions): BannerElement {
  const sx = to.width / from.width;
  const sy = to.height / from.height;
  const s = Math.min(sx, sy);
  const c = cloneElement(el);

  if (isBackgroundLike(el, from)) {
    c.x = r2(el.x * sx);
    c.y = r2(el.y * sy);
    c.width = r2(el.width * sx);
    c.height = r2(el.height * sy);
    scaleContent(c, s);
    return c;
  }

  const w = el.width * s;
  const h = el.height * s;
  let x = (el.x + el.width / 2) * sx - w / 2;
  let y = (el.y + el.height / 2) * sy - h / 2;
  const inside = el.x >= 0 && el.y >= 0 && el.x + el.width <= from.width && el.y + el.height <= from.height;
  if (inside) {
    x = Math.min(Math.max(0, x), Math.max(0, to.width - w));
    y = Math.min(Math.max(0, y), Math.max(0, to.height - h));
  }
  c.x = r2(x);
  c.y = r2(y);
  c.width = r2(w);
  c.height = r2(h);
  scaleContent(c, s);
  return c;
}

/** A new size generated from the master layout. The master itself is never changed. */
export function adaptSize(master: Size, width: number, height: number): Size {
  return createSize(width, height, {
    background: structuredClone(master.background),
    border: { ...master.border },
    animationSettings: { ...master.animationSettings },
    elements: master.elements.map((el) => adaptElement(el, master, { width, height })),
    derivedFrom: master.id,
  });
}

/** An empty size that keeps the master's background, border and animation settings. */
export function blankSize(master: Size | undefined, width: number, height: number): Size {
  return createSize(width, height, master
    ? {
        background: structuredClone(master.background),
        border: { ...master.border },
        animationSettings: { ...master.animationSettings },
      }
    : {});
}
