# Part 21: poll and initial-JS follow-up

2026-10-05. Scope: [#1](https://github.com/turiwworks-cell/scoreline-brain/issues/1) and
[#2](https://github.com/turiwworks-cell/scoreline-brain/issues/2), based on `14f1bb6` on
`codex/part-20-moments`. Implementation commits: `4dfcca3` and `21c4a96`.

Initial JS is below the 180 KB budget. Real API replay is substantially faster, but the strict
no-task-over-50-ms budget is not established for every workload. The 6× run, the 300-match stress
run and the full demo still have long tasks/frames; keep #1 open for that remaining validation.
This change does not claim that all four architecture budgets pass.

## What changed

Each ApiSource/DemoSource session owns a `createFeedParser` cache. The schemas use `zod/mini`;
lenient defaults and item-by-item rejection are preserved. An explicit valid v2 `seq` enables
reuse only after comparing the wire data too. Equal-seq late details/events are read, and a
clock-only change reads the new minute/second without rebuilding the validated details. v1 and
missing/invalid-seq matches still receive full validation. The cache owns its wire inputs,
evicts absent matches, and resets on Source stop/start and demo restart.

The reducer remembers the validated snapshot behind a normalized match through weak keys.
Repeated data can reuse the match and resynchronize only its clock. SSE-produced matches and
stale snapshots still take the original reconciliation path, including unseen late events and
moment deduplication. An event without a minute inherits the snapshot minute, so a changed
minute in that case must also rebuild the event. Squad players retain stable references, and
`share` allocates an output tree only after discovering a difference.

React Profiler regressions verify that a poll changing another match does not commit the
followed card, and that an empty moment stage does not commit. The stage also avoids the domain
subscription when it is empty or belongs to the other desktop slot. Existing row memoization
and selectors remain in place.

MatchScreen and PlayerScreen are lazy chunks, warmed after two paints/idle and on pointerdown
or focus of their openers. Ready thenables preserve the first warmed push/player reveal. A
genuinely cold download keeps loading chrome; focus held by that chrome transfers to the real
heading when it resolves, without taking focus from another control or an abandoned screen.

`colorOf` and stored event kinds no longer import the schema module. Only that pure schema
module is marked side-effect-free for tree shaking. The always-needed React/router/Motion
exports compress together; detail screens, validation and Rive remain outside the initial
graph. An async Motion feature experiment failed exit-cleanup browser checks, so `domAnimation`
remains synchronous. Navigation's reviewed `flushSync` behavior is preserved.

`npm run check:size` gzips the actual entry and every modulepreload once, rejects an initial
Rive/runtime/wasm or detail-screen chunk, and fails above 180,000 bytes. CI runs it after build.
Manual negative checks rejected an oversized entry and a preloaded Rive runtime; a duplicate
preload was counted once. Source maps confirm that Zod, schemas, match/player feature code and
the Rive runtime are absent from the initial graph.

## Initial JavaScript

Same checkout dependencies, `vite build --sourcemap`, Node's default gzip, decimal KB. Opus's
original rounded audit figure was 219 KB; this script measures the base as 217.29 KB.

| Initial graph | Before | After | Budget |
| --- | ---: | ---: | ---: |
| Entry + every modulepreload | 217.29 KB | **177.74 KB** | ≤ 180 KB |

The final ordinary browser build without source-map comments measured 177.60 KB. Rive is
excluded by staying lazy, not by subtracting a preloaded asset from the total.

## API poll replay

Production builds; Chromium 153; phone 390 × 844, DPR 2; Rive assets blocked. Forty samples per
run through the real ApiSource, JSON decoding, parser, store and a synchronous React commit.
Wire payloads are generated before timing. The demo's followed player is present. Fixture time
advances faster than wall time, deliberately exercising frequent clock corrections. No page
errors occurred. These are container measurements, not a real-device or network benchmark.

The primary comparison below runs each before/after pair consecutively on the same machine,
without other tests. `callback` measures all samples, including those below 50 ms. Long tasks
are collected through the two-frame paint window, which can also contain other UI work.

| Workload | Before callback median / max | After callback median / max | Before → after long-task count |
| --- | ---: | ---: | ---: |
| Demo fixtures, 3.6× | 29.2 / 72.8 ms | **17.5 / 32.4 ms** | 2 → **0** |
| Demo fixtures, 6× | 48.2 / 85.5 ms | **32.1 / 57.9 ms** | 11 → 1 |
| 300 visible matches changing together, 3.6× | 395.1 / 642.8 ms | **176.4 / 347.0 ms** | 33 → 31 |

In the paired run, the longest observed task after the change was 58 ms at 6× and 348 ms in the
300-match stress case. Median time through two paints improved from 48.5 to 47.4 ms at 3.6×,
and from 78.5 to 60.0 ms at 6×; paint-window elapsed time is not a task duration.

An earlier final-build run was noisier: 3.6× callback median/max 19.7/50.0 ms, with two observed
51 ms tasks and one rounded 50 ms task; 6× 29.7/64.0 ms, with four long tasks (max 60 ms).
Its 300-match callback median/max was 166.7/966.9 ms. Both rounds are retained. The consecutive
comparison improves comparability; it does not erase these outliers or prove a universal hard
50 ms ceiling. The 300-match case still needs further work for that ceiling.

## Full demo profiles

The requested `profile.mjs --rate 3.6 --no-rive --seconds 120` and 6× runs were also completed.
Their **poll** label matches any DemoSource timer: it can simulate the matchday, deliver several
SSE-like live events/actions, build `feedJson`, then parse/apply a snapshot. It is not an isolated
API poll. Long Animation Frames also omit every frame under 50 ms, so their median is conditional
on a frame already being long. `feedJson` was not optimized, as requested by #1.

| Demo frames labelled poll, over 50 ms | Before count / median / max | After count / median / max |
| --- | ---: | ---: |
| 3.6×, 120 s, no Rive | 35 / 61 / 146 ms | 40 / 76 / 356 ms |
| 6×, 120 s, no Rive | 43 / 97 / 210 ms | 57 / 92 / 251 ms |

The full-demo numbers do not establish the hard budget and the 3.6× long-frame distribution
regressed in this run. The isolated API replay supports the improvement in poll handling;
this report does not attribute every remaining demo cost to a particular function without
another CPU trace. Goal-scene mounts, first-data rendering, INP and LCP retain their separate
audit scopes. Real-device Rive/VoiceOver validation is still #9.

## Verification and reproduction

- `npm run check`: **623 tests pass**, typecheck/lint pass; one pre-existing fast-refresh lint
  warning in the Rive verification host.
- Main production Playwright suite: **183 pass, 15 layout-specific skips**. This includes 12
  new cold/warm screen checks across phone/tablet/desktop.
- Moments Playwright suite: **15/15 pass**, including goal and red-card behavior.
- Regression coverage includes unchanged/changed seq, equal-seq late data, mutable transport
  inputs, v1/missing seq, eviction/session isolation, clock drift and inherited event minutes,
  SSE/stale-feed reconciliation, structural-sharing key replacement, and parser equivalence
  across the generated matchday.
- Cold-download checks hold real production chunks, verify focus transfer/Back, and prevent a
  late chunk from resurrecting an abandoned screen. Warm checks sample the first push frame.
  The existing player first-frame check now waits for its preload; the lineup order check uses
  one timestamp per animation frame so DOM iteration cannot invent a 0.1 ms ordering difference.

Run the commands in `verification/perf/README.md`. The API runner builds its own diagnostic
entry and preview server without modifying the application's `dist/`. To reproduce a baseline,
copy `poll-replay.html` and `poll-replay.tsx` into a detached base checkout, then run the current
`poll-replay.mjs --root <checkout>`. Use the same dependencies and run pairs sequentially.

Raw data and text summaries are in
[`verification/perf/results/part21-poll-and-bundle`](../verification/perf/results/part21-poll-and-bundle).
`api-*-paired.*` is the consecutive comparison; `api-after-*` without that suffix is the earlier
final-build run. `demo-*` contains the requested 120-second profiles, and `size-*` the bundle
tables. The earlier baseline API samples are also retained.
