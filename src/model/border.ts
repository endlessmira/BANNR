import type { BorderSetting, ID, Project } from './types';

const MAX_BORDER_WIDTH = 10;

/** Returns a new project with the border patch applied to the given sizes (or all of them). */
export function setBorder(
  project: Project,
  patch: Partial<BorderSetting>,
  sizeIds: ID[] | 'all' = 'all',
): Project {
  const targets = sizeIds === 'all' ? null : new Set(sizeIds);
  return {
    ...project,
    sizes: project.sizes.map((s) => {
      if (targets && !targets.has(s.id)) return s;
      const next = { ...s.border, ...patch };
      next.width = Math.min(MAX_BORDER_WIDTH, Math.max(1, Math.round(next.width)));
      return { ...s, border: next };
    }),
  };
}

/** Copies one size's border to every size ("Apply to all sizes"). */
export function applyBorderToAll(project: Project, fromSizeId: ID): Project {
  const src = project.sizes.find((s) => s.id === fromSizeId);
  return src ? setBorder(project, src.border, 'all') : project;
}
