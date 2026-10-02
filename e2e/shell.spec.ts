import { expect, test } from '@playwright/test';

test('empty app shell renders', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('app-shell')).toBeVisible();
  await expect(page).toHaveTitle('Scoreline');
});
