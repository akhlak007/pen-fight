import { expect, test } from '@playwright/test';

test('mobile touch aiming visual verification', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/?mode=quick');
  await page.getByLabel('Your name').fill('MobileAce');
  await page.getByRole('button', { name: /Claim my desk/ }).click();
  await page.getByRole('button', { name: 'INSTANT' }).click();
  await page.getByRole('button', { name: /Quick Match/ }).click();
  await page.waitForTimeout(600);

  // Aiming gesture on mobile
  await page.mouse.move(127, 550);
  await page.mouse.down();
  await page.mouse.move(127, 650, { steps: 5 });
  await page.waitForTimeout(200);

  // Verify flick power meter is active
  await expect(page.getByLabel('Flick power')).not.toHaveAttribute('aria-valuenow', '0');

  // Screenshot while aiming
  await page.screenshot({ path: 'C:/Users/HP/.gemini/antigravity-ide/brain/d91d58fd-284a-4ad7-a72d-7728624f2dc7/mobile_aim_active.png' });

  // Release flick
  await page.mouse.up();
  await page.waitForTimeout(400);

  // Verify shot in motion
  await expect(page.getByLabel('Turn status')).toContainText('SHOT IN MOTION');
  await page.screenshot({ path: 'C:/Users/HP/.gemini/antigravity-ide/brain/d91d58fd-284a-4ad7-a72d-7728624f2dc7/mobile_flick_motion.png' });
});
