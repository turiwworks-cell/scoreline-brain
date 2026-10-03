# Part 16: Dev panel

Status: built, checked, pushed, **waiting for your review**. No PR, no merge. `main` and all other branches untouched. Part 17 not started.

- Branch: `claude/part-16-dev-panel`, from `origin/claude/part-14-player-view` at `25c1f36114d1de7bd2faaf8e925cb3aafedc087c` (verified full SHA)
- Final commit: the commit that adds this report (hash in the reply)
- Commits: (1) panel + DemoSource controls + tests, (2) the one-line `main.tsx` bootstrap (isolated), (3) this report

## What is built

| Piece | File |
|---|---|
| Seven Lua triggers `goalHome … fullTime` (`luau:38–45`, in the Lua's order) as `DEMO_TRIGGERS`; names/semantics already in the sim port | `src/data/demo/sim.ts` (`DemoSim.trigger`, unchanged) |
| `DemoSource.pause() / resume() / restart() / paused / subscribe()` | `src/data/demo/demoSource.ts` |
| Active-source registry (the source registers in `start()`, leaves in `stop()`), so the panel drives the *same* instance the app is connected to | `src/data/demo/active.ts` |
| Panel UI: collapsible, Escape closes, native buttons/inputs | `src/dev/DevPanel.tsx`, `DemoControls.tsx`, `MotionTuner.tsx`, `DevPanel.module.css` |
| Token parsing/validation/patch/JSON/clipboard | `src/dev/motionEdit.ts` |
| DEV-only mount in its own React root (HMR-safe, mounts once) | `src/dev/bootstrap.tsx` |

Triggers call `DemoSource.trigger()`; the UI never touches domain state. Motion edits use `motionTokens()` / `tuneMotion()` / `resetMotion()`; defaults unchanged.

Semantics: **Pause** clears the timer and keeps the connection (no `IDLE` status flash). **Resume** sends a fresh full feed (the app's clock kept counting) and re-arms exactly one timer. **Restart evening** rebuilds the sim from kick-off (same seed, keeps the followed player) and sends a feed; if paused it stays paused. Triggers also work while paused.

## Open and use (development)

`npm run dev`, open `/?demo` (or `?demo=fast`). A small **Dev** button sits bottom-left; click/Enter opens the panel, Escape closes it.
- **Simulation**: Pause/Resume, Restart evening, seven trigger buttons (tooltip = Lua meaning). A status line says "fired" or "nothing to act on right now" (e.g. `goalFavorite` when the followed player is not on the pitch). Without `?demo` the controls are disabled with a hint.
- **Motion tokens**: speed, toast/goal holds, focus, mark, then a section picker with dur, delay, stagger, x1 y1 x2 y2. Valid edits apply at once (affect the next animation). Invalid values (non-number, empty, dur < 0.01, delay/stagger < 0, x outside 0–1, speed < 0.05, holds below the Lua floors) are flagged (`aria-invalid`, red hint) and not applied. **Reset tokens** restores approved values; **Copy as JSON** copies all globals and all 14 sections and reports "Copied JSON" / "Copy failed" (textarea fallback if the Clipboard API is unavailable).

Screenshots (`reports/part16-screens/`): `{390,900,1280}-collapsed.png` and `-open.png` (after `goalHome`, paused, an invalid `dur` shown). Verified on the dev server at all three widths: no horizontal overflow; collapsed it is a 47×28 px button, the host ignores pointer events so the app stays usable; open, the panel is ≤340 px wide, ≤560 px high, scrolls internally.

## Production exclusion

`main.tsx`: `if (import.meta.env.DEV) void import('./dev/bootstrap')…` is replaced by `false` at build time, so the import and all of `src/dev` drop out. After `npm run build`, none of these strings is in `dist/` (0 files each): `Reset tokens`, `dev-panel-root`, `Copy as JSON`, `Restart evening`, `No demo is running`, `Motion tokens`, `Dev panel`, `nothing to act on`, `Reset to the approved`, `bootstrap`. `dist/assets` holds only the Part 14 chunks (index, data, demo, DevKit). Not in prod: the panel, tuner, bootstrap, CSS. In prod (small, in the already-lazy `demo` chunk): the DemoSource pause/resume/restart/subscribe adapters and the registry.

## Checks

| Check | Result |
|---|---|
| `npm run typecheck` | clean |
| `npm run lint` | clean |
| vitest | 518 tests, 59 files (501 + 17 new). Passed on 2 of 3 full runs (see below) |
| `npm run build` | ok; initial JS **207.59 KB gzip**, identical to Part 14 (budget 180 KB still exceeded, pre-existing) |
| Browser suite, once, 1 worker, 0 retries | **160 passed, 1 skipped, 1 failed** (see below) |
| Dev server at 390 / 900 / 1280 | checked, screenshots above |

New tests: trigger events for all seven, pause/resume lifecycle with timer counts, trigger while paused, restart (incl. while paused), subscribe/unsubscribe, active-source registration; panel collapse/Escape, trigger buttons on the app's source, pause/resume/restart without extra timers, late-starting/stopping source, token edits + validation + reset, JSON copy + failure, mount-once and cleanup.

### Honest notes on failures
- **Browser suite**: the one failure is `list.spec.ts:150` "five cards of 70…" at 1280 (bottom 452.85 vs 451, tolerance 1.5). It passed when re-run alone once (bounded check). The panel is not in the production build the suite runs against, so I take it as the existing sub-pixel/timing sensitivity of live cards under the real-time demo; not investigated further. The two Part 14 failures ("each pane keeps its own scroll" at 900/1280) did **not** fail in this run; I did not investigate why.
- **Environment**: the first suite attempt had no browser (Playwright wanted a newer headless shell), so it was discarded; the counted run used `PW_CHROMIUM_PATH=/opt/pw-browsers/chromium`.
- **vitest**: `demoSource.test.ts` "a complete matchday plays through the store" takes ≈3.6 s alone (5 s limit, same as before my change) and timed out once in one full parallel run; the next two full runs passed 518/518. Pre-existing fragility, assertions untouched.

## Shared-file edits and Part 15 integration

- **`src/main.tsx`**: one DEV-only dynamic-import line (own commit). This is the only edit outside new files and `src/data/demo/*`. Router, Shell, layout, CSS, insights, player untouched.
- Part 15 touches none of my files; expected merge conflicts: none (possibly `main.tsx` only if Part 15 edits it). The panel mounts in its own root on `document.body` with `z-index: 2000`, bottom-left; if Part 15's pane 3 puts controls there, move `.root` in `DevPanel.module.css`.
- `src/data/demo/index.ts` gains exports (`activeDemoSource`, `subscribeActiveDemoSource`, `DEMO_TRIGGERS`).

## Limitations and default decisions
- Triggers produce demo events/store moments only; no toast/scene exist until Parts 17–18.
- Pause does not freeze the app's own computed clock (it keeps counting from the last sync); Resume's feed resyncs it. Time into the current 6 s tick is not preserved across a pause (the tick restarts).
- Restart replays the evening from kick-off with a fresh feed; the store's applyFeed handles it as any snapshot. Moment/seq behaviour on restart was not specially tested beyond the DemoSource level.
- Panel shows in every dev session (not only `?demo`) so motion tuning works without the demo.
- Token edits persist until reset or reload; running animations keep their old numbers (documented in `tokens.ts`).
- Unit-tested with jsdom; the dev-server visual check was done with Playwright's Chromium.
