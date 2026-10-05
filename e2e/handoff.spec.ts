import { expect, test, type Page } from '@playwright/test';

/*
 * Part 21, issue #4: the first frame in index.html, and Rive starting after the first data.
 *
 * The entry script is held back so the page can be looked at as the browser first paints it, then
 * let go, and the React header that replaces the frame is compared to it, at 390, 900 and 1280.
 */

/** Holds the app's entry script (and so React) until the returned function is called. */
async function holdEntry(page: Page) {
  let release = () => {};
  const gate = new Promise<void>((resolve) => (release = resolve));
  await page.route(/\/assets\/index-[^/]+\.js$/, async (route) => {
    await gate;
    await route.continue();
  });
  return release;
}

/**
 * The Live button stays its DOM fallback: React's first frame is what the static frame stands in for.
 * (`/?demo=off` has no data on its way, so Rive may start right after the first paint and swap its own capsule in,
 * as it did before the static frame; that swap is the list's, e2e/list.spec.ts.)
 */
const holdRive = (page: Page) => page.route('**/*.riv', (route) => route.abort());

/** The face the page is set in has loaded, so the frame and the header are both measured in it. */
const faceLoaded = (page: Page) => page.waitForFunction(() => document.fonts.check('500 15px "Hanken Grotesk"'));

type Box = [number, number, number, number];

/** The boxes that matter of whichever header is on the page: the static frame's or React's. */
function boxes() {
  const box = (el: Element | null | undefined): Box => {
    if (!el) throw new Error('missing');
    const b = el.getBoundingClientRect();
    return [b.x, b.y, b.width, b.height];
  };
  const frame = document.querySelector('[data-static-frame]');
  if (frame) {
    const on = frame.querySelector('.sf-on')!.getBoundingClientRect();
    return {
      kind: 'static',
      wordmark: box(frame.querySelector('h1')),
      mark: box(frame.querySelector('.sf-mark')),
      live: box(frame.querySelector('.sf-live')),
      count: box(frame.querySelector('.sf-count')),
      menu: box(frame.querySelector('.sf-round')),
      tabs: box(frame.querySelector('.sf-view')),
      days: [...frame.querySelectorAll('.sf-tab')].map(box),
      // the indicator under the chosen word: the tab less its 13 px each side, 2 px tall at its foot
      indicator: [on.x + 13, on.y + 39, on.width - 26, 2] as Box,
      panes: [...frame.querySelectorAll('.sf-pane')].filter((p) => getComputedStyle(p).display !== 'none').map(box),
    };
  }
  const list = document.querySelector('[data-screen="list"][data-present="true"]')!;
  const live = list.querySelector('button[aria-pressed]')!;
  const tablist = list.querySelector('[role="tablist"]')!;
  return {
    kind: 'react',
    wordmark: box(list.querySelector('h1')),
    mark: box(list.querySelector('h1')!.previousElementSibling),
    live: box(live),
    // the number in the capsule (behind a display: contents wrapper once the gate lets the artwork start)
    count: box([...live.querySelectorAll('span')].find((s) => s.children.length === 0 && /^\d+$/.test(s.textContent ?? ''))),
    menu: box(list.querySelector('button[aria-label="Menu"]')),
    tabs: box(tablist),
    days: [...list.querySelectorAll('[role="tab"]')].map(box),
    indicator: box(tablist.parentElement!.querySelector('span[data-ready]')),
    panes: [...document.querySelectorAll('[data-pane]')].map(box),
  };
}

const close = (a: Box, b: Box, tol: number, what: string) => a.forEach((v, i) => expect(Math.abs(v - b[i]!), `${what}[${i}]: ${v} against ${b[i]}`).toBeLessThanOrEqual(tol));

test.describe('the first frame and the header that replaces it', () => {
  test('paints before the bundle, is only a picture, and React takes over in the same boxes with nothing moving', async ({ page }, info) => {
    await page.addInitScript(() => {
      const w = window as unknown as { __shift: number; __frameGone?: number };
      w.__shift = 0;
      new PerformanceObserver((list) => {
        for (const e of list.getEntries() as unknown as Array<{ value: number; hadRecentInput: boolean }>) if (!e.hadRecentInput) w.__shift += e.value;
      }).observe({ type: 'layout-shift', buffered: true });
    });
    await holdRive(page);
    const release = await holdEntry(page);
    // no data: the header React draws from nothing is what the frame stands in for (with the demo,
    // `/`, the day words then change with the evening's days, as they are meant to)
    await page.goto('/?demo=off', { waitUntil: 'commit' });
    const frame = page.locator('[data-static-frame]');
    await expect(frame).toBeVisible();
    await expect(frame.getByText('scoreline')).toBeVisible();
    await faceLoaded(page);

    // only a picture: nothing for assistive technology, nothing to focus
    await expect(page.getByRole('heading')).toHaveCount(0);
    await expect(page.getByRole('button')).toHaveCount(0);
    await expect(page.getByRole('tab')).toHaveCount(0);
    await page.keyboard.press('Tab');
    expect(await page.evaluate(() => document.activeElement === document.body)).toBe(true);

    const before = await page.evaluate(boxes);
    expect(before.kind).toBe('static');
    await page.screenshot({ path: `test-results/handoff-static-${info.project.name}.png` });

    release();
    await expect(page.locator('[data-screen="list"][data-present="true"] h1')).toBeVisible();
    // the frame is gone, with nothing of it left over: one heading, one set of tabs
    await expect(frame).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'scoreline' })).toHaveCount(1);
    await expect(page.getByRole('tablist', { name: 'Day' })).toHaveCount(1);
    await faceLoaded(page);
    await expect.poll(() => page.evaluate(() => document.querySelector('[role="tablist"]')!.parentElement!.querySelector('span[data-ready]') !== null)).toBe(true);
    await page.waitForTimeout(700); // the indicator has landed (its slide is 0.5 s)
    const after = await page.evaluate(boxes);
    expect(after.kind).toBe('react');
    await page.screenshot({ path: `test-results/handoff-react-${info.project.name}.png` });

    // the same boxes: the header's, to a fraction of a pixel; the day words differ only by the
    // whole-pixel rounding the strip's placement does (≤ 0.5 px)
    for (const key of ['wordmark', 'mark', 'live', 'count', 'menu', 'tabs'] as const) close(before[key], after[key], 0.5, key);
    expect(before.panes.length).toBe(after.panes.length);
    before.panes.forEach((p, i) => close(p, after.panes[i]!, 0.5, `pane ${i}`));
    expect(before.days.length).toBe(after.days.length);
    before.days.forEach((d, i) => close(d, after.days[i]!, 0.5, `day ${i}`));
    close(before.indicator, after.indicator, 0.5, 'indicator');

    // nothing moved when React took over
    expect(await page.evaluate(() => (window as unknown as { __shift: number }).__shift)).toBeLessThan(0.001);
  });

  test('the app runs after the frame has painted, its modules downloading from the start', async ({ page }) => {
    await page.addInitScript(() => {
      const w = window as unknown as { __entryAdded?: number; __fcp?: number };
      new PerformanceObserver((list) => {
        for (const e of list.getEntries()) if (e.name === 'first-contentful-paint') w.__fcp = e.startTime;
      }).observe({ type: 'paint', buffered: true });
      new MutationObserver(() => {
        if (w.__entryAdded === undefined && document.querySelector('script[type="module"][src*="/assets/index-"]')) w.__entryAdded = performance.now();
      }).observe(document, { subtree: true, childList: true });
    });
    await page.goto('/');
    await expect(page.locator('[data-screen="list"][data-present="true"] h1')).toBeVisible();
    const t = await page.evaluate(() => {
      const w = window as unknown as { __entryAdded?: number; __fcp?: number };
      const entry = performance.getEntriesByType('resource').find((e) => /\/assets\/index-[^/]+\.js$/.test(e.name));
      return { fcp: w.__fcp, added: w.__entryAdded, requested: entry?.startTime, preloaded: document.querySelector('link[rel="modulepreload"][href*="/assets/index-"]') !== null };
    });
    expect(t.preloaded).toBe(true);
    expect(t.fcp).toBeDefined();
    // the entry was asked for with the HTML, before anything painted, and run only after the first paint
    expect(t.requested!).toBeLessThan(t.fcp!);
    expect(t.added!).toBeGreaterThanOrEqual(t.fcp!);
  });

  test('the frame has the header’s own type and colours', async ({ page }) => {
    await holdRive(page);
    const release = await holdEntry(page);
    await page.goto('/', { waitUntil: 'commit' });
    await expect(page.locator('[data-static-frame]')).toBeVisible();
    await faceLoaded(page);
    const look = () =>
      page.evaluate(() => {
        // a colour mixed in CSS serialises as color(srgb …), the same colour written plainly as rgb(…)
        const plain = (c: string) => {
          const m = /^color\(srgb ([\d.]+) ([\d.]+) ([\d.]+)\)$/.exec(c);
          return m ? `rgb(${[m[1], m[2], m[3]].map((v) => Math.round(Number(v) * 255)).join(', ')})` : c;
        };
        const css = (el: Element | null, props: string[]) => Object.fromEntries(props.map((p) => [p, plain(getComputedStyle(el!).getPropertyValue(p))]));
        const frame = document.querySelector('[data-static-frame]');
        const list = frame ? null : document.querySelector('[data-screen="list"][data-present="true"]')!;
        const h1 = (frame ?? list!).querySelector('h1');
        const tabs = frame ? [...frame.querySelectorAll('.sf-tab')] : [...list!.querySelectorAll('[role="tab"]')];
        const type = ['font-family', 'font-size', 'font-weight', 'letter-spacing', 'color'];
        return { h1: css(h1, type), selected: css(tabs[2]!, type), other: css(tabs[1]!, type), body: css(document.body, ['background-color']) };
      });
    const before = await look();
    release();
    await expect(page.locator('[data-screen="list"][data-present="true"] h1')).toBeVisible();
    await faceLoaded(page);
    const after = await look();
    expect(before).toEqual(after);
  });
});

/** When the page asked for Rive's files, in ms from navigation, and when the first match row reached the DOM. */
async function riveTimes(page: Page) {
  return page.evaluate(() => {
    const starts = (pattern: RegExp) => performance.getEntriesByType('resource').filter((e) => pattern.test(e.name)).map((e) => e.startTime);
    return {
      graphic: starts(/\/assets\/LiveGraphic-[^/]+\.js$/),
      file: starts(/\/rive\/live-icon\.riv$/),
      runtime: starts(/\/assets\/(?:runtime|rive)-[^/]+\.(?:js|wasm)$/),
      rows: (window as unknown as { __rows?: number }).__rows ?? null,
    };
  });
}

async function watchRows(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as { __rows?: number };
    new MutationObserver(() => {
      if (w.__rows === undefined && document.querySelector('[data-focus-key^="match-"]')) w.__rows = performance.now();
    }).observe(document, { subtree: true, childList: true });
  });
}

const liveToggle = (page: Page) => page.locator('[data-screen="list"][data-present="true"]').getByRole('button', { name: /^Live, \d+ in play$/ });

test.describe('Rive starts after the first data', () => {
  test('nothing of it is asked for until the first rows are on screen, and the Live button works meanwhile', async ({ page }) => {
    await watchRows(page);
    await page.goto('/?demo');
    await expect(page.locator('[data-focus-key^="match-"]').first()).toBeVisible();
    // the DOM button is the control, and it works, whether or not the artwork has come yet
    const live = liveToggle(page);
    await expect(live).toHaveAttribute('aria-pressed', 'false');
    await live.click();
    await expect(live).toHaveAttribute('aria-pressed', 'true');
    await live.click();
    await expect(live).toHaveAttribute('aria-pressed', 'false');

    // then it starts: the graphic, the file, the runtime
    await expect.poll(async () => (await riveTimes(page)).file.length, { timeout: 15_000 }).toBeGreaterThan(0);
    await expect.poll(async () => (await riveTimes(page)).runtime.length, { timeout: 15_000 }).toBeGreaterThan(0);
    const t = await riveTimes(page);
    expect(t.rows).not.toBeNull();
    for (const [what, times] of [['graphic', t.graphic], ['file', t.file], ['runtime', t.runtime]] as const) {
      for (const at of times) expect(at, `${what} requested at ${at} ms, the rows were in at ${t.rows} ms`).toBeGreaterThan(t.rows!);
    }
  });

  test('a feed that is late does not keep it away for good', async ({ page }) => {
    test.setTimeout(60_000);
    await watchRows(page);
    let release = () => {};
    const gate = new Promise<void>((resolve) => (release = resolve));
    await page.route(/\/assets\/demo-[^/]+\.js$/, async (route) => {
      await gate;
      await route.continue();
    });
    await page.goto('/?demo');
    await expect(page.getByText('Loading the demo…')).toBeVisible();
    // no data for a good while: Rive is not asked for in the first seconds ...
    await page.waitForTimeout(3000);
    expect((await riveTimes(page)).file).toEqual([]);
    // ... and the page is not waiting on it: the Live button already works
    const live = liveToggle(page);
    await live.click();
    await expect(live).toHaveAttribute('aria-pressed', 'true');
    await live.click();
    // ... but once the wait is up it starts without the feed
    await expect.poll(async () => (await riveTimes(page)).file.length, { timeout: 20_000 }).toBeGreaterThan(0);
    const t = await riveTimes(page);
    expect(t.rows).toBeNull();
    expect(Math.min(...t.file)).toBeGreaterThan(3500);
    release();
    await expect(page.locator('[data-focus-key^="match-"]').first()).toBeVisible();
  });

  test('with no data on its way, it does not wait for any: it starts once the page has painted', async ({ page }) => {
    // `?demo=off` names no source (`/` plays the demo): nothing will arrive to wait for
    await page.goto('/?demo=off');
    await expect(page.getByText('No matches yet.')).toBeVisible();
    await expect.poll(async () => (await riveTimes(page)).file.length, { timeout: 15_000 }).toBeGreaterThan(0);
    // well before the 4 s a late feed is given
    expect(Math.min(...(await riveTimes(page)).file)).toBeLessThan(3500);
    const live = liveToggle(page);
    await live.click();
    await expect(live).toHaveAttribute('aria-pressed', 'true');
  });
});

test.describe('the followed player’s photo', () => {
  test('is asked for once, before the card that shows it, and it is the file the card shows', async ({ page }) => {
    await watchRows(page);
    await page.goto('/?demo');
    const chest = page.locator('[data-screen="list"][data-present="true"] img[width="144"]');
    await expect(chest).toBeVisible();
    await expect.poll(() => chest.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
    const t = await page.evaluate(() => {
      const shown = (document.querySelector('[data-screen="list"][data-present="true"] img[width="144"]') as HTMLImageElement).currentSrc;
      const busts = performance.getEntriesByType('resource').filter((e) => /\/img\/players\/.+-bust@/.test(e.name));
      return { shown, busts: busts.map((e) => ({ name: e.name, start: e.startTime })), rows: (window as unknown as { __rows?: number }).__rows };
    });
    // one request, for the very file the card's picture chose (format and density)
    expect(t.busts.map((b) => b.name)).toEqual([t.shown]);
  });
});

