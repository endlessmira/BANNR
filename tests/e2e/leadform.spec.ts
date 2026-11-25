import { expect, test } from '@playwright/test';
import { newProject } from './helpers';

test('lead form: required settings block export, then it submits in Interact mode', async ({ page }) => {
  await newProject(page);
  await page.getByTitle('Add a component', { exact: true }).click();
  await page.locator('.comp-panel').getByRole('button', { name: 'Lead Form', exact: true }).click();
  await expect(page.locator('.props-title')).toHaveText('Lead Form');
  await expect(page.locator('.anim-warn', { hasText: 'personal data' })).toBeVisible();

  await page.getByRole('button', { name: 'Export', exact: true }).click();
  await expect(page.locator('.check-item[data-level="error"]', { hasText: 'endpoint' })).toHaveCount(1);
  await expect(page.locator('.check-item[data-level="error"]', { hasText: 'privacy policy' })).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Download zips' })).toBeDisabled();
  await page.getByRole('button', { name: 'Close', exact: true }).click();

  await page.getByLabel('Submit endpoint (HTTPS)', { exact: true }).fill('https://api.example.com/leads');
  await page.getByLabel('Privacy policy URL', { exact: true }).fill('https://privacy.example.com/policy');
  await page.getByRole('button', { name: 'Export', exact: true }).click();
  await expect(page.locator('.check-status')).toHaveText('Ready to export');
  await expect(page.locator('.check-item[data-level="warning"]', { hasText: 'personal data' })).toHaveCount(1);
  await page.getByRole('button', { name: 'Close', exact: true }).click();

  await page.getByRole('button', { name: 'Preview / Interact', exact: true }).click();
  const f = page.frameLocator('.preview-frame');
  await f.locator('input[name="lf_name"]').fill('Mira');
  await f.locator('input[name="lf_email"]').fill('not-an-email');
  await f.locator('.bc-lf-btn').click();
  await expect(f.locator('.bc-lf-err')).toHaveText('Please enter a valid email address.');
  await f.locator('input[name="lf_email"]').fill('mira@example.com');
  await f.locator('input[name="lf_consent"]').check();
  await f.locator('.bc-lf-btn').click();
  await expect(f.locator('.bc-lf-ok')).toBeVisible();
  await expect(page.locator('.events-log')).toContainText('lead_submitted');
});
