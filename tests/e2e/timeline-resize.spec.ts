import { expect, test } from '@playwright/test';
import { addAt, newProject } from './helpers';

test('the timeline resizes by its top edge, snapping to rows, up to 8 rows', async ({ page }) => {
  await newProject(page);
  await addAt(page, 'Add text', 20, 20);
  const height = async () => Math.round((await page.locator('.tl-body').boundingBox())!.height);
  await expect.poll(height).toBe(150);

  const drag = async (dy: number) => {
    const h = (await page.locator('.tl-resize').boundingBox())!;
    await page.mouse.move(h.x + 200, h.y + h.height / 2);
    await page.mouse.down();
    await page.mouse.move(h.x + 200, h.y + h.height / 2 + dy, { steps: 6 });
    await page.mouse.up();
  };
  await drag(-50);
  await expect.poll(height).toBe(198);
  await drag(-500);
  await expect.poll(height).toBe(222);
  await drag(500);
  await expect.poll(height).toBe(150);
  await drag(-50);
  await page.locator('.tl-resize').dblclick();
  await expect.poll(height).toBe(150);
});
