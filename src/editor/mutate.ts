import { type Draft, produce } from 'immer';
import type { ID, Project, Size } from '@/model/types';

export type SizeMutator = (size: Size) => void;

export function mutateSize(draft: Draft<Project>, sizeId: ID, fn: SizeMutator): void {
  const size = draft.sizes.find((s) => s.id === sizeId);
  if (size) fn(size as Size);
}

/** Applies a mutator without touching the store (live preview during a drag). */
export const previewSize = (project: Project, sizeId: ID, fn: SizeMutator): Project =>
  produce(project, (d) => mutateSize(d, sizeId, fn));
