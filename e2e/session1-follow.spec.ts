import { expect, test, type Page } from '@playwright/test';

const list = (page: Page) => page.locator('[data-screen="list"][data-present="true"]');
const card = (page: Page) => list(page).locator('[data-phase]');

test('a stored goalkeeper starts with Saves and live activity, including after reload', async ({ page }) => {
  await page.addInitScript(() => {
    if (localStorage.getItem('scoreline:follow') === null) {
      localStorage.setItem('scoreline:follow', JSON.stringify({ team: 'fra', n: 16 }));
    }
  });
  await page.goto('/?demo=fast');
  for (const reload of [false, true]) {
    if (reload) await page.reload();
    await expect(list(page).getByRole('button', { name: /^Mike Maignan, the player you follow/ })).toBeVisible();
    await expect(card(page).getByText('Saves', { exact: true })).toBeVisible();
    await expect(card(page).getByText('Shots', { exact: true })).toHaveCount(0);
    await expect.poll(() => card(page).locator('[data-row]').count()).toBeGreaterThan(0);
  }
  await list(page).getByRole('button', { name: /^Mike Maignan, the player you follow/ }).click();
  const player = page.locator('[data-screen="player"][data-present="true"]');
  await expect(player.getByRole('heading', { name: 'Mike Maignan' })).toBeVisible();
  await expect(player.locator('[data-pv="stat"]').filter({ hasText: 'Saves' })).toBeVisible();
  await expect(player.locator('[data-pv="stat"]').filter({ hasText: 'Shots' })).toHaveCount(0);
});

test('changing Follow starts the new player activity and keeps Unfollow across reload', async ({ page }) => {
  await page.goto('/?demo=fast');
  await expect(list(page).getByRole('button', { name: /^Lionel Messi, the player you follow/ })).toBeVisible();
  await expect.poll(() => card(page).locator('[data-row]').count()).toBeGreaterThan(0);
  await list(page).getByRole('button', { name: 'Change', exact: true }).click();
  await list(page).getByRole('button', { name: /Kylian Mbappé|Mbappé/ }).click();
  await expect(list(page).getByRole('button', { name: /^Kylian Mbappé, the player you follow/ })).toBeVisible();
  await expect(card(page).getByText('Shots', { exact: true })).toBeVisible();
  await expect.poll(() => card(page).locator('[data-row]').count()).toBeGreaterThan(0);
  await list(page).getByRole('button', { name: 'Change', exact: true }).click();
  await list(page).getByRole('button', { name: 'Unfollow', exact: true }).click();
  await expect(card(page)).toHaveCount(0);
  await page.reload();
  await expect(list(page).getByRole('heading', { name: 'Follow a player' })).toBeVisible();
  await expect(card(page)).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem('scoreline:follow'))).toBe('none');
});
