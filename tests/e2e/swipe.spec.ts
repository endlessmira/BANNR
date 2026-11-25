import { type Page, expect, test } from '@playwright/test';
import { newProject } from './helpers';

async function addCard(page: Page, name: string) {
  await page.getByTitle('Add a component', { exact: true }).click();
  await page.locator('.comp-panel').getByRole('button', { name, exact: true }).click();
}

async function swipeLeft(page: Page) {
  const box = (await page.locator('.preview-frame').boundingBox())!;
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  await page.mouse.move(cx + 120, cy);
  await page.mouse.down();
  await page.mouse.move(cx - 120, cy, { steps: 8 });
  await page.mouse.up();
}

test('card swipe: swipe, vote with buttons, then the end screen CTA opens the landing page', async ({ page }) => {
  await newProject(page);
  await addCard(page, 'Card Swipe');
  await expect(page.locator('.hitbox[data-name="Card Swipe"]')).toHaveCSS('width', '480px');
  await page.getByRole('button', { name: 'Preview / Interact', exact: true }).click();
  const frame = page.frameLocator('.preview-frame');
  await expect(frame.locator('.el-component')).toHaveCSS('touch-action', 'pan-y');

  await swipeLeft(page);
  await expect(page.locator('.events-log')).toContainText('dislike');
  await expect(page.locator('.toast')).toHaveCount(0);

  const like = frame.locator('.bsw-btn[data-vote="like"]');
  for (let i = 0; i < 3; i++) await like.click();
  await expect(frame.locator('.bsw-end')).toBeVisible();
  await expect(page.locator('.events-log')).toContainText('swipe_complete');
  await expect(page.locator('.toast')).toHaveCount(0);
  await frame.locator('.bsw-cta').click();
  await expect(page.locator('.toast')).toContainText('Test click');
});

test('panorama: a drag and the arrows pan it; a tap opens the landing page', async ({ page }) => {
  await newProject(page);
  await addCard(page, 'Panorama Scroller');
  await page.getByLabel('Auto-pan when idle', { exact: true }).uncheck();
  await page.getByRole('button', { name: 'Preview / Interact', exact: true }).click();
  const frame = page.frameLocator('.preview-frame');
  await expect(frame.locator('.el-component')).toHaveCSS('touch-action', 'pan-y');

  await swipeLeft(page);
  await expect(page.locator('.events-log')).toContainText('interaction_start');
  await expect(frame.locator('.bpn-track')).not.toHaveCSS('transform', 'matrix(1, 0, 0, 1, 0, 0)');
  await frame.locator('.bpn-next').click();
  await expect(page.locator('.toast')).toHaveCount(0);
  await page.locator('.preview-frame').click();
  await expect(page.locator('.toast')).toContainText('Test click');
});
