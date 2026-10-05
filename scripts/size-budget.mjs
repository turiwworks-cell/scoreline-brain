/* global process, console, URL */
// ARCHITECTURE §7: the entry and every modulepreload count, once each. Rive must stay lazy.
import { readFileSync } from 'node:fs';
import { resolve, relative, isAbsolute } from 'node:path';
import { gzipSync } from 'node:zlib';

const dist = resolve(process.argv[2] ?? 'dist');
const html = readFileSync(resolve(dist, 'index.html'), 'utf8');
const attrs = (tag) => Object.fromEntries([...tag.matchAll(/([\w:-]+)\s*=\s*["']([^"']*)["']/g)].map((m) => [m[1], m[2]]));
const urls = new Set();
for (const match of html.matchAll(/<(?:script|link)\b[^>]*>/gi)) {
  const tag = match[0];
  const a = attrs(tag);
  if (/^<script/i.test(tag) && a.type === 'module' && a.src) urls.add(a.src);
  if (/^<link/i.test(tag) && a.rel?.split(/\s+/).includes('modulepreload') && a.href) urls.add(a.href);
}
if (urls.size === 0) throw new Error('No initial module found in dist/index.html');

let bytes = 0;
for (const url of urls) {
  if (/^[a-z]+:/i.test(url) || url.startsWith('//')) throw new Error(`Initial module must be local: ${url}`);
  const name = decodeURIComponent(new URL(url, 'https://size.invalid').pathname).replace(/^\//, '');
  if (/\.wasm$|(?:^|\/)(?:runtime|RiveCanvas|WordGraphic|animationFeatures|MatchScreen|PlayerScreen)-/.test(name)) {
    throw new Error(`Lazy asset unexpectedly in the initial graph: ${name}`);
  }
  const file = resolve(dist, name);
  const path = relative(dist, file);
  if (path.startsWith('..') || isAbsolute(path)) throw new Error(`Initial module outside dist: ${name}`);
  const size = gzipSync(readFileSync(file)).length;
  bytes += size;
  console.log(`${name.padEnd(55)} ${(size / 1000).toFixed(2).padStart(7)} KB gzip`);
}
const limit = 180_000;
console.log(`Initial JavaScript: ${(bytes / 1000).toFixed(2)} KB gzip / ${limit / 1000} KB`);
if (bytes > limit) {
  console.error('Initial JavaScript exceeds the budget.');
  process.exitCode = 1;
}
