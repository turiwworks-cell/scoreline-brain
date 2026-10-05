/* global process, console */
// Part 21 (#4): is what the host sends compressed, and is the WASM served as application/wasm?
//   node verification/perf/compression.mjs [--base http://127.0.0.1:4173] [--dist dist] [--out file.json]
// Requests every built asset with `Accept-Encoding: br, gzip` and counts the bytes on the wire against the file's
// size. Exits 1 if the Rive WASM goes out uncompressed or with another content type (streaming compilation needs
// application/wasm; 2.27 MB raw is 0.93 MB gzipped, 0.73 MB brotli).
// `vite preview`, the server this repo's tests use, gzips scripts and styles but NOT application/wasm, so a run
// against it says nothing about the real host: point --base at that.
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import http from 'node:http';
import https from 'node:https';

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i < 0 ? fallback : process.argv[i + 1];
};
const base = arg('base', 'http://127.0.0.1:4173').replace(/\/$/, '');
const dist = arg('dist', 'dist');
const out = arg('out', '');

const walk = (dir) => readdirSync(dir).flatMap((name) => {
  const path = join(dir, name);
  return statSync(path).isDirectory() ? walk(path) : [path];
});
const files = walk(dist).filter((f) => /\.(js|css|wasm|svg|json|html|webmanifest|riv)$/.test(f));

function wire(url) {
  return new Promise((resolve, reject) => {
    const get = url.startsWith('https') ? https.get : http.get;
    get(url, { headers: { 'accept-encoding': 'br, gzip' } }, (res) => {
      let bytes = 0;
      res.on('data', (chunk) => { bytes += chunk.length; });
      res.on('end', () => resolve({ status: res.statusCode, type: res.headers['content-type'] ?? '', encoding: res.headers['content-encoding'] ?? '', bytes }));
    }).on('error', reject);
  });
}

const rows = [];
for (const file of files.sort()) {
  const path = '/' + relative(dist, file).split(sep).join('/');
  const raw = readFileSync(file).length;
  const r = await wire(base + path);
  rows.push({ path, raw, ...r });
}
const textual = /\.(js|css|svg|json|html|webmanifest)$/;
const problems = [];
console.log(`${base} against ${dist}/ (${rows.length} files)`);
console.log('  raw bytes   on the wire  encoding  content type                    path');
for (const r of rows) {
  const compressible = r.path.endsWith('.wasm') || (textual.test(r.path) && r.raw > 1400);
  const flag = compressible && !r.encoding ? '  <- not compressed' : '';
  if (r.status !== 200) problems.push(`${r.path}: HTTP ${r.status}`);
  if (r.path.endsWith('.wasm')) {
    if (!r.encoding) problems.push(`${r.path}: sent uncompressed (${r.raw} bytes)`);
    if (!r.type.startsWith('application/wasm')) problems.push(`${r.path}: content type ${r.type || '(none)'}, not application/wasm`);
  }
  if (r.raw > 20000 || flag) console.log(`${String(r.raw).padStart(11)} ${String(r.bytes).padStart(13)}  ${(r.encoding || '-').padEnd(8)}  ${r.type.slice(0, 30).padEnd(30)}  ${r.path}${flag}`);
}
console.log(problems.length ? `\nproblems:\n  ${problems.join('\n  ')}` : '\nthe WASM is compressed and served as application/wasm');
if (out) writeFileSync(out, JSON.stringify({ base, rows, problems }, null, 1));
if (problems.length) process.exitCode = 1;
