import { beforeEach, describe, expect, it } from 'vitest';
import { createDemoProject } from '@/model/demo';
import { addSizes, regenerateFromMaster, removeSize } from './sizes';
import { useEditorStore } from './store/editorStore';

const state = () => useEditorStore.getState();
const sizes = () => state().project!.sizes;
const dims = () => sizes().map((s) => `${s.width}x${s.height}`);

beforeEach(() => state().load(createDemoProject({ platform: 'ttd' })));

describe('size actions', () => {
  it('starts with the 480×480 master first and active', () => {
    expect(dims()).toEqual(['480x480', '300x250', '300x600', '970x250']);
    expect(state().project!.masterSizeId).toBe(sizes()[0]!.id);
    expect(state().activeSizeId).toBe(sizes()[0]!.id);
  });

  it('adds sizes from the master, skipping duplicates and invalid sizes', () => {
    const r = addSizes(
      [{ width: 300, height: 300 }, { width: 300, height: 250 }, { width: 480, height: 480 }, { width: 5, height: 5 }],
      'master',
    );
    expect(r.added).toHaveLength(1);
    expect(r.skipped).toEqual(['300x250', '480x480', '5x5']);
    const added = sizes().at(-1)!;
    expect([added.width, added.height, added.label]).toEqual([300, 300, 'Square']);
    expect(added.derivedFrom).toBe(state().project!.masterSizeId);
    expect(added.elements).toHaveLength(4);
    expect(state().activeSizeId).toBe(added.id);
  });

  it('adds blank sizes', () => {
    addSizes([{ width: 480, height: 300 }], 'blank');
    const s = sizes().at(-1)!;
    expect(s.elements).toHaveLength(0);
    expect(s.derivedFrom).toBeUndefined();
  });

  it('never deletes the master; other sizes can be deleted and restored', () => {
    const [m, a] = sizes();
    expect(removeSize(m!.id)).toBe(false);
    state().setActiveSize(a!.id);
    expect(removeSize(a!.id)).toBe(true);
    expect(sizes()).toHaveLength(3);
    expect(state().activeSizeId).toBe(m!.id);
    state().undo();
    expect(sizes()).toHaveLength(4);
  });

  it('regenerates a size from the master', () => {
    const a = sizes()[1]!;
    state().update((d) => { d.sizes[1]!.elements = []; });
    regenerateFromMaster(a.id);
    expect(sizes()[1]!.elements).toHaveLength(4);
    expect(sizes()[1]!.derivedFrom).toBe(state().project!.masterSizeId);
  });
});
