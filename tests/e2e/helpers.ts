import { type Page, expect } from '@playwright/test';

export const field = (page: Page, name: string) => page.getByRole('spinbutton', { name, exact: true });

/** Creates a new (empty) Adform project and waits for the editor. */
export async function newProject(page: Page): Promise<void> {
  await page.goto('/');
  await page.getByRole('button', { name: '+ New project' }).click();
  await page.getByLabel('Adform').check();
  await page.getByRole('button', { name: 'Create project' }).click();
  await expect(page.locator('.canvas')).toBeVisible();
}

/** Adds an element with a toolbar button, then moves it to (x, y) via the properties panel. */
export async function addAt(page: Page, tool: string, x: number, y: number): Promise<void> {
  await page.getByTitle(tool, { exact: true }).click();
  await field(page, 'X').fill(String(x));
  await field(page, 'Y').fill(String(y));
  const hit = page.locator('.hitbox[data-selected="true"]');
  await expect(hit).toHaveCSS('left', `${x}px`);
  await expect(hit).toHaveCSS('top', `${y}px`);
}
