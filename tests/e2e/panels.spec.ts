import { expect, test } from '@playwright/test';
import { addAt, field, newProject } from './helpers';

const PNG_1PX = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

test.beforeEach(async ({ page }) => { await newProject(page); });

test('layers panel hides and shows an element', async ({ page }) => {
  await addAt(page, 'Add text', 20, 20);
  await page.getByRole('button', { name: 'Hide Text' }).click();
  await expect(page.locator('.hitbox[data-name="Text"]')).toHaveCount(0);
  await page.getByRole('button', { name: 'Show Text' }).click();
  await expect(page.locator('.hitbox[data-name="Text"]')).toHaveCount(1);
});

test('properties panel edits position', async ({ page }) => {
  await page.getByTitle('Add CTA button', { exact: true }).click();
  await field(page, 'X').fill('100');
  await expect(page.locator('.hitbox[data-name="CTA"]')).toHaveCSS('left', '100px');
});

test('banner border can be switched on', async ({ page }) => {
  await expect(page.locator('.props-title')).toHaveText('Banner 480×480');
  await expect(page.locator('.bannr-border')).toHaveCount(0);
  await page.getByLabel('Add border').check();
  await expect(page.locator('.bannr-border')).toHaveCount(1);
});

test('uploading an image adds it to the banner', async ({ page }) => {
  await page.locator('.toolbar input[type="file"]').setInputFiles({
    name: 'dot.png', mimeType: 'image/png', buffer: Buffer.from(PNG_1PX, 'base64'),
  });
  await expect(page.locator('.hitbox[data-name="dot"]')).toHaveCount(1);
  await expect(page.locator('.props-title')).toHaveText('dot');
});
