import { expect, test } from '@playwright/test';
import { addAt, newProject } from './helpers';

test('clicks pass through layers to bannr.exit(); the landing URL is optional', async ({ page }) => {
  await newProject(page);
  await addAt(page, 'Add text', 20, 20);
  await page.getByRole('button', { name: 'Preview', exact: true }).click();
  const iframe = page.locator('.preview-frame');
  await expect(iframe).toBeVisible();
  const frame = await (await iframe.elementHandle())!.contentFrame();
  // The text layer is at this point, but it lets the pointer through to the click layer.
  await expect.poll(() => frame!.evaluate(() => document.elementFromPoint(60, 40)?.id ?? '')).toBe('clickArea');
  await iframe.click({ position: { x: 60, y: 40 } });
  await expect(page.locator('.toast')).toContainText('no landing URL yet');

  await page.getByRole('button', { name: 'Export', exact: true }).click();
  await page.getByLabel('Landing URL').fill('https://shop.example.com/');
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(async () => {
    await iframe.click({ position: { x: 60, y: 40 } });
    await expect(page.locator('.toast')).toContainText('https://shop.example.com/', { timeout: 1000 });
  }).toPass();
});
