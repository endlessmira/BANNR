import {
  type CSSProperties, type PointerEvent as ReactPointerEvent, useEffect, useLayoutEffect, useMemo, useRef, useState,
} from 'react';
import type { BannerElement, ID, Project } from '@/model/types';
import { renderFragment } from '@/renderer';
import {
  type Guide, type Handle, HANDLES, type Rect, aabb, intersects, normalizeRect, pointerAngle,
  resizeFrame, rotationFromPointer, snapMove, snapTargetsFor, unionRect,
} from '../geometry';
import { type SizeMutator, mutateSize, previewSize } from '../mutate';
import { canRotate } from '../componentPanel/actions';
import { setFrame } from '../ops';
import { useEditorStore } from '../store/editorStore';

const SNAP_SCREEN_PX = 6;
const DRAG_THRESHOLD_PX = 3;
const HANDLE_CURSORS: Record<Handle, string> = {
  n: 'ns-resize', s: 'ns-resize', e: 'ew-resize', w: 'ew-resize',
  ne: 'nesw-resize', sw: 'nesw-resize', nw: 'nwse-resize', se: 'nwse-resize',
};

type Point = { clientX: number; clientY: number };
type DivPointer = ReactPointerEvent<HTMLDivElement>;

interface Props { project: Project; sizeId: ID; assetUrls: Record<ID, string>; zoom: number }

/**
 * The banner is drawn by the SAME renderer as the export, inside a Shadow DOM.
 * Above it: hitboxes (selection/drag) and a UI layer (handles, guides, marquee).
 * During a gesture the canvas shows a local preview; the store is updated once on release,
 * so each drag/resize/rotate is exactly one undo step.
 */
export function EditorCanvas({ project, sizeId, assetUrls, zoom }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const cleanupRef = useRef<(() => void) | null>(null);
  const selection = useEditorStore((s) => s.selection);
  const select = useEditorStore((s) => s.select);
  const update = useEditorStore((s) => s.update);
  const [preview, setPreview] = useState<Project | null>(null);
  const [guides, setGuides] = useState<Guide[]>([]);
  const [marquee, setMarquee] = useState<Rect | null>(null);

  const shown = preview ?? project;
  const size = shown.sizes.find((s) => s.id === sizeId);
  const base = project.sizes.find((s) => s.id === sizeId);

  const fragment = useMemo(
    () => (shown.sizes.some((s) => s.id === sizeId)
      ? renderFragment(shown, sizeId, { resolveAsset: (id) => assetUrls[id] ?? '' })
      : null),
    [shown, sizeId, assetUrls],
  );

  useLayoutEffect(() => {
    const host = hostRef.current;
    if (!host || !fragment) return;
    const root = host.shadowRoot ?? host.attachShadow({ mode: 'open' });
    root.innerHTML = `<style>${fragment.css}\n#clickArea{display:none}*,*::before,*::after{animation:none!important;transition:none!important}</style>${fragment.bodyHtml}`;
  }, [fragment]);

  useEffect(() => () => cleanupRef.current?.(), []);

  if (!size || !base) return null;
  const baseSize = base;

  const toBanner = (p: Point) => {
    const r = overlayRef.current?.getBoundingClientRect();
    return { x: (p.clientX - (r?.left ?? 0)) / zoom, y: (p.clientY - (r?.top ?? 0)) / zoom };
  };
  const show = (fn: SizeMutator) => setPreview(previewSize(project, sizeId, fn));
  const commit = (fn: SizeMutator) => update((d) => mutateSize(d, sizeId, fn));
  const clearTransient = () => { setPreview(null); setGuides([]); setMarquee(null); };

  const begin = (onMove: (ev: PointerEvent) => void, onUp: () => void) => {
    cleanupRef.current?.();
    function cleanup() {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', finish);
      window.removeEventListener('pointercancel', finish);
      window.removeEventListener('keydown', cancel, true);
      cleanupRef.current = null;
    }
    function finish() { cleanup(); onUp(); }
    function cancel(ev: KeyboardEvent) {
      if (ev.key !== 'Escape') return;
      ev.stopImmediatePropagation();
      cleanup();
      clearTransient();
    }
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', finish);
    window.addEventListener('pointercancel', finish);
    window.addEventListener('keydown', cancel, true);
    cleanupRef.current = cleanup;
  };

  const startMove = (p: Point, ids: readonly ID[], onTap?: () => void) => {
    const els = baseSize.elements.filter((el) => ids.includes(el.id) && !el.locked);
    const box = unionRect(els.map((el) => aabb(el)));
    if (!box) return;
    const others = baseSize.elements.filter((el) => !el.hidden && !ids.includes(el.id)).map((el) => aabb(el));
    const targets = snapTargetsFor({ x: 0, y: 0, width: baseSize.width, height: baseSize.height }, others);
    const sx = p.clientX;
    const sy = p.clientY;
    let last: SizeMutator | null = null;

    begin((ev) => {
      if (!last && Math.hypot(ev.clientX - sx, ev.clientY - sy) < DRAG_THRESHOLD_PX) return;
      let dx = Math.round((ev.clientX - sx) / zoom);
      let dy = Math.round((ev.clientY - sy) / zoom);
      const axis = ev.shiftKey ? (Math.abs(dx) >= Math.abs(dy) ? 'x' : 'y') : null; // Shift = constrain
      if (axis === 'x') dy = 0;
      if (axis === 'y') dx = 0;
      let g: Guide[] = [];
      if (!ev.altKey) { // Alt = no snapping
        const s = snapMove({ ...box, x: box.x + dx, y: box.y + dy }, targets, SNAP_SCREEN_PX / zoom);
        if (axis !== 'y') dx += s.dx;
        if (axis !== 'x') dy += s.dy;
        g = axis ? s.guides.filter((gd) => gd.axis === axis) : s.guides;
      }
      const fx = dx;
      const fy = dy;
      last = (s) => {
        for (const el of s.elements) {
          const o = els.find((x) => x.id === el.id);
          if (o) { el.x = o.x + fx; el.y = o.y + fy; }
        }
      };
      show(last);
      setGuides(g);
    }, () => {
      if (last) commit(last);
      else onTap?.();
      clearTransient();
    });
  };

  const startResize = (e: DivPointer, el: BannerElement, handle: Handle) => {
    e.stopPropagation();
    const start = { x: el.x, y: el.y, width: el.width, height: el.height, rotation: el.rotation };
    const sx = e.clientX;
    const sy = e.clientY;
    let last: SizeMutator | null = null;
    begin((ev) => {
      const f = resizeFrame(start, handle, (ev.clientX - sx) / zoom, (ev.clientY - sy) / zoom, ev.shiftKey);
      const r = { x: Math.round(f.x), y: Math.round(f.y), width: Math.round(f.width), height: Math.round(f.height) };
      last = (s) => {
        const t = s.elements.find((x) => x.id === el.id);
        if (t) setFrame(t, r);
      };
      show(last);
    }, () => {
      if (last) commit(last);
      clearTransient();
    });
  };

  const startRotate = (e: DivPointer, el: BannerElement) => {
    e.stopPropagation();
    const r = overlayRef.current?.getBoundingClientRect();
    const cx = (r?.left ?? 0) + (el.x + el.width / 2) * zoom;
    const cy = (r?.top ?? 0) + (el.y + el.height / 2) * zoom;
    const a0 = pointerAngle(cx, cy, e.clientX, e.clientY);
    let last: SizeMutator | null = null;
    begin((ev) => {
      const rot = rotationFromPointer(el.rotation, a0, pointerAngle(cx, cy, ev.clientX, ev.clientY), ev.shiftKey);
      last = (s) => {
        const t = s.elements.find((x) => x.id === el.id);
        if (t) t.rotation = rot;
      };
      show(last);
    }, () => {
      if (last) commit(last);
      clearTransient();
    });
  };

  const startMarquee = (e: DivPointer) => {
    const additive = e.shiftKey;
    const baseSel = additive ? useEditorStore.getState().selection : [];
    if (!additive) select([]);
    const p0 = toBanner(e);
    const candidates = baseSize.elements.filter((el) => !el.hidden && !el.locked);
    begin((ev) => {
      const p = toBanner(ev);
      if (Math.hypot(p.x - p0.x, p.y - p0.y) * zoom < DRAG_THRESHOLD_PX) return;
      const rect = normalizeRect(p0.x, p0.y, p.x, p.y);
      setMarquee(rect);
      const hits = candidates.filter((el) => intersects(aabb(el), rect)).map((el) => el.id);
      select([...baseSel, ...hits]);
    }, () => setMarquee(null));
  };

  const onHitboxDown = (e: DivPointer, el: BannerElement) => {
    if (e.button !== 0 || el.locked) return;
    e.stopPropagation();
    const current = useEditorStore.getState().selection;
    const already = current.includes(el.id);
    if (e.shiftKey) {
      select([el.id], 'toggle');
      if (!already) startMove(e, [...current, el.id]);
      return;
    }
    if (!already) {
      select([el.id]);
      startMove(e, [el.id]);
      return;
    }
    // Clicking (without dragging) one item of a multi-selection selects just that item.
    startMove(e, current, () => select([el.id]));
  };

  const visible = size.elements
    .map((el, i) => ({ el, i }))
    .filter(({ el }) => !el.hidden)
    .sort((a, b) => a.el.zIndex - b.el.zIndex || a.i - b.i);
  const selectedEls = size.elements.filter((el) => selection.includes(el.id) && !el.hidden);
  const first = selectedEls[0];
  const single = selectedEls.length === 1 && first && !first.locked ? first : null;
  const multiBox = selectedEls.length > 1 ? unionRect(selectedEls.map((el) => aabb(el))) : null;

  return (
    <div className="canvas" style={{ width: size.width, height: size.height, '--inv': String(1 / zoom) } as CSSProperties}>
      <div ref={hostRef} className="canvas-render" />
      <div
        ref={overlayRef}
        className="canvas-overlay"
        onPointerDown={(e) => { if (e.button === 0 && e.target === e.currentTarget) startMarquee(e); }}
      >
        {visible.map(({ el }) => (
          <div
            key={el.id}
            className="hitbox"
            data-name={el.name}
            aria-label={el.name}
            data-selected={selection.includes(el.id)}
            data-locked={el.locked}
            style={{
              left: el.x, top: el.y, width: el.width, height: el.height,
              transform: el.rotation ? `rotate(${el.rotation}deg)` : undefined,
            }}
            onPointerDown={(e) => onHitboxDown(e, el)}
          />
        ))}
      </div>
      <div className="canvas-ui">
        {guides.map((g, i) => (
          <div key={`${g.axis}${g.pos}-${i}`} className={`guide guide-${g.axis}`} style={g.axis === 'x' ? { left: g.pos } : { top: g.pos }} />
        ))}
        {marquee && (
          <div className="marquee" style={{ left: marquee.x, top: marquee.y, width: marquee.width, height: marquee.height }} />
        )}
        {multiBox && (
          <div className="multi-box" style={{ left: multiBox.x, top: multiBox.y, width: multiBox.width, height: multiBox.height }} />
        )}
        {single && (
          <div
            className="transformer"
            data-norotate={!canRotate(single)}
            style={{
              left: single.x, top: single.y, width: single.width, height: single.height,
              transform: single.rotation ? `rotate(${single.rotation}deg)` : undefined,
            }}
          >
            {HANDLES.map((h) => (
              <div
                key={h}
                className={`handle handle-${h}`}
                style={{ cursor: HANDLE_CURSORS[h] }}
                onPointerDown={(e) => { if (e.button === 0) startResize(e, single, h); }}
              />
            ))}
            <div
              className="rotate-handle"
              title="Rotate (Shift = 15° steps)"
              onPointerDown={(e) => { if (e.button === 0) startRotate(e, single); }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
