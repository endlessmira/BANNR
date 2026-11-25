import { expect, test } from '@playwright/test';
import { newProject } from './helpers';

test('Fill, Stroke and Shadow start closed and stay open once opened', async ({ page }) => {
  await newProject(page);
  await page.getByTitle('Add rectangle', { exact: true }).click();
  const sec = (name: string) => page.getByRole('button', { name, exact: true });
  for (const n of ['Fill', 'Stroke', 'Shadow']) await expect(sec(n)).toHaveAttribute('aria-expanded', 'false');
  await expect(sec('Layout')).toHaveAttribute('aria-expanded', 'true');

  await sec('Fill').click();
  await expect(sec('Fill')).toHaveAttribute('aria-expanded', 'true');
  await page.reload();
  await page.locator('.hitbox[data-name="Rectangle"]').click();
  await expect(sec('Fill')).toHaveAttribute('aria-expanded', 'true');
  await expect(sec('Stroke')).toHaveAttribute('aria-expanded', 'false');
});
