import { useCallback, useEffect, useState } from 'react';
import logoUrl from '@/assets/bannr-logo.svg';
import { saveQueue } from '@/editor/hooks/useAutosave';
import { createDemoProject } from '@/model/demo';
import { cloneProject } from '@/model/factories';
import { PLATFORM_LABELS } from '@/model/platforms';
import type { ID, Project } from '@/model/types';
import { projectRepo } from '@/persistence';
import type { ProjectSummary } from '@/persistence/repository';
import { type NewProjectInput, NewProjectDialog } from '../components/NewProjectDialog';

export function Dashboard({ onOpen }: { onOpen: (id: ID) => void }) {
  const [projects, setProjects] = useState<ProjectSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [renaming, setRenaming] = useState<{ id: ID; name: string } | null>(null);

  const refresh = useCallback(async () => {
    try {
      await saveQueue.current.catch(() => undefined); // wait for any pending autosave
      setProjects(await projectRepo.list());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const withProject = async (id: ID, fn: (p: Project) => Promise<void>) => {
    const p = await projectRepo.get(id);
    if (p) await fn(p);
    await refresh();
  };

  // Until templates arrive (Phase 3), new projects start from the BANNR demo layout.
  const create = async ({ name, platform }: NewProjectInput) => {
    const p = createDemoProject({ name, platform });
    await projectRepo.save(p);
    onOpen(p.id);
  };

  const duplicate = (id: ID) => withProject(id, (p) => projectRepo.save(cloneProject(p)));

  const commitRename = async () => {
    if (!renaming) return;
    const { id, name } = renaming;
    setRenaming(null);
    const trimmed = name.trim();
    if (!trimmed) return;
    await withProject(id, (p) =>
      p.name === trimmed ? Promise.resolve() : projectRepo.save({ ...p, name: trimmed, updatedAt: new Date().toISOString() }),
    );
  };

  const remove = async (s: ProjectSummary) => {
    if (!window.confirm(`Delete "${s.name}"? This cannot be undone.`)) return;
    await projectRepo.delete(s.id);
    await refresh();
  };

  return (
    <>
      <header className="app-header">
        <img src={logoUrl} alt="BANNR" className="app-logo" />
      </header>
      <main className="dash">
        <div className="dash-top">
          <h1>Projects</h1>
          <button className="primary" onClick={() => setCreating(true)}>+ New project</button>
        </div>

        {error && <p className="save-error">Could not load projects: {error}</p>}

        {projects === null ? (
          <p className="muted">Loading…</p>
        ) : projects.length === 0 ? (
          <div className="empty muted">No projects yet. Click “New project” to create your first banner.</div>
        ) : (
          <div className="dash-grid">
            {projects.map((p) => (
              <article key={p.id} className="card">
                {renaming?.id === p.id ? (
                  <input
                    className="text-input"
                    autoFocus
                    value={renaming.name}
                    onChange={(e) => setRenaming({ id: p.id, name: e.target.value })}
                    onBlur={() => void commitRename()}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') void commitRename();
                      if (e.key === 'Escape') setRenaming(null);
                    }}
                  />
                ) : (
                  <button className="card-name" onClick={() => onOpen(p.id)}>{p.name}</button>
                )}
                <div className="card-meta">
                  <span className="chip chip-platform">{PLATFORM_LABELS[p.platform]}</span>
                  {p.sizes.map((s, i) => <span key={`${s}-${i}`} className="chip">{s}</span>)}
                </div>
                <div className="card-meta">Edited {new Date(p.updatedAt).toLocaleString()}</div>
                <div className="card-actions">
                  <button className="primary" onClick={() => onOpen(p.id)}>Open</button>
                  <button className="secondary" onClick={() => void duplicate(p.id)}>Duplicate</button>
                  <button className="secondary" onClick={() => setRenaming({ id: p.id, name: p.name })}>Rename</button>
                  <button className="secondary danger" onClick={() => void remove(p)}>Delete</button>
                </div>
              </article>
            ))}
          </div>
        )}
      </main>
      {creating && <NewProjectDialog onCreate={(input) => void create(input)} onCancel={() => setCreating(false)} />}
    </>
  );
}
