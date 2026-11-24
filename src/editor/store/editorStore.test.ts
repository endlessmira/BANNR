import { describe, expect, it } from 'vitest';
import { createDemoProject } from '@/model/demo';
import { createEditorStore } from './editorStore';

type Store = ReturnType<typeof createEditorStore>;

function setup() {
  let t = 1_000_000;
  const store = createEditorStore(() => t);
  store.getState().load(createDemoProject({ platform: 'cm360' }));
  return { store, advance: (ms: number) => { t += ms; } };
}

const elementIds = (store: Store): string[] =>
  store.getState().project?.sizes[0]?.elements.map((e) => e.id) ?? [];

describe('editor store', () => {
  it('loads the master size as active', () => {
    const { store } = setup();
    const s = store.getState();
    expect(s.activeSizeId).toBe(s.project!.masterSizeId);
  });

  it('undoes and redoes changes', () => {
    const { store } = setup();
    const before = store.getState().project!;
    store.getState().update((d) => { d.name = 'Renamed'; });
    expect(store.getState().project!.name).toBe('Renamed');
    store.getState().undo();
    expect(store.getState().project).toBe(before);
    store.getState().redo();
    expect(store.getState().project!.name).toBe('Renamed');
  });

  it('ignores no-op updates', () => {
    const { store } = setup();
    store.getState().update(() => {});
    expect(store.getState().past).toHaveLength(0);
    expect(store.getState().revision).toBe(0);
  });

  it('coalesces rapid updates with the same key into one undo step', () => {
    const { store, advance } = setup();
    for (let i = 1; i <= 5; i++) {
      store.getState().update((d) => { d.sizes[0]!.elements[0]!.x = i; }, { coalesceKey: 'drag' });
      advance(16);
    }
    expect(store.getState().past).toHaveLength(1);
    advance(2000);
    store.getState().update((d) => { d.sizes[0]!.elements[0]!.x = 99; }, { coalesceKey: 'drag' });
    expect(store.getState().past).toHaveLength(2);
  });

  it('clears redo history after a new change', () => {
    const { store } = setup();
    store.getState().update((d) => { d.name = 'A'; });
    store.getState().undo();
    expect(store.getState().future).toHaveLength(1);
    store.getState().update((d) => { d.name = 'B'; });
    expect(store.getState().future).toHaveLength(0);
  });

  it('toggles selection', () => {
    const { store } = setup();
    store.getState().select(['x', 'y']);
    store.getState().select(['y', 'z'], 'toggle');
    expect(store.getState().selection).toEqual(['x', 'z']);
  });

  it('deletes selected elements but never locked ones, and undo restores them', () => {
    const { store } = setup();
    const [a, b] = store.getState().project!.sizes[0]!.elements;
    store.getState().update((d) => { d.sizes[0]!.elements[1]!.locked = true; });
    store.getState().select([a!.id, b!.id]);
    store.getState().deleteSelection();
    expect(elementIds(store)).not.toContain(a!.id);
    expect(elementIds(store)).toContain(b!.id);
    expect(store.getState().selection).toEqual([]);
    store.getState().undo();
    expect(elementIds(store)).toContain(a!.id);
  });
});
