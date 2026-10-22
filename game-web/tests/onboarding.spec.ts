import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

test('saves the player name and opens the classroom menu', async ({ page }) => {
  await expect(page.getByRole('heading', { name: 'Welcome to Pen Fight' })).toBeVisible();
  await expect(page.getByText('Your next fight')).toBeVisible();
  await expect(page.getByText('Play another way')).toBeVisible();
  const nameInput = page.getByLabel('Your name');
  await nameInput.focus();
  await expect(nameInput).toBeFocused();
  expect(await nameInput.evaluate((element) => getComputedStyle(element).outlineStyle)).not.toBe('none');
  await nameInput.fill('  Nila  ');
  await page.getByRole('button', { name: /Claim my desk/ }).click();
  await expect(page.getByRole('button', { name: 'INSTANT' })).toBeVisible();
  await expect(page.getByLabel('Your name')).toHaveValue('Nila');
  await expect(page.getByText('NILA', { exact: true })).toBeVisible();

  const settingsButton = page.getByRole('button', { name: 'Settings' });
  await settingsButton.click();
  await expect(settingsButton).toHaveAttribute('aria-expanded', 'true');
  await page.keyboard.press('Escape');
  await expect(settingsButton).toHaveAttribute('aria-expanded', 'false');

  await page.getByLabel('Your name').fill('Mahi');
  await settingsButton.click();
  await page.getByLabel('Calm camera').check();
  await expect(page.getByLabel('Your name')).toHaveValue('Mahi');
  await page.getByRole('button', { name: 'UPDATE' }).click();
  await expect(page.getByText('MAHI', { exact: true })).toBeVisible();

  await page.reload();
  await expect(page.getByRole('button', { name: 'INSTANT' })).toBeVisible();
  await expect(page.getByLabel('Your name')).toHaveValue('Mahi');
});

test('notebook home stacks cleanly on a narrow screen', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole('heading', { name: 'Welcome to Pen Fight' })).toBeVisible();
  await expect(page.getByText('Play another way')).toBeVisible();
  const hasHorizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  expect(hasHorizontalOverflow).toBe(false);
});

test('shows the developer portfolio credit in the notebook footer', async ({ page }) => {
  await page.getByLabel('Your name').fill('Rafi');
  await page.getByRole('button', { name: /Claim my desk/ }).click();

  const developer = page.getByRole('link', { name: 'Developer Akhlak' });
  await expect(developer).toBeVisible();
  await expect(developer).toHaveAttribute('href', 'https://md-akhlak-ud-jaman.web.app/');
  await expect(developer).toHaveAttribute('target', '_blank');
  await expect(developer).toHaveAttribute('rel', /noopener/);
  await expect(page.getByText(/rinks___g|littleplaycode/)).not.toBeVisible();
});

test('completed profile and online features are visible from the home screen', async ({ page }) => {
  await page.getByLabel('Your name').fill('Rafi');
  await page.getByRole('button', { name: /Claim my desk/ }).click();

  const passport = page.getByRole('button', { name: 'Open your Player Passport' });
  await expect(passport).toBeVisible();
  await expect(passport).toContainText('PLAYER PASSPORT');
  await expect(passport).toContainText('LEVEL 1 OF 99');
  await expect(passport).toContainText('1/9');
  await expect(passport).toContainText('PENS');
  await expect(passport).toContainText('1/3');
  await expect(passport).toContainText('DESKS');
  await expect(passport).toContainText('OPEN PROFILE');

  const online = page.getByRole('button', { name: /PLAY A FRIEND ONLINE/ });
  await expect(online).toBeVisible();
  await expect(online).toContainText('INVITE LINK');
  await expect(online).toContainText('ROOM CODE');
  await expect(online).toContainText('BEST OF 3');
  await expect(online).toContainText('REMATCH');
  await expect(page.getByLabel('Pen physics feature')).toContainText('stay separate');

  await online.click();
  await expect(page.getByLabel('Match features')).toContainText('BEST OF 3');
  await expect(page.getByRole('textbox', { name: 'Room code' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Create invite link/ })).toBeVisible();
});

test('visible feature cards fit on a narrow phone', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await page.getByLabel('Your name').fill('Rafi');
  await page.getByRole('button', { name: /Claim my desk/ }).click();
  await expect(page.getByRole('button', { name: 'Open your Player Passport' })).toBeVisible();
  await page.getByText('PLAY ANOTHER WAY').scrollIntoViewIfNeeded();
  await expect(page.getByRole('button', { name: /PLAY A FRIEND ONLINE/ })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
});

test('rejects a blank name and supports mode selection', async ({ page }) => {
  await page.getByRole('button', { name: /Claim my desk/ }).click();
  await expect(page.getByRole('alert')).toHaveText('Write a name before the bell rings.');
  await page.getByLabel('Your name').fill('Rafi');
  await page.getByRole('button', { name: /Claim my desk/ }).click();
  await page.getByRole('button', { name: 'INSTANT' }).click();
  await expect(page.getByRole('heading', { name: 'School rules?' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Quick Match/ })).toBeVisible();
  await page.getByRole('button', { name: /Quick Match/ }).click();
  await expect(page.getByLabel('Turn status')).toContainText(/your turn/i);
  await expect(page.getByLabel('Match score')).toContainText('Rafi');
  await expect(page.getByLabel('Flick power')).toBeVisible();
  await page.getByRole('button', { name: 'Leave match' }).click();
  await expect(page.getByRole('button', { name: 'INSTANT' })).toBeVisible();
});

test('starts a same-device friend match with both player names', async ({ page }) => {
  await page.getByLabel('Your name').fill('Rafi');
  await page.getByRole('button', { name: /Claim my desk/ }).click();
  await page.getByRole('button', { name: /SAME-DEVICE LOCAL/ }).click();

  await expect(page.getByRole('heading', { name: 'Choose your rival' })).toBeVisible();
  await expect(page.getByText('Rafi', { exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: /SAME-DEVICE LOCAL/ })).toBeVisible();
  await page.getByRole('button', { name: /SAME-DEVICE LOCAL/ }).click();
  await expect(page.getByRole('heading', { name: 'Choose your rival' })).toBeVisible();
  const rivalInput = page.getByLabel('Player 2 name');
  await rivalInput.focus();
  await expect(rivalInput).toBeFocused();
  expect(await rivalInput.evaluate((element) => getComputedStyle(element).outlineStyle)).not.toBe('none');
  await page.getByRole('button', { name: /Start local match/ }).click();
  await expect(page.getByRole('alert')).toHaveText('Write Player 2’s name before starting.');

  await rivalInput.fill('Priya');
  await page.getByRole('button', { name: /Start local match/ }).click();
  await expect(page.getByLabel('Match score')).toContainText('PLAYER 1');
  await expect(page.getByLabel('Match score')).toContainText('PLAYER 2');
  await expect(page.getByLabel('Match score')).toContainText('Rafi');
  await expect(page.getByLabel('Match score')).toContainText('Priya');
  await expect(page.getByLabel('Turn status')).toContainText(/Rafi.*turn/i);
});

test('local match hands control from the blue pen to the red pen and back', async ({ page }) => {
  await page.getByLabel('Your name').fill('Rafi');
  await page.getByRole('button', { name: /Claim my desk/ }).click();
  await page.getByRole('button', { name: /SAME-DEVICE LOCAL/ }).click();
  await page.getByLabel('Player 2 name').fill('Priya');
  await page.getByRole('button', { name: /Start local match/ }).click();

  const arena = page.getByLabel(/3D classroom arena/);
  await arena.focus();
  await arena.press('ArrowUp');
  await arena.press('Space');
  await expect(page.getByLabel('Turn status')).toContainText('SHOT IN MOTION');
  await expect(page.getByLabel('Turn status')).toContainText(/Priya.*turn/i, { timeout: 6000 });

  await arena.press('ArrowUp');
  await arena.press('Space');
  await expect(page.getByLabel('Turn status')).toContainText('SHOT IN MOTION');
  await expect(page.getByLabel('Turn status')).toContainText(/Rafi.*turn/i, { timeout: 6000 });
});

test('supports 4 players in same-device local match', async ({ page }) => {
  await page.getByLabel('Your name').fill('Rafi');
  await page.getByRole('button', { name: /Claim my desk/ }).click();
  await page.getByRole('button', { name: /SAME-DEVICE LOCAL/ }).click();

  await page.getByRole('button', { name: '4 Players' }).click();
  await page.getByLabel('Player 2 name').fill('Priya');
  await page.getByLabel('Player 3 name').fill('Dev');
  await page.getByLabel('Player 4 name').fill('Sam');
  await page.getByRole('button', { name: /Start local match/ }).click();

  const scoreboard = page.getByLabel('Match score');
  await expect(scoreboard).toContainText('Rafi');
  await expect(scoreboard).toContainText('Priya');
  await expect(scoreboard).toContainText('Dev');
  await expect(scoreboard).toContainText('Sam');
  await expect(page.getByLabel('Turn status')).toContainText(/Rafi.*turn/i);

  const arena = page.getByLabel(/3D classroom arena/);
  await arena.focus();
  await arena.press('ArrowUp');
  await arena.press('Space');
  await expect(page.getByLabel('Turn status')).toContainText(/Priya.*turn/i, { timeout: 6000 });

  await arena.press('ArrowUp');
  await arena.press('Space');
  await expect(page.getByLabel('Turn status')).toContainText(/Dev.*turn/i, { timeout: 6000 });

  await arena.press('ArrowUp');
  await arena.press('Space');
  await expect(page.getByLabel('Turn status')).toContainText(/Sam.*turn/i, { timeout: 6000 });
});

test('pulling the selected pen charges and releases a flick', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.getByLabel('Your name').fill('Rafi');
  await page.getByRole('button', { name: /Claim my desk/ }).click();
  await page.getByRole('button', { name: 'INSTANT' }).click();
  await page.getByRole('button', { name: /Quick Match/ }).click();

  await page.mouse.move(595, 688);
  await page.mouse.down();
  await page.mouse.move(655, 778, { steps: 6 });
  await expect(page.getByLabel('Flick power')).not.toHaveAttribute('aria-valuenow', '0');
  await page.mouse.up();

  await expect(page.getByLabel('Flick power')).toHaveAttribute('aria-valuenow', '0');
  await expect(page.getByLabel('Turn status')).toContainText('SHOT IN MOTION');
});

test('the enlarged pickup area accepts a near-pen touch', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.getByLabel('Your name').fill('Rafi');
  await page.getByRole('button', { name: /Claim my desk/ }).click();
  await page.getByRole('button', { name: 'INSTANT' }).click();
  await page.getByRole('button', { name: /Quick Match/ }).click();

  await page.mouse.move(619, 706);
  await page.mouse.down();
  await page.mouse.move(559, 796, { steps: 6 });
  await expect(page.getByLabel('Flick power')).not.toHaveAttribute('aria-valuenow', '0');
  await page.mouse.up();
});

test('tabletop aiming works at a landscape phone size', async ({ page }) => {
  await page.setViewportSize({ width: 844, height: 390 });
  await page.getByLabel('Your name').fill('Rafi');
  await page.getByRole('button', { name: /Claim my desk/ }).click();
  await page.getByRole('button', { name: 'INSTANT' }).click();
  await page.getByRole('button', { name: /Quick Match/ }).click();

  await page.mouse.move(370, 290);
  await page.mouse.down();
  await page.mouse.move(330, 350, { steps: 6 });
  await expect(page.getByLabel('Flick power')).not.toHaveAttribute('aria-valuenow', '0');
  await page.mouse.up();
  await expect(page.getByLabel('Turn status')).toContainText('SHOT IN MOTION');
});

test('keyboard controls charge and release the selected pen', async ({ page }) => {
  await page.getByLabel('Your name').fill('Rafi');
  await page.getByRole('button', { name: /Claim my desk/ }).click();
  await page.getByRole('button', { name: 'INSTANT' }).click();
  await page.getByRole('button', { name: /Quick Match/ }).click();

  const arena = page.getByLabel(/3D classroom arena/);
  await arena.focus();
  await arena.press('ArrowUp');
  await expect(page.getByLabel('Flick power')).not.toHaveAttribute('aria-valuenow', '0');
  await arena.press('Space');
  await expect(page.getByLabel('Flick power')).toHaveAttribute('aria-valuenow', '0');
  await arena.press('ArrowLeft');
  await expect(page.getByLabel('Flick power')).toHaveAttribute('aria-valuenow', '0');
  await arena.press('Space');
  await expect(page.getByLabel('Turn status')).toContainText(/rival (is lining up|shot in motion)/i, { timeout: 5000 });
  await expect(page.getByLabel('Turn status')).toContainText('YOUR TURN', { timeout: 6000 });
});

function boxesOverlap(
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number },
): boolean {
  return !(a.x + a.width <= b.x || b.x + b.width <= a.x || a.y + a.height <= b.y || b.y + b.height <= a.y);
}

test('desktop match score console stays below the blackboard', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.getByLabel('Your name').fill('Rafi');
  await page.getByRole('button', { name: /Claim my desk/ }).click();
  await page.getByRole('button', { name: 'INSTANT' }).click();
  await page.getByRole('button', { name: /Quick Match/ }).click();

  const score = await page.getByLabel('Match score').boundingBox();
  const exit = await page.getByRole('button', { name: 'Leave match' }).boundingBox();
  expect(score).not.toBeNull();
  expect(exit).not.toBeNull();
  expect(score!.y).toBeGreaterThan(900 * 0.6);
  expect(exit!.y).toBeLessThan(80);
});

test('narrow match HUD keeps power and score console from overlapping', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await page.getByLabel('Your name').fill('Rafi');
  await page.getByRole('button', { name: /Claim my desk/ }).click();
  await page.getByRole('button', { name: 'INSTANT' }).click();
  await page.getByRole('button', { name: /Quick Match/ }).click();

  const power = await page.getByLabel('Flick power').boundingBox();
  const score = await page.getByLabel('Match score').boundingBox();
  expect(power).not.toBeNull();
  expect(score).not.toBeNull();
  expect(boxesOverlap(power!, score!)).toBe(false);
  expect(power!.y + power!.height).toBeLessThanOrEqual(score!.y);
});

test('visibility pause reports a locked match and resumes cleanly', async ({ page }) => {
  await page.getByLabel('Your name').fill('Rafi');
  await page.getByRole('button', { name: /Claim my desk/ }).click();
  await page.getByRole('button', { name: 'INSTANT' }).click();
  await page.getByRole('button', { name: /Quick Match/ }).click();

  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect(page.getByLabel('Turn status')).toContainText('MATCH PAUSED');
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: false });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect(page.getByLabel('Turn status')).toContainText('YOUR TURN');
});

test('user can mute and unmute background sound in home and match HUD', async ({ page }) => {
  await page.getByLabel('Your name').fill('Rafi');
  await page.getByRole('button', { name: /Claim my desk/ }).click();

  // On Home screen: verify audio toggle button exists and can be clicked to mute
  const homeSoundBtn = page.getByRole('button', { name: /Mute sound/i });
  await expect(homeSoundBtn).toBeVisible();
  await homeSoundBtn.click();
  await expect(page.getByRole('button', { name: /Unmute sound/i })).toBeVisible();

  // Enter match and verify match audio toggle reflects muted state
  await page.getByRole('button', { name: 'INSTANT' }).click();
  await page.getByRole('button', { name: /Quick Match/ }).click();
  const matchSoundBtn = page.getByRole('button', { name: /Unmute sound/i });
  await expect(matchSoundBtn).toBeVisible();
  await expect(matchSoundBtn).toContainText('MUTED');

  // Click to unmute during match
  await matchSoundBtn.click();
  await expect(page.getByRole('button', { name: /Mute sound/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /Mute sound/i })).toContainText('SOUND ON');
});
