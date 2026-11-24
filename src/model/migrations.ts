import { adaptSize } from './adapt';
import { createSize } from './factories';
import { MASTER_SIZE, isMasterSize } from './sizes';
import { SCHEMA_VERSION, type Project, type Size } from './types';

type Migration = (doc: Record<string, unknown>) => Record<string, unknown>;

/** MIGRATIONS[n] upgrades a document from version n to n + 1. */
const MIGRATIONS: Record<number, Migration> = {
  // v1 → v2: every project has a fixed 480×480 master, listed first.
  1: (doc) => {
    const p = doc as unknown as Project;
    const sizes: Size[] = Array.isArray(p.sizes) ? p.sizes : [];
    const existing = sizes.find(isMasterSize);
    if (existing) {
      return { ...doc, masterSizeId: existing.id, sizes: [existing, ...sizes.filter((s) => s !== existing)] };
    }
    const old = sizes.find((s) => s.id === p.masterSizeId) ?? sizes[0];
    const master = old
      ? adaptSize(old, MASTER_SIZE.width, MASTER_SIZE.height)
      : createSize(MASTER_SIZE.width, MASTER_SIZE.height);
    delete master.derivedFrom;
    master.label = MASTER_SIZE.label;
    return { ...doc, masterSizeId: master.id, sizes: [master, ...sizes] };
  },
};

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;

/** Returns the same object if no migration was needed, so callers can detect upgrades. */
export function migrateProject(raw: unknown): Project {
  if (!isRecord(raw) || typeof raw.schemaVersion !== 'number') {
    throw new Error('Not a BANNR project document');
  }
  if (raw.schemaVersion > SCHEMA_VERSION) {
    throw new Error(`Project schema v${raw.schemaVersion} is newer than this app (v${SCHEMA_VERSION})`);
  }
  let doc = raw;
  while ((doc.schemaVersion as number) < SCHEMA_VERSION) {
    const from = doc.schemaVersion as number;
    const step = MIGRATIONS[from];
    if (!step) throw new Error(`Missing migration from schema v${from}`);
    doc = { ...step(doc), schemaVersion: from + 1 };
  }
  return doc as unknown as Project;
}
