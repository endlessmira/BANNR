import { useEffect, useMemo, useRef } from 'react';
import type { ID, Project } from '@/model/types';
import { getSize, renderBanner } from '@/renderer';
import { cssKeyframesEngine } from '@/renderer/animation/cssKeyframes';
import { ANIM_MESSAGE, type TestClickMessage, isTestClickMessage, previewInjection } from '@/renderer/preview';

export type PlayState = 'playing' | 'paused';

interface Props {
  project: Project;
  sizeId: ID;
  assetUrls: Record<ID, string>;
  onTestClick?: (msg: TestClickMessage) => void;
  playState?: PlayState;
  /** Changing this reloads the banner, restarting the animation. */
  restartKey?: number;
}

export function BannerPreview({ project, sizeId, assetUrls, onTestClick, playState = 'playing', restartKey = 0 }: Props) {
  const ref = useRef<HTMLIFrameElement>(null);
  const stateRef = useRef<PlayState>(playState);
  stateRef.current = playState;
  const size = getSize(project, sizeId);
  const html = useMemo(
    () => renderBanner(project, sizeId, {
      resolveAsset: (id) => assetUrls[id] ?? '',
      animationEngine: cssKeyframesEngine,
      injection: previewInjection(project.landingUrl),
    }).html,
    [project, sizeId, assetUrls],
  );

  const send = (action: PlayState) => {
    ref.current?.contentWindow?.postMessage({ type: ANIM_MESSAGE, action }, '*');
  };

  useEffect(() => { send(playState); }, [playState]);

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.source !== ref.current?.contentWindow) return; // only messages from our banner
      if (isTestClickMessage(e.data)) onTestClick?.(e.data);
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [onTestClick]);

  return (
    <iframe
      key={restartKey}
      ref={ref}
      title={`Preview ${size.width}x${size.height}`}
      srcDoc={html}
      sandbox="allow-scripts"
      width={size.width}
      height={size.height}
      className="preview-frame"
      onLoad={() => { if (stateRef.current === 'paused') send('paused'); }}
    />
  );
}
