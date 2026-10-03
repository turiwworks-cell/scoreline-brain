# Part 15: Desktop insights

Built on Part 14 (`25c1f36114d1de7bd2faaf8e925cb3aafedc087c`) on the dedicated branch `codex/part-15-desktop-insights`. No PR and no merge. Part 16 (`claude/part-16-dev-panel`, `434fd3d8ac621620f6130856b3e2f23d7c70defe`) is not included. `main` and the Claude branches are unchanged.

## What is built

The third desktop pane now has the Lua's Player / Tables / Leaders switch. The default Player tab says “Pick a player.” until a player is opened. Tables puts the open match's league first, highlights its two teams, then shows the other nonempty league tables in feed order. Leaders shows today's eight highest rated players, their opponent and clock, follow star and event tags, followed by up to fourteen noncancelled goals with their historical scores.

The tables reuse a shared `src/ui/StandingsTable` extracted from the match Table. No feature imports another feature. The app layer handles routing and the followed-player preference. Existing motion tokens supply the segment morph, pane swap, list/squad cascades and press/hover feel; no token defaults or flight engine internals were changed.

France/Argentina leader tiles use the existing photo manifest and lazy photo loading. Other teams and failed/missing photos retain the kit-disc fallback. The desktop close button returns to the previous route; opening from Leaders and returning restores Leaders and focus to its row. The routed player stays mounted while local Tables/Leaders tabs are selected, preserving its scroll. Reopening that same player from the line-up reveals Player without another history entry.

Tables/Leaders content is loaded with `React.lazy`. Phone and tablet keep their existing layouts and do not request the Insights chunk. Local insight tab changes do not change the URL or add history entries, and reset only the insight pane's scroll. Keyboard tab navigation and reduced motion use the existing Tabs/motion implementation.

## Checks

Full browser suite, run once: **166 passed, 13 skipped, 4 failed**, 183 cases, 5.5 minutes.

- Two failures were the previously reported pane-scroll test at 900 and 1280 (expected 300, received 0).
- Two additional failures were in the unchanged Part 13 “markers rise line by line, forwards first” test at 390 and 900. Its first recorded marker was `fra:16` instead of `fra:10`. It starts sampling after the heading is attached; late sampling of the existing pitch entrance is a plausible cause, but was not confirmed. No line-up code or existing test/assertion was changed, and these failures were not stress-tested.
- All nine applicable new Insights cases passed in that full run. Twelve desktop-only Insights cases were skipped on phone/tablet; the existing phone hover case accounts for the remaining skip.

During review of the capture, a Part 15 source-selection issue was found: selecting Player before its route arrived removed the pressed Leader row, so the existing flight engine could fall back to the face in the line-up. `ThreePane` now keeps Leaders until the route arrives, then reveals Player before the shell measures the flight. The new flight test additionally asserts that the actual source belongs to the pressed Leader row, not just that a face and bust moved.

The full suite preceded that final scoped correction; its result is not claimed as a full run of the final revision. After that correction: typecheck, lint and the production build passed; **33 scoped unit tests passed** (Insights/domain/selectors, player reveal/navigation actions and MatchDetail); `e2e/insights.spec.ts` passed **9 applicable cases**, with **12 desktop-only skips**, at 390/900/1280 in 26.5 seconds. The recording and screenshots were recaptured on the final revision. No full-suite rerun was made.

- Typecheck and lint: clean.
- Unit tests: **516 passed**, 62 files, one worker, 85.96 seconds. Fifteen tests were added to the 501-test baseline.
- Production build: passed.
- The first default parallel `npm run check` timed out in the unchanged `DemoSource` complete-matchday test at its existing 5-second limit. That file then passed all nine tests on its own with one worker, and the complete 516-test run passed with one worker. No assertions or timeout settings were relaxed. This does not prove the parallel timeout cannot recur.
- The capture session reported zero page errors. Six screenshots and a desktop open/close recording are included.

Browser tests run with one worker, zero retries, no CPU throttling. Chromium Headless Shell was used in this Linux environment. The recording demonstrates interactions; it is not a measurement of GPU rendering or smoothness on a physical device.

## Bundle

Initial JavaScript remains over the 180 KB gzip budget. Vite reports **210.35 KB** for the entry plus the three JavaScript chunks preloaded by `dist/index.html`: index 176.83, domain 20.06, UI 13.10, runtime 0.36 KB. Part 14's reported baseline was 207.59 KB, so the increase is approximately 2.76 KB. Looking only at the index chunk would understate the initial download.

The Insights chunk is an additional **2.99 KB gzip**, fetched on the first Tables/Leaders selection. Using Node's default gzip settings on the same four initial files yields 208,254 bytes; those settings differ from Vite's, so that value is not used to claim an improvement against the earlier Vite report. Dependencies, lockfile and bundle budget settings are unchanged. No broader performance work was attempted.

## Geometry and visual review

Reference: `legacy/scoreline_11.luau`, desktop insights around lines 6764–7090, with shared league rows around 5713. At 1280 × 892, the existing three-pane shell is retained. Pane 3 is 390 × 844 at x859, y24.

The new browser tests assert pane-relative switch x45/y12, size 300 × 36; a 96 px header; the first league heading at y106; first leader row x12/y133.7, 366 × 64; and goal rows 52 px high. Other source-derived values include 52 px leader photos, 46 px standings rows, the existing standings columns/qualification cut, and 36 px between leagues.

All six screenshots were inspected: default prompt, Tables, Leaders and player at 1280, plus player at 390 and 900. Text, hierarchy, photos/fallbacks and alignment were reviewed visually. This part does not include a fresh Lua screenshot comparison or pixel-diff; measured DOM geometry and source-derived values are distinguished from visual judgment. The desktop remains the agreed legacy three-pane demonstration, not a new full desktop composition.

## Scoped changes outside the new feature

- `ThreePane`: switch, empty Player state, close button, local tab state and player retention.
- `nav/actions` plus `playerReveal`: a same-route player tap can reveal a hidden desktop Player tab without adding history. New tests cover that behavior.
- The match Table's row/header/legend view and styles moved into `ui/StandingsTable`; its data selector, empty state and existing geometry remain in the match feature. Existing match tests validate the extraction.
- `InsightsPlaceholder` was deleted.

No data contract, DemoSource, store, package/lockfile, flight engine, token defaults or Part 16 files were changed. Existing browser test files and assertions were not modified; all new browser coverage is in `e2e/insights.spec.ts`.

## Decisions and gaps

- **Goal replay is deferred:** each goal row supplies its exact event to the app callback, but currently opens that match's Facts. Parts 17/18 connect replay; a replay scene is not implemented here.
- **Goal chronology:** contract v2 has no event timestamp. Goals sort by descending match minute, then stream sequence within a match, with stable feed order across matches. This is not guaranteed wall-clock ordering when kickoffs differ, unlike the Lua's event-time ordering. Missing historical scores show an em dash rather than today's current score.
- Today's offset is `day === 0` in the app contract. Scheduled matches and cancelled goals are excluded. Finished matches retain their ratings.
- Tables omit leagues without standings, including empty friendlies. Leaders and goals have explicit empty states; rating ties retain the existing domain order.
- The selected player's lifetime follows the existing route: switching insight tabs preserves it, but navigation that removes the player route can clear it. No new persistent player-selection model was introduced.
- Part 14's 2× hero preload gap and the existing pane scroll failures were not addressed. The initial JS budget is still exceeded.
- Part 16 must be reviewed and integrated separately; it has not been accepted or merged by this work.

## Evidence and reproduction

`reports/part15-screens/` contains `1280-player-empty.png`, `1280-tables.png`, `1280-leaders.png`, `1280-player.png`, `390-player.png`, `900-player.png` and `part15-switch-player-return.mp4`. The recording covers Player → Tables → Leaders → Mbappé → close back to Leaders.

```sh
git fetch origin
git switch codex/part-15-desktop-insights
npm ci
npm run build
npm run preview
```

Open `http://localhost:4173/match/1/lineup?demo` at 1280 × 892. Choose Tables/Leaders, open a leader, close, and reopen the already selected player from the line-up while its tab is hidden.

```sh
npm run typecheck
npm run lint
npx vitest run --maxWorkers=1
npx playwright test --workers=1 --retries=0
```

On this environment the Playwright invocation also supplies `PW_CHROMIUM_PATH` pointing to the installed Chromium Headless Shell.
