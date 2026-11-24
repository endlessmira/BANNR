import { expect, test } from '@playwright/test';
import { newProject } from './helpers';

test('a large photo is resized and compressed on upload', async ({ page }) => {
  await newProject(page);
  // A 2400×1600 noisy JPEG (hard to compress), generated in the browser.
  const b64 = await page.evaluate(() => {
    const c = document.createElement('canvas');
    c.width = 2400;
    c.height = 1600;
    const ctx = c.getContext('2d')!;
    const img = ctx.createImageData(c.width, c.height);
    for (let i = 0; i < img.data.length; i += 4) {
      img.data[i] = Math.random() * 255;
      img.data[i + 1] = Math.random() * 255;
      img.data[i + 2] = Math.random() * 255;
      img.data[i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    return c.toDataURL('image/jpeg', 0.95).split(',')[1]!;
  });
  await page.locator('.toolbar input[type="file"]').setInputFiles({
    name: 'big.jpg', mimeType: 'image/jpeg', buffer: Buffer.from(b64, 'base64'),
  });
  await expect(page.locator('.hitbox[data-name="big"]')).toHaveCount(1);
  await expect(page.locator('.toast-warn')).toContainText('big.jpg: compressed');
  await expect(page.locator('.toast-warn')).toContainText('2400×1600 → 960×640');
});
