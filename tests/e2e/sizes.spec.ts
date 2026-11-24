import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '+ New project' }).click();
  await page.getByLabel('Adform').check();
  await page.getByRole('button', { name: 'Create project' }).click();
  await expect(page.locator('.canvas')).toBeVisible();
});

test('the 480×480 master is first and has no delete option', async ({ page }) => {
  await expect(page.locator('.size-btn').first()).toContainText('480×480');
  await expect(page.locator('.size-btn').first()).toContainText('master');
  await expect(page.getByRole('button', { name: 'Options for 480×480' })).toHaveCount(0);
});

test('only the six standard sizes are offered', async ({ page }) => {
  await page.getByRole('button', { name: '+ Add', exact: true }).click();
  await expect(page.locator('.size-option')).toHaveCount(6);
  await page.getByRole('button', { name: 'Cancel' }).click();
});

test('adds a size generated from the master layout', async ({ page }) => {
  await page.getByRole('button', { name: '+ Add', exact: true }).click();
  await page.getByLabel(/300×300/).check();
  await page.getByRole('button', { name: 'Add 1 size' }).click();
  await expect(page.locator('.props-title')).toHaveText('Banner 300×300');
  await expect(page.locator('.hitbox')).toHaveCount(4);
  await expect(page.locator('.size-btn')).toHaveCount(5);
});

test('adds a custom size', async ({ page }) => {
  await page.getByRole('button', { name: '+ Add', exact: true }).click();
  await page.getByLabel('Custom width').fill('250');
  await page.getByLabel('Custom height').fill('250');
  await page.getByRole('button', { name: 'Add to list' }).click();
  await page.getByRole('button', { name: 'Add 1 size' }).click();
  await expect(page.locator('.props-title')).toHaveText('Banner 250×250');
});

test('deletes a size and undo brings it back', async ({ page }) => {
  await page.getByRole('button', { name: 'Options for 970×250' }).click();
  await page.getByRole('menuitem', { name: 'Delete size' }).click();
  await expect(page.locator('.size-btn')).toHaveCount(3);
  await page.keyboard.press('Control+z');
  await expect(page.locator('.size-btn')).toHaveCount(4);
});
