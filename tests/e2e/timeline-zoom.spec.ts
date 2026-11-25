import { expect, test } from '@playwright/test';
import { addAt, newProject } from './helpers';

test('timeline: snap to 0.1 s is on by default; the timeline zooms in and out', async ({ page }) => {
  await newProject(page);
  await addAt(page, 'Add text', 20, 20);
  await page.getByLabel('Entrance', { exact: true }).selectOption('fade');

  const snap = page.getByRole('button', { name: 'Snap', exact: true });
  await expect(snap).toHaveAttribute('aria-pressed', 'true');

  const b = (await page.locator('.tl-bar[data-phase="in"]').boundingBox())!;
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width / 2 + 63, b.y + b.height / 2, { steps: 5 });
  await page.mouse.up();
  const v = Number(await page.getByLabel('Entrance delay', { exact: true }).inputValue());
  expect(v).toBeGreaterThan(0);
  expect(Math.abs(v * 10 - Math.round(v * 10))).toBeLessThan(1e-6);

  // Shift: 0.5 s steps
  const b2 = (await page.locator('.tl-bar[data-phase="in"]').boundingBox())!;
  await page.keyboard.down('Shift');
  await page.mouse.move(b2.x + b2.width / 2, b2.y + b2.height / 2);
  await page.mouse.down();
  await page.mouse.move(b2.x + b2.width / 2 + 63, b2.y + b2.height / 2, { steps: 5 });
  await page.mouse.up();
  await page.keyboard.up('Shift');
  const v2 = Number(await page.getByLabel('Entrance delay', { exact: true }).inputValue());
  expect(v2).toBeGreaterThan(0);
  expect(Math.abs(v2 * 2 - Math.round(v2 * 2))).toBeLessThan(1e-6);

  const zoom = page.getByRole('button', { name: 'Timeline zoom', exact: true });
  await expect(zoom).toHaveText('100%');
  const w0 = (await page.locator('.tl-right').boundingBox())!.width;
  await page.getByRole('button', { name: 'Zoom timeline in', exact: true }).click();
  await expect(zoom).toHaveText('150%');
  await expect.poll(async () => (await page.locator('.tl-right').boundingBox())!.width).toBeGreaterThan(w0 * 1.4);
  await zoom.click();
  await expect(zoom).toHaveText('100%');

  await snap.click();
  await expect(snap).toHaveAttribute('aria-pressed', 'false');
});
