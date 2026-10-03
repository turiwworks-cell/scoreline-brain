import { expect, test, type Locator, type Page } from '@playwright/test';

/*
 * Part 11: the match screen at 390 (phone), in the match pane at 900 and 1280. Every number is
 * the Lua's at 390, relative to the match screen's own top-left corner (x from the nearer edge),
 * so the same numbers hold at every width. The demo feed (?demo) supplies the data: match 1 is
 * France – Argentina in play, 8 Sweden – Denmark finished, 9 Spain – Portugal a friendly, 11
 * Italy – Japan before kick-off. A screenshot of each tab goes to test-results/.
 */

const screen = (page: Page) => page.locator('[data-screen="match"][data-present="true"]');
const panel = (page: Page) => screen(page).getByRole('tabpanel');
const eventRows = (page: Page) => screen(page).locator('[data-row="e"]');

/** `el`'s box relative to the match screen: x and y from its top-left, `r` from its right edge. */
async function box(page: Page, el: Locator) {
  const [p, b] = await Promise.all([screen(page).boundingBox(), el.boundingBox()]);
  if (!p || !b) throw new Error('not on screen');
  return { x: b.x - p.x, y: b.y - p.y, w: b.width, h: b.height, r: p.x + p.width - (b.x + b.width) };
}

/** Within `tol` px, per number. */
function near(actual: Record<string, number>, want: Record<string, number>, tol = 1.5) {
  for (const [k, v] of Object.entries(want)) expect(Math.abs(actual[k]! - v), `${k}: ${actual[k]} against ${v}`).toBeLessThanOrEqual(tol);
}

/** No flight running and the screen's cascade landed (the pane is the last block in). */
async function settled(page: Page) {
  await expect.poll(() => page.evaluate(() => document.querySelectorAll('[data-shared-copy], [data-shared-flying], [data-present="false"]').length)).toBe(0);
  await expect
    .poll(() => panel(page).evaluate((el) => [getComputedStyle(el).opacity, getComputedStyle(el).transform, getComputedStyle(el.firstElementChild!).transform].join(' ')))
    .toBe('1 none none');
}

async function open(page: Page, url: string) {
  await page.goto(url);
  await expect(screen(page).getByRole('heading', { level: 1 })).toBeAttached();
  await page.evaluate(() => document.fonts.ready);
  await settled(page);
}

test('the hero and Facts sit where the Lua puts them', async ({ page }, info) => {
  await open(page, '/match/1/facts?demo');
  const s = screen(page);
  await expect(s.getByRole('heading', { level: 1, name: 'France – Argentina' })).toBeAttached();
  await expect(s.getByText('World · Nations Series')).toBeVisible();

  // hero (luau:4721): the bar is 96 tall; a 98 px row a side, the scorers under the names
  near(await box(page, s.getByText('Matchday 2', { exact: true })), { x: 18, y: 96 + 22.45 - 6.85 });
  const tabs = await box(page, s.getByRole('tablist'));
  near(tabs, { y: 96 + 269.9, x: 18, r: 18 });
  for (const name of ['Facts', 'Stats', 'Lineup', 'Table']) await expect(s.getByRole('tab', { name })).toBeVisible();
  await expect(s.getByRole('button', { name: /Mbappé/ })).toBeVisible();

  // Facts (luau:5300): real Momentum, its 269.8 px block, 36 px, Events
  const top = 96 + 269.9 + 61;
  near(await box(page, s.getByRole('heading', { name: 'Momentum' })), { x: 18, y: top });
  const momentum = s.locator('[data-momentum="1"]');
  near(await box(page, momentum.locator(':scope > .m-glass')), { y: top + 27.7 + 61.8, h: 184, x: 18, r: 18 });
  const plot = momentum.locator('svg[viewBox="0 0 322 156"]');
  near(await box(page, plot), { x: 34, r: 34, y: top + 27.7 + 61.8 + 14, h: 156 });
  await expect(plot).toHaveAttribute('role', 'img');
  await expect(momentum.locator('[data-wave="home"]')).toHaveCount(1);
  await expect(momentum.locator('[data-wave="away"]')).toHaveCount(1);
  expect(await momentum.locator('[data-momentum-goal]').count()).toBeGreaterThan(0);
  await expect(s.locator('[data-part="12"]')).toHaveCount(0);
  near(await box(page, s.getByRole('heading', { name: 'Events' })), { x: 18, y: top + 27.7 + 269.8 + 36 });
  await expect(s.getByText('Live', { exact: true })).toBeVisible();

  // the first ten events, newest first, on the rail at x 60, and "Show all"
  await expect(eventRows(page)).toHaveCount(10);
  const feedTop = top + 27.7 + 269.8 + 36 + 27.7;
  near(await box(page, eventRows(page).first()), { y: feedTop, x: 0, r: 0 });
  const rail = await box(page, s.locator('[data-row="e"]').first().locator('xpath=../*[1]'));
  near(rail, { x: 59.5, y: feedTop + 14, w: 1 });
  const all = s.getByRole('button', { name: /^Show all \d+ events$/ });
  await expect(all).toBeVisible();
  const b = await box(page, all);
  near(b, { h: 36 });
  expect(Math.abs(b.x - b.r)).toBeLessThanOrEqual(1);

  // match info: two tiles a row, 68 tall, 8 apart
  const tiles = s.getByRole('region', { name: 'Match info' }).locator('.m-glass');
  await expect(tiles).toHaveCount(4);
  const [t1, t2, t3] = await Promise.all([box(page, tiles.nth(0)), box(page, tiles.nth(1)), box(page, tiles.nth(2))]);
  near(t1, { x: 18, h: 68 });
  near(t2, { r: 18, y: t1.y });
  near(t3, { y: t1.y + 76 });
  await expect(s.getByRole('region', { name: 'Match info' })).toContainText('Stade de France');

  await page.screenshot({ path: info.outputPath('facts.png') });
});

test('the Facts chart unmounts on tab change and returns once', async ({ page }) => {
  await open(page, '/match/1/facts?demo');
  const chart = screen(page).locator('[data-momentum="1"]');
  const clip = chart.locator('[data-wave-reveal]');
  const revealX = () => clip.evaluate((el) => new DOMMatrix(getComputedStyle(el).transform).m41);
  // Wait beyond the wave's entrance, then verify a leaf clock tick leaves the chart in place.
  await expect(chart.locator('[data-momentum-now]')).toBeVisible();
  const endX = await chart.locator('[data-momentum-now]').evaluate((el) => (el as SVGGElement).transform.baseVal.consolidate()!.matrix.e);
  await expect.poll(revealX).toBeCloseTo(-323 + endX, 2);
  const paths = await chart.locator('[data-wave="home"]').getAttribute('d');
  const clock = screen(page).getByText(/^\d{2}:\d{2}$/).first();
  const before = await clock.textContent();
  await expect(clock).not.toHaveText(before!);
  expect(await chart.locator('[data-wave="home"]').getAttribute('d')).toBe(paths);
  expect(await revealX()).toBeCloseTo(-323 + endX, 2);

  await screen(page).getByRole('tab', { name: 'Stats', exact: true }).click();
  await expect(chart).toHaveCount(0);
  await screen(page).getByRole('tab', { name: 'Facts', exact: true }).click();
  await expect(chart).toHaveCount(1);
  await expect(chart.locator('[data-momentum-now]')).toBeVisible();
});

test('Stats counts out to the possession and opens the bars', async ({ page }, info) => {
  await open(page, '/match/1/stats?demo');
  const s = screen(page);
  const poss = s.getByRole('region', { name: 'Possession' });
  const label = await poss.getByRole('img').getAttribute('aria-label');
  const [, h] = /France (\d+)%/.exec(label ?? '') ?? [];
  expect(Number(h)).toBeGreaterThan(0);
  // the numbers have landed on the feed's possession
  await expect(poss.getByRole('img')).toContainText(`${h}%`);
  const top = 96 + 269.9 + 61;
  const bars = poss.locator('[data-bars]');
  const bb = await box(page, bars);
  near(bb, { x: 18, r: 18, h: 46, y: top + 27.7 + 32 + 65 });
  const home = await box(page, bars.locator('span').first());
  near(home, { w: ((bb.w - 4) * Number(h)) / 100 }, 1);
  await expect(poss).toContainText('France keep more of the ball');

  const tops = s.getByRole('region', { name: 'Top stats' });
  for (const name of ['xG', 'Shots', 'On target', 'Corners']) await expect(tops.getByText(name, { exact: true })).toBeVisible();
  near(await box(page, tops.getByRole('heading', { name: 'Top stats' })), { y: top + 27.7 + 32 + 65 + 58 + 47.7 });

  await page.screenshot({ path: info.outputPath('stats.png') });
});

test('Table marks the top two and the sides playing now', async ({ page }, info) => {
  await open(page, '/match/1/table?demo');
  const s = screen(page);
  const rows = s.getByRole('row');
  // the header and the four teams, the last one in (motion: stats, row by row)
  await expect(rows).toHaveCount(5);
  await expect.poll(() => rows.nth(4).evaluate((el) => getComputedStyle(el).transform + getComputedStyle(el).opacity)).toBe('none1');
  const top = 96 + 269.9 + 61;
  near(await box(page, rows.nth(1)), { y: top + 27.7 + 28, h: 46, x: 18, r: 18 });
  // a dashed line after the second, 7 px
  near(await box(page, rows.nth(3)), { y: top + 27.7 + 28 + 92 + 7 });
  await expect(rows.nth(1).locator('.m-glass')).toHaveCount(1);
  await expect(rows.nth(3).locator('.m-glass')).toHaveCount(0);
  await expect(s.getByRole('img', { name: 'Playing now' }).first()).toBeVisible();
  await expect(s.getByText('Qualify · top two')).toBeVisible();

  await page.screenshot({ path: info.outputPath('table.png') });
});

test('the Lineup tab keeps its placeholder until Part 13', async ({ page }) => {
  await open(page, '/match/1/lineup?demo');
  await expect(screen(page).getByRole('tab', { name: 'Lineup', selected: true })).toBeVisible();
  await expect(screen(page).locator('[data-focus-key="chip-fra-10"]')).toBeVisible();
});

test('before kick-off, after full time and a friendly', async ({ page }) => {
  await open(page, '/match/11/facts?demo');
  const s = screen(page);
  await expect(s.getByRole('tab', { name: 'Squad' })).toBeVisible();
  await expect(s.getByText('Kick-off 20:45')).toBeVisible();
  const form = s.getByRole('region', { name: 'Form' });
  await expect(form.locator('[data-r]')).toHaveCount(10);
  // the Lua's letters for Italy and Japan in match 11
  await expect(form.getByLabel('Italy: W L D D L')).toBeAttached();

  await open(page, '/match/8/facts?demo');
  await expect(screen(page).getByText('Full time')).toBeVisible();
  await expect(screen(page).getByRole('heading', { name: 'Events' })).toBeVisible();

  await open(page, '/match/9/table?demo');
  await expect(screen(page).getByText('Friendlies have no table.')).toBeVisible();
});

test('a live event slides into Facts', async ({ page }) => {
  // fast demo: events come every few seconds
  await page.goto('/match/1/facts?demo=fast');
  await expect(eventRows(page).first()).toBeVisible();
  await settled(page);
  const first = () => eventRows(page).first().textContent();
  const before = await first();
  // watch every frame from here: did any row move, and did one open at the top
  await page.evaluate(() => {
    const w = window as unknown as { __moved: number };
    w.__moved = 0;
    const tick = () => {
      if (document.querySelector('[data-screen="match"] [data-row][style*="translateY"]')) w.__moved += 1;
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  await expect.poll(first, { timeout: 30_000 }).not.toBe(before);
  // the rows under it slid down: several frames with rows lifted, then at rest with ten rows again
  await expect.poll(() => page.evaluate(() => (window as unknown as { __moved: number }).__moved)).toBeGreaterThan(5);
  await expect
    .poll(async () => `${await screen(page).locator('[data-row][style*="translateY"]').count()} ${await eventRows(page).count()}`, { timeout: 10_000 })
    .toBe('0 10');
});

test('no horizontal overflow on any tab', async ({ page }) => {
  for (const tab of ['facts', 'stats', 'table', 'lineup']) {
    await open(page, `/match/1/${tab}?demo`);
    const over = await page.evaluate(() => {
      const out: string[] = [];
      if (document.documentElement.scrollWidth > window.innerWidth) out.push(`page ${document.documentElement.scrollWidth}`);
      for (const el of document.querySelectorAll<HTMLElement>('[data-scroller]')) if (el.scrollWidth > el.clientWidth + 1) out.push(`${el.dataset.screen} ${el.scrollWidth}>${el.clientWidth}`);
      return out;
    });
    expect(over, tab).toEqual([]);
  }
});
