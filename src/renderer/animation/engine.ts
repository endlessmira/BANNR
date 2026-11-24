import type { BannerElement, Project, Size } from '@/model/types';
import type { Decls } from '../css';

/**
 * Pluggable animation backend. The default (Phase 4) is pure CSS @keyframes.
 * A GSAP engine can be added later without touching the renderer.
 */
export interface AnimationEngine {
  readonly id: string;
  readonly label: string;
  /** Absolute script URLs the engine needs. Validation checks them against the platform allow-list. */
  readonly externalScripts: readonly string[];
  /** Global CSS, e.g. @keyframes. */
  globalCss(size: Size, project: Project): string;
  /**
   * Extra declarations merged into an element's rule. Engines own the `transform`
   * property. Element rotation uses the separate `rotate` property, so the two combine.
   */
  elementDecls(el: BannerElement, size: Size): Decls;
  /** Runtime JS (loop control, timelines). Empty string if none. */
  runtime(size: Size, project: Project): string;
}
