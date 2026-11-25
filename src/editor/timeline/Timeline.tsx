import { type PointerEvent as ReactPointerEvent, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ANIMATION_PRESETS, EMPHASIS_PRESETS, animationEnd, totalSeconds } from '@/model/animation';
import type { ID, Size } from '@/model/types';
import type { EditorMode } from '../EditorHeader';
import { useElementSize } from '../hooks/useElementSize';
import { stackOrder } from '../layers';
import { mutateSize } from '../mutate';
import { findElement } from '../ops';
import { useEditorStore } from '../store/editorStore';
import {
  MAX_ZOOM, SNAP_STEP, type Span, clampZoom, nextZoom, playheadPosition, prevZoom, rulerTicks, seekMs, snapTime, timelineRow,
} from './model';
import { usePlayhead } from './playhead';

const PRESET_LABEL = new Map<string, string>([...ANIMATION_PRESETS, ...EMPHASIS_PRESETS]);
const fmtS = (n: number): string => `${Math.round(n * 100) / 100} s`;
const BAR_LABEL_MIN_PX = 44;
/** Width of the layer-name column (see .tl-names in timeline.css). */
const NAMES = 150;
const SNAP_KEY = 'bannr:timelineSnap';
/** Step while Shift is held, in seconds. */
const SHIFT_STEP = 0.5;
let gestureSeq = 0;
const ROW_H = 24;
/** Ruler (20 px) + room for the sideways scrollbar (10 px). */
const TL_EXTRA = 30;
const MIN_ROWS = 5;
const MAX_ROWS = 8;
const ROWS_KEY = 'bannr:timelineRows';
const clampRows = (n: number): number => Math.min(MAX_ROWS, Math.max(MIN_ROWS, Math.round(n)));
function readRows(): number {
  try { return clampRows(Number(localStorage.getItem(ROWS_KEY)) || MIN_ROWS); } catch { return MIN_ROWS; }
}

function readSnap(): boolean {
  try {
    return localStorage.getItem(SNAP_KEY) !== '0';
  } catch {
    return true;
  }
}

/** Sets an entrance/exit delay. One drag = one undo step (shared coalesce key). */
function setDelay(id: ID, phase: 'in' | 'out' | 'emphasis', delay: number, key: string): void {
  const { activeSizeId, update } = useEditorStore.getState();
  if (!activeSizeId) return;
  update((d) => mutateSize(d, activeSizeId, (s) => {
    const step = findElement(s.elements, id)?.animation[phase];
    if (step && step.delay !== delay) step.delay = delay;
  }), { coalesceKey: key });
}

interface Props { size: Size; mode: EditorMode; onSeek: (ms: number) => void }

export function Timeline({ size, mode, onSeek }: Props) {
  const selection = useEditorStore((s) => s.selection);
  const select = useEditorStore((s) => s.select);
  const settings = useEditorStore((s) => s.project?.settings);
  const ms = usePlayhead();
  const [snap, setSnapState] = useState(readSnap);
  const [zoom, setZoom] = useState(1);
  const [visRows, setVisRowsState] = useState(readRows);
  const setVisRows = (n: number) => {
    const v = clampRows(n);
    setVisRowsState(v);
    try { localStorage.setItem(ROWS_KEY, String(v)); } catch { /* storage blocked */ }
  };
  /** Drag the top edge: the height snaps to whole rows. */
  const onResizeDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();
    const y0 = e.clientY;
    const h0 = TL_EXTRA + visRows * ROW_H;
    document.body.classList.add('tl-resizing');
    const move = (ev: PointerEvent) => setVisRows((h0 + (y0 - ev.clientY) - TL_EXTRA) / ROW_H);
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      document.body.classList.remove('tl-resizing');
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };
  const [setBody, body] = useElementSize<HTMLDivElement>();
  const bodyEl = useRef<HTMLDivElement | null>(null);
  const bodyRef = useCallback((n: HTMLDivElement | null) => { bodyEl.current = n; setBody(n); }, [setBody]);
  const rootRef = useRef<HTMLDivElement>(null);
  const pending = useRef<{ t: number; off: number } | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);
  useEffect(() => () => cleanupRef.current?.(), []);

  const a = size.animationSettings;
  const loop = a.duration > 0 ? a.duration : 1;
  const plays = Math.max(1, Math.round(a.loops));
  const preview = mode === 'preview';
  const base = Math.max(0, body.width - NAMES);
  const pps = base > 0 ? (base * zoom) / loop : 0;
  const rows = stackOrder(size.elements).reverse().map((el) => timelineRow(el));
  const pos = playheadPosition(ms, a);
  const total = totalSeconds(a);
  const over = settings ? total > settings.maxAnimationSeconds + 1e-9 || a.loops > settings.maxLoops : false;

  const setSnap = (v: boolean) => {
    setSnapState(v);
    try { localStorage.setItem(SNAP_KEY, v ? '1' : '0'); } catch { /* storage blocked */ }
  };
  /** Snap is on unless switched off; holding Alt flips it for one drag. */
  const snapped = (t: number, alt: boolean, shift = false): number =>
    snapTime(t, shift ? SHIFT_STEP : snap !== alt ? SNAP_STEP : 0);

  /** Zooms, keeping the moment under the pointer (or the middle of the view) in place. */
  const zoomTo = (z: number, clientX?: number) => {
    const nz = clampZoom(z);
    const b = bodyEl.current;
    if (b && pps > 0) {
      const r = b.getBoundingClientRect();
      const view = Math.max(0, b.clientWidth - NAMES);
      const off = clientX === undefined ? view / 2 : Math.min(view, Math.max(0, clientX - r.left - NAMES));
      pending.current = { t: (b.scrollLeft + off) / pps, off };
    }
    setZoom(nz);
  };
  const zoomRef = useRef(zoomTo);
  zoomRef.current = zoomTo;
  const zRef = useRef(zoom);
  zRef.current = zoom;

  useLayoutEffect(() => {
    const b = bodyEl.current;
    const p = pending.current;
    if (!b || !p || pps <= 0) return;
    pending.current = null;
    b.scrollLeft = Math.max(0, p.t * pps - p.off);
  }, [zoom, pps]);

  // Ctrl/Cmd + mouse wheel zooms the timeline.
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      e.preventDefault();
      zoomRef.current(zRef.current * (e.deltaY < 0 ? 1.25 : 0.8), e.clientX);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  // While zoomed in Preview, keep the playhead in view.
  useEffect(() => {
    const b = bodyEl.current;
    if (!preview || zoom <= 1 || !b || pps <= 0) return;
    const x = pos.t * pps;
    const view = b.clientWidth - NAMES;
    if (x < b.scrollLeft || x > b.scrollLeft + view - 20) b.scrollLeft = Math.max(0, x - view * 0.2);
  }, [preview, zoom, pps, pos.t]);

  const drag = (onMove: (ev: PointerEvent) => void) => {
    cleanupRef.current?.();
    function cleanup() {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', cleanup);
      window.removeEventListener('pointercancel', cleanup);
      cleanupRef.current = null;
    }
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', cleanup);
    window.addEventListener('pointercancel', cleanup);
    cleanupRef.current = cleanup;
  };

  const onRulerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!preview || e.button !== 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    if (rect.width <= 0) return;
    const play = pos.play;
    const seekAt = (x: number, alt: boolean, shift: boolean) =>
      onSeek(seekMs(snapped(((x - rect.left) / rect.width) * loop, alt, shift), a, play));
    seekAt(e.clientX, e.altKey, e.shiftKey);
    drag((ev) => seekAt(ev.clientX, ev.altKey, ev.shiftKey));
  };

  const onBarDown = (e: ReactPointerEvent<HTMLDivElement>, id: ID, phase: 'in' | 'out' | 'emphasis', span: Span, locked: boolean) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    select([id]);
    if (preview || locked || pps <= 0) return;
    e.preventDefault();
    const sx = e.clientX;
    const key = `tl:${id}:${phase}:${++gestureSeq}`;
    drag((ev) => setDelay(id, phase, snapped(span.start + (ev.clientX - sx) / pps, ev.altKey, ev.shiftKey), key));
  };

  return (
    <div className="timeline" aria-label="Timeline" ref={rootRef}>
      <div className="tl-resize" role="separator" aria-orientation="horizontal" aria-label="Resize the timeline"
        title="Drag to resize (snaps to rows, up to 8) · double-click to reset"
        onPointerDown={onResizeDown} onDoubleClick={() => setVisRows(MIN_ROWS)} />
      <div className="tl-head">
        <span className="tl-title">Timeline</span>
        <span className="tl-total" data-over={over}>
          Loop {fmtS(a.duration)} × {plays} {plays === 1 ? 'play' : 'plays'} = {fmtS(total)} · animations end at {fmtS(animationEnd(size.elements))}
          {settings ? ` · limit ${settings.maxAnimationSeconds} s, ${settings.maxLoops} plays` : ''}
        </span>
        <span className="tl-time">
          {preview ? `${pos.t.toFixed(1)} s · play ${pos.play}/${plays}` : 'Drag bars to change delays · Shift = 0.5 s · Ctrl + scroll to zoom'}
        </span>
        <div className="tl-tools">
          <button
            type="button"
            className="tl-snap"
            aria-pressed={snap}
            title="Snap to 0.1 s steps. Hold Shift while dragging for 0.5 s steps, or Alt to switch snapping for one drag."
            onClick={() => setSnap(!snap)}
          >
            Snap
          </button>
          <span className="tb-sep" />
          <button type="button" className="mini" aria-label="Zoom timeline out" disabled={zoom <= 1} onClick={() => zoomTo(prevZoom(zoom))}>−</button>
          <button type="button" className="mini tl-zoom" aria-label="Timeline zoom" title="Reset zoom (Ctrl + scroll to zoom)" onClick={() => zoomTo(1)}>
            {Math.round(zoom * 100)}%
          </button>
          <button type="button" className="mini" aria-label="Zoom timeline in" disabled={zoom >= MAX_ZOOM} onClick={() => zoomTo(nextZoom(zoom))}>+</button>
        </div>
      </div>
      {rows.length === 0 ? (
        <p className="muted small tl-empty">No layers yet. Add one from the toolbar.</p>
      ) : (
        <div className="tl-body" ref={bodyRef} style={{ height: TL_EXTRA + visRows * ROW_H }}>
          <div className="tl-names">
            <div className="tl-corner" />
            {rows.map((r) => (
              <button key={r.id} type="button" className="tl-name" title={r.name}
                data-selected={selection.includes(r.id)} data-hidden={r.hidden} onClick={() => select([r.id])}>
                {r.name}
              </button>
            ))}
          </div>
          <div className="tl-right" style={base > 0 ? { width: base * zoom, flex: 'none' } : undefined}>
            <div className="tl-ruler" data-scrub={preview} onPointerDown={onRulerDown}
              title={preview ? 'Click or drag to jump to a moment' : 'Switch to Preview to scrub'}>
              {rulerTicks(loop, pps).map((t) => <span key={t} className="tl-tick" style={{ left: t * pps }}>{t}</span>)}
            </div>
            {rows.map((r) => (
              <div key={r.id} className="tl-track" data-selected={selection.includes(r.id)} data-hidden={r.hidden}>
                {(['in', 'emphasis', 'out'] as const).map((phase) => {
                  const span = r[phase];
                  if (!span) return null;
                  const width = Math.max(6, (span.end - span.start) * pps);
                  const label = PRESET_LABEL.get(span.preset) ?? span.preset;
                  return (
                    <div key={phase} className="tl-bar" data-phase={phase} data-over={span.end > loop + 1e-9}
                      data-static={preview || r.locked} style={{ left: span.start * pps, width }}
                      title={`${phase === 'in' ? 'Entrance' : phase === 'out' ? 'Exit' : 'Emphasis'}: ${label}, ${fmtS(span.start)} to ${fmtS(span.end)}`}
                      onPointerDown={(e) => onBarDown(e, r.id, phase, span, r.locked)}>
                      {width >= BAR_LABEL_MIN_PX ? label : null}
                    </div>
                  );
                })}
              </div>
            ))}
            {preview && pps > 0 && <div className="tl-playhead" style={{ left: pos.t * pps }} />}
          </div>
        </div>
      )}
    </div>
  );
}
