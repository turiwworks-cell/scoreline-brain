/* global window, document, performance, PerformanceObserver, MutationObserver, process, console, URL */
// Part 21: long frames of the production build under CPU throttling, by cause. See README.md.
//   node verification/perf/profile.mjs [--path /?demo=fast] [--seconds 120] [--rate 6] [--width 390] [--height 844] [--no-rive] [--out file.json]
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { chromium } from '@playwright/test';
import { SourceMapConsumer } from 'source-map-js';

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i < 0 ? fallback : process.argv[i + 1];
};
const flag = (name) => process.argv.includes(`--${name}`);
const base = arg('base', 'http://127.0.0.1:4173');
const path = arg('path', '/?demo=fast');
const seconds = Number(arg('seconds', '120'));
const rate = Number(arg('rate', '6'));
const width = Number(arg('width', '390'));
const height = Number(arg('height', '844'));
const out = arg('out', '');
const dist = resolve(import.meta.dirname, '../../dist/assets');
const phone = width < 600;

const browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader'], ...(process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {}) });
const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 2, hasTouch: phone, isMobile: phone });
await page.addInitScript(() => {
  window.__perf = { loaf: [], stage: [] };
  new PerformanceObserver((list) => {
    for (const e of list.getEntries())
      window.__perf.loaf.push({ start: e.startTime, dur: e.duration, block: e.blockingDuration, scripts: e.scripts.map((s) => ({ inv: s.invoker, url: s.sourceURL, pos: s.sourceCharPosition, dur: s.duration, layout: s.forcedStyleAndLayoutDuration })) });
  }).observe({ type: 'long-animation-frame', buffered: true });
  const on = new Set();
  new MutationObserver(() => {
    for (const id of ['moment-scene', 'moment-toast']) {
      const now = document.querySelector(`[data-testid="${id}"]`) !== null;
      if (now !== on.has(id)) {
        if (now) on.add(id);
        else on.delete(id);
        window.__perf.stage.push({ t: performance.now(), id, on: now });
      }
    }
  }).observe(document, { subtree: true, childList: true });
});
if (flag('no-rive')) await page.route('**/*.riv', (r) => r.abort());
const cdp = await page.context().newCDPSession(page);
await cdp.send('Emulation.setCPUThrottlingRate', { rate });
await page.goto(base + path);
await page.waitForTimeout(seconds * 1000);
const data = await page.evaluate(() => window.__perf);
await browser.close();
if (out) writeFileSync(out, JSON.stringify(data));

// where a script's char position is in the sources (needs `vite build --sourcemap`)
const maps = new Map();
function where(url, pos) {
  if (!url || pos < 0) return '(no source)';
  const file = basename(new URL(url).pathname);
  const js = join(dist, file);
  if (!existsSync(`${js}.map`)) return `${file}@${pos}`;
  if (!maps.has(file)) maps.set(file, { src: readFileSync(js, 'utf8'), map: new SourceMapConsumer(JSON.parse(readFileSync(`${js}.map`, 'utf8'))) });
  const { src, map } = maps.get(file);
  const before = src.slice(0, pos);
  const o = map.originalPositionFor({ line: before.split('\n').length, column: pos - before.lastIndexOf('\n') - 1 });
  return o.source ? `${o.source.replace(/^.*?((src|node_modules)\/)/, '$1')}:${o.line}` : `${file}@${pos}`;
}
// a frame's cause: a demo poll tick (the demo source's timer), a moment on stage, start-up, or else
function cause(f) {
  const scene = data.stage.find((s) => s.on && f.start + f.dur >= s.t - 50 && f.start <= s.t + 2500);
  if (scene) return scene.id === 'moment-scene' ? 'goal scene' : 'toast';
  if (f.start < 6000) return 'start-up';
  if (f.scripts.some((s) => s.inv.startsWith('TimerHandler') && /\/demo-[^/]*\.js$/.test(s.url))) return 'poll';
  return 'other';
}
const long = data.loaf.filter((f) => f.dur > 50);
const groups = new Map();
for (const f of long) groups.set(cause(f), [...(groups.get(cause(f)) ?? []), f]);
console.log(`${path} at ${rate}x, ${width}x${height}${flag('no-rive') ? ', Rive blocked' : ''}: ${long.length} frames over 50 ms in ${seconds} s`);
for (const [k, fs] of groups) {
  const d = fs.map((f) => f.dur).sort((a, b) => a - b);
  console.log(`  ${k.padEnd(11)} n ${String(fs.length).padStart(3)}  median ${d[d.length >> 1].toFixed(0).padStart(4)} ms  max ${d[d.length - 1].toFixed(0).padStart(4)} ms`);
}
console.log('\nworst frames:');
for (const f of [...long].sort((a, b) => b.dur - a.dur).slice(0, 12)) {
  const top = [...f.scripts].sort((a, b) => b.dur - a.dur).slice(0, 2).map((s) => `${s.dur.toFixed(0)} ms ${s.inv} ${where(s.url, s.pos)}${s.layout > 1 ? ` (forced layout ${s.layout.toFixed(0)} ms)` : ''}`);
  console.log(`  ${(f.start / 1000).toFixed(1).padStart(6)} s  ${f.dur.toFixed(0).padStart(4)} ms  [${cause(f)}]  ${top.join('; ')}`);
}
