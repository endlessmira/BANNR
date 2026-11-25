import { expect, test } from '@playwright/test';
import { newProject } from './helpers';

test('a component on an unsuitable size gets a warning, a suggestion and a quick fix', async ({ page }) => {
  await newProject(page);
  await page.getByTitle('Add a component', { exact: true }).click();
  await page.locator('.comp-panel').getByRole('button', { name: 'Flip Card', exact: true }).click();
  await expect(page.locator('.size-warn')).toHaveCount(0);

  await page.getByRole('button', { name: '+ Add', exact: true }).click();
  await page.getByLabel(/970×250/).check();
  await page.getByRole('button', { name: 'Add 1 size' }).click();
  await expect(page.locator('.size-warn')).toHaveCount(1);

  const hit = page.locator('.hitbox[data-name="Flip Card"]');
  await expect(hit).toHaveCSS('width', '970px');
  await hit.click();
  await expect(page.locator('.fit-notice')).toContainText('different shape');
  await page.getByRole('button', { name: 'Hide on this size', exact: true }).click();
  await expect(hit).toHaveCount(0);
  await expect(page.locator('.size-warn')).toHaveCount(0);
});
