import { expect, test } from '@playwright/test';
import type {} from './fixture';

test('real runtime releases twenty scene instances and pauses when hidden or offscreen', async ({ page }, testInfo) => {
  const browserErrors: string[] = [];
  page.on('pageerror', (error) => { browserErrors.push(error.message); console.log('RIVE_PAGE_ERROR ' + error.message); });
  page.on('console', (message) => { if (message.type() === 'error') console.log('RIVE_CONSOLE_ERROR ' + message.text()); });
  page.on('requestfailed', (request) => console.log('RIVE_REQUEST_ERROR ' + request.url() + ': ' + request.failure()?.errorText));
  await page.goto('/verification/rive/fixture.html');
  await expect.poll(() => page.evaluate(() => !!window.riveProbe)).toBe(true);
  test.skip(await page.evaluate(() => window.riveProbe.pendingAssets), 'Part 20 live-icon.riv and moments.riv are required; heap acceptance remains pending.');
  try {
    await expect.poll(() => page.evaluate(() => window.riveProbe?.ready ?? 0), { timeout: 30_000 }).toBe(1);
  } catch (error) {
    console.log('RIVE_STARTUP ' + JSON.stringify(await page.evaluate(() => window.riveProbe)) + ' ' + JSON.stringify(browserErrors));
    throw error;
  }
  const cdp = await page.context().newCDPSession(page);
  const heap = async () => {
    await cdp.send('HeapProfiler.collectGarbage');
    const js = await cdp.send('Runtime.getHeapUsage');
    const wasm = await page.evaluate(() => window.riveProbe.wasmBytes);
    return { js, wasm };
  };
  const scene = async () => {
    const before = await page.evaluate(() => ({ ready: window.riveProbe.ready, landed: window.riveProbe.landed }));
    await page.locator('#next').click();
    await expect.poll(() => page.evaluate(() => window.riveProbe.ready)).toBe(before.ready + 1);
    expect(await page.evaluate(() => window.riveProbe.slots)).toBe(2);
    await expect.poll(() => page.evaluate(() => window.riveProbe.landed)).toBe(before.landed + 1);
    await page.locator('#close').click();
    await expect.poll(() => page.evaluate(() => window.riveProbe.slots)).toBe(1);
  };
  for (let i = 0; i < 4; i++) await scene();
  const before = await heap();
  for (let i = 0; i < 20; i++) await scene();
  const after = await heap();
  expect(after.js.usedSize - before.js.usedSize).toBeLessThan(2 * 1024 * 1024);
  if (before.wasm !== null && after.wasm !== null) expect(after.wasm - before.wasm).toBeLessThanOrEqual(2 * 1024 * 1024);
  expect(await page.evaluate(() => window.riveProbe.bound - window.riveProbe.cleaned)).toBe(1);
  // IntersectionObserver stops the real state-machine frame loop.
  await page.locator('#offscreen').click();
  await page.waitForTimeout(150);
  const offscreen = await page.evaluate(() => window.riveProbe.advances);
  await page.waitForTimeout(400);
  expect(await page.evaluate(() => window.riveProbe.advances)).toBe(offscreen);
  await page.locator('#offscreen').click();
  await expect.poll(() => page.evaluate(() => window.riveProbe.advances)).toBeGreaterThan(offscreen);
  // Synthetic visibility exercises our handler; it is not an OS-level background-tab measurement.
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    document.dispatchEvent(new Event('visibilitychange'));
    window.dispatchEvent(new Event('resize'));
  });
  await page.waitForTimeout(100);
  const hidden = await page.evaluate(() => window.riveProbe.advances);
  await page.waitForTimeout(400);
  expect(await page.evaluate(() => window.riveProbe.advances)).toBe(hidden);
  expect(await page.evaluate(() => window.riveProbe.errors)).toEqual([]);
  expect(browserErrors).toEqual([]);
  const evidence = { project: testInfo.project.name, before, after, retainedInstances: 1, scenes: 20, offscreen, hidden, syntheticVisibility: true, assets: ['live-icon.riv', 'moments.riv'] };
  console.log('RIVE_EVIDENCE ' + JSON.stringify(evidence));
  await testInfo.attach('heap-and-ownership', { body: JSON.stringify(evidence, null, 2), contentType: 'application/json' });
});
