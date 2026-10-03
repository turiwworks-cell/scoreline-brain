# Part 19 — Rive integration

Base: `74f8edad99245ef3b6186a2b79be408fd3fa2a71` on `codex/part-15-16-integration`.
Implementation branch: `codex/part-19-rive`. Validation is in progress; this is not an integration approval.

## Behavior

- The pinned `@rive-app/webgl2` runtime (2.44.0) and both WASM variants load from a lazy chunk and our own origin. Two paints and an idle slot precede loading; hidden tabs wait.
- Instances use `useOffscreenRenderer: true`. A two-slot owner permits one Live icon and one scene word. A cancelled async load cannot create a stale instance.
- `RiveCanvas` owns intersection and resize observers, visibility listeners, the View Model binding and the instance. It pauses offscreen and while hidden, defers hidden resize draws, and calls `cleanup()` exactly once.
- The Live icon stays inside a DOM toggle button. URL state sets the Boolean `islive`; property changes call the existing URL navigation. Echoes of app writes are ignored. The button, label and count remain DOM content.
- `GoalWord` sets String `kind`, Color `color1` / `color2` and Trigger `play`, and listens to Number `phase`. Phase 1 releases the DOM headline rise; phase 2 stops the word's render loop. Director keys, timers and exits are unchanged.
- A missing file, unsupported WebGL, bad View Model contract or missing phase handshake retains/restores the existing DOM word. The deadline comes from the presentation's `beats.full`.

## Part 20 handoff

Neither `public/rive/live-icon.riv` nor `public/rive/moments.riv` exists at the base checkpoint. Vite checks their presence at build time: absent files make no network request and the app retains its static SVG and DOM word. Adding the files in Part 20 and rebuilding enables them automatically.

The default Live artboard needs a default state machine and a default bound View Model with Boolean `islive`. Its bounds should fit its exported artwork.

The default moments artboard needs a default state machine and a default bound View Model:

| Property | Type | Meaning |
| --- | --- | --- |
| `kind` | String | `goal` or `red` |
| `color1`, `color2` | Color | Opaque ARGB team colors |
| `play` | Trigger | Starts one showing |
| `phase` | Number | 0 while starting, 1 when the word has landed, 2 when done |

The existing director's first tap changes `startedAt`. With only the specified four inputs, the high-level Rive state machine cannot be scrubbed to an arbitrary time: a first-tap jump disposes the animated word and shows the landed DOM fallback. The second tap and exits remain under the director's control. This behavior is explicit; no undocumented runtime internals or new View Model inputs are used.

## Validation in progress

Local Part 19 tests: **30 passed**. They cover idle/visibility cancellation, shared imports and buffers, failed-load retry, two-instance ownership, teardown over 20 scene mounts, hidden/offscreen pause, hidden resize, stale async completion, Boolean echo suppression, word input ordering, phases, deadline fallback and listener removal.

The first local whole-suite run, before the final seven graphic tests were added, had 590 passing tests. Its two failures came from incomplete source materialization: the Lua reference was absent and the photo-file existence test could not find the binary photos. Those results do not establish a baseline regression.

Local installation of the new Rive package is blocked by the environment's offline-only npm cache. The baseline dependencies are available. A local Vite dependency workaround skips its Windows network-drive discovery subprocess, which the sandbox rejects; it changes no repository source.

The branch's dedicated GitHub workflow checks both this branch and the exact baseline in clean Linux checkouts with all repository assets and the real npm package. It captures typecheck/lint, unit and production builds, initial JS gzip bytes, the full production browser suite and the moment interaction suite. Results will be recorded here when available.

## Required follow-up

- Verify the real `moments.riv` heap and hidden-tab rendering after Part 20 supplies the assets. The 20-mount ownership test uses an injected runtime; it is not a measurement of WASM/GPU heap stability.
- Compare initial bundle bytes with the baseline; loading the runtime lazily does not by itself prove the whole initial bundle is unchanged.
- Preserve the documented baseline lineup, pane-scroll, Stats-bar and demoSource timeout issues separately from new failures.
- `docs/ARCHITECTURE.md` requires Opus review for changes in `app/`, `motion/` or `rive/`. No Opus review has been performed, no integration branch is moved, and nothing is deployed.
