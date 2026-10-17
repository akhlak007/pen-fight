import { expect, test } from '@playwright/test';

test('online match allows multiple consecutive hits by both players', async ({ browser }) => {
  test.setTimeout(90_000);
  const hostContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const guestContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const host = await hostContext.newPage();
  const guest = await guestContext.newPage();

  // Host setup
  await host.goto('/');
  await host.getByLabel('Your name').fill('HostPC');
  await host.getByRole('button', { name: /Claim my desk/ }).click();
  await host.getByRole('button', { name: /FRIEND/ }).click();
  await host.getByRole('button', { name: /Online invite/ }).click();
  await host.getByRole('button', { name: /Create invite link/ }).click();
  const room = (await host.locator('.room-code').textContent())?.trim();
  expect(room).toMatch(/^[A-Z2-9]{6}$/);

  // Guest join
  await guest.goto(`/?room=${room}`);
  await guest.getByLabel('Your name').fill('GuestPhone');
  await guest.getByRole('button', { name: /Claim my desk/ }).click();
  await expect(host.locator('.scoreboard')).toContainText('GuestPhone');
  await expect(guest.locator('.scoreboard')).toContainText('HostPC');

  // HIT 1: Host takes Turn 1
  console.log('--- HIT 1: Host takes Turn 1 ---');
  await expect(host.locator('.turn-dock')).toContainText('YOUR TURN', { timeout: 15_000 });
  await expect(guest.locator('.turn-dock')).toContainText(/HOSTPC.*TURN/i, { timeout: 15_000 });
  await host.locator('canvas').focus();
  await host.locator('canvas').press('ArrowUp');
  await host.locator('canvas').press('Space');
  await expect(host.locator('.turn-dock')).toContainText('SHOT IN MOTION');

  // HIT 2: Guest takes Turn 2 (Guest's 1st hit)
  console.log('--- HIT 2: Guest takes Turn 2 ---');
  await expect(guest.locator('.turn-dock')).toContainText('YOUR TURN', { timeout: 15_000 });
  await expect(host.locator('.turn-dock')).toContainText(/GUESTPHONE.*TURN/i, { timeout: 15_000 });
  await guest.locator('canvas').focus();
  await guest.locator('canvas').press('ArrowDown');
  await guest.locator('canvas').press('Space');
  await expect(guest.locator('.turn-dock')).toContainText('SHOT IN MOTION');

  // Wait for pens to settle or round reset to complete after Hit 2
  console.log('--- Waiting for pens to settle or round to reset after Hit 2 ---');
  await expect(host.locator('.turn-dock')).not.toContainText('SHOT IN MOTION', { timeout: 15_000 });
  await expect(host.locator('.turn-dock')).not.toContainText('ROUND RESETTING', { timeout: 15_000 });
  await expect(guest.locator('.turn-dock')).not.toContainText('SHOT IN MOTION', { timeout: 15_000 });
  await expect(guest.locator('.turn-dock')).not.toContainText('ROUND RESETTING', { timeout: 15_000 });

  const hostHasTurn = (await host.locator('.turn-dock').textContent())?.includes('YOUR TURN');
  const activePage = hostHasTurn ? host : guest;
  const activeKey = hostHasTurn ? 'ArrowUp' : 'ArrowDown';
  const activeName = hostHasTurn ? 'Host' : 'Guest';

  console.log(`--- HIT 3: ${activeName} taking Turn 3 ---`);
  await expect(activePage.locator('.turn-dock')).toContainText('YOUR TURN');
  await activePage.locator('canvas').focus();
  await activePage.locator('canvas').press(activeKey);
  await activePage.locator('canvas').press('Space');
  await expect(activePage.locator('.turn-dock')).toContainText('SHOT IN MOTION');

  // After Hit 3, wait for shot in motion to finish
  console.log('--- Checking outcome after Hit 3 ---');
  await expect(host.locator('.turn-dock')).not.toContainText('SHOT IN MOTION', { timeout: 15_000 });

  // If a knockout occurred and reached 2 points, result card appears within 4-5s
  const isMatchOver = await host.locator('.result-card').waitFor({ timeout: 5000 }).then(() => true).catch(() => false);
  if (isMatchOver) {
    console.log('--- Match reached 2 points! Verifying Result Card on both Host and Guest ---');
    await expect(host.locator('.result-card')).toBeVisible();
    await expect(guest.locator('.result-card')).toBeVisible();
    await expect(host.locator('.result-card')).toContainText(/\d\s*:\s*\d/);
    await expect(guest.locator('.result-card')).toContainText(/\d\s*:\s*\d/);

    // Test Rematch functionality: Host clicks "Flick again →"
    console.log('--- Host clicking Rematch ("Flick again →") ---');
    await host.locator('.rematch').click();

    // Verify both Host and Guest transition back to match arena
    console.log('--- Verifying rematch resets arena for both Host and Guest ---');
    await expect(host.locator('.turn-dock')).toContainText('YOUR TURN', { timeout: 15_000 });
    await expect(guest.locator('.turn-dock')).toContainText(/HOSTPC.*TURN/i, { timeout: 15_000 });

    // Host takes 1st hit of the rematch
    console.log('--- Host taking Hit 1 of Rematch ---');
    await host.locator('canvas').focus();
    await host.locator('canvas').press('ArrowUp');
    await host.locator('canvas').press('Space');
    await expect(host.locator('.turn-dock')).toContainText('SHOT IN MOTION');
    console.log('--- Rematch hit successful! ---');
  } else {
    await expect(host.locator('.turn-dock')).not.toContainText('ROUND RESETTING', { timeout: 15_000 });
    await host.waitForTimeout(500);
    const hostTurn = (await host.locator('.turn-dock').textContent())?.includes('YOUR TURN');
    const p4 = hostTurn ? host : guest;
    const k4 = hostTurn ? 'ArrowUp' : 'ArrowDown';
    console.log(`--- Taking Turn 4 with ${hostTurn ? 'Host' : 'Guest'} ---`);
    await expect(p4.locator('.turn-dock')).toContainText('YOUR TURN', { timeout: 15_000 });
    await p4.locator('canvas').focus();
    await p4.locator('canvas').press(k4);
    await p4.locator('canvas').press('Space');
    await expect(p4.locator('.turn-dock')).toContainText('SHOT IN MOTION');
  }

  console.log('--- Online multiplayer hit test complete! ---');
  await hostContext.close();
  await guestContext.close();
});
