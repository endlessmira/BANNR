import { type UseStore, createStore, del, get, set, values } from 'idb-keyval';
import { migrateProject } from '@/model/migrations';
import type { AssetRef, ID, Project } from '@/model/types';
import { sanitizeFileName, sha256Hex } from './hash';
import { type AssetStore, type ProjectRepository, type ProjectSummary, toSummary } from './repository';

// One database per store: idb-keyval opens each database with a single object store,
// so two stores in one database would fail.
export class IndexedDbProjectRepository implements ProjectRepository {
  private readonly db: UseStore = createStore('bannr-projects', 'projects');

  async list(): Promise<ProjectSummary[]> {
    const all = await values<unknown>(this.db);
    return all.map((raw) => toSummary(migrateProject(raw))).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }
  async get(id: ID): Promise<Project | undefined> {
    const raw = await get<unknown>(id, this.db);
    return raw === undefined ? undefined : migrateProject(raw);
  }
  async save(project: Project): Promise<void> {
    await set(project.id, project, this.db);
  }
  async delete(id: ID): Promise<void> {
    await del(id, this.db);
  }
}

interface StoredAsset { ref: AssetRef; blob: Blob }

const MIME_BY_EXT: Record<string, string> = {
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp',
  svg: 'image/svg+xml', woff2: 'font/woff2', woff: 'font/woff', ttf: 'font/ttf', otf: 'font/otf',
};

export class IndexedDbAssetStore implements AssetStore {
  private readonly db: UseStore = createStore('bannr-assets', 'assets');

  async put(file: Blob, fileName: string): Promise<AssetRef> {
    const hash = await sha256Hex(file);
    const id = `a${hash.slice(0, 20)}`;
    const existing = await get<StoredAsset>(id, this.db);
    if (existing) return existing.ref; // deduplicated

    const ext = fileName.split('.').pop()?.toLowerCase() ?? '';
    const mimeType = file.type || MIME_BY_EXT[ext] || 'application/octet-stream';
    const ref: AssetRef = {
      id,
      kind: mimeType.startsWith('font/') ? 'font' : 'image',
      fileName: sanitizeFileName(fileName),
      mimeType,
      bytes: file.size,
      hash,
    };
    await set(id, { ref, blob: file } satisfies StoredAsset, this.db);
    return ref;
  }
  async getRef(id: ID): Promise<AssetRef | undefined> {
    return (await get<StoredAsset>(id, this.db))?.ref;
  }
  async getBlob(id: ID): Promise<Blob | undefined> {
    return (await get<StoredAsset>(id, this.db))?.blob;
  }
  async delete(id: ID): Promise<void> {
    await del(id, this.db);
  }
}
