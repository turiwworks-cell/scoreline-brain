# Part 14: Player view

Status: built, checked and pushed, **waiting for your review**. No PR, no merge. `main` and every other branch are untouched. Part 15 not started.

- Branch: `claude/part-14-player-view`, from `claude/part-13-lineup` at `c85a229` (includes Parts 11, 12, 13)
- Final commit: the commit that adds this report (hash given in the reply)

## What is built

The Lua player view (`legacy/scoreline_11.luau` 5845–6179) in `src/features/player/`, replacing `PlayerPlaceholder` (deleted with `placeholderBust.ts`).

| Piece | File |
|---|---|
| Hero 280×350 at (55,90), cut at 318, line of light at y 399.17, giant shirt number, two soft lights, blurred bloom, hairline | `layout.ts`, `Scene.tsx` |
| Sticky 96 px bar: back/close, crest + team, follow star; frost glass copy of the number and photo on scroll | `Bar.tsx` |
| Info (first name, surname + shirt number, role · team), facts row, "This match" block (rating glide 6.0→value, tags, bars with glide fill and count-up, not-played note) | `Sheet.tsx`, `model.ts` |
| Entrance, scroll vars (`--sy`, arrows fade; no React renders on scroll), prev/next stepping | `motion.ts`, `PlayerView.tsx` |
| Route wiring, match context, follow, back | `app/screens/PlayerScreen.tsx`, `PhoneStack/MatchPane/ThreePane` |

Text placement follows the Lua baseline rule (`cy + 0.3485·size`); soft-light radii are the Lua's halved because our stops end at half. Timing uses the existing `player` token and `cascade`. No new animation engine.

### Face to bust

Part 9's flight engine, extended with a "window flight" (`src/motion/flight.ts`, `geometry.ts`): when both ends hold a photo, one picture copy moves with translate/scale and is cut with `clip-path: inset`, interpolating the image rect and the visible window measured from the DOM. The face keeps its framing and grows into the bust at the right place; the face end is a static copy that fades. Without photos at both ends the old cross-fade is used. Verified numerically (end state translate(55,90), scale 1, bottom inset 40.87 = 350 − 309.15) and in the recording (`part14-screens/part14-open-return.mp4`, 390 px, line-up → player → back) and filmstrip.

### Photos

Bust assets only (AVIF, WebP, 288w/576w via `photoProps`/`sourcesOf`), never the head asset, nothing upscaled. Hero is eager, held until the manifest loads; the follow card and others lazy. FRA and ARG real photos; other teams, a missing manifest entry or an image error show the kit disc. The follow card now also shows real busts (change outside Part 14, needed so its flight has a photo).

### Navigation

Entry points verified in e2e at 390/900/1280: line-up, follow card, match-list hero scorer (and direct links `/player/<team>/<n>`; Italy 10 shows "Not started", unknown team "Not found"). Back/close restores focus and the underlying match/tab; on three-pane back falls to the insights pane and still restores focus. Prev/next arrows replace the history entry (state `step`), glide 36 px × dir over 0.5 s, no flight. Routing stays in the app layer.

## Checks

| Check | Result |
|---|---|
| `tsc -b` | clean |
| `npm run lint` | clean |
| vitest | 501 passed (479 + 22 new), 58 files |
| `npm run build` | ok; initial JS **207.59 KB gzip** |
| Browser suite, once, 1 worker, 0 retries | **159 passed, 1 skipped, 2 failed** |

Bundle: 201.83 → 207.59 KB gzip (+5.76 KB); budget 180 KB still exceeded (as before). PlayerView is not code-split: a Suspense fallback would break the flight. Option for later: preload the chunk on press.

Failures: only the baseline "each pane keeps its own scroll" at 900 and 1280 (expected 300, got 0, `nav.spec.ts:174`), unchanged from Part 13. Not investigated.

New e2e `e2e/player.spec.ts`: 9 tests × 3 projects: geometry, photos vs kit disc, line-up open/back with flight and focus, follow card and hero scorer entries, arrows, frost/arrow fade on scroll, direct links, clock tick does not rebuild the hero, reduced motion (nothing flies).

## Measured vs judged

Measured (Playwright boxes, e2e): hero 280×309.17 centred at y 90; hairline y 399.17; info y 456 h 92; facts y 548 h 68; match block y 646.
Judged visually (`lua-vs-ours-pane3.png`, Lua left, ours right, both with kit discs at 1280×892): crest and label, star, disc, line of light, name block, facts row, "58 MIN", goal tag, bars at 34 and 80%. Layout matches; our pane is slightly wider because the temporary three-pane demo differs. Fonts render with the same stack so glyph shapes agree; I did not pixel-diff.

## Changes outside Part 14

- `playerStats` / `playerFlags` / `onPitch` moved to `src/domain/playerStats.ts` (re-exported from `follow/model.ts`); `selectPlayers` added to selectors.
- Flight engine extended (window flight, `isFlying`).
- Follow card, picker, list: `PhotoOf` returns sources; `ListPane` loads the manifest.
- `Shell.module.css`: `.base { isolation: isolate }`. A directly linked player screen was drawn under the list's sticky header (Part 9 stacking bug).
- `nav`: `step` in history state, `stepPlayer`, `planFlights` skips flights when stepping.

## Default decisions

- Bars show only provider numbers (touches, pass accuracy, shots); keepers get touches and pass accuracy. No duels, chances, saves (not in contract v2).
- Age computed against today, not the Lua's fixed date.
- A missing match hides "This match".
- Hero entrance without a flight: opacity plus 0.9→1 scale, as the Lua.
- Frost bar uses the frost assets.

## Remaining gaps

- Hero 2× photo not preloaded on press; at DPR 2 it may pop in mid-flight.
- Initial JS over budget (see above).
- Desktop still the temporary three-pane demo; pane 3 works, no desktop composition designed.
- `placeholder.module.css` keeps unused player rules.
- Lua comparison only possible with kit discs (the Lua has no photos).

## Screens

`reports/part14-screens/`: `390-hero-sheet-kitdisc.png` (hero, sheet scrolled, Italy kit disc), `900.png`, `1280.png` (pane 3), `lua-vs-ours-pane3.png`, `flight-filmstrip.png`, `part14-open-return.mp4`.
