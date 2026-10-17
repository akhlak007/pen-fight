import { expect, test } from '@playwright/test';

test('opens the Pen Fight application shell', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('main', { name: 'Pen Fight game' })).toBeVisible();
  await expect(page.getByLabel('3D classroom')).toBeVisible();
  await expect(page.getByRole('region', { name: 'Welcome to Pen Fight' })).toBeVisible();
  await expect(page.getByLabel('Your name')).toBeVisible();
});
