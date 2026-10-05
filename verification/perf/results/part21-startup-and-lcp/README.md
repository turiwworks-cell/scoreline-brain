# Part 21 start-up and LCP: raw results

Report: [`reports/part21-startup-and-lcp.md`](../../../../reports/part21-startup-and-lcp.md). All runs are from
one session in a 4-core container, Chromium 141, production builds served by `vite preview`, run one after
another with nothing else using the CPU. Baseline is `8a8ffe7`; "final" is the tree of `12f6dce`.
Lighthouse JSON reports are gzipped (`gunzip -k`), with a `summary.txt` per set from `lh-summary.mjs`.

| Directory | What |
| --- | --- |
| `baseline/` | The session's first runs of the baseline: `startup.mjs /?demo` at 3.6×, Rive blocked, 5 runs (the first is a cold outlier). |
| `step5/` | #5 alone (`cd8fbbe`) against the baseline: `startup.mjs` 2 × 5 runs a side (ABAB), `poll-replay --first-data` with 300 matches and the fixtures (5 pages each), `profile.mjs` 20 s × 3 a side. |
| `final/` | Everything against the baseline: `startup.mjs` `/?demo` at 3.6× (2 × 5 runs a side), `/` at 3.6× (3 runs, Rive not blocked), `/?demo` slow 4G at 4× (3 runs, with request timings); Lighthouse simulated and applied (`lh-{sim,applied}-{base,base-2,final}`, 3 runs a page); `poll-replay` first-data (300, fixtures) and poll mode (3.6×, 6×, 300 matches); `profile.mjs` 60 s × 2 a side; `compression.mjs` against `vite preview`; `screenshots/` of the static frame and React's header at 390, 900 and 1280 (from `e2e/handoff.spec.ts`). |
| `final/INVALID-*` | **Do not use.** The first final Lighthouse sets: the previous `vite preview` stayed on the port and answered, so they measured the baseline (its asset hashes are in the reports). `lighthouse.sh` now refuses that. |
| `intermediate/slice-mechanism/` | The runs behind the slice mechanism and budget: `fd300-base-a` (baseline), `fd300-cur-a` (transitions, 32 blocks, one per frame), `fd300-cur-b` and `fd300-diag` (transitions, 48 blocks, back to back; `diag` has the fill timeline), `fd300-sync{25,40,60}` (`flushSync` slices at those budgets, 4 pages each); `s1`/`s2`: `startup.mjs` on the deferred-body tree before and after the demo split. |
| `intermediate/boot-and-priority/` | The runs behind the boot and the fetch priority: `lh-4try` (boot after the first paint), `lh-4try2` (plus low-priority module preloads), one Lighthouse run of each page; `slow4g-*` single `startup.mjs --network slow4g` runs: port 4180 baseline, 4188 boot, 4189 boot + low priority, 4190 an intermediate build that preloaded the demo from the head (replaced by the final, which asks for it after the first paint). |

Reading them: `startup.mjs` JSON has every Long Animation Frame over 50 ms with its scripts; "the first-data
frame" in its text output is the frame around the first row's arrival, which after #5 is the body's commit,
not the feed's task, so the report reads all frames after the first feed instead. `poll-replay` first-data
`frame` is the frame containing the feed's apply (the API path), and `laterFramesOver50` the frames after it.
