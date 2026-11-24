import { expect, test } from '@playwright/test';
import { addAt, newProject } from './helpers';

const face = (subset: string, file: string, range: string) => `/* ${subset} */
@font-face {
  font-family: 'Test Sans';
  font-style: normal;
  font-weight: 400;
  src: url(https://fonts.gstatic.com/s/testsans/${file}.woff2) format('woff2');
  unicode-range: ${range};
}`;
const CSS = [face('cyrillic', 'cyr', 'U+0400-045F'), face('latin-ext', 'ext', 'U+0100-02BA'), face('latin', 'latin', 'U+0000-00FF')].join('\n');
const CORS = { 'access-control-allow-origin': '*' };

test('adds a Google Font (latin + extended Latin only) and offers it in the font menu', async ({ page }) => {
  await page.route('https://fonts.googleapis.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: CSS, headers: CORS }));
  await page.route('https://fonts.gstatic.com/**', (r) =>
    r.fulfill({ status: 200, contentType: 'font/woff2', body: Buffer.from(`fake-font ${r.request().url()}`), headers: CORS }));

  await newProject(page);
  await addAt(page, 'Add text', 20, 20);
  await page.getByRole('button', { name: 'Manage fonts…' }).click();
  await page.getByLabel('Google Font name').fill('Test Sans');
  await page.getByRole('button', { name: 'Add Google Font' }).click();
  await expect(page.getByRole('status')).toContainText('Added Test Sans: 2 files');
  await expect(page.getByRole('button', { name: 'Remove Test Sans' })).toBeVisible();
  await page.getByRole('button', { name: 'Done' }).click();

  const fontSelect = page.getByLabel('Font', { exact: true });
  await fontSelect.selectOption('Test Sans');
  await expect(fontSelect).toHaveValue('Test Sans');
});
