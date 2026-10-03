# Part 18 — Toast and scene (DOM)

Branch: `claude/part-18`, from `origin/codex/part-15-16-integration` at `61135e0` (the integrated
checkpoint, which already carries Part 17). Implementation commit `2e7a68e`, report `d52655b`, review fixes
in the commit after it. `main` was not changed, nothing was merged and no PR was opened. No dependency was added.
Part 19 has not been started.

## What it does

`src/features/moments/` (ARCHITECTURE §8 `features/moments/`) renders what the Part 17
MomentDirector puts on its stage. It follows the integration contract in
`reports/part17-moment-director.md` and changes nothing in `motion/moments/`.

| File | Role |
| --- | --- |
| `MomentStage.tsx` | Reads `useMomentStage()` and renders the presentation, keyed by `key`: a `scene` as `Scene`, a `toast` or `summary` as `Toast`. A `slot` says what one mount shows (`all`, `scene`, `toast`). |
| `Toast.tsx` | The notification (drawToast, luau:6205–6283) and the summary. |
| `Scene.tsx` | The goal and red-card scenes (goalScene / redScene / sceneStory, luau:6423–6656). |
| `Word.tsx` | The plain DOM stand-in for the headline word (GOAAAL letters landing, RED CARD letters slamming), until Rive's GoalWord (Parts 19–20). |
| `useStageTime.ts` | Seconds since `startedAt` and since `outAt`, on the director's clock, every frame. |
| `model.ts` | Pure: scorer, assist, names, the score before and after, the commentary (`ev.text`, else `plainLine`). |
| `choreo.ts` | The Lua's geometry and the fixed beats inside a scene (hit at 0.3 s, slash timings, wall sizes…), each with its `luau:` line. |

**Timing.** Section timings come from the tokens: `timing('toast')` and `timing('goal')` are read once
when a presentation mounts, and the scene's beats come from `Presentation.beats`. Exit lengths use
`TOAST_OUT` / `SCENE_OUT`'s windows. Nothing reads a duration inline. Every moving part is a function of
the stage time with the Lua's own formula (`bez(T.c, prog(t, at, T.dur))`), so the director's first
tap (which moves `startedAt` back by `beats.full`) jumps the whole choreography to its landed state,
as tapScene does. Exits are played when `phase` turns `'out'`; when the stage empties or moves on,
the element is removed (the Lua also drops a replaced toast at once).

**Toast.** Slides 120 px down on the toast curve. The flag (or a red card) arrives at 36 px, then the
player's bust rises from the bottom edge (`T.delay`), the flag shrinks to an 18 px badge on its corner,
and the team name gives way to the player's (`T.delay + T.stagger`). A kit disc stands in without a
photo. The score and both short names sit on the right; the grip sits at the bottom; your followed
player gets the star. Gestures (luau:8750–8846):

| Gesture | Effect |
| --- | --- |
| Press | `hold(true)`; the toast stays past its time. Release: `hold(false)`. |
| Drag | Up follows the finger; down follows a quarter of it. 6 px slop before a press is a drag. |
| Release past −26 px, or flicked up faster than 380 px/s | `dismiss(key)`; it flies up past the top over 0.32 s on the IN curve. |
| Release short of that | Springs back: a critically damped spring with the Lua's rate (`exp(−16 t)`), no bounce. |
| Tap / Enter / Space | Opens the toast's match through the app's navigation, then `dismiss(key)` (the contract's option). A summary closes (`tap`). |
| Escape | `dismiss(key)`. |

The whole pane is one `<button>` whose label says what happened and the score ("Goal, 61', Doué,
France. France 3–1 Argentina. Open match"); the drawing is `aria-hidden`. The shell's polite
`moment-announcer` region still does the announcing.

**Summary.** Same pane: a count disc, "While you were away" (reason `away`) or "Meanwhile"
(`overflow`), the counts ("3 goals · 1 red card"), and the latest match's score.

**Scene.** Black page, fading in over 0.2 s and out over 0.4 s.

- **Goal:** the team-colour flash; the flag over GOAAAL in the middle, which then rise together to the
  top; the stage light; a wall of four cards in the match's colours rising one after another, with a
  flash along each top edge; the scorer's bust rising onto the floor; the floor line drawing across;
  the first and last names with the minute, "Assist …" and "Your player"; the commentary, word by word
  over 1.4 s; the team name and "Scores · 61'" at the top; and the score strip rolling the new digit in.
- **Red card:** the hit at 0.3 s (shake, three strobes, three slashes), the card slamming in huge and
  spinning, RED CARD, the same story with "Sent off", then the card flying to the top-left corner
  beside the crest and "Down to ten".
- A tap: the first shows everything, the next closes (`tap`). The close button and Escape `dismiss`.

**Where it plays** (drawDesktop, luau:7051–7083):

| Width | Scene | Toast |
| --- | --- | --- |
| Phone | Over the whole screen (above the match and player layers) | Top of the screen, 16 px in, 50 px down (+ safe area) |
| Tablet | Inside the match pane | Top of the match pane |
| Desktop | Inside the match pane | Top of the third pane, as in the Lua |

`app/layout/Stage.tsx` wires a `MomentStage` with the navigation and the followed player. The shell
mounts it on phone; `MatchPane` mounts it (`all` on tablet, `scene` on desktop); `ThreePane` mounts a
`toast` slot in the third pane. The director is still held by the shell (Part 17); the stage holds
nothing.

**Shared code.** The Lua curve maths (`bez`, `prog`, `ease`, `env`, `lerp`, `clamp`) moved from
`features/matchList/curve.ts` to `motion/curve.ts` so a second feature can use it (features may not
import each other). `features/matchList/curve.ts` now re-exports it, so no list file changed.

## Not done here (left to the design pass and Parts 19–21)

- The GOAAAL glint and the exact Rive letterforms: the DOM word is a stand-in.
- The scene's vertical "centre stage" positions scale with the stage's floor (`height − 240`), and the
  wall shortens with it, so shorter panes and phones keep the Lua's proportions. The 844 px phone
  matches the Lua's numbers; other heights are an approximation for the design pass to tune.
- On the desktop the toast sits over the third pane's Player / Tables / Leaders switch, as the Lua
  draws it. That may want moving in the design pass.
- When a keyboard user has focus on the toast and it leaves, focus falls back to the page.
- A phone scene covers the screen but does not take focus, so keyboard focus can stay on a control
  under it. A 7.5 s celebration that closes on its own should not pull focus; the close button and
  Escape remain, and the polite region announces the moment.
- The stage ships in the initial bundle (+7.09 KB gzip, below). It is needed only when a moment plays,
  so it is a candidate for a lazy chunk in Part 21's budget work.

## Validation

### Static checks and unit tests

| Check | `61135e0` (before) | Part 18 (`2e7a68e`) |
| --- | --- | --- |
| `npm run typecheck` | clean | clean |
| `npm run lint` | clean | clean |
| `npx vitest run --maxWorkers=1` | 64 files, 554 tests: **553 passed, 1 failed** | `2e7a68e`: 66 files, 573 tests: **572 passed, 1 failed**. After the review fixes: 66 files, 575 tests: **575 passed** |
| `npm run build` | passes | passes |

The one unit failure is the same test before and after, and it is not Part 18's:
`src/data/demo/demoSource.test.ts` › "a complete matchday plays through the store with no backend"
took about 5.4 s against Vitest's 5 s default. It also failed when run on its own, on the unchanged
checkpoint. It passed in the run after the review fixes, and Part 17 reported it passing. So it is an
intermittent timeout that depends on this machine's speed. It was not changed.

The 19 tests added with `2e7a68e` all pass. The review added 2 more (below):

- `model.test.ts` (6): scorer, assist, first and last names, the score before and after a home or away
  goal, a goal with no event, a red card, an unknown match, and the labels and summary counts.
- `MomentStage.test.tsx` (13), with a real director over the app store and a hand-driven clock:
  - **Scene:** the open match's goal plays a scene with the bust from the manifest, the assist,
    "Your player" and the commentary. The first tap moves `startedAt` back by `beats.full` and the
    second closes it. The close button and Escape dismiss it. A red card plays the red scene. A scene
    is not drawn in a toast-only slot.
  - **Toast:** another match's goal is a toast; a tap calls `onOpenMatch(2)` and dismisses it. A toast
    is not drawn in a scene-only slot. A finger on it holds it past its time. A 40 px swipe up dismisses
    it without opening the match. A short drag springs back and keeps it. Escape dismisses it.
  - **Summary and reduced motion:** four goals at once give a toast, then a "Meanwhile: 3 goals"
    summary that closes on a tap. With reduced motion, the would-be scene is a static toast with the
    player already in.

### Done when: the dev panel's triggers at 390, 900 and 1280

The dev panel exists only in development, so the check runs on the dev server
(`npx playwright test -c playwright.moments.config.ts`, `verification/moments/moments.spec.ts`,
following Part 12's `verification/` setup). On the final commit: **15 passed, 0 failed**. Per width:

- `goalHome` plays the goal scene: full screen on the phone, inside the match pane on the panes. The
  story lands; the first tap shows all and the second closes.
- `redHome` plays the red scene ("Down to ten", "Sent off"); Escape closes it.
- With another match open, `goalHome` is a toast: at the top on the phone, in the match pane on the
  tablet, in the third pane on the desktop. A tap opens France – Argentina and the toast leaves.
- `goalAway`, swiped up, leaves without navigating.
- `redAway`'s toast leaves on its own after its entrance plus `toastHold`.
- In every case: no page errors and no horizontal overflow.

### Visuals (`reports/part18-screens/`)

Captured on the dev server through the dev panel's triggers, with the simulation paused, at
390 × 844, 900 × 800 and 1280 × 892:

| File | Shows |
| --- | --- |
| `<w>-goal-headline.png` | 1.2 s: the flag over GOAAAL, centre stage, in the team's light |
| `<w>-goal-landed.png` | 3.5 s: the headline at the top, the wall, Doué's bust, name, minute, commentary, the score strip |
| `<w>-red-hit.png` | 0.45 s: the card slammed in, RED CARD's letters arriving |
| `<w>-red-landed.png` | 3.5 s: the card in the corner, "Down to ten", Upamecano, "Sent off" |
| `<w>-toast-arriving.png`, `<w>-toast.png` | the toast sliding in with the big flag; then the player in and his name in place |
| `<w>-summary.png` | four goals at once: after the first toast, "Meanwhile · 3 goals" |

Each set was inspected. One fix came out of the tablet check: on the 752 px tall pane, the Lua's
320 px wall reached the headline. It now shortens with the floor.

### Production browser suite

The suite ran in full, one worker and no retries, 183 cases each run. Two runs on Part 18, and one on
`61135e0` in a separate worktree with its own build and server:

| Run | Passed | Skipped | Failed | Time |
| --- | --- | --- | --- | --- |
| `61135e0` | 166 | 13 | 4: line-up entrance at 390 and 900, pane scroll at 900 and 1280 | 7.4 min |
| Part 18, run 1 | 164 | 13 | 6: line-up entrance at 390, 900 and 1280, pane scroll at 900 and 1280, Stats at 390 | 7.4 min |
| Part 18, run 2 | 167 | 13 | 3: line-up entrance at 390, 900 and 1280 | 7.0 min |

The 13 skips are the same as at M2 and Part 17. **No new failure is Part 18's:**

- **Line-up entrance** (`lineup.spec.ts` "markers rise line by line, forwards first"): pre-existing.
  It fails on the checkpoint, and M2 and Part 17 report it at all three widths. It was not
  investigated or changed.
- **Pane scroll** (`nav.spec.ts` "each pane keeps its own scroll", expected 300, received 0):
  pre-existing and intermittent. It failed at 900 and 1280 on the checkpoint, failed at both in Part
  18's first run and passed at both in the second. It was not investigated or changed.
- **Stats** (`match.spec.ts` "Stats counts out to the possession and opens the bars", 390): the home
  bar measured 201.9 px against 203 ± 1. It is not in any earlier report, so it was compared directly.
  Ten repeats each gave **1 failure on Part 18 and 1 failure on `61135e0`**, the same ~1 px miss. The
  baseline build contains no moment code. The test reads the possession label once while the live
  demo keeps running, so it is a pre-existing intermittent and not Part 18's. It was not changed.

**Suite speed.** One early Part 18 run crawled at about a quarter of the usual pace (43 cases in
~6.5 min). It was stopped before it finished, because its time limit would have cut it off. It did
not happen again: the three full runs above took 7.0–7.4 min, Part 18 and the checkpoint alike. Per
case, from the JSON reporter, the summed test time is **415 s on `61135e0` and 392 s on Part 18**, and
no spec file got slower. The largest single-case increase is 1.8 s on a photo-loading kit check.
The new scenes and the test waits are therefore not the cause. Both builds run about 1.4× slower here
than Part 17's 5.3 min, which is this environment. The cause of the one slow run could not be
established after the fact.

### Bundle

Initial production JavaScript, gzip, measured the same way on both builds:

| Build | Total | index | domain | ui | runtime |
| --- | --- | --- | --- | --- | --- |
| `61135e0` | 211.01 KB | 177.80 | 19.84 | 12.97 | 0.40 |
| Part 18 | 218.10 KB | 184.89 | 19.84 | 12.97 | 0.40 |

Part 18 adds **+7.09 KB**, all of it in `index`. The 180 KB budget was already exceeded and still
is. The lazy chunks (`data`, `demo`, `DevKit`, `Insights`) are unchanged.

## Opus review (ARCHITECTURE: diffs touching `app/` and `motion/`)

The review covered `claude/part-18` at `d52655b` against `61135e0`.

- **Contract.** Only the public surface is used: `useMomentStage`, `appMoments`, `tap` / `dismiss` /
  `hold` with the presentation's `key`, `beats`, `startedAt`, `phase` / `outAt`, `TOAST_OUT`, and
  `summarize`. Each showing is keyed by `key`. Nothing in `motion/moments/` changed, and the stage
  holds nothing.
- **Choreography.** Every value derives from `startedAt` and `outAt` on the director's clock. The
  first-tap jump and the `'out'` exits follow from that, and the section timings come from the tokens.
- **Responsive placement.** Phone over everything (z 4, above the layers); tablet inside the match
  pane; desktop with scenes in the match pane and toasts in the third pane. All of it stays under the
  pane rim.
- **Cleanup.** The rAF loop, the ResizeObserver, the Escape listener and the toast's leave animation
  all stop on unmount.

**Fixed in review** (each with a test that fails on `d52655b`):

1. **Cleanup:** a toast that unmounted while pressed never sent `hold(false)`. The director then
   stayed held, and the presentation never closed on its own. Rotating a tablet with a finger on the
   toast would do it, because the layout change moves the stage to another mount. It now lets go on
   unmount.
2. **Accessibility:** with nobody named (a red card or a disallowed goal without a player), the toast's
   label repeated the team ("Red card, 70', England, England"). It now names the team once.
3. **Accessibility:** the scene's close button now says "Close goal" or "Close red card", not "Close".
4. **Interaction:** the scene's window-level Escape ignored whether another component had already
   handled that Escape. It now leaves a `defaultPrevented` Escape alone.

After the fixes: typecheck and lint clean; unit suite 575/575; dev-panel check 15/15 at all three
widths.

## Readiness for integration

Reviewed (below) and ready to integrate. `features/moments` and the `app/layout` wiring touch nothing in
`motion/moments/`, and the Part 17 contract is used as written. The one shared change is the curve
maths moving to `motion/curve.ts`, with a re-export at the old path. ARCHITECTURE asks for Opus review
of diffs touching `app/` and `motion/`. Open items, all pre-existing or deferred:

- The line-up entrance, pane-scroll and Stats browser failures.
- The intermittent `demoSource` unit timeout on this machine.
- The bundle budget.
- The design-pass items above.
