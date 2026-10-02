import { expect, test } from '@playwright/test';

test('dev kit renders every material', async ({ page }, info) => {
  await page.goto('/dev/kit');
  await expect(page.getByTestId('dev-kit')).toBeVisible();
  for (const name of ['Colours', 'Spectrum', 'Type scale', 'Glass', 'SoftLight', 'Hover light', 'Button', 'Pill', 'Tabs', 'Icons', 'Tags', 'RatingBadge', 'MatchClock', 'PlayerPhoto', 'Feed crests', 'Teams', 'Squad photos', 'Photos in place', 'Bust, head, frost']) {
    await expect(page.getByRole('region', { name, exact: true })).toBeVisible();
  }
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: `test-results/kit-${info.project.name}.png`, fullPage: true });
});

test('the hover light follows the pointer through custom properties', async ({ page }, info) => {
  test.skip(info.project.name.startsWith('phone'), 'hover is desktop only');
  await page.goto('/dev/kit');
  const pad = page.getByTestId('hover-pad');
  await pad.scrollIntoViewIfNeeded();
  const box = (await pad.boundingBox())!;
  await page.mouse.move(box.x + 60, box.y + 40);
  await page.mouse.move(box.x + 80, box.y + 50);
  await expect.poll(() => pad.evaluate((el) => el.style.getPropertyValue('--mx'))).toBe('80px');
  await expect.poll(() => pad.evaluate((el) => getComputedStyle(el).getPropertyValue('--lit').trim())).toBe('1');
});

test('a glass pane nested in a tinted pane keeps the plain glass colour', async ({ page }) => {
  await page.goto('/dev/kit');
  const bg = (id: string) =>
    // the last background layer is the pane colour
    page.getByTestId(id).evaluate((el) => getComputedStyle(el).backgroundColor);
  expect(await bg('tinted-card')).toBe('rgb(11, 43, 29)');
  const plain = await page.locator('.m-glass:not([style*="--glass-tint"])').first().evaluate((el) => getComputedStyle(el).backgroundColor);
  // same colour as a pane that sits in no tinted pane, and not the parent's tint
  expect(await bg('nested-pill')).toBe(plain);
  expect(plain).not.toBe('rgb(11, 43, 29)');
});

test('the Part 7 primitives draw from the sprite and fit the page', async ({ page }) => {
  await page.goto('/dev/kit');
  await expect(page.getByTestId('dev-kit')).toBeVisible();
  // every <use> points at a symbol in the one sprite
  const missing = await page.evaluate(() =>
    [...document.querySelectorAll('use')].map((u) => u.getAttribute('href')!).filter((h) => !document.querySelector(`symbol${h}`)),
  );
  expect(missing).toEqual([]);
  expect(await page.getByTestId('icon-sprite').count()).toBe(1);
  // tags draw at their own size
  const tag = page.locator('[data-tag="goal"]').first();
  const box = (await tag.boundingBox())!;
  expect(Math.round(box.width)).toBe(14);
  // every demo team row draws its crest, clipped to a circle, inside the column
  const rows = page.getByTestId('kit-teams').locator('li');
  expect(await rows.count()).toBe(23);
  const overflow = await page.getByTestId('kit-teams').evaluate((ul) =>
    [...ul.querySelectorAll('li')].filter((li) => li.scrollWidth > li.clientWidth + 1).map((li) => li.dataset.team),
  );
  expect(overflow).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width);
});

test('a photo that fails to load falls back to the kit disc', async ({ page }) => {
  await page.goto('/dev/kit');
  await expect(page.getByTestId('broken-photo')).toHaveAttribute('data-photo', 'kit');
});

test('live clocks tick from the shared ticker', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-10-02T20:00:00Z') });
  await page.goto('/dev/kit');
  const clock = page.getByTestId('clock-Live');
  await expect(clock).toHaveText("58'");
  await page.clock.runFor(25_000);
  await expect(clock).toHaveText("59'");
  await expect(page.getByTestId('clock-Added time')).toHaveText("90+2'");
  await expect(page.getByTestId('clock-Scheduled')).toHaveText('20:45');
});

// Part 8: the photos load, as AVIF, and each box takes the smallest file that covers it.
async function photoLoads(page: import('@playwright/test').Page) {
  await page.goto('/dev/kit');
  const imgs = page.locator('[data-testid^="photos-"] img, [data-testid="photo-kinds"] img');
  await expect(imgs).toHaveCount(52 + 6 * 4);
  for (const img of await imgs.all()) await img.scrollIntoViewIfNeeded();
  await page.waitForFunction(() => [...document.querySelectorAll('[data-testid^="photos-"] img, [data-testid="photo-kinds"] img')].every((i) => (i as HTMLImageElement).complete));
  return page.evaluate(() =>
    [...document.querySelectorAll('section img')]
      .filter((i) => (i as HTMLImageElement).currentSrc.includes('/img/players/'))
      .map((i) => ({ src: (i as HTMLImageElement).currentSrc.replace(location.origin, ''), ok: (i as HTMLImageElement).naturalWidth > 0, w: (i as HTMLImageElement).width })),
  );
}

// Chromium reuses a file already loaded for a larger box on the same page, so a box may show
// a bigger file than it asked for only when that file is also some other box's own pick.
const reused = (imgs: { src: string; w: number }[], needs: (i: { src: string; w: number }) => boolean) => new Set(imgs.filter(needs).map((i) => i.src));

test('every squad photo loads as AVIF, at 1x on a 1x screen', async ({ page }) => {
  const imgs = await photoLoads(page);
  expect(imgs.filter((i) => !i.ok)).toEqual([]);
  expect(imgs.filter((i) => !i.src.endsWith('.avif'))).toEqual([]);
  // only the frost stretched to the 144 px bust box needs its 144 px file
  const big = reused(imgs, (i) => i.src.includes('-frost@') && i.w === 144);
  expect(imgs.filter((i) => i.src.includes('@2x') && !big.has(i.src))).toEqual([]);
  expect(big.size).toBe(6);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width);
});

test.describe('on a 2x screen', () => {
  test.use({ deviceScaleFactor: 2 });
  test('boxes wider than half a file take @2x, small tiles keep @1x', async ({ page }) => {
    const imgs = await photoLoads(page);
    expect(imgs.filter((i) => !i.ok)).toEqual([]);
    // the 140 px card draws the bust 240 px wide: 480 device px needs the 576 file
    const card = imgs.filter((i) => i.w === 240);
    expect(card.length).toBe(2);
    expect(card.every((i) => i.src.includes('-bust@2x.avif'))).toBe(true);
    // a 52 px tile draws it 89 px wide: 178 device px, the 288 file covers it
    const big = reused(imgs, (i) => i.w === 240);
    const tiles = imgs.filter((i) => Math.round(i.w) === 89);
    expect(tiles.length).toBeGreaterThanOrEqual(52);
    expect(tiles.filter((i) => !i.src.includes('-bust@1x.avif') && !big.has(i.src))).toEqual([]);
    // the heads and frosts at their @1x box take the atlas's own pixels
    expect(imgs.filter((i) => /-(head|frost)@/.test(i.src)).every((i) => i.src.includes('@2x'))).toBe(true);
  });
});
