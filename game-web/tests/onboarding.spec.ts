import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

test('saves the player name and opens the classroom menu', async ({ page }) => {
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByLabel('Your name').fill('  Nila  ');
  await page.getByRole('button', { name: /Claim my desk/ }).click();
  await expect(page.getByRole('heading', { name: /One desk/ })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Nila' })).toBeVisible();

  await page.reload();
  await expect(page.getByRole('heading', { name: /One desk/ })).toBeVisible();
});

test('rejects a blank name and supports mode selection', async ({ page }) => {
  await page.getByRole('button', { name: /Claim my desk/ }).click();
  await expect(page.getByRole('alert')).toHaveText('Write a name before the bell rings.');
  await page.getByLabel('Your name').fill('Rafi');
  await page.getByRole('button', { name: /Claim my desk/ }).click();
  await page.getByRole('button', { name: /PLAY NOW/ }).click();
  await expect(page.getByRole('heading', { name: 'School rules?' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Quick Match/ })).toBeVisible();
});
