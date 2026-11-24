import type { AssetRef, ID, PlatformId, Project } from '@/model/types';

export interface ProjectSummary { id: ID; name: string; updatedAt: string; platform: PlatformId; sizes: string[] }

/** Storage-agnostic. The IndexedDB version can be replaced by an HTTP client for a backend. */
export interface ProjectRepository {
  list(): Promise<ProjectSummary[]>;
  get(id: ID): Promise<Project | undefined>;
  save(project: Project): Promise<void>;
  delete(id: ID): Promise<void>;
}

export interface AssetStore {
  put(file: Blob, fileName: string): Promise<AssetRef>;
  getRef(id: ID): Promise<AssetRef | undefined>;
  getBlob(id: ID): Promise<Blob | undefined>;
  delete(id: ID): Promise<void>;
}

export const toSummary = (p: Project): ProjectSummary => ({
  id: p.id,
  name: p.name,
  updatedAt: p.updatedAt,
  platform: p.selectedPlatform,
  sizes: p.sizes.map((s) => `${s.width}x${s.height}`),
});
