# Part 20 — standalone word moments

**Historical extraction report.** Signed Moments export validation and the current Live correction status are recorded in [part20-editor-exports.md](part20-editor-exports.md). The status and evidence below describe the initial handoff before editor exports were received.

Status: **code and editor handoff complete; signed exports and web-runtime acceptance pending**.
This is not a completed M3 asset acceptance or an integration approval.

Base: `0f9253491bc3c68625df54dd9f1de62f2091e9d6` on `codex/part-19-rive`.
Implementation branch: `codex/part-20-moments`.
Validated app source: `8a59376b3ae3c12b7fcbf9bd31c430abbf2dcaab`.
No merge, deployment, Part 21 work or Opus review was performed.

## Changes
- `rive/moments.luau` is one standalone Node Script. It extracts `shoutWord` and
  `slamWord` unchanged apart from the self type, plus their necessary rendering/path/colour
  helpers. Reference comparison verifies the drawing functions after whitespace/type-name
  normalization, and all nine exact bold glyph definitions.
- Glyphs: space, A, C, D, E, G, L, O, R. No UI font table, photos, flags, card shape,
  scene wall, shake, flash, player data, scrolling, simulator or DOM choreography.
- The goal word is **GOAAAL**, exactly as in the reference; red is **RED CARD**.
- Preserves LAND and goal cubic curves, letter scaling/focus, gradient alpha quantization,
  25-stop soft light, pastel/luma colour maths, flare and glint. Red uses the reference
  three fixed red stops; the two team colours drive the goal.
- `play` snapshots kind/colours and resets internal time and phase. No goal delay of 0.1 s
  or red hit-plus-offset delay of 0.42 s is added: the host already applies these.
- View Model: String `kind`, Color `color1/color2`, Trigger `play`, Number `phase`.
  Phase starts at 0, changes to 1 after the LAST letter settles, then 2 when the word's
  effects finish. For red, phase 2 is deferred to the next advance so phase 1 is observable
  even across a large timestep.
- Completion keeps the final word visible and returns false from `advance`.
  Restart samples new inputs; there are no accumulated timers. One play listener is
  installed on init, retained with its View Model and removed before a re-init.
- Glyph/unit paths are built once per init. Paint and gradient dictionaries are frame-local
  immutable looks, preventing cache keys from growing over alpha, feather, colours or
  replay count. This bounds retained script caches; it does not prove native heap stability.
- `WordGraphic` maps the fixed **390×340** transparent artboard uniformly using the host's
  actual font size. It expands the canvas around the word's midpoint instead of fitting a
  tall artboard into a one-line box. Reference double-tracking widths are 3788 / 4493 font
  units; the source's centre/baseline relationship is preserved.
- `GoalWord` forwards the host size. `Scene` suppresses its duplicate goal flare and whole-word
  settle while the Rive word is active, restoring them on fallback. DOM rise/shrink, flag,
  card, scorer and scene lifecycle remain host-owned. `RiveCanvas` ownership was not rebuilt.
- `rive/EDITOR-GUIDE.fa.md` gives the complete Persian editor and separate Live export handoff.
  `verification/moments-script/` provides reproducible source, Luau and native CLI checks.

## Verification performed

| Check | Result |
| --- | --- |
| Reference functions and all 9 glyph definitions | Pass |
| Rive CLI 1.0.3 strict compile | 0 errors, 0 warnings |
| Six Luau lifecycle/cache cases | 6 passed |
| Real native CLI GOAAAL and RED CARD rendering | Inspected early and settled PNGs |
| Real native trigger replay after completion | Pass |
| 20 goal replays through real native VM/trigger/state machine | 20 phase-1 and 20 phase-2 transitions |
| 20 red replays through real native VM/trigger/state machine | 20 phase-1 and 20 phase-2 transitions |
| App TypeScript, ESLint, whole units, production build and focused browsers | CI result recorded below |
| Signed editor exports and their size | Pending user |
| Editor Preview acceptance | Not run |
| Real pinned web runtime JS/WASM/GPU memory | Not run; actual exports absent |
| Opus review | Not performed |

The six Luau cases execute the actual extracted source with native Rive graphics objects
but test doubles for View Model, Context notification and Renderer dispatch.
They test startup, no duplicate delay, phases, negative and large time steps, mid-play
restart, 20 alternating coloured plays, fixed path identity, at most 16 gradient / 24 paint
entries per frame in the exercised frames, one listener and re-init replacement.
Those cache and listener checks are not a heap test.

The native RML fixture then exercises the real View Model, script drawable, state machine,
trigger dispatch and renderer. Its transparent click hit area is verification-only.
For each kind, 20 clicks separated by 2 seconds completed all 20 showings.
There is no product pointer listener in the shipped script.

Observed at 60fps:
- Goal phase 1: 0.8667 s; phase 2: 1.6833 s.
  Analytic boundaries: 0.854 / 1.6772 s after trigger.
- Red phase 1: 1.1333 s; phase 2: 1.1500 s.
  Analytic last-letter boundary: 1.12 s (space keeps its original index).

A native CLI benchmark reported 0 → 0 WASM pages. Because this native path does not
provide a useful WASM heap reading, **no memory acceptance pass is claimed** from that output.
The Part 19 signed-asset Playwright acceptance remains necessary after both real files arrive.

## CI
First run: [37140897116](https://github.com/turiwworks-cell/scoreline-brain/actions/runs/37140897116).
TypeScript passed; lint had two callback-dependency warnings; units were 605 passed / 1 failed.
The failing pre-existing DemoSource complete-matchday case hit its 5000ms timeout under
parallel workers. Build/browser steps were consequently skipped.
The callback warnings were fixed. The validation workflow now runs the unmodified whole
unit suite with one worker, as Part 19's validated workflow does; no test timeout was relaxed.

Second run: [37141034271](https://github.com/turiwworks-cell/scoreline-brain/actions/runs/37141034271).
Typecheck/lint, 606 units, production build and reference extraction passed.
Browser regressions were 12 passed / 3 failed: all red-scene cases could not match the
headline separator. The PowerShell text-output transfer had replaced Unicode characters
in the saved Scene and Persian guide. This was a serialization mistake, not an animation
failure. Files were re-transferred as exact UTF-8 bytes; saved source and Persian guide were
compared against the local files and match exactly. Original separators and punctuation
are restored; no browser test was changed.

Final app-source run: [37141424842](https://github.com/turiwworks-cell/scoreline-brain/actions/runs/37141424842).
**Success**: TypeScript and ESLint passed; **606 unit tests passed**; production build and
reference extraction passed; **all 15 browser cases passed** at 390 / 900 / 1280 widths.
The browser suite asserts no page/console errors. These are DOM fallback scene regressions,
not signed Rive artwork tests. Unit output still emits a Scene/Words render-time warning in
the first-tap test; that test passes, and no broader Scene refactor was attempted.

## Outputs and next step
No fake/unsigned file has been installed in `public/rive/`.
The native verification fixture builds to **20,172 bytes**, including its test hit area;
this is NOT the signed editor export, and does not establish the 150 KB deliverable budget.

| Required output | Budget (conservative decimal bytes) | Current status |
| --- | --- | --- |
| `public/rive/moments.riv` | ≤ 150,000 | Script ready; signed editor export needed |
| `public/rive/live-icon.riv` | ≤ 60,000 | Separate export still needed; not produced or validated here |

User: follow `rive/EDITOR-GUIDE.fa.md`; make the 390×340 moments artboard, bind the default VM,
attach one script node at (0,0), add/default the Moments state machine, test both kinds,
and export the signed runtime file. Export the original Live icon into a separate file with
default bound Boolean `islive`; identify the actual artboard visually rather than relying
on the legacy name which failed Part 19's test.

Then supply both exports on this branch and rebuild. Run
`npx playwright test -c playwright.rive.config.ts`, verify byte budgets, check actual
word size/glint/flare at phone/tablet/desktop, twenty scenes, background/offscreen pause,
cleanup and real JS/WASM heap. Those are asset acceptance steps, not work completed here.

The script uses the reference defaults (duration 0.7 s, speed 1). The five-property contract
does not communicate live dev-panel duration/curve/speed changes to the word asset.
Mid-scene host time jumps continue to use Part 19's DOM fallback; there is no new scrub input.
