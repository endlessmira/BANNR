import { expect, test } from '@playwright/test';

const PNG_1PX = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '+ New project' }).click();
  await page.getByLabel('Adform').check();
  await page.getByRole('button', { name: 'Create project' }).click();
  await expect(page.locator('.canvas')).toBeVisible();
});

test('layers panel hides and shows an element', async ({ page }) => {
  await page.getByRole('button', { name: 'Hide Headline' }).click();
  await expect(page.locator('.hitbox[data-name="Headline"]')).toHaveCount(0);
  await page.getByRole('button', { name: 'Show Headline' }).click();
  await expect(page.locator('.hitbox[data-name="Headline"]')).toHaveCount(1);
});

test('properties panel edits position', async ({ page }) => {
  await page.locator('.hitbox[data-name="CTA"]').click();
  await page.getByRole('spinbutton', { name: 'X', exact: true }).fill('100');
  await expect(page.locator('.hitbox[data-name="CTA"]')).toHaveCSS('left', '100px');
});

test('banner border can be switched on', async ({ page }) => {
  await expect(page.locator('.props-title')).toHaveText('Banner 300×250');
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
