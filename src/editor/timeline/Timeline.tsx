import { type PointerEvent as ReactPointerEvent, useEffect, useRef } from 'react';
import { ANIMATION_PRESETS, animationEnd, totalSeconds } from '@/model/animation';
import type { ID, Size } from '@/model/types';
import type { EditorMode } from '../EditorHeader';
import { useElementSize } from '../hooks/useElementSize';
import { stackOrder } from '../layers';
import { mutateSize } from '../mutate';
import { findElement } from '../ops';
import { useEditorStore } from '../store/editorStore';
import { type Span, playheadPosition, rulerTicks, seekMs, snapTime, timelineRow } from './model';
import { usePlayhead } from './playhead';

const PRESET_LABEL = new Map(ANIMATION_PRESETS);
const fmtS = (n: number): string => `${Math.round(n * 100) / 100} s`;
const BAR_LABEL_MIN_PX = 44;
let gestureSeq = 0;

/** Sets an entrance/exit delay. One drag = one undo step (shared coalesce key). */
function setDelay(id: ID, phase: 'in' | 'out', delay: number, key: string): void {
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
  const [trackRef, track] = useElementSize<HTMLDivElement>();
  const cleanupRef = useRef<(() => void) | null>(null);
  useEffect(() => () => cleanupRef.current?.(), []);

  const a = size.animationSettings;
  const loop = a.duration > 0 ? a.duration : 1;
  const plays = Math.max(1, Math.round(a.loops));
  const pps = track.width > 0 ? track.width / loop : 0;
  const preview = mode === 'preview';
  const rows = stackOrder(size.elements).reverse().map((el) => timelineRow(el));
  const pos = playheadPosition(ms, a);
  const total = totalSeconds(a);
  const over = settings ? total > settings.maxAnimationSeconds + 1e-9 || a.loops > settings.maxLoops : false;

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
    const seekAt = (x: number) => onSeek(seekMs(((x - rect.left) / rect.width) * loop, a, play));
    seekAt(e.clientX);
    drag((ev) => seekAt(ev.clientX));
  };

  const onBarDown = (e: ReactPointerEvent<HTMLDivElement>, id: ID, phase: 'in' | 'out', span: Span, locked: boolean) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    select([id]);
    if (preview || locked || pps <= 0) return;
    e.preventDefault();
    const sx = e.clientX;
    const key = `tl:${id}:${phase}:${++gestureSeq}`;
    drag((ev) => setDelay(id, phase, snapTime(span.start + (ev.clientX - sx) / pps), key));
  };

  return (
    <div className="timeline" aria-label="Timeline">
      <div className="tl-head">
        <span className="tl-title">Timeline</span>
        <span className="tl-total" data-over={over}>
          Loop {fmtS(a.duration)} × {plays} {plays === 1 ? 'play' : 'plays'} = {fmtS(total)} · animations end at {fmtS(animationEnd(size.elements))}
          {settings ? ` · limit ${settings.maxAnimationSeconds} s, ${settings.maxLoops} plays` : ''}
        </span>
        <span className="tl-time">
          {preview ? `${fmtS(pos.t)} · play ${pos.play}/${plays}` : 'Drag bars to change delays · switch to Preview to scrub'}
        </span>
      </div>
      {rows.length === 0 ? (
        <p className="muted small tl-empty">No layers yet. Add one from the toolbar.</p>
      ) : (
        <div className="tl-body">
          <div className="tl-names">
            <div className="tl-corner" />
            {rows.map((r) => (
              <button key={r.id} type="button" className="tl-name" title={r.name}
                data-selected={selection.includes(r.id)} data-hidden={r.hidden} onClick={() => select([r.id])}>
                {r.name}
              </button>
            ))}
          </div>
          <div className="tl-right" ref={trackRef}>
            <div className="tl-ruler" data-scrub={preview} onPointerDown={onRulerDown}
              title={preview ? 'Click or drag to jump to a moment' : 'Switch to Preview to scrub'}>
              {rulerTicks(loop).map((t) => <span key={t} className="tl-tick" style={{ left: t * pps }}>{t}</span>)}
            </div>
            {rows.map((r) => (
              <div key={r.id} className="tl-track" data-selected={selection.includes(r.id)} data-hidden={r.hidden}>
                {(['in', 'out'] as const).map((phase) => {
                  const span = r[phase];
                  if (!span) return null;
                  const width = Math.max(6, (span.end - span.start) * pps);
                  const label = PRESET_LABEL.get(span.preset) ?? span.preset;
                  return (
                    <div key={phase} className="tl-bar" data-phase={phase} data-over={span.end > loop + 1e-9}
                      data-static={preview || r.locked} style={{ left: span.start * pps, width }}
                      title={`${phase === 'in' ? 'Entrance' : 'Exit'}: ${label}, ${fmtS(span.start)} to ${fmtS(span.end)}`}
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
