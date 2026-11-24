import type { BannerElement, ID, Project, Size } from '@/model/types';

const r2 = (n: number): number => Math.round(n * 100) / 100;

/** Depth-first search through elements and group children. */
export function findElement(elements: readonly BannerElement[], id: ID): BannerElement | undefined {
  for (const el of elements) {
    if (el.id === id) return el;
    if (el.type === 'group') {
      const hit = findElement(el.children, id);
      if (hit) return hit;
    }
  }
  return undefined;
}

export function findSize(project: Project, sizeId: ID | null): Size | undefined {
  return sizeId ? project.sizes.find((s) => s.id === sizeId) : undefined;
}

/** Removes elements (at any depth) by id. Mutates: use inside an Immer recipe. Returns the count removed. */
export function removeElements(elements: BannerElement[], ids: ReadonlySet<ID>): number {
  let removed = 0;
  for (let i = elements.length - 1; i >= 0; i--) {
    const el = elements[i];
    if (!el) continue;
    if (ids.has(el.id)) {
      elements.splice(i, 1);
      removed++;
    } else if (el.type === 'group') {
      removed += removeElements(el.children, ids);
    }
  }
  return removed;
}

export interface FramePatch { x?: number; y?: number; width?: number; height?: number }

/**
 * Sets an element's position/size. Resizing a group scales its children's geometry,
 * so the group's content follows the new frame. Mutates (use inside an Immer recipe).
 */
export function setFrame(el: BannerElement, patch: FramePatch): void {
  const w = Math.max(1, patch.width ?? el.width);
  const h = Math.max(1, patch.height ?? el.height);
  if (el.type === 'group' && el.width > 0 && el.height > 0 && (w !== el.width || h !== el.height)) {
    const sx = w / el.width;
    const sy = h / el.height;
    for (const c of el.children) {
      setFrame(c, { width: c.width * sx, height: c.height * sy });
      c.x = r2(c.x * sx);
      c.y = r2(c.y * sy);
    }
  }
  if (patch.x !== undefined) el.x = r2(patch.x);
  if (patch.y !== undefined) el.y = r2(patch.y);
  el.width = r2(w);
  el.height = r2(h);
}
