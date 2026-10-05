# Part 21: the client demo, handoff

Branch `claude/hopeful-lovelace-ji05gb` (merged into `main`). Start-up and LCP (#5, #4) are in
[`part21-startup-and-lcp.md`](part21-startup-and-lcp.md); this covers what came after.

## Run it

```
npm ci
npm run build && npm run preview          # http://localhost:4173/      the demo matchday
npm run api                               # second terminal: the stand-in backend on :8787
                                          # http://localhost:4173/?api  the app over HTTP (ApiSource)
```

`npm run dev` (or `Open-Scoreline.cmd` on Windows) serves the same at :5173 with the dev panel
(goal / red card triggers, Pause). `/?demo=fast` plays the evening at 10×. `/?demo=off` is the
page with no source ("No matches yet").

## What changed

| Item | What | Proof |
| --- | --- | --- |
| #11 motion | Every Facts event row cascades in (only the first did); "Show all" fades its new rows in. All `initial={false}` sites audited. | `e2e/entrances.spec.ts`, `Screen.test.tsx` |
| #10 design | Ported text checked against the Lua's baselines: every measured line within ±1.02 px; nothing needed moving. Chromium's whole-pixel rounding of font ascent/descent (up to 1 px) is an **accepted limitation**, documented in ARCHITECTURE §6, not compensated in the design. | `e2e/baselines.spec.ts`, `verification/moments/baselines.spec.ts` |
| #3 feel | A tap paints the screen's shell first; the tab body follows after that paint (navigation still renders in the tap). Covered screens turn inert a frame later; scroll memory no longer forces a layout in the commit. | `inp.mjs` 3.6×, no Rive: open a match 400–424 → 240–272 ms, Lineup 320–560 → 104 ms, open a player 330–500 → 340–380 ms |
| #6 goal moment | One Rive goal word for the session, made at idle while a match is live, lent to each scene and handed back (no `new Rive` or file parse inside a scene). | `src/rive/wordStage.test.ts`; moments suite: goal, goal, red card in a row each draw the Rive word from the one instance |
| API simulation | `scripts/mock-api.mjs`: the demo's evening served as the contract: `/api/feed` (ETag, 304), `/api/events` (SSE, `Last-Event-ID` resume), `/api/trigger`. `?api` runs the real `ApiSource`. | `e2e/api.spec.ts`; DATA-CONTRACT §8 |
| Root entry | `/` plays the demo instead of showing "No matches yet". | `e2e/shell.spec.ts` |

## Verification at hand-off

- `npm run check`: typecheck, lint (one pre-existing warning in `verification/rive/live-host.tsx`),
  692 unit tests pass. Initial JS 179.82 / 180 KB (the guard is unchanged).
- Final run, once each, after the fixes below: Playwright main suite 242 passed, 25 skipped,
  0 failed (3 viewports); moments suite 24 passed. Earlier full runs each had 2–3 different
  intermittent failures under load; the ones traced to a cause are fixed below. That this run was
  clean does not prove no flake is left.
- Test fixes in the last round (each was read from its error, not rerun until green):
  - `nav.spec` "each pane keeps its own scroll": a real bug from #3. A scroll and a tap in the
    same frame saved the list's position from before the scroll. Fixed: the position is read in
    the next frame's callbacks.
  - `insights.spec` (desktop): the desktop preloads the Insights chunk after the first paint by
    design, so "never requested" raced it. The test now holds that chunk and checks the player
    page renders without it; phone and tablet still check it is never requested.
  - `player.spec` "a clock tick does not rebuild the hero": the helper accepted the loading
    screen's heading, so the photo could be captured before it existed. It now waits for the bust.

## What remains (known, not fixed)

- **INP budget (200 ms at 3.6×)** is not met everywhere: open a player ~340–380 ms, Live on
  290–420 ms (live cards' layout), Stats ~200–256 ms (input delay from the demo's ticks). Open a
  match and Lineup improved most.
- **Desktop direct link to a player** (`/player/fra/10` opened cold): the name replaces
  "Loading…" ~150 ms later than before the last commit (400–480 vs 290–350 ms). The chunk graph
  changed when the API source was added. The `/` start-up is unchanged (first rows ~250 ms both).
- **Rive in software GL**: with Rive on in this container, scene frames are 260–320 ms because
  Rive draws each frame in SwiftShader. Creating the word no longer adds to them; it now runs once
  at start-up idle (416–559 ms idle callbacks, with the Live icon's). A phone's GPU won't pay
  this; it has not been measured on a device.
- From the start-up report: Lighthouse simulated LCP ~2.2 s, applied LCP ~3.8–4.0 s (the photo);
  a 300-match first feed's validation is 385–535 ms.
- The stand-in backend runs locally only; a static host serves the demo (`/`), not `?api`.
- Not done here: real devices, VoiceOver/TalkBack.

## What to look at

On a desktop browser (1280 wide or more):
1. `/`: the list, the match pane and Insights appear without a jump; the day tabs settle.
2. Open a match, switch Facts → Stats → Lineup → Table: each body slides in; Facts' events cascade
   row by row; "Show all" fades the extra rows in.
3. Lineup → a player: the bust grows in at the centre; back returns focus to the chip.
4. With `npm run dev`, the dev panel: goalHome, then goalHome again, then redHome. Each scene's
   word is the Rive word (no swap or shake in mid-word), and the pause before the rise is there.
5. `/?api` with `npm run api` running: the same matchday arrives over HTTP;
   `curl -X POST "localhost:8787/api/trigger?name=goalHome"` plays a goal scene.

On a phone (or 390 × 844 in device mode):
1. `/`: header and day tabs, then rows; Live on and off (one tap toggles once).
2. Tap a match: it pushes in from the right with its header first, the body under it.
3. Lineup: markers rise line by line, forwards first; tap a player, then back.
4. A goal in France – Argentina (wait for one at `/?demo=fast`, or use the dev panel):
   full-screen scene, a first tap shows it all, a second closes it.
