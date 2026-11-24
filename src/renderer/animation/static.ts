import type { AnimationEngine } from './engine';

/** Renders only the final frame. Phase 1 default, also used for the backup image. */
export const staticEngine: AnimationEngine = {
  id: 'static',
  label: 'Static (final frame)',
  externalScripts: [],
  globalCss: () => '',
  elementDecls: () => ({}),
  runtime: () => '',
};
