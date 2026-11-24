import { adaptSize, blankSize } from '@/model/adapt';
import { STANDARD_SIZES, sizeKey } from '@/model/sizes';
import type { ID, Project, Size } from '@/model/types';
import { useEditorStore } from './store/editorStore';

export const MIN_DIM = 10;
export const MAX_DIM = 2000;

export interface Dim { width: number; height: number }
export type AddMode = 'master' | 'blank';
export interface AddResult { added: ID[]; skipped: string[] }

const labelFor = (w: number, h: number): string | undefined =>
  STANDARD_SIZES.find((s) => s.width === w && s.height === h)?.label;

/** The fixed 480×480 master. */
export function masterOf(p: Project): Size | undefined {
  return p.sizes.find((s) => s.id === p.masterSizeId) ?? p.sizes[0];
}

/** Adds sizes (one undo step). Duplicates (including 480×480) and out-of-range sizes are skipped. */
export function addSizes(dims: readonly Dim[], mode: AddMode): AddResult {
  const st = useEditorStore.getState();
  const p = st.project;
  if (!p) return { added: [], skipped: [] };
  const master = masterOf(p);
  const existing = new Set(p.sizes.map((s) => sizeKey(s.width, s.height)));
  const created: Size[] = [];
  const skipped: string[] = [];

  for (const d of dims) {
    const w = Math.round(d.width);
    const h = Math.round(d.height);
    const key = sizeKey(w, h);
    if (w < MIN_DIM || h < MIN_DIM || w > MAX_DIM || h > MAX_DIM || existing.has(key)) {
      skipped.push(key);
      continue;
    }
    existing.add(key);
    const size = mode === 'master' && master ? adaptSize(master, w, h) : blankSize(master, w, h);
    const label = labelFor(w, h);
    if (label) size.label = label;
    created.push(size);
  }

  const first = created[0];
  if (first) {
    st.update((d) => { d.sizes.push(...created); });
    useEditorStore.getState().setActiveSize(first.id);
  }
  return { added: created.map((s) => s.id), skipped };
}

/** Deletes a size (undoable). The master can never be deleted. */
export function removeSize(id: ID): boolean {
  const st = useEditorStore.getState();
  const p = st.project;
  if (!p || id === p.masterSizeId || !p.sizes.some((s) => s.id === id)) return false;
  st.update((d) => {
    d.sizes = d.sizes.filter((s) => s.id !== id);
    for (const s of d.sizes) if (s.derivedFrom === id) delete s.derivedFrom;
  });
  const after = useEditorStore.getState();
  if (after.activeSizeId === id) {
    const next = after.project?.masterSizeId ?? after.project?.sizes[0]?.id;
    if (next) after.setActiveSize(next);
  }
  return true;
}

/** Replaces a size's layout and background with a fresh adaptation of the master (undoable). */
export function regenerateFromMaster(id: ID): void {
  const st = useEditorStore.getState();
  const p = st.project;
  if (!p) return;
  const master = masterOf(p);
  const target = p.sizes.find((s) => s.id === id);
  if (!master || !target || master.id === id) return;
  const fresh = adaptSize(master, target.width, target.height);
  st.update((d) => {
    const s = d.sizes.find((x) => x.id === id);
    if (!s) return;
    s.elements = fresh.elements;
    s.background = fresh.background;
    s.derivedFrom = master.id;
  });
  st.select([]);
}
