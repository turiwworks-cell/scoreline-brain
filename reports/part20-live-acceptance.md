# Part 20 — final Live acceptance and completed export handoff

Date: 2026-10-04. Branch: `codex/part-20-moments`.
Status: **both actual editor exports accepted and installed**.
Validated functional commit: `14e43df89a5a4521a814057943b1caf54ddf4480`.
A subsequent reporting commit changes documentation only.
No merge, deployment, Part 21 work or Opus review was performed.

This report supersedes the pending/rejected Live status in the historical
[export report](part20-editor-exports.md) and [first replacement report](part20-live-export-check.md).
The extracted word implementation and its earlier CLI evidence remain in
[part20-moments.md](part20-moments.md). The Part 19 base was not reimplemented.

## Accepted files

| Production file | Bytes | Maximum budget | SHA-256 |
| --- | ---: | ---: | --- |
| `public/rive/moments.riv` | 18,100 | 150,000 | `9a979035d9722e59ef2ad38f544e5fe4a2c91af7ba1c27f307b553574085d643` |
| `public/rive/live-icon.riv` | 26,800 | 60,000 | `4c4842768e69543834e554fc72beabdf2aad9bc4e3ecfd653805dc3da108f970` |

Moments is the previously accepted signed editor export, unchanged.
Live is the separately exported, reconstructed replacement from the user's updated Base64 text.
The installed bytes and `verification/rive/exports/live-icon.candidate.riv` are identical,
Git blob `7e6f83b8121bd6c6c6667c541b001119322a4b93`. No serialized animation, font or script
bytes were manually rewritten. The separate .riv attachment metadata still advertised 243,688 bytes;
it was not substituted for the reconstructed 26,800-byte replacement.

The original over-budget Live file remains diagnostic evidence only. The old 23,618-byte
helper-only replacement is available in its historical commit, not the current production path.

## Full-artboard selection

The accepted Live file contains `font` and `aniamtion`; its file default still selects `font`.
Unlike the earlier helper-only export, it now includes the complete main artboard.
`LiveGraphic` explicitly passes the authored name **`aniamtion`** to `RiveCanvas`.
The existing lifecycle applies that selection both to the constructor and to reset before binding.
No runtime SDK or state machine was replaced.

The selected artboard exposes Boolean `islive` and String `count`, and has
`State Machine 1` with `on 2`, `on`, `live to idle` and `idle to live` timelines.
Runtime bounds are **433 × 152**. The host display box is **110.75 × 38 CSS px**
(ratio 443 / 152); proportional runtime fitting preserves the authored proportions.
The helper remains in the compact file within budget and is not the displayed artboard.
Do not delete the animated capsule, outer frame, dot, calendar, timelines or machine.

The DOM button retains keyboard operation, focus, accessible count/name and controlled
pressed state. After successful native binding, the duplicate DOM glass/counter is removed.
Missing assets/properties or a runtime error keep/restore the complete fallback.
The production loader now detects both public assets. Lifecycle measurements use the
accepted production Live (`diagnosticIcon: false`), not the over-budget diagnostic file.

## Executed checks

[Focused production Live run 37190152439](https://github.com/turiwworks-cell/scoreline-brain/actions/runs/37190152439):
**6 / 6 passed** on the functional commit above.
At phone 390 × 844, tablet 900 × 800 and desktop 1280 × 892:
- The actual production file selects `aniamtion` and exposes both required properties.
- Calendar pixels differ for `0/3/12/99`; repeating `0` reproduces its pixels.
  Twenty rapid Boolean/count updates finish without page/runtime errors and restore the
  same `12` calendar pixels. These checks establish drawing, not just value readback.
- Off/on images differ with the native state machine running.
- The real React `LiveIcon` host renders at 110.75 × 38 px, with opacity 1 and no duplicate
  DOM artwork; count changes produce four different actual button images.
- Space and click toggle the controlled button.
- Three unmount/remount cycles per viewport reduce occupied slots to zero and restore one,
  including React StrictMode. The final count and pressed state survive correctly.
- No page or console errors occur in these six cases.

Phone screenshots of the actual host at 38 px, both off and on, were visually inspected.
The complete capsule/frame/calendar fit inside the button without observed clipping.
Earlier full-artboard off/on images of this same replacement were also visually inspected.

[Full validation run 37190152481](https://github.com/turiwworks-cell/scoreline-brain/actions/runs/37190152481):
**success** on the same functional commit.
- TypeScript, ESLint, production build and reference/glyph extraction comparison passed.
- ESLint reported zero errors and one Fast Refresh warning in the standalone
  `verification/rive/live-host.tsx` entry component; its exit status was successful.
- **608 / 608 unit tests**, across 72 files, passed.
- **15 / 15 scene regression browser tests** passed, including settled native words.
- **15 / 15 actual-export/host/lifecycle browser tests** passed, with no skipped cases.
  The suite includes three historical original-Live diagnostic cases; production acceptance
  is established by the new production-file/host cases and production lifecycle measurements.
- Recorded byte counts and SHA-256 fingerprints match the accepted files.
- Browser runtime logs contain no Rive page, console or request errors.

The full runtime suite uses the actual signed Moments export for twenty alternating completed
goal/red plays per viewport, changing goal colors, phase-1/phase-2 checks and an interrupted
goal restarted as red. The source/reference comparison validates the extracted functions and
nine glyphs. The standalone native CLI tests from the original report are historical executed
evidence; they were not rerun or confused with this signed-editor browser run.

The lifecycle fixture warms four word instances and measures twenty more alternating instances
per viewport while production Live stays mounted. It checks a maximum of two simultaneous
instances and one retained instance after each scene is closed. It exercises real offscreen
IntersectionObserver pause/resume and a **synthetic** document-visibility event.

| Viewport | JS before | JS after | JS delta | WASM before / after |
| --- | ---: | ---: | ---: | ---: |
| phone-390x844 | 4,951,716 | 5,205,040 | 253,324 | 17,432,576 / 17,432,576 |
| tablet-900x800 | 4,951,940 | 5,205,304 | 253,364 | 17,432,576 / 17,432,576 |
| desktop-1280x892 | 4,951,908 | 5,205,284 | 253,376 | 17,432,576 / 17,432,576 |

All JS deltas are below the 2 MiB fixture limit; WASM is unchanged at 17,432,576 bytes.
Every viewport reports `diagnosticIcon: false` and one retained Live instance after scene cleanup.

The bounded replay/heap batch is not a proof of indefinite leak freedom and does not measure
GPU allocations. JS/WASM samples and ownership checks are separate from the script's bounded
paint/gradient caches. JSDOM unit warnings about Canvas/browser-relative WASM do not count as
native rendering checks; actual native checks run in Chromium with local WASM.

## Current editor handoff

**No new export or deletion is required for this version.** Both final files are already in
`public/rive/` on the independent Part 20 branch. To view it, check out this branch and run
`npm ci`, then `npm run dev`.

[Persian Moments/editor guide](../rive/EDITOR-GUIDE.fa.md) covers the 390 × 340 transparent
Moments artboard, Node Script placement at 0/0, View Model/default instance, default state
machine, trigger-based preview of both words, replay and independent exports.
[Persian Live guide](../rive/LIVE-EXPORT-FIX.fa.md) covers editing the accepted full button
without deleting its motion, preserving `aniamtion` selection, font coverage and count binding.

Moments retains the reference GOAAAL/RED CARD glyphs, curves, color math and trigger-relative
timing, with no duplicated host delays. Player photographs, flags, card shape and scene/DOM
movement remain outside its Rive file. The final word stays visible after completion.

The agent did not control the Rive editor or inspect its editable authoring project directly.
Successful runtime export tests are distinct from editor Preview validation. The current
Windows shell could not launch because of the managed sandbox backend; executed code/browser
checks used GitHub Actions. Opus review has not been performed.
