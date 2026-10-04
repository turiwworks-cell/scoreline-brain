# Part 20 — replacement Live export check

Date: 2026-10-04. Branch: `codex/part-20-moments`.
Status: **replacement rejected for production; editor correction required**.
Moments remains accepted. No merge, deployment, Part 21 work or Opus review was performed.

## Received and reconstructed file

The attachment surface could not deliver the uploaded file to `download_file`; Windows shell execution also failed while preparing the managed sandbox. The user's locally generated Base64 text was uploaded through the native file-transfer channel and read successfully. Its 31,492 characters decode to exactly **23,618 bytes**, matching the supplied .riv size, with header `RIVE`.

- SHA-256: `dc9fca69ccb706f06a675ab891df99cf981c55f381541e221376231453df535e`.
- Git blob: `f448eb6890f40f5831e4bdc0b98e484ca0a9205d`.
- Diagnostic candidate: `verification/rive/exports/live-icon.candidate.riv`.
- The conservative 60,000-byte budget passes.
- Embedded DM Sans SFNT inspection: offset 128, 21 tables, **23,016 bytes**, 38 glyphs. The font has been reduced from the original 240,164-byte font.
- No script, animation or serialized bytes were edited during recovery.

Passing a size budget is separate from exporting the correct artwork and View Model.

## Actual Chromium runtime result

[Focused run 37188191878](https://github.com/turiwworks-cell/scoreline-brain/actions/runs/37188191878), commit `fd20e7af5979a58c9790e7b26e073b0deaea82a8`: **0 passed / 3 failed**.
The candidate loads without a runtime load error at all three viewports, but each case fails the required View Model contract before attempting count or toggle changes.

The real runtime reports:
```json
{
  "artboards": [{
    "name": "font",
    "animations": ["Timeline 1"],
    "stateMachines": [{"name": "State Machine 1", "inputs": []}]
  }],
  "bounds": {"minX": 0, "minY": 0, "maxX": 117, "maxY": 50},
  "properties": null
}
```

The original probe omits `properties` because the default bound View Model is undefined; `null` above documents that absence. It does **not** mean the file cannot contain any global View Model definition. The strings `count` and `islive` occur in the received bytes, but they are not exposed by a default instance on the exported artboard.

Only the helper artboard `font` is exported. The full button (expected editor artwork 443 × 152) is not available for the host to select. Enlarging the helper or changing the host's fit cannot recover the absent main artboard.

Count pixel comparisons, rapid-toggle checks and post-toggle count checks were **not reached** for this candidate. They are not reported as successful. The focused workflow captured failure screenshots as its `part20-corrected-live-evidence` artifact; no visual review of those screenshots is claimed in this report.

## Code and verification changes

- A candidate-only source switch on the inspection page preserves the original Live diagnostic test.
- A new acceptance test requires a default Boolean `islive` and String `count`, one main artboard, and a button-shaped aspect ratio.
- After those guards pass, it will compare real calendar pixels for `0/3/12/99`, restore `0`, test off/on drawing, perform twenty rapid updates, and verify the final calendar text image. View Model value readback alone is insufficient.
- A focused workflow captures failures separately at phone, tablet and desktop sizes.
- The existing full workflow records byte budgets and SHA-256 fingerprints.
- Production source code, `rive/moments.luau`, the accepted Moments binary, and reference choreography are unchanged.

## Full regression run

[Run 37188118083](https://github.com/turiwworks-cell/scoreline-brain/actions/runs/37188118083), candidate-test commit `36db70cf1c0bb45e1d41272c60c4cf4152800e7d`: **failure**, specifically because the three new replacement-asset acceptance cases reject the helper export.
- TypeScript check, ESLint, production build and reference comparison passed.
- **608 / 608 unit tests** passed.
- **15 / 15 scene browser regressions** passed.
- Actual-runtime suite: **9 passed / 3 failed**. The nine previously established signed Moments/original-Live/lifecycle cases pass; the three new candidate cases fail at the default View Model guard.
- The CI SHA-256 and 23,618-byte size match the reconstructed candidate exactly.

The original Live lifecycle diagnostic still uses the original over-budget file (`diagnosticIcon: true`), not this rejected candidate. Its heap results do not certify candidate lifecycle behavior. This follow-up does not change the accepted Moments export.

No test was skipped or relaxed to make this incorrect export pass. The final documentation commit records these results without starting another redundant run.

## Installation decision and editor handoff

`public/rive/live-icon.riv` remains absent. The app continues to use its complete DOM fallback. The original large export and this replacement are retained only as explicitly named diagnostic evidence.

The user must select the **main full-button artboard** in the authoring project, enable its Component/export state, make it the default artboard with its existing state machine, and bind its Model/default instance to the View Model containing `islive` and `count`. The helper `font` artboard must remain ordinary/unexported while retaining its glyph-coverage text. Keep the animation and font subsetting unchanged.

Follow the updated [simple editor correction guide](../rive/LIVE-EXPORT-FIX.fa.md), re-export independently, and provide the replacement. Acceptance remains pending until the main artwork, bindings, byte budget and real-runtime checks pass.
