import { createHash } from 'node:crypto';
import { expect, test } from '@playwright/test';

test('signed Moments export replays both words and reports every phase', async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('/verification/rive/editor-exports.html?asset=moments');
  await expect.poll(() => page.evaluate(() => window.editorProbe?.ready), { timeout: 30000 }).toBe(true);
  console.log('MOMENTS_EXPORT ' + JSON.stringify(await page.evaluate(() => window.editorProbe)));
  for (let i = 0; i < 20; i++) {
    const kind = i % 2 === 0 ? 'goal' : 'red';
    const before = await page.evaluate(() => window.editorProbe.phases.length);
    await page.evaluate(({ kind, i }) => window.editorAsset.play(kind, 0xff0055a4 + i, 0xffef4135 - i), { kind, i });
    await expect.poll(() => page.evaluate(() => window.editorAsset.phase()), { timeout: 5000 }).toBe(2);
    expect(await page.evaluate((before) => window.editorProbe.phases.slice(before).filter((n) => n !== 0), before)).toEqual([1, 2]);
    if (i < 2) await page.locator('canvas').screenshot({ path: `test-results/editor-${kind}-${testInfo.project.name}.png` });
  }
  // A new trigger interrupts the current entrance, including a change of kind.
  await page.evaluate(() => window.editorAsset.play('goal'));
  await page.waitForTimeout(200);
  await page.evaluate(() => window.editorAsset.play('red'));
  await expect.poll(() => page.evaluate(() => window.editorAsset.phase())).toBe(2);
  expect(await page.evaluate(() => window.editorProbe.errors)).toEqual([]);
  expect(errors).toEqual([]);
  console.log('MOMENTS_REPLAY ' + JSON.stringify(await page.evaluate(() => window.editorProbe)));
  await page.evaluate(() => window.editorAsset.cleanup());
});

test('original Live export responds visually to its bound islive value', async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('/verification/rive/editor-exports.html?asset=live');
  await expect.poll(() => page.evaluate(() => window.editorProbe?.ready), { timeout: 30000 }).toBe(true);
  console.log('LIVE_EXPORT ' + JSON.stringify(await page.evaluate(() => window.editorProbe)));
  await page.evaluate(() => window.editorAsset.live(false));
  await page.waitForTimeout(1000);
  expect(await page.evaluate(() => window.editorAsset.liveValue())).toBe(false);
  const off = await page.locator('canvas').screenshot({ path: `test-results/editor-live-off-${testInfo.project.name}.png` });
  await page.evaluate(() => window.editorAsset.live(true));
  await page.waitForTimeout(1000);
  expect(await page.evaluate(() => window.editorAsset.liveValue())).toBe(true);
  const on = await page.locator('canvas').screenshot({ path: `test-results/editor-live-on-${testInfo.project.name}.png` });
  expect(createHash('sha256').update(on).digest('hex')).not.toBe(createHash('sha256').update(off).digest('hex'));
  for (let i = 0; i < 20; i++) {
    await page.evaluate((value) => window.editorAsset.live(value), i % 2 === 0);
    await page.waitForTimeout(50);
  }
  expect(await page.evaluate(() => window.editorProbe.errors)).toEqual([]);
  expect(errors).toEqual([]);
  await page.evaluate(() => window.editorAsset.cleanup());
});
