import { expect, test } from '@playwright/test';

const username = () => `Player_${crypto.randomUUID().slice(0, 8)}`;

test('requires an account for the leaderboard and continues there after signup', async ({ page }) => {
  const user = username();
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByLabel('Your name').fill('Ranking Guest');
  await page.getByRole('button', { name: /Claim my desk/ }).click();
  await page.getByRole('button', { name: 'CLASS RANKING' }).click();

  await expect(page.getByRole('heading', { name: 'Save your place' })).toBeVisible();
  await expect(page.getByText('Sign up or sign in to view the leaderboard.')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'All players' })).not.toBeVisible();

  const signupForm = page.locator('.signup-form');
  await signupForm.getByLabel('Username').fill(user);
  await signupForm.getByLabel('Password', { exact: true }).fill('classroom-pass');
  await signupForm.getByLabel('Confirm password').fill('classroom-pass');
  await signupForm.getByRole('button', { name: /CREATE ACCOUNT/ }).click();

  await expect(page.getByRole('heading', { name: 'All players' })).toBeVisible();
  await expect(page.getByRole('listitem').filter({ hasText: user })).toBeVisible();
  await expect(page.getByText(/YOUR GLOBAL RANK/)).toBeVisible();
});

test('creates an account, restores its session, ranks the player, and signs back in', async ({ page }) => {
  const user = username();
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByLabel('Your name').fill('Local Hero');
  await page.getByRole('button', { name: /Claim my desk/ }).click();
  await page.getByRole('button', { name: 'SIGN IN' }).click();

  await expect(page.getByRole('heading', { name: 'Save your place' })).toBeVisible();
  await expect(page.getByText('KEEP YOUR PROGRESS')).toBeVisible();
  const signupForm = page.locator('.signup-form');
  await signupForm.getByLabel('Username').fill(user);
  await signupForm.getByLabel('Password', { exact: true }).fill('classroom-pass');
  await signupForm.getByLabel('Confirm password').fill('classroom-pass');
  await signupForm.getByRole('button', { name: /CREATE ACCOUNT/ }).click();

  await expect(page.getByRole('heading', { name: user })).toBeVisible();
  await expect(page.getByText(/PROGRESS SYNCED/)).toBeVisible();
  await page.getByRole('button', { name: /CLASSROOM/ }).click();
  await expect(page.getByRole('button', { name: user })).toBeVisible();

  await page.getByRole('button', { name: 'CLASS RANKING' }).click();
  await expect(page.getByRole('heading', { name: 'All players' })).toBeVisible();
  await expect(page.getByRole('listitem').filter({ hasText: user })).toBeVisible();
  await expect(page.getByText(/YOUR GLOBAL RANK/)).toBeVisible();
  await page.getByRole('button', { name: /CLASSROOM/ }).click();

  await page.reload();
  await expect(page.getByRole('button', { name: user })).toBeVisible();
  await page.getByRole('button', { name: user }).click();
  await page.getByRole('button', { name: 'SIGN OUT' }).click();
  await expect(page.getByRole('heading', { name: 'Save your place' })).toBeVisible();

  await page.getByRole('button', { name: /CLASSROOM/ }).click();
  await page.getByRole('button', { name: 'CLASS RANKING' }).click();
  await expect(page.getByText('Sign up or sign in to view the leaderboard.')).toBeVisible();

  await page.getByRole('tab', { name: 'SIGN IN' }).click();
  await page.locator('.login-form').getByLabel('Username').fill(user);
  await page.locator('.login-form').getByLabel('Password').fill('classroom-pass');
  await page.locator('.login-form').getByRole('button', { name: /SIGN IN/ }).click();
  await expect(page.getByRole('heading', { name: 'All players' })).toBeVisible();
  await expect(page.getByRole('listitem').filter({ hasText: user })).toBeVisible();
});

test('account and leaderboard remain usable on a narrow phone', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByLabel('Your name').fill('Phone Player');
  await page.getByRole('button', { name: /Claim my desk/ }).click();
  await page.getByRole('button', { name: 'SIGN IN' }).click();
  await expect(page.getByRole('heading', { name: 'Save your place' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  await page.getByRole('button', { name: /CLASSROOM/ }).click();
  await page.getByRole('button', { name: 'CLASS RANKING' }).click();
  await expect(page.getByRole('heading', { name: 'Save your place' })).toBeVisible();
  await expect(page.getByText('Sign up or sign in to view the leaderboard.')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
});
