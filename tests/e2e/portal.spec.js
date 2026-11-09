const { test, expect } = require('@playwright/test');

test('registers, logs in, seeds and displays dashboard data', async ({ page }) => {
  const username = `e2e_${Date.now()}`;
  await page.goto('/register.html');
  await page.getByLabel('Username').fill(username);
  await page.getByLabel('Full name').fill('E2E Customer');
  await page.getByLabel('Email').fill(`${username}@example.com`);
  await page.getByLabel('Password', { exact: true }).fill('Password1');
  await page.getByLabel('Confirm password').fill('Password1');
  await page.getByRole('button', { name: 'Register' }).click();
  await expect(page).toHaveURL(/login\.html/);
  await page.getByLabel('Username').fill(username);
  await page.getByLabel('Password', { exact: true }).fill('Password1');
  await page.getByRole('button', { name: 'Submit' }).click();
  await expect(page).toHaveURL(/dashboard\.html/);
  await expect(page.getByText('Welcome, E2E Customer')).toBeVisible();
  await page.getByRole('button', { name: 'Load sample data' }).click();
  await expect(page.locator('tbody tr')).toHaveCount(20);
  await expect(page.locator('.account-balance')).toBeVisible();
});

test('redirects logged-out users from the dashboard', async ({ page }) => {
  await page.goto('/dashboard.html');
  await expect(page).toHaveURL(/login\.html/);
});
