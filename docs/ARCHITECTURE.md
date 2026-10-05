# Scoreline rebuild: architecture decisions

Decided 2026-10-02. These are settled. Implementation sessions follow them and do not reopen them.
References: `scoreline_11.luau` (cited as `luau:<line>`), `scoreline.riv`, `Scoreline_Fixed.html`,
`DATA-BINDING_4.md`. Part 1 of the build plan moves all four files into `legacy/`.

## 0. What we are rebuilding from

Today the whole app is one 8,925-line Rive Node Script that draws everything on one canvas. It
brings its own text renderer (Hanken Grotesk glyphs baked as paths), fixed-size layout (390×844
and 1280×892 artboards), hit testing, scroll physics, tween engine, JSON parser, match simulator
and data model. The Live icon is the only thing authored in the Rive editor. The HTML host embeds
2.3 MB of WASM and the 0.8 MB `.riv` as base64, and turns mouse-wheel input into synthetic drags.

What that costs: no screen reader or keyboard support, text that can't be selected or searched,
no URLs, letterboxing on any other screen shape, missing glyphs for names outside the baked set,
a full redraw every frame even when idle (`advance` always returns true), and about 3 MB to
download before the first paint.

**Decision: rebuild Scoreline as a DOM-first web app. Rive shrinks to a small layer that loads
on demand and plays only the designed moments.**

## 1. Stack

| Concern | Choice |
| --- | --- |
| Language | TypeScript, `strict` |
| UI | React 19 |
| Build | Vite (static SPA) |
| Routing | React Router (data mode, SPA) |
| Styling | CSS Modules + CSS custom properties (tokens). No CSS-in-JS runtime |
| State | Zustand, one store |
| Boundary validation | Zod (lenient: defaults instead of throwing, like the Lua `num(v, d)`) |
| Motion | Motion (`motion/react`, via `LazyMotion` + `m`), plus CSS transitions |
| Rive | `@rive-app/webgl2`, pinned, in a lazy-loaded chunk |
| Tests | Vitest (domain), Playwright (smoke + screenshots at 390×844 and 1280×892) |
| Hosting | Static CDN |

Rejected (don't revisit):
- **Next.js.** The App Router makes exit and shared-element transitions awkward, and this is a
  client-driven live app. If SEO is needed later, prerender the match pages.
- **TanStack Query.** A second cache for live data would mean two sources of truth.
- **Tailwind.** The materials (glass, spectrum, soft light) read better as a few named CSS recipes.
- **Canvas UI libraries (Pixi, Konva).** They have the same problems as the current build.

## 2. What renders with what

| Thing | Tech |
| --- | --- |
| Layout, text, lists, tabs, buttons, tables, stat bars, sheets, toasts, line-up player chips | React + HTML/CSS |
| Glass panes, soft lights, cursor hover light, spectrum fills, the grey-out after a goal | CSS (gradients, custom properties, `filter: saturate()`) |
| Icons, crests and flags (the `teams[].flag` grammar), ball/card/sub tags, momentum wave, pitch markings | Inline SVG components + one icon sprite |
| Player photos (bust, head, frosted) | `<img>` per player, AVIF/WebP, pre-cut and pre-blurred |
| Live icon (the header Live toggle) | Rive (the existing artboard) |
| GOAAAL word with flare and glint; RED CARD hit | Rive (`moments.riv`) |
| Canvas | Nothing for now. Reserved for future dense data viz (heatmaps, shot maps) |

## 3. Rive: what stays, what moves

**Stays in Rive.** Two small files, each kept apart from the app code:
- `public/rive/live-icon.riv`: the existing complete animated Live button and state machine.
  Part 20 preserves its outer capsule and calendar motion. Its default View Model exposes
  Boolean `islive` and String `count` bound to the calendar text. The DOM supplies the button's
  hit target/accessibility and a complete fallback; after Rive is ready it suppresses its own
  glass rim and counter. The artboard's **capsule** (not the 443 x 152 artboard) is 40 px high,
  as tall as the round menu button beside it (`src/rive/liveGeometry.ts`); the artboard overflows
  the button. `islive` is written one way, from the URL: Rive's own toggle never writes back
  (an echo of an older value switched Live off again). The hover light is the DOM's `.m-light`
  over the capsule, sized to its on/off width. The canvas re-sizes when `devicePixelRatio`
  changes (zoom, device emulation).
- `public/rive/moments.riv`: one artboard with a state machine for the goal word (letters slam
  in, flare, glint) and the red-card hit.

**Moves to the web.** Everything else in the Lua script: every screen, the data model, the
simulation, JSON parsing, text, layout, scrolling, hit testing and tweens.

**The web↔Rive contract is View Model properties, nothing else.**
- In: `kind` (goal | red), `color1`, `color2` (team colours, or spectrum stops), trigger `play`.
- Out: Number `phase`: 1 once the word has landed, 2 when it's done. The script writes it the
  same way `syncVM` writes properties today (`luau:8105`). If a later editor-authored version
  signals with Rive events instead, only `rive/GoalWord.tsx` changes.
- Rive draws the word in place. The **DOM** moves it: a container holding the Rive canvas and
  the SVG flag does the rise to the top, then brings in the scorer and the commentary. This keeps
  flag images out of Rive and leaves one handoff point (`phase = 1`) between the two.
- **One word plays the headline, never two.** The scene's story time (`src/rive/wordClock.ts`)
  stays at 0 for at most 0.3 s from the scene's first frame, until it is known which word plays:
  the Rive word if it binds in time, else the DOM stand-in (`Word.tsx`), which then plays the
  whole headline. A late binding is refused. Swapping in mid-flight (the DOM letters hidden and
  Rive starting them again) was the "shake" of the 2026-10-04 review. The rise waits at `up` only
  for a late Rive word; an early landing keeps the Lua's hold.
- First version of `moments.riv`: lift the existing `shoutWord` / `slamWord` drawing code
  (`luau:6314–6422`, called from `goalScene` / `redScene` at `luau:6536–6656`) into a small
  Node Script so the approved look carries over. A designer can later replace it with a timeline
  authored in the editor without any change to the web code.

**Rules for Rive in the app:**
- Rive canvases are never hit targets. A DOM `<button aria-pressed>` wraps the Live icon, and
  every Rive canvas is `aria-hidden` with `pointer-events: none`.
- The runtime starts only after the first data has been committed, painted and the page has gone
  idle (`src/rive/startGate.ts`, state in `app/layout/RiveGate.tsx` so opening it re-renders the
  Live button and nothing else). A feed that is due and late does not hold it past 4 s; a page with
  no data on its way opens the gate after its first paint. Until then, and while it loads, the
  Live icon is its DOM fallback, swapped for the canvas without a visible change. `moments.riv`
  preloads once the gate is open and any match is live.
- `useOffscreenRenderer: true` makes the instances share one WebGL context. Never more than 2
  instances at once. Pause when off-screen or the tab is hidden, and call `cleanup()` on unmount.
- Size budget: `live-icon.riv` ≤ 60 KB, `moments.riv` ≤ 150 KB.
- The artboard inside `scoreline.riv` is named "FOTMOB Live Icon". Confirm the artwork is
  original before shipping. If it was traced from FotMob's icon, redraw it.

## 4. Data and state

```
provider API → adapter server ─┬─ GET /feed        (snapshot, ETag)
                               └─ SSE /events      (deltas)
                                        │
            data/sync ──► domain reducer (pure TS) ──► Zustand store ──► React (selectors)
                                  │
                                  └─► moments[] ──► MomentDirector ──► scenes / toasts / aria-live
```

1. **Keep the `feed` / `event` JSON contract** (`DATA-BINDING_4.md` §2–3). It moves to
   `docs/DATA-CONTRACT.md` with three additions:
   - Every match and every event gets a monotonic `seq`. Match-level fields from a snapshot whose
     `seq` is older than what the client already applied are ignored.
   - `kind: "goalCancelled"` (VAR). The score is allowed to go down.
   - An event carries `seq` and the match's `score` after it.

   Why: today `applyFeed` overwrites the score unconditionally (`luau:7944`). A cached snapshot
   that arrives after a live goal event rolls the score back. The next fresh snapshot then counts
   as "score went up with no new goal event" and synthesizes a second goal (`luau:7975–7996`),
   so the celebration plays twice.
2. **`src/domain` is pure TypeScript and never imports React** (enforced by lint).
   `applyFeed(state, feed)` and `applyEvent(state, event)` both return `{ state, moments }`.
   Moments (goal, goalCancelled, red, fulltime, kickoff) are derived here and deduped by event
   id. Components never derive them.
3. **Structural sharing.** An unchanged match keeps its object identity across polls. A 15 s poll
   re-renders only what changed and never replays an entrance animation.
   Each Source session owns a feed parser cache. A v2 match is reused only when both its `seq`
   and its wire data are unchanged: equal-seq clocks, late details and late events must still be
   read. v1 matches are always validated in full. Stopping or restarting a Source clears its cache.
4. **Normalized store**: `teams`, `leagues`, `players`, `matches` keyed by id; each match's events
   ordered by `seq`.
5. **The URL holds navigation state**: `/?day=<n>&live=1`, `/match/:id/:tab`,
   `/player/:team/:n`. This replaces the two-way `day / liveOnly / openMatch` View Model
   properties, and deep links work. The followed player lives in localStorage until accounts exist.
6. **The clock is computed**, not stored: `minute + time since last sync`. Only a leaf
   `<MatchClock>`, subscribed to a 1 Hz ticker, re-renders each second.
7. **One `Source` interface** with two implementations: `ApiSource` (real) and `DemoSource` (a
   port of the Lua simulation plus the JS demo in the HTML). The dev panel fires the old triggers
   (`goalHome` … `fullTime`) through `DemoSource`.
8. **Provider API keys never reach the browser.** A small adapter server polls the provider and
   serves `/feed` and SSE `/events` to every client. SSE rather than WebSocket: the data flows
   one way, it is plain HTTP, and reconnection is built in.
9. **Match details load when a match opens** (`ensureMatchDetails(id)`) and merge into the same
   store.

## 5. Motion

| Tier | Used for | Tool |
| --- | --- | --- |
| Micro | Hover light, press dip, letter roll on buttons, focus rings | CSS transitions + custom properties (no JS) |
| Choreography | Screen push, staggered cascades, tab indicator and content slide, live section open/close, toast swipe | Motion: `AnimatePresence`, variants; WAAPI (`src/motion/play.ts`) for time-pure entrances that must replay, such as the live cards |
| Moments | Goal word, red-card hit, Live icon | Rive |

- `src/motion/tokens.ts` copies `TIMING_DEF` from `luau:366–381` verbatim (14 sections: dur,
  delay, stagger, cubic-bezier), plus the global `speed`, `toastHold`, `goalHold`, `goalFocus`
  and `goalMark`. Every animation reads from it. No inline durations anywhere.
- The Lua's design rule stays: curves settle and nothing bounces. Gestures (toast swipe, sheet)
  use springs with `bounce: 0`.
- Animate only `transform` and `opacity`, plus `filter` on at most 6 live cards. No Motion
  `layout` and no `layoutId`.
- **No shared elements.** Nothing flies between screens, as in the Lua. (Card→hero and
  face→bust flights were built in Part 9 and removed after the 2026-10-04 review: logos flew from
  the middle of the page, and ghosts showed under the lineup plates.)
  - Opening a match is the Lua's **push** (`pushLayer` / `pushBase`, `src/motion/variants.ts`).
  - Opening a player is the **same from every origin** (list, follow card, lineup, Leaders): his
    bust grows at the centre of its window from 0.9 to 1 on the `player` timing's ease-out while
    the page fades in, and closing plays it backwards and scales him down
    (`src/features/player/motion.ts`). The bust's cut edge stays below its window.
  - The goal and red card scenes keep their own choreography.
- **Navigation model.** The list never unmounts. On phone, the match and player screens stack
  above it; on desktop they sit in panes beside it. The list keeps its scroll position for free.
  Navigations render at once (`flushSync` in `src/app/nav/actions.ts`): under a transition a
  second Live tap saw stale state and the cascade started late.
- **Presence.** Under `AnimatePresence initial={false}` Motion skips `initial` for everything
  mounted later in the same child, so `Screen` lifts that after its first frame
  (`LaterMountsAnimate`, `src/app/layout/Screen.tsx`): a tab's content still animates in.
- `<MotionConfig reducedMotion="user">`. With reduced motion on, a moment becomes a static toast.
- A dev-only tuning panel edits the tokens live and copies them out as JSON. It replaces the 98
  timing inputs on the Rive script.

## 6. Phone, tablet, desktop

One app, one component set, one URL scheme. Layout is a function of route and width.

| Width | Layout |
| --- | --- |
| < 768 px | One column. The list at the base; match and player push on top as layers. Back and swipe-back use browser history. |
| 768–1199 px | Two panes: list · match. The player opens as a sheet over the match pane. |
| ≥ 1200 px | Three panes: list · match · insights (Player / Tables / Leaders). This is today's desktop. |

- Panes are fluid (min 360, max 440 px) and each is its own native scroll container with
  `overscroll-behavior: contain` and no visible scrollbar. Wheel, trackpad, keyboard and touch
  scrolling all come from the browser, so the wheel-to-drag shim is gone.
- **Elastic edges.** A touch drag that starts at a pane's top or bottom and pulls outward
  follows the finger at 0.4 and springs back at 14/s, as the Lua's scroll does (`luau:8559`,
  `8803`); it works on a page shorter than the screen too. Sticky bars stay put
  (`src/app/layout/useElasticEdges.ts`).
- Hover effects only under `@media (hover: hover) and (pointer: fine)`. Safe-area insets on phone.
- On load, desktop opens the featured match in pane 2, as it does today.
- **Text on the Lua's baselines.** The Lua's `txt(…, x, y, size)` takes the baseline, and
  `bc(cy, size) = cy + 0.3485 × size` is the baseline of text centred on cy (`luau:1630`). Hanken
  Grotesk's ascent is 1000 and descent 303, so `line-height: normal` is 1.303: a line box centred on
  cy puts the baseline on `bc` at any line height; a box with `line-height: 1.2` whose top is
  `y − 0.9485em` puts it on y; a `line-height: 1` box starts 0.8485 em above it. Chromium rounds the
  ascent and descent to whole pixels, so a line box shorter than 1.303 em can sit up to 1 px higher
  than this arithmetic. **Accepted limitation:** that sub-pixel difference is the browser's, not a
  porting error; the design is not adjusted to compensate, and the baseline specs allow 1.1 px. Badges and tags beside text centre on what the Lua centres them on (cy or the
  cap height), not on the line box. `e2e/baselines.spec.ts` and `verification/moments/baselines.spec.ts`
  hold the ported text to the Lua's numbers within 1.1 px (`e2e/support/baseline.ts` measures the
  baseline the browser drew); add a row there when porting a new text block.

## 7. Performance risks to design out

| Risk | Rule |
| --- | --- |
| Every poll re-renders the whole app | Structural sharing, narrow selectors, `memo` on rows |
| Entrance animations replay when data refreshes | Animate on mount only; key by entity id |
| The 1 Hz clock re-renders the tree | Leaf `<MatchClock>` subscription |
| `backdrop-filter: blur` on scrolling panes | Never. The design's glass is an opaque dark pane; frosted photos are pre-blurred files |
| Rive weight and memory | Lazy chunk, at most 2 instances, shared context, pause off-screen, `cleanup()` on unmount |
| Image weight | Per-player AVIF/WebP at 1× and 2×, explicit `width`/`height`, lazy below the fold. No 4032×3556 atlases |
| Long lists (300+ matches on a real matchday) | League sections with `content-visibility: auto`. Virtualize only if profiling shows it's needed |
| Several moments at once (one poll reveals 4 goals) | MomentDirector queue: only the open or followed match gets a full scene, others get toasts; collapse when more than 2 are queued; hold while the tab is hidden, then summarize |
| Motion `layout` thrash | No `layout` and no `layoutId` anywhere (§5) |
| Font loading | One self-hosted Hanken Grotesk variable woff2, preloaded, latin + latin-ext subset; `tabular-nums` on scores and clocks |
| Service worker serving a stale feed | The SW caches the app shell only and never `/feed` or `/events` |

Budgets: initial JS ≤ 180 KB gzip, Rive excluded. LCP ≤ 2.0 s on a mid-range Android over 4G.
INP ≤ 200 ms. No task longer than 50 ms while a poll is applied.

`npm run check:size` counts the entry and every modulepreload once, in decimal KB, and runs after
the CI build. Match and player screens are lazy, warmed after paint and on pointer/focus intent;
their ready thenables preserve the first warmed push/reveal. A cold load keeps loading chrome
and transfers any focus it holds to the resolved heading. Rive stays outside the initial graph.
Motion's `domAnimation` stays synchronous: deferring it prevented some initial screens from
completing their exits in browser tests.

First paint and first data (Part 21, `reports/part21-startup-and-lcp.md`):
- `index.html` carries the list's header and day tabs as an inline-styled static frame inside
  `#root`; React replaces it at its first commit in the same boxes (`e2e/handoff.spec.ts` holds
  the geometry and the handoff, `src/app/staticFrame.test.ts` the copied tokens).
- The app's entry runs after that frame is on screen: the build turns the entry's module script
  into a (low-priority) modulepreload and adds the script once the first contentful paint is
  observed (`vite.config.ts`, `bootAfterFirstPaint`). The module graph is unchanged and
  `check:size` counts the entry through its modulepreload.
- Day-tab widths come from `textWidth` and `useFontVersion`, never from a DOM measurement.
- The first feed reaches the header in the store's own render; the list body (follow card,
  groups) follows in a deferred render. A first list longer than a screen mounts the first screen
  at once and the rest in measured ~40 ms slices (`progressive.ts`); a day or Live change mounts its
  list whole, because the cascade is timed for that.
- The host must compress `application/wasm` (the Rive runtime is 2.3 MB raw, about 0.93 MB gzip
  and 0.73 MB brotli) and serve it with that content type. `vite preview` sends it uncompressed;
  `verification/perf/compression.mjs --base <host>` checks a deployment.

## 8. Project structure

```
src/
  app/          routes, layouts (PhoneStack / TwoPane / ThreePane), providers
  domain/       pure TS: types, schemas, applyFeed, applyEvent, moments, clock, standings, selectors, text
  data/         Source interface, ApiSource, DemoSource, sync (poll + SSE)
  store/        Zustand store: domain state + prefs (followed player)
  motion/       tokens.ts, variants.ts, MomentDirector, TuningPanel (dev only)
  rive/         lazy loader, RiveCanvas, LiveIcon, GoalWord
  ui/           Glass, Button, Pill, Tabs, Icon, Crest, PlayerPhoto, RatingBadge, Tags, SoftLight, MatchClock
  features/
    matchList/  DayTabs, LiveCards, LeagueSection, MatchRow, FollowCard
    match/      MatchHero, Facts (Momentum, Events), Stats, Lineup (Pitch, Squad), Table
    player/     PlayerView
    insights/   Tables, Leaders (desktop pane 3)
    moments/    GoalScene, RedScene, Toast
  styles/       tokens.css, materials.css, global.css
public/rive/    live-icon.riv, moments.riv
public/img/     players/<team>/<n>-<bust|head|frost>@<1|2>x.<avif|webp>
scripts/        slice-atlas.ts
docs/           ARCHITECTURE.md, BUILD-PLAN.md, DATA-CONTRACT.md
legacy/         the Rive-era files (reference only, never imported)
```

Import rules, enforced by lint:
- `domain/` imports nothing from the app.
- `data/` and `store/` may import `domain/`.
- `ui/` imports no `features/`.
- `features/` don't import each other; anything they share goes to `ui/` or `domain/`.
