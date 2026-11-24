import { useEffect, useState } from 'react';
import { NumberField } from '@/editor/panels/fields';
import { useEditorStore } from '@/editor/store/editorStore';
import { PLATFORM_LABELS } from '@/model/platforms';
import type { ID, PlatformId, Project } from '@/model/types';
import { runChecks } from '@/validation/rules';
import { DEFAULT_TARGET_KB, getAdapter } from './adapters/registry';
import type { ValidationResult } from './adapters/types';
import { renderBackupImage } from './backup';
import { browserDeps, downloadBlob } from './browserDeps';
import { type BackupFile, type SizeExport, allSizesName, buildMasterZip, buildSizeZip, exportBaseName } from './pipeline';

interface SizeCheck { sizeId: ID; label: string; kb: number; results: ValidationResult[] }
interface Row { name: string; kb: number; note?: string }
interface Props { project: Project; assetUrls: Record<ID, string>; onClose: () => void }

const PLATFORM_IDS = Object.keys(PLATFORM_LABELS) as PlatformId[];
const ICON: Record<string, string> = { error: '✖', warning: '⚠', pass: '✔' };
const kbOf = (b: number): number => Math.round((b / 1024) * 10) / 10;
const msg = (e: unknown): string => (e instanceof Error ? e.message : String(e));
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function CheckItem({ r }: { r: ValidationResult }) {
  return (
    <li className="check-item" data-level={r.level}>
      {ICON[r.level]} {r.message}{r.detail ? <small> · {r.detail}</small> : null}
    </li>
  );
}

export function ExportDialog({ project, assetUrls, onClose }: Props) {
  const update = useEditorStore((s) => s.update);
  const adapter = getAdapter(project.selectedPlatform);
  const [picked, setPicked] = useState<Set<ID>>(() => new Set(project.sizes.map((s) => s.id)));
  const [withBackups, setWithBackups] = useState(true);
  const [landing, setLanding] = useState(project.landingUrl);
  const [checks, setChecks] = useState<SizeCheck[] | null>(null);
  const [checking, setChecking] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const chosen = project.sizes.filter((s) => picked.has(s.id));
  const chosenKey = chosen.map((s) => s.id).join(',');
  const settings = project.settings;

  useEffect(() => { setLanding(project.landingUrl); }, [project.landingUrl]);

  // Re-check (debounced) whenever the project or the chosen sizes change.
  useEffect(() => {
    let cancelled = false;
    setChecking(true);
    const timer = setTimeout(() => {
      void (async () => {
        try {
          const out: SizeCheck[] = [];
          for (const s of chosen) {
            const r = await buildSizeZip(project, s.id, browserDeps);
            if (cancelled) return;
            out.push({
              sizeId: s.id,
              label: `${s.width}×${s.height}`,
              kb: kbOf(r.manifest.totalBytes),
              results: runChecks({
                project, size: s, adapter: getAdapter(project.selectedPlatform), manifest: r.manifest,
                missingAssets: r.missingAssets, convertedWebp: r.convertedWebp,
              }),
            });
          }
          if (!cancelled) { setChecks(out); setError(null); }
        } catch (e) {
          if (!cancelled) setError(msg(e));
        } finally {
          if (!cancelled) setChecking(false);
        }
      })();
    }, 400);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [project, chosenKey]);

  const errorCount = (checks ?? []).reduce((n, c) => n + c.results.filter((r) => r.level === 'error').length, 0);
  const blocked = busy !== null || checking || chosen.length === 0 || errorCount > 0;

  const toggle = (id: ID) =>
    setPicked((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const setPlatform = (id: PlatformId) => update((d) => { d.selectedPlatform = id; });
  const setLandingUrl = (v: string) => {
    setLanding(v);
    update((d) => { d.landingUrl = v; }, { coalesceKey: 'export:landing' });
  };
  const setSetting = (key: 'targetZipKB' | 'maxAnimationSeconds' | 'maxLoops', v: number) =>
    update((d) => { d.settings[key] = v; }, { coalesceKey: `export:${key}` });

  const run = async (bundle: boolean) => {
    setError(null);
    setRows(null);
    try {
      const results: SizeExport[] = [];
      const backups: BackupFile[] = [];
      const out: Row[] = [];
      for (const s of chosen) {
        setBusy(`Building ${s.width}×${s.height}…`);
        const r = await buildSizeZip(project, s.id, browserDeps);
        results.push(r);
        out.push({ name: r.fileName, kb: kbOf(r.manifest.totalBytes) });
        if (withBackups) {
          const name = `${exportBaseName(project, s)}_backup.jpg`;
          const max = adapter.constraints.backupMaxKB ?? 150;
          try {
            const b = await renderBackupImage(project, s.id, assetUrls, max);
            backups.push({ name, blob: b.blob });
            out.push({ name, kb: kbOf(b.bytes), ...(b.overLimit ? { note: `Over the ${max} KB backup limit, even at the lowest quality.` } : {}) });
          } catch (e) {
            out.push({ name, kb: 0, note: `Backup image failed: ${msg(e)}` });
          }
        }
      }
      if (bundle) {
        setBusy('Packing all sizes…');
        downloadBlob(await buildMasterZip(results, backups), allSizesName(project));
      } else {
        for (const r of results) { downloadBlob(r.zip, r.fileName); await sleep(300); }
        for (const b of backups) { downloadBlob(b.blob, b.name, 'image/jpeg'); await sleep(300); }
      }
      setRows(out);
    } catch (e) {
      setError(msg(e));
    } finally {
      setBusy(null);
    }
  };

  const status = checking
    ? 'Checking…'
    : errorCount > 0
      ? `${errorCount} error${errorCount === 1 ? '' : 's'} must be fixed before export`
      : chosen.length === 0 ? 'Pick at least one size' : 'Ready to export';

  return (
    <div
      className="modal-backdrop"
      onPointerDown={(e) => { if (e.target === e.currentTarget && !busy) onClose(); }}
      onKeyDown={(e) => {
        e.stopPropagation(); // keep editor shortcuts away from the canvas
        if (e.key === 'Escape' && !busy) onClose();
      }}
    >
      <div className="modal modal-wide" role="dialog" aria-labelledby="export-title">
        <h1 id="export-title">Export</h1>

        <fieldset className="field" disabled={busy !== null}>
          <div className="export-grid">
            <label className="field">
              <span>Platform</span>
              <select aria-label="Platform" value={project.selectedPlatform} onChange={(e) => setPlatform(e.target.value as PlatformId)}>
                {PLATFORM_IDS.map((id) => <option key={id} value={id}>{PLATFORM_LABELS[id]}</option>)}
              </select>
            </label>
            <label className="field">
              <span>Landing URL</span>
              <input aria-label="Landing URL" spellCheck={false} value={landing} placeholder="Optional: leave empty to set it in the ad server or DSP"
                onChange={(e) => setLandingUrl(e.target.value)} />
            </label>
          </div>
        </fieldset>

        <fieldset className="field" disabled={busy !== null}>
          <legend>Sizes</legend>
          <div className="export-sizes">
            {project.sizes.map((s) => (
              <label key={s.id} className="check">
                <input type="checkbox" checked={picked.has(s.id)} onChange={() => toggle(s.id)} />
                {s.width}×{s.height}
              </label>
            ))}
          </div>
          <label className="check">
            <input type="checkbox" checked={withBackups} onChange={(e) => setWithBackups(e.target.checked)} />
            Include backup images (JPG, separate from the zips)
          </label>
        </fieldset>

        <fieldset className="field" disabled={busy !== null}>
          <legend>Limits</legend>
          <div className="export-limits">
            <NumberField label="Target KB" min={10} max={10240} value={settings.targetZipKB ?? DEFAULT_TARGET_KB}
              onChange={(v) => setSetting('targetZipKB', Math.round(v))} />
            <NumberField label="Max seconds" min={1} max={600} value={settings.maxAnimationSeconds}
              onChange={(v) => setSetting('maxAnimationSeconds', v)} />
            <NumberField label="Max plays" min={1} max={20} value={settings.maxLoops}
              onChange={(v) => setSetting('maxLoops', Math.round(v))} />
          </div>
        </fieldset>

        <section className="field">
          <span>Checklist · <b className="check-status" data-errors={errorCount > 0}>{status}</b></span>
          <div className="checklist">
            {(checks ?? []).map((c) => {
              const errs = c.results.filter((r) => r.level === 'error');
              const warns = c.results.filter((r) => r.level === 'warning');
              const passes = c.results.filter((r) => r.level === 'pass');
              return (
                <div key={c.sizeId} className="check-size">
                  <div className="check-head">
                    <b>{c.label}</b> · {c.kb} KB
                    {errs.length > 0 ? ` · ${errs.length} error${errs.length === 1 ? '' : 's'}` : ''}
                    {warns.length > 0 ? ` · ${warns.length} warning${warns.length === 1 ? '' : 's'}` : ''}
                  </div>
                  {errs.length + warns.length > 0 && (
                    <ul className="check-list">{[...errs, ...warns].map((r, i) => <CheckItem key={`${r.ruleId}-${i}`} r={r} />)}</ul>
                  )}
                  <details>
                    <summary>{passes.length} checks passed</summary>
                    <ul className="check-list">{passes.map((r, i) => <CheckItem key={`${r.ruleId}-${i}`} r={r} />)}</ul>
                  </details>
                </div>
              );
            })}
          </div>
        </section>

        {busy && <p className="notice" role="status">{busy}</p>}
        {error && <p className="save-error small">Export failed: {error}</p>}
        {rows && (
          <ul className="export-report" aria-label="Export report">
            {rows.map((r) => (
              <li key={r.name}>
                <b>{r.name}</b> · {r.kb} KB
                {r.note && <div className="note">{r.note}</div>}
              </li>
            ))}
          </ul>
        )}

        <div className="modal-actions">
          <button type="button" className="secondary" disabled={busy !== null} onClick={onClose}>Close</button>
          <button type="button" className="secondary" disabled={blocked} onClick={() => void run(false)}>Download zips</button>
          <button type="button" className="primary" disabled={blocked} onClick={() => void run(true)}>
            Download all sizes (one zip)
          </button>
        </div>
      </div>
    </div>
  );
}
