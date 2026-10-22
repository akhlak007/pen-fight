import { expect, test } from '@playwright/test';

test('a mobile flick enters motion once and returns to a playable turn', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();

  await page.getByLabel('Your name').fill('Physics Player');
  await page.getByRole('button', { name: /Claim my desk/ }).click();
  await page.getByRole('button', { name: 'INSTANT' }).click();
  await page.getByRole('button', { name: 'Practice' }).click();
  await page.waitForTimeout(600);

  await page.mouse.move(127, 550);
  await page.mouse.down();
  await page.mouse.move(127, 650, { steps: 5 });
  await expect(page.getByLabel('Flick power')).not.toHaveAttribute('aria-valuenow', '0');
  await page.mouse.up();

  const turn = page.getByLabel('Turn status');
  await expect(turn).toHaveAttribute('data-action', 'playerMoving');
  await expect(turn).toHaveAttribute('data-action', 'ready', { timeout: 8_000 });
  await expect(turn).toContainText('PRACTICE SHOT');
});

test('a pull immediately beyond the 12px dead zone releases a shot', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();

  await page.getByLabel('Your name').fill('Dead Zone Player');
  await page.getByRole('button', { name: /Claim my desk/ }).click();
  await page.getByRole('button', { name: 'INSTANT' }).click();
  await page.getByRole('button', { name: 'Practice' }).click();
  await page.waitForTimeout(600);

  await page.mouse.move(127, 550);
  await page.mouse.down();
  await page.mouse.move(127, 565);
  await page.mouse.up();

  await expect(page.getByLabel('Turn status')).toHaveAttribute('data-action', 'playerMoving');
});

test('a natural 90px phone pull reaches maximum power', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();

  await page.getByLabel('Your name').fill('Power Player');
  await page.getByRole('button', { name: /Claim my desk/ }).click();
  await page.getByRole('button', { name: 'INSTANT' }).click();
  await page.getByRole('button', { name: 'Practice' }).click();
  await page.waitForTimeout(600);

  await page.mouse.move(127, 550);
  await page.mouse.down();
  await page.mouse.move(127, 640, { steps: 5 });

  await expect(page.getByLabel('Flick power')).toHaveAttribute('aria-valuenow', '100');
  await page.mouse.up();
  await expect(page.getByLabel('Turn status')).toHaveAttribute('data-action', 'playerMoving');
});
