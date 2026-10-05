# Performance and accessibility checks (Part 21)

The budgets are in ARCHITECTURE §7: initial JS ≤ 180 KB gzip (Rive excluded), LCP ≤ 2.0 s on a
mid-range Android over 4G, INP ≤ 200 ms, no task longer than 50 ms while a poll is applied.

## Running

```sh
npx vite build --sourcemap                     # source maps let the scripts name the code
npx vite preview --port 4173 --host 127.0.0.1  # in another shell
node verification/perf/profile.mjs --rate 6 --seconds 120           # long frames by cause
node verification/perf/profile.mjs --rate 6 --seconds 120 --no-rive # the same without Rive
node verification/perf/inp.mjs --rate 6                              # worst event per interaction
```

`PW_CHROMIUM_PATH` points the scripts at another Chromium, as in `playwright.moments.config.ts`.
`profile.mjs` plays `?demo=fast` (match time at 10×, so goals come every minute or so) and
records every Long Animation Frame with the scripts in it, and when a scene or toast is on
stage. A frame is labelled **poll** when the demo source's timer ran in it. That timer can deliver
live events (including followed-player actions), and/or build, parse and apply a snapshot. Its
cost therefore includes simulation, SSE-like event delivery and demo feed generation, in addition
to a poll's work. **goal scene** / **toast** frames are those within 2.5 s of one appearing.

Long Animation Frames record only frames over 50 ms. Their reported median therefore describes
the **long frames**, not all polls; the demo timer also includes `feedJson`, which a real API poll
does not run. Do not treat that median as a complete poll-task distribution.

For a poll measurement that includes the fast samples and excludes demo feed construction:

```sh
node verification/perf/poll-replay.mjs --rate 3.6 --samples 40 --out /tmp/poll-3.6.json
node verification/perf/poll-replay.mjs --rate 6 --samples 40 --out /tmp/poll-6.json
# Optional adversarial scale check: 300 visible matches, changing together.
node verification/perf/poll-replay.mjs --rate 3.6 --matches 300 --out /tmp/poll-300.json
```

The runner builds a separate production diagnostic entry and starts its own preview server.
It prepares wire JSON before timing, then replays it through the real `ApiSource`, parser, store
and UI, with the demo's followed player. `callback` includes JSON decoding and a synchronous
React commit; `untilPaint` includes two animation frames. It also records actual long tasks and
page errors. Fixture match time advances every replay, faster than wall time, so clock corrections
are deliberately frequent. It is a deterministic stress replay, not a measurement of network
latency or a real phone. Run before/after sequentially on the same machine without other tests.
`--root` can build another checkout containing the same diagnostic files. It never rewrites the
app's `dist/` or imports this harness into the application.

Run `npm run build && npm run check:size` for the initial JS budget. Detailed results of the
poll and bundle changes are in `reports/part21-poll-and-bundle.md`.

`inp.mjs` taps through the main screens and reports, per interaction, the longest Event Timing
entry: input delay + handlers + the wait for the next paint, which is what INP counts.

Lighthouse is not a dependency of the project. To run it:

```sh
npx lighthouse@13 http://127.0.0.1:4173/?demo --only-categories=performance,accessibility --chrome-flags="--headless=new"
```

## Start-up: first paint and first data (Part 21, #4 and #5)

Four scripts, all against a production build (`vite preview`), and all run on their own, one after
another, with nothing else using the CPU.

```sh
# The page load: first paint, every LCP candidate and its element, when the header and rows reached
# the DOM, each Long Animation Frame over 50 ms, layout shifts. --no-rive blocks the .riv files.
node verification/perf/startup.mjs --path /?demo --rate 3.6 --no-rive --runs 5 --out /tmp/startup.json
# Lighthouse's mobile network on top of the CPU throttle, and each request's start and end:
node verification/perf/startup.mjs --path /?demo --rate 4 --network slow4g --resources
# A Chrome trace; every main-thread task over 50 ms is split into script / style / layout / paint / GC:
node verification/perf/startup.mjs --path /?demo --rate 3.6 --no-rive --trace /tmp/trace.json
# The first feed on its own (300 matches), through the real parser, store and list; the frame is taken apart:
node verification/perf/poll-replay.mjs --first-data --matches 300 --runs 5 --rate 3.6 --out /tmp/first-data.json
# Lighthouse mobile, N runs of / and /?demo against a built directory (it starts its own preview);
# LH_EXTRA adds flags, e.g. applied throttling:
bash verification/perf/lighthouse.sh dist /tmp/lh 3
LH_EXTRA="--throttling-method=devtools" bash verification/perf/lighthouse.sh dist /tmp/lh-applied 3
# One-line summaries of Lighthouse JSON reports (score, FCP, LCP and its element and phases, TBT, CLS):
node verification/perf/lh-summary.mjs /tmp/lh/*.json
# Is the host compressing, and is the WASM served as application/wasm? Point --base at the real host:
node verification/perf/compression.mjs --base https://example.org
```

`startup.mjs` takes timings from runs without `--trace` and anatomy from runs with it: tracing
slows the page. Keep every run's file, outliers included. **`poll-replay.mjs` and `profile.mjs`
answer different questions.** `poll-replay.mjs` replays recorded wire JSON through the real
`ApiSource`, parser, store and UI, so it measures the app's work for one feed with no demo
generation; `--first-data` is the first feed of a page, one fresh page per run. `profile.mjs` plays
the whole demo, whose timer also builds the feed (simulation, JSON) and delivers events. A
"time until paint" is never a task's duration: it adds the wait for the next frame.

**Lighthouse, simulated and applied.** The default (lantern) computes FCP and LCP from a model of the
page: it counts script requests that finished before the observed paint, so a page that paints
a static frame at 0.3 s is still modelled as waiting for its bundle. To see what a browser under
that throttle does, add `--throttling-method=devtools` (applied: CPU 4× and the slow-4G network
happen in the browser). Report both and say which is which; the container's benchmark index is
about 1480, so every number is on a slower machine than a typical laptop. Whether a run's window catches
the Rive requests depends on timing (on `/?demo` it usually does, after the first rows; read the
report's network requests); the container draws Rive's WebGL in software either way, so none of
this says how Rive performs on a phone.

## Reading the numbers

**Calibrate.** "6× slowdown" means 6× slower than the machine it runs on. The Part 21 audit
ran in a cloud container whose Lighthouse benchmark index was ~1480; a typical developer laptop
is ~2500, so 6× there is ~3.6× here. Both are reported below. Lighthouse's own mobile run uses
simulated throttling (4× CPU, slow 4G) and is independent of this.

**Software GL.** Headless Chromium in a container draws WebGL with SwiftShader, on the CPU. Rive
renders offscreen and copies each frame to its canvas, which there is a GPU read-back: Rive
frames cost hundreds of ms that a phone's GPU does not. Use `--no-rive` to see the app's own
cost, and measure Rive itself on a real device (Chrome remote debugging on a mid-range Android).

**Dev builds** (StrictMode, unminified React) are several times slower: always profile
`vite preview`.

## Baseline: Part 21 audit, 2026-10-05

Container, benchmark index ~1480, phone 390 × 844 unless noted.

| Check | Result | Budget |
| --- | --- | --- |
| Initial JS (entry + modulepreloads), gzip | 219 KB (entry 163, motion 32, domain 20) | ≤ 180 KB |
| Lighthouse mobile, `/?demo` | Performance 0.62; FCP 2.5 s, **LCP 2.9 s** (the wordmark), TBT 3.2 s, TTI 8.1 s | LCP ≤ 2.0 s |
| Lighthouse accessibility | 0.96: colour contrast only | — |
| Poll tick, 3.6×, no Rive | every tick 86–157 ms, median ~100 ms | ≤ 50 ms |
| Poll tick, 6×, no Rive | median 145 ms, max 223 ms | ≤ 50 ms |
| Store `applyFeed` alone, 3.6× | median 26 ms, max 47 ms | (part of the tick) |
| Goal tick (scene mounts), 3.6×, no Rive | 123–157 ms | ≤ 50 ms |
| First data render, 3.6×, no Rive | one 535–603 ms task | — |
| INP, 3.6×, no Rive | open a match 390–460 ms, Lineup 410–440, open a player 400–520, Live on 290–310, Stats 230, day tab 140–250 | ≤ 200 ms |

At 6× with Rive (software GL): start-up ~7.5 s of main thread, of which Rive ~2.5 s; every
scene mount spends 250–450 ms creating the word's Rive instance in one frame.
