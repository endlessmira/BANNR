import { useEffect, useMemo, useState } from 'react';
import { DEMO_ASSET_URLS } from '@/app/assetUrls';
import { createImage } from '@/model/factories';
import type { AssetRef, ID, Project } from '@/model/types';
import { assetStore } from '@/persistence';
import { compressImage, resizeLimit } from './compress';
import { mutateSize } from './mutate';
import { findElement } from './ops';
import { useEditorStore } from './store/editorStore';

export const IMAGE_TYPES: readonly string[] = ['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/svg+xml'];
export const ACCEPT_IMAGES = '.png,.jpg,.jpeg,.gif,.webp,.svg';
/** Warning threshold only. Real per-platform limits are checked at export (Phase 5). */
export const LARGE_ASSET_KB = 150;

export type UploadTarget = { kind: 'element' } | { kind: 'background' } | { kind: 'replace'; elementId: ID };
/** notes = information (e.g. compression results); warnings = something the user should act on. */
export interface UploadResult { added: number; notes: string[]; warnings: string[] }

const fmtSize = (bytes: number): string =>
  bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;

// Data URLs (not blob URLs), so images also load inside the sandboxed preview iframe.
const urlCache = new Map<ID, string>();
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

async function ensureUrl(id: ID): Promise<void> {
  if (urlCache.has(id) || DEMO_ASSET_URLS[id]) return;
  const blob = await assetStore.getBlob(id);
  if (!blob) return;
  urlCache.set(id, await blobToDataUrl(blob));
  notify();
}

/** URLs for every asset in the project, for the editor canvas and preview. */
export function useAssetUrls(project: Project | null): Record<ID, string> {
  const [version, setVersion] = useState(0);
  useEffect(() => {
    const l = () => setVersion((v) => v + 1);
    listeners.add(l);
    return () => { listeners.delete(l); };
  }, []);
  const key = project ? Object.keys(project.assets).sort().join(',') : '';
  useEffect(() => {
    for (const id of key ? key.split(',') : []) void ensureUrl(id).catch(() => undefined);
  }, [key]);
  return useMemo(() => {
    const out: Record<ID, string> = { ...DEMO_ASSET_URLS };
    for (const id of key ? key.split(',') : []) {
      const u = urlCache.get(id);
      if (u) out[id] = u;
    }
    return out;
  }, [key, version]);
}

async function imageSize(blob: Blob): Promise<{ width: number; height: number }> {
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return { width: img.naturalWidth || 150, height: img.naturalHeight || 150 };
  } catch {
    return { width: 150, height: 150 };
  } finally {
    URL.revokeObjectURL(url);
  }
}

function insert(ref: AssetRef, target: UploadTarget, fileName: string): void {
  const st = useEditorStore.getState();
  const size = st.project?.sizes.find((s) => s.id === st.activeSizeId);
  if (!size) return;
  const sizeId = size.id;

  if (target.kind === 'replace') {
    st.update((d) => {
      d.assets[ref.id] = ref;
      mutateSize(d, sizeId, (s) => {
        const el = findElement(s.elements, target.elementId);
        if (el?.type === 'image') el.assetId = ref.id;
      });
    });
    return;
  }
  if (target.kind === 'background') {
    st.update((d) => {
      d.assets[ref.id] = ref;
      mutateSize(d, sizeId, (s) => { s.background.image = { assetId: ref.id, fit: 'cover' }; });
    });
    return;
  }

  const w0 = ref.width ?? 150;
  const h0 = ref.height ?? 150;
  const scale = Math.min(1, (size.width * 0.8) / w0, (size.height * 0.8) / h0);
  const w = Math.max(1, Math.round(w0 * scale));
  const h = Math.max(1, Math.round(h0 * scale));
  const z = size.elements.reduce((m, e) => Math.max(m, e.zIndex), 0) + 1;
  const el = createImage({
    assetId: ref.id,
    name: fileName.replace(/\.[^.]+$/, '') || 'Image',
    x: Math.round((size.width - w) / 2),
    y: Math.round((size.height - h) / 2),
    width: w,
    height: h,
    zIndex: z,
    fit: 'contain',
  });
  st.update((d) => {
    d.assets[ref.id] = ref;
    mutateSize(d, sizeId, (s) => { s.elements.push(el); });
  });
  useEditorStore.getState().select([el.id]);
}

/** Compresses, stores (deduplicated by content) and adds images to the active size. */
export async function uploadImages(files: Iterable<File>, target: UploadTarget = { kind: 'element' }): Promise<UploadResult> {
  const notes: string[] = [];
  const warnings: string[] = [];
  const limit = resizeLimit(useEditorStore.getState().project?.sizes ?? []);
  let added = 0;
  for (const file of files) {
    const type = file.type || (file.name.toLowerCase().endsWith('.svg') ? 'image/svg+xml' : '');
    if (!IMAGE_TYPES.includes(type)) {
      warnings.push(`${file.name}: unsupported file type. Use PNG, JPG, GIF, WebP or SVG.`);
      continue;
    }
    const dims = await imageSize(file);
    const c = await compressImage(file, type, dims, limit);
    const stored = await assetStore.put(c.blob, file.name);
    const ref: AssetRef = {
      ...stored,
      width: c.width,
      height: c.height,
      ...(c.changed ? { originalBytes: file.size } : {}),
    };
    urlCache.set(ref.id, await blobToDataUrl(c.blob));
    notify();
    if (c.changed) {
      const resized = c.width !== dims.width || c.height !== dims.height;
      notes.push(
        `${file.name}: compressed ${fmtSize(file.size)} → ${fmtSize(ref.bytes)}` +
          `${resized ? ` (${dims.width}×${dims.height} → ${c.width}×${c.height})` : ''}.`,
      );
    }
    if (ref.bytes > LARGE_ASSET_KB * 1024) {
      warnings.push(
        `${file.name} is ${fmtSize(ref.bytes)}${c.changed ? ' even after compression' : ''}. Many ad platforms limit a whole ` +
          `banner to around ${LARGE_ASSET_KB} KB, so consider a smaller or simpler image.`,
      );
    }
    insert(ref, target, file.name);
    added++;
    if (target.kind !== 'element') break; // replace/background take a single file
  }
  return { added, notes, warnings };
}
