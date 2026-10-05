# Scoreline rebuild: build plan

Read `docs/ARCHITECTURE.md` first. Each part below is sized for one session.

**Opus** takes the parts where a wrong call is expensive: data correctness, races, navigation
plumbing, runtime lifecycles, audits. **Sonnet** takes porting work that has a clear spec and a
Lua reference to copy from.

## Rules for every Sonnet session

1. Read `docs/ARCHITECTURE.md`. Don't reopen its decisions; if one blocks you, stop and say so.
2. Port, don't redesign. Copy the Lua's numbers (sizes, radii, colours, timings). `luau:<line>`
   refers to `legacy/scoreline_11.luau` (repo root until Part 1 moves it).
3. Stay inside the folders the part names. Read timings from `src/motion/tokens.ts`, never inline.
4. Done means `npm run check` passes and the part's own "done when" is met, with screenshots for
   UI parts.

**Review:** Opus reviews any diff touching `domain/`, `data/`, `store/`, `app/`, `motion/` or
`rive/`. Diffs that stay in `ui/` and `features/` are checked by screenshot tests and by you.

## Order

```
1 ─► 2 ─► 3 ─► 9 ─► 10‥16 (parallel) ─► 17 ─► 18, 19 ─► 21
      │    └─► 5            ▲                   ▲
      └─► 4                 │                   │
1 ─► 6 ─► 7 ────────────────┘                   │
1 ─► 8                                          │
20 (anytime, needs you in the Rive editor) ─────┘
22 (anytime after 2)
```

| # | Part | Model | After |
| --- | --- | --- | --- |
| 1 | Scaffold and tooling | Sonnet | – |
| 2 | Domain core and data contract v2 | **Opus** | 1 |
| 3 | Store and sync service | **Opus** | 2 |
| 4 | Domain helpers | Sonnet | 2 |
| 5 | DemoSource | Sonnet | 3 |
| 6 | Tokens and materials | Sonnet (Opus reviews) | 1 |
| 7 | SVG primitives and PlayerPhoto | Sonnet | 6 |
| 8 | Image pipeline | Sonnet | 1 |
| 9 | Shell, navigation, layouts, motion core | **Opus** | 3, 6 |
| 10 | Match list | Sonnet | 9, 7 |
| 11 | Match detail | Sonnet | 9, 7 |
| 12 | Momentum chart | Sonnet | 9 |
| 13 | Line-up | Sonnet | 9, 7 |
| 14 | Player view | Sonnet | 9, 7 |
| 15 | Desktop insights pane | Sonnet | 9 |
| 16 | Dev panel | Sonnet | 5, 9 |
| 17 | MomentDirector | **Opus** | 3, 9, 10 |
| 18 | Toast and scene (DOM) | Sonnet | 17 |
| 19 | Rive integration | **Opus** | 9 |
| 20 | Rive files | Sonnet + you | – |
| 21 | Hardening | **Opus** audit, Sonnet fixes | all |
| 22 | Adapter server | **Opus** design, Sonnet mapping | 2 |

Milestones:
- **M1** after 1–9: the shell runs on demo data at phone, tablet and desktop widths.
- **M2** after 10–16: every screen is ported and a demo matchday plays.
- **M3** after 17–20: goals and red cards celebrate, with Rive in place.
- **M4** after 21–22: real data, and the performance budgets are met.

---

## Parts

### 1 · Scaffold and tooling (Sonnet)
- **Build:** Vite, React 19, TypeScript strict, CSS Modules, Vitest, Playwright, and ESLint with
  the import rules from ARCHITECTURE §8. Create the §8 folder skeleton. Self-host the Hanken
  Grotesk variable woff2 and preload it. Add a PWA manifest. Move the four Rive-era files to
  `legacy/`. Add a GitHub Actions job: typecheck, lint, test, build.
- **Done when:** `npm run check` and `npm run build` pass in CI, and an empty shell renders.

### 2 · Domain core and data contract v2 (Opus)
- **Build:** Write `docs/DATA-CONTRACT.md`: `DATA-BINDING_4.md` §2–3 plus the additions in
  ARCHITECTURE §4.1. Add types and Zod schemas and the normalized state. Implement
  `applyFeed` / `applyEvent` → `{ state, moments }`, with structural sharing, dedupe by event id,
  the stale-snapshot guard on `seq`, goals detected from score diffs that never play twice,
  `goalCancelled`, and `liveMinute(match, now)`.
- **Ref:** `luau:7642–8105` (feed and event parsing), `luau:2268–2520` (model rules).
- **Done when:** tests cover a duplicate event, an event before its snapshot, a stale snapshot
  after an event, two goals in one poll, a score-diff goal followed by its late event (one
  moment only), a VAR cancel, and an unchanged poll keeping object identity.

### 3 · Store and sync service (Opus)
- **Build:** The Zustand store and its selector conventions. The `Source` interface:
  `start(onFeed, onEvent)`, `stop()`, `ensureMatchDetails(id)`. The sync service: ETag poll every
  15 s, SSE with `Last-Event-ID` resume, backoff with jitter, pause while the tab is hidden,
  refetch on visible and online, full resync after a reconnect gap.
- **Ref:** the bridge in `Scoreline_Fixed.html:9895–10059`.
- **Done when:** tests with a fake Source cover reconnect and resync, and a poll with no changes
  causes no store update.
- **Follow-up:** Before production, decide whether v1 feed compatibility should be removed so
  seq-based stale-snapshot protection is always enforced.

### 4 · Domain helpers (Sonnet)
- **Build:** Standings (`luau:2923–2976`), the live-list order with favourites first
  (`luau:3694–3703`), tonight's leaders, minute and score formatting (`luau:2431`, `2466–2478`),
  and the plain event lines (`plainLine`, `luau:7691`).
- **Done when:** unit tests reproduce the Lua's outputs on the demo data.
- **Follow-up:** A league without a sent `table` is counted from its team list and earlier
  results, which the v2 feed doesn't carry (the Lua read an undocumented `leagues[].teams` and
  kept `prior` in its demo data). `standings` takes them as a `LeagueBase` argument; until the
  contract carries them, such a league has no table. Decide in Part 5 or 22 whether to add them
  to the contract or have sources always send `table`.
  **Part 5:** DemoSource sends `table` for every league with a team list, counted with
  `standings` from the Lua's team lists and earlier results (`src/data/demo/wire.ts`). No contract
  change. Part 22 still decides the same for the real adapter.

### 5 · DemoSource (Sonnet)
- **Build:** Port the simulation (`luau:7342–7642`, `2521–2923`), the demo data
  (`luau:1746–2267`) and the JS demo (`Scoreline_Fixed.html:9967–10053`) into a `DemoSource`
  that emits contract-shaped feeds and events with `seq`. Add a seed for deterministic tests.
- **Done when:** a full matchday plays with no backend, and `?demo=fast` runs it at 10×.

### 6 · Tokens and materials (Sonnet, Opus reviews)
- **Build:** `tokens.css`: colours and the 5 spectrum gradients (`luau:1018–1046`), curves,
  radii, a type scale taken from the Lua's text sizes. The materials:
  - Glass (`luau:3199–3315`).
  - SoftLight: a smooth radial with many stops and no banding.
  - The hover light: `--mx` / `--my` set in a pointermove handler, not in React state.
  - Button with press dip and letter roll (`luau:3339–3460`).
  - Pill, and Tabs with a sliding indicator.

  Show them all on a `/dev/kit` route.
- **Done when:** `/dev/kit` screenshots at 390 and 1280 match the Lua materials, and the codebase
  has no `backdrop-filter`.

### 7 · SVG primitives and PlayerPhoto (Sonnet)
- **Build:**
  - Icon sprite from `ICON_SRC` (`luau:3031–3105`).
  - `Crest`, from the `teams[].flag` grammar and the built-in `FLAGS` (`luau:1771`, drawn at
    `3143–3186`).
  - Ball, boot, card and sub tags, and `RatingBadge` (`luau:3462–3632`).
  - `PlayerPhoto` with the kit-disc fallback (`luau:3632–3686`).
  - `MatchClock` as a leaf subscriber.
- **Done when:** `/dev/kit` shows each primitive for every demo team.

### 8 · Image pipeline (Sonnet)
- **Build:** `scripts/slice-atlas.ts` (sharp). It uses the atlas geometry (`ATLAS` / `CROP`,
  `luau:1461–1508`) to cut per-player bust, head and frost images as AVIF and WebP at 1× and 2×,
  and writes `manifest.json`.
- **Needs:** the `squad_fra` / `squad_arg` source images, which you supply (they're not in the
  repo).
- **Done when:** the manifest covers every player, and each bust@2x is ≤ 40 KB.

### 9 · Shell, navigation, layouts, motion core (Opus)
- **Build:**
  - Routes and URL state (§4.5).
  - The PhoneStack, TwoPane and ThreePane layouts with the list always mounted (§5, §6).
  - Per-pane native scroll with scroll restoration, and focus management on navigation.
  - `motion/tokens.ts`, the variant helpers (`cascade(key)`) and `MotionConfig`.
  - The match push and the player's centre scale (ARCHITECTURE §5). The card→hero and
    face→bust shared elements first built here were removed after the 2026-10-04 review: the Lua
    has none, and nothing flies between screens.
- **Done when:** navigation works at 390, 900 and 1280 px, back and forward behave, and the push
  and the player's open and close play in both directions and hold up under rapid taps.

### 10 · Match list (Sonnet)
- **Build:**
  - DayTabs: sliding indicator and the Today↔Ongoing morph (`luau:3705–3736`).
  - The Live section: cards plus the open/close animation (`luau:3743–3924`).
  - League groups and match rows (`luau:3925–4044`).
  - FollowCard, with its picker and phases (`luau:4045–4527`).

  Timings: `cards`, `live`, `list`, `follow`.
- **Done when:** the list matches the demo data at 390 and in pane 1 at 1280, with screenshot
  tests.

### 11 · Match detail (Sonnet)
- **Build:**
  - The hero (`luau:4721–4827`) and the tab bar.
  - Facts: events feed, match info and form (`luau:4990–5326`).
  - Stats (`luau:5327–5383`) and Table (`luau:5698–5780`).

  Timings: `screen`, `tabs`, `events`, `stats`.
- **Done when:** all four tabs render the demo matches, and live events slide into Facts.

### 12 · Momentum chart (Sonnet)
- **Build:** An SVG wave in the two teams' colours: midline, draw-on reveal, goal balls popping
  in on a stagger (`luau:4828–4989`). Recompute the path only when `match.mom` changes identity.
- **Done when:** the chart matches the Lua at both widths and doesn't re-render on clock ticks.

### 13 · Line-up (Sonnet)
- **Build:**
  - The pitch, with formation rows (`luau:2320–2425`) and markers rising line by line.
  - The team switch, player rows, coach and squad list (`luau:5384–5697`).

  Player chips are buttons that open the player route.
- **Done when:** every demo formation lays out correctly and the tags show goals, cards and subs.

### 14 · Player view (Sonnet)
- **Build:** The hero bust, the giant shirt number, the line of light and the sheet blocks
  (`luau:5845–6179`). It opens the same way from every origin: the bust grows at the centre
  from 0.9 to 1 (ARCHITECTURE §5).
- **Done when:** the view opens from the line-up, the list and the follow card on phone and in
  pane 3.

### 15 · Desktop insights pane (Sonnet)
- **Build:** Pane 3's Player / Tables / Leaders switch (`luau:6764–7090`).
- **Done when:** it matches the Lua desktop at 1280 × 892.

### 16 · Dev panel (Sonnet)
- **Build:** The seven old triggers (`goalHome` … `fullTime`) fired through DemoSource,
  pause/restart for the simulation, and live editing of the motion tokens with copy-as-JSON.
  Dev builds only.
- **Done when:** none of it is in the production bundle.

### 17 · MomentDirector (Opus)
- **Build:**
  - Consume moments from the store into a queue with priority: the open or followed match gets a
    scene, every other match gets a toast.
  - Collapse the queue when it overflows. While the tab is hidden, hold moments and show a
    summary on return.
  - Expose the goal-focus, goal-mark and card-flood states for the list and hero to read.
  - Announce through an aria-live region.
- **Ref:** `celebrate` / `landGoal` / `showRed` / `endMatch` (`luau:7352–7449`), the timers at
  `luau:8608–8622`.
- **Done when:** tests cover 4 goals in one poll, a goal while a scene is playing, and a goal
  while the tab is hidden.

### 18 · Toast and scene, DOM parts (Sonnet)
- **Build:**
  - The toast: photo rise, name swap, swipe to dismiss (`luau:6186–6283`).
  - The scene: the flag and word container rising, the scorer bust, the score strip and the
    commentary (`luau:6423–6656`).

  Use a plain DOM word as a stand-in until 19 and 20 land.
- **Done when:** the dev panel triggers play both scenes and the toast at 390 and 1280.

### 19 · Rive integration (Opus)
- **Build:**
  - A lazy loader and a single shared offscreen renderer.
  - `RiveCanvas`: pause off-screen and while hidden, `cleanup()` on unmount.
  - `LiveIcon`: a button wrapper writing URL `live` → `islive` (one way; Rive never writes back),
    with a static SVG until the runtime loads.
  - `GoalWord`: sets the View Model inputs and listens to `phase` to drive the scene.
- **Ref:** the runtime setup in `Scoreline_Fixed.html:10060–10253`, and the icon wiring at
  `luau:8293–8378`.
- **Done when:** the initial bundle is unchanged, the heap is stable after 20 goal scenes, and
  nothing renders while the tab is hidden.

### 20 · Rive files (Sonnet + you)
- **Sonnet:** extract `shoutWord` / `slamWord`, their helpers, and only the glyphs they need into
  `rive/moments.luau`. Inputs: `kind`, `color1`, `color2`, `play`. Output: `phase`. Follow
  ARCHITECTURE §3.
- **You, in the Rive editor:** build `moments.riv` around that script, and export the Live icon
  artboard on its own as `live-icon.riv`.
- **Done when:** both files are within the size budget and set `phase` in the editor.

### 21 · Hardening (Opus audits, Sonnet fixes)
- **Opus:** profile a poll tick and a goal moment at 6× CPU throttle; run Lighthouse mobile;
  check the §7 budgets; do a keyboard and VoiceOver pass. Write the findings up as issues.
- **Sonnet:** fix them, one issue per session.

### 22 · Adapter server (Opus designs, Sonnet maps)
- **Opus:** design the service. It polls the provider and keeps a per-match `seq`, serves
  `/feed` with an ETag, and serves `/events` over SSE with `Last-Event-ID` replay. Also decide
  how it's deployed.
- **Sonnet:** map the provider's fields per `DATA-BINDING_4.md` §5, with tests against recorded
  provider fixtures.
- **First:** pick the data provider.
