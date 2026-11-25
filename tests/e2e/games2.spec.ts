import { type Page, expect, test } from '@playwright/test';
import { newProject } from './helpers';

async function addCard(page: Page, name: string) {
  await page.getByTitle('Add a component', { exact: true }).click();
  await page.locator('.comp-panel').getByRole('button', { name, exact: true }).click();
}

test('drag and drop: drag every product into the target, then the win CTA opens the landing page', async ({ page }) => {
  await newProject(page);
  await addCard(page, 'Drag and Drop');
  await expect(page.locator('.hitbox[data-name="Drag and Drop"]')).toHaveCSS('width', '480px');
  await page.getByRole('button', { name: 'Preview / Interact', exact: true }).click();
  const frame = page.frameLocator('.preview-frame');
  await frame.locator('[data-play]').click();
  await expect(frame.locator('.el-component')).toHaveCSS('touch-action', 'none');

  const t = (await frame.locator('[data-target]').boundingBox())!;
  for (let i = 0; i < 3; i++) {
    const b = (await frame.locator(`.bdd-it[data-it="${i}"]`).boundingBox())!;
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
    await page.mouse.down();
    await page.mouse.move(t.x + t.width / 2, t.y + t.height / 2, { steps: 8 });
    await page.mouse.up();
  }
  await expect(frame.locator('[data-scr="win"]')).toBeVisible();
  await expect(page.locator('.events-log')).toContainText('game_won');
  await expect(page.locator('.toast')).toHaveCount(0);
  await frame.locator('[data-scr="win"] [data-cta]').click();
  await expect(page.locator('.toast')).toContainText('Test click');
});

test('slice game: pauses page scrolling while playing; Skip · Shop now opens the landing page', async ({ page }) => {
  await newProject(page);
  await addCard(page, 'Slice Game');
  await page.getByRole('button', { name: 'Preview / Interact', exact: true }).click();
  const frame = page.frameLocator('.preview-frame');
  await expect(frame.locator('.el-component')).toHaveCSS('touch-action', 'pan-y');
  await frame.locator('[data-play]').click();
  await expect(frame.locator('.el-component')).toHaveCSS('touch-action', 'none');
  await frame.locator('[data-skip]').click();
  await expect(page.locator('.events-log')).toContainText('game_skip');
  await expect(page.locator('.toast')).toContainText('Test click');
});
