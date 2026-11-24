import { type Draft, produce } from 'immer';
import { create } from 'zustand';
import type { BannerElement, ID, Project } from '@/model/types';
import { findElement, findSize, removeElements } from '../ops';

export const HISTORY_LIMIT = 100;
/** Updates with the same coalesceKey inside this window merge into one undo step (e.g. a drag). */
export const COALESCE_MS = 800;

export interface UpdateOptions { coalesceKey?: string }

interface EditorData {
  project: Project | null;
  activeSizeId: ID | null;
  selection: ID[];
  /** Undo history: immutable snapshots. Immer's structural sharing keeps them cheap. */
  past: Project[];
  future: Project[];
  /** Increments on every change. Autosave compares it with savedRevision. */
  revision: number;
  savedRevision: number;
  lastKey: string | null;
  lastAt: number;
}

interface EditorActions {
  load(project: Project): void;
  close(): void;
  update(recipe: (draft: Draft<Project>) => void, opts?: UpdateOptions): void;
  undo(): void;
  redo(): void;
  setActiveSize(sizeId: ID): void;
  select(ids: ID[], mode?: 'replace' | 'toggle'): void;
  deleteSelection(): void;
  markSaved(revision: number): void;
}

export type EditorState = EditorData & EditorActions;

const EMPTY: EditorData = {
  project: null, activeSizeId: null, selection: [], past: [], future: [],
  revision: 0, savedRevision: 0, lastKey: null, lastAt: 0,
};

function resolveSizeId(p: Project, id: ID | null): ID | null {
  if (id && p.sizes.some((s) => s.id === id)) return id;
  return p.masterSizeId ?? p.sizes[0]?.id ?? null;
}

function pruneSelection(p: Project, sizeId: ID | null, ids: readonly ID[]): ID[] {
  const size = findSize(p, sizeId);
  return size ? ids.filter((id) => findElement(size.elements, id) !== undefined) : [];
}

export function createEditorStore(now: () => number = Date.now) {
  return create<EditorState>()((set, get) => ({
    ...EMPTY,

    load: (project) => set({ ...EMPTY, project, activeSizeId: resolveSizeId(project, null) }),
    close: () => set({ ...EMPTY }),

    update: (recipe, opts = {}) => {
      const { project, lastKey, lastAt } = get();
      if (!project) return;
      const changed = produce(project, recipe);
      if (changed === project) return; // no-op: no history entry
      const t = now();
      const key = opts.coalesceKey ?? null;
      const coalesce = key !== null && key === lastKey && t - lastAt < COALESCE_MS;
      set((s) => ({
        project: { ...changed, updatedAt: new Date(t).toISOString() },
        past: coalesce ? s.past : [...s.past, project].slice(-HISTORY_LIMIT),
        future: [],
        revision: s.revision + 1,
        lastKey: key,
        lastAt: t,
      }));
    },

    undo: () => {
      const { project, past } = get();
      const prev = past[past.length - 1];
      if (!project || !prev) return;
      set((s) => {
        const activeSizeId = resolveSizeId(prev, s.activeSizeId);
        return {
          project: prev,
          past: s.past.slice(0, -1),
          future: [project, ...s.future],
          revision: s.revision + 1,
          lastKey: null,
          activeSizeId,
          selection: pruneSelection(prev, activeSizeId, s.selection),
        };
      });
    },

    redo: () => {
      const { project, future } = get();
      const next = future[0];
      if (!project || !next) return;
      set((s) => {
        const activeSizeId = resolveSizeId(next, s.activeSizeId);
        return {
          project: next,
          past: [...s.past, project].slice(-HISTORY_LIMIT),
          future: s.future.slice(1),
          revision: s.revision + 1,
          lastKey: null,
          activeSizeId,
          selection: pruneSelection(next, activeSizeId, s.selection),
        };
      });
    },

    setActiveSize: (sizeId) => {
      const p = get().project;
      if (p && p.sizes.some((s) => s.id === sizeId)) set({ activeSizeId: sizeId, selection: [] });
    },

    select: (ids, mode = 'replace') =>
      set((s) => {
        if (mode === 'replace') return { selection: [...new Set(ids)] };
        const next = new Set(s.selection);
        for (const id of ids) {
          if (next.has(id)) next.delete(id);
          else next.add(id);
        }
        return { selection: [...next] };
      }),

    deleteSelection: () => {
      const { project, activeSizeId, selection } = get();
      const size = project ? findSize(project, activeSizeId) : undefined;
      if (!size) return;
      const ids = new Set(
        selection.filter((id) => {
          const el = findElement(size.elements, id);
          return el !== undefined && !el.locked; // locked elements are never deleted
        }),
      );
      if (ids.size === 0) return;
      get().update((d) => {
        const target = d.sizes.find((s) => s.id === activeSizeId);
        if (target) removeElements(target.elements as BannerElement[], ids);
      });
      set({ selection: [] });
    },

    markSaved: (revision) => set((s) => ({ savedRevision: Math.max(s.savedRevision, revision) })),
  }));
}

export const useEditorStore = createEditorStore();
