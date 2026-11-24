import { expect, test } from '@playwright/test';
import { addAt, field, newProject } from './helpers';

test.beforeEach(async ({ page }) => { await newProject(page); });

test('every element can be selected by clicking it', async ({ page }) => {
  await addAt(page, 'Add text', 20, 20);
  await addAt(page, 'Add rectangle', 20, 200);
  await addAt(page, 'Add CTA button', 250, 350);
  for (const name of ['Text', 'Rectangle', 'CTA']) {
    await page.locator(`.hitbox[data-name="${name}"]`).click();
    await expect(page.locator('.props-title')).toHaveText(name);
  }
});

test('dragging moves an element and undo restores it', async ({ page }) => {
  await addAt(page, 'Add CTA button', 40, 370);
  const box = (await page.locator('.hitbox[data-name="CTA"]').boundingBox())!;
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx + 30, cy, { steps: 6 });
  await page.mouse.up();
  await expect(field(page, 'X')).toHaveValue('70');
  await expect(field(page, 'Y')).toHaveValue('370');
  await page.keyboard.press('Control+z');
  await expect(field(page, 'X')).toHaveValue('40');
});

test('arrow keys nudge the selection', async ({ page }) => {
  await addAt(page, 'Add CTA button', 40, 370);
  await page.locator('.hitbox[data-name="CTA"]').click(); // also moves focus out of the input
  await page.keyboard.press('Shift+ArrowRight');
  await page.keyboard.press('ArrowDown');
  await expect(field(page, 'X')).toHaveValue('50');
  await expect(field(page, 'Y')).toHaveValue('371');
});
