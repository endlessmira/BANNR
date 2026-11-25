import { type Page, expect, test } from '@playwright/test';
import { newProject } from './helpers';

async function addComponentCard(page: Page, name: string) {
  await page.getByTitle('Add a component', { exact: true }).click();
  await page.locator('.comp-panel').getByRole('button', { name, exact: true }).click();
}

/** The runtime sets touch-action when the component is mounted. */
async function waitForMount(page: Page) {
  await expect(page.frameLocator('.preview-frame').locator('.el-component')).toHaveCSS('touch-action', 'pan-y');
}

test('cube: no rotate handle, required faces, and a swipe turns it without opening the landing page', async ({ page }) => {
  await newProject(page);
  await addComponentCard(page, 'Cube');
  await expect(page.locator('.transformer')).toHaveAttribute('data-norotate', 'true');
  await expect(page.locator('.slot-head', { hasText: 'Faces' })).toContainText('required');
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
  await expect(page.locator('.events-log')).toContainText('interaction_start');
  await expect(page.locator('.events-log')).toContainText('face_change');
  await expect(page.locator('.toast')).toHaveCount(0);
});

test('flip card: a tap flips it, a tap on the back opens the landing page', async ({ page }) => {
  await newProject(page);
  await addComponentCard(page, 'Flip Card');
  await page.getByLabel('Auto peek', { exact: true }).uncheck();

  await page.getByRole('button', { name: 'Preview / Interact', exact: true }).click();
  await waitForMount(page);
  const frame = page.locator('.preview-frame');
  await frame.click();
  await expect(page.locator('.events-log')).toContainText('flip');
  await expect(page.locator('.toast')).toHaveCount(0);
  await frame.click();
  await expect(page.locator('.toast')).toContainText('Test click');
});
