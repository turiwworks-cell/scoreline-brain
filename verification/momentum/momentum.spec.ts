import { expect, test } from '@playwright/test';

const fixture = '/verification/momentum/fixture.html';
test('Lua chart geometry and settled screenshot', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(fixture);
  await page.evaluate(() => document.fonts.ready);
  const section = page.locator('[data-momentum]');
  const chart = section.locator('svg[viewBox="0 0 322 156"]');
  await expect(chart).toHaveAttribute('viewBox', '0 0 322 156');
  const box = await chart.boundingBox();
  expect(box?.width).toBe(322);
  expect(box?.height).toBe(156);
  const sectionBox = await section.boundingBox();
  expect(box!.y - sectionBox!.y).toBeCloseTo(75.8, 1); // 61.8 header + 14 chart inset.
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expect(section).toHaveScreenshot('live-momentum.png');
});

test('reveal uses token timing and settles without replay on a parent clock tick', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto(fixture);
  const reveal = page.locator('[data-wave-reveal]');
  const position = () => reveal.evaluate((el) => new DOMMatrix(getComputedStyle(el).transform).m41);
  // The translated clip moves from -323 to -323 + (63/90)*322.
  await expect.poll(position).toBeGreaterThan(-322);
  await expect.poll(position).toBeCloseTo(-97.6, 1);
  const before = await page.locator('[data-wave="home"]').getAttribute('d');
  const clock = await page.getByLabel('Parent clock').textContent();
  await expect(page.getByLabel('Parent clock')).not.toHaveText(clock!);
  expect(await position()).toBeCloseTo(-97.6, 1);
  expect(await page.locator('[data-wave="home"]').getAttribute('d')).toBe(before);
  await expect(page.locator('[data-momentum-now]')).toBeVisible();
});

test('new series updates wave; new goals animate; VAR removes the cancelled marker', async ({ page }) => {
  await page.goto(fixture);
  const wave = page.locator('[data-wave="home"]');
  const before = await wave.getAttribute('d');
  await page.getByRole('button', { name: 'Update momentum' }).click();
  await expect(wave).not.toHaveAttribute('d', before!);
  await page.getByRole('button', { name: 'Add goal' }).click();
  await expect(page.locator('[data-momentum-goal="new-goal"] use')).toBeVisible();
  await expect.poll(() => page.locator('[data-momentum-goal="new-goal"] > g').evaluate((el) => Number(getComputedStyle(el).opacity))).toBe(1);
  await page.getByRole('button', { name: 'Cancel goal' }).click();
  await expect(page.locator('[data-momentum-goal]')).toHaveCount(2);
  await expect(page.locator('[data-momentum-goal="argentina-38"]')).toHaveCount(0);
});

test('finished and empty matches have no live endpoint', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(`${fixture}?scenario=finished`);
  await expect(page.locator('[data-momentum-now]')).toHaveCount(0);
  await expect(page.locator('[data-future-minutes]')).toHaveCount(0);
  await expect(page.locator('[data-momentum]')).toHaveScreenshot('finished-momentum.png');
  await page.goto(`${fixture}?scenario=empty`);
  await expect(page.getByRole('heading', { name: 'Evenly matched' })).toBeVisible();
  await expect(page.locator('[data-momentum-goal]')).toHaveCount(0);
  await expect(page.locator('[data-momentum-now]')).toHaveCount(0);
  await expect(page.locator('[data-momentum]')).toHaveScreenshot('empty-momentum.png');
});
