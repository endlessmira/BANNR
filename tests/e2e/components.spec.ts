import { expect, test } from '@playwright/test';
import { newProject } from './helpers';

test('adds a Counter from the Components panel, edits it and plays it in Interact mode', async ({ page }) => {
  await newProject(page);
  await page.getByTitle('Add a component', { exact: true }).click();
  const panel = page.locator('.comp-panel');
  await expect(panel).toBeVisible();
  await panel.getByLabel('Search components').fill('counter');
  await expect(panel.locator('.comp-card')).toHaveCount(3);
  await panel.getByRole('button', { name: 'Counter', exact: true }).click();
  await expect(panel).toHaveCount(0);

  await expect(page.locator('.hitbox[data-name="Counter"]')).toHaveCount(1);
  await expect(page.locator('.props-title')).toHaveText('Counter');
  await expect(page.locator('.canvas-render .bc-val')).toHaveText('50');
  await page.getByRole('spinbutton', { name: 'End value', exact: true }).fill('75');
  await expect(page.locator('.canvas-render .bc-val')).toHaveText('75');

  await page.getByRole('button', { name: 'Preview / Interact', exact: true }).click();
  await expect(page.frameLocator('.preview-frame').locator('.bc-val')).toHaveText('75', { timeout: 8000 });
  await expect(page.locator('.events-log')).toContainText('counter_complete');
});

test('a component card can be dragged onto the banner', async ({ page }) => {
  await newProject(page);
  await page.getByTitle('Add a component', { exact: true }).click();
  await page.locator('.comp-panel').getByRole('button', { name: 'Counter · Discount', exact: true })
    .dragTo(page.locator('.canvas'), { targetPosition: { x: 300, y: 300 } });
  await expect(page.locator('.hitbox[data-name="Discount"]')).toHaveCount(1);
});
