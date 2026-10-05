/* global window, document, performance, PerformanceObserver, MutationObserver, process, console */
// Part 21: the first seconds of a production page load under CPU throttling. See README.md.
//   node verification/perf/startup.mjs [--path /?demo=fast] [--rate 3.6] [--width 390] [--height 844]
//        [--seconds 6] [--runs 1] [--no-rive] [--network slow4g] [--resources] [--trace file.json] [--out file.json]
// Per run: the first paint and every Largest Contentful Paint candidate (with its element), when the
// header and the first match rows reached the DOM, every Long Animation Frame over 50 ms (with the
// scripts in it and their forced layout), and layout shifts. With --trace, a Chrome trace is saved and
// every main-thread task over 50 ms is broken into script / style / layout / paint / GC / other.
// --network slow4g adds Lighthouse's mobile network (RTT 150 ms, 1.6 Mbps down) to the CPU throttle, applied
// in the browser; --resources lists each request's start and end (with --network, it shows what waits for what).
// Tracing slows the page down: take timings from runs without --trace and anatomy from runs with it.
import { writeFileSync } from 'node:fs';
import { chromium } from '@playwright/test';
import { anatomy, TRACE_CATEGORIES } from './trace.mjs';

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i < 0 ? fallback : process.argv[i + 1];
};
const flag = (name) => process.argv.includes(`--${name}`);
const base = arg('base', 'http://127.0.0.1:4173');
const path = arg('path', '/?demo=fast');
const rate = Number(arg('rate', '3.6'));
const width = Number(arg('width', '390'));
const height = Number(arg('height', '844'));
const seconds = Number(arg('seconds', '6'));
const runs = Number(arg('runs', '1'));
const traceOut = arg('trace', '');
const network = arg('network', '');
const out = arg('out', '');
const phone = width < 600;

const browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader'], ...(process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {}) });

async function once(index) {
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 2, hasTouch: phone, isMobile: phone });
  await page.addInitScript(() => {
    const perf = (window.__startup = { lcp: [], paint: [], loaf: [], longtask: [], shifts: [], seen: {} });
    const watch = (type, push) => {
      try { new PerformanceObserver((list) => list.getEntries().forEach(push)).observe({ type, buffered: true }); } catch { /* not supported */ }
    };
    watch('largest-contentful-paint', (e) => perf.lcp.push({
      t: e.startTime, render: e.renderTime, size: e.size, tag: e.element?.tagName?.toLowerCase() ?? null,
      cls: e.element?.className?.toString().slice(0, 40) ?? null, text: (e.element?.textContent ?? '').trim().slice(0, 30),
    }));
    watch('paint', (e) => perf.paint.push({ name: e.name, t: e.startTime }));
    watch('longtask', (e) => perf.longtask.push({ start: e.startTime, dur: e.duration }));
    watch('layout-shift', (e) => perf.shifts.push({ t: e.startTime, value: e.value, hadInput: e.hadRecentInput }));
    watch('long-animation-frame', (e) => perf.loaf.push({
      start: e.startTime, dur: e.duration, block: e.blockingDuration, renderStart: e.renderStart,
      scripts: e.scripts.map((s) => ({ inv: s.invoker, url: s.sourceURL, dur: s.duration, layout: s.forcedStyleAndLayoutDuration })),
    }));
    // when things reach the DOM (performance.now(), as the paint entries are)
    const mark = () => {
      const s = perf.seen;
      const now = performance.now();
      if (s.h1 === undefined && document.querySelector('h1')) s.h1 = now;
      if (s.tabs === undefined && document.querySelector('[role="tablist"]')) s.tabs = now;
      if (s.rows === undefined && document.querySelector('[data-focus-key^="match-"]')) s.rows = now;
      if (s.staticFrame === undefined && document.querySelector('[data-static-frame]')) s.staticFrame = now;
      if (s.staticFrame !== undefined && s.staticGone === undefined && !document.querySelector('[data-static-frame]')) s.staticGone = now;
    };
    new MutationObserver(mark).observe(document, { subtree: true, childList: true });
    document.addEventListener('DOMContentLoaded', mark);
  });
  if (flag('no-rive')) await page.route('**/*.riv', (r) => r.abort());
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate });
  // Lighthouse's "devtools" throttling for its mobile profile: request latency 3.75 x RTT, 1.6 Mbps less 10 %, 750 kbps up
  if (network === 'slow4g') {
    await cdp.send('Network.enable');
    await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 562.5, downloadThroughput: (1474.56 * 1024) / 8, uploadThroughput: (675 * 1024) / 8 });
  }
  const tracing = traceOut !== '';
  if (tracing) await browser.startTracing(page, { categories: TRACE_CATEGORIES });
  await page.goto(base + path, { waitUntil: 'commit' });
  await page.waitForTimeout(seconds * 1000);
  const data = await page.evaluate(() => ({ ...window.__startup, resources: performance.getEntriesByType('resource').map((e) => ({ name: e.name.replace(/^https?:\/\/[^/]+/, ''), start: e.startTime, end: e.responseEnd, size: e.transferSize })) }));
  const trace = tracing ? JSON.parse((await browser.stopTracing()).toString()) : null;
  await page.close();
  return { index, data, trace };
}

const ms = (n) => (n === undefined || n === null ? 'n/a' : `${n.toFixed(0)} ms`);
const results = [];
for (let i = 1; i <= runs; i++) {
  const r = await once(i);
  if (r.trace && i === 1) writeFileSync(traceOut, JSON.stringify(r.trace));
  const d = r.data;
  const fcp = d.paint.find((p) => p.name === 'first-contentful-paint')?.t;
  const lcp = d.lcp.at(-1);
  const long = d.loaf.filter((f) => f.dur > 50);
  const startup = long.filter((f) => f.start < (d.seen.rows ?? 1e9) + 2500);
  const first = long.filter((f) => d.seen.rows !== undefined && f.start <= d.seen.rows && f.start + f.dur >= d.seen.rows - 5).sort((a, b) => b.dur - a.dur)[0];
  const result = { run: i, fcp, lcp, lcpCandidates: d.lcp, resources: d.resources, seen: d.seen, shifts: d.shifts, firstDataFrame: first, longFrames: startup, longtasks: d.longtask.filter((t) => t.dur > 50), anatomy: r.trace ? anatomy(r.trace) : undefined };
  results.push(result);
  console.log(`run ${i}: ${path} at ${rate}x ${width}x${height}${flag('no-rive') ? ', Rive blocked' : ''}`);
  console.log(`  FCP ${ms(fcp)}  LCP ${ms(lcp?.t)} (${lcp ? `<${lcp.tag}> ${JSON.stringify(lcp.text)}` : 'none'})  h1 in DOM ${ms(d.seen.h1)}  rows in DOM ${ms(d.seen.rows)}  CLS ${d.shifts.filter((s) => !s.hadInput).reduce((a, s) => a + s.value, 0).toFixed(4)}`);
  console.log(`  LCP candidates: ${d.lcp.map((c) => `${ms(c.t)} <${c.tag}>${c.text ? ` ${JSON.stringify(c.text)}` : ''} ${c.size}px²`).join(' → ')}`);
  console.log(`  frames over 50 ms until 2.5 s after the first rows: ${startup.length}${first ? `; the first-data frame: ${ms(first.dur)} at ${ms(first.start)}, forced layout ${ms(first.scripts.reduce((a, s) => a + (s.layout ?? 0), 0))}` : ''}`);
  for (const f of startup.sort((a, b) => a.start - b.start)) {
    const top = [...f.scripts].sort((a, b) => b.dur - a.dur)[0];
    console.log(`    ${ms(f.start).padStart(8)}  ${ms(f.dur).padStart(7)}  ${top ? `${ms(top.dur)} ${top.inv} ${(top.url ?? '').split('/').pop()}${top.layout > 1 ? ` (forced layout ${ms(top.layout)})` : ''}` : ''}`);
  }
  if (flag('resources')) {
    console.log('  requests (start → end, ms; transferred bytes):');
    for (const e of [...d.resources].sort((a, b) => a.start - b.start)) console.log(`    ${e.start.toFixed(0).padStart(6)} → ${e.end.toFixed(0).padStart(6)}  ${String(e.size).padStart(8)}  ${e.name.slice(0, 70)}`);
  }
  if (result.anatomy?.length) {
    console.log('  task anatomy (traced run, ms): start  dur | script style layout observers paint gc other | top call');
    for (const t of result.anatomy) {
      const s = t.self;
      console.log(`    ${t.start.toFixed(0).padStart(6)} ${t.dur.toFixed(0).padStart(5)} | ${[s.script, s.style, s.layout, s.observers, s.paint, s.gc, s.other].map((v) => v.toFixed(0).padStart(5)).join(' ')} | ${t.top}`);
    }
  }
}
await browser.close();
if (out) writeFileSync(out, JSON.stringify({ path, rate, width, height, noRive: flag('no-rive'), results }, null, 1));
