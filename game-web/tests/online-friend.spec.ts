import { expect, test } from '@playwright/test';

test('creates an invite and joins from a second device context', async ({ browser }) => {
  test.setTimeout(60_000);
  const hostContext = await browser.newContext();
  const guestContext = await browser.newContext();
  const host = await hostContext.newPage();
  const guest = await guestContext.newPage();
  await host.goto('/');
  await host.getByLabel('Your name').fill('Akhlaq');
  await host.getByRole('button', { name: /Claim my desk/ }).click();
  await host.getByRole('button', { name: /FRIEND/ }).click();
  await host.getByRole('button', { name: /Online invite/ }).click();
  await host.getByRole('button', { name: /Create invite link/ }).click();
  const room = (await host.locator('.room-code').textContent())?.trim();
  expect(room).toMatch(/^[A-Z2-9]{6}$/);

  await guest.goto(`/?room=${room}`);
  await guest.getByLabel('Your name').fill('Priya');
  await guest.getByRole('button', { name: /Claim my desk/ }).click();
  await expect(host.locator('.scoreboard')).toContainText('Priya');
  await expect(guest.locator('.scoreboard')).toContainText('Akhlaq');
  await expect(host.locator('.match-mode')).toContainText(room!);
  await host.locator('canvas').focus();
  await host.locator('canvas').press('ArrowUp');
  await host.locator('canvas').press('Space');
  await expect(guest.locator('.turn-dock')).toContainText(/PRIYA.*TURN/i, { timeout: 15_000 });
  await guest.locator('canvas').focus();
  await guest.locator('canvas').press('ArrowDown');
  await guest.locator('canvas').press('Space');
  await expect(host.locator('.turn-dock')).toContainText('SHOT IN MOTION');
  await hostContext.close();
  await guestContext.close();
});
