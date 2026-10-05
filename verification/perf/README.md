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
stage. A frame is counted as a **poll** when the demo source's timer ran in it: one demo tick
builds the feed, parses it with the contract's schemas, applies it to the store and renders,
which is what an `ApiSource` poll does apart from building the feed. **goal scene** / **toast**
frames are those within 2.5 s of one appearing.

`inp.mjs` taps through the main screens and reports, per interaction, the longest Event Timing
entry: input delay + handlers + the wait for the next paint, which is what INP counts.

Lighthouse is not a dependency of the project. To run it:

```sh
npx lighthouse@13 http://127.0.0.1:4173/?demo --only-categories=performance,accessibility --chrome-flags="--headless=new"
```

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
