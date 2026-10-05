/* global process, console, window, PerformanceObserver */
// Includes sub-50-ms polls, unlike Long Animation Frames, and excludes demo feed construction.
// node verification/perf/poll-replay.mjs [--root repo] [--rate 3.6] [--samples 40] [--matches 300] [--out file.json]
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { build, preview } from 'vite';
import { chromium } from '@playwright/test';
const arg = (key, fallback) => { const i = process.argv.indexOf(`--${key}`); return i < 0 ? fallback : process.argv[i + 1]; };
const root = resolve(arg('root', '.'));
const rate = Number(arg('rate', '3.6'));
const samples = Number(arg('samples', '40'));
const matches = Number(arg('matches', '0'));
const out = arg('out', '');
const dir = await mkdtemp(join(tmpdir(), 'scoreline-poll-'));
let server;
let browser;
try {
  const config = { root, configFile: join(root, 'vite.config.ts'), build: { outDir: dir, emptyOutDir: true, rolldownOptions: { input: join(root, 'verification/perf/poll-replay.html') } }, logLevel: 'error' };
  await build(config);
  server = await preview({ ...config, preview: { host: '127.0.0.1', port: 0 } });
  browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader'], ...(process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {}) });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  await page.route('**/*.riv', r => r.abort());
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(server.resolvedUrls.local[0] + 'verification/perf/poll-replay.html?demo');
  await page.waitForFunction(() => !!window.__pollReplay);
  await page.evaluate(({ samples, matches }) => window.__pollReplay.prepare(samples, matches), { samples, matches });
  await page.evaluate(() => window.__pollReplay.mount());
  await page.waitForTimeout(2000); // allow font, feature and screen preloads to settle, outside timing
  await page.evaluate(() => {
    window.__pollTasks = [];
    new PerformanceObserver(list => { for (const e of list.getEntries()) window.__pollTasks.push({ start: e.startTime, duration: e.duration }); }).observe({ type: 'longtask' });
  });
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate });
  const times = [];
  for (let i = 1; i <= samples; i++) times.push(await page.evaluate(i => window.__pollReplay.poll(i), i));
  const tasks = await page.evaluate(() => window.__pollTasks);
  const pollTasks = tasks.filter(t => times.some(p => t.start >= p.start - 1 && t.start < p.start + p.untilPaint));
  const summary = values => { const sorted = [...values].sort((a,b) => a-b); return { median: sorted[sorted.length >> 1] ?? 0, max: sorted.at(-1) ?? 0 }; };
  const result = { rate, matches: matches || 'demo fixtures', samples, callback: summary(times.map(p => p.callback)), untilPaint: summary(times.map(p => p.untilPaint)), longTasks: pollTasks, errors, times };
  console.log(JSON.stringify({ ...result, times: undefined }, null, 2));
  if (out) await writeFile(out, JSON.stringify(result, null, 2));
  if (errors.length) process.exitCode = 1;
} finally {
  await browser?.close();
  await server?.httpServer.close();
  await rm(dir, { recursive: true, force: true });
}
