import { expect, test } from '@playwright/test';
import { addAt, newProject } from './helpers';

const active = (page: import('@playwright/test').Page) => page.locator('.segmented button[aria-pressed="true"]');

test('Space switches Edit and Preview, but not while typing', async ({ page }) => {
  await newProject(page);
  await addAt(page, 'Add text', 20, 20);
  await page.locator('.stage').click({ position: { x: 8, y: 300 } });
  await expect(active(page)).toHaveText('Edit');

  await page.keyboard.press('Space');
  await expect(active(page)).toHaveText('Preview / Interact');
  await page.keyboard.press('Space');
  await expect(active(page)).toHaveText('Edit');

  await page.locator('.hitbox[data-name="Text"]').click();
  const box = page.getByLabel('Text content');
  await box.fill('Hello');
  await box.press('Space');
  await expect(active(page)).toHaveText('Edit');
  await expect(box).toHaveValue('Hello ');

  await page.locator('.stage').click({ position: { x: 8, y: 300 } });
  await page.keyboard.press('Space');
  await expect(active(page)).toHaveText('Preview / Interact');
  await page.locator('.preview-frame').click();
  await page.keyboard.press('Space');
  await expect(active(page)).toHaveText('Edit');
});
