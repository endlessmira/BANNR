import { useState } from 'react';
import type { BannerElement, ID, Size } from '@/model/types';
import { arrange, groupSelection, moveLayer, renameLayer, stackOrder, toggleLayer, ungroupSelection } from '../layers';
import { useEditorStore } from '../store/editorStore';

const icon = (el: BannerElement): string =>
  el.type === 'text' ? 'T'
  : el.type === 'image' ? '▣'
  : el.type === 'button' ? '◼'
  : el.type === 'group' ? '❒'
  : el.type === 'component' ? '✦'
  : el.shape === 'ellipse' ? '◯' : '▭';

export function LayersPanel({ size }: { size: Size }) {
  const selection = useEditorStore((s) => s.selection);
  const select = useEditorStore((s) => s.select);
  const [renaming, setRenaming] = useState<{ id: ID; name: string } | null>(null);
  const [dragId, setDragId] = useState<ID | null>(null);
  const [dropIdx, setDropIdx] = useState<number | null>(null);

  const rows = stackOrder(size.elements).reverse(); // top layer first, like design tools
  const n = rows.length;
  const sel = new Set(selection);
  const selTop = size.elements.filter((e) => sel.has(e.id));
  const canGroup = selTop.filter((e) => !e.locked).length >= 2;
  const canUngroup = selTop.some((e) => e.type === 'group' && !e.locked);
  const canArrange = selTop.length > 0;

  const commitRename = () => {
    if (renaming) {
      const name = renaming.name.trim();
      if (name) renameLayer(renaming.id, name);
    }
    setRenaming(null);
  };
  const endDrag = () => { setDragId(null); setDropIdx(null); };

  return (
    <div className="layers">
      <div className="layers-head">
        <h2>Layers</h2>
        <div className="layers-actions">
          <button className="mini" title="Bring forward (Ctrl/Cmd+])" disabled={!canArrange} onClick={() => arrange('forward')}>▲</button>
          <button className="mini" title="Send backward (Ctrl/Cmd+[)" disabled={!canArrange} onClick={() => arrange('backward')}>▼</button>
          <button className="mini" title="Group (Ctrl/Cmd+G)" disabled={!canGroup} onClick={groupSelection}>Group</button>
          <button className="mini" title="Ungroup (Ctrl/Cmd+Shift+G)" disabled={!canUngroup} onClick={ungroupSelection}>Ungroup</button>
        </div>
      </div>
      {n === 0 && <p className="muted small">No layers yet. Add one from the toolbar.</p>}
      <ul className="layer-list">
        {rows.map((el, i) => (
          <li key={el.id}>
            <div
              className="layer"
              data-selected={sel.has(el.id)}
              data-hidden={el.hidden}
              data-drop={dropIdx === i ? 'before' : dropIdx === n && i === n - 1 ? 'after' : undefined}
              draggable={renaming?.id !== el.id}
              onDragStart={(e) => {
                setDragId(el.id);
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', el.id);
              }}
              onDragOver={(e) => {
                if (!dragId) return;
                e.preventDefault();
                const r = e.currentTarget.getBoundingClientRect();
                setDropIdx(e.clientY < r.top + r.height / 2 ? i : i + 1);
              }}
              onDrop={(e) => {
                e.preventDefault();
                if (dragId !== null && dropIdx !== null) {
                  const from = rows.findIndex((x) => x.id === dragId);
                  const to = from < dropIdx ? dropIdx - 1 : dropIdx;
                  moveLayer(dragId, n - 1 - to);
                }
                endDrag();
              }}
              onDragEnd={endDrag}
              onClick={(e) => select([el.id], e.shiftKey ? 'toggle' : 'replace')}
              onDoubleClick={() => setRenaming({ id: el.id, name: el.name })}
              title="Click to select · double-click to rename · drag to reorder"
            >
              <span className="layer-icon">{icon(el)}</span>
              {renaming?.id === el.id ? (
                <input
                  className="layer-input"
                  autoFocus
                  aria-label="Layer name"
                  value={renaming.name}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => setRenaming({ id: el.id, name: e.target.value })}
                  onBlur={commitRename}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commitRename();
                    if (e.key === 'Escape') setRenaming(null);
                  }}
                />
              ) : (
                <span className="layer-name">{el.name}</span>
              )}
              <button
                className="layer-toggle"
                data-on={el.hidden}
                aria-label={`${el.hidden ? 'Show' : 'Hide'} ${el.name}`}
                title={el.hidden ? 'Show' : 'Hide'}
                onClick={(e) => { e.stopPropagation(); toggleLayer(el.id, 'hidden'); }}
              >
                {el.hidden ? '○' : '●'}
              </button>
              <button
                className="layer-toggle"
                data-on={el.locked}
                aria-label={`${el.locked ? 'Unlock' : 'Lock'} ${el.name}`}
                title={el.locked ? 'Unlock' : 'Lock'}
                onClick={(e) => { e.stopPropagation(); toggleLayer(el.id, 'locked'); }}
              >
                {el.locked ? '🔒' : '🔓'}
              </button>
            </div>
            {el.type === 'group' && (
              <ul className="layer-children">
                {stackOrder(el.children).reverse().map((c) => (
                  <li key={c.id} className="layer child">
                    <span className="layer-icon">{icon(c)}</span>
                    <span className="layer-name">{c.name}</span>
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
