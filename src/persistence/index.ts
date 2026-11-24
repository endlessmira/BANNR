import { IndexedDbAssetStore, IndexedDbProjectRepository } from './indexedDb';
import type { AssetStore, ProjectRepository } from './repository';

// Swap these for HTTP implementations when a backend is added.
export const projectRepo: ProjectRepository = new IndexedDbProjectRepository();
export const assetStore: AssetStore = new IndexedDbAssetStore();
