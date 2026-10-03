# Part 17 — MomentDirector

Branch: `claude/part-17-moment-director`, from `codex/part-15-16-integration` at
`59dfd4e314bf3ae867d0ddb6576982fcbb046ea9`. `main` was not changed, no other branch was merged and no PR
was opened. No dependency was added.

## What it does

`src/motion/moments/` (ARCHITECTURE §8 puts the MomentDirector in `motion/`):

| File | Role |
| --- | --- |
| `director.ts` | `createMomentDirector(store, options)`: the pure core. No React; clock, timers, tab visibility and reduced motion are injected. |
| `beats.ts` | Scene beats and auto-close times from the motion tokens (`beats` / `sceneEnd`, luau:6297–6312; `advance`, luau:8608–8622). |
| `announce.ts` | aria-live sentences, the summary counts and the “while you were away” text. |
| `app.ts` | The app's director over `scorelineStore`, a reference-counted hold, and the React hooks. |

**Consumption.** The director is now the only consumer of the store's moment queue. It subscribes to
the store and calls `actions.takeMoments()` synchronously on every change, so a poll's moments arrive as
one batch. Each moment id is remembered (cap 400) and delivered once. Moments already queued when the
director starts are treated as old news, the same rule `watchMoments` already used.

**Delivery.** When a batch is delivered:

1. Goal cues are set: `goals` (per match `{ t, side, n }`, the same shape as the list's `GoalMark`) and
   `focus` (the match with the latest goal). A disallowed goal removes its match's cue.
2. If the match is open, `hero` is set (heroBumpT, luau:7375).
3. One aria-live announcement is written for the batch.
4. The batch is added to `delivered`, a store-shaped log `{ moments, session }`.
5. Goals, red cards and disallowed goals enter the presentation queue. Kick-off and full time are
   announced only; legacy `endMatch` (luau:7443) has no scene.

**Routing (celebrate / showRed, luau:7358–7429).** There is one stage. A goal or red card becomes a
**scene** when its match is in front (open and not covered by a player layer or sheet; on desktop the
player pane sits beside it) or is the followed player's match. Any other match, and every moment when
reduced motion is on, gets a **toast**. A scene that arrives during a toast replaces the toast at once,
as openScene does (luau:7313). Anything arriving while the stage is busy waits in the queue. When the
stage frees, a waiting scene goes first; otherwise items show in arrival order. Legacy dropped these
moments; the plan asks for a queue.

**Overflow.** When more than `MAX_QUEUED = 2` items wait, the first waiting scene keeps its place and
everything else folds into one `summary` (`reason: 'overflow'`).

**Timing.** The values are read from the tokens when each presentation starts:

| Type | Timing |
| --- | --- |
| Scene | Closes after `max(goalHold, sceneEnd − 1.4)`, 7.5 s by default. It then leaves over 0.45 s. |
| Toast or summary | Closes after `timing('toast').duration + toastHold`, 5.1 s by default. It then leaves over 0.4 s. |
| Tap on a scene | The first tap moves `startedAt` back so everything shows; the next tap closes it (tapScene, luau:7322). |
| Hold on a toast | Holding stops auto-close. On release the toast leaves if its time is up (luau:8603). |

**Hidden tab.** While the tab is hidden, moments are taken from the store, deduplicated and held. They
are not delivered or announced, and they do not start the list's marks. The stage also starts nothing
new. On return, the held moments are delivered together with fresh mark times, so a missed goal can
still be seen. With one presentable moment, it plays normally. With two or more, a single `summary`
(`reason: 'away'`) replaces the waiting queue and anything still on stage. The announcement reads
“While you were away: N goals and M red cards. Argentina 2–1 France. …”.

**Restart.** When `store.session` changes (an explicit demo restart), the director cancels the stage and
its timer. It also clears the queue, the held moments, the cues, the hero, the announcement and the
dedupe memory, and starts the `delivered` log over with a bumped `session`. The same event id therefore
plays again in the new evening. A normal `takeMoments()` never changes the session and keeps the dedupe
memory.

**Existing consumers.** Before this part, `goalFeed` (list marks: goal-mark, goal-focus, card-flood via
`goalFeel`) and the follow card's `useFollowLive` each watched `store.moments`. Once the director
empties that queue, they would see nothing: a nested `set` inside a Zustand listener gives later
listeners an already-empty queue. Both now watch `appMoments().delivered` with the same
`watchMoments` function and the same dedupe/reset code. They therefore inherit hidden-tab holding
and the restart reset. Both hold the app director while mounted (`holdMoments()`), so it runs whenever the list, the follow
card or the shell is mounted, and it stops cleanly with no timers when the last one unmounts.

**Shell.** `app/layout/useMoments.ts` sends the director what is on screen (`openId`, `front`,
`followedMatchId` from the follow preference and `selectMatchIdOfTeam`). The shell renders a second
visually hidden `role="status" aria-atomic` region (`data-testid="moment-announcer"`). `role="status"` is a polite live region, but it carries no `aria-live` attribute, so it stays separate from the shell's title announcer, which `e2e/nav.spec.ts` finds by `[aria-live="polite"]`. Each
announcement is keyed by its counter, so the same words are read again when they repeat.

## Integration contract for Part 18

Import from `src/motion` (re-exported from `motion/moments`).

```ts
const stage = useMomentStage();          // Presentation | null
const d = appMoments();                   // d.tap(key), d.dismiss(key), d.hold(on, key)
```

`Presentation`:

| Field | Meaning |
| --- | --- |
| `key` | Unique per showing (`<session>:<n>`). Key the element by it; `AnimatePresence` plays the exit when it changes or becomes `null`. |
| `kind` | `'scene' \| 'toast' \| 'summary'` |
| `variant` | `'goal' \| 'red'` for scenes; `'goal' \| 'red' \| 'goalCancelled'` for toasts; `'summary'` |
| `moment`, `moments` | The domain `Moment`(s). Score, minute and `event` (scorer, assist, text) come from here plus the store. `moments` is ordered oldest first. A summary's `moment` is the latest. |
| `reason` | Summary only: `'overflow'` or `'away'`. |
| `beats` | Scene only: `{ delay, up, player, commentary, full, end }` in seconds from `startedAt`, from `sceneBeats(kind)` (luau:6297). Use it for the word, rise, bust and commentary choreography. |
| `startedAt`, `closeAfter` | Director clock seconds (`appMoments().clock.now()`, the same scale as the list's `performanceClock`). After a first tap, `startedAt` moves back by `full`; re-derive elapsed time from it. |
| `phase`, `outAt` | `'in'` while playing. During the final 0.45 s scene or 0.4 s toast exit it is `'out'`, then the stage becomes `null` (or the next item). Play the exit when `phase` turns `'out'`. |
| `held` | A finger is on the toast. |

Calls (each is a no-op for a stale `key`):

| Call | Effect |
| --- | --- |
| `tap(key)` | Scene: show all, then close. Toast or summary: close. Part 18 may instead open the match from a toast and then call `dismiss`. |
| `dismiss(key)` | Leave now (swipe past threshold, Escape, close button). |
| `hold(true/false, key)` | Toast or summary drag start and end. Spring-back distance is Part 18's. |

Other reads:

| Read | Meaning |
| --- | --- |
| `useHeroCue(matchId)` | `{ kind, side, t, n }` for the open match's latest goal or red card (hero bump and number spectrum). Compare `t` against `appMoments().clock.now()`. |
| `useGoalCue(matchId)`, `useGoalFocus()` | Goal-mark/flood and goal-focus for code outside the list. The list keeps reading `goalFeed` + `goalFeel`, which the director drives. |
| `summarize(moments)`, `summaryText(...)`, `momentText(...)` | Summary counts and text. |
| `sceneBeats`, `goalLetters`, `SCENE_OUT`, `TOAST_OUT` | Timings, read from tokens at call time. |

Not in Part 17, and left to Parts 18–20: every visual element (toast photo rise, name swap, swipe, the
scene's flag/word container, bust, score strip and commentary, and the plain DOM word stand-in), Rive,
and the dev-panel visibility of the stage. Part 18 should mount its stage renderer inside the shell. It
does not need to hold the director; the shell already does.

## Validation

| Check | Result |
| --- | --- |
| `npm run typecheck` | clean |
| `npm run lint` | clean |
| `npx vitest run --maxWorkers=1` | **554 passed**, 64 files (536 baseline + 18 new) |
| `npm run build` | passes |

New unit tests (`motion/moments/director.test.ts`, 16; plus 1 in `goalFeed.test.ts` and 1 in
`App.test.tsx`):

- **Four goals in one poll.** With match 3 open, match 3 plays a scene. The other three fold into one
  overflow summary. All four cues and the focus are set and one announcement is made. The scene closes
  at `goalHold`, leaves over 0.45 s, then the summary plays and the stage ends with no timers. With no
  match open, one toast plays and the rest become a summary.
- **A goal during an active scene.** It waits. A second open-match goal plays its own scene after the
  first, then a waiting toast plays. The hero follows the latest goal.
- **Hidden tab.** Nothing is delivered or announced, no mark is set and the store queue is empty. On
  return a single goal is delivered and toasted with a mark timed at the return. Several moments become
  one `away` summary that replaces the waiting queue, with the summary announcement. Through the app
  director, the list's `goalFeed` mark is withheld while `document.visibilityState` is hidden and set
  on return.
- **Overflow collapse.** At most two items wait, and later arrivals merge into the summary in order.
- **Restart during presentation.** Restarting during a scene, with items queued and held, gives
  `session` 1 and clears the stage, queue, held moments, cues, hero and announcement. No timers remain,
  the log restarts and nothing fires later. The same event id then plays again as a scene. `goalFeed`
  also clears on restart and accepts the repeated id. The existing follow-card restart test passes
  through the new path.
- **Further behavior.**
  - Dedupe holds through normal consumption.
  - The followed match gets a scene, and a red card gets the red scene with its beats.
  - A covered match or reduced motion gets a toast.
  - A scene replaces a toast.
  - Tap shows the whole scene and then closes it; hold works.
  - A disallowed goal withdraws its waiting goal.
  - Hold tokens are read at start.
  - Stop/start behave as expected.
  - In the app, the open match's goal plays a scene and fills the polite region with
    “Goal for Arsenal, Saka, 61'. Arsenal 2–0 Chelsea.”

**Browser suite.** The full production suite ran once with one worker and zero retries: 183 cases,
5.7 min, **163 passed, 13 skipped, 7 failed**. The 13 skips are the same as at M2.

- **Caused by this part, now fixed.** `nav.spec.ts` “focus follows navigation” failed at 900 and 1280 in
  a strict-mode violation: `[aria-live="polite"]` matched both the title region and the new moment
  region. The moment region now uses `role="status"`. The test was not edited. After the fix, that test
  passed at all three widths on one targeted run (3/3), and the App unit tests, typecheck and lint pass.
  The full suite was repeated on the final commit; see below.
- **Baseline failures, unchanged and not investigated.**
  - `lineup.spec.ts` “markers rise line by line, forwards first” failed at 390, 900 and 1280. This is the
    same failure as in the M2 report.
  - `nav.spec.ts` “each pane keeps its own scroll” failed at 900 and 1280 (expected 300, received 0).
    This is the same intermittent pane-scroll symptom reported in Parts 15 and M2. It passed in the M2
    run.

**Final-commit rerun (`8bae35d`, after the live-region fix).** Full production suite, 1 worker, 0 retries, 183 cases, 5.3 min: **166 passed, 13 skipped, 4 failed**. No new failures.

- `nav.spec.ts` “focus follows navigation” passes at all three widths (the Part 17 regression is fixed).
- Pre-existing, all in the M2 / Part 15 reports: `lineup.spec.ts` “markers rise line by line, forwards first” at 390, 900 and 1280 (same as M2); `nav.spec.ts` “each pane keeps its own scroll” at 900 only (intermittent; failed at 900 and 1280 in the earlier Part 17 run and passed at both in M2). Neither touches the moment code, and neither was investigated or changed.

**Live check.** In the production preview at 390 × 844 (`/match/1/facts?demo=fast`), the moment region
announced the demo's goals as they happened (for example “Goal for France, Olise, 62'. France 3–1
Argentina.”), with no page errors.

## Bundle

Initial production JavaScript: **213.60 KB gzip** (index 180.08 + domain 20.06 + UI 13.10 + runtime
0.36). The baseline at `59dfd4e` was 210.48 (index 176.96), so this part adds **+3.12 KB**. The 180 KB
budget was already exceeded and still is. The lazy `data` (11.72) and `demo` (7.59) chunks are
unchanged.

## Remaining gaps

- Part 18 has not built any visual element, so nothing is visible on screen yet. Only the aria-live
  region and the list's marks change for users. The goal-mark choreography is unchanged when visible;
  it is now deferred while the tab is hidden.
- A stage that is already playing when the tab is hidden keeps its timers; browsers throttle them. Only
  new presentations are held.
- `followedMatchId` is the followed player's team's match (the legacy follow is team-based). It does not
  check whether he is on the pitch.
- The hero cue is set on delivery for the open match whether or not that match is covered. The hero is
  hidden under a phone player layer anyway.
- Known baseline issues from the M2 report remain: the line-up entrance test, the intermittent pane
  scroll cases, the 2× hero preload gap and the bundle budget.
