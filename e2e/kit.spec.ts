import { expect, test } from '@playwright/test';

test('dev kit renders every material', async ({ page }, info) => {
  await page.goto('/dev/kit');
  await expect(page.getByTestId('dev-kit')).toBeVisible();
  for (const name of ['Colours', 'Spectrum', 'Type scale', 'Glass', 'SoftLight', 'Hover light', 'Button', 'Pill', 'Tabs', 'Icons', 'Tags', 'RatingBadge', 'MatchClock', 'PlayerPhoto', 'Feed crests', 'Teams']) {
    await expect(page.getByRole('region', { name })).toBeVisible();
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
