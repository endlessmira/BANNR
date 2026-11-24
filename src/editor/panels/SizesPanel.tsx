import { useState } from 'react';
import type { ID, Project } from '@/model/types';
import { regenerateFromMaster, removeSize, setMaster } from '../sizes';
import { useEditorStore } from '../store/editorStore';
import { AddSizesDialog } from './AddSizesDialog';

export function SizesPanel({ project, activeSizeId }: { project: Project; activeSizeId: ID }) {
  const setActiveSize = useEditorStore((s) => s.setActiveSize);
  const [adding, setAdding] = useState(false);
  const [menu, setMenu] = useState<ID | null>(null);
  const masterId = project.masterSizeId ?? project.sizes[0]?.id;

  return (
    <div className="sizes">
      <div className="layers-head">
        <h2>Sizes</h2>
        <button className="mini" title="Add standard or custom sizes" onClick={() => setAdding(true)}>+ Add</button>
      </div>
      <ul className="size-list">
        {project.sizes.map((s) => {
          const isMaster = s.id === masterId;
          const dims = `${s.width}×${s.height}`;
          return (
            <li key={s.id} className="size-row">
              <button className="size-btn" aria-pressed={s.id === activeSizeId} onClick={() => setActiveSize(s.id)} title={s.label}>
                {dims}
                {isMaster && <span className="tag">master</span>}
              </button>
              <button
                className="mini size-more"
                aria-label={`Options for ${dims}`}
                aria-expanded={menu === s.id}
                onClick={() => setMenu(menu === s.id ? null : s.id)}
              >
                ⋯
              </button>
              {menu === s.id && (
                <div className="size-menu" role="menu" onMouseLeave={() => setMenu(null)}>
                  {!isMaster && (
                    <button role="menuitem" onClick={() => { setMaster(s.id); setMenu(null); }}>
                      Set as master
                    </button>
                  )}
                  {!isMaster && (
                    <button
                      role="menuitem"
                      onClick={() => {
                        setMenu(null);
                        if (window.confirm(`Replace the ${dims} layout with a fresh copy of the master? You can undo this with Ctrl/Cmd+Z.`)) {
                          regenerateFromMaster(s.id);
                        }
                      }}
                    >
                      Regenerate from master
                    </button>
                  )}
                  <button
                    role="menuitem"
                    className="danger"
                    disabled={project.sizes.length <= 1}
                    title={project.sizes.length <= 1 ? 'A project needs at least one size' : 'Undo with Ctrl/Cmd+Z'}
                    onClick={() => { removeSize(s.id); setMenu(null); }}
                  >
                    Delete size
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
      {adding && <AddSizesDialog project={project} onClose={() => setAdding(false)} />}
    </div>
  );
}
