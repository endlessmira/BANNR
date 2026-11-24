import { type ReactNode, useCallback, useState } from 'react';
import { DEMO_ASSET_URLS } from '@/app/assetUrls';
import { BannerPreview } from '@/app/components/BannerPreview';
import type { BannerElement } from '@/model/types';
import type { TestClickMessage } from '@/renderer/preview';
import { EditorCanvas } from './canvas/EditorCanvas';
import { type EditorMode, EditorHeader } from './EditorHeader';
import { useAutosave } from './hooks/useAutosave';
import { useEditorShortcuts } from './hooks/useEditorShortcuts';
import { useElementSize } from './hooks/useElementSize';
import { findElement, findSize } from './ops';
import { useEditorStore } from './store/editorStore';
import { Toolbar, type ZoomMode } from './Toolbar';

const FIT_MARGIN = 16;

function ZoomBox({ width, height, zoom, children }: { width: number; height: number; zoom: number; children: ReactNode }) {
  return (
    <div className="zoom-box" style={{ width: width * zoom, height: height * zoom }}>
      <div className="zoom-inner" style={{ width, height, transform: `scale(${zoom})` }}>{children}</div>
    </div>
  );
}

export function EditorView({ onExit }: { onExit: () => void }) {
  const project = useEditorStore((s) => s.project);
  const activeSizeId = useEditorStore((s) => s.activeSizeId);
  const selection = useEditorStore((s) => s.selection);
  const setActiveSize = useEditorStore((s) => s.setActiveSize);
  const select = useEditorStore((s) => s.select);
  const saveStatus = useAutosave();
  const [mode, setMode] = useState<EditorMode>('edit');
  useEditorShortcuts(mode === 'edit');
  const [zoomMode, setZoomMode] = useState<ZoomMode>('fit');
  const [stageRef, stage] = useElementSize<HTMLElement>();
  const [lastClick, setLastClick] = useState<TestClickMessage | null>(null);
  const onTestClick = useCallback((m: TestClickMessage) => setLastClick(m), []);

  const size = project ? findSize(project, activeSizeId) : undefined;
  if (!project || !size) return null;

  const fit = stage.width > 0 && stage.height > 0
    ? Math.max(0.1, Math.min(1, (stage.width - FIT_MARGIN) / size.width, (stage.height - FIT_MARGIN) / size.height))
    : 1;
  const zoom = zoomMode === 'fit' ? fit : zoomMode;

  const selected = selection
    .map((id) => findElement(size.elements, id))
    .filter((el): el is BannerElement => el !== undefined);
  const editableCount = selected.filter((el) => !el.locked).length;

  return (
    <div className="editor">
      <EditorHeader project={project} saveStatus={saveStatus} mode={mode} onModeChange={setMode} onExit={onExit} />
      <main className="workspace">
        <aside className="panel">
          <h2>Sizes</h2>
          {project.sizes.map((s) => (
            <button key={s.id} className="size-btn" aria-pressed={s.id === size.id} onClick={() => setActiveSize(s.id)}>
              {s.width}×{s.height}
              {s.id === project.masterSizeId && <span className="tag">master</span>}
            </button>
          ))}
          <div className="hint">
            <div><kbd>Drag</kbd> move · <kbd>Shift</kbd> constrain</div>
            <div><kbd>Alt</kbd>+drag no snapping</div>
            <div><kbd>Shift</kbd>+resize keep ratio</div>
            <div><kbd>Shift</kbd>+rotate 15° steps</div>
            <div><kbd>Drag</kbd> on empty area: box select</div>
            <div><kbd>←↑→↓</kbd> nudge · <kbd>Shift</kbd> 10px</div>
            <div><kbd>Ctrl/Cmd</kbd>+<kbd>C</kbd> <kbd>X</kbd> <kbd>V</kbd> <kbd>D</kbd> <kbd>A</kbd></div>
            <div><kbd>Ctrl/Cmd</kbd>+<kbd>Z</kbd> undo · +<kbd>Shift</kbd> redo</div>
            <div><kbd>Del</kbd> delete · <kbd>Esc</kbd> deselect / cancel</div>
          </div>
        </aside>

        <section
          ref={stageRef}
          className="stage"
          onPointerDown={(e) => { if (mode === 'edit' && e.target === e.currentTarget) select([]); }}
        >
          {mode === 'edit' && (
            <Toolbar zoomMode={zoomMode} zoom={zoom} onZoomChange={setZoomMode} selectionCount={editableCount} />
          )}
          <ZoomBox width={size.width} height={size.height} zoom={zoom}>
            {mode === 'edit' ? (
              <EditorCanvas project={project} sizeId={size.id} assetUrls={DEMO_ASSET_URLS} zoom={zoom} />
            ) : (
              <BannerPreview project={project} sizeId={size.id} assetUrls={DEMO_ASSET_URLS} onTestClick={onTestClick} />
            )}
          </ZoomBox>
          {mode === 'preview' && lastClick && (
            <div className="toast">Test click → <code>{lastClick.url}</code> ({lastClick.target})</div>
          )}
        </section>

        <aside className="panel panel-right">
          <h2>Selection</h2>
          {selected.length === 0 ? (
            <p className="muted">Click an element, or drag on an empty area to box-select.</p>
          ) : (
            selected.map((el) => (
              <dl key={el.id} className="readout">
                <dt>{el.name}</dt>
                <dd>
                  {el.type} · x {Math.round(el.x)}, y {Math.round(el.y)} · {Math.round(el.width)}×{Math.round(el.height)}
                  {el.rotation ? ` · ${el.rotation}°` : ''}
                  {el.locked ? ' · locked' : ''}
                </dd>
              </dl>
            ))
          )}
          <p className="muted small">Layers and properties panels arrive in Phase 2c.</p>
        </aside>
      </main>
    </div>
  );
}
