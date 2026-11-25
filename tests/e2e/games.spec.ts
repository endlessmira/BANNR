import { type Page, expect, test } from '@playwright/test';
import { newProject } from './helpers';

async function addCard(page: Page, name: string) {
  await page.getByTitle('Add a component', { exact: true }).click();
  await page.locator('.comp-panel').getByRole('button', { name, exact: true }).click();
}

test('memory game: play, find all pairs, then the win screen CTA opens the landing page', async ({ page }) => {
  await newProject(page);
  await addCard(page, 'Memory Game');
  await expect(page.locator('.hitbox[data-name="Memory Game"]')).toHaveCSS('width', '480px');
  await expect(page.locator('.canvas-render [data-scr="start"]')).toHaveClass(/bgm-show/);

  await page.getByRole('button', { name: 'Preview / Interact', exact: true }).click();
  const frame = page.frameLocator('.preview-frame');
  await frame.locator('[data-play]').click();
  await expect(page.locator('.events-log')).toContainText('game_start');
  for (let k = 0; k < 3; k++) {
    const pair = frame.locator(`.bmm-c[data-k="${k}"]`);
    await pair.nth(0).click();
    await pair.nth(1).click();
  }
  await expect(frame.locator('[data-scr="win"]')).toBeVisible();
  await expect(page.locator('.events-log')).toContainText('game_won');
  await expect(page.locator('.toast')).toHaveCount(0);
  await frame.locator('[data-scr="win"] [data-cta]').click();
  await expect(page.locator('.toast')).toContainText('Test click');
});

test('catch game: Skip · Shop now opens the landing page during the game', async ({ page }) => {
  await newProject(page);
  await addCard(page, 'Catch Falling Objects');
  await page.getByRole('button', { name: 'Preview / Interact', exact: true }).click();
  const frame = page.frameLocator('.preview-frame');
  await frame.locator('[data-play]').click();
  await expect(page.locator('.events-log')).toContainText('game_start');
  await frame.locator('[data-skip]').click();
  await expect(page.locator('.events-log')).toContainText('game_skip');
  await expect(page.locator('.toast')).toContainText('Test click');
});
