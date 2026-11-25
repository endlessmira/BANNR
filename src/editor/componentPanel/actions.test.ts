import { beforeEach, describe, expect, it } from 'vitest';
import { createComponent, createProject, createText } from '@/model/factories';
import type { ComponentElement } from '@/model/types';
import { useEditorStore } from '../store/editorStore';
import { addComponent, canRotate, resetComponentProps, setComponentPreset, setComponentProp, setSlotValues } from './actions';

const state = () => useEditorStore.getState();
const els = () => state().project!.sizes[0]!.elements;
const first = () => els()[0] as ComponentElement;

beforeEach(() => state().load(createProject('C', { platform: 'cm360' })));

describe('component actions', () => {
  it('adds a component centred at its default size, selected, as one undo step', () => {
    const id = addComponent('counter', 'discount')!;
    expect(first()).toMatchObject({
      id, type: 'component', componentType: 'counter', componentVersion: 1, preset: 'discount', name: 'Discount',
      x: 120, y: 200, width: 240, height: 80, zIndex: 1,
    });
    expect(state().selection).toEqual([id]);
    state().undo();
    expect(els()).toHaveLength(0);
  });

  it('places a dropped component inside the banner and ignores unknown types', () => {
    addComponent('counter', undefined, { x: 470, y: 10 });
    expect([first().x, first().y, first().name]).toEqual([240, 0, 'Counter']);
    expect(first().preset).toBeUndefined();
    expect(addComponent('nope')).toBeNull();
  });

  it('edits settings, switches presets and resets', () => {
    const id = addComponent('counter')!;
    setComponentProp(id, 'end', 75);
    setComponentProp(id, 'prefix', '+');
    expect(first().props).toEqual({ end: 75, prefix: '+' });
    setComponentPreset(id, 'sold');
    expect(first().preset).toBe('sold');
    expect(first().props).toEqual({ prefix: '+' });
    resetComponentProps(id);
    expect(first().props).toEqual({});
    setComponentPreset(id, null);
    expect(first().preset).toBeUndefined();
  });

  it('fills and clears slots', () => {
    const id = addComponent('counter')!;
    setSlotValues(id, 'img', [{ kind: 'image', assetId: 'a1' }]);
    expect(first().slots).toEqual({ img: [{ kind: 'image', assetId: 'a1' }] });
    setSlotValues(id, 'img', []);
    expect(first().slots).toEqual({});
  });

  it('allows rotation except for 3D components', () => {
    expect(canRotate(createText())).toBe(true);
    expect(canRotate(createComponent({ componentType: 'counter' }))).toBe(true);
  });
});
