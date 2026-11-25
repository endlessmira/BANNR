import { useMemo, useState } from 'react';
import { listComponents } from '@/components/registry';
import type { ComponentCategory, ComponentDefinition } from '@/components/types';
import { createComponent, createProject, createSize } from '@/model/factories';
import { renderBanner } from '@/renderer';
import { addComponent } from './actions';
import { componentWeightKB } from './weight';

export const COMPONENT_DRAG_TYPE = 'application/x-bannr-component';

const CATEGORY_LABELS: Record<ComponentCategory, string> = {
  motion: 'Motion', '3d': '3D', carousel: 'Carousels', reveal: 'Reveal', widget: 'Widgets', game: 'Games',
};
const ORDER: ComponentCategory[] = ['motion', '3d', 'carousel', 'reveal', 'widget', 'game'];
const THUMB_W = 104;
const THUMB_H = 60;

interface Card { key: string; def: ComponentDefinition; presetId?: string; title: string; aria: string; description: string }

/** One card per component, plus one per preset (each preset is its own card). */
function buildCards(): Card[] {
  const out: Card[] = [];
  for (const def of listComponents()) {
    out.push({ key: def.type, def, title: def.label, aria: def.label, description: def.description });
    for (const p of def.presets ?? []) {
      out.push({
        key: `${def.type}:${p.id}`, def, presetId: p.id, title: p.label, aria: `${def.label} · ${p.label}`,
        description: p.description ?? def.description,
      });
    }
  }
  return out;
}

/** A live mini banner with just this component, so the thumbnail is animated. */
function previewHtml(def: ComponentDefinition, presetId?: string): string {
  const { width, height } = def.defaultSize;
  const size = createSize(width, height, {
    elements: [createComponent({ id: 'eprev', componentType: def.type, componentVersion: def.version, preset: presetId, width, height })],
  });
  const p = createProject('Preview', { platform: 'cm360', sizes: [size] });
  return renderBanner(p, size.id, { resolveAsset: () => '' }).html;
}

function Thumb({ def, presetId }: { def: ComponentDefinition; presetId?: string }) {
  const html = useMemo(() => previewHtml(def, presetId), [def, presetId]);
  const { width, height } = def.defaultSize;
  const s = Math.min(THUMB_W / width, THUMB_H / height, 1);
  return (
    <div className="comp-thumb" style={{ width: THUMB_W, height: THUMB_H }}>
      <iframe
        title={`${def.label} preview`}
        srcDoc={html}
        sandbox="allow-scripts"
        tabIndex={-1}
        width={width}
        height={height}
        style={{ transform: `scale(${s})`, left: (THUMB_W - width * s) / 2, top: (THUMB_H - height * s) / 2 }}
      />
    </div>
  );
}

export function ComponentsPanel({ onClose }: { onClose: () => void }) {
  const [q, setQ] = useState('');
  const cards = useMemo(buildCards, []);
  const term = q.trim().toLowerCase();
  const shown = term
    ? cards.filter((c) => `${c.aria} ${c.description} ${CATEGORY_LABELS[c.def.category]}`.toLowerCase().includes(term))
    : cards;
  const groups = ORDER.map((cat) => [cat, shown.filter((c) => c.def.category === cat)] as const).filter(([, l]) => l.length > 0);
  const add = (c: Card) => {
    addComponent(c.def.type, c.presetId);
    onClose();
  };

  return (
    <aside className="comp-panel" aria-label="Components" onKeyDown={(e) => { if (e.key === 'Escape') onClose(); }}>
      <div className="comp-head">
        <h2>Components</h2>
        <button type="button" className="mini" aria-label="Close components" onClick={onClose}>×</button>
      </div>
      <input className="ti" aria-label="Search components" placeholder="Search…" value={q} autoFocus onChange={(e) => setQ(e.target.value)} />
      <p className="muted small">Click a card to add it, or drag it onto the banner.</p>
      {groups.map(([cat, list]) => (
        <section key={cat}>
          <h3 className="comp-cat">{CATEGORY_LABELS[cat]}</h3>
          <div className="comp-grid">
            {list.map((c) => (
              <div
                key={c.key}
                role="button"
                tabIndex={0}
                className="comp-card"
                aria-label={c.aria}
                title={c.description}
                draggable
                onClick={() => add(c)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); add(c); } }}
                onDragStart={(e) => {
                  e.dataTransfer.setData(COMPONENT_DRAG_TYPE, JSON.stringify({ type: c.def.type, preset: c.presetId ?? null }));
                  e.dataTransfer.effectAllowed = 'copy';
                }}
              >
                <Thumb def={c.def} presetId={c.presetId} />
                <div className="comp-title"><span className="comp-icon">{c.def.icon}</span><b>{c.title}</b></div>
                <small>{c.description}</small>
                <small className="comp-weight">
                  {componentWeightKB(c.def)} KB · min {c.def.minSize.width}×{c.def.minSize.height}
                </small>
              </div>
            ))}
          </div>
        </section>
      ))}
      {shown.length === 0 && <p className="muted small">No components match “{q}”.</p>}
    </aside>
  );
}
