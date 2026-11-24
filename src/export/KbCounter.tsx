import { useEffect, useState } from 'react';
import type { ID, Project } from '@/model/types';
import { DEFAULT_TARGET_KB, getAdapter } from './adapters/registry';
import { browserDeps } from './browserDeps';
import { buildSizeZip } from './pipeline';

/** Zip size of the active banner size, rebuilt shortly after each change. */
export function KbCounter({ project, sizeId }: { project: Project; sizeId: ID }) {
  const [bytes, setBytes] = useState<number | null>(null);
  useEffect(() => {
    let cancelled = false;
    const t = setTimeout(() => {
      buildSizeZip(project, sizeId, browserDeps).then(
        (r) => { if (!cancelled) setBytes(r.manifest.totalBytes); },
        () => { if (!cancelled) setBytes(null); },
      );
    }, 600);
    return () => { cancelled = true; clearTimeout(t); };
  }, [project, sizeId]);

  const adapter = getAdapter(project.selectedPlatform);
  const max = adapter.constraints.maxZipKB;
  const target = Math.min(project.settings.targetZipKB ?? DEFAULT_TARGET_KB, max);
  const kb = bytes === null ? null : Math.round((bytes / 1024) * 10) / 10;
  const level = kb === null ? 'pending' : kb > max ? 'error' : kb > target ? 'warning' : 'ok';
  return (
    <div className="kb-counter" data-level={level}
      title={`Zip size of this banner size for ${adapter.label}. Target ${target} KB, platform limit ${max} KB.`}>
      {kb === null ? '… KB' : `${kb} KB`} / {target} KB
    </div>
  );
}
