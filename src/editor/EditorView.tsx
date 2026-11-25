import { type CSSProperties, type DragEvent, type ReactNode, useCallback, useEffect, useState } from 'react';
import { BannerPreview, type PlayState, type SeekRequest } from '@/app/components/BannerPreview';
import { ExportDialog } from '@/export/ExportDialog';
import { KbCounter } from '@/export/KbCounter';
import type { BannerElement } from '@/model/types';
import type { TestClickMessage } from '@/renderer/preview';
import { type UploadTarget, uploadImages, useAssetUrls } from './assets';
import { EditorCanvas } from './canvas/EditorCanvas';
import { addComponent } from './componentPanel/actions';
import { COMPONENT_DRAG_TYPE, ComponentsPanel } from './componentPanel/ComponentsPanel';
import { type EditorMode, EditorHeader } from './EditorHeader';
import { useDocumentFonts } from './fonts/useDocumentFonts';
import { useAutosave } from './hooks/useAutosave';
import { usePanelWidth } from './hooks/usePanelWidth';
import { PanelBar } from './panels/PanelBar';
import { useEditorShortcuts } from './hooks/useEditorShortcuts';
import { useElementSize } from './hooks/useElementSize';
import { findElement, findSize } from './ops';
import { LayersPanel } from './panels/LayersPanel';
import { PropertiesPanel } from './panels/PropertiesPanel';
import { SizesPanel } from './panels/SizesPanel';
import { PreviewControls } from './PreviewControls';
import { useEditorStore } from './store/editorStore';
import { playhead } from './timeline/playhead';
import { Timeline } from './timeline/Timeline';
import { Toolbar, type ZoomMode } from './Toolbar';

const FIT_MARGIN = 40;

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
  const select = useEditorStore((s) => s.select);
  const saveStatus = useAutosave();
  const [mode, setMode] = useState<EditorMode>('edit');
  useEditorShortcuts(mode === 'edit');
  const [zoomMode, setZoomMode] = useState<ZoomMode>('fit');
  const [stageRef, stage] = useElementSize<HTMLElement>();
  const [lastClick, setLastClick] = useState<TestClickMessage | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [playState, setPlayState] = useState<PlayState>('playing');
  const [restartKey, setRestartKey] = useState(0);
  const [seek, setSeek] = useState<SeekRequest | null>(null);
  const [exporting, setExporting] = useState(false);
  const [componentsOpen, setComponentsOpen] = useState(false);
  const [events, setEvents] = useState<string[]>([]);
  const onTestClick = useCallback((m: TestClickMessage) => setLastClick(m), []);
  const onTrack = useCallback((name: string) => setEvents((ev) => [...ev, name].slice(-6)), []);
  const assetUrls = useAssetUrls(project);
  const panel = usePanelWidth();
  useDocumentFonts(project, assetUrls);

  const onUpload = useCallback((files: File[], target?: UploadTarget) => {
    uploadImages(files, target).then(
      (r) => { const msgs = [...r.notes, ...r.warnings]; if (msgs.length > 0) setNotice(msgs.join(' ')); },
      (e: unknown) => setNotice(`Upload failed: ${e instanceof Error ? e.message : String(e)}`),
    );
  }, []);

  const restart = useCallback(() => {
    setPlayState('playing');
    setSeek(null);
    setEvents([]);
    playhead.set(0);
    setRestartKey((k) => k + 1);
  }, []);

  const onSeek = useCallback((ms: number) => {
    setPlayState('paused');
    setSeek((s) => ({ ms, n: (s?.n ?? 0) + 1 }));
  }, []);

  const changeMode = useCallback((m: EditorMode) => {
    setMode(m);
    if (m === 'preview') {
      setLastClick(null);
      setComponentsOpen(false);
      restart();
    }
  }, [restart]);

  // Space switches between Edit and Preview / Interact, unless the user is typing or a dialog is open.
  useEffect(() => {
    const typing = (t: EventTarget | null): boolean =>
      t instanceof HTMLElement && (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName));
    const toggle = () => changeMode(mode === 'edit' ? 'preview' : 'edit');
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'Space' || e.repeat || e.ctrlKey || e.metaKey || e.altKey || typing(e.target)) return;
      if (document.querySelector('.modal-backdrop')) return;
      e.preventDefault();
      const a = document.activeElement;
      if (a instanceof HTMLElement && a.tagName === 'BUTTON') a.blur();
      toggle();
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('bannr:toggle-mode', toggle);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('bannr:toggle-mode', toggle);
    };
  }, [mode, changeMode]);

  const size = project ? findSize(project, activeSizeId) : undefined;
  if (!project || !size) return null;

  const fit = stage.width > 0 && stage.height > 0
    ? Math.max(0.1, Math.min(1, (stage.width - FIT_MARGIN) / size.width, (stage.height - FIT_MARGIN) / size.height))
    : 1;
  const zoom = zoomMode === 'fit' ? Math.floor(fit * 50) / 50 : zoomMode;

  const selected = selection
    .map((id) => findElement(size.elements, id))
    .filter((el): el is BannerElement => el !== undefined);
  const editableCount = selected.filter((el) => !el.locked).length;

  const onDragOver = (e: DragEvent<HTMLElement>) => {
    if (mode !== 'edit') return;
    const types = e.dataTransfer.types;
    if (types.includes('Files') || types.includes(COMPONENT_DRAG_TYPE)) e.preventDefault();
  };
  const onDrop = (e: DragEvent<HTMLElement>) => {
    if (mode !== 'edit') return;
    const raw = e.dataTransfer.getData(COMPONENT_DRAG_TYPE);
    if (raw) {
      e.preventDefault();
      try {
        const d = JSON.parse(raw) as { type?: unknown; preset?: unknown };
        if (typeof d.type === 'string') {
          const r = document.querySelector('.canvas-overlay')?.getBoundingClientRect();
          const at = r ? { x: (e.clientX - r.left) / zoom, y: (e.clientY - r.top) / zoom } : undefined;
          addComponent(d.type, typeof d.preset === 'string' ? d.preset : undefined, at);
        }
      } catch {
        // not a BANNR component drag
      }
      return;
    }
    if (e.dataTransfer.files.length === 0) return;
    e.preventDefault();
    onUpload([...e.dataTransfer.files]);
  };

  return (
    <div className="editor">
      <EditorHeader project={project} saveStatus={saveStatus} mode={mode} onModeChange={changeMode} onExit={onExit} onExport={() => setExporting(true)} />
      {exporting && <ExportDialog project={project} assetUrls={assetUrls} onClose={() => setExporting(false)} />}
      <main className="workspace" style={{ '--rp': `${panel.width}px` } as CSSProperties}>
        <aside className="panel">
          <SizesPanel project={project} activeSizeId={size.id} />
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
              <div><kbd>Space</kbd> Edit ⇄ Preview / Interact</div>
            </div>
          </details>
        </aside>

        <div className="center-col">
          {mode === 'edit' && componentsOpen && <ComponentsPanel onClose={() => setComponentsOpen(false)} />}
          <section
            ref={stageRef}
            className="stage"
            data-fit={zoomMode === 'fit'}
            onPointerDown={(e) => { if (mode === 'edit' && e.target === e.currentTarget) select([]); }}
            onDragOver={onDragOver}
            onDrop={onDrop}
          >
            {mode === 'edit' ? (
              <Toolbar
                zoomMode={zoomMode}
                zoom={zoom}
                onZoomChange={setZoomMode}
                selectionCount={editableCount}
                onUpload={onUpload}
                componentsOpen={componentsOpen}
                onComponents={() => setComponentsOpen((o) => !o)}
              />
            ) : (
              <PreviewControls
                size={size}
                playState={playState}
                onToggle={() => setPlayState((p) => (p === 'playing' ? 'paused' : 'playing'))}
                onRestart={restart}
              />
            )}
            <ZoomBox width={size.width} height={size.height} zoom={zoom}>
              {mode === 'edit' ? (
                <EditorCanvas project={project} sizeId={size.id} assetUrls={assetUrls} zoom={zoom} />
              ) : (
                <BannerPreview
                  project={project}
                  sizeId={size.id}
                  assetUrls={assetUrls}
                  onTestClick={onTestClick}
                  onTrack={onTrack}
                  playState={playState}
                  restartKey={restartKey}
                  seek={seek}
                />
              )}
            </ZoomBox>
            <KbCounter project={project} sizeId={size.id} />
            {mode === 'preview' && lastClick && (
              <div className="toast">
                {lastClick.url
                  ? <>Test click → <code>{lastClick.url}</code> ({lastClick.target})</>
                  : 'Test click: no landing URL yet. It will be set in the ad server or DSP.'}
              </div>
            )}
            {mode === 'preview' && events.length > 0 && (
              <div className="events-log" aria-label="Tracked events">Events: {events.join(' · ')}</div>
            )}
            {notice && (
              <div className="toast toast-warn" role="alert">
                <span>{notice}</span>
                <button className="toast-x" aria-label="Dismiss" onClick={() => setNotice(null)}>×</button>
              </div>
            )}
          </section>
          <Timeline size={size} mode={mode} onSeek={onSeek} />
        </div>

        <div className="rp-handle" role="separator" aria-orientation="vertical" aria-label="Resize the properties panel"
          title="Drag to resize · double-click to reset" onPointerDown={panel.start} onDoubleClick={panel.reset} />
        <aside className="panel panel-right">
          <PanelBar />
          <PropertiesPanel size={size} selected={selected} onUpload={onUpload} />
        </aside>
      </main>
    </div>
  );
}
