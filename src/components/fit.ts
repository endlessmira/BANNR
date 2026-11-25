import type { Size } from '@/model/types';
import { getComponent } from './registry';
import type { ComponentCategory, ComponentDefinition } from './types';

/**
 * How well a component suits a banner size.
 * - unsupported: the banner is below the component's minimum size (the checklist blocks export).
 * - tight: a very different shape than the sizes it is designed for, or small for it (a warning).
 * - ok: one of its recommended sizes, or a similar shape with enough room.
 */
export type FitLevel = 'ok' | 'tight' | 'unsupported';
export interface SizeFit { level: FitLevel; reason: string; suggestion: string }

const SUGGEST: Record<ComponentCategory, string> = {
  motion: 'Check that the motion still reads well, or use a static image on this size.',
  '3d': 'Use a Carousel, or a static image of the first face, on this size.',
  carousel: 'Show fewer items (e.g. Classic instead of Double), or use a single product image on this size.',
  reveal: 'Use a static image of the revealed content on this size.',
  widget: 'Lower the font size, or hide the component on this size.',
  game: 'Replace the game with a static end screen and CTA on this size.',
};

const OK: SizeFit = { level: 'ok', reason: '', suggestion: '' };
const dims = (w: number, h: number): string => `${Math.round(w)}×${Math.round(h)}`;

function parse(s: string): [number, number] | null {
  const m = /^(\d+)x(\d+)$/.exec(s);
  return m ? [Number(m[1]), Number(m[2])] : null;
}

export function sizeFit(def: ComponentDefinition, width: number, height: number): SizeFit {
  const w = Math.round(width);
  const h = Math.round(height);
  const suggestion = SUGGEST[def.category];
  const min = def.minSize;
  if (w < min.width || h < min.height) {
    return { level: 'unsupported', reason: `${def.label} needs a banner of at least ${dims(min.width, min.height)}.`, suggestion };
  }
  if (def.recommendedSizes.includes(`${w}x${h}`)) return OK;
  const rec = def.recommendedSizes.map(parse).filter((d): d is [number, number] => d !== null);
  if (rec.length > 0) {
    const r = Math.log(w / h);
    const closest = Math.min(...rec.map(([a, b]) => Math.abs(r - Math.log(a / b))));
    if (closest > Math.log(2)) {
      return {
        level: 'tight',
        reason: `${def.label} is designed for ${rec.map(([a, b]) => dims(a, b)).join(', ')}. ${dims(w, h)} has a very different shape.`,
        suggestion,
      };
    }
  }
  if (w < min.width * 1.5 || h < min.height * 1.5) {
    return { level: 'tight', reason: `${dims(w, h)} is small for ${def.label} (minimum ${dims(min.width, min.height)}).`, suggestion };
  }
  return OK;
}

export interface SizeIssue extends SizeFit { id: string; name: string }

/** Fit problems of the visible top-level components in a size. */
export function sizeFitIssues(size: Size): SizeIssue[] {
  const out: SizeIssue[] = [];
  for (const el of size.elements) {
    if (el.type !== 'component' || el.hidden) continue;
    const def = getComponent(el.componentType);
    if (!def) continue;
    const f = sizeFit(def, size.width, size.height);
    if (f.level !== 'ok') out.push({ ...f, id: el.id, name: el.name });
  }
  return out;
}

const r2 = (v: number): number => Math.round(v * 100) / 100;
const clamp = (v: number, lo: number, hi: number): number => Math.min(Math.max(lo, hi), Math.max(lo, v));

/**
 * After a size is generated from the master: components that came out below their minimum size are
 * enlarged to it (never larger than the banner), centred on the same spot and kept inside. Mutates.
 */
export function withComponentMins(size: Size): Size {
  for (const el of size.elements) {
    if (el.type !== 'component') continue;
    const def = getComponent(el.componentType);
    if (!def) continue;
    const w = Math.min(size.width, Math.max(el.width, def.minSize.width));
    const h = Math.min(size.height, Math.max(el.height, def.minSize.height));
    if (w === el.width && h === el.height) continue;
    const cx = el.x + el.width / 2;
    const cy = el.y + el.height / 2;
    el.width = r2(w);
    el.height = r2(h);
    el.x = r2(clamp(cx - w / 2, 0, size.width - w));
    el.y = r2(clamp(cy - h / 2, 0, size.height - h));
  }
  return size;
}
