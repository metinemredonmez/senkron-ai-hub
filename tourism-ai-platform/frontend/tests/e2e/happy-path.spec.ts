import { test, expect } from '@playwright/test';

const baseUrl = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000';

test.describe('Health tourism happy path', () => {
  test('intake to itinerary flow', async ({ page }) => {
    await page.goto(`${baseUrl}/(auth)/login`);
    await page.fill('input[name="email"]', 'demo@tenant.com');
    await page.fill('input[name="password"]', 'password');
    await page.click('text=Continue');

    await page.waitForURL('**/dashboard');
    await expect(page.getByText('Dashboard')).toBeVisible();

    await page.click('text=Cases');
    await expect(page.getByText('Cases')).toBeVisible({ timeout: 2000 });

    await page.click('text=Quotes');
    await expect(page.getByText('Pricing indicative')).toBeVisible({ timeout: 2000 });

    await page.click('text=Ops Console');
    await expect(page.getByText('Approval tasks triggered')).toBeVisible({ timeout: 2000 });

    await page.click('text=Itinerary');
    await expect(page.getByText('Download PDF')).toBeVisible();
  });
});
