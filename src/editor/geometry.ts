/** Pure geometry for the editor canvas. All values are in banner pixels. */
export interface Rect { x: number; y: number; width: number; height: number }
export interface Frame extends Rect { rotation: number }
/** axis 'x' = vertical guide line at x = pos; axis 'y' = horizontal line at y = pos. */
export interface Guide { axis: 'x' | 'y'; pos: number }
export interface SnapTargets { x: number[]; y: number[] }
export type Handle = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';
export type AlignMode = 'left' | 'hcenter' | 'right' | 'top' | 'vcenter' | 'bottom';

export const HANDLES: readonly Handle[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];
const HANDLE_VECTORS: Record<Handle, readonly [number, number]> = {
  n: [0, -1], s: [0, 1], e: [1, 0], w: [-1, 0], ne: [1, -1], nw: [-1, -1], se: [1, 1], sw: [-1, 1],
};
export const MIN_SIZE = 4;
const RAD = Math.PI / 180;

/** Axis-aligned bounding box of a (possibly rotated) frame. Rotation is around the centre, like CSS. */
export function aabb(f: Frame): Rect {
  if (!f.rotation) return { x: f.x, y: f.y, width: f.width, height: f.height };
  const c = Math.abs(Math.cos(f.rotation * RAD));
  const s = Math.abs(Math.sin(f.rotation * RAD));
  const w = f.width * c + f.height * s;
  const h = f.width * s + f.height * c;
  return { x: f.x + f.width / 2 - w / 2, y: f.y + f.height / 2 - h / 2, width: w, height: h };
}

export function unionRect(rects: readonly Rect[]): Rect | null {
  if (rects.length === 0) return null;
  let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
  for (const r of rects) {
    x1 = Math.min(x1, r.x); y1 = Math.min(y1, r.y);
    x2 = Math.max(x2, r.x + r.width); y2 = Math.max(y2, r.y + r.height);
  }
  return { x: x1, y: y1, width: x2 - x1, height: y2 - y1 };
}

export const intersects = (a: Rect, b: Rect): boolean =>
  a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;

export const normalizeRect = (x1: number, y1: number, x2: number, y2: number): Rect => ({
  x: Math.min(x1, x2), y: Math.min(y1, y2), width: Math.abs(x2 - x1), height: Math.abs(y2 - y1),
});

/** Edges and centres of the banner and of every other element. */
export function snapTargetsFor(bounds: Rect, others: readonly Rect[]): SnapTargets {
  const x: number[] = [];
  const y: number[] = [];
  for (const r of [bounds, ...others]) {
    x.push(r.x, r.x + r.width / 2, r.x + r.width);
    y.push(r.y, r.y + r.height / 2, r.y + r.height);
  }
  return { x, y };
}

function snapAxis(edges: readonly number[], targets: readonly number[], threshold: number): number {
  let best = Infinity;
  for (const e of edges) {
    for (const t of targets) {
      const d = t - e;
      if (Math.abs(d) <= threshold && Math.abs(d) < Math.abs(best)) best = d;
    }
  }
  return best === Infinity ? 0 : best;
}

/** Snaps a moving box's edges/centre to the nearest targets. Returns the correction and guide lines. */
export function snapMove(box: Rect, targets: SnapTargets, threshold: number): { dx: number; dy: number; guides: Guide[] } {
  const ex = [box.x, box.x + box.width / 2, box.x + box.width];
  const ey = [box.y, box.y + box.height / 2, box.y + box.height];
  const dx = snapAxis(ex, targets.x, threshold);
  const dy = snapAxis(ey, targets.y, threshold);
  const near = (a: number, b: number) => Math.abs(a - b) < 0.5;
  const guides: Guide[] = [];
  for (const t of new Set(targets.x)) if (ex.some((e) => near(e + dx, t))) guides.push({ axis: 'x', pos: t });
  for (const t of new Set(targets.y)) if (ey.some((e) => near(e + dy, t))) guides.push({ axis: 'y', pos: t });
  return { dx, dy, guides };
}

/**
 * Resizes a frame by dragging a handle by (dx, dy) in banner space. Works for rotated frames:
 * the delta is converted to the element's local axes and the opposite handle stays fixed on screen.
 */
export function resizeFrame(f: Frame, handle: Handle, dx: number, dy: number, keepRatio = false): Frame {
  const [hx, hy] = HANDLE_VECTORS[handle];
  const cos = Math.cos(f.rotation * RAD);
  const sin = Math.sin(f.rotation * RAD);
  const lx = dx * cos + dy * sin;
  const ly = -dx * sin + dy * cos;
  let w = f.width + hx * lx;
  let h = f.height + hy * ly;
  if (keepRatio && hx !== 0 && hy !== 0 && f.width > 0 && f.height > 0) {
    const ratio = f.width / f.height;
    if (Math.abs(w / f.width) >= Math.abs(h / f.height)) h = w / ratio;
    else w = h * ratio;
  }
  w = Math.max(MIN_SIZE, w);
  h = Math.max(MIN_SIZE, h);
  const ax = -hx;
  const ay = -hy;
  const cx = f.x + f.width / 2;
  const cy = f.y + f.height / 2;
  const ox = (ax * f.width) / 2;
  const oy = (ay * f.height) / 2;
  const anchorX = cx + ox * cos - oy * sin;
  const anchorY = cy + ox * sin + oy * cos;
  const nx = (ax * w) / 2;
  const ny = (ay * h) / 2;
  const ncx = anchorX - (nx * cos - ny * sin);
  const ncy = anchorY - (nx * sin + ny * cos);
  return { ...f, x: ncx - w / 2, y: ncy - h / 2, width: w, height: h };
}

export const pointerAngle = (cx: number, cy: number, px: number, py: number): number =>
  Math.atan2(py - cy, px - cx) / RAD;

/** Normalises to (-180, 180], rounded to 0.1°. */
export function normalizeAngle(a: number): number {
  let r = ((a % 360) + 360) % 360;
  if (r > 180) r -= 360;
  return Math.round(r * 10) / 10;
}

export function rotationFromPointer(startRotation: number, startAngle: number, angle: number, snap: boolean): number {
  let r = startRotation + angle - startAngle;
  if (snap) r = Math.round(r / 15) * 15;
  return normalizeAngle(r);
}

export function alignDelta(r: Rect, bounds: Rect, mode: AlignMode): { dx: number; dy: number } {
  switch (mode) {
    case 'left': return { dx: bounds.x - r.x, dy: 0 };
    case 'hcenter': return { dx: bounds.x + bounds.width / 2 - (r.x + r.width / 2), dy: 0 };
    case 'right': return { dx: bounds.x + bounds.width - (r.x + r.width), dy: 0 };
    case 'top': return { dx: 0, dy: bounds.y - r.y };
    case 'vcenter': return { dx: 0, dy: bounds.y + bounds.height / 2 - (r.y + r.height / 2) };
    case 'bottom': return { dx: 0, dy: bounds.y + bounds.height - (r.y + r.height) };
  }
}

/** Equal gaps between items; the first and last stay put. Returns deltas in input order. */
export function distributeDeltas(rects: readonly Rect[], axis: 'x' | 'y'): number[] {
  const n = rects.length;
  const out = new Array<number>(n).fill(0);
  if (n < 3) return out;
  const pos = (r: Rect) => (axis === 'x' ? r.x : r.y);
  const len = (r: Rect) => (axis === 'x' ? r.width : r.height);
  const order = rects.map((r, i) => ({ r, i })).sort((a, b) => pos(a.r) - pos(b.r));
  const first = order[0]!;
  const last = order[n - 1]!;
  const span = pos(last.r) + len(last.r) - pos(first.r);
  const total = order.reduce((s, o) => s + len(o.r), 0);
  const gap = (span - total) / (n - 1);
  let cursor = pos(first.r);
  for (const o of order) {
    out[o.i] = cursor - pos(o.r);
    cursor += len(o.r) + gap;
  }
  return out;
}
