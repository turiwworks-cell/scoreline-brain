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
- `public/rive/live-icon.riv`: the existing Live icon artboard and state machine (`islive`).
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
- First version of `moments.riv`: lift the existing `shoutWord` / `slamWord` drawing code
  (`luau:6314–6422`, called from `goalScene` / `redScene` at `luau:6536–6656`) into a small
  Node Script so the approved look carries over. A designer can later replace it with a timeline
  authored in the editor without any change to the web code.

**Rules for Rive in the app:**
- Rive canvases are never hit targets. A DOM `<button aria-pressed>` wraps the Live icon, and
  every Rive canvas is `aria-hidden` with `pointer-events: none`.
- The runtime loads after first paint (idle callback). Until then the Live icon shows a static
  SVG of its idle frame. `moments.riv` preloads as soon as any match is live.
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
| Choreography | Screen push, staggered cascades, tab indicator and content slide, live section open/close, card→hero and face→bust shared elements, toast swipe | Motion: `AnimatePresence`, variants, `layoutId` |
| Moments | Goal word, red-card hit, Live icon | Rive |

- `src/motion/tokens.ts` copies `TIMING_DEF` from `luau:366–381` verbatim (14 sections: dur,
  delay, stagger, cubic-bezier), plus the global `speed`, `toastHold`, `goalHold`, `goalFocus`
  and `goalMark`. Every animation reads from it. No inline durations anywhere.
- The Lua's design rule stays: curves settle and nothing bounces. Gestures (toast swipe, sheet)
  use springs with `bounce: 0`.
- Animate only `transform` and `opacity`, plus `filter` on at most 6 live cards. Motion `layout`
  goes on the few shared elements only, never on every list row.
- **Navigation model.** The list never unmounts. On phone, the match and player screens stack
  above it; on desktop they sit in panes beside it. Both ends of every shared element are
  therefore always mounted, and the list keeps its scroll position for free.
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
  `overscroll-behavior: contain`. Wheel, trackpad, keyboard and touch scrolling all come from the
  browser, so the wheel-to-drag shim is gone.
- Hover effects only under `@media (hover: hover) and (pointer: fine)`. Safe-area insets on phone.
- On load, desktop opens the featured match in pane 2, as it does today.

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
| Motion `layout` thrash | Shared elements only (§5) |
| Font loading | One self-hosted Hanken Grotesk variable woff2, preloaded, latin + latin-ext subset; `tabular-nums` on scores and clocks |
| Service worker serving a stale feed | The SW caches the app shell only and never `/feed` or `/events` |

Budgets: initial JS ≤ 180 KB gzip, Rive excluded. LCP ≤ 2.0 s on a mid-range Android over 4G.
INP ≤ 200 ms. No task longer than 50 ms while a poll is applied.

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
