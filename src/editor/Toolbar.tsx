import { useRef } from 'react';
import { addElement, align, distribute } from './actions';
import { ACCEPT_IMAGES } from './assets';
import type { AlignMode } from './geometry';

export type ZoomMode = 'fit' | number;

const ALIGN_BUTTONS: ReadonlyArray<readonly [AlignMode, string, string]> = [
  ['left', '⇤', 'Align left'], ['hcenter', '↔', 'Align centres'], ['right', '⇥', 'Align right'],
  ['top', '⤒', 'Align top'], ['vcenter', '↕', 'Align middles'], ['bottom', '⤓', 'Align bottom'],
];

interface Props {
  zoomMode: ZoomMode;
  zoom: number;
  onZoomChange: (mode: ZoomMode) => void;
  selectionCount: number;
  onUpload: (files: File[]) => void;
  componentsOpen: boolean;
  onComponents: () => void;
}

export function Toolbar({ zoomMode, zoom, onZoomChange, selectionCount, onUpload, componentsOpen, onComponents }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const target = selectionCount === 1 ? ' to banner' : ' to selection';
  return (
    <div className="toolbar">
      <span className="tb-label">Add</span>
      <button className="tb-btn" title="Add text" onClick={() => addElement('text')}>T</button>
      <button className="tb-btn" title="Add rectangle" onClick={() => addElement('rect')}>▭</button>
      <button className="tb-btn" title="Add ellipse" onClick={() => addElement('ellipse')}>◯</button>
      <button className="tb-btn" title="Add CTA button" onClick={() => addElement('button')}>CTA</button>
      <button className="tb-btn" title="Add image (PNG, JPG, GIF, WebP, SVG). You can also drop files on the canvas." onClick={() => fileRef.current?.click()}>
        Img
      </button>
      <input
        ref={fileRef}
        type="file"
        accept={ACCEPT_IMAGES}
        multiple
        hidden
        onChange={(e) => {
          const files = [...(e.target.files ?? [])];
          e.target.value = '';
          if (files.length > 0) onUpload(files);
        }}
      />
      <button className="tb-btn tb-comp" title="Add a component" aria-pressed={componentsOpen} onClick={onComponents}>✦ Components</button>
      <span className="tb-sep" />
      {ALIGN_BUTTONS.map(([mode, icon, label]) => (
        <button key={mode} className="tb-btn" title={label + target} disabled={selectionCount === 0} onClick={() => align(mode)}>
          {icon}
        </button>
      ))}
      <span className="tb-sep" />
      <button className="tb-btn" title="Distribute horizontally (3+ items)" disabled={selectionCount < 3} onClick={() => distribute('x')}>⋯</button>
      <button className="tb-btn" title="Distribute vertically (3+ items)" disabled={selectionCount < 3} onClick={() => distribute('y')}>⋮</button>
      <span className="tb-sep" />
      <select
        className="tb-select"
        title="Zoom"
        value={zoomMode === 'fit' ? 'fit' : String(zoomMode)}
        onChange={(e) => onZoomChange(e.target.value === 'fit' ? 'fit' : Number(e.target.value))}
      >
        <option value="fit">Fit{zoomMode === 'fit' ? ` (${Math.round(zoom * 100)}%)` : ''}</option>
        {[0.5, 1, 2].map((z) => <option key={z} value={String(z)}>{z * 100}%</option>)}
      </select>
    </div>
  );
}
