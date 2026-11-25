import { expect, test } from '@playwright/test';
import { newProject } from './helpers';

test.use({ viewport: { width: 1920, height: 1080 } });

test('properties panel: no stray file pickers, no sideways overflow, usable opacity box', async ({ page }) => {
  await newProject(page);
  await expect(page.locator('.props-title')).toHaveText('Banner 480×480');
  await expect(page.locator('.panel-right input[type="file"]')).toBeHidden();
  const opacity = page.getByRole('spinbutton', { name: 'Background color opacity', exact: true });
  await expect(opacity).toBeVisible();
  expect((await opacity.boundingBox())!.width).toBeGreaterThan(30);
  const over = await page.locator('.panel-right').evaluate((e) => e.scrollWidth - e.clientWidth);
  expect(over).toBeLessThanOrEqual(1);
  await page.getByLabel('Find a setting').fill('border');
  await page.getByLabel('Find a setting').fill('');
  await expect(page.locator('.panel-right input[type="file"]')).toBeHidden();
});
