import { type Page, expect, test } from '@playwright/test';
import { newProject } from './helpers';

async function addCard(page: Page, name: string) {
  await page.getByTitle('Add a component', { exact: true }).click();
  await page.locator('.comp-panel').getByRole('button', { name, exact: true }).click();
}

test('scratch: scratching reveals without opening the landing page; then a tap does', async ({ page }) => {
  await newProject(page);
  await addCard(page, 'Scratch');
  await expect(page.locator('.hitbox[data-name="Scratch"]')).toHaveCSS('width', '480px');
  await page.getByRole('spinbutton', { name: 'Reveal at', exact: true }).fill('5');
  await page.getByRole('spinbutton', { name: 'Brush size', exact: true }).fill('100');
  await page.getByRole('button', { name: 'Preview / Interact', exact: true }).click();
  const frame = page.frameLocator('.preview-frame');
  await expect(frame.locator('.el-component')).toHaveCSS('touch-action', 'none');

  const b = (await page.locator('.preview-frame').boundingBox())!;
  const path: Array<[number, number]> = [[0.95, 0.25], [0.05, 0.5], [0.95, 0.75]];
  await page.mouse.move(b.x + b.width * 0.05, b.y + b.height * 0.25);
  await page.mouse.down();
  for (const [fx, fy] of path) await page.mouse.move(b.x + b.width * fx, b.y + b.height * fy, { steps: 12 });
  await page.mouse.up();
  await expect(page.locator('.events-log')).toContainText('reveal_complete');
  await expect(page.locator('.toast')).toHaveCount(0);
  await expect(frame.locator('.el-component')).toHaveCSS('touch-action', 'pan-y');

  await page.locator('.preview-frame').click();
  await expect(page.locator('.toast')).toContainText('Test click');
});

test('before/after wipe: a drag moves the divider without opening the landing page; a tap does', async ({ page }) => {
  await newProject(page);
  await addCard(page, 'Before/After Wipe');
  await page.getByRole('button', { name: 'Preview / Interact', exact: true }).click();
  const frame = page.frameLocator('.preview-frame');
  await expect(frame.locator('.el-component')).toHaveCSS('touch-action', 'pan-y');

  const b = (await page.locator('.preview-frame').boundingBox())!;
  const cx = b.x + b.width / 2;
  const cy = b.y + b.height / 2;
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx - 120, cy, { steps: 8 });
  await page.mouse.up();
  await expect(page.locator('.events-log')).toContainText('wipe');
  await expect.poll(() => frame.locator('.bwp').evaluate((e) => (e as HTMLElement).style.getPropertyValue('--p'))).not.toBe('50%');
  await expect(page.locator('.toast')).toHaveCount(0);

  await page.locator('.preview-frame').click();
  await expect(page.locator('.toast')).toContainText('Test click');
});
