import { expect, test } from '@playwright/test';
import { addAt, newProject } from './helpers';

test('an entrance animation plays in Preview and can be paused and resumed', async ({ page }) => {
  await newProject(page);
  await addAt(page, 'Add text', 20, 20);
  await page.getByLabel('Entrance', { exact: true }).selectOption('fade');
  await expect(page.getByLabel('Entrance delay', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Preview / Interact', exact: true }).click();
  const frame = await (await page.locator('.preview-frame').elementHandle())!.contentFrame();
  const states = () => frame!.evaluate(() => document.getAnimations().map((a) => a.playState));

  await expect.poll(states).toEqual(['running']);
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  await expect.poll(states).toEqual(['paused']);
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await expect.poll(states).toEqual(['running']);
});
