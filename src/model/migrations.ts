import { SCHEMA_VERSION, type Project } from './types';

type Migration = (doc: Record<string, unknown>) => Record<string, unknown>;

/** MIGRATIONS[n] upgrades a document from version n to n + 1. */
const MIGRATIONS: Record<number, Migration> = {};

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;

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
