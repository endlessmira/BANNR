import { type Page, expect, test } from '@playwright/test';
import { newProject } from './helpers';

async function addCard(page: Page, name: string) {
  await page.getByTitle('Add a component', { exact: true }).click();
  await page.locator('.comp-panel').getByRole('button', { name, exact: true }).click();
}

test('carousel: a swipe and the arrows change slides; a tap on a product opens the landing page', async ({ page }) => {
  await newProject(page);
  await addCard(page, 'Carousel');
  await page.getByLabel('Auto-advance', { exact: true }).uncheck();
  await page.getByRole('button', { name: 'Preview / Interact', exact: true }).click();
  const frame = page.frameLocator('.preview-frame');
  await expect(frame.locator('.el-component')).toHaveCSS('touch-action', 'pan-y');

  const box = (await page.locator('.preview-frame').boundingBox())!;
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  await page.mouse.move(cx + 80, cy);
  await page.mouse.down();
  await page.mouse.move(cx - 80, cy, { steps: 8 });
  await page.mouse.up();
  await expect(page.locator('.events-log')).toContainText('slide_change');
  await expect(page.locator('.toast')).toHaveCount(0);

  await frame.locator('.bcc-next').click();
  await expect(page.locator('.toast')).toHaveCount(0);
  await page.locator('.preview-frame').click();
  await expect(page.locator('.toast')).toContainText('Test click');
});

test('carousel presets are separate cards', async ({ page }) => {
  await newProject(page);
  await addCard(page, 'Carousel · Card Deck');
  await expect(page.locator('.hitbox[data-name="Card Deck"]')).toHaveCount(1);
  await expect(page.locator('.canvas-render .bcc[data-style="deck"]')).toHaveCount(1);
});
