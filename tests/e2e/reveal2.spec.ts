import { type Page, expect, test } from '@playwright/test';
import { newProject } from './helpers';

async function addCard(page: Page, name: string) {
  await page.getByTitle('Add a component', { exact: true }).click();
  await page.locator('.comp-panel').getByRole('button', { name, exact: true }).click();
}

test('peel: dragging peels the sticker off without opening the landing page; then a tap does', async ({ page }) => {
  await newProject(page);
  await addCard(page, 'Peel');
  await expect(page.locator('.hitbox[data-name="Peel"]')).toHaveCSS('width', '480px');
  await expect(page.locator('.canvas-render [data-fl]')).toHaveAttribute('style', /width:\s*10%/);
  await page.getByLabel('Auto peek', { exact: true }).uncheck();
  await page.getByRole('button', { name: 'Preview / Interact', exact: true }).click();
  const frame = page.frameLocator('.preview-frame');
  await expect(frame.locator('.el-component')).toHaveCSS('touch-action', 'none');

  const b = (await page.locator('.preview-frame').boundingBox())!;
  await page.mouse.move(b.x + b.width * 0.9, b.y + b.height * 0.9);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width * 0.1, b.y + b.height * 0.1, { steps: 10 });
  await page.mouse.up();
  await expect(page.locator('.events-log')).toContainText('peel_complete');
  await expect(page.locator('.toast')).toHaveCount(0);
  await expect(frame.locator('.el-component')).toHaveCSS('touch-action', 'pan-y');

  await page.locator('.preview-frame').click();
  await expect(page.locator('.toast')).toContainText('Test click');
});

test('hover reveal: hovering reveals every tile, then the end screen CTA opens the landing page', async ({ page }) => {
  await newProject(page);
  await addCard(page, 'Hover Reveal');
  await page.getByRole('button', { name: 'Preview / Interact', exact: true }).click();
  const frame = page.frameLocator('.preview-frame');
  await expect(frame.locator('.el-component')).toHaveCSS('touch-action', 'pan-y');

  const tiles = frame.locator('.bhr-t');
  for (let i = 0; i < 4; i++) await tiles.nth(i).hover();
  await expect(frame.locator('.bhr-end')).toBeVisible();
  await expect(page.locator('.events-log')).toContainText('end_screen');
  await expect(page.locator('.toast')).toHaveCount(0);
  await frame.locator('.bhr-cta').click();
  await expect(page.locator('.toast')).toContainText('Test click');
});

test('zoom: hovering shows the lens; a click opens the landing page', async ({ page }) => {
  await newProject(page);
  await addCard(page, 'Zoom');
  await page.getByRole('button', { name: 'Preview / Interact', exact: true }).click();
  const frame = page.frameLocator('.preview-frame');
  await expect(frame.locator('.el-component')).toHaveCSS('touch-action', 'pan-y');
  await expect(frame.locator('.bzm')).not.toHaveClass(/bzm-on/);

  const b = (await page.locator('.preview-frame').boundingBox())!;
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await page.mouse.move(b.x + b.width / 2 + 30, b.y + b.height / 2 + 20, { steps: 5 });
  await expect(frame.locator('.bzm')).toHaveClass(/bzm-on/);
  await expect(page.locator('.events-log')).toContainText('zoom');

  await page.locator('.preview-frame').click();
  await expect(page.locator('.toast')).toContainText('Test click');
});
