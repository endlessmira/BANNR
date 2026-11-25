import { useEffect, useMemo, useRef } from 'react';
import { playhead } from '@/editor/timeline/playhead';
import type { ID, Project } from '@/model/types';
import { getSize, renderBanner } from '@/renderer';
import { cssKeyframesEngine } from '@/renderer/animation/cssKeyframes';
import {
  ANIM_MESSAGE, type TestClickMessage, isTestClickMessage, isTimeMessage, isTrackMessage, previewInjection,
} from '@/renderer/preview';

export type PlayState = 'playing' | 'paused';
/** A seek request; n changes on every request so seeking to the same time twice still works. */
export interface SeekRequest { ms: number; n: number }

interface Props {
  project: Project;
  sizeId: ID;
  assetUrls: Record<ID, string>;
  onTestClick?: (msg: TestClickMessage) => void;
  /** Called with the name of every bannr.track() event. */
  onTrack?: (name: string) => void;
  playState?: PlayState;
  /** Changing this reloads the banner, restarting the animation. */
  restartKey?: number;
  seek?: SeekRequest | null;
}

export function BannerPreview({
  project, sizeId, assetUrls, onTestClick, onTrack, playState = 'playing', restartKey = 0, seek = null,
}: Props) {
  const ref = useRef<HTMLIFrameElement>(null);
  const stateRef = useRef<PlayState>(playState);
  const seekRef = useRef<SeekRequest | null>(seek);
  stateRef.current = playState;
  seekRef.current = seek;
  const size = getSize(project, sizeId);
  const html = useMemo(
    () => renderBanner(project, sizeId, {
      resolveAsset: (id) => assetUrls[id] ?? '',
      animationEngine: cssKeyframesEngine,
      injection: previewInjection(project, getSize(project, sizeId)),
    }).html,
    [project, sizeId, assetUrls],
  );

  const post = (data: Record<string, unknown>) => {
    ref.current?.contentWindow?.postMessage({ type: ANIM_MESSAGE, ...data }, '*');
  };

  useEffect(() => { post({ action: playState }); }, [playState]);
  useEffect(() => { if (seek) post({ action: 'seek', ms: seek.ms }); }, [seek]);

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.source !== ref.current?.contentWindow) return; // only messages from our banner
      if (isTestClickMessage(e.data)) onTestClick?.(e.data);
      else if (isTimeMessage(e.data)) playhead.set(e.data.ms);
      else if (isTrackMessage(e.data)) onTrack?.(e.data.name);
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [onTestClick, onTrack]);

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
      onLoad={() => {
        if (stateRef.current === 'paused') post({ action: 'paused' });
        if (seekRef.current) post({ action: 'seek', ms: seekRef.current.ms });
      }}
    />
  );
}
