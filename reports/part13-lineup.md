# Part 13: Line-up

Status: built, checked and pushed, **waiting for your review**. No PR, no merge. `main`, `codex/part-11-12-integration` and every other branch are untouched. Part 14 not started.

- Branch: `claude/part-13-lineup`, from `codex/part-11-12-integration` at `80778c7` (Parts 11 and 12 with the momentum chart)
- Final commit: the commit that adds this report (hash given in the reply; a file cannot name its own commit)

## What is built

The Lua's Lineup tab (`lineup`, `squadList`, `pitchMarker`, `teamSwitch`, `playerRow`, `coachRow`, luau:5384–5697, formations luau:2320–2345) in `src/features/match/lineup/`, mounted by `MatchDetail` in place of the Part 9 faces. `app/screens/LineupPlaceholder.tsx` is deleted.

| Lua | What | File |
|---|---|---|
| formRows, slotRow, slotLine (2320) | formations as rows, keeper first; slot → row / place | `formation.ts` |
| lineup pitch (5478–5602) | glass 540 tall, light, stripes, lines, rows evenly spaced, spacing capped at 116, plates at 92 | `formation.ts` (`pitchLayout`), `Pitch.tsx` |
| pitchMarker (5384) | photo behind a glass name plate; rating, off capsule, goals/assists, cards as stickers; kit disc without a photo; half strength when sent off; star for the followed player | `Marker.tsx` |
| markers rising (5597) | forwards first, then each line down; `lineup` timing token, delay + fromTop × stagger + (i-1) × stagger × 0.25 | `Marker.tsx` |
| teamSwitch (5455) | glass pill, thumb slides (`tabs` timing) and takes the nearer team's colours at the middle, letters roll on press, hover light | `TeamSwitch.tsx` |
| playerRow (5504) | 64 px rows: photo tile, number, name, role, tags; substitutes who came on show minute, rating, "for X"; others "Unused" | `PlayerRow.tsx` |
| coachRow (5548) | photo tile or an initials disc, name, "Head coach" | `Coach.tsx` |
| squadList (5516) | before kick-off: note, squad by line, coach | `Lineup.tsx` |
| events → tags (2433) | goals, assists (VAR-cancelled goals excluded), cards, on / off / replaced | `model.ts` |

Every player is a `<button>` that calls the existing `onOpenPlayer(player, from)` boundary. The button carries the `chip-<team>-<n>` focus key and a `Shared id=player:<team>:<n>:photo end="face"` around the face, so Part 9's flight, focus return and the underlying match / tab context work unchanged. The side shown (home/away) lives in `MatchDetail` for as long as the match is open, as the Lua's `luSide`.

### Photos

- `src/ui/photoManifest.ts`: one `fetch` of `public/img/players/manifest.json` for the whole app, started by the first screen that asks (`usePhotoManifest`), shared afterwards, reduced to paths. `playerPhoto(manifest, team, n)` and `coachPhoto(manifest, team)` return `photoSources()` objects (one object per path, so memoised photos get stable props). No per-player manifest request.
- FRA and ARG: AVIF ahead of WebP, `288w`/`576w` bust files, which `PlayerPhoto` already sizes. Other teams: the kit disc. Head assets are not used (the Lua cuts the face from the bust), so nothing is upscaled.
- Pitch photos are `loading="eager"`; the substitutes' and coach's are `loading="lazy"`. The entrance waits for the manifest the first time (one small request) so a kit disc never swaps to a photo mid-rise; later opens start at once.
- Coach: `PlayerPhoto` gained `coach` (a photo shows at n = 0), `loading` and `onFail`. A coach without a photo, or whose file fails, gets the initials disc.

## Checked against the Lua

The Lua ran in `legacy/Scoreline_Fixed.html` (desktop layout, middle pane = the 390 px match screen). The page has **no photos**, so its pictures are kit discs; the app side of every comparison is rendered with the manifest held back, so both show kit discs. Images are in `reports/part13-screens/vs-lua/` (app left, Lua right).

**Measured** (DOM boxes, asserted in `e2e/lineup.spec.ts` at 390, 900 and 1280, ±1.5 px, relative to the match screen):

| Measure (France – Argentina, 390) | Lua | Here |
|---|---|---|
| tab bar top → switch | 22 under the rule: y 426.9, 46 tall, x 18 / 18 | same |
| "Formation" heading | 22 under the switch | same |
| pitch | 27.7 under the heading, 354 × 540 | y 522.6, same |
| plate centre lines (5 rows) | 506, 404, 302, 200, 98 from the pitch top | same |
| marker box | 76 × 84, plate centre 65 under its top | same |
| back four spacing | (354 - 16) / 4 = 84.5 | same |
| Substitutes heading / first row | pitch + 540 + 34 / + 27.7, rows 64 | same |
| squad: note / first heading | 52 tall, 22 under the switch / 30 under it | same |

The same numbers hold at 900 and 1280. Pixel difference of the pitch region against the Lua (greyscale, 0–255): mean 3.1–3.3 for live, finished, away and squad views, about 2 % of pixels differing by more than 40 (text anti-aliasing and the fonts' sub-pixel placement). The one unmatched view is Japan's squad: the Lua capture of it missed the click, so no Japan-vs-Lua image is claimed.

**Visual judgement** (not measured): the pitch light matches once drawn at half the Lua's radii (its stops end at half the radius, luau:3325; the follow card does the same). Name baselines are within a pixel of the Lua's (zoomed crops). Hover and press light were checked by eye only.

## Checks

| Check | Result |
|---|---|
| typecheck, lint | clean |
| unit and component tests | **479 passed** (424 baseline + 55 new: formation 15, model 12, manifest 5, Lineup 23) |
| verification fixture typecheck | clean |
| production build | passes; initial JS **619.5 KB raw, 201.83 KB gzip** (baseline reproduced on `80778c7`: 605.5 / 196.90). **+4.9 KB gzip**; budget 180 KB, still over |
| `e2e/lineup.spec.ts` (new), 390 / 900 / 1280 | 30 passed |
| full browser suite, one run, one worker, no retries | **132 passed, 1 skipped, 2 failed** (5.0 min). The two failures are the baseline's "each pane keeps its own scroll" at 900 and 1280 (`nav.spec.ts:124`, expected 300 received 0), unchanged and not touched. The total is above the baseline's 105 because of the 30 new lineup tests (less the removed placeholder test) |
| case-only filename collisions | none |

`e2e/lineup.spec.ts` covers the geometry above, tags (rating, best star, goals, off capsule, follow star), the switch and its entrance, marker order (forwards first), no rebuild or replay on a clock tick, photos (sources, eager/lazy, one manifest request per page load, kit disc for other teams), chip → player → back with focus, the squad before kick-off, no horizontal overflow, reduced motion. Unit tests cover every demo formation (3-4-2-1, 4-2-3-1, 4-3-3, 4-4-2), team switching, tags, photo fallback and navigation callbacks.

Baseline failures: the two "each pane keeps its own scroll" failures (900 and 1280, expected 300 received 0) are documented in the integration report; both recurred in the one full run, exactly as in the baseline, and are not caused by Part 13 (the same test fails the same way on `80778c7`). Nothing was weakened or re-run to change a result.

## Screens and recording

In `reports/part13-screens/` (settled, 2×): `390-france-pitch-top|bottom`, `390-argentina-pitch-top|bottom`, substitutes (`-subs`) and coach (`-coach`) for both, `390-sweden-4-4-2`, `390-england-4-2-3-1`, `390-italy-squad`, `-mid`, `-squad-coach`, `390-japan-squad`, `900-lineup`, `1280-lineup`. `390-lineup-recording.mp4` (18 s): open from the list, formation rises, switch to Argentina and its entrance, tap Messi (face flies to the Part 14 placeholder), back, scroll to the coach. Chromium headless on Linux: not a real-device frame rate.

## Changes outside Part 13

1. `MatchDetail` no longer takes a `lineup` node; it mounts `Lineup` and takes `followed`. `MatchScreen` passes the followed player from the existing preference (`useFollowed(followPref(...))`, exported from the matchList barrel). New `app/followed.ts` holds the demo's default followed player that `ListPane` used inline.
2. **Fix to Part 11's `useWidth`**: the width was only measured if the screen's element existed on the first render. On a deep link the feed arrives later, so at 900 and 1280 the screen laid out at 390 forever (`--w: 390px` on a 407 px pane). The pitch depends on the true width, so the measure now re-runs when the match appears. It also corrects the hero's scorer wrapping and match-info tiles in that case.
3. `Star` moved from `features/matchList` to `src/ui` (the line-up needs it too; features may not import each other). Same code.
4. `PlayerPhoto`/`PhotoTile`: new optional `loading`, `coach`, `onFail` props. No change for existing callers.
5. `e2e/match.spec.ts`: the "Lineup keeps its placeholder until Part 13" test is removed (replaced by `lineup.spec.ts`). `placeholder.module.css` lost the lineup rules. No assertion in an existing test was changed.

## Default decisions

- Initial side is home, reset when another match opens; not set from the followed player (the Lua does that only when a player page is opened from the list, which is Part 14's concern).
- A formation that does not add up to the eleven sent is drawn as 4-3-3 and the label shows what was sent; players beyond eleven are ignored.
- A coach is the team's `coach` string; initials are the first letters of the first and last word. A team with no coach string has no Coach section (as the Lua).
- Rating shows for starters and substitutes who came on (or have minutes from the provider) once the match has started; best = first of the eleven with the highest rating, only when someone has one.
- Goals VAR took back (`cancelled`) count for nobody in the tags.
- Arrow keys move between the two sides (radio group), not in the Lua.
- Hover light on the name plate follows the marker as a whole; its spot position is the marker's, not the plate's (judgement, not the Lua's exact spot).
- Lineup is not code-split: it would take about 5 KB gzip back out of the initial bundle at the price of a first-open chunk load. Say if you want it.

## Remaining gaps

- Initial JS is over the 180 KB budget (baseline already over; +4.9 KB here).
- The Lua has no photos to compare, so photographed rows are judged by eye; the Japan squad has no Lua image.
- The player page is still Part 9's placeholder (Part 14). The desktop three-pane shell is the temporary demonstration and is unchanged.
