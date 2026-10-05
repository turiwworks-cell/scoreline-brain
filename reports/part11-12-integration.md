# Parts 11 and 12: integration and review

The real momentum chart now renders in the match screen's Facts tab, replacing the Part 12
placeholder. Parts 11 and 12 are combined on `codex/part-11-12-integration`; this branch is ready
for demo review and continued feature development, with the scroll and bundle issues below open.
It is not a claim of production readiness or final visual acceptance.

## Inputs and Git scope

- Part 11: `claude/part-11-1rfhif`, `2be96ca68104d388670565d6dfb3201724a53914`.
- Part 12: `codex/part-12-momentum`, `3a14382d30a5060b4a110d457eec82ded49ec18e`.
- Both start from Part 10 `a009e28`. The local merge had **no conflicts**.
- The published commit has both completed-part commits as parents. No original part branch or
  `main` was changed; no PR was opened. No Part 13 or desktop redesign was started.
- No dependency, lockfile, domain, data, store, app or motion file was changed by the integration.
  Part 11's changes in those areas are preserved in its parent commit.
- The historical `part12-momentum.md` describes the standalone component before integration;
  this report describes the current combined branch.

## Review and changes

- Checked the Part 11 match-screen mount, tab lifecycle, clock hooks, momentum placeholder,
  colour policy, and its changes to the app wrappers, demo qualification fields and shared UI
  helpers. The source matches the reported scope; the Lineup tab still uses Part 13's placeholder.
- Facts mounts Momentum for live/finished matches. Scheduled matches retain the original
  kick-off, form and match-info content.
- Kept the 269.8 px momentum block and 36 px gap before Events. Removed the old placeholder
  component and its unused CSS. Momentum owns its internal 18 px inset; no double gutter.
- Passed the synchronized `match.clock.minute` and structurally shared team/event/series
  references. Leaf hero/heading clocks can tick without rebuilding the chart or replaying it.
- Match id keys the chart; leaving Facts unmounts it and returning mounts a fresh entrance.
- Momentum now uses Part 11's existing `sideColors()` helper, so Stats, commentary and the chart
  share one primary/secondary/neutral contrast policy. The colour tests and image baselines pass.
- Updated the existing placeholder assertions to check the real chart, keeping the original
  position assertions for the chart's glass and everything beneath it. Added one browser test
  for clock stability and Facts → Stats → Facts mounting (run at all three widths).
- No change to Part 10's motion, navigation/scroll behavior, shared-element engine or global
  motion tokens. No photo-manifest wiring, lazy loading, or new desktop composition.

## Checks on the combined code

| Check | Result |
| --- | --- |
| Typecheck and lint | Passed |
| Unit tests | **424 passed** (409 from Part 11 + 15 from Part 12) |
| Production build | Passed |
| Dedicated match browser tests | **24 passed**, 390 / 900 / 1280 |
| Isolated momentum browser / image tests | **12 passed**, 390 / 900 / 1280 |
| Verification fixture typecheck | Passed |
| Full app browser suite, one run / one worker / no retries | **105 passed, 1 skipped, 2 failed** |
| Case-only filename collisions | None |
| Git whitespace check | Passed |

The two full-suite failures are `each pane keeps its own scroll` at tablet 900 and desktop 1280,
`e2e/nav.spec.ts:174`: after opening another match, list scroll was **0 instead of 300**. Phone
passed. This is the same assertion and symptom already documented in Part 10/11 and observed
on the unconnected Part 12 branch; the cause remains unconfirmed. No reruns, timing/assertion
changes, stress tests or navigation fixes were used to turn this report green. The expected
skip is the phone kit hover test.

All validation above used the final app code. Later changes only added this report and captured
settled screenshots from the same production build. Chromium Headless Shell 134 was used in
this Linux environment; it is not a real-device/GPU performance or 60 fps measurement.

## Bundle and remaining work

Initial JS is **196.90 KB gzip** against the **180 KB** budget. Part 11 reported 194.8 KB, so
connecting the chart adds about 2.1 KB. The integration does not solve that budget overrun.

The scroll failure requires a bounded, separate investigation before shipping. The earlier
recording's perceived lag, near-wrap-width font differences, real photo wiring, and final visual
comparison against the original remain open. The Part 7 first-few-milliseconds timer failure
reported by Claude did not occur in this unit run; that test was not edited.

The existing desktop shell is preserved here. It is still the temporary multi-pane demonstration;
the user's requested real desktop design is separate future work, not accepted by these screenshots.

Claude's Part 11 report and Lua side-by-side screenshots were not present in the pushed Git tree,
so no claim is made that those external report images were reviewed. The automated geometry
checks use the Lua's coordinates; Part 12's baseline images are component regression images,
not pixel-perfect comparisons to the Rive renderer.

## Screenshots and preview

Settled screenshots of the compiled combined app, with the full chart revealed:

- [Phone 390×844](part11-12-screens/facts-phone-390x844.png)
- [Tablet 900×800](part11-12-screens/facts-tablet-900x800.png)
- [Desktop 1280×892](part11-12-screens/facts-desktop-1280x892.png)

On this branch:

```sh
npm ci
npm run check
npm run build
npm run preview
```

Open `http://localhost:4173/match/1/facts?demo`. The full browser suite is
`npm run test:e2e -- --workers=1`; the isolated component suite is
`npx playwright test --config playwright.momentum.config.ts`.

For Part 13, start an isolated branch from the **published integration commit**, preserving the
completed match screen and momentum chart. Keep any fixes to the listed unrelated issues scoped
and documented rather than silently changing them while porting the line-up.
