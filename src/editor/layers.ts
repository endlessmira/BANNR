import { createGroup } from '@/model/factories';
import type { BannerElement, GroupElement, ID, Size } from '@/model/types';
import { aabb, normalizeAngle, unionRect } from './geometry';
import { mutateSize } from './mutate';
import { findElement, findSize } from './ops';
import { type UpdateOptions, useEditorStore } from './store/editorStore';

const r2 = (n: number): number => Math.round(n * 100) / 100;

/** Elements in paint order, bottom → top (zIndex, ties keep document order). */
export function stackOrder<T extends BannerElement>(elements: readonly T[]): T[] {
  return elements
    .map((el, i) => ({ el, i }))
    .sort((a, b) => a.el.zIndex - b.el.zIndex || a.i - b.i)
    .map((x) => x.el);
}

/** Writes the new order back with clean zIndex values 0..n-1. */
function restack(size: Size, ordered: BannerElement[]): void {
  ordered.forEach((el, i) => { el.zIndex = i; });
  size.elements = ordered;
}

function editActive(fn: (size: Size) => void, opts?: UpdateOptions): void {
  const { activeSizeId, update } = useEditorStore.getState();
  if (activeSizeId) update((d) => mutateSize(d, activeSizeId, fn), opts);
}

function activeSize(): Size | undefined {
  const s = useEditorStore.getState();
  return s.project ? findSize(s.project, s.activeSizeId) : undefined;
}

/** Moves a top-level layer to a stack index (0 = bottom). Used by drag-and-drop in the Layers panel. */
export function moveLayer(id: ID, toIndex: number): void {
  editActive((s) => {
    const ordered = stackOrder(s.elements);
    const from = ordered.findIndex((e) => e.id === id);
    const to = Math.max(0, Math.min(ordered.length - 1, toIndex));
    if (from < 0 || from === to) return;
    const [el] = ordered.splice(from, 1);
    if (!el) return;
    ordered.splice(to, 0, el);
    restack(s, ordered);
  });
}

export type ArrangeMode = 'forward' | 'backward' | 'front' | 'back';

export function arrange(mode: ArrangeMode): void {
  const sel = new Set(useEditorStore.getState().selection);
  editActive((s) => {
    const ordered = stackOrder(s.elements);
    if (!ordered.some((e) => sel.has(e.id))) return;
    let next: BannerElement[];
    if (mode === 'front' || mode === 'back') {
      const picked = ordered.filter((e) => sel.has(e.id));
      const rest = ordered.filter((e) => !sel.has(e.id));
      next = mode === 'front' ? [...rest, ...picked] : [...picked, ...rest];
    } else {
      next = [...ordered];
      const step = mode === 'forward' ? 1 : -1;
      const idxs = next.map((e, i) => (sel.has(e.id) ? i : -1)).filter((i) => i >= 0);
      if (step === 1) idxs.reverse();
      for (const i of idxs) {
        const j = i + step;
        const other = next[j];
        const self = next[i];
        if (!other || !self || sel.has(other.id)) continue;
        next[i] = other;
        next[j] = self;
      }
    }
    if (next.every((e, i) => e === ordered[i])) return;
    restack(s, next);
  });
}

export function toggleLayer(id: ID, key: 'hidden' | 'locked'): void {
  editActive((s) => {
    const el = findElement(s.elements, id);
    if (el) el[key] = !el[key];
  });
}

export function renameLayer(id: ID, name: string): void {
  editActive((s) => {
    const el = findElement(s.elements, id);
    if (el && el.name !== name) el.name = name;
  });
}

/** Groups 2+ selected, unlocked top-level layers. Nothing moves on screen. */
export function groupSelection(): void {
  const size = activeSize();
  if (!size) return;
  const sel = new Set(useEditorStore.getState().selection);
  const picked = stackOrder(size.elements).filter((e) => sel.has(e.id) && !e.locked);
  if (picked.length < 2) return;
  const b = unionRect(picked.map((e) => aabb(e)));
  if (!b) return;
  const children = picked.map((e, i) => {
    const c = structuredClone(e);
    c.x = r2(e.x - b.x);
    c.y = r2(e.y - b.y);
    c.zIndex = i;
    return c;
  });
  const groupCount = size.elements.filter((e) => e.type === 'group').length;
  const group = createGroup(children, {
    name: `Group ${groupCount + 1}`, x: r2(b.x), y: r2(b.y), width: r2(b.width), height: r2(b.height),
  });
  const ids = new Set(picked.map((p) => p.id));
  editActive((s) => {
    const ordered = stackOrder(s.elements);
    const topIdx = Math.max(...ordered.map((e, i) => (ids.has(e.id) ? i : -1)));
    const next: BannerElement[] = [];
    ordered.forEach((e, i) => {
      if (!ids.has(e.id)) next.push(e);
      if (i === topIdx) next.push(group);
    });
    restack(s, next);
  });
  useEditorStore.getState().select([group.id]);
}

/** Converts a group's children to banner coordinates, keeping their exact on-screen position. */
export function releaseChildren(g: GroupElement): BannerElement[] {
  const rad = (g.rotation * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const gcx = g.width / 2;
  const gcy = g.height / 2;
  return stackOrder(g.children).map((c) => {
    const k = structuredClone(c);
    const ox = c.x + c.width / 2 - gcx;
    const oy = c.y + c.height / 2 - gcy;
    const cx = g.x + gcx + ox * cos - oy * sin;
    const cy = g.y + gcy + ox * sin + oy * cos;
    k.x = r2(cx - c.width / 2);
    k.y = r2(cy - c.height / 2);
    k.rotation = normalizeAngle(c.rotation + g.rotation);
    k.opacity = Math.round(c.opacity * g.opacity * 1000) / 1000;
    k.hidden = c.hidden || g.hidden;
    return k;
  });
}

export function ungroupSelection(): void {
  const size = activeSize();
  if (!size) return;
  const sel = new Set(useEditorStore.getState().selection);
  const groups = size.elements.filter((e): e is GroupElement => e.type === 'group' && sel.has(e.id) && !e.locked);
  if (groups.length === 0) return;
  const replaced = new Map<ID, BannerElement[]>();
  const newIds: ID[] = [];
  for (const g of groups) {
    const kids = releaseChildren(g);
    replaced.set(g.id, kids);
    newIds.push(...kids.map((k) => k.id));
  }
  editActive((s) => {
    const next: BannerElement[] = [];
    for (const e of stackOrder(s.elements)) {
      const kids = replaced.get(e.id);
      if (kids) next.push(...kids);
      else next.push(e);
    }
    restack(s, next);
  });
  useEditorStore.getState().select(newIds);
}
