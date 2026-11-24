import { beforeEach, describe, expect, it } from 'vitest';
import { createDemoProject } from '@/model/demo';
import { addElement, align, copySelection, duplicateSelection, nudge, paste, selectAll } from './actions';
import { useEditorStore } from './store/editorStore';

const state = () => useEditorStore.getState();
const elements = () => state().project!.sizes.find((s) => s.id === state().activeSizeId)!.elements;
const byName = (n: string) => elements().find((e) => e.name === n)!;

beforeEach(() => state().load(createDemoProject({ platform: 'cm360' })));

describe('editor actions', () => {
  it('adds an element centred, on top, and selects it', () => {
    addElement('rect');
    const el = elements().at(-1)!;
    expect(el.type).toBe('shape');
    expect([el.x, el.y, el.zIndex]).toEqual([110, 85, 5]);
    expect(state().selection).toEqual([el.id]);
  });

  it('nudges the selection and merges rapid nudges into one undo step', () => {
    state().select([byName('CTA').id]);
    nudge(1, 0); nudge(1, 0); nudge(1, 0);
    expect(byName('CTA').x).toBe(23);
    expect(state().past).toHaveLength(1);
    state().undo();
    expect(byName('CTA').x).toBe(20);
  });

  it('never moves locked elements', () => {
    state().update((d) => { d.sizes[0]!.elements[2]!.locked = true; });
    state().select([byName('Headline').id]);
    nudge(5, 5);
    expect(byName('Headline').x).toBe(20);
  });

  it('pastes with a growing offset and duplicates with new ids', () => {
    const cta = byName('CTA');
    state().select([cta.id]);
    copySelection();
    paste();
    const first = elements().at(-1)!;
    expect([first.x, first.y]).toEqual([30, 200]);
    expect(first.id).not.toBe(cta.id);
    paste();
    expect([elements().at(-1)!.x, elements().at(-1)!.y]).toEqual([40, 210]);
    duplicateSelection();
    expect([elements().at(-1)!.x, elements().at(-1)!.y]).toEqual([50, 220]);
    expect(elements()).toHaveLength(7);
  });

  it('aligns a single element to the banner', () => {
    state().select([byName('CTA').id]);
    align('right');
    expect(byName('CTA').x).toBe(160);
  });

  it('select all skips locked elements', () => {
    state().update((d) => { d.sizes[0]!.elements[1]!.locked = true; });
    selectAll();
    expect(state().selection).toHaveLength(3);
  });
});
