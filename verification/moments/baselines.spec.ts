import { expect, test, type Page } from '@playwright/test';
import { baselines } from '../../e2e/support/baseline';

/*
 * Issue #10: the toast's and the goal scene's lines sit on the Lua's baselines, within 1.1 px
 * (the browser's whole-pixel font metrics; e2e/support/baseline.ts has the method).
 */

const TOL = 1.1;

async function open(page: Page, path: string, follow?: 'none') {
  if (follow) await page.addInitScript((v) => localStorage.setItem('scoreline:follow', v), follow);
  await page.goto(path);
  await expect(page.getByTestId('app-shell')).toBeVisible();
  const toggle = page.locator('#dev-panel-root button[aria-expanded]');
  await toggle.click();
  await page.getByRole('button', { name: 'Pause' }).click();
  await toggle.click();
  return (name: string) => page.evaluate((n) => [...document.querySelectorAll<HTMLButtonElement>('#dev-panel-root button')].find((x) => x.textContent === n)?.click(), name);
}

function within(rows: Array<Record<string, number | null>>) {
  for (const [sel, d] of rows.flatMap((r) => Object.entries(r))) {
    expect(d, `${sel} not found`).not.toBeNull();
    expect(Math.abs(d!), `${sel}: ${d} px from the Lua's baseline`).toBeLessThanOrEqual(TOL);
  }
}

test('the goal scene: first name, last name and the line under them, from the floor', async ({ page }) => {
  const fire = await open(page, '/match/1/facts?demo');
  await fire('goalHome');
  await expect(page.getByTestId('moment-scene')).toBeVisible();
  await page.waitForTimeout(3500);
  // sceneStory, luau:6454-6458: FLOOR + 36, + 76, + 100 once the names have risen
  within(await baselines(page, '[data-testid="moment-scene"]', [['[class*="_first_"]', 36], ['[class*="_last_"]', 76], ['[class*="_meta_"]', 100]], { origin: '[class*="_floor_"]', rows: 1 }));
});

test('the toast: the label, the scorer, the score and the teams', async ({ page }) => {
  const fire = await open(page, '/match/2/facts?demo', 'none');
  await fire('goalHome');
  await expect(page.getByTestId('moment-toast')).toBeVisible();
  await page.waitForTimeout(2500);
  // drawToast, luau:6260-6279: y + 25, y + 48 (the scorer, after the swap), y + 29.5, y + 51
  const rows = await page.evaluate(() => document.querySelectorAll('[data-testid="moment-toast"] [class*="_toastName_"]').length);
  expect(rows).toBeGreaterThan(0);
  within(
    await baselines(page, '[data-testid="moment-toast"]', [['[class*="_toastLabel_"]', 25], ['[class*="_toastName_"]:last-of-type', 48], ['[class*="_toastScoreNum_"]', 29.5], ['[class*="_toastShorts_"]', 51]], {
      origin: '[class*="_toast_"]',
      rows: 1,
    }),
  );
});
