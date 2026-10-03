# Part 20 — signed editor exports and final runtime checks

Status: **Moments export accepted; corrected Live export pending**.
Implementation branch: `codex/part-20-moments`.
Validated functional commit: `8032297b40f167b885a5fe5740304fe56eb6cee2`.
The final reporting commit changes documentation only. No merge, publication, Part 21 work or Opus review was performed.

This follow-up supersedes the export-pending status in [the original extraction report](part20-moments.md).
Editor instructions: [Moments guide](../rive/EDITOR-GUIDE.fa.md) and [Live correction guide](../rive/LIVE-EXPORT-FIX.fa.md).

## Received exports

Both files were read from the user's local `moments.zip`. The signed Moments export was installed without modifying its bytes.

| File | Bytes | Conservative budget | Current location / decision |
| --- | ---: | ---: | --- |
| `moments.riv` | 18,100 | 150,000 | `public/rive/moments.riv`; accepted |
| `live-icon.riv` | 243,688 | 60,000 | `verification/rive/exports/live-icon.original.riv`; diagnostic only |

SHA-256:
- Moments: `9a979035d9722e59ef2ad38f544e5fe4a2c91af7ba1c27f307b553574085d643`.
- Original Live: `1ba9ac9c7312137a4667d94a8a5746a51d95d6de643b575eec62449c19581f76`.

There is deliberately no production `public/rive/live-icon.riv` yet. The app continues to use its working DOM Live button until an export meets the budget and binding contract. The original diagnostic file is not copied into the production asset directory.

Moments contains one `Moments` artboard with bounds 390 × 340, one `State Machine 1`, one timeline, and exactly the required properties: String `kind`, Color `color1`, Color `color2`, Trigger `play`, Number `phase`. Runtime loading and drawing succeeded with the editor's script signature. No unsigned CLI fixture was shipped.

## Full Live button is preserved

The supplied Live animation includes the capsule, outer button, dot and calendar/count artwork. These animate together; **do not delete them or their timelines/state machine**.
The host now supports this entire button rather than drawing a second outer frame/count over it:
- Fixed artwork ratio 443 / 152 at a CSS height of 38 px.
- The DOM button still owns keyboard interaction, focus, accessible name and `aria-pressed`.
- Native artwork replaces the DOM artwork only after binding succeeds. Failure or a missing property restores the complete DOM fallback.
- `LiveGraphic` requires Boolean `islive` and String `count`. It updates both as props change, suppresses its own Boolean echo, and removes the listener during cleanup.

The original export contains only Boolean `islive`; the calendar number `12` is static. It cannot correctly represent the host's changing count. Native diagnostic tests confirm that Boolean changes animate the supplied artwork, including the author's hidden calendar in the live state. They do not certify a count binding that the original file does not have.

Binary inspection found a 240,164-byte embedded variable DM Sans TTF font with 21 SFNT tables. It accounts for nearly all the 243,688-byte file. The export does not contain the large whole-app script seen in the old editor asset list. No serialized binary or animation was manually rewritten to reduce the size.

Required editor correction: preserve the 443 × 152 artwork and all its motion; add String `count` to the default View Model instance and bind the calendar Text Run; use font **Glyphs used** with the same-font `Live 0123456789` text on a helper artboard excluded from export; retain embedded delivery. Re-export independently, measure the actual file, and require at most 60,000 bytes. The [step-by-step guide](../rive/LIVE-EXPORT-FIX.fa.md) includes exact checks. A corrected export must be received and tested before production acceptance.

## Scene clock correction

Settled native screenshots exposed a React warning after the initial part of the animation: the derived story MotionValue was notifying a `Words` subscriber while `Scene` rendered. The story clock now synchronizes from motion events and a layout effect after commit. It retains skip handling, the Rive phase handshake and the reference timings. The existing first-tap regression test also asserts that the cross-render React warning does not occur.

The word paths, glyphs, animation curves and extracted Luau were unchanged by this follow-up. Player photos, flags, card shapes, scene movement and captions remain in the DOM.

## Executed validation

[Final full validation run 37146756565](https://github.com/turiwworks-cell/scoreline-brain/actions/runs/37146756565): **success**, on the functional commit listed above.
- TypeScript check, ESLint, production build and reference extraction comparison passed.
- **608 / 608 unit tests**, across 72 files, passed.
- **15 / 15 scene regression browser tests** passed.
- **9 / 9 actual-export / real-runtime browser tests** passed across phone, tablet and desktop.
- Full Live host unit checks cover count updates, rejection of missing `count`, removal of duplicate DOM artwork only after readiness, and restoration on failure.

The unit run's JSDOM App test logs its lack of Canvas and failure to fetch browser-relative WASM URLs. Its routing assertions pass; it is not treated as evidence of native rendering. The real Chromium runtime and settled-layout suites load local WASM successfully and assert no browser page/console errors. The cross-render React warning discovered in the earlier layout run is fixed.

The standalone extraction/native CLI checks from the original report remain historical evidence for the Luau source. The checks below use the actual signed editor file rather than that unsigned fixture.

The actual-export runtime suite runs in real Chromium with `@rive-app/webgl2` and local WASM:
- Twenty alternating completed goal/red plays, with changing goal colors, at each of three viewport sizes. Every completed play reports landing phase 1 and completion phase 2.
- A goal is interrupted during entry by a new red trigger; the restarted animation completes correctly.
- Original Live Boolean false/true screenshots differ, and twenty rapid Boolean changes complete without a runtime/page error.
- A lifecycle fixture warms up four scenes, measures twenty alternating scenes, and checks an instance cap of two. After scene cleanup only the diagnostic Live instance remains.
- Real IntersectionObserver offscreen pause/resume is exercised. The document-visibility event is **synthetic**, not an OS/background-tab test.
- WASM heap size and Chromium JS heap are sampled after garbage collection before/after the measured scene batch. Passing a bounded batch does not prove absence of every possible long-term leak or profile GPU allocations.

| Viewport | JS before (bytes) | JS after (bytes) | JS delta (bytes) | WASM before / after (bytes) |
| --- | ---: | ---: | ---: | ---: |
| phone-390x844 | 4,951,036 | 5,204,692 | 253,656 | 17,432,576 / 17,432,576 |
| tablet-900x800 | 4,951,092 | 5,204,784 | 253,692 | 17,432,576 / 17,432,576 |
| desktop-1280x892 | 4,951,072 | 5,203,344 | 252,272 | 17,432,576 / 17,432,576 |

WASM size remains unchanged at 17,432,576 bytes. JS deltas are under the fixture's 2 MiB limit; retained-instance checks pass.

The Live used by these lifecycle diagnostics is explicitly the original over-budget export (`diagnosticIcon: true`). These results do not approve its file size or the missing production count binding.

## Settled in-app visual checks

[Final settled-layout run 37146756569](https://github.com/turiwworks-cell/scoreline-brain/actions/runs/37146756569), on the same functional commit: **6 / 6 passed**.
Each goal-home and red-home case waits until the native canvas has opacity 1, waits two more seconds, asserts that it remains at opacity 1, and then captures the completed scene. This prevents screenshots taken during entrance or DOM fallback from being mistaken for native validation.
Screenshots use distinct viewport names: 390 × 844, 900 × 800 and 1280 × 892.

All six final PNGs were downloaded and visually inspected. GOAAAL and RED CARD retain their reference letter shapes and proportional scaling with no observed clipping in the completed scenes. DOM photos, flags, cards and captions remain aligned. No browser console/page errors or cross-render React warnings occurred in these six cases.

## Acceptance boundary and next action

Moments has passed signed-export loading, repeated playback, completion, settled in-app rendering, and its 150,000-byte budget.
The full Live host code and fallback are ready, but the corrected editor export is still required. The user should follow the Live correction guide and supply the resulting local `live-icon.riv` path. On receipt, check the byte budget, View Model `count` binding, full-button framing, and real-runtime behavior before installing it at `public/rive/live-icon.riv`.

The agent did not operate the Rive editor, inspect its authoring state directly, or perform an Opus review. The runtime checks establish what the received export actually does; they are separate from the remaining editor correction and its new export.
