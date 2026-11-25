import { expect, test } from '@playwright/test';
import { newProject } from './helpers';

const PNG_1PX = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

test('image: Fill banner covers the banner, Fit inside banner contains it', async ({ page }) => {
  await newProject(page);
  await page.locator('.toolbar input[type="file"]').setInputFiles({
    name: 'dot.png', mimeType: 'image/png', buffer: Buffer.from(PNG_1PX, 'base64'),
  });
  const hit = page.locator('.hitbox[data-name="dot"]');
  await expect(hit).toHaveCount(1);
  const img = page.locator('.canvas-render .el-image img');
  await page.getByRole('button', { name: 'Fill banner', exact: true }).click();
  await expect(hit).toHaveCSS('width', '480px');
  await expect(hit).toHaveCSS('height', '480px');
  await expect(img).toHaveCSS('object-fit', 'cover');
  await page.getByRole('button', { name: 'Fit inside banner', exact: true }).click();
  await expect(img).toHaveCSS('object-fit', 'contain');
});
