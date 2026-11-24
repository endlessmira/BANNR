import type { PlatformId, Project, Size } from '@/model/types';

export interface ZipEntry { path: string; bytes: number; text?: string }
export interface ZipManifest { entries: ZipEntry[]; totalBytes: number }

export type ValidationLevel = 'error' | 'warning' | 'pass';
export interface ValidationResult { ruleId: string; level: ValidationLevel; message: string; detail?: string }

export interface PlatformConstraints {
  maxZipKB: number;
  maxFiles: number;
  allowedExtensions: readonly string[];
  /** Hosts a creative may load from, e.g. s1.adform.net for Adform. */
  allowedExternalHosts: readonly string[];
}

export interface PlatformAdapter {
  id: PlatformId;
  label: string;
  /** Official spec link. Verified in Phase 5. */
  specUrl: string;
  injectHead(size: Size, project: Project): string;
  /** Defines bannr.exit() for this platform. Nothing else in the banner may open URLs. */
  injectClickScript(project: Project): string;
  /** Optional: JS that maps a component interaction event to platform tracking (default: no-op). */
  trackEvent?(name: string): string;
  extraFiles(size: Size, project: Project): Record<string, string | Blob>;
  validate(zip: ZipManifest): ValidationResult[];
  constraints: PlatformConstraints;
}
