import { expect, test } from '@playwright/test';
import { addAt, newProject } from './helpers';

test('timeline bars change delays and the ruler scrubs the preview', async ({ page }) => {
  await newProject(page);
  await addAt(page, 'Add text', 20, 20);
  await page.getByLabel('Entrance', { exact: true }).selectOption('fade');

  const bar = page.locator('.tl-bar[data-phase="in"]');
  await expect(bar).toHaveCount(1);
  const b = (await bar.boundingBox())!;
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width / 2 + 80, b.y + b.height / 2, { steps: 5 });
  await page.mouse.up();
  await expect
    .poll(async () => Number(await page.getByLabel('Entrance delay', { exact: true }).inputValue()))
    .toBeGreaterThan(0);

  await page.getByRole('button', { name: 'Preview / Interact', exact: true }).click();
  const frame = await (await page.locator('.preview-frame').elementHandle())!.contentFrame();
  const r = (await page.locator('.tl-ruler').boundingBox())!;
  await page.mouse.click(r.x + r.width / 2, r.y + r.height / 2); // middle of the 15 s loop
  await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeVisible();
  await expect.poll(() => frame!.evaluate(() => document.getAnimations()[0]?.playState)).toBe('paused');
  await expect.poll(() => frame!.evaluate(() => Number(document.getAnimations()[0]?.currentTime))).toBeGreaterThan(5000);
  await expect(page.locator('.tl-playhead')).toBeVisible();
});
