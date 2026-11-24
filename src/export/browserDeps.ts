import { DEMO_ASSET_URLS } from '@/app/assetUrls';
import { assetStore } from '@/persistence';
import type { ExportDeps } from './pipeline';

export const browserDeps: ExportDeps = {
  async loadAsset(id) {
    const blob = await assetStore.getBlob(id);
    if (blob) return blob;
    const url = DEMO_ASSET_URLS[id];
    if (!url) return undefined;
    const res = await fetch(url);
    return res.ok ? res.blob() : undefined;
  },
  async webpToPng(blob) {
    const bmp = await createImageBitmap(blob);
    try {
      const c = document.createElement('canvas');
      c.width = bmp.width;
      c.height = bmp.height;
      const ctx = c.getContext('2d');
      if (!ctx) throw new Error('Canvas is not available in this browser.');
      ctx.drawImage(bmp, 0, 0);
      const out = await new Promise<Blob | null>((resolve) => c.toBlob(resolve, 'image/png'));
      if (!out) throw new Error('Could not convert a WebP image to PNG.');
      return out;
    } finally {
      bmp.close();
    }
  },
};

export function downloadBlob(data: Blob | ArrayBuffer, name: string, type = 'application/zip'): void {
  const blob = data instanceof Blob ? data : new Blob([data], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
