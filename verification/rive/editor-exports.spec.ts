import { createHash } from 'node:crypto';
import { expect, test } from '@playwright/test';
import sharp from 'sharp';

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

test('corrected Live production export binds count to the calendar and preserves toggle animation', async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('/verification/rive/editor-exports.html?asset=live&candidate=1');
  await expect.poll(() => page.evaluate(() => window.editorProbe?.ready), { timeout: 30000 }).toBe(true);
  const probe = await page.evaluate(() => window.editorProbe);
  console.log('LIVE_CANDIDATE ' + JSON.stringify(probe));
  expect(probe.properties).toEqual(expect.arrayContaining([
    { name: 'islive', type: 'boolean' }, { name: 'count', type: 'string' },
  ]));
  // A glyph helper may remain under budget; the selected full artboard must expose the contract.
  expect(probe.selectedArtboard).toBe('aniamtion');
  expect(probe.contents.artboards.map((a: { name: string }) => a.name)).toContain('aniamtion');
  const ratio = (probe.bounds.maxX - probe.bounds.minX) / (probe.bounds.maxY - probe.bounds.minY);
  expect(ratio).toBeGreaterThan(2.8);
  expect(ratio).toBeLessThan(3.0);
  await page.evaluate(() => window.editorAsset.live(false));
  await page.waitForTimeout(1000);
  const samples = new Map<string, string>();
  const calendarPixels = async (png: Buffer) => {
    const metadata = await sharp(png).metadata();
    const width = metadata.width!, height = metadata.height!;
    const left = Math.floor(width * 0.6);
    const pixels = await sharp(png).extract({ left, top: 0, width: width - left, height }).raw().toBuffer();
    return createHash('sha256').update(pixels).digest('hex');
  };
  for (const count of ['0', '3', '12', '99', '0']) {
    await page.evaluate((value) => window.editorAsset.count(value), count);
    await expect.poll(() => page.evaluate(() => window.editorAsset.countValue())).toBe(count);
    await page.waitForTimeout(600);
    const png = await page.locator('canvas').screenshot({ path: `test-results/editor-live-count-${count}-${testInfo.project.name}.png` });
    const pixels = await calendarPixels(png);
    if (samples.has(count)) expect(pixels).toBe(samples.get(count));
    else samples.set(count, pixels);
  }
  // Readback alone cannot prove a text binding. Four calendar images must actually differ.
  expect(new Set(samples.values()).size).toBe(4);
  const off = await page.locator('canvas').screenshot({ path: `test-results/editor-live-candidate-off-${testInfo.project.name}.png` });
  await page.evaluate(() => window.editorAsset.live(true));
  await page.waitForTimeout(1000);
  const on = await page.locator('canvas').screenshot({ path: `test-results/editor-live-candidate-on-${testInfo.project.name}.png` });
  expect(createHash('sha256').update(on).digest('hex')).not.toBe(createHash('sha256').update(off).digest('hex'));
  for (let i = 0; i < 20; i++) {
    await page.evaluate(({ live, count }) => {
      window.editorAsset.live(live); window.editorAsset.count(count);
    }, { live: i % 2 === 0, count: String(i) });
    await page.waitForTimeout(50);
  }
  await page.evaluate(() => window.editorAsset.live(false));
  await page.waitForTimeout(1000);
  await page.evaluate(() => window.editorAsset.count('12'));
  await page.waitForTimeout(600);
  const final = await page.locator('canvas').screenshot();
  expect(await calendarPixels(final)).toBe(samples.get('12'));
  expect(await page.evaluate(() => window.editorProbe.errors)).toEqual([]);
  expect(errors).toEqual([]);
  console.log('LIVE_CANDIDATE_COUNTS ' + JSON.stringify({ counts: [...samples.keys()], calendarPixelHashes: [...samples.values()], errors }));
  await page.evaluate(() => window.editorAsset.cleanup());
});
