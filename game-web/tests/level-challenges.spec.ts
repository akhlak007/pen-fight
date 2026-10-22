import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByLabel('Your name').fill('Rafi');
  await page.getByRole('button', { name: /Claim my desk/ }).click();
});

async function setXp(page: import('@playwright/test').Page, xp: number) {
  await page.evaluate((nextXp) => {
    const key = 'pen-fight:save';
    const saved = JSON.parse(localStorage.getItem(key) ?? '{}') as { progression?: { xp?: number } };
    saved.progression = { ...saved.progression, xp: nextXp };
    localStorage.setItem(key, JSON.stringify(saved));
  }, xp);
  await page.reload();
}

test('uses the profile level for a locked Quick Match challenge', async ({ page }) => {
  await setXp(page, 7360); // Level 24.
  await page.getByRole('button', { name: 'INSTANT' }).click();
  await page.getByRole('button', { name: /Quick Match/ }).click();

  const banner = page.getByRole('status').filter({ hasText: 'LEVEL 24' });
  await expect(banner).toContainText('Center Bumper');
  const canvas = page.getByLabel(/3D classroom arena/);
  await expect(canvas).toHaveAttribute('data-arena-level', '24');
  await expect(canvas).toHaveAttribute('data-arena-hazard', 'bumper');

  await canvas.focus();
  await canvas.press('ArrowUp');
  await canvas.press('Space');
  await expect(page.getByLabel('Turn status')).toContainText('SHOT IN MOTION');
  await expect(canvas).toHaveAttribute('data-arena-level', '24');
});

test('shows the visible chalk-gate challenge at level 4', async ({ page }) => {
  await setXp(page, 360);
  await page.getByRole('button', { name: 'INSTANT' }).click();
  await page.getByRole('button', { name: /Quick Match/ }).click();

  await expect(page.getByRole('status').filter({ hasText: 'LEVEL 4' })).toContainText('Chalk Gate');
  const canvas = page.getByLabel(/3D classroom arena/);
  await expect(canvas).toHaveAttribute('data-arena-level', '4');
  await expect(canvas).toHaveAttribute('data-arena-hazard', 'rulers');
});

test('gives levels 5 and 6 different permanent visual themes', async ({ page }) => {
  await setXp(page, 520);
  await page.getByRole('button', { name: 'INSTANT' }).click();
  await page.getByRole('button', { name: /Quick Match/ }).click();
  const canvas = page.getByLabel(/3D classroom arena/);
  await expect(canvas).toHaveAttribute('data-arena-theme', 'level-05');

  await page.getByRole('button', { name: 'Leave match' }).click();
  await setXp(page, 700);
  await page.getByRole('button', { name: 'INSTANT' }).click();
  await page.getByRole('button', { name: /Quick Match/ }).click();
  await expect(canvas).toHaveAttribute('data-arena-theme', 'level-06');
});

test('starts level 1 on the training desk and keeps the locked arena after rerenders', async ({ page }) => {
  await page.getByRole('button', { name: 'INSTANT' }).click();
  await page.getByRole('button', { name: /Quick Match/ }).click();

  const canvas = page.getByLabel(/3D classroom arena/);
  const banner = page.getByRole('status').filter({ hasText: 'LEVEL 1' });
  await expect(banner).toContainText('Training Desk');
  await expect(canvas).toHaveAttribute('data-arena-level', '1');
  await page.evaluate(() => {
    const key = 'pen-fight:save';
    const saved = JSON.parse(localStorage.getItem(key) ?? '{}') as { progression?: { xp?: number } };
    saved.progression = { ...saved.progression, xp: 104860 };
    localStorage.setItem(key, JSON.stringify(saved));
  });
  await page.getByRole('button', { name: /sound/i }).click();
  await expect(canvas).toHaveAttribute('data-arena-level', '1');
});

test('expires the challenge banner without bringing it back on a UI rerender', async ({ page }) => {
  await setXp(page, 7360);
  await page.getByRole('button', { name: 'INSTANT' }).click();
  await page.getByRole('button', { name: /Quick Match/ }).click();
  const banner = page.getByRole('status').filter({ hasText: 'LEVEL 24' });
  await expect(banner).toBeVisible();
  await expect(banner).toBeHidden({ timeout: 6000 });
  await page.getByRole('button', { name: /sound/i }).click();
  await expect(banner).toBeHidden();
});

test('keeps Practice on the standard arena', async ({ page }) => {
  await setXp(page, 104860); // Level 99.
  await page.getByRole('button', { name: 'INSTANT' }).click();
  await page.getByRole('button', { name: /Practice/ }).click();

  const canvas = page.getByLabel(/3D classroom arena/);
  await expect(canvas).toHaveAttribute('data-arena-level', 'standard');
  await expect(canvas).toHaveAttribute('data-arena-hazard', 'standard');
  await expect(page.getByText('Champion Desk')).toHaveCount(0);
});

test('keeps a high-level same-device match on the standard arena', async ({ page }) => {
  await setXp(page, 104860);
  await page.getByRole('button', { name: /SAME-DEVICE LOCAL/ }).click();
  await page.getByLabel('Player 2 name').fill('Priya');
  await page.getByRole('button', { name: /Start local match/ }).click();

  const canvas = page.getByLabel(/3D classroom arena/);
  await expect(canvas).toHaveAttribute('data-arena-level', 'standard');
  await expect(canvas).toHaveAttribute('data-arena-hazard', 'standard');
  await expect(page.getByText('Champion Desk')).toHaveCount(0);
});

test('keeps a maximum-power champion shot stable', async ({ page }) => {
  await setXp(page, 104860);
  await page.getByRole('button', { name: 'INSTANT' }).click();
  await page.getByRole('button', { name: /Quick Match/ }).click();
  const canvas = page.getByLabel(/3D classroom arena/);
  await canvas.focus();
  for (let index = 0; index < 7; index += 1) await canvas.press('ArrowUp');
  await expect(page.getByLabel('Flick power')).toHaveAttribute('aria-valuenow', '100');
  await canvas.press('Space');
  await expect(page.getByLabel('Turn status')).toHaveAttribute('data-action', 'playerMoving');
  await expect(canvas).toHaveAttribute('data-arena-level', '99');
  await expect(canvas).toBeVisible();
});

test('keeps a champion challenge and its banner inside a narrow phone', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await setXp(page, 104860);
  await page.getByRole('button', { name: 'INSTANT' }).click();
  await page.getByRole('button', { name: /Quick Match/ }).click();

  const banner = page.getByRole('status').filter({ hasText: 'LEVEL 99' });
  await expect(banner).toContainText('Champion Desk');
  const box = await banner.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(360);
  await expect(page.getByLabel(/3D classroom arena/)).toHaveAttribute('data-arena-level', '99');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
});
