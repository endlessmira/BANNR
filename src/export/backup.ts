import type { ID, Project } from '@/model/types';
import { BANNER_ROOT_ID, getSize, renderFragment } from '@/renderer';
import { browserDeps } from './browserDeps';

export interface BackupImage { blob: Blob; bytes: number; quality: number; overLimit: boolean }

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

async function dataUrlFor(id: ID, url: string | undefined): Promise<string> {
  if (url?.startsWith('data:')) return url;
  const blob = await browserDeps.loadAsset(id);
  return blob ? blobToDataUrl(blob) : '';
}

const xmlText = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

/**
 * Static backup image (JPG) of a size, drawn by the same renderer as the export. It shows the resting
 * state (every layer in place, no animation), like the edit canvas. Components will render their
 * backupState here (Phase 7). Quality is lowered step by step until the image fits maxKB.
 */
export async function renderBackupImage(
  project: Project, sizeId: ID, assetUrls: Record<ID, string>, maxKB: number,
): Promise<BackupImage> {
  const size = getSize(project, sizeId);
  const urls: Record<ID, string> = {};
  for (const id of Object.keys(project.assets)) urls[id] = await dataUrlFor(id, assetUrls[id]);

  const frag = renderFragment(project, sizeId, { resolveAsset: (id) => urls[id] ?? '' });
  const parsed = new DOMParser().parseFromString(`<!DOCTYPE html><html><head></head><body>${frag.bodyHtml}</body></html>`, 'text/html');
  const root = parsed.getElementById(BANNER_ROOT_ID);
  if (!root) throw new Error('Could not render the banner.');
  const xhtml = new XMLSerializer().serializeToString(root);
  const w = Math.round(size.width);
  const h = Math.round(size.height);
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">` +
    `<foreignObject x="0" y="0" width="${w}" height="${h}">` +
    `<div xmlns="http://www.w3.org/1999/xhtml"><style>${xmlText(frag.css)}</style>${xhtml}</div>` +
    '</foreignObject></svg>';

  const img = new Image(w, h);
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  await img.decode();
  await new Promise((r) => setTimeout(r, 50)); // let embedded fonts settle

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas is not available in this browser.');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(img, 0, 0, w, h);

  let best: BackupImage | null = null;
  for (const quality of [0.92, 0.85, 0.75, 0.65, 0.5]) {
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
    if (!blob) throw new Error('This browser could not create the backup image.');
    best = { blob, bytes: blob.size, quality, overLimit: blob.size > maxKB * 1024 };
    if (!best.overLimit) break;
  }
  if (!best) throw new Error('This browser could not create the backup image.');
  return best;
}
