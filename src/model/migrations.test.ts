import { describe, expect, it } from 'vitest';
import { createProject, createSize, createText } from './factories';
import { migrateProject } from './migrations';
import { SCHEMA_VERSION, type Project } from './types';

const asV1 = (p: Project): unknown => ({ ...structuredClone(p), schemaVersion: 1 });
const dims = (p: Project) => p.sizes.map((s) => `${s.width}x${s.height}`);

describe('migrateProject', () => {
  it('v1 → v2 adds a 480×480 master adapted from the old master', () => {
    const old = createSize(300, 250, { elements: [createText({ x: 20, y: 20 })] });
    const p = migrateProject(asV1(createProject('Old', { platform: 'cm360', sizes: [old, createSize(728, 90)] })));
    expect(p.schemaVersion).toBe(SCHEMA_VERSION);
    expect(dims(p)).toEqual(['480x480', '300x250', '728x90']);
    expect(p.masterSizeId).toBe(p.sizes[0]!.id);
    expect(p.sizes[0]!.elements).toHaveLength(1);
    expect(p.sizes[0]!.label).toBe('Master');
  });

  it('v1 → v2 reuses an existing 480×480 size as the master', () => {
    const sq = createSize(480, 480);
    const p = migrateProject(asV1(createProject('Old', { platform: 'adform', sizes: [createSize(300, 250), sq] })));
    expect(dims(p)).toEqual(['480x480', '300x250']);
    expect(p.masterSizeId).toBe(sq.id);
  });

  it('returns current projects unchanged, with a 480×480 master by default', () => {
    const p = createProject('New', { platform: 'ttd' });
    expect(migrateProject(p)).toBe(p);
    expect(dims(p)).toEqual(['480x480']);
  });
});
