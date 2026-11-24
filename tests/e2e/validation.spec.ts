import { expect, test } from '@playwright/test';
import { addAt, newProject } from './helpers';

test('errors block export; platform and limits can be changed in the Export dialog', async ({ page }) => {
  await newProject(page);
  await addAt(page, 'Add text', 20, 20);
  await expect(page.locator('.kb-counter')).toHaveText(/^\d+(\.\d)? KB \/ 300 KB$/);

  await page.locator('.stage').click({ position: { x: 8, y: 300 } }); // empty area: deselect
  await expect(page.locator('.props-title')).toHaveText('Banner 480×480');
  await page.getByRole('spinbutton', { name: 'Plays', exact: true }).fill('4');

  await page.getByRole('button', { name: 'Export', exact: true }).click();
  await expect(page.locator('.check-item[data-level="error"]', { hasText: 'plays' })).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Download zips' })).toBeDisabled();

  await page.getByLabel('Platform', { exact: true }).selectOption('cm360');
  await expect(page.locator('.platform-badge')).toHaveText('Campaign Manager 360');

  await page.getByRole('spinbutton', { name: 'Max plays', exact: true }).fill('5');
  await page.getByRole('spinbutton', { name: 'Max seconds', exact: true }).fill('60');
  await expect(page.locator('.check-status')).toHaveText('Ready to export');
  await expect(page.getByRole('button', { name: 'Download zips' })).toBeEnabled();
});
