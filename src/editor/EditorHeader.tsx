import { useState } from 'react';
import logoUrl from '@/assets/bannr-logo.svg';
import { PLATFORM_LABELS } from '@/model/platforms';
import type { Project } from '@/model/types';
import type { SaveStatus } from './hooks/useAutosave';
import { useEditorStore } from './store/editorStore';

export type EditorMode = 'edit' | 'preview';

interface Props {
  project: Project;
  saveStatus: SaveStatus;
  mode: EditorMode;
  onModeChange: (mode: EditorMode) => void;
  onExit: () => void;
  onExport: () => void;
}

const SAVE_LABEL: Record<SaveStatus, string> = { saved: 'All changes saved', saving: 'Saving…', error: 'Save failed' };

export function EditorHeader({ project, saveStatus, mode, onModeChange, onExit, onExport }: Props) {
  const canUndo = useEditorStore((s) => s.past.length > 0);
  const canRedo = useEditorStore((s) => s.future.length > 0);
  const undo = useEditorStore((s) => s.undo);
  const redo = useEditorStore((s) => s.redo);
  const update = useEditorStore((s) => s.update);
  const [draftName, setDraftName] = useState<string | null>(null);

  const commitName = () => {
    const name = draftName?.trim();
    if (name && name !== project.name) update((d) => { d.name = name; });
    setDraftName(null);
  };

  return (
    <header className="app-header">
      <button className="icon-btn" onClick={onExit} title="Back to projects">←</button>
      <img src={logoUrl} alt="BANNR" className="app-logo" />
      {draftName === null ? (
        <button className="project-name" onClick={() => setDraftName(project.name)} title="Click to rename">
          {project.name}
        </button>
      ) : (
        <input
          className="project-name-input"
          value={draftName}
          autoFocus
          onChange={(e) => setDraftName(e.target.value)}
          onBlur={commitName}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commitName();
            if (e.key === 'Escape') setDraftName(null);
          }}
        />
      )}
      <span className={`save-status save-${saveStatus}`}>{SAVE_LABEL[saveStatus]}</span>

      <div className="header-actions">
        <button className="icon-btn" onClick={undo} disabled={!canUndo} title="Undo (Ctrl/Cmd+Z)">↶</button>
        <button className="icon-btn" onClick={redo} disabled={!canRedo} title="Redo (Ctrl/Cmd+Shift+Z)">↷</button>
        <div className="segmented">
          <button aria-pressed={mode === 'edit'} onClick={() => onModeChange('edit')}>Edit</button>
          <button aria-pressed={mode === 'preview'} onClick={() => onModeChange('preview')}>Preview</button>
        </div>
        <span className="platform-badge" title="Target ad platform">{PLATFORM_LABELS[project.selectedPlatform]}</span>
        <button className="primary small-btn header-export" onClick={onExport} title="Download ad-server-ready zips">Export</button>
      </div>
    </header>
  );
}
