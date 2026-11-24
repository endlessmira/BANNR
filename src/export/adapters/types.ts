import type { PlatformId, Project, Size } from '@/model/types';

export interface ZipEntry { path: string; bytes: number; text?: string }
export interface ZipManifest { entries: ZipEntry[]; totalBytes: number }

export type ValidationLevel = 'error' | 'warning' | 'pass';
export interface ValidationResult { ruleId: string; level: ValidationLevel; message: string; detail?: string }

export interface PlatformConstraints {
  /** Hard limit: over this blocks export. */
  maxZipKB: number;
  /** Platform recommendation: over this is a warning. */
  recommendedZipKB?: number;
  maxFiles: number;
  allowedExtensions: readonly string[];
  /** Not confirmed for this platform: allowed, but shown as a warning. */
  warnExtensions?: readonly string[];
  /** Hosts a creative may load from, e.g. s1.adform.net for Adform. */
  allowedExternalHosts: readonly string[];
  /** Max weight of the separate backup image, if the platform states one. */
  backupMaxKB?: number;
}

/**
 * One file per platform in this folder. Adding a platform = adding one adapter file and
 * registering it in registry.ts. All platform snippets, limits and rules live here.
 */
export interface PlatformAdapter {
  id: PlatformId;
  label: string;
  /** Official spec link. */
  specUrl: string;
  /** Meta tags and scripts for <head>. */
  injectHead(size: Size, project: Project): string;
  /** Defines bannr.exit() for this platform. Nothing else in the banner may open URLs. */
  injectClickScript(project: Project): string;
  /** Optional: JS that maps a component interaction event to platform tracking (default: no-op). */
  trackEvent?(name: string): string;
  extraFiles(size: Size, project: Project): Record<string, string | Blob>;
  /** Platform-specific checks. Shared checks (size, files, extensions) run in /validation (Phase 5c). */
  validate(zip: ZipManifest): ValidationResult[];
  constraints: PlatformConstraints;
  /** Preview only, never exported: globals the platform normally provides (e.g. a dhtml stub). */
  previewGlobals?: string;
}
