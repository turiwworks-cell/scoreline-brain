/* global process, console, window, document, performance, requestAnimationFrame, PerformanceObserver */
// Includes sub-50-ms polls, unlike Long Animation Frames, and excludes demo feed construction.
// node verification/perf/poll-replay.mjs [--root repo] [--rate 3.6] [--samples 40] [--matches 300] [--out file.json]
// node verification/perf/poll-replay.mjs --first-data [--runs 5] [--matches 300] [--rate 3.6] [--trace file.json] [--out file.json]
//   the first feed only: its synchronous apply and render, and the long frames around it
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { build, preview } from 'vite';
import { chromium } from '@playwright/test';
import { anatomy, TRACE_CATEGORIES } from './trace.mjs';
const arg = (key, fallback) => { const i = process.argv.indexOf(`--${key}`); return i < 0 ? fallback : process.argv[i + 1]; };
const root = resolve(arg('root', '.'));
const rate = Number(arg('rate', '3.6'));
const samples = Number(arg('samples', '40'));
const matches = Number(arg('matches', '0'));
const out = arg('out', '');
const firstData = process.argv.includes('--first-data');
const runs = Number(arg('runs', '5'));
const traceOut = arg('trace', '');
const dir = await mkdtemp(join(tmpdir(), 'scoreline-poll-'));
let server;
let browser;
try {
  const config = { root, configFile: join(root, 'vite.config.ts'), build: { outDir: dir, emptyOutDir: true, rolldownOptions: { input: join(root, 'verification/perf/poll-replay.html') } }, logLevel: 'error' };
  await build(config);
  server = await preview({ ...config, preview: { host: '127.0.0.1', port: 0 } });
  browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader'], ...(process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {}) });
  if (firstData) {
    // One page per run: the first feed happens once. The CPU is throttled before anything mounts.
    const results = [];
    for (let run = 1; run <= runs; run++) {
      const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
      await page.route('**/*.riv', r => r.abort());
      const errors = [];
      page.on('pageerror', e => errors.push(e.message));
      await page.addInitScript(() => {
        window.__frames = [];
        new PerformanceObserver(list => { for (const e of list.getEntries()) window.__frames.push({ start: e.startTime, duration: e.duration, renderStart: e.renderStart, forced: e.scripts.reduce((a, s) => a + s.forcedStyleAndLayoutDuration, 0), scripts: e.scripts.map(s => ({ inv: s.invoker, dur: s.duration })) }); }).observe({ type: 'long-animation-frame', buffered: true });
        // how many rows are in the DOM, once a frame: when the list got its last row
        window.__fill = [];
        const sample = () => {
          const rows = document.querySelectorAll('[data-focus-key^="match-"]').length;
          if (rows !== window.__fill.at(-1)?.rows) window.__fill.push({ t: performance.now(), rows });
          requestAnimationFrame(sample);
        };
        requestAnimationFrame(sample);
      });
      await page.goto(server.resolvedUrls.local[0] + 'verification/perf/poll-replay.html?demo');
      await page.waitForFunction(() => !!window.__pollReplay);
      await page.evaluate(({ matches }) => window.__pollReplay.prepare(0, matches), { matches });
      const cdp = await page.context().newCDPSession(page);
      await cdp.send('Emulation.setCPUThrottlingRate', { rate });
      if (traceOut && run === 1) await browser.startTracing(page, { categories: TRACE_CATEGORIES });
      await page.evaluate(() => window.__pollReplay.mount(true));
      await page.waitForTimeout(2500); // let anything scheduled after the first paint run, inside the observation
      // the list is mounted in slices (src/features/matchList/progressive.ts): wait for the last of them
      const filled = await page.waitForFunction(() => !document.querySelector('[data-pending]') && !!window.__pollReplay.firstData, null, { timeout: 20000 }).then(() => true, () => false);
      await page.waitForTimeout(300);
      let tasks;
      if (traceOut && run === 1) {
        const trace = JSON.parse((await browser.stopTracing()).toString());
        await writeFile(traceOut, JSON.stringify(trace));
        tasks = anatomy(trace);
      }
      const data = await page.evaluate(() => ({ firstData: window.__pollReplay.firstData, frames: window.__frames, fill: window.__fill, rows: document.querySelectorAll('[data-focus-key^="match-"]').length, groups: document.querySelectorAll('[data-group]').length, pending: document.querySelectorAll('[data-pending]').length, unique: new Set(Array.from(document.querySelectorAll('[data-focus-key^="match-"]'), el => el.getAttribute('data-focus-key'))).size }));
      const frame = data.frames.filter(f => f.start <= data.firstData.start + data.firstData.callback && f.start + f.duration >= data.firstData.start).sort((a, b) => b.duration - a.duration)[0];
      const after = data.frames.filter(f => f.start > data.firstData.start && f.duration > 50 && f !== frame);
      // The frame, taken apart: the work before the store is applied (fetch, JSON, validation, which
      // are not React's), the apply and render the callback timed, and what the browser did after it.
      const end = frame ? frame.start + frame.duration : 0;
      const parts = frame ? { beforeApply: data.firstData.start - frame.start, apply: data.firstData.callback, afterApply: end - (data.firstData.start + data.firstData.callback), renderStart: frame.renderStart - frame.start } : null;
      // the later long frames, by what ran in them: a slice of the list (a timer callback) or anything else
      const slices = after.filter(f => f.scripts.some(s => /setTimeout|Timer/.test(s.inv)));
      // when the last row arrived, counted from the first feed
      const fill = data.fill.find(f => f.rows >= data.rows)?.t;
      results.push({ run, tasks, callback: data.firstData.callback, frame: frame ? { start: frame.start, duration: frame.duration, forced: frame.forced } : null, parts, later: after.map(f => ({ start: f.start, duration: f.duration, timer: f.scripts.some(s => /setTimeout|Timer/.test(s.inv)), scripts: f.scripts })), laterTimer: slices.length, fillMs: fill === undefined ? null : fill - data.firstData.start, fill: data.fill.map(f => ({ t: Math.round(f.t - data.firstData.start), rows: f.rows })), rows: data.rows, groups: data.groups, pending: data.pending, unique: data.unique, filled, errors });
      await page.close();
    }
    // What decoding and validating the first feed costs on its own, cold, on pages that never mount the app.
    const parse = [];
    for (let run = 1; run <= runs; run++) {
      const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
      await page.goto(server.resolvedUrls.local[0] + 'verification/perf/poll-replay.html?demo');
      await page.waitForFunction(() => !!window.__pollReplay);
      await page.evaluate(({ matches }) => window.__pollReplay.prepare(0, matches), { matches });
      const cdp = await page.context().newCDPSession(page);
      await cdp.send('Emulation.setCPUThrottlingRate', { rate });
      parse.push(await page.evaluate(() => window.__pollReplay.parseCost()));
      await page.close();
    }
    const med = values => [...values].sort((a, b) => a - b)[values.length >> 1];
    const durations = results.map(r => r.frame?.duration ?? 0);
    console.log(JSON.stringify({ mode: 'first-data', rate, matches: matches || 'demo fixtures', runs, rows: results[0].rows, groups: results[0].groups, callback: results.map(r => Math.round(r.callback)), frame: durations.map(Math.round), frameMedian: Math.round(med(durations)), parseBytes: parse[0].bytes, parseJson: parse.map(p => Math.round(p.json)), parseValidate: parse.map(p => Math.round(p.validate)), forcedLayout: results.map(r => Math.round(r.frame?.forced ?? 0)), beforeApply: results.map(r => Math.round(r.parts?.beforeApply ?? 0)), afterApply: results.map(r => Math.round(r.parts?.afterApply ?? 0)), fillMs: results.map(r => r.fillMs === null ? null : Math.round(r.fillMs)), sliceFramesOver50: results.map(r => r.later.filter(f => f.timer).map(f => Math.round(f.duration))), allFilled: results.every(r => r.filled && r.pending === 0 && r.unique === r.rows), laterFramesOver50: results.map(r => r.later.map(f => `${Math.round(f.duration)}${f.timer ? 't' : ''}`)), errors: results.flatMap(r => r.errors) }, null, 2));
    if (results[0].tasks) {
      console.log('task anatomy of run 1, traced (ms): start  dur | script style layout observers paint gc other | top call');
      for (const t of results[0].tasks) console.log(`  ${t.start.toFixed(0).padStart(6)} ${t.dur.toFixed(0).padStart(5)} | ${['script', 'style', 'layout', 'observers', 'paint', 'gc', 'other'].map(k => t.self[k].toFixed(0).padStart(5)).join(' ')} | ${t.top}`);
    }
    if (out) await writeFile(out, JSON.stringify({ rate, matches, parse, results }, null, 2));
    if (results.some(r => r.errors.length || !r.filled || r.pending !== 0 || r.unique !== r.rows)) process.exitCode = 1;
  } else {
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
  }
} finally {
  await browser?.close();
  await server?.httpServer.close();
  await rm(dir, { recursive: true, force: true });
}
