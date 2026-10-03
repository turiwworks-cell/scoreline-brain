import { existsSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';

/*
 * Part 18, done when: the dev panel's triggers play both scenes and the toast. Run with
 * `npx playwright test -c playwright.moments.config.ts` (dev server: the panel is dev-only).
 *
 * The demo follows Argentina's 10, who plays in the featured match (France – Argentina), so a
 * goal there is a scene even from the list. The toast cases follow nobody and open another match.
 */

const errors: string[] = [];
const hasSignedMoments = existsSync('public/rive/moments.riv');

test.beforeEach(async ({ page }) => {
  errors.length = 0;
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
});

test.afterEach(async ({ page }) => {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});

/** Opens the app, holds the simulation (so only our triggers score) and returns the trigger. */
async function open(page: Page, path: string, follow?: 'none') {
  if (follow) await page.addInitScript((v) => localStorage.setItem('scoreline:follow', v), follow);
  await page.goto(path);
  await expect(page.getByTestId('app-shell')).toBeVisible();
  const toggle = page.locator('#dev-panel-root button[aria-expanded]');
  await toggle.click();
  await page.getByRole('button', { name: 'Pause' }).click();
  await toggle.click();
  return (name: string) =>
    page.evaluate((n) => {
      const b = [...document.querySelectorAll<HTMLButtonElement>('#dev-panel-root button')].find((x) => x.textContent === n);
      b?.click();
    }, name);
}

const layout = (page: Page) => page.getByTestId('app-shell').getAttribute('data-layout');

test('goalHome plays the goal scene; a first tap shows it all, the next closes it', async ({ page }) => {
  const fire = await open(page, '/?demo');
  await fire('goalHome');
  const scene = page.getByTestId('moment-scene');
  await expect(scene).toBeVisible();
  await expect(scene).toHaveAttribute('data-variant', 'goal');
  // phone: over the whole screen; panes: inside the match pane
  const box = (await scene.boundingBox())!;
  if ((await layout(page)) === 'phone') expect(box).toMatchObject({ x: 0, y: 0, width: 390, height: 844 });
  else await expect(page.locator('[data-pane="match"] [data-testid="moment-scene"]')).toBeVisible();
  // the story lands: scorer, minute, commentary
  await expect(scene.getByText('Commentary')).toBeVisible({ timeout: 6000 });
  if (hasSignedMoments) await expect(scene.locator('canvas')).toBeVisible();
  await page.screenshot({ path: `test-results/moments-goal-${box.width}.png` });
  await scene.click({ position: { x: 40, y: box.height / 2 } });
  await scene.click({ position: { x: 40, y: box.height / 2 } });
  await expect(scene).toHaveCount(0, { timeout: 2000 });
});

test('redHome plays the red card scene; Escape closes it', async ({ page }) => {
  const fire = await open(page, '/?demo');
  await fire('redHome');
  const scene = page.getByTestId('moment-scene');
  await expect(scene).toHaveAttribute('data-variant', 'red');
  await expect(scene.getByText(/^Down to ten · /)).toBeVisible({ timeout: 6000 });
  await expect(scene.getByText('Sent off', { exact: true })).toBeVisible();
  if (hasSignedMoments) await expect(scene.locator('canvas')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(scene).toHaveCount(0, { timeout: 2000 });
});

test('a goal in another match is a toast; a tap opens that match', async ({ page }) => {
  const fire = await open(page, '/match/2/facts?demo', 'none');
  await fire('goalHome');
  const toast = page.getByTestId('moment-toast');
  await expect(toast).toBeVisible();
  // desktop: the third pane; tablet: the match pane; phone: the top of the screen
  const where = await layout(page);
  if (where === 'three') await expect(page.locator('[data-pane="insights"] [data-testid="moment-toast"]')).toBeVisible();
  if (where === 'two') await expect(page.locator('[data-pane="match"] [data-testid="moment-toast"]')).toBeVisible();
  await expect(page.getByTestId('moment-scene')).toHaveCount(0);
  // the player rises in and his name takes the team's place
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `test-results/moments-toast-${where}.png` });
  await toast.getByRole('button', { name: /Open match/ }).click();
  await expect(page).toHaveURL(/\/match\/1\//);
  await expect(toast).toHaveCount(0, { timeout: 2000 });
});

test('a swipe up sends the toast away without opening the match', async ({ page }) => {
  const fire = await open(page, '/match/2/facts?demo', 'none');
  await fire('goalAway');
  const toast = page.getByTestId('moment-toast');
  await expect(toast).toBeVisible();
  await page.waitForTimeout(800);
  const b = (await toast.boundingBox())!;
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2 - 20, { steps: 4 });
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2 - 60, { steps: 4 });
  await page.mouse.up();
  await expect(toast).toHaveCount(0, { timeout: 2000 });
  await expect(page).toHaveURL(/\/match\/2\//);
});

test('the toast leaves on its own after its hold', async ({ page }) => {
  const fire = await open(page, '/match/2/facts?demo', 'none');
  await fire('redAway');
  const toast = page.getByTestId('moment-toast');
  await expect(toast).toHaveAttribute('data-variant', 'red');
  // entrance 0.6 s + toastHold 4.5 s, then 0.4 s out
  await expect(toast).toHaveCount(0, { timeout: 8000 });
});

