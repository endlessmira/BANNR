import { describe, expect, it } from 'vitest';
import { adaptSize } from './adapt';
import { createButton, createShape, createSize, createText } from './factories';

const master = () =>
  createSize(300, 250, {
    elements: [
      createShape({ id: 'eBg', x: 0, y: 0, width: 300, height: 250, box: { fill: { kind: 'solid', color: '#000' } } }),
      createText({ id: 'eHead', x: 20, y: 66, width: 260, height: 100, textStyle: { fontSize: 30 } }),
      createButton({ id: 'eCta', x: 20, y: 190, width: 140, height: 40, box: { fill: { kind: 'solid', color: '#f2a902' }, radius: 4 } }),
    ],
  });

describe('adaptSize', () => {
  it('creates a derived size with fresh element ids', () => {
    const m = master();
    const s = adaptSize(m, 300, 600);
    expect(s.derivedFrom).toBe(m.id);
    expect([s.width, s.height]).toEqual([300, 600]);
    expect(s.elements).toHaveLength(3);
    expect(s.elements.map((e) => e.id)).not.toContain('eHead');
  });

  it('stretches full-banner backgrounds', () => {
    const bg = adaptSize(master(), 728, 90).elements[0]!;
    expect([bg.x, bg.y, bg.width, bg.height]).toEqual([0, 0, 728, 90]);
  });

  it('scales other elements uniformly, including fonts, and keeps them inside', () => {
    const s = adaptSize(master(), 728, 90); // uniform scale = 90 / 250 = 0.36
    const head = s.elements[1]!;
    expect(head.width).toBeCloseTo(93.6);
    expect(head.height).toBeCloseTo(36);
    if (head.type !== 'text') throw new Error('expected text');
    expect(head.textStyle.fontSize).toBeCloseTo(10.8);
    const cta = s.elements[2]!;
    if (cta.type !== 'button') throw new Error('expected button');
    expect(cta.box.radius).toBeCloseTo(1.44);
    for (const e of s.elements) {
      expect(e.x).toBeGreaterThanOrEqual(0);
      expect(e.y).toBeGreaterThanOrEqual(0);
      expect(e.x + e.width).toBeLessThanOrEqual(728.01);
      expect(e.y + e.height).toBeLessThanOrEqual(90.01);
    }
  });

  it('never changes the master and never shrinks fonts below 6px', () => {
    const m = master();
    const tiny = adaptSize(m, 30, 25);
    const head = tiny.elements[1]!;
    if (head.type !== 'text') throw new Error('expected text');
    expect(head.textStyle.fontSize).toBe(6);
    const orig = m.elements[1]!;
    if (orig.type !== 'text') throw new Error('expected text');
    expect(orig.textStyle.fontSize).toBe(30);
    expect(orig.width).toBe(260);
  });
});
