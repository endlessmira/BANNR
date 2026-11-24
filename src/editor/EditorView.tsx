import { type DragEvent, type ReactNode, useCallback, useState } from 'react';
import { BannerPreview } from '@/app/components/BannerPreview';
import type { BannerElement } from '@/model/types';
import type { TestClickMessage } from '@/renderer/preview';
import { type UploadTarget, uploadImages, useAssetUrls } from './assets';
import { EditorCanvas } from './canvas/EditorCanvas';
import { type EditorMode, EditorHeader } from './EditorHeader';
import { useAutosave } from './hooks/useAutosave';
import { useEditorShortcuts } from './hooks/useEditorShortcuts';
import { useElementSize } from './hooks/useElementSize';
import { findElement, findSize } from './ops';
import { LayersPanel } from './panels/LayersPanel';
import { PropertiesPanel } from './panels/PropertiesPanel';
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
  const [notice, setNotice] = useState<string | null>(null);
  const onTestClick = useCallback((m: TestClickMessage) => setLastClick(m), []);
  const assetUrls = useAssetUrls(project);

  const onUpload = useCallback((files: File[], target?: UploadTarget) => {
    uploadImages(files, target).then(
      (r) => { if (r.warnings.length > 0) setNotice(r.warnings.join(' ')); },
      (e: unknown) => setNotice(`Upload failed: ${e instanceof Error ? e.message : String(e)}`),
    );
  }, []);

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

  const onDragOver = (e: DragEvent<HTMLElement>) => {
    if (mode === 'edit' && e.dataTransfer.types.includes('Files')) e.preventDefault();
  };
  const onDrop = (e: DragEvent<HTMLElement>) => {
    if (mode !== 'edit' || e.dataTransfer.files.length === 0) return;
    e.preventDefault();
    onUpload([...e.dataTransfer.files]);
  };

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
          <LayersPanel size={size} />
          <details className="shortcuts">
            <summary>Keyboard shortcuts</summary>
            <div className="hint">
              <div><kbd>Drag</kbd> move · <kbd>Shift</kbd> constrain · <kbd>Alt</kbd> no snap</div>
              <div><kbd>Shift</kbd>+resize keep ratio · +rotate 15°</div>
              <div><kbd>←↑→↓</kbd> nudge · <kbd>Shift</kbd> 10px</div>
              <div><kbd>Ctrl/Cmd</kbd>+<kbd>C</kbd> <kbd>X</kbd> <kbd>V</kbd> <kbd>D</kbd> <kbd>A</kbd></div>
              <div><kbd>Ctrl/Cmd</kbd>+<kbd>G</kbd> group · +<kbd>Shift</kbd> ungroup</div>
              <div><kbd>Ctrl/Cmd</kbd>+<kbd>]</kbd> <kbd>[</kbd> forward / backward</div>
              <div><kbd>Ctrl/Cmd</kbd>+<kbd>Z</kbd> undo · +<kbd>Shift</kbd> redo</div>
              <div><kbd>Del</kbd> delete · <kbd>Esc</kbd> deselect</div>
            </div>
          </details>
        </aside>

        <section
          ref={stageRef}
          className="stage"
          onPointerDown={(e) => { if (mode === 'edit' && e.target === e.currentTarget) select([]); }}
          onDragOver={onDragOver}
          onDrop={onDrop}
        >
          {mode === 'edit' && (
            <Toolbar zoomMode={zoomMode} zoom={zoom} onZoomChange={setZoomMode} selectionCount={editableCount} onUpload={onUpload} />
          )}
          <ZoomBox width={size.width} height={size.height} zoom={zoom}>
            {mode === 'edit' ? (
              <EditorCanvas project={project} sizeId={size.id} assetUrls={assetUrls} zoom={zoom} />
            ) : (
              <BannerPreview project={project} sizeId={size.id} assetUrls={assetUrls} onTestClick={onTestClick} />
            )}
          </ZoomBox>
          {mode === 'preview' && lastClick && (
            <div className="toast">Test click → <code>{lastClick.url}</code> ({lastClick.target})</div>
          )}
          {notice && (
            <div className="toast toast-warn" role="alert">
              <span>{notice}</span>
              <button className="toast-x" aria-label="Dismiss" onClick={() => setNotice(null)}>×</button>
            </div>
          )}
        </section>

        <aside className="panel panel-right">
          <PropertiesPanel size={size} selected={selected} onUpload={onUpload} />
        </aside>
      </main>
    </div>
  );
}
