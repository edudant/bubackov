import { expect, test } from '@playwright/test';

const passphrase = process.env.E2E_PASSPHRASE;

test.skip(!passphrase, 'Lokální E2E test vyžaduje E2E_PASSPHRASE; fráze nesmí být v repozitáři.');

test('unlocks and opens a story', async ({ page }) => {
  await page.goto('./');
  await page.getByLabel('Rodinná přístupová fráze').fill(passphrase!);
  await page.getByRole('button', { name: 'Odemknout kroniku' }).click();
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
