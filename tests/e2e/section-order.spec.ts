import { expect, test } from '@playwright/test';
import { newProject } from './helpers';

const PNG_1PX = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

test('the Animation section comes right after the Image section', async ({ page }) => {
  await newProject(page);
  await page.locator('.toolbar input[type="file"]').setInputFiles({
    name: 'dot.png', mimeType: 'image/png', buffer: Buffer.from(PNG_1PX, 'base64'),
  });
  await expect(page.locator('.props-title')).toHaveText('dot');
  const titles = await page.locator('.panel-right .psec').evaluateAll((els) => els.map((e) => e.getAttribute('data-title')));
  expect(titles.slice(0, 4)).toEqual(['Layout', 'Image', 'Animation', 'Fill']);
});
