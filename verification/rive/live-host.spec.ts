import { createHash } from 'node:crypto';
import { expect, test } from '@playwright/test';
import type {} from './live-host';

test('full Live host renders native artwork, updates count, supports keyboard and releases remounts', async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('/verification/rive/live-host.html');
  const button = page.locator('#live-target button');
  const ready = async () => {
    await expect(button).toHaveAttribute('data-rive-live', 'true', { timeout: 30000 });
    await expect(button.locator('canvas')).toHaveCSS('opacity', '1');
    await expect.poll(() => page.evaluate(() => window.liveHostProbe.slots)).toBe(1);
  };
  await ready();
  await expect(button).toHaveAttribute('aria-pressed', 'false');
  await expect(button).toHaveAttribute('aria-label', 'Live, 0 in play');
  await expect(button).not.toHaveClass(/m-glass/);
  await expect(page.getByTestId('fallback-live')).toHaveCount(0);
  await expect(page.getByTestId('fallback-count')).toHaveCount(0);
  const bounds = await button.boundingBox();
  expect(bounds!.height).toBeCloseTo(40);
  expect(bounds!.width / bounds!.height).toBeCloseTo(378 / 137.5);
  const samples: string[] = [];
  for (const count of [0, 3, 12, 99]) {
    await page.locator('#count-' + count).click();
    await expect(button).toHaveAttribute('aria-label', 'Live, ' + count + ' in play');
    await page.waitForTimeout(800);
    samples.push(createHash('sha256').update(await button.screenshot()).digest('hex'));
  }
  expect(new Set(samples).size).toBe(4);
  await page.locator('#count-12').click();
  await page.waitForTimeout(800);
  const off = await button.screenshot({ path: 'test-results/live-host-off-' + testInfo.project.name + '.png' });
  await button.focus();
  await page.keyboard.press('Space');
  await expect(button).toHaveAttribute('aria-pressed', 'true');
  await page.waitForTimeout(1000);
  const on = await button.screenshot({ path: 'test-results/live-host-on-' + testInfo.project.name + '.png' });
  expect(createHash('sha256').update(on).digest('hex')).not.toBe(createHash('sha256').update(off).digest('hex'));
  await button.click();
  await expect(button).toHaveAttribute('aria-pressed', 'false');
  for (let i = 0; i < 3; i++) {
    await page.locator('#mount').click();
    await expect(button).toHaveCount(0);
    await expect.poll(() => page.evaluate(() => window.liveHostProbe.slots)).toBe(0);
    await page.locator('#mount').click();
    await ready();
    await expect(button).toHaveAttribute('aria-pressed', 'false');
    await expect(button).toHaveAttribute('aria-label', 'Live, 12 in play');
  }
  expect(errors).toEqual([]);
  console.log('LIVE_HOST ' + JSON.stringify({ project: testInfo.project.name, bounds, countImages: 4, keyboard: true, remounts: 3, slots: await page.evaluate(() => window.liveHostProbe.slots), errors }));
});
