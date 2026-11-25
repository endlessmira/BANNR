import { expect, test } from '@playwright/test';
import { addAt, newProject } from './helpers';

test.use({ viewport: { width: 1920, height: 1080 } });

test('the properties panel is wide, resizable, collapsible and searchable', async ({ page }) => {
  await newProject(page);
  await addAt(page, 'Add text', 20, 20);
  const width = async () => Math.round((await page.locator('.panel-right').boundingBox())!.width);
  await expect.poll(width).toBe(600);

  const h = (await page.locator('.rp-handle').boundingBox())!;
  await page.mouse.move(h.x + h.width / 2, h.y + 300);
  await page.mouse.down();
  await page.mouse.move(h.x + h.width / 2 - 100, h.y + 300, { steps: 5 });
  await page.mouse.up();
  await expect.poll(width).toBe(700);
  await page.locator('.rp-handle').dblclick();
  await expect.poll(width).toBe(600);

  const x = page.getByRole('spinbutton', { name: 'X', exact: true });
  await page.getByRole('button', { name: 'Layout', exact: true }).click();
  await expect(x).toHaveCount(0);
  await page.getByRole('button', { name: 'Layout', exact: true }).click();
  await expect(x).toBeVisible();

  await page.getByLabel('Find a setting').fill('letter');
  await expect(page.getByRole('spinbutton', { name: 'Letter spacing', exact: true })).toBeVisible();
  await expect(x).toBeHidden();
  await page.getByLabel('Find a setting').fill('');
  await expect(x).toBeVisible();
});
