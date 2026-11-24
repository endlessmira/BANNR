import { describe, expect, it } from 'vitest';
import { COMPRESS_MIN_BYTES, QUALITY, planCompression, resizeLimit } from './compress';

const MB = 1024 * 1024;

describe('image compression plan', () => {
  it('limits images to 2× the largest banner dimension, at least 960px', () => {
    expect(resizeLimit([])).toBe(960);
    expect(resizeLimit([{ width: 480, height: 480 }])).toBe(960);
    expect(resizeLimit([{ width: 480, height: 480 }, { width: 970, height: 250 }])).toBe(1940);
  });

  it('never touches SVG or GIF', () => {
    expect(planCompression({ type: 'image/svg+xml', bytes: 5 * MB, width: 5000, height: 5000 }, 960)).toEqual({ action: 'keep', reason: 'type' });
    expect(planCompression({ type: 'image/gif', bytes: 5 * MB, width: 5000, height: 5000 }, 960)).toEqual({ action: 'keep', reason: 'type' });
  });

  it('skips small files that are already within the limit', () => {
    expect(planCompression({ type: 'image/jpeg', bytes: COMPRESS_MIN_BYTES, width: 800, height: 600 }, 960))
      .toEqual({ action: 'keep', reason: 'small' });
  });

  it('resizes large photos, keeping the aspect ratio', () => {
    expect(planCompression({ type: 'image/jpeg', bytes: 2 * MB, width: 2400, height: 1600 }, 960))
      .toEqual({ action: 'encode', width: 960, height: 640, type: 'image/jpeg', quality: QUALITY });
    expect(planCompression({ type: 'image/webp', bytes: 10, width: 1000, height: 4000 }, 960))
      .toEqual({ action: 'encode', width: 240, height: 960, type: 'image/webp', quality: QUALITY });
  });

  it('keeps PNG as PNG without a quality setting', () => {
    expect(planCompression({ type: 'image/png', bytes: MB, width: 500, height: 500 }, 960))
      .toEqual({ action: 'encode', width: 500, height: 500, type: 'image/png' });
  });
});
