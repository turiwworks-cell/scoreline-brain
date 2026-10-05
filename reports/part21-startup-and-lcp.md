# Part 21: first-data render (#5) and first paint / LCP (#4)

2026-10-05. Scope: [#5](https://github.com/turiwworks-cell/scoreline-brain/issues/5) (the first data
render is one long task) and [#4](https://github.com/turiwworks-cell/scoreline-brain/issues/4) (LCP and
first paint). [#1](https://github.com/turiwworks-cell/scoreline-brain/issues/1) stays open; nothing here
claims it or every §7 budget is met.

| | |
| --- | --- |
| Branch | `claude/hopeful-lovelace-ji05gb` (also pushed as `codex/part-21-startup-and-lcp`) |
| Baseline | `8a8ffe7` (`origin/codex/part-21-poll-and-bundle`), measured in this session |
| Measured tree | `12f6dce` (the last code commit; tree `290928b`, identical to the `0d6ce42` that was built before its message was corrected). `45d271e` after it changes only an e2e test. |
| Not done | no PR, merge, deploy, issue comment or issue closure |

## Status

| | Result |
| --- | --- |
| **#5, first-data render** | **Target met for the demo, not for a 300-match feed.** `/?demo` at 3.6×, Rive's files blocked, 10 runs a side: the first-data frame was **421–550 ms** (54–84 ms of it forced layout); now the work after the first feed is a 52–129 ms frame (building the demo), a **125–175 ms** frame (the feed: written out, parsed, applied, the header re-rendered) and a **95–190 ms** frame (the list body's commit); no forced layout. With 300 matches the render is out of the long frame (React's part 586–732 → 57–95 ms) but the frame that receives the feed is still **569–685 ms**: 38–45 ms of JSON and **385–535 ms of cold validation** of the 2.1 MB feed, which is #1's parser, not rendering. |
| **#4, first paint / LCP** | **Lighthouse mobile LCP not met: 2.16–2.26 s (was 2.67–2.88 s)**, still the wordmark; FCP 2.26–2.37 → 0.76 s, score 0.64–0.65 → 0.70. The remaining cost is measured below: in Lighthouse's model the wordmark waits for the whole bundle's download. With the throttling applied in the browser the static frame paints at **1.54–1.60 s (was 2.81–2.90 s)** and LCP is the followed player's photo at **3.82–3.85 s** in Lighthouse (was 4.79–4.98 s) and 3.88–3.98 s in `startup.mjs` (was 4.75–4.99 s), bounded by the first data (rows at 3.37–3.45 s). Static and React headers agree within 0.5 px at 390/900/1280 with no layout shift. |
| Initial JS | **178.38 KB** gzip (180 KB budget; was 177.60) |
| Regressions found | none in the poll replay or the full demo; the list of a 300-match day takes 1.3–1.7 s to fill instead of arriving in one 1.3–1.5 s frame (by design); rows on a localhost `/?demo` arrive about 60 ms later (median 890 → 950 ms at 3.6×) while they arrive 0.3 s earlier on slow 4G |

## Where this started, and what was kept from the earlier attempt

An earlier session (local branch `codex/part-21-startup-and-lcp` at `3f76f75`, never pushed, handed over
as a git bundle) had implemented both issues partly. Its own report marked several of its results invalid.
This branch was rebuilt from `8a8ffe7` with a clean history, reusing what held up and fixing what did not:

| Earlier attempt | Here |
| --- | --- |
| Tooling: `startup.mjs`, `trace.mjs`, `lh-summary.mjs`, `lighthouse.sh`, `compression.mjs`, `poll-replay --first-data` (with its later harness fix) | kept (`ab8cfa1`). `lighthouse.sh` fixed: it killed `npx`, not the server, so the next run's server could not bind and **the previous build answered** (it happened in this session: the first "final" Lighthouse sets measured the baseline; they are kept as `final/INVALID-*`). It now runs vite directly and refuses a port that does not serve the requested build. `poll-replay` records the fill timeline. |
| Day tabs from `textWidth` + `useFontVersion` | kept as is (`aa1e200`) |
| Long first list in slices of 12 ms, one per frame | **replaced**: it took 3.3–3.6 s to fill 300 matches, and its 12 ms had been tuned with the invalid harness. Here slices are ~40 ms, back to back (below). Its `GroupShell`, `rows` limit and block arithmetic are kept. |
| (nothing) | **new**: the first feed's body is a deferred render, and the demo builds its evening and delivers its feed in two tasks. These are what bring the demo's first-data frames under 200 ms; the slices alone do nothing for 7 matches. |
| Rive gate as `useState` in `Shell`, 4 s fallback | gate kept; **its WIP fix kept** (state in `RiveGate`, so opening it no longer re-renders the shell); **changed** so a page with no data on its way (`/`) does not wait 4 s, which had pushed `/`'s applied TTI from 5.1 to 7.8 s |
| Static frame in `index.html` | kept, plus **new**: the app runs after that frame has painted, with low-priority module preloads. Without that, Lighthouse's simulated LCP did not move (2.65 → 2.68 s in the earlier attempt). |
| (nothing) | **new**: the follow card's photo, the photo manifest and the demo chunk are requested early |
| `17f30b6` message "15–114 ms after", the "167 → 15 ms" claims | not carried over; no figure from the invalid harness is used here |

## Environment and method

Container: 4 cores, Chromium 141.0.7390.37 (`/opt/pw-browsers/chromium`, via `PW_CHROMIUM_PATH`), Node 22,
Lighthouse 13.5.0 (benchmark index 2000–2100 in this session's reports). Production builds served by
`vite preview`. Phone 390 × 844 at DPR 2, touch, unless noted. "Rive blocked" aborts `*.riv`; the runtime
JS and WASM still load (that is what the gate moves). Before/after pairs were run back to back on the
same machine with nothing else running (`ABAB` for the start-up runs); every run is kept, outliers too.
Container numbers are not a phone; Rive's WebGL is software-rendered here.

## #5: first-data render

### What changed

- **Day tabs** (`aa1e200`): widths from a canvas measure of the face (`DAY_TYPE`: 500, 15 px, −0.01 em,
  held to `DayTabs.module.css` and `tokens.css` by a test), remeasured on `useFontVersion`; no
  `getBoundingClientRect` in a layout effect. That read forced a layout of the whole new matchday inside
  the first-data commit (54–84 ms at 3.6× in the baseline runs).
- **The body after the feed** (`cd8fbbe`): `MatchList` reads `loaded` through `useDeferredValue`. The
  store's synchronous render in the feed's task updates the header and tabs; the follow card and the
  groups come in a deferred render after it. A list mounted with data already there renders as before.
  `MatchList.firstData.test.tsx` records the DOM at each commit and fails against the old component.
- **The demo in two tasks** (`cd8fbbe`): `main.tsx` builds the demo's evening in the task its chunk loads
  in and connects it (first feed: written out, parsed, applied) in the next.
- **Slices** (`aaff9bb`): a first list longer than the first screen plus 12 blocks mounts the first screen,
  then slices rendered and committed with `flushSync` in tasks of their own, each sized from the measured
  cost per block to take ~40 ms, the next asked for as soon as one has committed. Groups not reached yet are
  empty boxes of their full height; every block keeps its cascade index; a day or Live change, and a list
  that grows after it filled, mount whole, so the cascade's order and timing are unchanged.
  `content-visibility: auto` on rows is unchanged.

How the slice mechanism was chosen (300 matches, 3.6×, `poll-replay --first-data`, 175 rows on today's tab):

| Mechanism | List filled after | Longest later frame |
| --- | ---: | ---: |
| baseline: everything in the first-data frame | 0.60–0.75 s (one 1.27–1.52 s frame) | — |
| earlier attempt: 12 ms per frame | 3.3–3.6 s (its report) | — |
| transitions, 32–48 blocks | 1.9–2.7 s | 107–174 ms |
| `flushSync`, 25 ms budget | 1.38–1.73 s | 105–148 ms |
| **`flushSync`, 40 ms budget (kept)** | **1.18–1.36 s** (1.32–1.69 s in the final batch) | **100–145 ms** |
| `flushSync`, 60 ms budget | 1.07–1.25 s | 136–190 ms |

Transitions were slower because React renders them in 5 ms pieces and the browser produced a frame after
each (a trace of the fill: 86 frames at ~18 ms of style, layerize and paint each, ~1.5 s of the 2.7 s).
Scheduling the next slice after the previous commit, rather than after a frame, did not change that.
Input during the fill is handled between slices; a user who scrolls past the filled part within the first
second at 3.6× sees the empty group boxes for that long.

### Results (measured alone, before #4: `results/…/step5/`; and in the final batch: `results/…/final/`)

`/?demo`, 3.6×, Rive blocked, `startup.mjs`, every Long Animation Frame from the one the demo's chunk
resolved in to 2.5 s after the first rows:

| | Baseline | #5 alone (`cd8fbbe`) | Final (`12f6dce`) |
| --- | ---: | ---: | ---: |
| First-data frame | 415–509, 421–505; final batch 436–550, 421–451 ms | — | — |
| ↳ forced layout in it | 54–84 ms | 0 | 0 |
| Building the demo | (inside the frame above) | 66–104 ms | 52–129 ms |
| The feed's task | (inside) | 141–166 ms | 125–175 ms |
| The body's commit | (inside) | 91–166 ms | 95–190 ms |
| Rive's start (not first-data work) | 81–179 ms, right after the first paint | 82–185 ms, still ungated | after the data: 64–162 ms, one 223 ms WASM compile |
| Initial render before any data | 212–268 ms | 189–235 ms | 166–201 ms |

`profile.mjs --rate 3.6 --no-rive` (`?demo=fast`): start-up max 469–477 → 196–239 ms (20 s, 3 runs each,
#5 alone) and 482–560 → 203–271 ms (60 s, 2 runs each, final). In every one of those runs the longest
start-up frame after the change is the **initial render before any data** (0.2–0.3 s, with 51–76 ms of
forced layout), which exists in the baseline too (230–264 ms) and is not part of the first-data render;
the longest frame after the first feed is 134–177 ms per run.

The real API path (`poll-replay.mjs --first-data`, the first feed through `ApiSource`, 3.6×, 5 fresh pages
each, final batch):

| | Baseline | Final |
| --- | ---: | ---: |
| Demo fixtures: the feed's frame | 268–372 ms | **69–84 ms** |
| ↳ React's part (`flushSync` callback) | 162–227 ms | 25–33 ms |
| ↳ longest later frame (now incl. the body) | 125–179 ms | 131–182 ms |
| 300 matches: the feed's frame | 1270–1517 ms | **569–685 ms** |
| ↳ JSON / cold validation in it | 48–71 / 411–600 ms | 38–45 / 385–535 ms |
| ↳ React's part | 586–732 ms | 57–95 ms |
| ↳ longest later frame | 86–193 ms | 143–180 ms |
| 300 matches: all rows in | 0.60–0.75 s | 1.32–1.69 s |

### #5 status

The target (no frame attributable to the first-data render over 200 ms at 3.6×, Rive blocked) **is met on
`/?demo`** in all 20 final and #5-alone runs: the largest is 190 ms. **It is not met for a 300-match first
feed**: the rendering is out of it, but the task that receives the feed spends 385–535 ms validating it
cold (and 38–45 ms decoding it). That is the parser (#1's scope: the session caches make later polls cheap,
not the first). Cutting it needs the first feed validated in pieces or off the main thread; not attempted
here. The initial render before any data (166–271 ms) is outside #5 but over 200 ms in some runs; its
forced layout comes from layout-effect reads at mount (`DayTabs`' `clientWidth`, `useScrollMemory`'s
`scrollTop`), and removing them would mostly move that layout into the frame's own rendering step.

## #4: first paint and LCP

### What was found first

- Baseline LCP element: the wordmark `h1` (simulated) and, with the throttling applied, the follow card's
  photo, which arrived ~0.7 s after the rows because it was asked for only when the card rendered.
- Why the static frame alone did not move Lighthouse's LCP (the earlier attempt: 2.65 → 2.68 s): Lighthouse
  simulates from an unthrottled trace. On localhost the bundle has downloaded and **run** before the first
  paint, and Lighthouse's model (`@paulirish/trace_engine`, `lantern/metrics/*ContentfulPaint.js`) keeps
  every request that finished before the observed paint in the LCP graph, and for FCP every
  render-blocking-priority request it cannot show was evaluated after the paint. It ties scripts to their
  evaluation only through `EvaluateScript` events.

### What changed

- **Static first frame** (`658cca5`, from the earlier attempt): the header (mark, wordmark, Live capsule in
  its fallback look, menu, five day tabs, pane rims at 900/1280) inline in `#root` with a 7 KB inline
  sheet; `aria-hidden`, nothing focusable, loads nothing; React replaces it at its first commit. Font
  preload and `font-display: swap` unchanged.
- **The app runs after that paint** (`658cca5`): at build time the entry's module script becomes a
  modulepreload in the same place, and an inline script adds the module script once the first contentful
  paint is on screen (paint-timing entry; two frames without one; at most 2 s; at once in a hidden tab).
  Module preloads are `fetchpriority="low"`: nothing in the first frame needs a script. The module graph
  and chunks are unchanged; `check:size` counts the entry through its modulepreload (178.38 KB). A first
  version made `main.tsx` a boot that dynamically imported the app: it split the chunks and initial JS rose
  to 181.95 KB, so it was dropped.
- **Rive gate** (`9ff20d0`): Rive (runtime, WASM, artwork, the word's chunk) starts after the first data is
  committed, painted and idle, or after 4 s when a feed is due and late; immediately after the first paint
  when no data is on its way. State in `RiveGate`, so opening it re-renders the Live button only (a test
  fails against the earlier attempt's shell). The DOM button is the control throughout; the artwork
  replaces the fallback when bound, as before.
- **Early photo, manifest and demo chunk** (`12f6dce`): `ListPane` warms the followed player's bust as soon
  as the manifest names it (an off-page copy of the card's `<picture>`, so the same file is chosen; e2e
  checks it is one request and the card's file), `index.html` preloads the manifest, and on `?demo` the
  boot asks for the demo chunk when it starts the app.

### Results

Lighthouse 13.5.0, mobile, 3 runs a page, `lighthouse.sh` (fixed), same session, base then final:

| | Baseline (`8a8ffe7`) | Final (`12f6dce`) |
| --- | ---: | ---: |
| `/?demo` simulated: FCP / **LCP** | 2.26–2.37 / 2.67–2.88 s (wordmark) | **0.76 / 2.16–2.26 s** (wordmark) |
| `/?demo` simulated: TBT / TTI / score | 2.41–2.54 / 6.74–6.85 s / 0.64–0.65 | 2.20–2.58 / 6.16–7.26 s / 0.70 |
| `/` simulated: FCP / LCP | 2.15–2.27 / 2.45–2.73 s ("No matches yet.") | 0.76–0.77 / 2.46–2.49 s (same) |
| `/` simulated: TBT / TTI / score | 2.31–2.73 / 6.00–6.97 s / 0.65–0.67 | 2.08–2.35 / 5.91–6.42 s / 0.69–0.70 |
| `/?demo` applied: FCP / **LCP** | 2.85–2.90 / 4.79–4.98 s (the photo) | **1.56–1.60 / 3.82–3.85 s** (the photo) |
| `/?demo` applied: TBT / TTI / score | 0.50–0.62 / 4.95–5.05 s / 0.61–0.65 | 0.47–0.52 / **5.43–5.76 s** / 0.75–0.76 |
| `/` applied: FCP / LCP | 2.88–2.91 / 2.88–2.91 s ("No matches yet.") | 1.58–1.61 / 2.85–2.92 s (same) |
| `/` applied: TBT / TTI / score | 0.05–0.06 / 4.92–4.96 s / 0.90–0.91 | **0.27–0.36** / 5.13–5.22 s / 0.86–0.90 |

Raw: `final/lh-{sim,applied}-{base-2,final}/` (an earlier baseline set, `final/lh-{sim,applied}-base/`, agrees:
simulated `/?demo` LCP 2.64–2.76 s, applied 4.76–4.82 s). One simulated final run's report names no LCP
element; its value (2.26 s) is kept. Where the final is worse, and why:

- **Applied TTI on `/?demo`** (5.0 → 5.4–5.8 s): Rive's long tasks (runtime, WASM compile, artwork) are not
  removed, they now come after the first data, as #4 asks; TTI waits for the last long task.
- **Applied TBT on `/`** (0.05 → 0.27–0.36 s): TBT counts long tasks after FCP. FCP moved 1.3 s earlier, so
  the app's own evaluation and first render, which used to come before the (late) first paint, now fall
  inside the window. The work itself did not grow. The simulated TBT on `/` went down.

`startup.mjs --path /?demo --rate 4 --network slow4g` (Lighthouse's network applied in the browser), 3 runs:

| | Baseline | Final |
| --- | ---: | ---: |
| First contentful paint (the static frame) | 2.81–2.90 s | **1.54–1.56 s** |
| Header in the DOM | 2.78–2.87 s | 0.62–0.64 s (static) |
| Rows in the DOM | 3.66–3.79 s | 3.37–3.45 s |
| LCP (the follow card's photo) | 4.75–4.99 s | **3.88–3.98 s** |
| Photo requested at | 3.88–4.04 s (after the rows) | 3.21–3.31 s (before them) |
| Manifest / demo chunk requested at | 2.76–2.85 / 2.50–2.56 s | 0.61–0.62 / 1.56–1.59 s |
| App vendor chunk complete | 2.40 s | 2.57 s (shares the link with the above) |
| CLS | 0 | 0 |

`/?demo` at 3.6× on localhost (10 runs a side): FCP 432–540 → **124–172 ms**; rows in the DOM 838–1063 →
825–1056 ms (median 890 → 950). `/` at 3.6× (Rive not blocked, 3 runs): FCP 480–604 → 120–140 ms; Rive
starts at 589–676 ms (baseline 604–811 ms), i.e. without the earlier attempt's 4 s wait.

**Static frame against React's header** (`e2e/handoff.spec.ts`, 390 / 900 / 1280, entry held, Rive held):
wordmark, mark, Live capsule and count, menu, tab strip, each day tab, the indicator and the panes within
0.5 px; layout shift < 0.001; same font family, size, weight, tracking and colour on the wordmark and the
tabs; no heading, button or tab before the handoff and exactly one heading and one tablist after; focus
stays on `body`. Screenshots: `results/…/final/screenshots/handoff-{static,react}-*.png`. Known
differences: the side panes at 900/1280 are empty in the static frame (their content needs the app), and
the Live capsule is the DOM fallback's 109 × 38 until Rive's 110 × 40 capsule takes over (unchanged
behaviour). The frame is not interactive: if the bundle fails, the header stays without a working control.

**WASM delivery**: `compression.mjs` against `vite preview` (local only): `rive-*.wasm` and
`rive_fallback-*.wasm` go out uncompressed (2,272,630 and 2,284,807 bytes) as `application/wasm`; scripts
and `.riv` are gzipped. That is the preview server, not production hosting, which was not checked (no
deployment exists to check). Requirement recorded in ARCHITECTURE §7 and BUILD-PLAN Part 22: the host must
compress `application/wasm` (about 0.93 MB gzip, 0.73 MB brotli) and keep that content type; check with
`compression.mjs --base <host>`.

### #4 status

**Not met in Lighthouse's default (simulated) mode: LCP 2.16–2.26 s on `/?demo` against 2.0 s** (baseline
2.67–2.88 s). The LCP element is the static frame's wordmark, painted 87–96 ms into the unthrottled trace
Lighthouse models from. The model's FCP for that same paint is 0.76 s; its LCP is 1.4 s more because, for
LCP, it counts every request finished before the observed paint, and on localhost the app's 180 KB of
(low-priority) module downloads finish before it (234.7 KB in all: 180.2 KB scripts, 35.0 KB font, 13.4 KB
style sheet, 3.6 KB HTML, 2.5 KB manifest). The bundle runs after that paint, which the model cannot see
for modules. Two ways to take it out of the model were considered and not built:
a non-render-blocking style sheet (the first paint would come before the face, so the static frame would
paint in the fallback font and swap, a visible flash and layout shift on slow networks), or asking for the
bundle only after the first paint (on the slow-4G timeline above that delays the vendor chunk by up to the
0.9 s between the HTML and the first paint, so the data comes later).

**With the throttling applied, LCP is 3.82–3.85 s in Lighthouse, 3.88–3.98 s in `startup.mjs`** (was 4.79–4.98 / 4.75–4.99 s): the follow card's photo, which cannot
paint before the first data renders the card; rows are in at 3.37–3.45 s and the app's vendor chunk is not
complete until 2.57 s on that network. Under 2 s there needs the first screen's data without the app bundle
(server rendering, or a much smaller first bundle): an architecture change, not done.

**Done**: the static first frame (FCP 2.26–2.37 → 0.76 s simulated, 2.81–2.90 → 1.54–1.56 s applied, no
visual difference from React's header, no layout shift); Rive after the first data (DOM fallback until
bound, interaction tested before and after); `/` no longer waits for Rive; WASM requirement documented.

## Other budgets and regression checks (final batch, same session)

| Check | Baseline | Final |
| --- | ---: | ---: |
| Initial JS (`check:size`) | 177.60 KB | 178.38 KB |
| API poll replay, fixtures 3.6×: callback median / max, tasks > 50 ms | 25.8 / 57.4 ms, 2 | 24.8 / 44.2 ms, 0 |
| API poll replay, fixtures 6× | 42.4 / 88.0 ms, 2 (max 91) | 41.4 / 68.1 ms, 2 (max 64) |
| API poll replay, 300 matches 3.6× | 189.0 / 300.6 ms, 27 (max 287) | 189.4 / 298.6 ms, 23 (max 285) |
| Full demo 60 s 3.6× no Rive: poll frames > 50 ms, median / max | 70–89 / 141–182 ms | 76–78 / 121–143 ms |
| Full demo: goal-scene frames > 50 ms, median / max | 117–119 / 131–175 ms | 90–121 / 128–209 ms |

The poll replay runs all samples through the real `ApiSource`, parser, store and a synchronous React
commit, without the demo's feed generation. `profile.mjs` reports only Long Animation Frames over 50 ms,
and its "poll" frames include the demo's simulation, event delivery and `feedJson`; it is not an API-poll
distribution, and a time until paint is not a task. The one 209 ms goal-scene frame (n = 4–5 per run)
is in code this branch does not touch (a demo tick during a scene, 26 ms of forced layout).

The poll budget (#1: no task over 50 ms while a poll is applied) is still not met at 6× or with 300
matches, as before this branch.

## Tests

| Suite | Result |
| --- | --- |
| `npm run check` (typecheck, lint, vitest) | pass: 79 files, **684 tests**; the one existing fast-refresh lint warning (`verification/rive/live-host.tsx`) |
| `npm run build`, `npm run check:size` | pass, 178.38 KB |
| Main Playwright suite (390 / 900 / 1280) | **210 passed, 15 skipped** (layout-specific, as before), 0 failed (`final/e2e-main-final-run.txt`). The first full run had 1 failure, "each pane keeps its own scroll" at 900 (`final/e2e-main-first-run-1-failed-nav-scroll.txt`): the list at 0 instead of 300 after Playwright's click retried and scrolled the pane to align the still-entering card. 20/20 passed on the baseline and 49/50 on the final tree before the test change; the earlier attempt had measured 4/30 failures on the baseline at 1280. `45d271e` makes the test wait for the card to land; the assertion is unchanged; 60/60 repeats pass at 900 and 1280. |
| Moments suite (`playwright.moments.config.ts`, dev server) | **15/15** (`final/e2e-moments.txt`) |

New or changed tests: `DayTabs.test.tsx`, `dayLayout.test.ts` (type held to CSS), `progressive.test.tsx`,
`MatchList.progressive.test.tsx`, `MatchList.firstData.test.tsx`, `startGate.test.tsx`,
`RiveGate.test.tsx`, `riveGate.shell.test.tsx`, `graphics.test.tsx` (gate), `staticFrame.test.ts`;
e2e `list.spec.ts` (tabs under the chosen word at three widths, late face) and `handoff.spec.ts` (frame,
handoff, boot after paint, Rive gate on `/?demo`, late feed and `/`, the photo request).

Not run, and not claimed: a real phone, VoiceOver, Rive on a real GPU (#9), the production host's
compression.

## Remaining, with measured cost

1. **LCP (Lighthouse simulated)**: 2.16–2.26 s on `/?demo`, 0.16–0.26 s over; in the model the wordmark
   waits for the app's 180 KB of module downloads (see #4 status for the two ways out and their costs).
2. **LCP with throttling applied**: 3.82–3.98 s, the follow card's photo, which cannot paint before the
   first data renders the card (rows at 3.37–3.45 s); the app's vendor chunk alone is not in until 2.57 s on
   that network. Under 2 s here needs the first screen's data without the app's bundle (server rendering or
   a much smaller first bundle), an architecture change.
3. **300-match first feed**: 385–535 ms of cold validation in one task (#1's parser).
4. **Initial render before any data**: 166–271 ms at 3.6× (pre-existing, outside #5).
5. **WASM compression** on the production host: unchecked until there is one.
6. **#1**: the poll budget at 6× and 300 matches, as reported in `part21-poll-and-bundle.md`.

## Reproduce

```sh
npm ci && npm run build && npm run check:size
export PW_CHROMIUM_PATH=/opt/pw-browsers/chromium CHROME_PATH=/opt/pw-browsers/chromium
npx vite preview --port 4173 --strictPort --host 127.0.0.1 &
node verification/perf/startup.mjs --path '/?demo' --rate 3.6 --no-rive --runs 5
node verification/perf/startup.mjs --path '/?demo' --rate 4 --network slow4g --resources --runs 3 --seconds 9
node verification/perf/poll-replay.mjs --first-data --runs 5 --matches 300 --rate 3.6   # --root <checkout> for a baseline
bash verification/perf/lighthouse.sh dist /tmp/lh 3
LH_EXTRA="--throttling-method=devtools" bash verification/perf/lighthouse.sh dist /tmp/lh-applied 3
node verification/perf/compression.mjs --base https://<host>
```

For a baseline, check out `8a8ffe7` detached and copy this branch's `verification/perf/{poll-replay.*,trace.mjs}`
into it. Raw data: [`verification/perf/results/part21-startup-and-lcp`](../verification/perf/results/part21-startup-and-lcp)
(`baseline/` the first runs of the session, `step5/` #5 alone against the baseline, `final/` everything
against the baseline; `final/INVALID-*` are the Lighthouse sets that measured the wrong server).
