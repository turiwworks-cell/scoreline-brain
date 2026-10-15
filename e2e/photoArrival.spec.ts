import { expect, test, type Page } from '@playwright/test';

/*
 * The profile's bust and its file (Scene.tsx, useArrival; screenChunks.ts, prepareScreen): the
 * entrance never plays over an empty cell, a late file comes in on its own, and a tap on a player
 * starts his file from the press rather than from the page it opens.
 */

const pane = (page: Page) => page.locator('[data-screen="player"][data-present="true"]');
const BUST = /\/img\/players\/[a-z]+\/\d+-bust@[12]x\.(avif|webp)$/;

/** Hold every bust file `ms` before it is answered: a slow network, for the photos only. */
async function slowBusts(page: Page, ms: number) {
  await page.route(BUST, async (route) => {
    await new Promise((r) => setTimeout(r, ms));
    await route.continue();
  });
}

/** Every frame from the document's start: the bust's opacity as drawn and whether its file is there. */
async function sampleFrames(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as { __frames: { t: number; o: number; loaded: boolean; state?: string }[] };
    w.__frames = [];
    const tick = () => {
      const hero = [...document.querySelectorAll<HTMLElement>('[data-screen="player"][data-present="true"] [data-pv="hero"]')].pop();
      const art = hero?.firstElementChild as HTMLElement | undefined;
      const img = hero?.querySelector('img');
      if (art && img) w.__frames.push({ t: performance.now(), o: Number(getComputedStyle(art).opacity), loaded: img.complete && img.naturalWidth > 0, state: hero!.dataset.photo });
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}
const frames = (page: Page) => page.evaluate(() => (window as unknown as { __frames: { t: number; o: number; loaded: boolean; state?: string }[] }).__frames);

test('a late bust: the page opens without it, nothing moves in an empty cell, and it comes in on its own', async ({ page }) => {
  await slowBusts(page, 1200);
  await sampleFrames(page);
  await page.goto('/player/fra/10?demo&live=0');
  // the name and the facts are there while the file is still on its way
  await expect(pane(page).getByRole('heading', { name: 'Kylian Mbappé', level: 1 })).toBeVisible();
  await expect(pane(page).locator('[data-pv="hero"]')).toHaveAttribute('data-photo', 'waiting');
  await expect(pane(page).locator('[data-pv="hero"]')).toHaveAttribute('data-photo', 'ready', { timeout: 5000 });
  await expect.poll(async () => (await frames(page)).at(-1)?.o ?? 0).toBe(1);
  const f = await frames(page);
  // never drawn without its file
  expect(f.filter((x) => x.o > 0.01 && !x.loaded)).toEqual([]);
  // and it came in over its own short fade (LATE, 0.32 s), not in one step
  const first = f.find((x) => x.o > 0.01)!;
  const full = f.find((x) => x.o >= 0.999)!;
  expect(full.t - first.t).toBeGreaterThan(150);
});

test('a bust already there plays the entrance as it always did', async ({ page }) => {
  await page.goto('/player/fra/10?demo&live=0');
  const hero = pane(page).locator('[data-pv="hero"]');
  await expect(hero).toHaveAttribute('data-photo', 'ready');
  await expect.poll(() => hero.evaluate((h) => Number(getComputedStyle(h.firstElementChild!).opacity))).toBe(1);
  // the same page again, the file in the cache: never drawn while waiting
  await sampleFrames(page);
  await page.reload();
  await expect(hero).toHaveAttribute('data-photo', 'ready');
  const f = await frames(page);
  expect(f.filter((x) => x.state === 'waiting' && x.o > 0.01)).toEqual([]);
});

test('pressing a player starts his bust before his page opens, and the page uses that request', async ({ page }) => {
  const asked: { url: string; at: number }[] = [];
  page.on('request', (r) => {
    if (BUST.test(new URL(r.url()).pathname) && /\/fra\/10-bust@/.test(r.url())) asked.push({ url: r.url(), at: Date.now() });
  });
  await page.goto('/match/1/lineup?demo&live=0');
  const chip = page.locator('[data-focus-key="chip-fra-10"]');
  await expect(chip).toBeVisible();
  const box = (await chip.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  const pressed = Date.now();
  await page.mouse.down();
  await expect.poll(() => asked.length).toBeGreaterThan(0);
  expect(page.url()).toContain('/match/1/lineup');
  expect(asked[0]!.at - pressed).toBeLessThan(1000);
  await page.mouse.up();
  await expect(pane(page).getByRole('heading', { name: 'Kylian Mbappé', level: 1 })).toBeVisible();
  await expect(pane(page).locator('[data-pv="hero"]')).toHaveAttribute('data-photo', 'ready');
  // one file, asked for once
  expect(new Set(asked.map((a) => a.url)).size).toBe(1);
  expect(asked).toHaveLength(1);
});

test('once his bust is in, the two players the arrows lead to are fetched, and no one else', async ({ page }) => {
  // (the list under the page follows Argentina's 10: France's busts are his and his neighbours' only)
  const asked = new Set<string>();
  page.on('request', (r) => {
    const m = /\/img\/players\/(fra\/\d+)-bust@/.exec(r.url());
    if (m) asked.add(m[1]!);
  });
  await page.goto('/player/fra/10?demo&live=0');
  await expect(pane(page).locator('[data-pv="hero"]')).toHaveAttribute('data-photo', 'ready');
  await expect.poll(() => asked.size, { timeout: 5000 }).toBeGreaterThanOrEqual(3);
  await page.waitForTimeout(800);
  expect(asked.size).toBe(3);
  expect(asked.has('fra/10')).toBe(true);
  // a step lands on a picture that is already there
  await pane(page).getByRole('button', { name: 'Next player' }).click();
  await expect(pane(page).locator('[data-pv="hero"]').last()).toHaveAttribute('data-photo', 'ready');
});
