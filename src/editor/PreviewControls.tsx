import type { PlayState } from '@/app/components/BannerPreview';
import type { Size } from '@/model/types';

const fmtS = (n: number): string => `${Math.round(n * 100) / 100} s`;

interface Props { size: Size; playState: PlayState; onToggle: () => void; onRestart: () => void }

export function PreviewControls({ size, playState, onToggle, onRestart }: Props) {
  const { duration, loops } = size.animationSettings;
  return (
    <div className="toolbar preview-controls">
      <button className="tb-btn" onClick={onToggle}>{playState === 'playing' ? 'Pause' : 'Play'}</button>
      <button className="tb-btn" onClick={onRestart}>Restart</button>
      <span className="tb-sep" />
      <span className="tb-label">Loop {fmtS(duration)} × {loops} = {fmtS(duration * loops)}</span>
    </div>
  );
}
