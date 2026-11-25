import { expect, test } from '@playwright/test';
import { newProject } from './helpers';

test('a carousel fills the master; its arrows and dots can be restyled', async ({ page }) => {
  await newProject(page);
  await page.getByTitle('Add a component', { exact: true }).click();
  await page.locator('.comp-panel').getByRole('button', { name: 'Carousel', exact: true }).click();
  await expect(page.locator('.hitbox[data-name="Carousel"]')).toHaveCSS('width', '480px');
  await expect(page.locator('.hitbox[data-name="Carousel"]')).toHaveCSS('height', '480px');

  await page.getByLabel('Arrow position', { exact: true }).selectOption('bottom');
  await page.getByLabel('Arrow background', { exact: true }).fill('#ff0000');
  const next = page.locator('.canvas-render .bcc-next');
  await expect(next).toHaveCSS('background-color', 'rgb(255, 0, 0)');
  await expect(next).toHaveCSS('bottom', '6px');

  await page.getByLabel('Active dot colour', { exact: true }).fill('#00ff00');
  await expect(page.locator('.canvas-render .bcc-dot.bcc-on')).toHaveCSS('background-color', 'rgb(0, 255, 0)');
});
