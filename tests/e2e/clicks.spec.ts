import { expect, test } from '@playwright/test';
import { addAt, newProject } from './helpers';

test('clicks pass through layers to the click layer and go through bannr.exit()', async ({ page }) => {
  await newProject(page);
  await addAt(page, 'Add text', 20, 20);
  await page.getByRole('button', { name: 'Preview', exact: true }).click();
  const iframe = page.locator('.preview-frame');
  await expect(iframe).toBeVisible();
  const frame = await (await iframe.elementHandle())!.contentFrame();
  // The text layer is at this point, but it lets the pointer through to the click layer.
  await expect.poll(() => frame!.evaluate(() => document.elementFromPoint(60, 40)?.id ?? '')).toBe('clickArea');
  await iframe.click({ position: { x: 60, y: 40 } });
  await expect(page.locator('.toast')).toContainText('https://www.example.com');
});
