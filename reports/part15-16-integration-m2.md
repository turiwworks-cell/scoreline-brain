# Parts 15 + 16 integration — M2 checkpoint

Branch: `codex/part-15-16-integration`.

| Parent | Branch | Exact commit |
|---|---|---|
| Part 15 | `codex/part-15-desktop-insights` | `463b6f8f2d034630c239f1131889896070461f84` |
| Part 16 | `claude/part-16-dev-panel` | `434fd3d8ac621620f6130856b3e2f23d7c70defe` |

Both start from Part 14 (`25c1f36114d1de7bd2faaf8e925cb3aafedc087c`). The merge was conflict-free. This is a dedicated merge commit with both parents, including the integration fixes described below. `main` and both part branches are unchanged. No PR was opened and Part 17 was not started.

## Combined behavior

The legacy desktop's Player / Tables / Leaders switch and real photos coexist with the development panel. The panel controls the same DemoSource that feeds the app; it has no separate simulation. Development checks at **390 × 844, 900 × 800 and 1280 × 892** exercised all seven triggers, pause/resume, restart, token editing/validation/reset, actual clipboard JSON, player opening/return and all four match tabs. Desktop Tables/Leaders and closing a leader back to Leaders also worked.

The panel is excluded from production. The production build contains none of the panel's distinctive labels or host id (`dev-panel-root`, `Copy as JSON`, `Restart evening`, `Reset tokens`, `Motion tokens`, `No demo is running`). On the final production build, browser checks at all three widths found no Dev button or panel root, no horizontal overflow and no page errors. Desktop production Tables → Leaders → player → close was also checked. The existing `/dev/kit` feature is separate and remains as before.

## Integration fixes: a real restart

Review found that Part 16's restart reconstructed the simulator and sent its initial snapshot, but the connected domain rejected that snapshot as stale: the old match's sequence was higher. Scores, finished status and player stats could remain from the old evening. A regression test reproduced the problem before the fix.

The source now labels its restart feed with local delivery metadata `{ reset: true }`. `connectSource` routes this to the store's new `resetFeed` action, which applies the snapshot against `emptyState`, clears queued moments and preserves the current connection status. The wire data contract and the ordinary API poll/SSE behavior are unchanged. Generic targets may optionally implement `resetFeed`; the app's store does. Raw feed listeners still receive the fresh snapshot.

The first capture also exposed UI memories left over from the old evening. Restart now increments a store `session` counter. Goal observers clear their deduplication ids and marks on that change; the followed player's live reducer clears goal/red/action memories and its release timer. This lets a goal with the same simulator event id play in the new evening, while ordinary queue draining still retains deduplication.

Three regression tests were added: restart of the connected store after goals/full-time, goal marks with repeated event ids across a restart, and followed-player goal/red/action reset. No browser assertions were weakened or old browser tests edited. The new hook test restores its fixture after use so it cannot leave a high event sequence in the shared test store.

Files changed beyond the merge: `data/source.ts`, `data/sync.ts`, `data/demo/demoSource.ts` and its tests, `store/store.ts`, plus the match-list goal observers and followed-player live hook/tests. No dependency, lockfile, motion default, layout, shared-flight engine or new feature work was added.

## Validation

Final revision: typecheck and lint are clean, the production build passes, and **536 unit tests passed** in 63 files with one worker (95.48 seconds): 533 from the merged parts plus three integration regressions. The new connected-store regression failed before the fix; the final suite passes without changing timeout settings or weakening assertions.

The full **production browser suite** ran once, with one worker, zero retries and no throttling: **167 passed, 13 skipped, 3 failed**, 183 cases, **5.8 minutes**. Twelve skips are desktop-only Insights tests on phone/tablet; the thirteenth is the existing phone hover skip.

All three failures were the unchanged Part 13 test “markers rise line by line, forwards first,” at 390/900/1280. The first recorded marker was `fra:16` rather than `fra:10`. The same symptom appeared at 390/900 in Part 15's run. The test samples after the heading attaches; late sampling is a plausible explanation, but the cause is **unconfirmed**. No stress runs or fixes to that test were attempted.

The previously reported pane-scroll-to-zero cases at 900/1280 passed in this run. That is not proof those intermittent failures have been fixed; they remain open.

**Revision boundary:** the full browser run included the connected-store restart fix but preceded the final UI-memory/session reset. It is not claimed as a full run of the final revision. Final validation after that correction includes the complete unit suite, typecheck/lint/build, the development scenarios at all three widths and production checks at all three widths. The full browser suite was not repeated.

The development checks verified, for each width:

- All seven triggers each added the expected goal/red/full-time moment to the connected store.
- Restart after those triggers restored initial scores, events, stats and live status, cleared the queue and goal marks, and kept the source paused and connection live. A subsequent goal was accepted; repeated-id behavior also has regression tests.
- Motion speed and tab duration edits applied; invalid duration was rejected; Reset restored defaults; clipboard JSON included all fourteen timing sections.
- Escape closed the panel and returned focus to Dev; player opening/return and Facts/Stats/Table/Lineup navigation worked; no page errors or horizontal overflow were recorded.

Chromium Headless Shell was used on Linux. These checks do not establish physical-device GPU smoothness, LCP or a frame-rate budget.

## Bundle and remaining issues

Initial production JavaScript: **210.48 KB gzip** (Vite's index 176.96 + domain 20.06 + UI 13.10 + runtime 0.36), versus Part 15's 210.35. The **180 KB budget is still exceeded**. The lazy Insights chunk is 2.99 KB; the demo chunk is 7.59 KB. The panel/tuner/bootstrap and panel CSS are excluded from production. Demo control adapters remain in the already lazy demo chunk, as in Part 16.

The existing scroll flakes and the line-up entrance test failures remain open. Part 14's 2× hero preload gap remains. Goal rows open Facts; replay/celebration scenes and Rive words belong to Parts 17–20. The desktop is the agreed legacy three-pane demo, not a new full desktop design.

## M2 status

`docs/BUILD-PLAN.md` defines M2 after Parts 10–16 as “every screen is ported and a demo matchday plays.” The combined branch now contains match list, match tabs/momentum/line-up, player view, desktop insights and dev controls. The complete-matchday DemoSource test advances the connected store through the entire evening without a backend. The integrated browser checks cover screen navigation and manual event controls.

**The functional M2 scope is implemented and available for review. It is not a fully green acceptance/release:** the failures and budget overage above are still unresolved. Part 17 can use this combined branch as its base while retaining those known issues.

For Part 17: observe the store `session` change to cancel scenes/timers and discard old pending presentation work on demo restart. The store already clears its queued moments; old simulator event ids may legitimately recur in a new session. A normal `takeMoments()` does not change the session.

## Evidence and reproduction

`reports/part15-16-screens/` contains the final development panel at 390/900/1280, combined desktop Insights, and production Tables/Leaders. Screens were inspected after entrances settled. The original part reports/screens/Part 15 recording remain in the merge.

```sh
git fetch origin
git switch codex/part-15-16-integration
npm ci
npm run dev
```

Open the Vite development URL with `/match/1/lineup?demo`. Open Dev, pause, fire triggers, restart, fire another goal, edit/reset/copy tokens, then resume. At desktop width also open Tables/Leaders and a player. Pause holds the simulation; the app's extrapolated clock continues between feeds, as documented by Part 16.

```sh
npm run typecheck
npm run lint
npx vitest run --maxWorkers=1
npm run build
npx playwright test --workers=1 --retries=0
npm run preview
```

Production preview is `http://localhost:4173/match/1/lineup?demo` and has no development panel. This environment's browser invocation supplies `PW_CHROMIUM_PATH` for the installed headless shell.
