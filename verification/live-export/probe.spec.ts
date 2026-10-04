import { createHash } from 'node:crypto';
import { expect, test } from '@playwright/test';
import sharp from 'sharp';

test('selected Live artboard binds count to the calendar and preserves toggle animation', async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('/verification/live-export/probe.html');
  await expect.poll(() => page.evaluate(() => window.editorProbe?.ready), { timeout: 30000 }).toBe(true);
  const probe = await page.evaluate(() => window.editorProbe);
  console.log('LIVE_CANDIDATE ' + JSON.stringify(probe));
  expect(probe.properties).toEqual(expect.arrayContaining([
    { name: 'islive', type: 'boolean' }, { name: 'count', type: 'string' },
  ]));
  // The host must explicitly choose the full button when a helper artboard remains in the file.
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
