import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByLabel('Your name').fill('Rafi');
  await page.getByRole('button', { name: /Claim my desk/ }).click();
  await page.getByRole('button', { name: 'Open your Player Passport' }).click();
});

test('player passport edits and persists public identity', async ({ page }) => {
  await expect(page.getByRole('dialog', { name: /RAFI/ })).toBeVisible();
  await expect(page.getByLabel('Player progress')).toContainText('LEVEL 1');
  await expect(page.getByRole('button', { name: 'Classic Blue' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: 'Red Comet' })).toBeDisabled();

  await page.getByRole('radio', { name: 'Artist' }).click();
  await page.getByPlaceholder('Search country or code').fill('Canada');
  await page.getByRole('radio', { name: /Canada/ }).click();
  await page.getByRole('button', { name: /CLASSROOM/ }).click();
  await page.reload();
  await page.getByRole('button', { name: 'Open your Player Passport' }).click();

  await expect(page.getByRole('radio', { name: 'Artist' })).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByRole('radio', { name: /Canada/ })).toHaveAttribute('aria-checked', 'true');
});

test('player passport remains usable on a narrow phone', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await expect(page.getByRole('heading', { name: /RAFI/ })).toBeVisible();
  await expect(page.getByLabel('Choose avatar')).toBeVisible();
  await expect(page.getByPlaceholder('Search country or code')).toBeVisible();
  await page.getByRole('heading', { name: 'MY DESKS' }).scrollIntoViewIfNeeded();
  await expect(page.getByRole('heading', { name: 'MY DESKS' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
});

test('name can be edited from the passport', async ({ page }) => {
  await page.getByRole('button', { name: 'EDIT NAME' }).click();
  await expect(page.getByRole('heading', { name: 'Welcome to Pen Fight' })).toBeVisible();
  await page.getByLabel('Your name').fill('Mahi');
  await page.getByRole('button', { name: /UPDATE/ }).click();
  await expect(page.getByText('MAHI', { exact: true })).toBeVisible();
});
