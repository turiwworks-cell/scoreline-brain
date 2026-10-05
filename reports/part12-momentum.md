# Part 12: momentum chart

The momentum section is implemented as an isolated component, ready for Part 11's Facts tab.
It is deliberately not connected to the match screen yet: Part 11 is being implemented in
parallel by Claude, and its screen files must have one owner until integration.

Branch: `codex/part-12-momentum`. Base: Part 10 `a009e281f5d9e18b80bf50990ae75d6606b25ac2`.
No existing tracked files, other branches, or dependency/lock files were changed. No PR or merge.

## Original instruction

From `docs/BUILD-PLAN.md`:

> 12 · Momentum chart (Sonnet)
> Build: An SVG wave in the two teams' colours: midline, draw-on reveal, goal balls popping
> in on a stagger (`luau:4828–4989`). Recompute the path only when `match.mom` changes identity.
> Done when: the chart matches the Lua at both widths and doesn't re-render on clock ticks.

`docs/ARCHITECTURE.md` was read before implementation. This work stays in `features/match`
plus its separate verification fixture, configuration, screenshots and report.

## Implemented

- The 322×156 SVG plot, in the existing glass material (184 px high, radius 20, inset 16×14).
  The section uses the Lua's 18 px side margins and 61.8 px heading region.
- The Lua's five-point triangular smoothing, 1.25× amplitude, 44% height clamp, clockwise
  home/away lobes, vertical fill gradients, split-colour 1.4 px rim and soft static glow.
- Team crests/labels, half-time dash, future-minutes dash, midline and 0′ / HT / 90′ axis.
- Last-ten-minute pressure heading and the original 58% / 42% leadership thresholds.
- Original colour-distance fallback: away primary → secondary → `#E9E7E1`.
- A transform-based reveal and opacity/translation goal markers, using `timing('momentum')`
  and `transition('momentum')`. No global token changes, bounces or new motion library.
- Goal markers sorted by minute, clamped to 90′, with cancelled goals omitted.
- Live endpoint with the Lua's cosine pulse. Only the small leaf's SVG styles change;
  there is no React timer subscription. Its frame loop stops when offscreen, hidden or unmounted.
  Reduced motion uses the settled wave/markers and no pulse.
- Paths cached in a WeakMap by series identity; geometry is memoized by that identity.
  Provider-missing momentum is derived from event weights/decay with an event-identity and
  synchronized-minute cache, ending at the played minute so smoothing never peeks ahead.
  Unlike the Lua's mutable table cache, old snapshots can be garbage-collected.
- Accessible section heading, chart title/description, document-unique SVG ids and existing
  goal sprite; no copied fonts, placeholder photos or replacement crests.

## Integration contract for Part 11

Merge this branch into a **new integration branch based on the finished Part 11 commit**.
Then replace only the momentum placeholder inside Facts:

```tsx
import { Momentum } from './Momentum';

<Momentum
  key={match.id}
  matchId={match.id}
  minute={match.clock.minute}
  status={match.status}
  momentum={match.momentum}
  events={match.events}
  home={homeTeam}
  away={awayTeam}
/>
```

- Mount the component when Facts becomes active, so a new tab visit gets a reveal.
  Do not key it by feed sequence, clock tick, score or events: polls/new goals must not replay
  the whole chart entrance. Changing match id remounts the content intentionally.
- Pass the synchronized `match.clock.minute`, **not** a ticking `liveMinute()` value. Momentum
  advances when the source publishes data. Leaf MatchClock remains the timer subscriber.
- Keep team/event/series references structurally shared. Do not clone arrays in the render path.
  Memoization then skips unrelated parent-clock renders.
- Momentum owns its 18 px horizontal inset, heading and axis. Do not put another 18 px inset
  around it. It is fluid horizontally; its reference width is a 390 px pane.
- The goal sprite must be mounted once by the app, as it already is. MotionProvider is also
  already provided by the shell; do not add another provider around the real screen.
- The provider series should end at its synchronized minute, as DemoSource's snapshots do.
  The cached series is clipped to the current minute. Provider-missing data is derived only
  through the synchronized minute (capped at 95′), exactly like the Lua's fallback. A new data
  minute creates a new derived-series identity; second-by-second clock ticks do not.
- This component makes no decisions about the new desktop layout. The same component can sit
  in its eventual detail region without restoring the legacy three-pane layout.

After integration, run checks once and compare Facts against the original at the same frozen
data/time, on phone and desktop. Part 12's component verification does not accept Part 11's
layout or the combined screen on Claude's behalf.

## Verification

- `npm run check`: typecheck, lint and all **395 unit tests passed** (380 inherited + 15 new).
- `npm run build`: passed. Initial JS remains **183.96 KB gzip**, byte-identical to the Part 10
  app bundle because the component is not imported into the production screen yet. The inherited
  180 KB budget overrun remains open; chart bundle cost must be measured after integration.
- Geometry/render unit tests: independent numeric smoothing values, lobe direction, empty
  data, colour fallback, pressure thresholds, event-derived series, VAR, weak-cache reuse,
  SVG ids, and no geometry/render work on parent clock ticks.
- Separate browser suite: **12 passed** at 390×844, 900×800 and 1280×892, with one worker and
  no retries. Generated nine settled baselines, then ran actual screenshot comparisons.
  The new-goal test also checks that the marker reaches full opacity.
- The screenshots are **regression baselines of the ported component**, not captured images of
  the original Lua. Matching the final integrated screen against the original remains pending.
- Existing app browser suite, run once with one worker: **81 passed, 1 skipped, 2 failed**.
  Both failures were `each pane keeps its own scroll`, at tablet and desktop: expected list
  scroll 300, received 0, at `e2e/nav.spec.ts:172`. The phone version passed. App source/tests
  were unchanged and the production JS hash matched Part 10. No claim about the underlying
  cause; no stress runs or navigation fixes were added to this part.
- Browser: Chromium Headless Shell 134 on Linux, selected with `PW_CHROMIUM_PATH`, because
  this environment's full Chromium could not start its singleton socket. This is not a
  device/GPU performance measurement, nor a measurement of the earlier video's lag.

## Reproduce

```sh
npm ci
npm run check
npm run build
npx tsc --project verification/momentum/tsconfig.json
npx playwright test --config playwright.momentum.config.ts
```

Install the Playwright browser when needed with `npx playwright install chromium`, or set
`PW_CHROMIUM_PATH` to a compatible installed Chromium executable. The visual baselines are
Linux-specific; on another OS, review and generate that OS's baselines explicitly.

For an isolated preview:

```sh
npm run dev
```

Open `/verification/momentum/fixture.html`. The fixture has parent-clock ticks, series updates,
new-goal and VAR controls; `?scenario=finished` and `?scenario=empty` show the other states.
It is outside the application entry graph and is not included in the normal production build.

The verification files use their own config and do not change `playwright.config.ts`, the
existing browser tests, app routes, dev kit or package scripts. Screenshot files live in
`verification/momentum/momentum.spec.ts-snapshots/`.
