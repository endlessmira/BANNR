import { expect, test } from '@playwright/test';
import { newProject } from './helpers';

test('countdown shows real numbers in Interact mode', async ({ page }) => {
  await newProject(page);
  await page.getByTitle('Add a component', { exact: true }).click();
  await page.locator('.comp-panel').getByRole('button', { name: 'Countdown', exact: true }).click();
  await expect(page.locator('.canvas-render .bc-cd-l').first()).toHaveText('Days');
  await expect(page.locator('.canvas-render [data-u="d"]')).toHaveText('--');
  await page.getByLabel('Ends at', { exact: true }).fill('2035-01-01T00:00');
  await page.getByRole('button', { name: 'Preview / Interact', exact: true }).click();
  await expect(page.frameLocator('.preview-frame').locator('[data-u="d"]')).toHaveText(/^\d{2,}$/);
});

test('animated gradient is added full-banner at the bottom', async ({ page }) => {
  await newProject(page);
  await page.getByTitle('Add text', { exact: true }).click();
  await page.getByTitle('Add a component', { exact: true }).click();
  await page.locator('.comp-panel').getByRole('button', { name: 'Animated Gradient', exact: true }).click();
  const hit = page.locator('.hitbox[data-name="Animated Gradient"]');
  await expect(hit).toHaveCSS('width', '480px');
  await expect(page.locator('.layer .layer-name').last()).toHaveText('Animated Gradient');
});
