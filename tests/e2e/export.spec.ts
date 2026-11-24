import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import JSZip from 'jszip';
import { addAt, newProject } from './helpers';

const names = (z: JSZip) => Object.values(z.files).filter((f) => !f.dir).map((f) => f.name).sort();

test('exports an Adform zip with index.html and manifest.json at the root', async ({ page }) => {
  await newProject(page);
  await addAt(page, 'Add text', 20, 20);
  await page.getByRole('button', { name: 'Export', exact: true }).click();
  await page.getByLabel('Include backup images').uncheck();
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Download zips' }).click()]);
  expect(dl.suggestedFilename()).toBe('Untitled-banner_adform_480x480.zip');
  const zip = await JSZip.loadAsync(readFileSync((await dl.path())!));
  expect(names(zip)).toEqual(['index.html', 'manifest.json']);
  const html = await zip.file('index.html')!.async('string');
  expect(html).toContain('Adform.DHTML.js');
  expect(html).toContain('bannr.exit = function()');
});

test('the all-sizes zip contains one zip per size plus backup images', async ({ page }) => {
  await newProject(page);
  await addAt(page, 'Add CTA button', 40, 370);
  await page.getByRole('button', { name: '+ Add', exact: true }).click();
  await page.getByLabel(/300×250/).check();
  await page.getByRole('button', { name: 'Add 1 size' }).click();
  await page.getByRole('button', { name: 'Export', exact: true }).click();
  const [dl] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Download all sizes (one zip)' }).click(),
  ]);
  expect(dl.suggestedFilename()).toBe('Untitled-banner_adform_all-sizes.zip');
  const zip = await JSZip.loadAsync(readFileSync((await dl.path())!));
  expect(names(zip)).toEqual([
    'Untitled-banner_adform_300x250.zip', 'Untitled-banner_adform_300x250_backup.jpg',
    'Untitled-banner_adform_480x480.zip', 'Untitled-banner_adform_480x480_backup.jpg',
  ]);
});
