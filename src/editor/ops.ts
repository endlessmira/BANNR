import type { BannerElement, ID, Project, Size } from '@/model/types';

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
