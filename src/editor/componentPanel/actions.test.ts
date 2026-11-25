import { beforeEach, describe, expect, it } from 'vitest';
import { adaptSize } from '@/model/adapt';
import { createComponent, createProject, createSize, createText } from '@/model/factories';
import type { ComponentElement } from '@/model/types';
import { useEditorStore } from '../store/editorStore';
import {
  addComponent, canRotate, fitToBanner, resetComponentProps, setComponentPreset, setComponentProp, setSlotValues,
} from './actions';

const state = () => useEditorStore.getState();
const els = () => state().project!.sizes[0]!.elements;
const first = () => els()[0] as ComponentElement;

beforeEach(() => state().load(createProject('C', { platform: 'cm360' })));

describe('component actions', () => {
  it('adds a component that fills the 480×480 master, selected, as one undo step', () => {
    const id = addComponent('carousel', 'classic')!;
    expect(first()).toMatchObject({
      id, type: 'component', componentType: 'carousel', preset: 'classic', name: 'Classic',
      x: 0, y: 0, width: 480, height: 480, zIndex: 1,
    });
    expect(state().selection).toEqual([id]);
    state().undo();
    expect(els()).toHaveLength(0);
  });

  it('fills any banner size, ignores the drop point and unknown types', () => {
    state().load(createProject('C', { platform: 'cm360', sizes: [createSize(300, 600)] }));
    addComponent('counter', undefined, { x: 10, y: 10 });
    expect([first().x, first().y, first().width, first().height]).toEqual([0, 0, 300, 600]);
    expect(first().preset).toBeUndefined();
    expect(addComponent('nope')).toBeNull();
  });

  it('fit to banner resets position and size', () => {
    const id = addComponent('counter')!;
    state().update((d) => { const e = d.sizes[0]!.elements[0]!; e.x = 50; e.y = 20; e.width = 100; });
    fitToBanner(id);
    expect([first().x, first().y, first().width, first().height]).toEqual([0, 0, 480, 480]);
  });

  it('a full-banner component fills new sizes too', () => {
    const c = createComponent({ componentType: 'carousel', width: 480, height: 480 });
    const s = adaptSize(createSize(480, 480, { elements: [c] }), 970, 250);
    expect(s.elements[0]).toMatchObject({ x: 0, y: 0, width: 970, height: 250 });
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
