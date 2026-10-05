import { expect, test, type Page } from '@playwright/test';

const pane = (page: Page, name: string) => page.locator(`[data-screen="${name}"][data-present="true"]`);
const row = (page: Page, id: number) => page.locator(`[data-focus-key="match-${id}"]`);

/** Hold the real production chunk, including the background preload, until the test releases it. */
async function holdScreen(page: Page, name: 'MatchScreen' | 'PlayerScreen') {
  let release!: () => void;
  const held = new Promise<void>((resolve) => { release = resolve; });
  await page.route(new RegExp(`/assets/${name}-[^/]+\\.js$`), async (route) => {
    await held;
    await route.continue();
  });
  return release;
}

test('a cold match tap keeps its loading chrome and transfers stacked focus when ready', async ({ page }, info) => {
  const release = await holdScreen(page, 'MatchScreen');
  try {
    await page.goto('/?demo', { waitUntil: 'domcontentloaded' });
    await row(page, 2).click();
    await expect(pane(page, 'match').getByRole('heading', { name: 'Loading…' })).toBeVisible();
    const stacked = info.project.name.startsWith('phone');
    if (stacked) await expect(pane(page, 'match').locator('[data-screen-heading]')).toBeFocused();
    release();
    await expect(pane(page, 'match').getByRole('heading', { name: 'England – Brazil', level: 1 })).toBeVisible();
    if (stacked) await expect(pane(page, 'match').locator('[data-screen-heading]')).toBeFocused();
    else await expect(row(page, 2)).toBeFocused();
    await page.goBack();
    await expect(page).toHaveURL(/\/\?demo$/);
    await expect(row(page, 2)).toBeFocused();
  } finally { release(); }
});

test('a cold player tap preserves focus through the reveal and returns it to the chip', async ({ page }, info) => {
  const release = await holdScreen(page, 'PlayerScreen');
  try {
    await page.goto('/match/1/lineup?demo', { waitUntil: 'domcontentloaded' });
    const chip = page.locator('[data-focus-key="chip-fra-10"]');
    await chip.click();
    await expect(pane(page, 'player').getByRole('heading', { name: 'Loading…' })).toBeVisible();
    const stacked = !info.project.name.startsWith('desktop');
    if (stacked) await expect(pane(page, 'player').locator('[data-screen-heading]')).toBeFocused();
    release();
    await expect(pane(page, 'player').getByRole('heading', { name: 'Kylian Mbappé', level: 1 })).toBeVisible();
    if (stacked) await expect(pane(page, 'player').locator('[data-screen-heading]')).toBeFocused();
    else await expect(chip).toBeFocused();
    await page.goBack();
    await expect(chip).toBeFocused();
  } finally { release(); }
});

test('back before the match chunk arrives cannot resurrect the abandoned screen', async ({ page }, info) => {
  const release = await holdScreen(page, 'MatchScreen');
  try {
    await page.goto('/?demo', { waitUntil: 'domcontentloaded' });
    await row(page, 2).click();
    await expect(pane(page, 'match').getByRole('heading', { name: 'Loading…' })).toBeVisible();
    await page.goBack();
    await expect(page).toHaveURL(/\/\?demo$/);
    release();
    await expect(page.locator('[data-present="false"]')).toHaveCount(0);
    if (info.project.name.startsWith('phone')) await expect(pane(page, 'match')).toHaveCount(0);
    else await expect(pane(page, 'match').getByRole('heading', { name: 'France – Argentina', level: 1 })).toBeVisible();
    await expect(row(page, 2)).toBeFocused();
  } finally { release(); }
});

test('the first warmed match open has content on its first frame and plays its phone push', async ({ page }, info) => {
  await page.goto('/?demo');
  await expect(row(page, 2)).toBeVisible();
  await expect.poll(() => page.evaluate(() => performance.getEntriesByType('resource').some((e) => /\/MatchScreen-[^/]+\.js$/.test(e.name)))).toBe(true);
  // Resource completion precedes module evaluation; allow two frames for the ready thenable.
  await page.evaluate(() => new Promise<void>((done) => requestAnimationFrame(() => requestAnimationFrame(() => done()))));
  const first = await row(page, 2).evaluate((el: HTMLElement) => new Promise<{ title: string | null; x: number }>((done) => {
    el.click();
    requestAnimationFrame(() => {
      const screen = document.querySelector<HTMLElement>('[data-screen="match"][data-present="true"]')!;
      done({ title: screen.querySelector('[data-screen-heading]')?.textContent ?? null, x: new DOMMatrix(getComputedStyle(screen).transform).m41 });
    });
  }));
  expect(first.title).toBe('England – Brazil');
  if (info.project.name.startsWith('phone')) expect(first.x).toBeGreaterThan(100);
  await expect(pane(page, 'match').getByRole('tablist', { name: 'Match' })).toBeVisible();
});
