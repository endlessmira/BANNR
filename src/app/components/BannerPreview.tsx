import { useEffect, useMemo, useRef } from 'react';
import type { ID, Project } from '@/model/types';
import { getSize, renderBanner } from '@/renderer';
import { type TestClickMessage, isTestClickMessage, previewInjection } from '@/renderer/preview';

interface Props {
  project: Project;
  sizeId: ID;
  assetUrls: Record<ID, string>;
  onTestClick?: (msg: TestClickMessage) => void;
}

export function BannerPreview({ project, sizeId, assetUrls, onTestClick }: Props) {
  const ref = useRef<HTMLIFrameElement>(null);
  const size = getSize(project, sizeId);
  const html = useMemo(
    () => renderBanner(project, sizeId, {
      resolveAsset: (id) => assetUrls[id] ?? '',
      injection: previewInjection(project.landingUrl),
    }).html,
    [project, sizeId, assetUrls],
  );

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.source !== ref.current?.contentWindow) return; // only messages from our banner
      if (isTestClickMessage(e.data)) onTestClick?.(e.data);
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [onTestClick]);

  return (
    <iframe ref={ref} title={`Preview ${size.width}x${size.height}`} srcDoc={html}
      sandbox="allow-scripts" width={size.width} height={size.height} className="preview-frame" />
  );
}
