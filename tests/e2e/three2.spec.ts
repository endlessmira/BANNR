import { type Page, expect, test } from '@playwright/test';
import { newProject } from './helpers';

async function addCard(page: Page, name: string) {
  await page.getByTitle('Add a component', { exact: true }).click();
  await page.locator('.comp-panel').getByRole('button', { name, exact: true }).click();
}

/** The runtime sets touch-action when the component is mounted. */
async function waitForMount(page: Page) {
  await expect(page.frameLocator('.preview-frame').locator('.el-component')).toHaveCSS('touch-action', 'pan-y');
}

test('tilt card follows the mouse without opening the landing page', async ({ page }) => {
  await newProject(page);
  await addCard(page, 'Tilt Card');
  await expect(page.locator('.transformer')).toHaveAttribute('data-norotate', 'true');
  await page.getByRole('button', { name: 'Preview / Interact', exact: true }).click();
  await waitForMount(page);
  const box = (await page.locator('.preview-frame').boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.move(box.x + box.width * 0.85, box.y + box.height / 2, { steps: 6 });
  await expect(page.locator('.events-log')).toContainText('interaction_start');
  await expect(page.locator('.toast')).toHaveCount(0);
});

test('orbit carousel: a drag spins it, a tap opens the landing page', async ({ page }) => {
  await newProject(page);
  await addCard(page, 'Orbit Carousel');
  await page.getByLabel('Auto-rotate', { exact: true }).uncheck();
  await page.getByRole('button', { name: 'Preview / Interact', exact: true }).click();
  await waitForMount(page);
  const box = (await page.locator('.preview-frame').boundingBox())!;
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  await page.mouse.move(cx + 80, cy);
  await page.mouse.down();
  await page.mouse.move(cx - 80, cy, { steps: 8 });
  await page.mouse.up();
  await expect(page.locator('.events-log')).toContainText('spin');
  await expect(page.locator('.toast')).toHaveCount(0);
  await page.locator('.preview-frame').click();
  await expect(page.locator('.toast')).toContainText('Test click');
});
