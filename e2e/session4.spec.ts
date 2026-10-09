import { expect, test, type Page } from '@playwright/test';

type Point = [number, number];

// Browser-input touch events include native scrolling/cancellation; dispatchEvent alone does not.
async function swipe(page: Page, from: Point, to: Point, cancel = false) {
  const input = await page.context().newCDPSession(page);
  const point = (x: number, y: number) => ({ x, y, id: 1, radiusX: 1, radiusY: 1 });
  await input.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point(...from)] });
  for (let i = 1; i <= 4; i++) {
    await input.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [point(from[0] + (to[0] - from[0]) * i / 4, from[1] + (to[1] - from[1]) * i / 4)] });
    await page.waitForTimeout(16);
  }
  await input.send('Input.dispatchTouchEvent', { type: cancel ? 'touchCancel' : 'touchEnd', touchPoints: [] });
  await input.detach();
}

for (const reducedMotion of ['no-preference', 'reduce'] as const) {
  test(`phone browser touch swipes change one day or go Back once (${reducedMotion})`, async ({ page }, info) => {
    test.skip(info.project.name !== 'phone', 'phone touch input');
    await page.emulateMedia({ reducedMotion });
    await page.goto('/?demo&live=0');
    await expect.poll(() => page.evaluate(() => performance.getEntriesByType('resource').some(e => /\/swipe-[^/]+\.js$/.test(e.name)))).toBe(true);
    const list = page.locator('[data-screen="list"][data-present="true"]');
    const days = list.getByRole('tablist', { name: 'Day' });
    await expect(days.getByRole('tab', { selected: true })).toHaveAttribute('data-tab', '0');
    await swipe(page, [270, 140], [110, 140]);
    await expect(days.getByRole('tab', { selected: true })).toHaveAttribute('data-tab', '1');
    await expect(page).toHaveURL(/day=1/);
    await swipe(page, [110, 140], [270, 140]);
    await expect(days.getByRole('tab', { selected: true })).toHaveAttribute('data-tab', '0');
    const url = page.url();
    await swipe(page, [270, 140], [110, 140], true);
    expect(page.url()).toBe(url);
    await swipe(page, [200, 600], [205, 300]);
    expect(page.url()).toBe(url);
    await expect.poll(() => list.evaluate(el => el.scrollTop)).toBeGreaterThan(0);

    const row = list.locator('[data-focus-key="match-2"]');
    await row.scrollIntoViewIfNeeded();
    const scroll = await list.evaluate(el => el.scrollTop);
    await row.tap();
    const match = page.locator('[data-screen="match"][data-present="true"]');
    await expect(match).toBeVisible();
    await expect(match.getByRole('heading', { level: 1 })).toBeVisible();
    await swipe(page, [10, 300], [220, 300]);
    await expect(match).toBeVisible(); // the application ignores native edge navigation
    await swipe(page, [110, 300], [270, 300], true);
    await expect(match).toBeVisible();
    await swipe(page, [110, 300], [270, 300]);
    await expect(page).toHaveURL(url);
    await expect(match).toHaveCount(0);
    await expect.poll(() => list.evaluate(el => el.scrollTop)).toBeCloseTo(scroll, 0);
    await expect(row).toBeFocused();
    await page.goForward();
    await expect(match).toBeVisible();
    await page.goBack();
    await expect(page).toHaveURL(url);
  });

  test(`review controls use the phone demo, freeze its clock and preserve the return route (${reducedMotion})`, async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop', 'desktop client review');
    await page.emulateMedia({ reducedMotion });
    await page.goto('/match/1/lineup?demo&live=0');
    await page.getByRole('button', { name: 'Menu', exact: true }).click();
    await page.getByRole('dialog').getByRole('link', { name: 'Phone preview for review' }).click();
    await expect(page).toHaveURL(/\/review\.html/);
    const phone = page.frameLocator('iframe');
    await expect(phone.getByTestId('app-shell')).toHaveAttribute('data-layout', 'phone');
    await expect(phone.getByRole('tab', { name: 'Lineup', exact: true })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('button', { name: 'Trigger goal' })).toBeEnabled();
    const appFrame = page.frames().find(frame => frame.parentFrame())!;
    expect(await appFrame.evaluate(() => window.innerWidth)).toBe(390);
    for (const [kind, label] of [['goal', 'Trigger goal'], ['red', 'Trigger red card'], ['goal', 'Trigger goal']] as const) {
      await page.getByRole('button', { name: label, exact: true }).click();
      const moment = phone.getByTestId(reducedMotion === 'reduce' ? 'moment-toast' : 'moment-scene');
      await expect(moment).toHaveAttribute('data-variant', kind);
      await expect(page.getByRole('status')).toContainText(kind === 'goal' ? 'Goal for' : 'Red card for');
      if (reducedMotion === 'reduce') await moment.getByRole('button').press('Escape');
      else await moment.getByRole('button', { name: kind === 'goal' ? 'Close goal' : 'Close red card' }).click();
      await expect(moment).toHaveCount(0);
    }
    await page.getByRole('button', { name: 'Pause', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Resume', exact: true })).toHaveAttribute('aria-pressed', 'true');
    const clock = phone.locator('[data-screen="match"][data-present="true"] [class*="clockMain"]');
    await page.waitForTimeout(200);
    const paused = await clock.innerText();
    await page.waitForTimeout(1400);
    expect(await clock.innerText()).toBe(paused);
    await page.getByRole('button', { name: 'Resume', exact: true }).click();
    await expect.poll(() => clock.innerText()).not.toBe(paused);
    await phone.getByRole('tab', { name: 'Stats', exact: true }).click();
    await expect(page.getByRole('link', { name: 'Normal view' })).toHaveAttribute('href', /\/match\/1\/stats\?demo&live=0/);
    await appFrame.goto(appFrame.url());
    await expect(page.getByRole('button', { name: 'Trigger goal' })).toBeEnabled();
    await page.getByRole('button', { name: 'Restart evening', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeEnabled();
    await page.getByRole('link', { name: 'Normal view' }).click();
    await expect(page).toHaveURL(/\/match\/1\/stats\?demo&live=0/);
    await expect(page.getByTestId('app-shell')).toHaveAttribute('data-layout', 'three');
  });
}

test('review keeps non-demo controls disabled and rejects an external return route', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'review route boundaries');
  await page.goto('/review.html?to=%2F%3Fdemo%3Doff');
  await expect(page.getByRole('button', { name: 'Trigger goal' })).toBeDisabled();
  await expect(page.getByRole('status')).toContainText('controls are off', { timeout: 10000 });
  await page.goto('/review.html?to=https%3A%2F%2Fexample.com');
  await expect(page.getByRole('button', { name: 'Trigger goal' })).toBeEnabled();
  await expect(page.getByRole('link', { name: 'Normal view' })).toHaveAttribute('href', '/');
});

test('phone review scales the presentation while keeping the real phone viewport', async ({ page }, info) => {
  test.skip(info.project.name !== 'phone', 'small review window');
  await page.goto('/review.html');
  await expect(page.getByRole('button', { name: 'Trigger goal' })).toBeEnabled();
  const frame = page.frames().find(frame => frame.parentFrame())!;
  expect(await frame.evaluate(() => [window.innerWidth, window.innerHeight])).toEqual([390, 844]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});
