/* global window, process, console, PerformanceObserver */
// Part 21: the slowest event of each main interaction (Event Timing, as INP counts it). See README.md.
//   node verification/perf/inp.mjs [--rate 6] [--width 390] [--height 844] [--no-rive]
import { chromium } from '@playwright/test';

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i < 0 ? fallback : process.argv[i + 1];
};
const base = arg('base', 'http://127.0.0.1:4173');
const rate = Number(arg('rate', '6'));
const width = Number(arg('width', '390'));
const height = Number(arg('height', '844'));
const phone = width < 600;

const browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader'], ...(process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {}) });
const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 2, hasTouch: phone, isMobile: phone });
await page.addInitScript(() => {
  window.__events = [];
  new PerformanceObserver((list) => {
    for (const e of list.getEntries()) if (e.interactionId) window.__events.push({ name: e.name, dur: e.duration, delay: e.processingStart - e.startTime, work: e.processingEnd - e.processingStart });
  }).observe({ type: 'event', buffered: true, durationThreshold: 16 });
});
if (process.argv.includes('--no-rive')) await page.route('**/*.riv', (r) => r.abort());
const cdp = await page.context().newCDPSession(page);
await page.goto(`${base}/?demo`);
await page.waitForTimeout(4000);
await cdp.send('Emulation.setCPUThrottlingRate', { rate });
await page.waitForTimeout(1500);

const tap = (loc) => (phone ? loc.tap() : loc.click());
const rows = [];
async function measure(label, act) {
  const from = await page.evaluate(() => window.__events.length);
  await act();
  await page.waitForTimeout(1800);
  const evs = await page.evaluate((n) => window.__events.slice(n), from);
  const worst = evs.sort((a, b) => b.dur - a.dur)[0];
  rows.push(`${label.padEnd(24)} ${worst ? `${worst.dur.toFixed(0).padStart(4)} ms  (${worst.name}: input delay ${worst.delay.toFixed(0)}, handlers ${worst.work.toFixed(0)})` : '   - (no event over 16 ms)'}`);
}
await measure('Live on', () => tap(page.getByRole('button', { name: /^Live,/ }).first()));
await measure('Live off', () => tap(page.getByRole('button', { name: /^Live,/ }).first()));
await measure('day tab: Yesterday', () => tap(page.getByRole('tab', { name: 'Yesterday' })));
await measure('day tab: Today', () => tap(page.getByRole('tab', { name: /^(Today|Ongoing)$/ })));
await measure('open a match', () => tap(page.getByRole('button', { name: /France .* Argentina/ }).last()));
await measure('match tab: Stats', () => tap(page.getByRole('tab', { name: 'Stats' })));
await measure('match tab: Lineup', () => tap(page.getByRole('tab', { name: 'Lineup' })));
await measure('open a player', () => tap(page.locator('[data-player]').first()));
await measure('open the menu sheet', async () => {
  await page.goto(`${base}/?demo`);
  await page.waitForTimeout(3000);
  await tap(page.getByRole('button', { name: 'Menu' }));
});
await measure('close it (Escape)', () => page.keyboard.press('Escape'));
await browser.close();
console.log(`INP-style worst event per interaction at ${rate}x, ${width}x${height}${process.argv.includes('--no-rive') ? ', Rive blocked' : ''} (budget 200 ms):`);
for (const r of rows) console.log(`  ${r}`);
