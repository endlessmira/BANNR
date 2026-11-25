import { expect, test } from '@playwright/test';
import { addAt, newProject } from './helpers';

test('the editor layout stays still after adding layers and a component', async ({ page }) => {
  await newProject(page);
  for (let i = 0; i < 4; i++) await addAt(page, 'Add text', 20, 20 + i * 40);
  await page.getByTitle('Add a component', { exact: true }).click();
  await page.locator('.comp-panel').getByRole('button', { name: 'Animated Gradient', exact: true }).click();
  await page.waitForTimeout(800);
  const samples = await page.evaluate(async () => {
    const out: string[] = [];
    for (let i = 0; i < 20; i++) {
      await new Promise((r) => requestAnimationFrame(() => r(null)));
      const t = document.querySelector('.timeline')!.getBoundingClientRect();
      const z = document.querySelector('.zoom-box')!.getBoundingClientRect();
      out.push([t.top, t.height, z.width, z.height].map((v) => Math.round(v)).join(','));
    }
    return out;
  });
  expect(new Set(samples).size).toBe(1);
});
