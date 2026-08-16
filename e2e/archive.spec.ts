import { expect, test } from '@playwright/test';

const passphrase = process.env.E2E_PASSPHRASE;

test.skip(!passphrase, 'Lokální E2E test vyžaduje E2E_PASSPHRASE; fráze nesmí být v repozitáři.');

test('unlocks and opens the main experience', async ({ page }, testInfo) => {
  await page.goto('./');
  await page.getByLabel('Rodinná přístupová fráze').fill(passphrase!);
  await page.getByRole('button', { name: 'Odemknout kroniku' }).click();
  if (testInfo.project.name === 'mobile') {
    await expect(page.getByRole('main', { name: 'Rodinná timeline' })).toBeVisible();
    await expect(page.locator('.feed-card')).toHaveCount(50);
    await page.mouse.wheel(0, 900);
    await expect(page.locator('.feed-card').nth(1)).toBeVisible();
    return;
  }
  await expect(page.getByText('Čas běží.')).toBeVisible();
  await page.locator('.story-card').first().click();
  const firstHeading = await page.locator('.chapter h1').first().textContent();
  await expect(page.locator('.chapter h1').first()).toBeVisible();
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('.chapter h1').nth(1)).toBeVisible();
  expect(await page.locator('.chapter h1').nth(1).textContent()).not.toBe(firstHeading);
});

test('rejects a wrong phrase', async ({ page }) => {
  await page.goto('./');
  await page.getByLabel('Rodinná přístupová fráze').fill('chybna zkusebni rodinna pristupova fraze');
  await page.getByRole('button', { name: 'Odemknout kroniku' }).click();
  await expect(page.getByRole('alert')).toContainText('Nesprávná');
});

test('supports TV controls', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'tv');
  await page.goto('./');
  await page.getByLabel('Rodinná přístupová fráze').fill(passphrase!);
  await page.getByRole('button', { name: 'Odemknout kroniku' }).click();
  await page.locator('.story-card').first().click();
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('.chapter h1').nth(1)).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByText('Čas běží.')).toBeVisible();
});

test('decrypts a chapter gallery', async ({ page }) => {
  await page.goto('./');
  await page.getByLabel('Rodinná přístupová fráze').fill(passphrase!);
  await page.getByRole('button', { name: 'Odemknout kroniku' }).click();
  if (page.viewportSize()?.width && page.viewportSize()!.width <= 760) {
    await expect(page.locator('.feed-photo')).toHaveCount(24);
    await expect(page.locator('.feed-quote')).toHaveCount(14);
    await expect(page.locator('.feed-fact')).toHaveCount(3);
    await expect(page.locator('.feed-source')).toHaveCount(6);
    return;
  }
  await page.locator('.story-card').first().click();
  await page.keyboard.press('ArrowRight');
  await page.getByRole('button', { name: 'Otevřít galerii, 4 fotografií' }).click();
  await expect(page.getByRole('region', { name: 'Galerie kapitoly, 4 fotografií' })).toBeVisible();
  await expect(page.locator('.chapter-gallery img')).toHaveCount(4);
});
