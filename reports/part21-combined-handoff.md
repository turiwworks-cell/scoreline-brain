# Scoreline: combined motion and Rive updates

Branch: `codex/scoreline-all-updates-2026-10-06`.

This is a merge of both complete histories:

- `claude/wonderful-mayer-gm57i5` at `fae77ccdbbbe800d80054d1b5a0ce1879712d0f0`: smooth slide transforms, settled text, reduced motion, and the existing client-demo/performance work.
- `codex/part-21-startup-and-lcp` at `06d40109e64190e62dab174c6f173a859e7c4355`: Live as the initial state, updated Live artwork and synchronized hover light, the matching first-frame still, scroll-hover suppression, and the updated Moments export with the headline rise drawn inside Rive.

The source branches remain intact. Download this integration branch rather than either individual branch to get both sets of changes.

## Integration resolutions

The goal word keeps the prewarmed shared Rive instance and uses the new stationary canvas and Rive layout bounds. Its surface measurements and resize notifications read the borrowed drawing canvas rather than React's hidden placeholder. The prewarmed instance uses AlwaysDraw so layout-only changes remain visible.

The word-stage module loads after the Rive gate opens, alongside the existing lazy word chunk. Cleanup prevents a late import from creating a stage after its owner has gone away. This keeps the initial JavaScript under the existing 180 KB limit.

Tests that intentionally toggle Live from off start with `live=0`. The no-data startup test retains `demo=off`; the default app still runs the demo.

## Validation

- Typecheck passed.
- ESLint: no errors; two existing warnings in RiveCanvas's effect dependencies and the live-host verification fixture.
- Unit tests: 713 passed, including borrowed-surface sizing and lazy-stage cleanup regressions.
- Production build passed.
- Initial JavaScript: 179.78 / 180 KB gzip.
- Live artwork/light browser checks: 6 passed at phone, tablet and desktop widths.
- Goal/red-card/toast browser checks: 24 passed, including repeated scenes using one shared word instance.
- Main browser suite: 239 passed, 25 skipped on the full run. Five checks still used the old Live-off default; the six focused default-state checks all passed after the test setup was corrected. One tablet player settled-state check timed out under the full-run load; it passed three separate repeats without code changes. All 245 non-skipped cases therefore have a passing result; this was a full run plus focused reruns, not a second full-suite run.

Browser checks use Chromium 153 with the software GPU path for Rive.

## Open the download on Windows

Close the previous Scoreline terminal, extract the entire ZIP into a fresh folder, and double-click `Open-Scoreline.cmd`. Keep that terminal open. The first run installs the locked dependencies. Use the URL it opens, rather than an older localhost tab or bookmark.

## Scope

This integration includes all changes in the two source branches. It does not add the separate rework for layout-driven height/width motion, SVG momentum goal markers, or the followed-player red-card shake noted in the motion handoff.
