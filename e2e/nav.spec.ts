import { expect, test, type Page, type TestInfo } from '@playwright/test';

/*
 * Part 9: routes, layouts, scroll and focus (nothing flies between screens), at every width the
 * projects run (phone 390, tablet 900, desktop 1280). The demo feed (?demo) supplies the data:
 * match 1 is France – Argentina (with lineups), match 2 England – Brazil.
 */

type Layout = 'phone' | 'two' | 'three';
const layoutOf = (info: TestInfo): Layout => (info.project.name.startsWith('phone') ? 'phone' : info.project.name.startsWith('tablet') ? 'two' : 'three');

const card = (page: Page, id: number) => page.locator(`[data-focus-key="match-${id}"]`);
const chip = (page: Page, key: string) => page.locator(`[data-focus-key="chip-${key}"]`);
const screenOf = (page: Page, name: string) => page.locator(`[data-screen="${name}"][data-present="true"]`);
const scrollTop = (page: Page, name: string) => screenOf(page, name).evaluate((el) => el.scrollTop);
const titled = (page: Page, name: string, title: string) => screenOf(page, name).getByRole('heading', { level: 1, name: title });
// a tab click that doesn't scroll the pane first (a Playwright click may scroll the target into view)
const pressTab = (page: Page, screen: string, name: string) => screenOf(page, screen).getByRole('tab', { name }).evaluate((el: HTMLElement) => el.click());

/**
 * No flight running, no copy left, no screen still leaving. It can't tell a navigation that hasn't
 * rendered yet from one that has finished (both look idle), so after a click or back/forward
 * first wait for the screen the navigation shows, then call this.
 */
async function settled(page: Page) {
  await expect
    .poll(() => page.evaluate(() => document.querySelectorAll('[data-present="false"]').length), { timeout: 5000 })
    .toBe(0);
}

async function open(page: Page, url: string) {
  await page.goto(url);
  await expect(page.getByTestId('app-shell')).toBeVisible();
  await expect(card(page, 1)).toBeVisible();
  await settled(page);
}

// every shared end that hid for a flight, as "id@end", and how many copies were drawn
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    const w = window as unknown as { __flown: string[]; __copies: number };
    w.__flown = [];
    w.__copies = 0;
    new MutationObserver((ms) => {
      for (const m of ms) {
        if (m.type === 'attributes' && m.target instanceof HTMLElement && m.target.hasAttribute('data-shared-flying')) w.__flown.push(`${m.target.dataset.shared}@${m.target.dataset.sharedEnd}`);
        if (m.type === 'childList') for (const n of m.addedNodes) if (n instanceof HTMLElement && n.hasAttribute('data-shared-copy')) w.__copies += 1;
      }
    }).observe(document, { subtree: true, childList: true, attributes: true, attributeFilter: ['data-shared-flying'] });
  });
});

async function flown(page: Page) {
  return page.evaluate(() => {
    const w = window as unknown as { __flown: string[]; __copies: number };
    const out = { ends: [...new Set(w.__flown)], copies: w.__copies };
    w.__flown = [];
    w.__copies = 0;
    return out;
  });
}

test('navigation, tabs, a player, then back and forward', async ({ page }) => {
  await open(page, '/?demo');
  await card(page, 1).click();
  await expect(page).toHaveURL(/\/match\/1\/facts\?demo$/);
  await expect(screenOf(page, 'match').getByRole('heading', { level: 1, name: 'France – Argentina' })).toBeVisible();
  await expect(page).toHaveTitle('France – Argentina · Scoreline');

  await screenOf(page, 'match').getByRole('tab', { name: 'Lineup' }).click();
  await expect(page).toHaveURL(/\/match\/1\/lineup\?demo$/);
  await chip(page, 'fra-10').click();
  await expect(page).toHaveURL(/\/player\/fra\/10\?demo$/);
  await expect(screenOf(page, 'player').getByRole('heading', { level: 1, name: 'Kylian Mbappé' })).toBeVisible();
  await settled(page);

  // the tab change replaced its entry: back goes to the lineup, then the list
  await page.goBack();
  await expect(page).toHaveURL(/\/match\/1\/lineup\?demo$/);
  await expect(screenOf(page, 'player')).toHaveCount(0);
  await page.goBack();
  await expect(page).toHaveURL(/\/\?demo$/);
  await settled(page);
  await expect(screenOf(page, 'match')).toHaveCount(layoutOf(test.info()) === 'phone' ? 0 : 1);

  await page.goForward();
  await expect(page).toHaveURL(/\/match\/1\/lineup\?demo$/);
  await page.goForward();
  await expect(page).toHaveURL(/\/player\/fra\/10\?demo$/);
  await expect(screenOf(page, 'player').getByRole('heading', { level: 1, name: 'Kylian Mbappé' })).toBeVisible();
  await settled(page);
});

test('direct URLs open where they point', async ({ page }, info) => {
  const layout = layoutOf(info);
  await page.goto('/match/1?demo');
  await expect(page).toHaveURL(/\/match\/1\/facts\?demo$/);

  await page.goto('/match/2/stats?demo');
  await expect(screenOf(page, 'match').getByRole('heading', { level: 1, name: 'England – Brazil' })).toBeVisible();
  await expect(screenOf(page, 'match').getByRole('tab', { name: 'Stats', selected: true })).toBeVisible();
  await expect(page).toHaveTitle('England – Brazil · Scoreline');

  await page.goto('/player/arg/10?demo');
  await expect(screenOf(page, 'player').getByRole('heading', { level: 1, name: 'Lionel Messi' })).toBeVisible();
  if (layout === 'phone') await expect(screenOf(page, 'match')).toHaveCount(0);
  // on the panes a player opened cold sits beside their team's match
  else await expect(screenOf(page, 'match').getByRole('heading', { level: 1, name: 'France – Argentina' })).toBeVisible();

  // with no history to go back to, Back goes up a level
  if (layout !== 'three') {
    await screenOf(page, 'player').getByRole('button', { name: layout === 'phone' ? 'Back' : 'Close' }).click();
    await expect(page).toHaveURL(/\/\?demo$/);
    await expect(screenOf(page, 'player')).toHaveCount(0);
  }

  await page.goto('/somewhere/else?demo');
  await expect(page).toHaveURL(/\/\?demo$/);

  await page.goto('/match/999/facts?demo');
  await expect(screenOf(page, 'match').getByRole('heading', { level: 1, name: 'Not found' })).toBeVisible();
});

test('each pane keeps its own scroll', async ({ page }, info) => {
  const layout = layoutOf(info);
  if (layout === 'phone') {
    await open(page, '/?demo');
    await screenOf(page, 'list').evaluate((el) => el.scrollTo(0, el.scrollHeight));
    const listY = await scrollTop(page, 'list');
    expect(listY).toBeGreaterThan(0);
    // a match in play: its tabs are long enough to scroll 120 px on a phone (Part 11's real
    // screens; Ivory Coast – Mali before kick-off scrolls 8 px on Facts and none on Stats)
    await card(page, 5).click();
    await expect(titled(page, 'match', 'Ireland – Poland')).toBeVisible();
    await settled(page);
    expect(await scrollTop(page, 'match')).toBe(0);
    await screenOf(page, 'match').evaluate((el) => el.scrollTo(0, 120));
    await page.waitForTimeout(100);
    // a tab switch leaves the scroll alone
    await pressTab(page, 'match', 'Stats');
    await expect(page).toHaveURL(/\/match\/5\/stats\?demo$/);
    await expect.poll(() => scrollTop(page, 'match')).toBe(120);

    await page.goBack();
    await expect(screenOf(page, 'match')).toHaveCount(0);
    await settled(page);
    await expect.poll(() => scrollTop(page, 'list')).toBe(listY);
    await page.goForward();
    await expect(titled(page, 'match', 'Ireland – Poland')).toBeVisible();
    await settled(page);
    await expect.poll(() => scrollTop(page, 'match')).toBe(120);
  } else {
    await open(page, '/match/1/facts?demo');
    // scrolled part-way: with the real list the last scroll position puts the second match under the
    // sticky header, and a click there makes Playwright scroll the pane to reach it. The list's
    // blocks are still arriving when the page first shows a card, so wait until it can scroll that far.
    await expect.poll(() => screenOf(page, 'list').evaluate((el) => el.scrollHeight - el.clientHeight)).toBeGreaterThan(300);
    const listBefore = await screenOf(page, 'list').evaluate((el) => {
      el.scrollTo(0, 300);
      return el.scrollTop;
    });
    expect(listBefore).toBe(300);
    await screenOf(page, 'match').evaluate((el) => el.scrollTo(0, 120));
    await page.waitForTimeout(100);
    await pressTab(page, 'match', 'Stats');
    await expect(page).toHaveURL(/\/match\/1\/stats\?demo$/);
    await expect.poll(() => scrollTop(page, 'match')).toBe(120);

    // another match starts at the top; the list doesn't move
    await card(page, 2).click();
    await expect(titled(page, 'match', 'England – Brazil')).toBeVisible();
    await settled(page);
    expect(await scrollTop(page, 'match')).toBe(0);
    expect(await scrollTop(page, 'list')).toBe(listBefore);

    await page.goBack();
    await expect(titled(page, 'match', 'France – Argentina')).toBeVisible();
    await settled(page);
    await expect.poll(() => scrollTop(page, 'match')).toBe(120);
  }

  // a new day starts the list at the top
  await screenOf(page, 'list').evaluate((el) => el.scrollTo(0, el.scrollHeight));
  await screenOf(page, 'list').getByRole('tab', { name: 'Yesterday' }).evaluate((el: HTMLElement) => el.click());
  await expect(page).toHaveURL(/day=-1/);
  await expect.poll(() => scrollTop(page, 'list')).toBe(0);
});

test('focus follows navigation', async ({ page }, info) => {
  const layout = layoutOf(info);
  await open(page, '/?demo');
  await card(page, 2).click();
  await settled(page);
  if (layout === 'phone') {
    // a screen stacked on top takes focus; the list under it is inert
    await expect(screenOf(page, 'match').locator('[data-screen-heading]')).toBeFocused();
    await expect(screenOf(page, 'list')).toHaveAttribute('inert', '');
  } else {
    // beside the list: focus stays on the card, the change is announced
    await expect(card(page, 2)).toBeFocused();
    await expect(page.locator('[aria-live="polite"]')).toHaveText('England – Brazil');
  }
  await page.goBack();
  await settled(page);
  await expect(card(page, 2)).toBeFocused();

  await open(page, '/match/1/lineup?demo');
  await chip(page, 'fra-10').click();
  await settled(page);
  if (layout === 'three') await expect(chip(page, 'fra-10')).toBeFocused();
  else await expect(screenOf(page, 'player').locator('[data-screen-heading]')).toBeFocused();
  await page.goBack();
  await settled(page);
  await expect(chip(page, 'fra-10')).toBeFocused();
});

test('nothing flies between screens: the match pushes in, the player grows in at the centre', async ({ page }) => {
  await open(page, '/?demo');
  await card(page, 2).click();
  await expect(titled(page, 'match', 'England – Brazil')).toBeVisible();
  await settled(page);
  // no shared ends, so no crest or score left the card to fly to the hero (review of 2026-10-04)
  expect((await flown(page)).ends).toEqual([]);
  await expect(page.locator('[data-shared], [data-shared-end], [data-shared-copy]')).toHaveCount(0);

  await open(page, '/match/1/lineup?demo');
  // the bust starts at 0.9 about its middle and grows to 1 (luau:5965), whatever opened it
  const first = await page.evaluate(
    () =>
      new Promise<number>((done) => {
        document.querySelector<HTMLElement>('[data-screen="match"][data-present="true"] [data-focus-key="chip-fra-10"]')!.click();
        requestAnimationFrame(() => {
          const el = document.querySelector('[data-pv="hero"] > *');
          done(el ? new DOMMatrix(getComputedStyle(el).transform).a : -1);
        });
      }),
  );
  expect(first).toBeGreaterThanOrEqual(0.89);
  expect(first).toBeLessThan(1);
  const art = page.locator('[data-pv="hero"] > *').first();
  await settled(page);
  await expect.poll(() => art.evaluate((el) => new DOMMatrix(getComputedStyle(el).transform).a)).toBeCloseTo(1, 2);
  expect((await flown(page)).ends).toEqual([]);
});

test('rapid taps and interrupted navigation end in one clean state', async ({ page }, info) => {
  const layout = layoutOf(info);
  await open(page, '/?demo');

  // three taps on one card: one entry, one screen
  await card(page, 2).evaluate((el: HTMLElement) => {
    el.click();
    el.click();
    el.click();
  });
  await expect(page).toHaveURL(/\/match\/2\/facts\?demo$/);
  await settled(page);
  await expect(screenOf(page, 'match')).toHaveCount(1);
  await page.goBack();
  await expect(page).toHaveURL(/\/\?demo$/);

  // back in the middle of the push
  await card(page, 1).click();
  await page.goBack();
  await expect(page).toHaveURL(/\/\?demo$/);
  await settled(page);
  await expect(screenOf(page, 'match')).toHaveCount(layout === 'phone' ? 0 : 1);
  if (layout === 'phone') await expect(screenOf(page, 'list')).not.toHaveAttribute('inert', '');

  // forward, back, forward, back while the screens are still moving
  await page.goForward();
  await page.goBack();
  await page.goForward();
  await page.goBack();
  await expect(page).toHaveURL(/\/\?demo$/);
  await settled(page);
  await expect(screenOf(page, 'match')).toHaveCount(layout === 'phone' ? 0 : 1);

  if (layout !== 'phone') {
    // the list stays usable beside the match: switch through matches fast, the last one wins
    for (const id of [2, 3, 4, 5]) await card(page, id).click();
    await expect(page).toHaveURL(/\/match\/5\/facts\?demo$/);
    await settled(page);
    await expect(screenOf(page, 'match')).toHaveCount(1);
    await expect(screenOf(page, 'match').getByRole('heading', { level: 1, name: 'Ireland – Poland' })).toBeVisible();
  }

  // a player opened and closed in a burst
  await open(page, '/match/1/lineup?demo');
  await chip(page, 'fra-10').click();
  await page.goBack();
  await page.goForward();
  await page.goBack();
  await expect(page).toHaveURL(/\/match\/1\/lineup\?demo$/);
  await settled(page);
  await expect(screenOf(page, 'player')).toHaveCount(0);
});

test('no horizontal overflow on any screen', async ({ page }) => {
  const check = async () => {
    await settled(page);
    const over = await page.evaluate(() => {
      const out: string[] = [];
      if (document.documentElement.scrollWidth > window.innerWidth) out.push(`page ${document.documentElement.scrollWidth}`);
      for (const el of document.querySelectorAll<HTMLElement>('[data-scroller]')) {
        if (el.scrollWidth > el.clientWidth + 1) out.push(`${el.dataset.screen} ${el.scrollWidth}>${el.clientWidth}`);
      }
      return out;
    });
    expect(over).toEqual([]);
  };
  for (const url of ['/?demo', '/match/1/lineup?demo', '/match/2/stats?demo', '/player/fra/10?demo']) {
    await page.goto(url);
    await expect(page.getByTestId('app-shell')).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    await check();
  }
});
