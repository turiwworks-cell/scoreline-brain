import { expect, test } from '@playwright/test';

test('the site opens on the demo matchday, not on an empty list', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('app-shell')).toBeVisible();
  await expect(page).toHaveTitle('Scoreline');
  await expect(page.getByRole('button', { name: /France .* Argentina/ }).first()).toBeVisible();
  await expect(page.getByText('No matches yet.')).toHaveCount(0);
});

test('?demo=off is the page with no source', async ({ page }) => {
  await page.goto('/?demo=off');
  await expect(page.getByText('No matches yet.')).toBeVisible();
});
