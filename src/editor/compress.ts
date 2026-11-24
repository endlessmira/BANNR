/**
 * Image compression on upload. The decision (planCompression) is pure and unit-tested;
 * the encoding uses the browser's canvas, so no extra library is needed.
 */
export const COMPRESSIBLE: readonly string[] = ['image/jpeg', 'image/png', 'image/webp'];
/** Smallest resize limit: 2× the 480×480 master. */
export const MIN_LIMIT = 960;
/** Files at or under this size that need no resizing are left untouched. */
export const COMPRESS_MIN_BYTES = 50 * 1024;
export const QUALITY = 0.82;

export interface Dims { width: number; height: number }

/** Longest allowed image side: 2× the largest banner dimension in the project (for high-res screens). */
export function resizeLimit(sizes: readonly Dims[]): number {
  const largest = sizes.reduce((m, s) => Math.max(m, s.width, s.height), 0);
  return Math.max(MIN_LIMIT, largest * 2);
}

export type Plan =
  | { action: 'keep'; reason: 'type' | 'small' }
  | { action: 'encode'; width: number; height: number; type: string; quality?: number };

export function planCompression(input: { type: string; bytes: number } & Dims, limit: number): Plan {
  if (!COMPRESSIBLE.includes(input.type)) return { action: 'keep', reason: 'type' };
  const scale = Math.min(1, limit / Math.max(input.width, input.height, 1));
  if (scale >= 1 && input.bytes <= COMPRESS_MIN_BYTES) return { action: 'keep', reason: 'small' };
  return {
    action: 'encode',
    width: Math.max(1, Math.round(input.width * scale)),
    height: Math.max(1, Math.round(input.height * scale)),
    type: input.type,
    // PNG is lossless: canvas ignores quality, so only resizing helps.
    ...(input.type === 'image/png' ? {} : { quality: QUALITY }),
  };
}

export interface Compressed extends Dims { blob: Blob; changed: boolean }

async function encode(file: Blob, plan: Extract<Plan, { action: 'encode' }>): Promise<Blob | null> {
  const bmp = await createImageBitmap(file);
  try {
    const canvas = document.createElement('canvas');
    canvas.width = plan.width;
    canvas.height = plan.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    if (plan.type === 'image/jpeg') {
      ctx.fillStyle = '#ffffff'; // JPEG has no transparency
      ctx.fillRect(0, 0, plan.width, plan.height);
    }
    ctx.drawImage(bmp, 0, 0, plan.width, plan.height);
    return await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, plan.type, plan.quality));
  } finally {
    bmp.close();
  }
}

/** Returns the compressed image, or the original if compressing doesn't make it smaller. */
export async function compressImage(file: Blob, type: string, dims: Dims, limit: number): Promise<Compressed> {
  const keep: Compressed = { blob: file, width: dims.width, height: dims.height, changed: false };
  const plan = planCompression({ type, bytes: file.size, ...dims }, limit);
  if (plan.action === 'keep') return keep;
  try {
    const out = await encode(file, plan);
    // out.type differs when the browser can't encode this format (e.g. WebP in some browsers).
    if (!out || out.type !== plan.type || out.size >= file.size) return keep;
    return { blob: out, width: plan.width, height: plan.height, changed: true };
  } catch {
    return keep;
  }
}
