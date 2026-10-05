import { expect, test, type Page } from '@playwright/test';

const pane = (page: Page) => page.locator('[data-pane="insights"]');
const tabs = (page: Page) => pane(page).getByRole('tablist', { name: 'Insights' });
const content = (page: Page, tab: string) => pane(page).locator(`[data-insights="${tab}"]`);

async function settle(page: Page) {
  await expect
    .poll(() => page.evaluate(() => document.querySelectorAll('[data-present="false"]').length))
    .toBe(0);
}

test('insights is desktop-only; smaller layouts keep the existing player route', async ({ page }, info) => {
  const chunks: string[] = [];
  page.on('request', (req) => {
    if (/\/assets\/Insights-.*\.js$/.test(req.url())) chunks.push(req.url());
  });
  // The desktop preloads the Insights chunk once the page has painted (ThreePane), so whether that
  // request goes out before the checks below is a race. Held there, the player page must render
  // without it; on the smaller layouts it is never asked for.
  const desktop = info.project.name.startsWith('desktop');
  if (desktop) await page.route(/\/assets\/Insights-.*\.js$/, () => {});
  await page.goto('/player/fra/10?demo');
  await expect(page.getByRole('heading', { name: 'Kylian Mbappé', exact: true })).toBeVisible();
  if (desktop)
    await expect(tabs(page).getByRole('tab', { name: 'Player', exact: true })).toHaveAttribute('aria-selected', 'true');
  else {
    await expect(page.getByRole('tablist', { name: 'Insights' })).toHaveCount(0);
    await expect(pane(page)).toHaveCount(0);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);
  if (!desktop) expect(chunks).toEqual([]);
});

test.describe('desktop insights', () => {
  test.beforeEach(async ({ page }, info) => {
    test.skip(!info.project.name.startsWith('desktop'), 'Third pane is desktop-only.');
    await page.goto('/match/1/lineup?demo');
    await expect(page.getByRole('heading', { name: 'France – Argentina', exact: true })).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
  });

  test('the switch and default player prompt match the Lua geometry', async ({ page }) => {
    await expect(pane(page).getByRole('heading', { name: 'Pick a player.' })).toBeVisible();
    const [p, t] = await Promise.all([pane(page).boundingBox(), tabs(page).boundingBox()]);
    expect(p).not.toBeNull();
    expect(t).not.toBeNull();
    expect(t!.x - p!.x).toBeCloseTo(45, 0);
    expect(t!.y - p!.y).toBeCloseTo(12, 0);
    expect(t!.width).toBe(300);
    expect(t!.height).toBe(36);
    const history = await page.evaluate(() => window.history.length);
    await tabs(page).getByRole('tab', { name: 'Tables', exact: true }).click();
    await expect(content(page, 'tables').getByRole('heading', { name: 'Standings' })).toBeVisible();
    expect(await page.evaluate(() => window.history.length)).toBe(history);
    await expect(content(page, 'tables').locator('[data-league]').first()).toHaveCSS('opacity', '1');
    const body = await content(page, 'tables').locator('[class*="body"]').boundingBox();
    expect(body!.y - p!.y).toBeCloseTo(96, 0); // 10 px body padding puts the first heading at 106
    const heading = await content(page, 'tables').getByRole('heading', { level: 2 }).first().boundingBox();
    expect(heading!.y - p!.y).toBeCloseTo(106, 0);
  });

  test('tables put the open league first and highlight its two teams', async ({ page }) => {
    await tabs(page).getByRole('tab', { name: 'Tables', exact: true }).click();
    const leagues = content(page, 'tables').locator('[data-league]');
    await expect(leagues.first()).toHaveAttribute('data-league', 'wns');
    await expect(leagues.first().locator('[data-match-team]')).toHaveCount(2);
    await page.locator('[data-focus-key="match-3"]').click();
    await expect(page.getByRole('heading', { name: 'Germany – Netherlands', exact: true })).toBeVisible();
    await expect(leagues.first()).toHaveAttribute('data-league', 'nla');
    await expect(leagues.first().locator('[data-match-team]')).toHaveCount(2);
  });

  test('leaders use 64 px rows, goal rows use 52 px, and tabs reset only insight scroll', async ({ page }) => {
    await tabs(page).getByRole('tab', { name: 'Leaders', exact: true }).click();
    const c = content(page, 'leaders');
    const rows = c.locator('[data-insight-leader]');
    await expect(rows).toHaveCount(8);
    await expect(c.locator('[data-insight-goal]').first()).toBeVisible();
    await expect.poll(() => rows.first().evaluate((el) => getComputedStyle(el).opacity)).toBe('1');
    const [p, r, g] = await Promise.all([
      pane(page).boundingBox(),
      rows.first().boundingBox(),
      c.locator('[data-insight-goal]').first().boundingBox(),
    ]);
    expect(r!.x - p!.x).toBeCloseTo(12, 0);
    expect(r!.y - p!.y).toBeCloseTo(133.7, 0);
    expect(r!.width).toBe(366);
    expect(r!.height).toBe(64);
    expect(g!.height).toBe(52);
    const scroller = c.locator('xpath=ancestor::*[@data-scroller][1]');
    await scroller.evaluate((el) => el.scrollTo(0, 100));
    await expect.poll(() => scroller.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
    await expect.poll(() => c.evaluate((el) => getComputedStyle(el).getPropertyValue('--rule-alpha'))).toBe('1');
    await tabs(page).getByRole('tab', { name: 'Tables', exact: true }).click();
    await expect(content(page, 'tables').getByRole('heading', { name: 'Standings' })).toBeVisible();
    expect(
      await content(page, 'tables')
        .locator('xpath=ancestor::*[@data-scroller][1]')
        .evaluate((el) => el.scrollTop),
    ).toBe(0);
  });

  test('opening a leader opens the player in place, close returns to leaders with focus', async ({ page }) => {
    await page.evaluate(() => {
      const w = window as unknown as { __leaderFlight: string[]; __leaderSource: boolean };
      w.__leaderFlight = [];
      w.__leaderSource = false;
      new MutationObserver((ms) => {
        for (const m of ms)
          if (m.target instanceof HTMLElement && m.target.hasAttribute('data-shared-flying')) {
            w.__leaderFlight.push(`${m.target.dataset.shared}@${m.target.dataset.sharedEnd}`);
            if (m.target.dataset.sharedEnd === 'face' && m.target.closest('[data-insight-leader="fra:10"]')) w.__leaderSource = true;
          }
      }).observe(document, { subtree: true, attributes: true, attributeFilter: ['data-shared-flying'] });
    });
    await tabs(page).getByRole('tab', { name: 'Leaders', exact: true }).click();
    const row = content(page, 'leaders').locator('[data-insight-leader="fra:10"]');
    await expect(row).toBeVisible();
    await row.click();
    await expect(pane(page).getByRole('heading', { name: 'Kylian Mbappé', exact: true })).toBeVisible();
    await expect(tabs(page).getByRole('tab', { name: 'Player', exact: true })).toHaveAttribute('aria-selected', 'true');
    // nothing flies from the leader's face (review of 2026-10-04)
    expect(await page.evaluate(() => (window as unknown as { __leaderFlight: string[] }).__leaderFlight)).toEqual([]);
    expect(await page.evaluate(() => (window as unknown as { __leaderSource: boolean }).__leaderSource)).toBe(false);
    await settle(page);
    await pane(page).getByRole('button', { name: 'Close player', exact: true }).click();
    await expect(content(page, 'leaders')).toBeVisible();
    await settle(page);
    await expect(row).toBeFocused();
  });

  test('the player remains available across local tab switches and a lineup click selects Player', async ({ page }) => {
    await page.locator('[data-focus-key="chip-fra-10"]').click();
    await expect(pane(page).getByRole('heading', { name: 'Kylian Mbappé', exact: true })).toBeVisible();
    await settle(page);
    const playerScroll = pane(page).locator('[data-screen="player"][data-present="true"]');
    await playerScroll.evaluate((el) => el.scrollTo(0, 60));
    await expect.poll(() => playerScroll.evaluate((el) => el.scrollTop)).toBe(60);
    await tabs(page).getByRole('tab', { name: 'Tables', exact: true }).click();
    await expect(pane(page).getByRole('heading', { name: 'Kylian Mbappé', exact: true })).toBeHidden();
    const before = await page.evaluate(() => history.length);
    await page.locator('[data-focus-key="chip-fra-10"]').click();
    await expect(tabs(page).getByRole('tab', { name: 'Player', exact: true })).toHaveAttribute('aria-selected', 'true');
    expect(await page.evaluate(() => history.length)).toBe(before);
    await expect.poll(() => playerScroll.evaluate((el) => el.scrollTop)).toBe(60);
    await tabs(page).getByRole('tab', { name: 'Tables', exact: true }).click();
    await tabs(page).getByRole('tab', { name: 'Player', exact: true }).click();
    await expect(pane(page).getByRole('heading', { name: 'Kylian Mbappé', exact: true })).toBeVisible();
    await tabs(page).getByRole('tab', { name: 'Leaders', exact: true }).click();
    await page.locator('[data-focus-key="chip-fra-11"]').click();
    await expect(pane(page).getByRole('heading', { name: 'Michael Olise', exact: true })).toBeVisible();
    await expect(tabs(page).getByRole('tab', { name: 'Player', exact: true })).toHaveAttribute('aria-selected', 'true');
  });

  test('a goal opens its own match and keyboard tabs and reduced motion work', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const player = tabs(page).getByRole('tab', { name: 'Player', exact: true });
    await player.focus();
    await page.keyboard.press('End');
    await expect(tabs(page).getByRole('tab', { name: 'Leaders', exact: true })).toBeFocused();
    const c = content(page, 'leaders');
    await expect(c.locator('[data-insight-leader]').first()).toHaveCSS('transform', 'none');
    const goal = c.locator('[data-insight-goal]').first();
    await expect(goal).toBeVisible();
    const id = (await goal.getAttribute('data-insight-goal'))!.split(':')[0];
    await goal.click();
    await expect(page).toHaveURL(new RegExp(`/match/${id}/facts\\?demo$`));
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);
  });
});
