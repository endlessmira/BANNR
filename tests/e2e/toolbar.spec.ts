import { expect, test } from '@playwright/test';
import { newProject } from './helpers';

for (const width of [1920, 1366]) {
  test.describe(`at ${width} px`, () => {
    test.use({ viewport: { width, height: 1000 } });
    test('the toolbar stays on one row', async ({ page }) => {
      await newProject(page);
      const box = (await page.locator('.toolbar').boundingBox())!;
      expect(box.height).toBeLessThan(56);
    });
  });
}
