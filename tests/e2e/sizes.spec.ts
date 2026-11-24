import { type Page, expect, test } from '@playwright/test';
import { newProject } from './helpers';

test.beforeEach(async ({ page }) => { await newProject(page); });

async function addStandard(page: Page, label: RegExp) {
  await page.getByRole('button', { name: '+ Add', exact: true }).click();
  await page.getByLabel(label).check();
  await page.getByRole('button', { name: 'Add 1 size' }).click();
}

test('a new project is an empty 480×480 master with no delete option', async ({ page }) => {
  await expect(page.locator('.size-btn')).toHaveCount(1);
  await expect(page.locator('.size-btn').first()).toContainText('480×480');
  await expect(page.locator('.size-btn').first()).toContainText('master');
  await expect(page.locator('.hitbox')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Options for 480×480' })).toHaveCount(0);
});

test('only the six standard sizes are offered', async ({ page }) => {
  await page.getByRole('button', { name: '+ Add', exact: true }).click();
  await expect(page.locator('.size-option')).toHaveCount(6);
  await page.getByRole('button', { name: 'Cancel' }).click();
});

test('adds a size generated from the master layout', async ({ page }) => {
  await page.getByTitle('Add text', { exact: true }).click();
  await addStandard(page, /300×300/);
  await expect(page.locator('.props-title')).toHaveText('Banner 300×300');
  await expect(page.locator('.hitbox')).toHaveCount(1);
  await expect(page.locator('.size-btn')).toHaveCount(2);
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
  await addStandard(page, /300×250/);
  await expect(page.locator('.size-btn')).toHaveCount(2);
  await page.getByRole('button', { name: 'Options for 300×250' }).click();
  await page.getByRole('menuitem', { name: 'Delete size' }).click();
  await expect(page.locator('.size-btn')).toHaveCount(1);
  await page.keyboard.press('Control+z');
  await expect(page.locator('.size-btn')).toHaveCount(2);
});
