import { useRef, useState } from 'react';
import { ACCEPT_FONTS, FONT_WEIGHTS, POPULAR_GOOGLE_FONTS, guessFromFileName } from '@/model/fonts';
import type { FontRef, Project } from '@/model/types';
import { useEditorStore } from '../store/editorStore';
import { addGoogleFont, removeFont, uploadFontFile } from './fontActions';

const WEIGHT_LABEL: Record<number, string> = {
  100: 'Thin', 200: 'Extra light', 300: 'Light', 400: 'Regular', 500: 'Medium',
  600: 'Semibold', 700: 'Bold', 800: 'Extra bold', 900: 'Black',
};
const kb = (b: number): string => `${Math.max(1, Math.round(b / 1024))} KB`;

function fontBytes(p: Project, f: FontRef): number {
  let n = 0;
  for (const id of new Set(f.faces.map((x) => x.assetId))) n += p.assets[id]?.bytes ?? 0;
  return n;
}
const faceSummary = (f: FontRef): string =>
  [...new Set(f.faces.map((x) => `${x.weight}${x.style === 'italic' ? ' italic' : ''}`))].join(', ');

function FontFileButton({ onFile }: { onFile: (f: File) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <>
      <button type="button" className="secondary small-btn" onClick={() => ref.current?.click()}>Choose file…</button>
      <input
        ref={ref}
        type="file"
        accept={ACCEPT_FONTS}
        hidden
        aria-label="Font file"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (f) onFile(f);
        }}
      />
    </>
  );
}

export function FontsDialog({ onClose }: { onClose: () => void }) {
  const project = useEditorStore((s) => s.project);
  const [family, setFamily] = useState('');
  const [weights, setWeights] = useState<number[]>([400, 700]);
  const [italic, setItalic] = useState(false);
  const [extended, setExtended] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [upFamily, setUpFamily] = useState('');
  const [upWeight, setUpWeight] = useState(400);
  const [upStyle, setUpStyle] = useState<'normal' | 'italic'>('normal');

  if (!project) return null;

  const run = async (fn: () => Promise<string>) => {
    setBusy(true);
    setMsg(null);
    try {
      setMsg({ kind: 'ok', text: await fn() });
    } catch (e) {
      setMsg({ kind: 'error', text: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusy(false);
    }
  };

  const addGoogle = () => run(async () => {
    const r = await addGoogleFont({ family, weights, italic, extended });
    setFamily('');
    return `Added ${r.family}: ${r.files} file${r.files === 1 ? '' : 's'}, ${kb(r.bytes)}.` +
      (r.missing.length > 0 ? ` Not available for this font: ${r.missing.join(', ')}.` : '');
  });

  const addUpload = () => run(async () => {
    if (!file) throw new Error('Choose a font file first.');
    const r = await uploadFontFile(file, upFamily, upWeight, upStyle);
    setFile(null);
    setUpFamily('');
    return `Added ${r.family} (${kb(r.bytes)}).`;
  });

  const pickFile = (f: File) => {
    const g = guessFromFileName(f.name);
    setFile(f);
    setUpFamily(g.family);
    setUpWeight(g.weight);
    setUpStyle(g.style);
  };

  const toggleWeight = (w: number) =>
    setWeights((ws) => (ws.includes(w) ? ws.filter((x) => x !== w) : [...ws, w].sort((a, b) => a - b)));

  const total = project.fonts.reduce((s, f) => s + fontBytes(project, f), 0);

  return (
    <div
      className="modal-backdrop"
      onPointerDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
      onKeyDown={(e) => {
        e.stopPropagation(); // keep editor shortcuts (Delete, arrows…) away from the canvas
        if (e.key === 'Escape') onClose();
      }}
    >
      <div className="modal modal-wide" role="dialog" aria-labelledby="fonts-title">
        <h1 id="fonts-title">Fonts</h1>
        <p className="muted small">
          Fonts added here are stored in the project and included in the exported banner, so nothing loads from the
          internet when the ad runs. Each file adds roughly 15–40 KB, so only add the weights you use.
        </p>

        <section className="field">
          <span>In this project{project.fonts.length > 0 ? ` · ${kb(total)}` : ''}</span>
          {project.fonts.length === 0 ? (
            <p className="muted small">No embedded fonts yet. Text uses web-safe system fonts.</p>
          ) : (
            <ul className="font-list">
              {project.fonts.map((f) => (
                <li key={f.id} className="font-row">
                  <div>
                    <div className="font-sample" style={{ fontFamily: `"${f.family}", Arial` }}>{f.family}</div>
                    <small>{f.source === 'google' ? 'Google Fonts' : 'Uploaded'} · {faceSummary(f)} · {kb(fontBytes(project, f))}</small>
                  </div>
                  <button type="button" className="secondary small-btn danger" aria-label={`Remove ${f.family}`} onClick={() => removeFont(f.id)}>
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <fieldset className="field" disabled={busy}>
          <legend>Add a Google Font</legend>
          <input
            list="bannr-google-fonts"
            aria-label="Google Font name"
            placeholder="e.g. Roboto, Open Sans, Montserrat"
            value={family}
            onChange={(e) => setFamily(e.target.value)}
          />
          <datalist id="bannr-google-fonts">
            {POPULAR_GOOGLE_FONTS.map((f) => <option key={f} value={f} />)}
          </datalist>
          <div className="weight-grid">
            {FONT_WEIGHTS.map((w) => (
              <label key={w} className="check">
                <input type="checkbox" checked={weights.includes(w)} onChange={() => toggleWeight(w)} />
                {w} {WEIGHT_LABEL[w]}
              </label>
            ))}
          </div>
          <label className="check">
            <input type="checkbox" checked={italic} onChange={(e) => setItalic(e.target.checked)} />
            Include italics
          </label>
          <label className="check">
            <input type="checkbox" checked={extended} onChange={(e) => setExtended(e.target.checked)} />
            Include extended Latin (č, ř, ž, ő, ł…)
          </label>
          <button type="button" className="primary" disabled={!family.trim() || weights.length === 0} onClick={() => void addGoogle()}>
            {busy ? 'Working…' : 'Add Google Font'}
          </button>
        </fieldset>

        <fieldset className="field" disabled={busy}>
          <legend>Upload a font file</legend>
          <div className="asset-row">
            <span>{file ? file.name : 'WOFF2, WOFF, TTF or OTF'}</span>
            <FontFileButton onFile={pickFile} />
          </div>
          {file && (
            <>
              <input aria-label="Font family name" placeholder="Family name" value={upFamily} onChange={(e) => setUpFamily(e.target.value)} />
              <div className="custom-row">
                <select aria-label="Font weight" value={upWeight} onChange={(e) => setUpWeight(Number(e.target.value))}>
                  {FONT_WEIGHTS.map((w) => <option key={w} value={w}>{w} {WEIGHT_LABEL[w]}</option>)}
                </select>
                <select aria-label="Font style" value={upStyle} onChange={(e) => setUpStyle(e.target.value === 'italic' ? 'italic' : 'normal')}>
                  <option value="normal">Normal</option>
                  <option value="italic">Italic</option>
                </select>
              </div>
              <p className="muted small">Check that the font's licence allows embedding it in web ads.</p>
              <button type="button" className="primary" disabled={!upFamily.trim()} onClick={() => void addUpload()}>Add font</button>
            </>
          )}
        </fieldset>

        {msg && <p className={msg.kind === 'error' ? 'save-error small' : 'notice'} role="status">{msg.text}</p>}

        <div className="modal-actions">
          <button type="button" className="primary" onClick={onClose}>Done</button>
        </div>
      </div>
    </div>
  );
}
