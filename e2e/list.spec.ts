import { expect, test, type Locator, type Page } from '@playwright/test';

/*
 * Part 10: the match list, at 390 (phone) and in pane 1 at 900 and 1280. Every number below is
 * measured from the Lua at 390 and given relative to the pane's own top-left corner, so the same
 * numbers hold wherever the list sits. The demo feed (?demo) supplies the data: the Lua's evening
 * (five matches in play, Argentina's 10 followed). A screenshot of each state goes to
 * test-results/ for comparing with the Lua by eye.
 */

const pane = (page: Page) => page.locator('[data-screen="list"][data-present="true"]');
const dayTab = (page: Page, name: string | RegExp) => pane(page).getByRole('tab', { name });
const liveToggle = (page: Page) => pane(page).getByRole('button', { name: /^Live, \d+ in play$/ });
const rows = (page: Page) => pane(page).locator('[data-focus-key^="match-"]');
const cards = (page: Page) => pane(page).locator('[data-card]');
const followCard = (page: Page) => pane(page).locator('[data-phase]');

/** `el`'s box relative to the list pane's top-left corner. */
async function box(page: Page, el: Locator) {
  const [p, b] = await Promise.all([pane(page).boundingBox(), el.boundingBox()]);
  if (!p || !b) throw new Error('not on screen');
  return { x: b.x - p.x, y: b.y - p.y, w: b.width, h: b.height };
}

/** Within `tol` px, per number (a fractional position is a rounding away from the Lua's). */
function near(actual: Record<string, number>, want: Record<string, number>, tol = 1.5) {
  for (const [k, v] of Object.entries(want)) expect(Math.abs(actual[k]! - v), `${k}: ${actual[k]} against ${v}`).toBeLessThanOrEqual(tol);
}

async function open(page: Page, url = '/?demo') {
  await page.goto(url);
  await expect(page.getByTestId('app-shell')).toBeVisible();
  await expect(rows(page).first()).toBeVisible();
  await settled(page);
}

/** The entrance cascade has landed (the blocks slide in, the last one 24 steps behind) and nothing is growing. */
async function settled(page: Page) {
  await expect.poll(() => page.evaluate(() => document.querySelectorAll('[data-leaving], [data-grow="0"]').length)).toBe(0);
  await expect.poll(async () => Math.abs((await box(page, rows(page).last())).x - 12), { timeout: 10_000 }).toBeLessThan(0.5);
}

/** The pane's width: 390 on a phone and in pane 1 at 1280; a tablet's pane is a little wider and the list fills it. */
const paneWidth = async (page: Page) => (await pane(page).boundingBox())!.width;

const shot = (page: Page, name: string) => page.screenshot({ path: `test-results/list-${name}-${test.info().project.name}.png` });

test.describe('Today', () => {
  test.beforeEach(async ({ page }) => open(page));

  test('the header, the day tabs and the followed card sit where the Lua puts them', async ({ page }) => {
    // header: the Live pill 38 tall, centred on y=82 (62 down on a phone, 24 below the pane's top on a desktop pane)
    const live = await box(page, liveToggle(page));
    near(live, { w: 109.1, h: 38 }, 1);
    expect(live.y + live.h / 2).toBeGreaterThan(75);
    expect(live.y + live.h / 2).toBeLessThan(90);

    const W = await paneWidth(page);
    near(await box(page, pane(page).getByRole('tablist', { name: 'Day' })), { x: 18, y: 110, w: W - 36, h: 50 });
    await expect(dayTab(page, 'Today')).toHaveAttribute('aria-selected', 'true');

    // the card: 366 wide at the 12 px gutter, 266 tall while he plays, under the 181 section top
    near(await box(page, followCard(page)), { x: 12, y: 207, w: W - 24, h: 266 });
    await expect(followCard(page)).toHaveAttribute('data-phase', 'live');
    await expect(pane(page).getByRole('button', { name: /^Lionel Messi, the player you follow/ })).toBeVisible();
    await shot(page, 'today');
  });

  test('the rows are the demo evening: seven matches, 76 tall, 12 px in', async ({ page }) => {
    const names = await rows(page).evaluateAll((els) => els.map((e) => e.getAttribute('aria-label')));
    expect(names).toEqual([
      'France 2–1 Argentina',
      'England 0–1 Brazil',
      'Germany 1–1 Netherlands',
      'Belgium 0–2 Austria',
      'Ireland 2–1 Poland',
      'Nigeria v Senegal',
      'Ivory Coast v Mali',
    ]);
    const first = await box(page, rows(page).first());
    near(first, { x: 12, y: 527.7, w: (await paneWidth(page)) - 24, h: 76 });
    // the next league starts after the group's header: 128.7 from row to row, 76 inside a league
    const second = await box(page, rows(page).nth(1));
    near({ d: second.y - first.y }, { d: 128.7 });
    const third = await box(page, rows(page).nth(2));
    const fourth = await box(page, rows(page).nth(3));
    near({ d: fourth.y - third.y }, { d: 76 });
    await expect(pane(page).getByText('Favourites')).toBeVisible();
    await expect(pane(page).getByText('Nations Series')).toBeVisible();
  });

  test('a league folds its rows away and opens them again', async ({ page }) => {
    const toggle = pane(page).getByRole('button', { name: /Nations Series/ });
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await expect(rows(page).filter({ hasText: 'England' })).toBeHidden();
    await toggle.click();
    await expect(rows(page).filter({ hasText: 'England' })).toBeVisible();
  });

  test('the Show less button closes the card to its short form, and Show more opens it again', async ({ page }) => {
    const card = followCard(page);
    await pane(page).getByRole('button', { name: 'Show less' }).click();
    await expect(card).toHaveAttribute('data-open', 'false');
    await expect.poll(async () => Math.round((await box(page, card)).h)).toBe(64);
    // the rows under it came up by the same 202
    await expect.poll(async () => Math.round((await box(page, rows(page).first())).y)).toBe(326);
    await shot(page, 'today-closed');
    await pane(page).getByRole('button', { name: 'Show more' }).click();
    await expect.poll(async () => Math.round((await box(page, card)).h)).toBe(266);
  });

  test('Change opens the picker over the card, picking a player swaps the card, Unfollow shows the picker', async ({ page }) => {
    await pane(page).getByRole('button', { name: 'Change' }).click();
    await expect(pane(page).getByRole('heading', { name: 'Follow a player' })).toBeVisible();
    await expect(followCard(page)).toBeHidden();
    const chips = pane(page).getByRole('button', { pressed: true });
    await expect(chips).toHaveCount(1);
    await shot(page, 'picker');

    await pane(page).getByRole('button', { name: /Kylian Mbappé|Mbappé/ }).click();
    await expect(pane(page).getByRole('heading', { name: 'Follow a player' })).toBeHidden();
    await expect(pane(page).getByRole('button', { name: /^Kylian Mbappé, the player you follow/ })).toBeVisible();
    await expect(followCard(page)).toBeVisible();

    await pane(page).getByRole('button', { name: 'Change' }).click();
    await pane(page).getByRole('button', { name: 'Unfollow' }).click();
    await expect(pane(page).getByRole('region', { name: 'Your player' })).toBeVisible();
    await expect(followCard(page)).toHaveCount(0);
  });

  test('the followed player is remembered across a reload', async ({ page }) => {
    await pane(page).getByRole('button', { name: 'Change' }).click();
    await pane(page).getByRole('button', { name: /Mbappé/ }).click();
    await page.reload();
    await expect(pane(page).getByRole('button', { name: /^Kylian Mbappé, the player you follow/ })).toBeVisible();
  });

  test('tapping a match opens it; the card says it is the current one', async ({ page }) => {
    await rows(page).first().click();
    await expect(page.locator('[data-screen="match"][data-present="true"]').getByRole('heading', { level: 1, name: 'France – Argentina' })).toBeVisible();
    await expect(rows(page).first()).toHaveAttribute('aria-current', 'true');
  });
});

test.describe('Ongoing', () => {
  test.beforeEach(async ({ page }) => open(page, '/?demo&live=1'));

  test('five cards of 70 (a fifth of the width) on one baseline, then the followed card under them', async ({ page }) => {
    await expect(cards(page)).toHaveCount(5);
    await expect(dayTab(page, 'Ongoing')).toHaveAttribute('aria-selected', 'true');
    await settled(page);
    await expect.poll(async () => Math.abs((await box(page, cards(page).first())).y + (await box(page, cards(page).first())).h - 451)).toBeLessThan(1);

    const boxes = [];
    for (let i = 0; i < 5; i += 1) boxes.push(await box(page, cards(page).nth(i)));
    const cw = ((await paneWidth(page)) - 24 - 16) / 5;
    boxes.forEach((b, i) => {
      near({ x: b.x, w: b.w, bottom: b.y + b.h }, { x: 12 + i * (cw + 4), w: cw, bottom: 451 });
      expect(b.h).toBeGreaterThan(150);
      expect(b.h).toBeLessThan(250);
    });
    // Germany's 76' is the tallest, Belgium's 47' the shortest
    const hs = boxes.map((b) => b.h);
    expect(hs.indexOf(Math.max(...hs))).toBe(2);
    expect(hs.indexOf(Math.min(...hs))).toBe(3);
    // "Following" now starts under the cards (181 + 300 high section)
    near(await box(page, followCard(page)), { x: 12, y: 507, w: (await paneWidth(page)) - 24, h: 266 });
    await shot(page, 'ongoing');
  });

  test('the cards are the live matches only, and open their match', async ({ page }) => {
    await expect(cards(page)).toHaveCount(5);
    const names = await cards(page).evaluateAll((els) => els.map((e) => e.getAttribute('aria-label')));
    expect(names).toEqual([
      'France 2–1 Argentina, live',
      'England 0–1 Brazil, live',
      'Germany 1–1 Netherlands, live',
      'Belgium 0–2 Austria, live',
      'Ireland 2–1 Poland, live',
    ]);
    await expect(rows(page)).toHaveCount(5);
  });
});

test.describe('the day tabs', () => {
  test.beforeEach(async ({ page }) => open(page));

  test('Live turns Today into Ongoing and back; the cards grow in and fold away', async ({ page }) => {
    await expect(cards(page)).toHaveCount(0);
    await liveToggle(page).click();
    await expect(liveToggle(page)).toHaveAttribute('aria-pressed', 'true');
    await expect(dayTab(page, 'Ongoing')).toHaveAttribute('aria-selected', 'true');
    await expect(cards(page)).toHaveCount(5);
    // finished matches fold away: the list is the matches in play
    await expect(rows(page).filter({ hasText: 'Nigeria' })).toBeHidden();

    await dayTab(page, 'Ongoing').click(); // the same tab again leaves Ongoing for Today
    await expect(liveToggle(page)).toHaveAttribute('aria-pressed', 'false');
    await expect(dayTab(page, 'Today')).toHaveAttribute('aria-selected', 'true');
    await expect(cards(page)).toHaveCount(0);
    await expect(rows(page).filter({ hasText: 'Nigeria' })).toBeVisible();
  });

  test('Yesterday and Tomorrow show their own days, the indicator follows the tab', async ({ page }) => {
    const underline = async () => (await box(page, dayTab(page, 'Today'))).x;
    const x0 = await underline();
    await dayTab(page, 'Yesterday').click();
    await expect(dayTab(page, 'Yesterday')).toHaveAttribute('aria-selected', 'true');
    await expect(rows(page).first()).toBeVisible();
    const yesterday = await rows(page).evaluateAll((els) => els.map((e) => e.getAttribute('aria-label')));
    expect(yesterday.length).toBeGreaterThan(0);
    expect(yesterday.every((l) => l!.includes('–'))).toBe(true); // all finished
    // the strip slid the new tab to the centre
    await expect.poll(async () => Math.abs((await underline()) - x0) > 20).toBe(true);
    await shot(page, 'yesterday');

    await dayTab(page, 'Tomorrow').click();
    await expect(dayTab(page, 'Tomorrow')).toHaveAttribute('aria-selected', 'true');
    const tomorrow = await rows(page).evaluateAll((els) => els.map((e) => e.getAttribute('aria-label')));
    expect(tomorrow.length).toBeGreaterThan(0);
    expect(tomorrow.every((l) => / v /.test(l!))).toBe(true); // none played yet
    expect(tomorrow).not.toEqual(yesterday);
  });

  test('the tabs strip fades at both edges and the page does not scroll sideways', async ({ page }) => {
    const over = await pane(page).evaluate((el) => el.scrollWidth - el.clientWidth);
    expect(over).toBeLessThanOrEqual(0);
    await expect(pane(page).getByRole('tablist', { name: 'Day' })).toHaveCSS('overflow', 'hidden');
  });
});
