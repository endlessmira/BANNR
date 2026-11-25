import { expect, test } from '@playwright/test';
import { newProject } from './helpers';

test('the animation plays once by default; Repeat animation shows Plays', async ({ page }) => {
  await newProject(page);
  const repeat = page.getByLabel('Repeat animation');
  const plays = page.getByRole('spinbutton', { name: 'Plays', exact: true });
  await expect(repeat).not.toBeChecked();
  await expect(plays).toHaveCount(0);
  await repeat.check();
  await expect(plays).toHaveValue('2');
  await repeat.uncheck();
  await expect(plays).toHaveCount(0);
});
