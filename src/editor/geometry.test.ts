import { describe, expect, it } from 'vitest';
import {
  aabb, alignDelta, distributeDeltas, normalizeAngle, resizeFrame, rotationFromPointer, snapMove,
} from './geometry';

const frame = { x: 0, y: 0, width: 100, height: 50, rotation: 0 };

describe('geometry', () => {
  it('computes the bounding box of a rotated frame', () => {
    const r = aabb({ ...frame, rotation: 90 });
    expect(r.x).toBeCloseTo(25); expect(r.y).toBeCloseTo(-25);
    expect(r.width).toBeCloseTo(50); expect(r.height).toBeCloseTo(100);
  });

  it('snaps within the threshold and reports guides', () => {
    const targets = { x: [0, 150, 300], y: [0, 125, 250] };
    const s = snapMove({ x: 48, y: 200, width: 100, height: 46 }, targets, 5);
    expect(s.dx).toBe(2); expect(s.dy).toBe(4);
    expect(s.guides).toContainEqual({ axis: 'x', pos: 150 });
    expect(s.guides).toContainEqual({ axis: 'y', pos: 250 });
    expect(snapMove({ x: 60, y: 60, width: 100, height: 10 }, targets, 5).dx).toBe(0);
  });

  it('resizes from corners with the opposite corner fixed', () => {
    expect(resizeFrame(frame, 'se', 10, 20)).toMatchObject({ x: 0, y: 0, width: 110, height: 70 });
    const nw = resizeFrame(frame, 'nw', 10, 10);
    expect(nw.x).toBeCloseTo(10); expect(nw.y).toBeCloseTo(10);
    expect(nw.width).toBeCloseTo(90); expect(nw.height).toBeCloseTo(40);
  });

  it('keeps the aspect ratio with Shift and clamps to a minimum size', () => {
    expect(resizeFrame(frame, 'se', 50, 0, true)).toMatchObject({ width: 150, height: 75 });
    expect(resizeFrame(frame, 'se', -500, -500)).toMatchObject({ x: 0, y: 0, width: 4, height: 4 });
  });

  it('resizes rotated frames along their own axes', () => {
    const r = resizeFrame({ ...frame, rotation: 90 }, 'e', 0, 10);
    expect(r.width).toBeCloseTo(110); expect(r.height).toBeCloseTo(50);
    expect(r.x).toBeCloseTo(-5); expect(r.y).toBeCloseTo(5);
  });

  it('rotates with optional 15° snapping', () => {
    expect(rotationFromPointer(0, 0, 22, true)).toBe(15);
    expect(rotationFromPointer(10, 0, 22, false)).toBe(32);
    expect(normalizeAngle(270)).toBe(-90);
  });

  it('aligns and distributes', () => {
    const bounds = { x: 0, y: 0, width: 300, height: 250 };
    expect(alignDelta({ x: 20, y: 30, width: 100, height: 50 }, bounds, 'right')).toEqual({ dx: 180, dy: 0 });
    expect(alignDelta({ x: 20, y: 30, width: 100, height: 50 }, bounds, 'vcenter')).toEqual({ dx: 0, dy: 70 });
    const d = distributeDeltas(
      [{ x: 100, y: 0, width: 10, height: 10 }, { x: 0, y: 0, width: 10, height: 10 }, { x: 20, y: 0, width: 10, height: 10 }],
      'x',
    );
    expect(d[0]).toBeCloseTo(0); expect(d[1]).toBeCloseTo(0); expect(d[2]).toBeCloseTo(30);
  });
});
