import { expect, test, type Locator, type Page } from '@playwright/test';

async function heldTap(page: Page, target: Locator) {
  const box = await target.boundingBox();
  expect(box).not.toBeNull();
  const input = await page.context().newCDPSession(page);
  const touch = { x: box!.x + box!.width / 2, y: box!.y + box!.height / 2, id: 1 };
  await input.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [touch] });
  await page.waitForTimeout(120); // release while the label is rolling
  await input.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await input.detach();
}

for (const reducedMotion of ['no-preference', 'reduce'] as const) {
  test(`Account slides without focus scrolling its ancestors (${reducedMotion})`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion });
    await page.goto('/?demo&live=0');
    const menu = page.getByRole('button', { name: 'Menu', exact: true });
    await expect(menu).toBeVisible();
    await page.waitForTimeout(900);
    for (let repeat = 0; repeat < 2; repeat++) {
      const samples = page.evaluate(async () => {
        const samples: number[] = [];
        for (let i = 0; i < 45; i++) {
          await new Promise<void>(r => requestAnimationFrame(() => r()));
          const dialog = document.querySelector('[role="dialog"]')!;
          for (let el = dialog.parentElement; el; el = el.parentElement) samples.push(Math.abs(el.scrollTop));
        }
        return Math.max(...samples);
      });
      await menu.click();
      const dialog = page.getByRole('dialog');
      await expect(dialog.getByRole('button', { name: 'Close', exact: true })).toBeFocused();
      expect(await samples).toBeLessThan(1);
      await expect(dialog).toBeVisible();
      await dialog.getByRole('button', { name: 'Close', exact: true }).click();
      await expect(menu).toBeFocused();
      await page.waitForTimeout(700);
    }
  });

  test(`one touch on Table and team letters activates the control (${reducedMotion})`, async ({ page }, info) => {
    test.skip(info.project.name !== 'phone', 'native touch input');
    await page.emulateMedia({ reducedMotion });
    await page.goto('/match/1/facts?demo&live=0');
    const match = page.locator('[data-screen="match"][data-present="true"]');
    const table = match.getByRole('tab', { name: 'Table', exact: true });
    await expect(table).toBeVisible();
    await heldTap(page, table.locator('[data-roll]'));
    await expect(table).toHaveAttribute('aria-selected', 'true');
    await expect(page).toHaveURL(/\/table\?/);
    await match.getByRole('tab', { name: 'Lineup', exact: true }).tap();
    const away = match.getByRole('radio', { name: 'Argentina', exact: true });
    await expect(away).toBeVisible();
    await heldTap(page, away.locator('[data-roll]'));
    await expect(away).toHaveAttribute('aria-checked', 'true');
    await heldTap(page, match.getByRole('radio', { name: 'France', exact: true }).locator('[data-roll]'));
    await expect(match.getByRole('radio', { name: 'France', exact: true })).toHaveAttribute('aria-checked', 'true');
  });
}

test('ON and OFF artwork exist before app JS, and remain interactive without Rive', async ({ page }) => {
  // Block only the app entry, allowing the synchronous first-frame HTML to render.
  await page.route(/\/assets\/index-[^/]+\.js$/, route => route.abort());
  for (const live of [0, 1]) {
    await page.goto(`/?demo&live=${live}`);
    await expect(page.locator(live ? '.sf-live-on' : '.sf-live-off')).toBeVisible();
    await expect(page.locator(live ? '.sf-live-off' : '.sf-live-on')).toBeHidden();
    expect(await page.locator(live ? '#live-still' : '#live-off-still').count()).toBe(1);
  }
  await page.unrouteAll();
  await page.route(/\.wasm(?:\?|$)/, route => route.abort());
  await page.goto('/?demo&live=0');
  const button = page.getByRole('button', { name: /^Live, \d+ in play$/ });
  await expect(button.locator('[data-live-still] use').first()).toHaveAttribute('href', '#live-off-still');
  const off = await button.boundingBox();
  await button.click();
  await expect(button).toHaveAttribute('aria-pressed', 'true');
  await expect(button.locator('[data-live-still] use').first()).toHaveAttribute('href', '#live-still');
  const on = await button.boundingBox();
  expect(on!.width).toBeCloseTo(off!.width, 1);
  expect(on!.height).toBeCloseTo(40, 1);
  await button.click();
  await expect(button.locator('[data-live-still] use').first()).toHaveAttribute('href', '#live-off-still');
});

test('Goals Tonight starts with the leader rows', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'Tables/Leaders are in the desktop third pane');
  await page.goto('/player/arg/10?demo&live=0');
  await page.getByRole('tab', { name: 'Leaders', exact: true }).click();
  const firsts = await page.evaluate(async () => {
    const started: Record<string, number> = {};
    const start = performance.now();
    for (let i = 0; i < 90; i++) {
      await new Promise<void>(r => requestAnimationFrame(() => r()));
      for (const selector of ['[data-insight-leader]', '[data-insight-goal]']) {
        const el = document.querySelector(selector);
        if (el && started[selector] === undefined && Number(getComputedStyle(el).opacity) > 0.02) started[selector] = performance.now() - start;
      }
      if (Object.keys(started).length === 2) return started;
    }
    return started;
  });
  expect(firsts['[data-insight-goal]']).toBeDefined();
  expect(firsts['[data-insight-leader]']).toBeDefined();
  expect(Math.abs(firsts['[data-insight-goal]']! - firsts['[data-insight-leader]']!)).toBeLessThan(120);
});

test('general Tables uses the Firefox workaround only under its Firefox gate', async ({ browser }, info) => {
  test.skip(info.project.name !== 'desktop', 'Tables/Leaders are in the desktop third pane');
  for (const firefox of [false, true]) {
    const context = await browser.newContext({ viewport: { width: 1280, height: 892 }, userAgent: firefox ? 'Mozilla/5.0 Firefox/143.0' : undefined });
    const p = await context.newPage();
    await p.goto('/player/arg/10?demo&live=0');
    await p.getByRole('tab', { name: 'Tables', exact: true }).click();
    await expect(p.locator('[data-insights="tables"] [data-league]').first()).toBeVisible();
    const rotates = await p.locator('[data-insights="tables"] [data-league], [data-insights="tables"] [role="row"][data-team]').evaluateAll(els => els.map(el => getComputedStyle(el).rotate));
    expect(rotates.length).toBeGreaterThan(4);
    expect(rotates.every(r => r === (firefox ? '0.049deg' : 'none'))).toBe(true);
    await context.close();
  }
  // UA exercises selector scoping; this is not a native Firefox rendering test.
});
