import { cloneElement, createButton, createShape, createText } from '@/model/factories';
import type { BannerElement, ID, Size } from '@/model/types';
import { type AlignMode, aabb, alignDelta, distributeDeltas, unionRect } from './geometry';
import { type SizeMutator, mutateSize } from './mutate';
import { findSize } from './ops';
import { type UpdateOptions, useEditorStore } from './store/editorStore';

type Delta = { dx: number; dy: number };
const r2 = (n: number) => Math.round(n * 100) / 100;

function activeSize(): Size | undefined {
  const s = useEditorStore.getState();
  return s.project ? findSize(s.project, s.activeSizeId) : undefined;
}

function edit(fn: SizeMutator, opts?: UpdateOptions): void {
  const { activeSizeId, update } = useEditorStore.getState();
  if (activeSizeId) update((d) => mutateSize(d, activeSizeId, fn), opts);
}

function selectedTopLevel(includeLocked: boolean): BannerElement[] {
  const size = activeSize();
  if (!size) return [];
  const sel = new Set(useEditorStore.getState().selection);
  return size.elements.filter((el) => sel.has(el.id) && (includeLocked || !el.locked));
}

/** Selected, unlocked, top-level elements of the active size. */
export const editableSelection = (): BannerElement[] => selectedTopLevel(false);

const maxZ = (size: Size): number => size.elements.reduce((m, e) => Math.max(m, e.zIndex), 0);

function moveBy(deltas: Map<ID, Delta>, opts?: UpdateOptions): void {
  if (deltas.size === 0) return;
  edit((s) => {
    for (const el of s.elements) {
      const d = deltas.get(el.id);
      if (d) { el.x = r2(el.x + d.dx); el.y = r2(el.y + d.dy); }
    }
  }, opts);
}

export type NewElementKind = 'text' | 'rect' | 'ellipse' | 'button';

export function addElement(kind: NewElementKind): void {
  const size = activeSize();
  if (!size) return;
  const el: BannerElement =
    kind === 'text' ? createText({ text: 'Your headline' })
    : kind === 'button' ? createButton()
    : createShape({ shape: kind === 'ellipse' ? 'ellipse' : 'rect', width: 80, height: 80 });
  el.width = Math.min(el.width, size.width);
  el.height = Math.min(el.height, size.height);
  el.x = Math.round((size.width - el.width) / 2);
  el.y = Math.round((size.height - el.height) / 2);
  el.zIndex = maxZ(size) + 1;
  edit((s) => { s.elements.push(el); });
  useEditorStore.getState().select([el.id]);
}

export function nudge(dx: number, dy: number): void {
  moveBy(new Map(editableSelection().map((el): [ID, Delta] => [el.id, { dx, dy }])), { coalesceKey: 'nudge' });
}

/** One element aligns to the banner; several align to their combined bounds. */
export function align(mode: AlignMode): void {
  const size = activeSize();
  const els = editableSelection();
  if (!size || els.length === 0) return;
  const rects = els.map((el) => aabb(el));
  const bounds = els.length === 1 ? { x: 0, y: 0, width: size.width, height: size.height } : unionRect(rects);
  if (!bounds) return;
  moveBy(new Map(els.map((el, i): [ID, Delta] => [el.id, alignDelta(rects[i]!, bounds, mode)])));
}

export function distribute(axis: 'x' | 'y'): void {
  const els = editableSelection();
  if (els.length < 3) return;
  const d = distributeDeltas(els.map((el) => aabb(el)), axis);
  moveBy(new Map(els.map((el, i): [ID, Delta] => [el.id, axis === 'x' ? { dx: d[i] ?? 0, dy: 0 } : { dx: 0, dy: d[i] ?? 0 }])));
}

function insertCopies(size: Size, source: readonly BannerElement[], offset: number): void {
  const z = maxZ(size);
  const copies = [...source]
    .sort((a, b) => a.zIndex - b.zIndex)
    .map((el, i) => {
      const c = cloneElement(el);
      c.x = r2(c.x + offset);
      c.y = r2(c.y + offset);
      c.zIndex = z + 1 + i;
      c.locked = false;
      c.hidden = false;
      return c;
    });
  edit((s) => { s.elements.push(...copies); });
  useEditorStore.getState().select(copies.map((c) => c.id));
}

// In-app clipboard: works across sizes of the same project and across projects.
let clipboard: { sizeId: ID; elements: BannerElement[] } | null = null;
let pasteCount = 0;

export function copySelection(): boolean {
  const size = activeSize();
  const els = selectedTopLevel(true);
  if (!size || els.length === 0) return false;
  clipboard = { sizeId: size.id, elements: structuredClone(els) };
  pasteCount = 0;
  return true;
}

export function cutSelection(): void {
  if (!copySelection()) return;
  pasteCount = -1; // first paste after a cut lands in the original position
  useEditorStore.getState().deleteSelection();
}

export function paste(): void {
  const size = activeSize();
  if (!size || !clipboard || clipboard.elements.length === 0) return;
  let offset = 0;
  if (clipboard.sizeId === size.id) {
    pasteCount += 1;
    offset = 10 * pasteCount;
  }
  insertCopies(size, clipboard.elements, offset);
}

export function duplicateSelection(): void {
  const size = activeSize();
  const els = selectedTopLevel(true);
  if (size && els.length > 0) insertCopies(size, els, 10);
}

export function selectAll(): void {
  const size = activeSize();
  if (size) useEditorStore.getState().select(size.elements.filter((el) => !el.locked && !el.hidden).map((el) => el.id));
}
