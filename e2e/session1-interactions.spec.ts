import { expect, test, type Locator, type Page } from '@playwright/test';

const match = (page: Page) => page.locator('[data-screen="match"][data-present="true"]');

async function openMatch(page: Page, tab: string) {
  await page.goto(`/match/1/${tab}?demo`);
  await expect(match(page).getByRole('tabpanel')).toHaveAttribute('aria-busy', 'false');
  await expect.poll(() => match(page).getByRole('tabpanel').evaluate(el => getComputedStyle(el).opacity)).toBe('1');
}

/** Use a real mouse click while the scroll guard is active. Locator.click's actionability wait
 * would mask a temporary pointer-events lock and let the old implementation pass. */
async function clickDuringScroll(page: Page, control: Locator) {
  await control.scrollIntoViewIfNeeded();
  const box = await control.boundingBox();
  if (!box) throw new Error('control has no box');
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  const hit = await control.evaluate((el, point) => {
    const screen = el.closest('[data-screen]')!;
    screen.dispatchEvent(new WheelEvent('wheel', { bubbles: true, deltaY: 1 }));
    const target = document.elementFromPoint(point.x, point.y);
    const w = window as unknown as { __clickedDuringScroll: boolean };
    w.__clickedDuringScroll = false;
    el.addEventListener('click', () => { w.__clickedDuringScroll = screen.hasAttribute('data-scrolling'); }, { once: true });
    return target === el || !!target && el.contains(target);
  }, { x, y });
  expect(hit, 'the visible control must remain the hit target during scroll').toBe(true);
  await page.mouse.click(x, y);
  expect(await page.evaluate(() => (window as unknown as { __clickedDuringScroll: boolean }).__clickedDuringScroll)).toBe(true);
}

test('rapid Stats/Lineup reversals keep a visible body and finish on the selected tab', async ({ page }) => {
  await openMatch(page, 'stats');
  const frames = await match(page).evaluate(async screen => {
    const tabs = [...screen.querySelectorAll<HTMLButtonElement>('[role="tab"]')];
    const start = performance.now();
    let round = 0;
    const opacity: number[] = [];
    return new Promise<number[]>(done => {
      const tick = () => {
        const elapsed = performance.now() - start;
        if (round < 12 && elapsed >= round * 60) tabs[round++ % 2 === 0 ? 2 : 1]!.click();
        const body = screen.querySelector('[role="tabpanel"]')?.firstElementChild;
        opacity.push(body ? Number(getComputedStyle(body).opacity) : 0);
        if (elapsed < 1500) requestAnimationFrame(tick); else done(opacity);
      };
      requestAnimationFrame(tick);
    });
  });
  expect(frames.length).toBeGreaterThan(10);
  expect(Math.min(...frames), 'ready tab content must never restart from transparent').toBe(1);
  await expect(match(page).getByRole('tab', { name: 'Stats', exact: true })).toHaveAttribute('aria-selected', 'true');
  await expect(match(page).getByRole('tabpanel')).toHaveAttribute('aria-busy', 'false');
  await expect(match(page).getByRole('region', { name: 'Possession' })).toBeVisible();
  await match(page).getByRole('tab', { name: 'Lineup', exact: true }).click();
  await expect(match(page).locator('[data-pitch]')).toBeVisible();
  await expect.poll(() => match(page).evaluate(el => el.scrollTop)).toBe(0);
});

test('one click opens a Lineup player during the scroll settling window', async ({ page }) => {
  await openMatch(page, 'lineup');
  const player = match(page).locator('[data-pitch] [data-player="fra:14"]');
  await expect(player).toBeVisible();
  await expect.poll(() => player.evaluate(el => getComputedStyle(el.parentElement!).opacity)).toBe('1');
  await clickDuringScroll(page, player);
  await expect(page).toHaveURL(/\/player\/fra\/14\?demo$/);
  if (page.viewportSize()!.width < 1200) await expect(match(page)).toHaveAttribute('inert');
});

test('Facts Show less accepts a single click during scroll settling', async ({ page }) => {
  await openMatch(page, 'facts');
  await match(page).getByRole('button', { name: /^Show all \d+ events$/ }).click();
  const less = match(page).getByRole('button', { name: 'Show less', exact: true });
  await clickDuringScroll(page, less);
  await expect(match(page).getByRole('button', { name: /^Show all \d+ events$/ })).toBeVisible();
  await expect(match(page).locator('[data-row="e"]')).toHaveCount(10);
});

test('Account traps both Tab directions, blocks background panes and returns focus on Escape and Close', async ({ page }) => {
  await page.goto('/?demo');
  const menu = page.getByRole('button', { name: 'Menu', exact: true });
  for (const dismissal of ['Escape', 'Close']) {
    await menu.click();
    const dialog = page.getByRole('dialog');
    const first = dialog.getByRole('button', { name: 'Close', exact: true });
    // the review page's link closes the sheet's tab order (it is the one link in the dialog)
    const last = dialog.getByRole('link', { name: 'Phone preview for review' });
    await expect(first).toBeFocused();
    await page.keyboard.press('Shift+Tab');
    await expect(last).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(first).toBeFocused();
    for (let i = 0; i < 4; i++) await page.keyboard.press('Tab');
    await expect(last).toBeFocused();
    const backgroundGuarded = await page.locator('[data-screen][data-present="true"]').evaluateAll(screens => screens.every(el => !!el.closest('[inert]')));
    expect(backgroundGuarded).toBe(true);
    await menu.evaluate(el => (el as HTMLElement).focus());
    await expect(last).toBeFocused();
    if (dismissal === 'Escape') await page.keyboard.press('Escape'); else await first.click();
    await expect(menu).toBeFocused();
    await expect(menu).not.toHaveAttribute('inert');
    await expect(page.getByRole('dialog')).toHaveCount(0);
  }
});

test('expired demo direct links fall back to a usable list; valid navigation still works', async ({ page }) => {
  await page.goto('/match/999999/stats?demo&seed=session1');
  await expect(page).toHaveURL(/\/\?demo&seed=session1$/);
  await expect(page.getByRole('button', { name: 'Menu' })).toBeVisible();
  const card = page.locator('[data-screen="list"] [data-card="1"]');
  await card.click();
  await expect(page).toHaveURL(/\/match\/1\/facts\?demo&seed=session1$/);
  await page.goBack();
  await expect(page).toHaveURL(/\/\?demo&seed=session1$/);
});
