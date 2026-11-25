import { test, expect } from '@playwright/test';
import { newProject } from './helpers';

test('timeline header says Animation and shows one-decimal times', async ({ page }) => {
  await newProject(page);
  await expect(page.locator('.tl-total')).toHaveText(
    /^Animation \d+\.\d s × \d+ plays? = \d+\.\d s · animations end at \d+\.\d s/,
  );
});
