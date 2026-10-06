import { expect, test, type Page, type TestInfo } from '@playwright/test';

/*
 * Issue #11: entrances of content that mounts after a screen's first frame. Under
 * AnimatePresence initial={false} (the phone stack, the panes) Motion kept `initial: false` for the
 * screen's whole life, so a tab's content, "Show all" rows or a block that arrived late never
 * animated in. Screen's LaterMountsAnimate lifts that after the first frame. Each case here opens a
 * screen that was in the page's first render (a direct link: the case that broke), lets it settle,
 * then mounts something new in it and samples that element every frame: the first samples must
 * not be at rest.
 *
 * Every `initial={false}` in src (the audit the issue asks for):
 *   PhoneStack, MatchPane, ThreePane `AnimatePresence initial={false}`: every child is a Screen,
 *     so late content animates (LaterMountsAnimate);
 *   ThreePane/MatchPane `Screen initial={false}` (pane swaps): the same Screens;
 *   PhoneStack/MatchPane scrim, ListPane `m.div initial={false}`: no late content of their own
 *     (they hold no variant children; the list's blocks set their own initial in cascade.tsx);
 *   features: MatchDetail's tab panel (first tab only), EventsFeed (rows already there), Momentum,
 *     lineup Marker/PlayerRow and the player Sheet (reduced motion or a step): deliberate.
 * The follow card opening is not a presence case: both its layers stay mounted and cross-fade in
 * CSS on `data-open`. Details that arrive after a match opens mount inside the same Screen, so they
 * get LaterMountsAnimate like a tab's content (Screen.test.tsx covers a late mount directly).
 */

const screen = (page: Page, name: string) => page.locator(`[data-screen="${name}"][data-present="true"]`);
const panel = (page: Page) => screen(page, 'match').getByRole('tabpanel');
const layoutOf = (info: TestInfo) => (info.project.name.startsWith('phone') ? 'phone' : info.project.name.startsWith('tablet') ? 'two' : 'three');

async function settled(page: Page) {
  await expect.poll(() => page.evaluate(() => document.querySelectorAll('[data-present="false"]').length)).toBe(0);
  await expect
    // at rest a block keeps only the hair of rotation it slid with (src/motion/variants.ts)
    .poll(() =>
      panel(page).evaluate((el) => {
        const still = (t: string) => { const m = new DOMMatrix(t); return !m.m41 && !m.m42 && Math.abs(m.a - 1) < 1e-6 && Math.abs(m.d - 1) < 1e-6 && Math.abs(m.b) < 1e-3 && Math.abs(m.c) < 1e-3; };
        // the tab's body renders a frame after the bar: until then there is nothing to have settled
        const body = el.firstElementChild;
        if (!body) return 'no body yet';
        return [getComputedStyle(el).opacity, still(getComputedStyle(el).transform), still(getComputedStyle(body).transform)].join(' ');
      }),
    )
    .toBe('1 true true');
  await page.waitForTimeout(300);
}

/**
 * Starts sampling, every frame for `ms`, the opacity and transform of whatever `selector` matches
 * (once it exists), then runs `act`; returns the samples. An element at rest reads 1 and `none`.
 */
async function samplesAfter(page: Page, selector: string, act: () => Promise<void>, ms = 500) {
  await page.evaluate(
    ({ selector, ms }) => {
      const w = window as unknown as { __samples: Array<{ o: number; t: string }>; __sampling: Promise<void> };
      w.__samples = [];
      w.__sampling = new Promise<void>((done) => {
        let t0 = 0;
        const tick = (now: number) => {
          const el = document.querySelector<HTMLElement>(selector);
          if (el) {
            if (!t0) t0 = now;
            const s = getComputedStyle(el);
            w.__samples.push({ o: Number(s.opacity), t: s.transform });
          }
          if (t0 && now - t0 > ms) done();
          else requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      });
    },
    { selector, ms },
  );
  await act();
  return page.evaluate(async () => {
    const w = window as unknown as { __samples: Array<{ o: number; t: string }>; __sampling: Promise<void> };
    await w.__sampling;
    return w.__samples;
  });
}

/** How far from rest a sample is: opacity below 1, or a translation (Motion writes `transform`). */
function offRest(s: { o: number; t: string }): number {
  const m = /matrix\(([^)]+)\)/.exec(s.t);
  const [, , , , x = 0, y = 0] = m ? m[1]!.split(',').map(Number) : [];
  return Math.max(1 - s.o, Math.abs(x) / 10, Math.abs(y) / 10);
}

/** The element came in: its first samples are well off rest, and it ends (practically) at rest. */
function cameIn(samples: Array<{ o: number; t: string }>) {
  expect(samples.length).toBeGreaterThan(3);
  expect(Math.max(...samples.slice(0, 3).map(offRest)), JSON.stringify(samples.slice(0, 5))).toBeGreaterThan(0.1);
  expect(offRest(samples.at(-1)!), JSON.stringify(samples.at(-1))).toBeLessThan(0.02);
}

test('a match tab opened on a settled screen slides its content in', async ({ page }) => {
  await page.goto('/match/1/facts?demo');
  await settled(page);
  const tabBody = '[data-screen="match"][data-present="true"] [role="tabpanel"] > div';
  const samples = await samplesAfter(page, `${tabBody}[data-entering]`, async () => {
    // mark the new tab body as soon as it mounts, so the sampler reads it and not the old one
    await page.evaluate((sel) => {
      const panelEl = document.querySelector(sel.replace(' > div', ''))!;
      new MutationObserver((records, mo) => {
        for (const r of records) for (const n of r.addedNodes) if (n instanceof HTMLElement && n.parentElement === panelEl) {
          n.dataset.entering = '';
          mo.disconnect();
        }
      }).observe(panelEl, { childList: true });
    }, tabBody);
    await screen(page, 'match').getByRole('tab', { name: 'Stats', exact: true }).click();
  });
  await expect(page).toHaveURL(/\/match\/1\/stats\?demo$/);
  cameIn(samples);
});

test('"Show all" fades the rows it adds in', async ({ page }) => {
  await page.goto('/match/1/facts?demo');
  await settled(page);
  const rows = screen(page, 'match').locator('[data-row="e"]');
  await expect(rows).toHaveCount(10);
  // the eleventh row does not exist until Show all; its block is sampled from its mount
  const eleventh = await samplesAfterRow(page, 10, () => screen(page, 'match').getByRole('button', { name: /^Show all \d+ events$/ }).click());
  cameIn(eleventh);
});

/** Samples the `n`-th event row's moving block (0-based; the slot's child) from the moment it mounts. */
async function samplesAfterRow(page: Page, n: number, act: () => Promise<void>) {
  await page.evaluate((n) => {
    const w = window as unknown as { __samples: Array<{ o: number; t: string }>; __sampling: Promise<void> };
    w.__samples = [];
    w.__sampling = new Promise<void>((done) => {
      let t0 = 0;
      const tick = (now: number) => {
        const row = document.querySelectorAll('[data-screen="match"][data-present="true"] [data-row="e"]')[n] as HTMLElement | undefined;
        const block = row?.firstElementChild as HTMLElement | null | undefined;
        if (block) {
          if (!t0) t0 = now;
          const s = getComputedStyle(block);
          w.__samples.push({ o: Number(s.opacity), t: s.transform });
        }
        if (t0 && now - t0 > 600) done();
        else requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
  }, n);
  await act();
  return page.evaluate(async () => {
    const w = window as unknown as { __samples: Array<{ o: number; t: string }>; __sampling: Promise<void> };
    await w.__sampling;
    return w.__samples;
  });
}

test('the desktop Insights pane cascades a tab it switches to', async ({ page }, info) => {
  test.skip(layoutOf(info) !== 'three', 'the Insights pane is the desktop’s third pane');
  await page.goto('/match/1/facts?demo');
  await settled(page);
  const insights = page.getByRole('tablist', { name: 'Insights' });
  await insights.getByRole('tab', { name: 'Tables' }).click();
  await expect(page.locator('#insights-panel-tables')).toBeVisible();
  await page.waitForTimeout(800);
  const samples = await samplesAfter(page, '#insights-panel-leaders', () => insights.getByRole('tab', { name: 'Leaders' }).click());
  cameIn(samples);
});

test('the Facts events cascade in when the tab opens, every row and not only the first', async ({ page }) => {
  await page.goto('/match/1/stats?demo');
  await settled(page);
  const third = await samplesAfterRow(page, 2, () => screen(page, 'match').getByRole('tab', { name: 'Facts', exact: true }).click());
  cameIn(third);
});

