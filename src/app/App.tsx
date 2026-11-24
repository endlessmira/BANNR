import { useEffect, useState } from 'react';
import { EditorView } from '@/editor/EditorView';
import { useEditorStore } from '@/editor/store/editorStore';
import type { ID } from '@/model/types';
import { projectRepo } from '@/persistence';
import { Dashboard } from './dashboard/Dashboard';

/** Routes: "#/p/<projectId>" opens the editor; anything else shows the dashboard. Survives reloads. */
const parseHash = (): ID | null => /^#\/p\/([a-z0-9_-]+)$/i.exec(window.location.hash)?.[1] ?? null;
const navigate = (id: ID | null) => { window.location.hash = id ? `/p/${id}` : ''; };

export function App() {
  const [routeId, setRouteId] = useState<ID | null>(parseHash);
  const [missing, setMissing] = useState(false);
  const loadedId = useEditorStore((s) => s.project?.id ?? null);

  useEffect(() => {
    const onHash = () => setRouteId(parseHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  useEffect(() => {
    if (!routeId || routeId === useEditorStore.getState().project?.id) return;
    let cancelled = false;
    setMissing(false);
    projectRepo.get(routeId).then(
      (p) => {
        if (cancelled) return;
        if (p) useEditorStore.getState().load(p);
        else setMissing(true);
      },
      () => { if (!cancelled) setMissing(true); },
    );
    return () => { cancelled = true; };
  }, [routeId]);

  if (!routeId) return <Dashboard onOpen={navigate} />;
  if (missing) {
    return (
      <div className="center-msg">
        <p>That project could not be found.</p>
        <button className="primary" onClick={() => navigate(null)}>Back to projects</button>
      </div>
    );
  }
  if (loadedId !== routeId) return <div className="center-msg">Loading…</div>;
  return <EditorView onExit={() => navigate(null)} />;
}
