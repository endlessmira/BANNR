import { sizeFit, sizeFitIssues } from '@/components/fit';
import { getComponent } from '@/components/registry';
import type { ComponentElement, Size } from '@/model/types';
import { toggleLayer } from '../layers';
import { findSize } from '../ops';
import { useEditorStore } from '../store/editorStore';

/** ⚠ next to a size in the Sizes panel when one of its components does not suit it. */
export function SizeFitBadge({ size }: { size: Size }) {
  const issues = sizeFitIssues(size);
  if (issues.length === 0) return null;
  const title = issues.map((i) => `${i.name}: ${i.reason}`).join('\n');
  return (
    <span className="size-warn" title={title} aria-label={`${issues.length} component warning${issues.length === 1 ? '' : 's'}`}>
      ⚠
    </span>
  );
}

/** Reason, suggestion and a quick fix, shown in the component settings on an unsuitable size. */
export function ComponentFitNotice({ el }: { el: ComponentElement }) {
  const size = useEditorStore((s) => (s.project ? findSize(s.project, s.activeSizeId) : undefined));
  const def = getComponent(el.componentType);
  if (!size || !def) return null;
  const f = sizeFit(def, size.width, size.height);
  if (f.level === 'ok') return null;
  return (
    <div className="anim-warn fit-notice" role="note">
      <p>{f.reason}</p>
      <p><b>Suggestion:</b> {f.suggestion}</p>
      {!el.hidden && (
        <button type="button" className="secondary small-btn" onClick={() => toggleLayer(el.id, 'hidden')}>
          Hide on this size
        </button>
      )}
    </div>
  );
}
