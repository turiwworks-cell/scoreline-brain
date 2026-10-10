import { expect, test, type Page } from '@playwright/test';
import { demoFeedJson } from '../src/domain/testing/demo';

const screen = (page: Page, name: string) => page.locator(`[data-screen="${name}"][data-present="true"]`);

// These scenarios use the same backend/proxy as the existing API browser checks.
const trigger = async (page: Page, name: string) => {
  expect((await page.request.post(`/api/trigger?name=${name}`)).status()).toBe(200);
};

test('a cold selected player photo starts while its screen chunk is still downloading', async ({ page }) => {
  let release!: () => void;
  const held = new Promise<void>(done => { release = done; });
  let requested = false;
  page.on('request', request => { if (/\/img\/players\/fra\/16-bust@/.test(request.url())) requested = true; });
  await page.route(/\/assets\/PlayerScreen-[^/]+\.js$/, async route => { await held; await route.continue(); });
  try {
    await page.goto('/player/fra/16?demo', { waitUntil: 'domcontentloaded' });
    await expect(screen(page, 'player').getByRole('heading', { name: 'Loading…' })).toBeVisible();
    await expect.poll(() => requested, { timeout: 2000 }).toBe(true);
    release();
    await expect(screen(page, 'player').getByRole('heading', { name: 'Mike Maignan' })).toBeVisible();
    const photo = screen(page, 'player').locator('[data-pv="bust"] img');
    await expect.poll(() => photo.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
    const source = await photo.evaluate((img: HTMLImageElement) => img.currentSrc);
    await page.reload();
    await expect(screen(page, 'player').getByRole('heading', { name: 'Mike Maignan' })).toBeVisible();
    await expect.poll(() => photo.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
    expect(await photo.evaluate((img: HTMLImageElement) => img.currentSrc)).toBe(source);
  } finally { release(); }
});

test('desktop Leaders starts its rows promptly on first and repeat entry', async ({ page }, info) => {
  test.skip(info.project.name.startsWith('phone'), 'Leaders lives in the desktop third pane');
  await page.goto('/?demo');
  const pane = page.locator('[data-pane="insights"]');
  const leaders = pane.getByRole('tab', { name: 'Leaders', exact: true });
  for (let i = 0; i < 2; i++) {
    const opacity = await leaders.evaluate(button => new Promise<number>(done => {
      let started = 0;
      (button as HTMLButtonElement).click();
      const tick = (now: number) => {
        const row = document.querySelector('[data-insight-leader]');
        if (!row) { requestAnimationFrame(tick); return; }
        if (!started) started = now;
        if (now - started < 250) { requestAnimationFrame(tick); return; }
        done(Number(getComputedStyle(row).opacity));
      };
      requestAnimationFrame(tick);
    }));
    expect(opacity).toBeGreaterThan(0.5);
    await expect(pane.locator('[data-insight-leader]')).toHaveCount(8);
    await pane.getByRole('tab', { name: 'Tables', exact: true }).click();
    await expect(pane.locator('[data-insight-leader]')).toHaveCount(0);
  }
});

test('scheduled Squad text can appear while the photo manifest is still pending', async ({ page }) => {
  let release!: () => void;
  const held = new Promise<void>(done => { release = done; });
  await page.route('**/img/players/manifest.json', async route => { await held; await route.continue(); });
  try {
    await page.goto('/match/11/lineup?demo', { waitUntil: 'domcontentloaded' });
    await expect(screen(page, 'match').getByRole('tab', { name: 'Squad', selected: true })).toBeVisible();
    const row = screen(page, 'match').locator('[data-player]').first();
    await expect.poll(() => row.evaluate(el => Number(getComputedStyle(el.parentElement!).opacity)), { timeout: 1500 }).toBeGreaterThan(0.99);
    release();
    await expect(row).toBeVisible();
  } finally { release(); }
});

test('Show all reveals the last row of an 80-event feed within a bounded interval', async ({ page }) => {
  const feed = demoFeedJson();
  const match = feed.matches[0]!;
  const template = match.events![0]!;
  match.events = Array.from({ length: 80 }, (_, i) => ({ ...template, id: `long-${i}`, seq: i + 1, kind: 'miss', minute: Math.floor(i / 2) + 1 }));
  await page.route('**/api/feed', route => route.fulfill({ json: feed }));
  await page.route('**/api/events*', route => route.fulfill({ contentType: 'text/event-stream', body: ': connected\n\n' }));
  await page.goto('/match/1/facts?api');
  const all = screen(page, 'match').getByRole('button', { name: 'Show all 80 events' });
  await expect(all).toBeVisible();
  const lastOpacity = await all.evaluate(button => new Promise<number>(done => {
    const start = performance.now();
    (button as HTMLButtonElement).click();
    const tick = () => {
      if (performance.now() - start < 1400) { requestAnimationFrame(tick); return; }
      const rows = document.querySelectorAll('[data-screen="match"][data-present="true"] [data-row="e"]');
      done(Number(getComputedStyle(rows[rows.length - 1]!.firstElementChild!).opacity));
    };
    requestAnimationFrame(tick);
  }));
  expect(lastOpacity).toBeGreaterThan(0.99);
  await expect(screen(page, 'match').locator('[data-row="e"]')).toHaveCount(80);
  await screen(page, 'match').getByRole('button', { name: 'Show less', exact: true }).click();
  await expect(screen(page, 'match').locator('[data-row="e"]')).toHaveCount(10);
});

test('reduced motion keeps Follow, groups, live scores and player counters current without movement', async ({ page }, info) => {
  test.skip(!info.project.name.startsWith('phone'), 'one shared backend drives the sent-off followed player once');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(() => localStorage.setItem('scoreline:follow', JSON.stringify({ team: 'arg', n: 10 })));
  await page.goto('/?api');
  const list = screen(page, 'list');
  const card = list.locator('[data-phase]');
  const following = list.getByRole('region', { name: 'Following' });
  await expect(list.getByRole('button', { name: /Lionel Messi, the player you follow/ })).toBeVisible();
  const live = list.getByRole('button', { name: /^Live,/ });
  await expect(live.locator('canvas')).toHaveCount(0);
  await expect(live.locator('[data-live-still]')).toHaveCount(1);
  await live.click();
  await expect(live).toHaveAttribute('aria-pressed', 'false');
  await expect(live.locator('[data-live-off]')).toHaveCount(1);
  const count = (await live.getAttribute('aria-label'))!.match(/Live, (\d+)/)![1]!;
  if (count !== '0') expect(await live.locator('use[href^="#ld"]').evaluateAll(els => els.map(el => el.getAttribute('href')!.slice(3)).join(''))).toBe(count);
  const liveBox = await live.boundingBox();
  expect(Math.abs(liveBox!.width - 110)).toBeLessThan(0.1);
  expect(liveBox!.height).toBe(40);
  await expect(live.locator('canvas, .m-light')).toHaveCount(0);
  await live.click();
  await expect(live).toHaveAttribute('aria-pressed', 'true');
  await expect(live.locator('[data-live-off]')).toHaveCount(0);
  await expect(live.locator('[data-live-still]')).toHaveCount(1);

  const collapse = await list.getByRole('button', { name: 'Show less', exact: true }).evaluate(button => new Promise<{ k: number; height: number }>(done => {
    (button as HTMLButtonElement).click();
    requestAnimationFrame(() => {
      const card = document.querySelector<HTMLElement>('[data-screen="list"] [data-phase]')!;
      done({ k: Number(getComputedStyle(card).getPropertyValue('--k')), height: card.getBoundingClientRect().height });
    });
  }));
  expect(collapse.k).toBe(0);
  expect(collapse.height).toBeCloseTo(64, 1);
  await list.getByRole('button', { name: 'Show more', exact: true }).click();
  await expect(card).toHaveAttribute('data-open', 'true');
  await following.getByRole('button', { name: 'Change', exact: true }).click();
  await expect.poll(() => following.locator('[aria-pressed]').count()).toBeGreaterThan(0);
  expect(await following.evaluate(el => [...el.querySelectorAll('*')].every(child => getComputedStyle(child).animationName === 'none'))).toBe(true);
  await following.getByRole('button', { name: 'Done', exact: true }).click();

  const group = list.locator('[data-group="fav"]');
  await expect(group).toBeVisible();
  const groupK = await group.getByRole('button').first().evaluate(button => new Promise<number>(done => {
    (button as HTMLButtonElement).click();
    requestAnimationFrame(() => done(Number(getComputedStyle(button.closest('[data-group]')!).getPropertyValue('--k'))));
  }));
  expect(groupK).toBe(0);
  await expect(group.getByRole('list', { includeHidden: true })).toHaveCSS('visibility', 'hidden');
  await group.getByRole('button').first().click();

  await trigger(page, 'goalHome');
  await expect(page.getByTestId('moment-toast')).toBeVisible();
  expect(await list.locator('[data-card]').evaluateAll(els => els.every(el => {
    const s = getComputedStyle(el);
    return ['--gdy', '--gsc', '--sweep-y', '--bump-h', '--bump-a'].every(key => s.getPropertyValue(key).trim() === '');
  }))).toBe(true);
  await page.getByTestId('moment-toast').getByRole('button').press('Escape');
  await expect(page.getByTestId('moment-toast')).toHaveCount(0);
  await trigger(page, 'redFavorite');
  await expect(card).toHaveAttribute('data-phase', 'red');
  await expect(card).toHaveCSS('transform', 'none');
  await expect(card).toHaveCSS('--shake', '0');
  await expect(card).toHaveCSS('--rt', '1');
  await page.getByTestId('moment-toast').getByRole('button').press('Escape');
  await expect(page.getByTestId('moment-toast')).toHaveCount(0);

  // The sheet's first painted value is already its provider target.
  const rating = await list.getByRole('button', { name: /Lionel Messi, the player you follow/ }).evaluate(button => new Promise<{ target: string; value: string }>(done => {
    (button as HTMLButtonElement).click();
    const tick = () => {
      const rating = document.querySelector('[data-screen="player"][data-present="true"] [data-pv="rating"]');
      if (!rating) { requestAnimationFrame(tick); return; }
      done({ target: rating.getAttribute('aria-label')!.replace('Rating ', ''), value: rating.firstElementChild!.textContent! });
    };
    requestAnimationFrame(tick);
  }));
  expect(rating.value).toBe(rating.target);
  const player = screen(page, 'player');
  await expect(player.getByRole('heading', { name: 'Lionel Messi' })).toBeVisible();
  await player.evaluate(el => {
    el.scrollTop = 0;
    el.dispatchEvent(new TouchEvent('touchstart', { touches: [new Touch({ identifier: 1, target: el, clientX: 100, clientY: 100 })] }));
    el.dispatchEvent(new TouchEvent('touchmove', { cancelable: true, touches: [new Touch({ identifier: 1, target: el, clientX: 100, clientY: 160 })] }));
  });
  expect(await player.getAttribute('data-pull')).toBeNull();
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await expect(live.locator('canvas')).toHaveCount(1);
  await player.evaluate(el => {
    el.dispatchEvent(new TouchEvent('touchstart', { touches: [new Touch({ identifier: 1, target: el, clientX: 100, clientY: 100 })] }));
    el.dispatchEvent(new TouchEvent('touchmove', { cancelable: true, touches: [new Touch({ identifier: 1, target: el, clientX: 100, clientY: 160 })] }));
  });
  await expect(player).toHaveAttribute('data-pull', '');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(live.locator('canvas')).toHaveCount(0);
  await expect(player).not.toHaveAttribute('data-pull');
});

test('phone first and repeat match navigation restore a usable list and its scroll', async ({ page }, info) => {
  test.skip(!info.project.name.startsWith('phone'), 'phone push/pop');
  await page.goto('/?demo');
  const list = screen(page, 'list');
  const row = list.locator('[data-focus-key="match-2"]');
  await expect(row).toBeVisible();
  await expect.poll(() => page.evaluate(() => performance.getEntriesByType('resource').some(e => /\/MatchScreen-[^/]+\.js$/.test(e.name)))).toBe(true);
  await page.evaluate(() => new Promise<void>(done => requestAnimationFrame(() => requestAnimationFrame(() => done()))));
  for (let i = 0; i < 2; i++) {
    await row.scrollIntoViewIfNeeded();
    const frames = await row.evaluate(button => new Promise<{ title: string | null; x: number[]; scroll: number }>(done => {
      const x: number[] = [];
      const start = performance.now();
      const list = button.closest('[data-screen]')!;
      // Make the reported ordering deterministic: do not yield between the final scroll
      // and the tap, so its native scroll event has not yet saved the departing entry.
      list.scrollTop += 80;
      const scroll = list.scrollTop;
      (button as HTMLButtonElement).click();
      const tick = () => {
        const pane = document.querySelector<HTMLElement>('[data-screen="match"][data-present="true"]')!;
        x.push(new DOMMatrix(getComputedStyle(pane).transform).m41);
        if (performance.now() - start < 1000) { requestAnimationFrame(tick); return; }
        done({ title: pane.querySelector('[data-screen-heading]')?.textContent ?? null, x, scroll });
      };
      requestAnimationFrame(tick);
    }));
    expect(frames.title).toBe('England – Brazil');
    expect(frames.x[0]).toBeGreaterThan(100);
    expect(frames.x.at(-1)).toBeCloseTo(0, 1);
    expect(new Set(frames.x.map(v => v.toFixed(2))).size).toBeGreaterThan(10);
    await expect(list).toHaveAttribute('inert', '');
    await expect(screen(page, 'match')).not.toHaveAttribute('inert');
    await page.goBack();
    await expect(screen(page, 'match')).toHaveCount(0);
    await expect(list).not.toHaveAttribute('inert');
    await expect(row).toBeFocused();
    expect(await list.evaluate(el => el.scrollTop)).toBeCloseTo(frames.scroll, 0);
    await expect(row).toBeEnabled();
  }
});

test('phone goal and red-card toasts survive succession and early dismissal', async ({ page }, info) => {
  test.skip(!info.project.name.startsWith('phone'), 'phone notification check');
  await page.addInitScript(() => localStorage.setItem('scoreline:follow', 'none'));
  await page.goto('/?api');
  await expect(screen(page, 'list').locator('[data-card="1"]')).toBeVisible();
  await trigger(page, 'goalAway');
  const toast = page.getByTestId('moment-toast');
  await expect(toast).toHaveAttribute('data-variant', 'goal');
  const y = await toast.evaluate(el => new Promise<number[]>(done => {
    const values: number[] = [];
    const start = performance.now();
    const tick = () => {
      values.push(new DOMMatrix(getComputedStyle(el).transform).m42);
      if (performance.now() - start < 800) { requestAnimationFrame(tick); return; }
      done(values);
    };
    requestAnimationFrame(tick);
  }));
  expect(y.at(-1)).toBeCloseTo(0, 1);
  expect(y.every((v, i) => i === 0 || v >= y[i - 1]! - 0.1)).toBe(true);
  await trigger(page, 'redAway');
  await toast.getByRole('button').press('Escape');
  await expect(toast).toHaveAttribute('data-variant', 'red');
  await expect(toast).toHaveCount(1);
  // Dismiss during its arrival; the goal's outgoing art must not return.
  await toast.getByRole('button').press('Escape');
  await expect(toast).toHaveCount(0);
  await expect(page.getByTestId('moment-scene')).toHaveCount(0);
  await page.goto('/match/1/facts?api');
  await expect(screen(page, 'match').getByRole('heading', { name: 'France – Argentina' })).toBeVisible();
  await trigger(page, 'goalHome');
  const scene = page.getByTestId('moment-scene');
  await expect(scene).toHaveAttribute('data-variant', 'goal');
  await trigger(page, 'redHome');
  await page.keyboard.press('Escape');
  await expect(scene).toHaveAttribute('data-variant', 'red');
  await expect(scene).toHaveCount(1);
  await page.keyboard.press('Escape');
  await expect(scene).toHaveCount(0);
});

test('phone Stats and Follow settle consistently during entrance, folding, scroll and a live update', async ({ page }, info) => {
  test.skip(!info.project.name.startsWith('phone'), 'bounded check of the reported mobile jitter');
  await page.addInitScript(() => localStorage.setItem('scoreline:follow', JSON.stringify({ team: 'fra', n: 16 })));
  await page.goto('/match/1/stats?api');
  const match = screen(page, 'match');
  const bars = match.locator('[data-bars]');
  await expect(bars).toBeVisible();
  for (let i = 0; i < 2; i++) {
    if (i) {
      await match.getByRole('tab', { name: 'Facts', exact: true }).click();
      await match.getByRole('tab', { name: 'Stats', exact: true }).click();
      await expect(bars).toBeVisible();
    }
    const settled = await bars.evaluate(el => new Promise<{ x: number; y: number; w: number; h: number }[]>(done => {
      const start = performance.now();
      const samples: { x: number; y: number; w: number; h: number }[] = [];
      const tick = () => {
        if (performance.now() - start >= 900) {
          const b = el.getBoundingClientRect();
          samples.push({ x: b.x, y: b.y, w: b.width, h: b.height });
        }
        if (performance.now() - start < 1200) { requestAnimationFrame(tick); return; }
        done(samples);
      };
      requestAnimationFrame(tick);
    }));
    for (const key of ['x', 'y', 'w', 'h'] as const) expect(Math.max(...settled.map(s => s[key])) - Math.min(...settled.map(s => s[key]))).toBeLessThan(0.15);
  }
  await match.screenshot({ path: `${info.outputDir}/stats-settled.png` });
  await page.goto('/?api');
  const list = screen(page, 'list');
  const card = list.locator('[data-phase]');
  await expect(card).toBeVisible();
  for (const label of ['Show less', 'Show more']) {
    const heights = await list.getByRole('button', { name: label, exact: true }).evaluate(button => new Promise<number[]>(done => {
      const start = performance.now();
      const values: number[] = [];
      (button as HTMLButtonElement).click();
      const tick = () => {
        if (performance.now() - start > 750) values.push(document.querySelector('[data-screen="list"] [data-phase]')!.getBoundingClientRect().height);
        if (performance.now() - start < 1000) { requestAnimationFrame(tick); return; }
        done(values);
      };
      requestAnimationFrame(tick);
    }));
    expect(Math.max(...heights) - Math.min(...heights)).toBeLessThan(0.15);
  }
  await list.evaluate(el => { el.scrollTop = 150; });
  const before = await card.evaluate(el => ({ y: el.getBoundingClientRect().y + el.closest('[data-screen]')!.scrollTop, h: el.getBoundingClientRect().height }));
  await trigger(page, 'goalHome');
  await expect(page.getByTestId('moment-scene')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('moment-scene')).toHaveCount(0);
  const after = await card.evaluate(el => ({ y: el.getBoundingClientRect().y + el.closest('[data-screen]')!.scrollTop, h: el.getBoundingClientRect().height }));
  expect(after.y).toBeCloseTo(before.y, 1);
  expect(after.h).toBeCloseTo(before.h, 1);
  await list.screenshot({ path: `${info.outputDir}/follow-settled.png` });
});
