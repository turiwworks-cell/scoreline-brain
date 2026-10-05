/* global process, console */
// Part 21: a one-line-per-run summary of Lighthouse JSON reports. See README.md.
//   node verification/perf/lh-summary.mjs run1.json run2.json ...
import { readFileSync } from 'node:fs';
import { basename } from 'node:path';

const files = process.argv.slice(2);
if (files.length === 0) {
  console.error('usage: node verification/perf/lh-summary.mjs report.json [...]');
  process.exit(1);
}

const sec = (ms) => (ms === undefined ? '  n/a' : (ms / 1000).toFixed(2).padStart(5));
const rows = [];
for (const file of files) {
  const r = JSON.parse(readFileSync(file, 'utf8'));
  const a = r.audits;
  // Lighthouse 13 reports the LCP element and its phases in the insight audit
  const parts = a['lcp-breakdown-insight']?.details?.items ?? [];
  const lcpNode = parts.find((p) => p.type === 'node');
  const phases = (parts.find((p) => p.type === 'table')?.items ?? []).map((p) => `${p.label} ${Math.round(p.duration)} ms`).join(', ');
  rows.push({
    file: basename(file),
    perf: r.categories.performance.score,
    a11y: r.categories.accessibility?.score,
    fcp: a['first-contentful-paint'].numericValue,
    lcp: a['largest-contentful-paint'].numericValue,
    tbt: a['total-blocking-time'].numericValue,
    tti: a.interactive?.numericValue,
    si: a['speed-index'].numericValue,
    cls: a['cumulative-layout-shift'].numericValue,
    element: lcpNode ? `${lcpNode.nodeLabel ?? ''} <${lcpNode.path?.split(',').pop()?.toLowerCase()}>` : '(none)',
    bench: r.environment.benchmarkIndex,
    version: r.lighthouseVersion,
    ua: r.environment.hostUserAgent,
    phases,
  });
}
console.log('file'.padEnd(26), 'perf  FCP    LCP    TBT    TTI    SI     CLS    LCP element');
for (const x of rows) {
  console.log(
    x.file.padEnd(26),
    String(x.perf).padEnd(5),
    sec(x.fcp), sec(x.lcp), sec(x.tbt), sec(x.tti), sec(x.si),
    (x.cls ?? 0).toFixed(3).padStart(6),
    ' ',
    x.element,
  );
  if (x.phases) console.log(' '.repeat(26), `LCP phases (unthrottled trace): ${x.phases}`);
}
const first = rows[0];
console.log(`\nLighthouse ${first.version}; benchmarkIndex ${first.bench}; ${first.ua}`);
const med = (key) => {
  const v = rows.map((x) => x[key]).filter((n) => n !== undefined).sort((p, q) => p - q);
  return v[v.length >> 1];
};
console.log(`median of ${rows.length}: FCP ${sec(med('fcp'))}  LCP ${sec(med('lcp'))}  TBT ${sec(med('tbt'))}  TTI ${sec(med('tti'))}  SI ${sec(med('si'))}  (seconds)`);
