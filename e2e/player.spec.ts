import { expect, test, type Page, type TestInfo } from '@playwright/test';

/*
 * Part 14: the player view (luau:5845-6179) at 390 (phone layer), 900 (sheet over the match pane)
 * and 1280 (pane 3). Numbers are the Lua's, relative to the player screen's top-left; the page is
 * as wide as the phone (390 at 1280, the sheet's width at 900), centred. The demo feed (?demo):
 * France – Argentina is live (match 1); Mbappé (fra 10) and Messi (arg 10, the followed player)
 * have photos, Italy – Japan (match 11) has not started, Argentina's 7 has no photo.
 */

const layoutOf = (info: TestInfo) => (info.project.name.startsWith('phone') ? 'phone' : info.project.name.startsWith('tablet') ? 'two' : 'three');
const screenOf = (page: Page) => page.locator('[data-screen="player"][data-present="true"]');
const matchScreen = (page: Page) => page.locator('[data-screen="match"][data-present="true"]');
const chip = (page: Page, key: string) => page.locator(`[data-focus-key="chip-${key}"]`);

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    const w = window as unknown as { __flown: string[] };
    w.__flown = [];
    new MutationObserver((ms) => {
      for (const m of ms) if (m.target instanceof HTMLElement && m.target.hasAttribute('data-shared-flying')) w.__flown.push(`${m.target.dataset.shared}@${m.target.dataset.sharedEnd}`);
    }).observe(document, { subtree: true, attributes: true, attributeFilter: ['data-shared-flying'] });
  });
});

const flown = (page: Page) =>
  page.evaluate(() => {
    const w = window as unknown as { __flown: string[] };
    const out = [...new Set(w.__flown)];
    w.__flown = [];
    return out;
  });

async function settled(page: Page, withPlayer = true) {
  await expect.poll(() => page.evaluate(() => document.querySelectorAll('[data-present="false"]').length)).toBe(0);
  if (!withPlayer) return;
  // his bust has landed (a direct link grows it from 0.9) and the cascade is in
  await expect
    .poll(() => screenOf(page).evaluate((el) => {
      const h = el.querySelector('[data-pv="hero"]');
      if (!h) return true;
      const c = getComputedStyle(h);
      const still = (t: string) => { const m = new DOMMatrix(t); return !m.m41 && !m.m42 && Math.abs(m.a - 1) < 1e-6 && Math.abs(m.d - 1) < 1e-6 && Math.abs(m.b) < 1e-3 && Math.abs(m.c) < 1e-3; };
      return c.opacity === '1' && still(c.transform);
    }))
    .toBe(true);
  await expect.poll(() => screenOf(page).evaluate((el) => [...el.querySelectorAll('[data-pv="match"], [data-pv="facts"]')].every((b) => getComputedStyle(b).opacity === '1'))).toBe(true);
}

async function box(page: Page, selector: string) {
  const [p, b] = await Promise.all([screenOf(page).boundingBox(), screenOf(page).locator(selector).first().boundingBox()]);
  if (!p || !b) throw new Error(`${selector} not on screen`);
  return { x: b.x - p.x, y: b.y - p.y, w: b.width, h: b.height, cx: b.x - p.x + b.width / 2, pw: p.width };
}

function near(actual: Record<string, number>, want: Record<string, number>, tol = 1.5) {
  for (const [k, v] of Object.entries(want)) expect(Math.abs(actual[k]! - v), `${k}: ${actual[k]} against ${v}`).toBeLessThanOrEqual(tol);
}

/** Opens `url`; `on` is the screen it shows (the player, or the match to open him from). */
async function open(page: Page, url: string, on: 'player' | 'match' | 'list' = 'player') {
  await page.goto(url);
  if (on === 'list') await expect(page.getByTestId('app-shell')).toBeVisible();
  else await expect((on === 'player' ? screenOf(page) : matchScreen(page)).getByRole('heading', { level: 1 })).toBeAttached();
  await page.evaluate(() => document.fonts.ready);
  await expect.poll(() => page.evaluate(() => document.querySelectorAll('[data-present="false"]').length)).toBe(0);
  if (on === 'player') await settled(page);
}

test('the bust, the line of light and the sheet sit where the Lua puts them', async ({ page }, info) => {
  await open(page, '/player/fra/10?demo');
  const s = screenOf(page);
  // measured once the bust has grown in
  await expect.poll(() => s.locator('[data-pv="hero"] > *').first().evaluate((el) => new DOMMatrix(getComputedStyle(el).transform).a)).toBeCloseTo(1, 3);
  // the bust cell: 280 × 350, centred, 90 under the top; the cut is a window that ends on the
  // line (318 of 360 = 399.17) and holds still while the cell grows in
  const hero = await box(page, '[data-pv="bust"]');
  near(hero, { cx: hero.pw / 2, y: 90, w: 280, h: 350 });
  const cut = await box(page, '[data-pv="hero"]');
  near({ bottom: cut.y + cut.h }, { bottom: 399.17 });
  // the line of light on the cut, the giant number centred by its ink
  const line = await box(page, '[data-pv="horizon"] [class*="hair"]');
  near({ y: line.y + 0.5 }, { y: 399.17 });
  const num = await box(page, '[data-pv="number"]');
  expect(Math.abs(num.cx - hero.pw / 2)).toBeLessThanOrEqual(30);
  // the name block: first name, surname, role, then the facts under two hair-lines 68 apart
  const info0 = await box(page, '[data-pv="info"]');
  near(info0, { y: 456, h: 92 });
  const facts = await box(page, '[data-pv="facts"]');
  near(facts, { y: 548, h: 68 });
  await expect(s.getByRole('heading', { name: 'Kylian Mbappé' })).toBeVisible();
  await expect(s.locator('[data-pv="fact"]')).toHaveCount(4);
  // this match: 30 under the facts' rule, 30 for its heading row
  const match = await box(page, '[data-pv="match"]');
  near(match, { y: 548 + 68 + 30 });
  await expect(s.locator('[data-pv="rating"]')).toBeVisible();
  await expect(s.getByText('2 goals')).toBeVisible();
  // round buttons 14 from the edges, 40 across
  if (layoutOf(info) !== 'three') near(await box(page, 'button[aria-label="Back"], button[aria-label="Close"]'), { x: 14, w: 40 });
  const overflow = await s.evaluate((el) => el.scrollWidth - el.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  await page.screenshot({ path: info.outputPath('player.png') });
});

test('real photos for France and Argentina, the kit disc for everyone else', async ({ page }) => {
  await open(page, '/player/fra/10?demo');
  const img = screenOf(page).locator('[data-pv="bust"] img');
  await expect(img).toBeVisible();
  const src = await img.evaluate((el: HTMLImageElement) => el.currentSrc);
  expect(src).toMatch(/\/img\/players\/fra\/10-bust@[12]x\.(avif|webp)$/);
  expect(await img.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0)).toBe(true);
  await page.goto('/player/ita/10?demo');
  await expect(screenOf(page).locator('[data-pv="bust"] [data-kit-disc]')).toBeVisible();
  await expect(screenOf(page).locator('[data-pv="number"]')).toHaveCount(0);
  await expect(page.locator('img[src*="/img/players/ita/"]')).toHaveCount(0);
});

test('opens from the line-up in place, nothing flying from his face; back restores focus', async ({ page }, info) => {
  const layout = layoutOf(info);
  await open(page, '/match/1/lineup?demo', 'match');
  await chip(page, 'fra-10').click();
  await expect(screenOf(page).getByRole('heading', { level: 1, name: 'Kylian Mbappé' })).toBeVisible();
  await settled(page);
  expect(await flown(page)).toEqual([]);
  await expect(screenOf(page).locator('[data-pv="bust"]')).toBeVisible();
  // the match underneath keeps its tab (phone) or stays in its pane
  if (layout === 'three') await expect(matchScreen(page).getByRole('tab', { name: 'Lineup', selected: true })).toBeVisible();
  if (layout === 'two') await screenOf(page).getByRole('button', { name: 'Close' }).click();
  else if (layout === 'phone') await screenOf(page).getByRole('button', { name: 'Back' }).click();
  else await page.goBack();
  await expect(screenOf(page)).toHaveCount(0);
  await settled(page, false);
  await expect(matchScreen(page).getByRole('tab', { name: 'Lineup', selected: true })).toBeVisible();
  await expect(chip(page, 'fra-10')).toBeFocused();
  expect(await flown(page)).toEqual([]);
});

test('opens from the follow card in the list, and from a scorer in the match hero', async ({ page }, info) => {
  const layout = layoutOf(info);
  await open(page, '/?demo', 'list');
  const follow = page.locator('[data-focus-key="follow-arg-10"]');
  await follow.scrollIntoViewIfNeeded();
  await follow.click();
  await expect(screenOf(page).getByRole('heading', { level: 1, name: 'Lionel Messi' })).toBeVisible();
  await settled(page);
  expect(await flown(page)).toEqual([]);
  // his numbers come from his own match
  await expect(screenOf(page).locator('[data-pv="match"]')).toHaveAttribute('data-played', 'yes');
  if (layout === 'phone') {
    await screenOf(page).getByRole('button', { name: 'Back' }).click();
    await expect(screenOf(page)).toHaveCount(0);
    await settled(page, false);
    await expect(follow).toBeFocused();
  }
  // a scorer in the hero of the open match
  await open(page, '/match/1/facts?demo', 'match');
  await matchScreen(page).getByRole('button', { name: /Mbappé/ }).first().click();
  await expect(screenOf(page).getByRole('heading', { level: 1, name: 'Kylian Mbappé' })).toBeVisible();
});

test('the arrows glide to the next team-mate; back still leaves the page', async ({ page }, info) => {
  await open(page, '/match/1/lineup?demo', 'match');
  await chip(page, 'fra-10').click();
  await expect(screenOf(page).getByRole('heading', { level: 1, name: 'Kylian Mbappé' })).toBeVisible();
  await settled(page);
  await flown(page);
  const before = await page.evaluate(() => history.length);
  await screenOf(page).getByRole('button', { name: 'Next player' }).click();
  await expect(screenOf(page).getByRole('heading', { level: 1 })).not.toHaveAccessibleName('Kylian Mbappé');
  // an arrow glides: no face flies
  expect(await flown(page)).toEqual([]);
  expect(await page.evaluate(() => history.length)).toBe(before);
  const url = new URL(page.url());
  expect(url.pathname).toMatch(/^\/player\/fra\/\d+$/);
  if (layoutOf(info) === 'phone') {
    await page.goBack();
    await expect(screenOf(page)).toHaveCount(0);
    await expect(matchScreen(page).getByRole('tab', { name: 'Lineup', selected: true })).toBeVisible();
  }
});

test('scrolling frosts the bar and fades the arrows; the page keeps its scroll on return', async ({ page }) => {
  await open(page, '/player/fra/10?demo');
  const s = screenOf(page);
  const glass = s.locator('[data-pv="bar-glass"]');
  await expect(glass).toHaveCSS('opacity', '0');
  // the page scrolls 86 px at 844 tall (the Lua's max: its content less the screen): past the bar's 50 and the arrows' 90 almost
  await s.evaluate((el) => el.scrollTo(0, el.scrollHeight));
  await expect.poll(() => glass.evaluate((el) => Number(getComputedStyle(el).opacity))).toBeGreaterThan(0.99);
  await expect.poll(() => s.locator('[data-pv="prev"]').evaluate((el) => Number(getComputedStyle(el).opacity))).toBeLessThan(0.1);
});

test('a direct link works for a player in a match that has not started, and for one who is unknown', async ({ page }) => {
  await open(page, '/player/ita/10?demo');
  await expect(screenOf(page).locator('[data-pv="match"]')).toHaveAttribute('data-played', 'no');
  await expect(screenOf(page).getByText('Not started')).toBeVisible();
  await page.goto('/player/zzz/9?demo');
  await expect(screenOf(page).getByText('Not found')).toBeVisible();
});

test('a clock tick does not replay the entrance or rebuild the hero', async ({ page }) => {
  await open(page, '/player/fra/10?demo');
  // the hero, not the screen's loading heading: the photo it shows is the one that must last
  await expect(screenOf(page).locator('[data-pv="bust"] img')).toBeAttached();
  await page.evaluate(() => {
    const e = document.querySelector('[data-pv="bust"] img')!;
    (window as unknown as { __img: Element }).__img = e;
  });
  await page.waitForTimeout(2500);
  expect(await page.evaluate(() => (window as unknown as { __img: Element }).__img === document.querySelector('[data-pv="bust"] img'))).toBe(true);
  await expect(screenOf(page).locator('[data-pv="facts"]')).toHaveCSS('opacity', '1');
});

test.describe('reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });
  test('nothing flies and the page is complete at once', async ({ page }) => {
    await open(page, '/match/1/lineup?demo', 'match');
    await chip(page, 'fra-10').click();
    await expect(screenOf(page).getByRole('heading', { level: 1, name: 'Kylian Mbappé' })).toBeVisible();
    expect(await flown(page)).toEqual([]);
    await expect(screenOf(page).locator('[data-pv="bust"]')).toBeVisible();
    await expect(screenOf(page).locator('[data-pv="hero"]')).toHaveCSS('opacity', '1');
  });
});

test('a page shorter than the screen still pulls down under a finger and springs back (luau:8803)', async ({ page, context }, info) => {
  test.skip(layoutOf(info) !== 'phone', 'a touch gesture on the phone layout');
  await open(page, '/player/ita/1?demo');
  const cdp = await context.newCDPSession(page);
  await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 1 });
  const touch = (type: 'touchStart' | 'touchMove' | 'touchEnd', y = 0) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x: 190, y }] });
  const heading = screenOf(page).getByRole('heading', { level: 1 });
  const top = async () => (await heading.boundingBox())!.y;
  const rest = await top();
  await touch('touchStart', 300);
  for (let y = 320; y <= 500; y += 20) await touch('touchMove', y);
  // 200 px of finger, 0.4 of it for the page; the bar stays where it is
  expect((await top()) - rest).toBeCloseTo(80, 0);
  expect((await screenOf(page).locator('[data-pv="bar"]').boundingBox())!.y).toBeCloseTo(0, 0);
  await touch('touchEnd');
  await expect.poll(top).toBeCloseTo(rest, 0);
});
