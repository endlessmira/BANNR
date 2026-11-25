import { escapeHtml } from '@/renderer/escape';
import type { ResolvedSlot, SettingsSchema } from './types';

/** Shared parts of the 3D components (Cube, Flip Card; Tilt Card and Orbit Carousel follow in 7c-2). */
const PH = ['#f2a902', '#ff3ea5', '#7c3aed', '#22d3ee'];

/** A face: the slot image (never natively draggable, so mouse drags reach the gesture code) or a labelled placeholder. */
export function faceContent(s: ResolvedSlot | undefined, fit: string, i: number, label: string): string {
  if (s && s.kind === 'image') {
    return `<img src="${escapeHtml(s.src)}" alt="" draggable="false" style="object-fit:${fit === 'contain' ? 'contain' : 'cover'}">`;
  }
  return `<div class="bc3-ph" style="background:${PH[i % PH.length] ?? '#999'}">${escapeHtml(label)}</div>`;
}

export const HINT_FIELD: SettingsSchema = {
  hint: {
    type: 'toggle', label: 'Interaction hint', default: true,
    help: 'A short wiggle after 1.5 s shows that it can be swiped. Stops at the first touch.',
  },
};

export const TAP_FIELD: SettingsSchema = {
  tapToExit: { type: 'toggle', label: 'Tap opens landing page', default: true, help: 'A drag or swipe never opens it.' },
};

export const THREE_CSS =
  '.bc3-ph{display:grid;place-items:center;width:100%;height:100%;font:700 28px Arial,sans-serif;color:rgba(255,255,255,.9)}' +
  '.bc3 img,.bcf img{display:block;width:100%;height:100%;-webkit-user-drag:none;user-select:none}';
