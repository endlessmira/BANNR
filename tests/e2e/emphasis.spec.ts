import { expect, test } from '@playwright/test';
import { addAt, newProject } from './helpers';

test('emphasis: pulse shows on the timeline, flash has no strength, and it plays in Preview', async ({ page }) => {
  await newProject(page);
  await addAt(page, 'Add text', 20, 20);
  const emph = page.getByLabel('Emphasis', { exact: true });
  await emph.selectOption('pulse');
  await expect(page.getByRole('spinbutton', { name: 'Emphasis repeat', exact: true })).toHaveValue('2');
  await expect(page.getByRole('spinbutton', { name: 'Emphasis size', exact: true })).toHaveValue('8');
  await expect(page.locator('.tl-bar[data-phase="emphasis"]')).toHaveCount(1);

  await emph.selectOption('flash');
  await expect(page.getByRole('spinbutton', { name: 'Emphasis size', exact: true })).toHaveCount(0);

  await page.getByRole('button', { name: 'Preview / Interact', exact: true }).click();
  const frame = await (await page.locator('.preview-frame').elementHandle())!.contentFrame();
  await expect.poll(() => frame!.evaluate(() => document.getAnimations().length)).toBe(1);
});
