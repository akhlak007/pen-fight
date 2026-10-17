import { expect, test, type Page } from '@playwright/test';

const viewports = [
  { name: 'small phone portrait', width: 320, height: 568 },
  { name: 'compact phone', width: 320, height: 480 },
  { name: 'phone portrait', width: 390, height: 844 },
  { name: 'phone landscape', width: 844, height: 390 },
  { name: 'tablet portrait', width: 768, height: 1024 },
  { name: 'desktop', width: 1440, height: 900 },
] as const;

async function expectNoPageOverflow(page: Page) {
  const overflow = await page.evaluate(() => ({
    horizontal: document.documentElement.scrollWidth - window.innerWidth,
    vertical: document.documentElement.scrollHeight - window.innerHeight,
  }));
  expect(overflow.horizontal).toBeLessThanOrEqual(1);
  expect(overflow.vertical).toBeLessThanOrEqual(1);
}

async function expectInsideViewport(page: Page, selector: string) {
  const box = await page.locator(selector).boundingBox();
  const viewport = page.viewportSize();
  expect(box).not.toBeNull();
  expect(viewport).not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(-1);
  expect(box!.y).toBeGreaterThanOrEqual(-1);
  expect(box!.x + box!.width).toBeLessThanOrEqual(viewport!.width + 1);
  expect(box!.y + box!.height).toBeLessThanOrEqual(viewport!.height + 1);
}

async function expectHorizontallyInsideViewport(page: Page, selector: string) {
  const box = await page.locator(selector).boundingBox();
  const viewport = page.viewportSize();
  expect(box).not.toBeNull();
  expect(viewport).not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(-1);
  expect(box!.x + box!.width).toBeLessThanOrEqual(viewport!.width + 1);
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

for (const viewport of viewports) {
  test(`${viewport.name} keeps the home and match UI inside the screen`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await expectNoPageOverflow(page);
    await expectInsideViewport(page, '.notebook-home');
    await expectHorizontallyInsideViewport(page, '.notebook-spread');
    await expectInsideViewport(page, '#player-name');
    await page.getByRole('button', { name: 'Settings' }).click();
    await expectInsideViewport(page, '#desk-settings');
    await page.keyboard.press('Escape');

    await page.getByLabel('Your name').fill('Responsive Player');
    await page.getByRole('button', { name: /Claim my desk/ }).click();
    await page.getByRole('button', { name: 'INSTANT' }).click();
    await page.getByRole('button', { name: /Quick Match/ }).click();

    await expectNoPageOverflow(page);
    await expectInsideViewport(page, '.match-hud');
    await expectInsideViewport(page, '.match-footer');
    await expectInsideViewport(page, '.match-exit');
    await expectInsideViewport(page, '.power-dock');
    await expectInsideViewport(page, '.scoreboard');
  });
}

test('landscape phone respects simulated notch and home-indicator insets', async ({ page }) => {
  await page.setViewportSize({ width: 844, height: 390 });
  await page.evaluate(() => {
    document.documentElement.style.setProperty('--safe-left', '44px');
    document.documentElement.style.setProperty('--safe-right', '20px');
    document.documentElement.style.setProperty('--safe-bottom', '18px');
  });
  await page.getByLabel('Your name').fill('Safe Area Player');
  await page.getByRole('button', { name: /Claim my desk/ }).click();
  await page.getByRole('button', { name: 'INSTANT' }).click();
  const modeCard = await page.locator('.mode-card').boundingBox();
  expect(modeCard).not.toBeNull();
  expect(modeCard!.x).toBeGreaterThanOrEqual(44);
  expect(modeCard!.x + modeCard!.width).toBeLessThanOrEqual(844 - 20);
  await page.getByRole('button', { name: /Quick Match/ }).click();

  const exit = await page.locator('.match-exit').boundingBox();
  const footer = await page.locator('.match-footer').boundingBox();
  expect(exit).not.toBeNull();
  expect(footer).not.toBeNull();
  expect(exit!.x).toBeGreaterThanOrEqual(44);
  expect(footer!.x).toBeGreaterThanOrEqual(44);
  expect(footer!.x + footer!.width).toBeLessThanOrEqual(844 - 20);
  expect(footer!.y + footer!.height).toBeLessThanOrEqual(390 - 18);
});
