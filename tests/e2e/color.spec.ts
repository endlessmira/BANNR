import { expect, test } from '@playwright/test';
import { newProject } from './helpers';

test('colours have an opacity setting (lead form background and a fill)', async ({ page }) => {
  await newProject(page);
  await page.getByTitle('Add a component', { exact: true }).click();
  await page.locator('.comp-panel').getByRole('button', { name: 'Lead Form', exact: true }).click();
  await page.getByRole('spinbutton', { name: 'Background opacity', exact: true }).fill('50');
  await expect(page.locator('.canvas-render .bc-lf')).toHaveCSS('background-color', 'rgba(255, 255, 255, 0.5)');
  await expect(page.getByLabel('Background', { exact: true })).toHaveValue('rgba(255,255,255,0.5)');

  await page.getByTitle('Add rectangle', { exact: true }).click();
  await page.getByRole('spinbutton', { name: 'Fill color opacity', exact: true }).fill('40');
  await expect(page.locator('.canvas-render .el-shape')).toHaveCSS('background-color', 'rgba(242, 169, 2, 0.4)');
});
