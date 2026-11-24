import { beforeEach, describe, expect, it } from 'vitest';
import { createDemoProject } from '@/model/demo';
import { addSizes, regenerateFromMaster, removeSize, setMaster } from './sizes';
import { useEditorStore } from './store/editorStore';

const state = () => useEditorStore.getState();
const sizes = () => state().project!.sizes;

beforeEach(() => state().load(createDemoProject({ platform: 'ttd' })));

describe('size actions', () => {
  it('adds sizes from the master, skipping duplicates and invalid sizes', () => {
    const r = addSizes([{ width: 300, height: 600 }, { width: 728, height: 90 }, { width: 5, height: 5 }], 'master');
    expect(r.added).toHaveLength(1);
    expect(r.skipped).toEqual(['728x90', '5x5']);
    const added = sizes().at(-1)!;
    expect([added.width, added.height, added.label]).toEqual([300, 600, 'Half Page']);
    expect(added.derivedFrom).toBe(state().project!.masterSizeId);
    expect(added.elements).toHaveLength(4);
    expect(state().activeSizeId).toBe(added.id);
  });

  it('adds blank sizes', () => {
    addSizes([{ width: 970, height: 250 }], 'blank');
    const s = sizes().at(-1)!;
    expect(s.elements).toHaveLength(0);
    expect(s.derivedFrom).toBeUndefined();
  });

  it('deletes sizes, reassigns the master, and never deletes the last one', () => {
    const [a, b, c] = sizes();
    expect(removeSize(a!.id)).toBe(true);
    expect(state().project!.masterSizeId).toBe(b!.id);
    expect(state().activeSizeId).toBe(b!.id);
    removeSize(b!.id);
    expect(removeSize(c!.id)).toBe(false);
    expect(sizes()).toHaveLength(1);
    state().undo();
    state().undo();
    expect(sizes()).toHaveLength(3);
  });

  it('sets a new master and regenerates a size from it', () => {
    const [a, b] = sizes();
    setMaster(b!.id);
    expect(state().project!.masterSizeId).toBe(b!.id);
    state().update((d) => { d.sizes[0]!.elements = []; });
    regenerateFromMaster(a!.id);
    expect(sizes()[0]!.elements).toHaveLength(4);
    expect(sizes()[0]!.derivedFrom).toBe(b!.id);
  });
});
