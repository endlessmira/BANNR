import { beforeEach, describe, expect, it } from 'vitest';
import { createDemoProject } from '@/model/demo';
import { createGroup, createShape } from '@/model/factories';
import type { GroupElement } from '@/model/types';
import { arrange, groupSelection, moveLayer, releaseChildren, stackOrder, toggleLayer, ungroupSelection } from './layers';
import { setFrame } from './ops';
import { useEditorStore } from './store/editorStore';

const state = () => useEditorStore.getState();
const elements = () => state().project!.sizes.find((s) => s.id === state().activeSizeId)!.elements;
const names = () => stackOrder(elements()).map((e) => e.name);
const byName = (n: string) => elements().find((e) => e.name === n)!;

beforeEach(() => {
  state().load(createDemoProject({ platform: 'adform' }));
  state().setActiveSize(state().project!.sizes[1]!.id); // 300×250
});

describe('layers', () => {
  it('brings to front and sends to back', () => {
    state().select([byName('Glow').id]);
    arrange('front');
    expect(names()).toEqual(['Logo', 'Headline', 'CTA', 'Glow']);
    expect(stackOrder(elements()).map((e) => e.zIndex)).toEqual([0, 1, 2, 3]);
    arrange('back');
    expect(names()[0]).toBe('Glow');
  });

  it('moves one step forward', () => {
    state().select([byName('Logo').id]);
    arrange('forward');
    expect(names()).toEqual(['Glow', 'Headline', 'Logo', 'CTA']);
  });

  it('moves a layer to a stack index (drag and drop)', () => {
    moveLayer(byName('CTA').id, 0);
    expect(names()).toEqual(['CTA', 'Glow', 'Logo', 'Headline']);
  });

  it('toggles hidden and locked, with undo', () => {
    toggleLayer(byName('Headline').id, 'hidden');
    expect(byName('Headline').hidden).toBe(true);
    toggleLayer(byName('Headline').id, 'locked');
    expect(byName('Headline').locked).toBe(true);
    state().undo();
    state().undo();
    expect(byName('Headline').hidden).toBe(false);
    expect(byName('Headline').locked).toBe(false);
  });

  it('groups and ungroups without moving anything', () => {
    state().select([byName('Logo').id, byName('Headline').id]);
    groupSelection();
    expect(names()).toEqual(['Glow', 'Group 1', 'CTA']);
    const g = byName('Group 1') as GroupElement;
    expect([g.x, g.y, g.width, g.height]).toEqual([20, 20, 260, 146]);
    expect(g.children.map((c) => [c.name, c.x, c.y])).toEqual([['Logo', 0, 0], ['Headline', 0, 46]]);
    ungroupSelection();
    expect(names()).toEqual(['Glow', 'Logo', 'Headline', 'CTA']);
    expect([byName('Headline').x, byName('Headline').y]).toEqual([20, 66]);
    expect([byName('Logo').x, byName('Logo').y]).toEqual([20, 20]);
  });

  it('keeps the on-screen position when ungrouping a rotated group', () => {
    const child = createShape({ x: 0, y: 0, width: 10, height: 10 });
    const g = createGroup([child], { x: 0, y: 0, width: 100, height: 50, rotation: 90, opacity: 0.5 });
    const [k] = releaseChildren(g);
    expect(k!.x).toBeCloseTo(65);
    expect(k!.y).toBeCloseTo(-25);
    expect(k!.rotation).toBe(90);
    expect(k!.opacity).toBe(0.5);
  });

  it('scales group children when the group is resized', () => {
    const child = createShape({ x: 10, y: 10, width: 20, height: 20 });
    const g = createGroup([child], { width: 100, height: 100 });
    setFrame(g, { width: 200, height: 50 });
    const c = g.children[0]!;
    expect([c.x, c.y, c.width, c.height]).toEqual([20, 5, 40, 10]);
  });
});
