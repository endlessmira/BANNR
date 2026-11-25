import { expect, test } from '@playwright/test';
import { newProject } from './helpers';

test('gesture: sits on top, hides on hover, and lets clicks through', async ({ page }) => {
  await newProject(page);
  await page.getByTitle('Add a component', { exact: true }).click();
  await expect(page.locator('.comp-panel').getByRole('button', { name: 'Gesture · Swipe', exact: true })).toHaveCount(0);
  await page.locator('.comp-panel').getByRole('button', { name: 'Gesture', exact: true }).click();
  await expect(page.locator('.hitbox[data-name="Gesture"]')).toHaveCSS('width', '480px');
  await expect(page.locator('.canvas-render .bgs-c')).toHaveCount(1);

  await page.getByRole('button', { name: 'Preview / Interact', exact: true }).click();
  const frame = page.frameLocator('.preview-frame');
  await expect(frame.locator('.bgs')).toHaveCount(1);
  await expect(frame.locator('.bgs')).not.toHaveClass(/bgs-off/);

  const b = (await page.locator('.preview-frame').boundingBox())!;
  await page.mouse.move(b.x + 100, b.y + 100);
  await page.mouse.move(b.x + 140, b.y + 120, { steps: 4 });
  await expect(frame.locator('.bgs')).toHaveClass(/bgs-off/);
  await expect(page.locator('.events-log')).toContainText('gesture_dismissed');

  await page.locator('.preview-frame').click();
  await expect(page.locator('.toast')).toContainText('Test click');
});
