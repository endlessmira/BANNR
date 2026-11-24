import { useCallback, useMemo, useState } from 'react';
import logoUrl from '@/assets/bannr-logo.svg';
import { DEMO_LOGO_ASSET_ID, createDemoProject } from '@/model/demo';
import type { Project } from '@/model/types';
import { renderBanner } from '@/renderer';
import type { TestClickMessage } from '@/renderer/preview';
import { BannerPreview } from './components/BannerPreview';
import { Header } from './components/Header';
import { NewProjectDialog } from './components/NewProjectDialog';

export function App() {
  const [project, setProject] = useState<Project | null>(null);
  if (!project) {
    return <NewProjectDialog onCreate={({ name, platform }) => setProject(createDemoProject({ name, platform }))} />;
  }
  return <Workspace project={project} />;
}

function Workspace({ project }: { project: Project }) {
  const [sizeId, setSizeId] = useState(project.sizes[0]?.id ?? '');
  const [lastClick, setLastClick] = useState<TestClickMessage | null>(null);
  const assetUrls = useMemo(() => ({ [DEMO_LOGO_ASSET_ID]: new URL(logoUrl, window.location.href).href }), []);

  // Same renderer, export-style options: relative asset paths.
  const exported = useMemo(
    () => renderBanner(project, sizeId, { resolveAsset: (id) => `images/${project.assets[id]?.fileName ?? id}` }),
    [project, sizeId],
  );
  const kb = (new Blob([exported.html]).size / 1024).toFixed(1);
  const onTestClick = useCallback((m: TestClickMessage) => setLastClick(m), []);

  return (
    <>
      <Header projectName={project.name} platform={project.selectedPlatform} />
      <main className="workspace">
        <aside className="panel">
          <h2>Sizes</h2>
          {project.sizes.map((s) => (
            <button key={s.id} className="size-btn" aria-pressed={s.id === sizeId} onClick={() => setSizeId(s.id)}>
              {s.width}×{s.height}
            </button>
          ))}
        </aside>
        <section className="stage">
          <BannerPreview project={project} sizeId={sizeId} assetUrls={assetUrls} onTestClick={onTestClick} />
          {lastClick && <div className="toast">Test click → <code>{lastClick.url}</code> ({lastClick.target})</div>}
        </section>
        <aside className="panel panel-right">
          <h2>index.html · {kb} KB · assets: {exported.usedAssetIds.length}</h2>
          <pre className="code">{exported.html}</pre>
        </aside>
      </main>
    </>
  );
}
