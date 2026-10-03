import { expect, test, type Locator, type Page } from '@playwright/test';

/*
 * Part 13: the Lineup tab at 390 (phone), in the match pane at 900 and 1280. Numbers are the Lua's
 * at 390 (luau:5384-5697), relative to the match screen's top-left corner, so the same hold at
 * every width: the pane is as wide as the phone (390 at 1280, 407 at 900) and every x is kept from
 * the nearer edge. The demo feed (?demo) supplies the data: match 1 is France – Argentina in play
 * (4-2-3-1 and 4-3-3, both with real photos), 8 Sweden – Denmark finished (4-4-2), 11 Italy –
 * Japan before kick-off. Only France and Argentina have photos.
 */

const screen = (page: Page) => page.locator('[data-screen="match"][data-present="true"]');
const panel = (page: Page) => screen(page).getByRole('tabpanel');
const pitch = (page: Page) => screen(page).locator('[data-pitch]');
const marker = (page: Page, key: string) => screen(page).locator(`[data-pitch] [data-player="${key}"]`);

async function box(page: Page, el: Locator) {
  const [p, b] = await Promise.all([screen(page).boundingBox(), el.boundingBox()]);
  if (!p || !b) throw new Error('not on screen');
  return { x: b.x - p.x, y: b.y - p.y, w: b.width, h: b.height, r: p.x + p.width - (b.x + b.width) };
}

function near(actual: Record<string, number>, want: Record<string, number>, tol = 1.5) {
  for (const [k, v] of Object.entries(want)) expect(Math.abs(actual[k]! - v), `${k}: ${actual[k]} against ${v}`).toBeLessThanOrEqual(tol);
}

/** No flight running, the cascade landed and every marker has finished rising. */
async function settled(page: Page) {
  await expect.poll(() => page.evaluate(() => document.querySelectorAll('[data-shared-copy], [data-shared-flying], [data-present="false"]').length)).toBe(0);
  await expect
    .poll(() => panel(page).evaluate((el) => [getComputedStyle(el).opacity, getComputedStyle(el).transform, getComputedStyle(el.firstElementChild!).transform].join(' ')))
    .toBe('1 none none');
  await expect
    .poll(() =>
      page.evaluate(() =>
        [...document.querySelectorAll('[data-screen="match"][data-present="true"] [data-lineup] [data-row], [data-screen="match"][data-present="true"] [data-lineup] section button')].some((el) => {
          const host = el.closest('[data-row]') ?? el.parentElement!;
          const s = getComputedStyle(host);
          return s.opacity !== '1' || (s.transform !== 'none' && s.transform !== 'matrix(1, 0, 0, 1, 0, 0)');
        }),
      ),
    )
    .toBe(false);
}

async function open(page: Page, url: string) {
  await page.goto(url);
  await expect(screen(page).getByRole('heading', { level: 1 })).toBeAttached();
  await page.evaluate(() => document.fonts.ready);
  await settled(page);
}

test('the switch, the formation and the pitch sit where the Lua puts them', async ({ page }, info) => {
  await open(page, '/match/1/lineup?demo');
  const s = screen(page);
  await expect(s.getByRole('tab', { name: 'Lineup', selected: true })).toBeVisible();

  // under the tab bar (365.9, 38 + its rule): 22, the switch 46 tall, 22, "Formation" and 14 under it
  const tabs = await box(page, s.getByRole('tablist'));
  const sw = await box(page, s.getByRole('radiogroup', { name: 'Team' }));
  near(sw, { y: tabs.y + 39 + 22, x: 18, r: 18, h: 46 });
  const formation = s.getByRole('heading', { name: 'Formation' });
  near(await box(page, formation), { x: 18, y: sw.y + 46 + 22, h: 13.7 });
  await expect(s.getByText('4-2-3-1', { exact: true })).toBeVisible();

  // the pitch: 27.7 under its heading, 354 × 540 at 390
  const p = await box(page, pitch(page));
  near(p, { y: sw.y + 68 + 27.7, x: 18, r: 18, h: 540 });

  // rows from the keeper (34 above the bottom) to the forwards (98 under the top), evenly spaced; a
  // marker is 76 × 84 and its plate's centre line is 65 under its top
  const rows: Record<string, number> = { 'fra:16': 506, 'fra:19': 404, 'fra:17': 404, 'fra:14': 302, 'fra:20': 200, 'fra:10': 98 };
  for (const [key, y] of Object.entries(rows)) {
    const m = await box(page, marker(page, key));
    near(m, { y: p.y + y - 65, w: 76, h: 84 });
  }
  // the centre of a lone player, and the back four 84.5 apart
  near({ x: (await box(page, marker(page, 'fra:10'))).x + 38 - p.x }, { x: p.w / 2 });
  const [a, b, c, d] = await Promise.all(['fra:19', 'fra:17', 'fra:4', 'fra:5'].map(async (k) => (await box(page, marker(page, k))).x));
  const spacing = (p.w - 16) / 4;
  near({ ab: b! - a!, bc: c! - b!, cd: d! - c! }, { ab: spacing, bc: spacing, cd: spacing });

  // 34 under the pitch the substitutes, rows of 64
  const subs = s.getByRole('heading', { name: 'Substitutes' });
  near(await box(page, subs), { y: p.y + 540 + 34, x: 18 });
  await expect(s.getByText('0 of 5 used')).toBeVisible();
  const first = await box(page, s.getByRole('list', { name: 'Substitutes' }).locator('button').first());
  near(first, { y: p.y + 540 + 34 + 27.7, x: 12, r: 12, h: 64 });

  await page.screenshot({ path: info.outputPath('lineup.png') });
});

test('tags show the rating, the best player, goals and the followed star', async ({ page }) => {
  await open(page, '/match/1/lineup?demo');
  // Mbappé: two goals and the best rating of the eleven
  const mbappe = marker(page, 'fra:10');
  await expect(mbappe.getByRole('img', { name: /Rating \d\.\d, best in the match/ })).toBeVisible();
  await expect(mbappe.getByRole('img', { name: '2 goals' })).toBeVisible();
  // a rating on every starter, none of them best
  await expect(marker(page, 'fra:7').getByRole('img', { name: /^Rating \d\.\d$/ })).toBeVisible();
  // Argentina: the followed player (Messi, 10) has the star by his name; the match's goal is his
  await screen(page).getByRole('radio', { name: 'Argentina' }).click();
  await settled(page);
  const messi = marker(page, 'arg:10');
  await expect(messi.locator('svg[viewBox="-1 -1 2 2"]').first()).toBeVisible();
  await expect(messi.getByRole('img', { name: '1 goal' })).toBeVisible();
  // a player who went off in the match wears the capsule
  await expect(screen(page).locator('[data-pitch]').getByRole('img', { name: /^Off \d+'$/ }).first()).toBeVisible();
});

test('the switch shows the other team and plays its entrance again', async ({ page }) => {
  await open(page, '/match/1/lineup?demo');
  const s = screen(page);
  await expect(s.getByRole('radio', { name: 'France', checked: true })).toBeVisible();
  const thumb = s.locator('[data-thumb]');
  await expect(thumb).toHaveAttribute('data-thumb', 'home');
  await s.getByRole('radio', { name: 'Argentina' }).click();
  // the thumb slides across and takes Argentina's colours
  await expect(thumb).toHaveAttribute('data-thumb', 'away');
  await expect(s.getByRole('radio', { name: 'Argentina', checked: true })).toBeVisible();
  await expect(s.getByText('4-3-3', { exact: true })).toBeVisible();
  await expect(marker(page, 'arg:10')).toBeVisible();
  await expect(marker(page, 'fra:10')).toHaveCount(0);
  await settled(page);
  // the side lasts over a tab change (luSide)
  await s.getByRole('tab', { name: 'Stats', exact: true }).click();
  await s.getByRole('tab', { name: 'Lineup', exact: true }).click();
  await expect(s.getByRole('radio', { name: 'Argentina', checked: true })).toBeVisible();
});

test('markers rise line by line, forwards first', async ({ page }) => {
  await page.goto('/match/1/lineup?demo');
  await expect(screen(page).getByRole('heading', { level: 1 })).toBeAttached();
  // sample each marker's opacity every frame until the keeper is in
  const order = await page.evaluate(
    () =>
      new Promise<string[]>((done) => {
        const seen: string[] = [];
        const t0 = performance.now();
        const tick = () => {
          for (const b of document.querySelectorAll<HTMLElement>('[data-screen="match"][data-present="true"] [data-pitch] [data-player]')) {
            const op = Number(getComputedStyle(b.parentElement!).opacity);
            if (op > 0.05 && !seen.includes(b.dataset.player!)) seen.push(b.dataset.player!);
          }
          if (seen.length === 11 || performance.now() - t0 > 6000) done(seen);
          else requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      }),
  );
  expect(order).toHaveLength(11);
  // 4-2-3-1: 10 | 20, 7, 11 | 14, 8 | the back four | 16
  expect(order[0]).toBe('fra:10');
  expect(order.slice(1, 4).sort()).toEqual(['fra:11', 'fra:20', 'fra:7']);
  expect(order.slice(4, 6).sort()).toEqual(['fra:14', 'fra:8']);
  expect(order.slice(6, 10).sort()).toEqual(['fra:17', 'fra:19', 'fra:4', 'fra:5']);
  expect(order[10]).toBe('fra:16');
});

test('a clock tick does not rebuild the pitch or play the entrance again', async ({ page }) => {
  await open(page, '/match/1/lineup?demo');
  await page.evaluate(() => {
    for (const b of document.querySelectorAll('[data-screen="match"][data-present="true"] [data-pitch] [data-player]')) (b as HTMLElement & { __same?: boolean }).__same = true;
  });
  const clock = screen(page).getByText(/^\d{2}:\d{2}$/).first();
  const before = await clock.textContent();
  await expect(clock).not.toHaveText(before!);
  const st = await page.evaluate(() => {
    const bs = [...document.querySelectorAll<HTMLElement & { __same?: boolean }>('[data-screen="match"][data-present="true"] [data-pitch] [data-player]')];
    return { same: bs.every((b) => b.__same), still: bs.every((b) => getComputedStyle(b.parentElement!).opacity === '1') };
  });
  expect(st).toEqual({ same: true, still: true });
});

test('photos: France and Argentina have them, another team keeps the kit disc, one manifest request', async ({ page }) => {
  const manifests: string[] = [];
  page.on('request', (r) => r.url().endsWith('/img/players/manifest.json') && manifests.push(r.url()));
  await open(page, '/match/1/lineup?demo');
  const m = marker(page, 'fra:10');
  await expect(m.locator('[data-photo="bust"] img')).toBeVisible();
  // the AVIF source ahead of the WebP, both widths, no head asset upscaled
  await expect(m.locator('picture source')).toHaveAttribute('type', 'image/avif');
  await expect(m.locator('picture source')).toHaveAttribute('srcset', '/img/players/fra/10-bust@1x.avif 288w, /img/players/fra/10-bust@2x.avif 576w');
  await expect.poll(() => m.locator('img').evaluate((i: HTMLImageElement) => i.complete && i.naturalWidth > 0)).toBe(true);
  // the pitch's photos load at once, the squad's are lazy
  expect(await m.locator('img').getAttribute('loading')).toBe('eager');
  const row = screen(page).getByRole('list', { name: 'Substitutes' }).locator('button img').first();
  expect(await row.getAttribute('loading')).toBe('lazy');
  // the coach has a photo too, without a shirt number
  await screen(page).locator('section[aria-label="Coach"]').scrollIntoViewIfNeeded();
  await expect(screen(page).locator('section[aria-label="Coach"] [data-photo="bust"] img')).toBeAttached();
  expect(manifests).toHaveLength(1);

  // Sweden has none: a kit disc with the shirt number, and the plate leaves the number out (a new
  // page load asks once more)
  manifests.length = 0;
  await open(page, '/match/8/lineup?demo');
  const isak = marker(page, 'swe:9');
  await expect(isak.locator('[data-kit-disc="swe"]')).toBeVisible();
  await expect(isak.locator('img')).toHaveCount(0);
  expect(manifests).toHaveLength(1);
});

test('a chip opens the player through the app’s navigation, and back returns to the same tab and team', async ({ page }, info) => {
  await open(page, '/match/1/lineup?demo');
  await screen(page).getByRole('radio', { name: 'Argentina' }).click();
  await settled(page);
  await marker(page, 'arg:10').click();
  await expect(page).toHaveURL(/\/player\/arg\/10\?demo$/);
  await page.goBack();
  await expect(page).toHaveURL(/\/match\/1\/lineup\?demo$/);
  await settled(page);
  await expect(marker(page, 'arg:10')).toBeFocused();
  await expect(screen(page).getByRole('tab', { name: 'Lineup', selected: true })).toBeVisible();
  // a substitute opens the player too
  const sub = screen(page).getByRole('list', { name: 'Substitutes' }).locator('button').first();
  const key = await sub.getAttribute('data-player');
  await sub.click();
  await expect(page).toHaveURL(new RegExp(`/player/${key!.replace(':', '/')}\\?demo$`));
  void info;
});

test('before kick-off the tab is the squad, line by line', async ({ page }, info) => {
  await open(page, '/match/11/lineup?demo');
  const s = screen(page);
  await expect(s.getByRole('tab', { name: 'Squad', selected: true })).toBeVisible();
  await expect(s.getByText('Line-ups are not out yet')).toBeVisible();
  await expect(s.getByText('They are confirmed about an hour before kick-off.')).toBeVisible();
  await expect(pitch(page)).toHaveCount(0);
  for (const name of ['Goalkeepers', 'Defenders', 'Midfielders', 'Forwards']) await expect(s.getByRole('region', { name })).toBeVisible();
  // the note is 52 tall, 22 under the switch, the first heading 30 under it
  const sw = await box(page, s.getByRole('radiogroup', { name: 'Team' }));
  const note = await box(page, s.getByText('Line-ups are not out yet').locator('..'));
  near(note, { y: sw.y + 68, h: 52, x: 18, r: 18 });
  near(await box(page, s.getByRole('heading', { name: 'Goalkeepers' })), { y: note.y + 52 + 30 });
  await s.getByRole('radio', { name: 'Japan' }).click();
  await settled(page);
  await expect(s.getByRole('radio', { name: 'Japan', checked: true })).toBeVisible();
  await expect(s.locator('section[aria-label="Coach"]')).toBeAttached();
  await page.screenshot({ path: info.outputPath('squad.png') });
});

test('nothing overflows sideways', async ({ page }) => {
  for (const url of ['/match/1/lineup?demo', '/match/8/lineup?demo', '/match/11/lineup?demo']) {
    await open(page, url);
    const over = await page.evaluate(() => {
      const s = document.querySelector('[data-screen="match"][data-present="true"]')!;
      const box = s.getBoundingClientRect();
      // a bust runs on past its box (the box clips it), so the images are left out
      const wide = [...s.querySelectorAll('[data-lineup] *')].filter((el) => el.tagName !== 'IMG').filter((el) => {
        const b = el.getBoundingClientRect();
        return b.width > 0 && (b.left < box.left - 1 || b.right > box.right + 1);
      });
      let sc: Element | null = s;
      while (sc && sc.scrollWidth <= sc.clientWidth + 1) sc = sc.parentElement;
      return { wide: wide.map((e) => e.className || e.tagName).slice(0, 5), scrolls: sc ? sc.tagName : null };
    });
    expect(over, url).toEqual({ wide: [], scrolls: null });
  }
});

test('with reduced motion the line-up is in place at once', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/match/1/lineup?demo');
  await expect(screen(page).getByRole('heading', { level: 1 })).toBeAttached();
  await expect(marker(page, 'fra:16')).toBeVisible();
  const states = await page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>('[data-screen="match"][data-present="true"] [data-pitch] [data-player]')].map((b) => {
      const s = getComputedStyle(b.parentElement!);
      return [s.opacity, s.transform];
    }),
  );
  expect(states).toHaveLength(11);
  for (const [op] of states) expect(op).toBe('1');
});
