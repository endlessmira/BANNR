import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '+ New project' }).click();
  await page.getByLabel('Adform').check();
  await page.getByRole('button', { name: 'Create project' }).click();
  await expect(page.locator('.canvas')).toBeVisible();
});

test('every element can be selected by clicking it', async ({ page }) => {
  for (const name of ['Logo', 'Headline', 'CTA']) {
    await page.locator(`.hitbox[data-name="${name}"]`).click();
    await expect(page.locator('.readout dt')).toHaveText([name]);
  }
  // The Glow is mostly outside the banner, so click its visible part.
  await page.locator('.hitbox[data-name="Glow"]').click({ position: { x: 40, y: 140 } });
  await expect(page.locator('.readout dt')).toHaveText(['Glow']);
});

test('dragging moves an element and undo restores it', async ({ page }) => {
  const box = (await page.locator('.hitbox[data-name="CTA"]').boundingBox())!;
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx + 30, cy, { steps: 6 });
  await page.mouse.up();
  await expect(page.locator('.readout dd')).toContainText('x 50, y 190');
  await page.keyboard.press('Control+z');
  await expect(page.locator('.readout dd')).toContainText('x 20, y 190');
});

test('arrow keys nudge the selection', async ({ page }) => {
  await page.locator('.hitbox[data-name="CTA"]').click();
  await page.keyboard.press('Shift+ArrowRight');
  await page.keyboard.press('ArrowDown');
  await expect(page.locator('.readout dd')).toContainText('x 30, y 191');
});
