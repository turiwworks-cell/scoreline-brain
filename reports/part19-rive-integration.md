# Part 19 — Rive integration

Status: **implementation complete; final runtime acceptance pending Part 20 assets and Opus review**.
This is not an integration approval.

Base: `74f8edad99245ef3b6186a2b79be408fd3fa2a71` on `codex/part-15-16-integration`.
Implementation branch: `codex/part-19-rive`.
Validated production source: `0159295410e2c924cd0d18e7c8ab58f77fd575f0`.
Subsequent changes affect verification/workflows and this report only.

## Behavior

- The pinned `@rive-app/webgl2` runtime (2.44.0) and both WASM variants load from a lazy chunk and our own origin. Two paints and an idle slot precede loading; hidden tabs wait.
- The Rive-aware scene also loads outside the initial dependency graph and warms after paint. Its director clock still determines the elapsed presentation time.
- Instances use `useOffscreenRenderer: true`. A two-slot owner permits one Live icon and one scene word. A cancelled async load cannot create a stale instance.
- `RiveCanvas` owns intersection and resize observers, visibility listeners, bindings and instances. It pauses offscreen and while hidden, defers hidden resize draws, and calls `cleanup()` exactly once.
- Word-clock updates request playback through that owner. They cannot directly restart an offscreen canvas. The selected state machine is reset and bound before playback, avoiding the v2 runtime's possible default linear timeline.
- Canvases are decorative: `aria-hidden`, `tabIndex=-1`, no Rive pointer listeners or focus interruption, and `pointer-events: none`.
- The Live icon stays inside a DOM toggle button. URL state sets Boolean `islive`; property changes use the existing navigation. App-write echoes are ignored. Its static SVG preserves the original 9 px dot and pill geometry.
- `GoalWord` sets String `kind`, Color `color1` / `color2` and Trigger `play`, and listens to Number `phase`. Phase 1 releases the DOM headline rise; phase 2 stops the word loop.
- A missing file, unsupported WebGL, bad View Model or missing phase handshake retains/restores the DOM word. The fallback deadline is the presentation's `beats.full`.

## Verified results

Clean Linux validation used all repository assets and the actual npm runtime.

| Check | Result |
| --- | --- |
| TypeScript and ESLint | Pass |
| Whole unit suite | **606 passed, 0 failed** |
| Header geometry at 390 / 900 / 1280 | **3 passed** |
| Goal, red-card and toast interactions at those widths | **15 passed** |
| Production build | Pass |
| Initial JS, gzip, baseline | **218,555 bytes** |
| Initial JS, gzip, Part 19 | **216,275 bytes** |
| Initial JS change | **2,280 bytes smaller** |
| Real goal-word heap / background rendering | **Pending the Part 20 exports** |

Evidence: [production-source run](https://github.com/turiwworks-cell/scoreline-brain/actions/runs/37138038266),
[baseline comparison run](https://github.com/turiwworks-cell/scoreline-brain/actions/runs/37133717433).
The production-source run is red because its attempted legacy-artboard memory fixture failed before binding. Its app checks and all 606 units, 3 header checks and 15 moment interactions passed; this distinction is intentional.

The 31 Part 19 unit tests cover idle/visibility cancellation, shared imports and buffers, retries, two-instance ownership, twenty repeated scene mounts, cleanup, stale async loads, hidden resize, offscreen restart protection, Boolean echo suppression, input ordering, phases, deadline fallback and listener removal. Injected-runtime ownership tests do not establish actual WASM/GPU heap stability.

The whole production browser suite was run against the exact base and the first implementation: baseline **165 passed / 5 failed / 13 skipped**, first implementation **162 passed / 8 failed / 13 skipped**. The three new failures were the Live pill width; all three now pass. Shared failures concern lineup entrance ordering (three widths) and pane scroll restoration (tablet/desktop). They remain Part 21 work. The whole suite was not repeated after the focused fix; the affected header and moment checks were rerun. Previously documented Stats and demoSource flakes are separate.

The 180 KB initial-JS architecture budget is still unmet by the broader application; Part 19 does not increase the baseline. That budget remains Part 21 work.

## Runtime acceptance and Part 20 handoff

Neither `public/rive/live-icon.riv` nor `public/rive/moments.riv` exists at this checkpoint.
Vite checks their presence at build time: absent files make no asset request and retain the static SVG/DOM word. Adding the exports and rebuilding enables them automatically.

An attempted reference test used the documented name `FOTMOB Live Icon` in `legacy/scoreline.riv`. The real runtime reported **Invalid artboard name or no default artboard**. The file therefore cannot establish acceptance under that assumed name. No legacy artwork is shipped as a replacement, and no memory pass is claimed.

`verification/rive/` now targets the actual Part 20 exports. With either absent, Playwright explicitly skips with a reason. Once both exist, the separate **Part 19 real Rive acceptance** workflow checks the View Model contracts, warms four words, plays twenty goal words through their landing signal, collects JS/WASM memory, checks retained ownership, and exercises intersection and synthetic document-visibility pause at three widths. It records heap evidence and applies a 2 MB retained-growth limit after GC. This is not a measurement of GPU memory or an OS-level background tab.

The acceptance fixture itself passed TypeScript and ESLint in [its final workflow run](https://github.com/turiwworks-cell/scoreline-brain/actions/runs/37138683347); its three browser cases were explicitly **skipped** because both exports are absent. That run's green status is not a heap or rendering acceptance pass.

The app validation workflow runs for app changes; the runtime acceptance workflow runs for Rive exports/fixture changes. Report-only changes do not repeat completed checks.

The default Live artboard needs a state machine and a default bound View Model with Boolean `islive`. Its exported artboard bounds should fit the artwork.

The default moments artboard needs a state machine and a default bound View Model:

| Property | Type | Meaning |
| --- | --- | --- |
| `kind` | String | `goal` or `red` |
| `color1`, `color2` | Color | Opaque ARGB colors |
| `play` | Trigger | Starts one showing |
| `phase` | Number | 0 at start, 1 landed, 2 done |

The director's first tap changes `startedAt`. The specified four inputs cannot scrub a high-level Rive state machine to an arbitrary time: a first-tap jump disposes the animated word and shows the landed DOM fallback. The second tap and exits remain under the director's control. No undocumented runtime internals or extra View Model inputs are used.

## Handoff

1. Supply the Part 20 exports, rebuild, and run `npx playwright test -c playwright.rive.config.ts`. Confirm real artwork, phase timing, size budgets and heap stability. The fixture's synthetic visibility check should be supplemented with a real background-tab check during Part 21.
2. Obtain the Opus review required by `docs/ARCHITECTURE.md` / `docs/BUILD-PLAN.md` for `app/` and `rive/`. No Opus review has been performed.
3. Integrate only after review. The integration branch and deployment are untouched.

Local verification became unavailable when the Windows execution backend could not prepare its sandbox. Final source checks ran in GitHub Actions. The branch above is the authoritative saved result; the older local materialization is not the final checkpoint.
