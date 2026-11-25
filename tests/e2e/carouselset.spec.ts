import { expect, test } from '@playwright/test';
import { newProject } from './helpers';

test('carousel set: edit slides and layers, then change slides in Interact mode', async ({ page }) => {
  await newProject(page);
  await page.getByTitle('Add a component', { exact: true }).click();
  await page.locator('.comp-panel').getByRole('button', { name: 'Carousel Set', exact: true }).click();
  await expect(page.locator('.canvas-render [data-s]')).toHaveCount(3);
  await page.getByLabel('Auto-advance', { exact: true }).uncheck();

  await page.getByRole('tab', { name: 'Slide 2', exact: true }).click();
  await expect(page.locator('.canvas-render [data-s="1"]')).toHaveClass(/bcs-on/);
  await page.getByLabel('Slide 2 · Layer 2 · Text', { exact: true }).fill('Hello set');
  await expect(page.locator('.canvas-render [data-s="1"] .bcs-t')).toContainText('Hello set');
  await page.getByRole('button', { name: '+ Add layer', exact: true }).click();
  await expect(page.locator('.canvas-render [data-s="1"] [data-fx]')).toHaveCount(3);

  await page.getByRole('button', { name: 'Preview / Interact', exact: true }).click();
  const frame = page.frameLocator('.preview-frame');
  await expect(frame.locator('[data-s="0"]')).toHaveClass(/bcs-on/);
  await frame.locator('.bcs-next').click();
  await expect(frame.locator('[data-s="1"]')).toHaveClass(/bcs-on/);
  await expect(page.locator('.events-log')).toContainText('slide_change');
  await expect(page.locator('.toast')).toHaveCount(0);
});
