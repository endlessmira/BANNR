import { type FormEvent, type KeyboardEvent, useState } from 'react';
import { STANDARD_SIZES, sizeKey } from '@/model/sizes';
import type { Project } from '@/model/types';
import { type AddMode, type Dim, MAX_DIM, MIN_DIM, addSizes, masterOf } from '../sizes';

export function AddSizesDialog({ project, onClose }: { project: Project; onClose: () => void }) {
  const existing = new Set(project.sizes.map((s) => sizeKey(s.width, s.height)));
  const master = masterOf(project);
  const [picked, setPicked] = useState<Set<string>>(() => new Set());
  const [custom, setCustom] = useState<Dim[]>([]);
  const [cw, setCw] = useState('');
  const [ch, setCh] = useState('');
  const [mode, setMode] = useState<AddMode>('master');
  const [error, setError] = useState<string | null>(null);

  const toggle = (k: string) =>
    setPicked((prev) => {
      const n = new Set(prev);
      if (n.has(k)) n.delete(k);
      else n.add(k);
      return n;
    });

  const addCustom = () => {
    const w = Number(cw);
    const h = Number(ch);
    if (!Number.isInteger(w) || !Number.isInteger(h) || w < MIN_DIM || h < MIN_DIM || w > MAX_DIM || h > MAX_DIM) {
      setError(`Width and height must be whole numbers between ${MIN_DIM} and ${MAX_DIM}.`);
      return;
    }
    const k = sizeKey(w, h);
    if (existing.has(k) || picked.has(k) || custom.some((c) => sizeKey(c.width, c.height) === k)) {
      setError(`${w}×${h} is already in the project or in your list.`);
      return;
    }
    setCustom([...custom, { width: w, height: h }]);
    setCw('');
    setCh('');
    setError(null);
  };

  const onCustomKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addCustom();
    }
  };

  const dims: Dim[] = [
    ...STANDARD_SIZES.filter((s) => picked.has(sizeKey(s.width, s.height))).map((s) => ({ width: s.width, height: s.height })),
    ...custom,
  ];

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (dims.length === 0) return;
    addSizes(dims, mode);
    onClose();
  };

  return (
    <div className="modal-backdrop" onPointerDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <form className="modal modal-wide" onSubmit={submit} aria-labelledby="as-title">
        <h1 id="as-title">Add sizes</h1>

        <fieldset className="field">
          <legend>Standard sizes</legend>
          <div className="size-grid">
            {STANDARD_SIZES.map((s) => {
              const k = sizeKey(s.width, s.height);
              const has = existing.has(k);
              return (
                <label key={k} className="size-option" data-disabled={has}>
                  <input type="checkbox" disabled={has} checked={has || picked.has(k)} onChange={() => toggle(k)} />
                  <span>
                    <b>{s.width}×{s.height}</b>
                    <small>{has ? 'already added' : s.label}</small>
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>

        <fieldset className="field">
          <legend>Custom size</legend>
          <div className="custom-row">
            <input aria-label="Custom width" placeholder="Width" inputMode="numeric" value={cw}
              onChange={(e) => setCw(e.target.value)} onKeyDown={onCustomKey} />
            <span>×</span>
            <input aria-label="Custom height" placeholder="Height" inputMode="numeric" value={ch}
              onChange={(e) => setCh(e.target.value)} onKeyDown={onCustomKey} />
            <button type="button" className="secondary" onClick={addCustom}>Add to list</button>
          </div>
          {custom.length > 0 && (
            <div className="card-meta">
              {custom.map((c) => (
                <span key={sizeKey(c.width, c.height)} className="chip">
                  {c.width}×{c.height}
                  <button
                    type="button"
                    className="chip-x"
                    aria-label={`Remove ${c.width}×${c.height}`}
                    onClick={() => setCustom(custom.filter((x) => x !== c))}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
          {error && <p className="save-error small">{error}</p>}
        </fieldset>

        <fieldset className="field">
          <legend>Start new sizes from</legend>
          <label className="check">
            <input type="radio" name="add-mode" checked={mode === 'master'} onChange={() => setMode('master')} />
            The master layout{master ? ` (${master.width}×${master.height})` : ''}, auto-adapted
          </label>
          <label className="check">
            <input type="radio" name="add-mode" checked={mode === 'blank'} onChange={() => setMode('blank')} />
            A blank banner (same background)
          </label>
        </fieldset>

        <div className="modal-actions">
          <button type="button" className="secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="primary" disabled={dims.length === 0}>
            {dims.length > 0 ? `Add ${dims.length} size${dims.length > 1 ? 's' : ''}` : 'Pick at least one size'}
          </button>
        </div>
      </form>
    </div>
  );
}
