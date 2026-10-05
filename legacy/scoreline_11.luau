--!strict
-- =====================================================================
-- SCORELINE · SPECTRUM  —  the whole app in one Rive Node Script
-- One script for both artboards:
--   Phone     artboard 390 x 844    input desktop = off
--   Desktop   artboard 1280 x 892   input desktop = on   (three glass panes:
--             the matches | the open match | player · tables · leaders)
-- Place the script at x = 0, y = 0 of its artboard. Press Play.
-- Tap, drag to scroll — everything runs by itself.
--
-- PHOTOS (France – Argentina)
--   Import squad_fra and squad_arg (4032 x 3556; .webp is ~2 MB, .png ~10 MB,
--   same pixels) into the Assets panel and keep those names. They hold the
--   busts at twice the old resolution, the head cut-outs and the frosted busts
--   seen through glass. (The grain tile still in them is no longer used: soft
--   lights are smooth without noise.) Without them the app still runs and
--   draws shirt numbers.
--
-- LIVE ICON (unchanged)
--   liveIcon        Artboard  your Live icon artboard
--   iconViewModel   String    name of its View Model (holds "islive")
--
-- VIEW MODEL — bind one to the artboard. Every property is optional; the
-- app finds them by name.
--   Live data from your API (the JSON is described in DATA-BINDING.md)
--   feed            String    the whole picture: teams, leagues, squads and
--                             every match. Send it again whenever it changes;
--                             new goals, cards and final whistles play their
--                             moment. The demo simulation stops for good.
--   event           String    one moment, played as it arrives: goal, red,
--                             yellow, sub, fulltime, kickoff, minute, action
--   State, both ways (the host may set them; the app writes them back)
--   day             Number    the day tab, 1-5 (3 = Today / Ongoing)
--   liveOnly        Boolean   the Live filter
--   openMatch       Number    the open match id (0 = the list)
--   followTeam      String    the followed player's team id
--   followNumber    Number    and his shirt number
--   Triggers, to play the moments by hand
--   goalHome        Trigger   the home side scores in the featured match
--   goalAway        Trigger   the away side scores in the featured match
--   goalFavorite    Trigger   the player you follow scores (if he is on the pitch)
--   redHome         Trigger   a home player is sent off (featured match)
--   redAway         Trigger   an away player is sent off (featured match)
--   redFavorite     Trigger   the player you follow is sent off (if he is on the pitch)
--   fullTime        Trigger   the final whistle in the followed player's match
--                             (the featured match if his match is not live)
--
-- MOTION CONTROLS — every section has 7 number inputs on this script:
--   <section>Dur       seconds one item takes to animate
--   <section>Delay     seconds before the first item starts
--   <section>Stagger   seconds between one item and the next
--   <section>X1 Y1 X2 Y2   the cubic-bezier curve, like CSS cubic-bezier()
--                          (X between 0 and 1; Y may overshoot for a bounce)
--
--   section     what it animates                                       default  Dur Delay Stagger | X1 Y1 X2 Y2
--   cards       Live cards rising in (app start, Live on)                0.75 0.1 0.06 | 0.16 1 0.3 1
--               Stagger = gap between one card and the next
--   live        Live section opening / closing                           0.6 0 0.04 | 0.16 1 0.3 1
--               On close the cards settle and fade one by one: Stagger = gap between cards
--   list        Day tabs indicator + match list after a day change       0.5 0.05 0.03 | 0.2 0.8 0.2 1
--               Rows cascade in: Stagger = gap between rows
--   screen      Opening / closing a match (push)                         0.55 0 0.05 | 0.16 1 0.3 1
--               Header, team rows, tabs, content cascade: Stagger = gap between blocks
--   tabs        Switching tabs (indicator, content slide), the team switch and  0.45 0 0.06 | 0.2 0.8 0.2 1
--               the desktop's Player · Tables · Leaders switch
--               Content follows the indicator by Stagger
--   momentum    Momentum wave drawing from 0' to now                     0.9 0.1 0.06 | 0.16 1 0.3 1
--               Goal balls pop one after another: Stagger = gap between goals
--   events      Event rows (and each new live event sliding in)          0.5 0.15 0.04 | 0.16 1 0.3 1
--               Stagger = gap between rows
--   stats       Possession, stat bars and table rows                     0.9 0.15 0.06 | 0.16 1 0.3 1
--               Stagger = gap between bars / rows
--   lineup      Players rising into place: forwards, midfield, defence, keeper  0.6 0.1 0.14 | 0.16 1 0.3 1
--               Stagger = gap between lines (players in a line: a quarter of it)
--   squad       Substitutes / squad list rows                            0.5 0.3 0.03 | 0.16 1 0.3 1
--               Stagger = gap between rows
--   player      Player profile: photo zoom, then the info sheet          0.72 0.12 0.05 | 0.32 0 0.1 1
--               Dur = zoom; Delay = sheet after the photo; Stagger = gap between sheet blocks
--   toast       Goal notification                                        0.6 0.45 0.2 | 0.16 1 0.3 1
--               Dur = each step; Delay = photo after the flag; Stagger = name after the photo
--   goal        Goal and red card scenes                                 0.7 0.1 0.55 | 0.16 1 0.3 1
--               Delay = the headline in the middle; Stagger = player to commentary.
--               GOAAAL: letters a tenth of Dur apart, each lands in 0.72 Dur,
--               the word holds 1.2 Dur before it rises
--   follow      Followed player card (new actions, stat tiles, goal moment)  0.5 0 0.06 | 0.16 1 0.3 1
--               Stagger = gap between stat tiles / quick picks
--
--   speed       Global speed. 1 = as designed, 0.5 = everything twice as slow, 2 = twice as fast (default 1)
--   toastHold   Seconds the goal notification stays before it leaves on its own (default 4.5)
--   goalHold    Seconds the goal scene stays before it closes on its own (default 7.5)
--   goalFocus   Seconds the other live cards stay grey after a goal, so the scoring
--               card is the only one in colour (default 4)
--   goalMark    Seconds the new score stays in our spectrum, on its card and its row,
--               so a goal you missed is still there to see (default 8)
-- =====================================================================

type Curve = { x1: number, y1: number, x2: number, y2: number }
type Timing = { dur: number, delay: number, stagger: number, c: Curve }
type Glyph = { adv: number, path: Path, cmds: { number } }
type GlyphSet = { [string]: Glyph }
type TextPath = { path: Path, adv: number }
type Hit = { x: number, y: number, w: number, h: number, fn: () -> (), id: string }
type Tween = { a: number, b: number, t0: number, dur: number, c: Curve? }
type Scroll = { y: number, v: number, max: number }

type Team = { key: string, name: string, short: string, c1: number, c2: number }
type Person = {
    team: string, n: number, first: string, last: string, short: string,
    pos: string, role: string, club: string, born: { number }, h: number, cell: number,
}
type Event = {
    id: number, kind: string, side: string, min: number,
    p: string, o: string, pn: number, on: number, gt: string, s: string, t0: number,
    txt: string, xg: number,
}
type Stat = { name: string, a: number, b: number, fmt: string }
type Lineup = {
    team: string, form: string, xi: { number }, bench: { number },
    on: { [number]: number }, off: { [number]: number }, forr: { [number]: number },
    goals: { [number]: number }, assists: { [number]: number }, yc: { [number]: number }, rc: { [number]: number },
}
type Match = {
    id: number, day: number, lg: string, h: string, a: string,
    hs: number, as: number, status: string, min: number, sec: number, time: string,
    feat: boolean, ready: boolean, events: { Event }, plan: { Event }, mom: { number },
    poss: number, stats: { Stat }, lu: { [string]: Lineup },
    flashT: number, bumpSide: string, bumpT: number, goalT: number, goalSide: string,
    ftT: number, cw: Tween, sink: number, fx: { [string]: { number } }, ver: number,
    -- live data: stats came from the feed (not counted from events), player numbers from the feed
    fstats: boolean, pst: { [string]: { [string]: number } },
}
type Act = { t: number, txt: string, kind: string, clock: string }
type Follow = {
    team: string, n: number, t: number, acts: { Act }, nextT: number,
    goalT: number, pickT: number, stats: { number }, statT: number,
    -- on the ball now; when it goes off the ball again; card open (and its tween); height;
    -- when he was sent off; the card's phase (live / red / post / pre / none) and since when
    ball: boolean, ballT: number, open: boolean, openK: Tween, hgt: Tween, redT: number, phase: string, phT: number,
}
type Scene = { m: number, ev: Event, t0: number, outT: number, kind: string }
-- a button's motion state: hover light, press dip, letter roll
type UiState = { h: Tween, hv: boolean, pr: boolean, pt: number, rt: number, pk: number, rollT: number, seen: number, hx: number, hy: number }

export type Scoreline = {
    liveIcon: Input<Artboard<nil>>,
    iconViewModel: Input<string>,
    cardsDur: Input<number>,
    cardsDelay: Input<number>,
    cardsStagger: Input<number>,
    cardsX1: Input<number>,
    cardsY1: Input<number>,
    cardsX2: Input<number>,
    cardsY2: Input<number>,
    liveDur: Input<number>,
    liveDelay: Input<number>,
    liveStagger: Input<number>,
    liveX1: Input<number>,
    liveY1: Input<number>,
    liveX2: Input<number>,
    liveY2: Input<number>,
    listDur: Input<number>,
    listDelay: Input<number>,
    listStagger: Input<number>,
    listX1: Input<number>,
    listY1: Input<number>,
    listX2: Input<number>,
    listY2: Input<number>,
    screenDur: Input<number>,
    screenDelay: Input<number>,
    screenStagger: Input<number>,
    screenX1: Input<number>,
    screenY1: Input<number>,
    screenX2: Input<number>,
    screenY2: Input<number>,
    tabsDur: Input<number>,
    tabsDelay: Input<number>,
    tabsStagger: Input<number>,
    tabsX1: Input<number>,
    tabsY1: Input<number>,
    tabsX2: Input<number>,
    tabsY2: Input<number>,
    momentumDur: Input<number>,
    momentumDelay: Input<number>,
    momentumStagger: Input<number>,
    momentumX1: Input<number>,
    momentumY1: Input<number>,
    momentumX2: Input<number>,
    momentumY2: Input<number>,
    eventsDur: Input<number>,
    eventsDelay: Input<number>,
    eventsStagger: Input<number>,
    eventsX1: Input<number>,
    eventsY1: Input<number>,
    eventsX2: Input<number>,
    eventsY2: Input<number>,
    statsDur: Input<number>,
    statsDelay: Input<number>,
    statsStagger: Input<number>,
    statsX1: Input<number>,
    statsY1: Input<number>,
    statsX2: Input<number>,
    statsY2: Input<number>,
    lineupDur: Input<number>,
    lineupDelay: Input<number>,
    lineupStagger: Input<number>,
    lineupX1: Input<number>,
    lineupY1: Input<number>,
    lineupX2: Input<number>,
    lineupY2: Input<number>,
    squadDur: Input<number>,
    squadDelay: Input<number>,
    squadStagger: Input<number>,
    squadX1: Input<number>,
    squadY1: Input<number>,
    squadX2: Input<number>,
    squadY2: Input<number>,
    playerDur: Input<number>,
    playerDelay: Input<number>,
    playerStagger: Input<number>,
    playerX1: Input<number>,
    playerY1: Input<number>,
    playerX2: Input<number>,
    playerY2: Input<number>,
    toastDur: Input<number>,
    toastDelay: Input<number>,
    toastStagger: Input<number>,
    toastX1: Input<number>,
    toastY1: Input<number>,
    toastX2: Input<number>,
    toastY2: Input<number>,
    goalDur: Input<number>,
    goalDelay: Input<number>,
    goalStagger: Input<number>,
    goalX1: Input<number>,
    goalY1: Input<number>,
    goalX2: Input<number>,
    goalY2: Input<number>,
    followDur: Input<number>,
    followDelay: Input<number>,
    followStagger: Input<number>,
    followX1: Input<number>,
    followY1: Input<number>,
    followX2: Input<number>,
    followY2: Input<number>,
    speed: Input<number>,
    toastHold: Input<number>,
    goalHold: Input<number>,
    goalFocus: Input<number>,
    goalMark: Input<number>,
    desktop: Input<boolean>,
    icon: Artboard<nil>?,
    iconLive: any,
    iconRect: { number },
    iconDown: boolean,
    ready: boolean,
    iconTries: number,
    t: number,
    playing: boolean,
    tm: { [string]: Timing },
    tmT: number,
    -- drawing caches
    fonts: { [string]: GlyphSet },
    tcache: { [string]: { [number]: { [string]: TextPath } } },
    tcount: number,
    shapes: { [string]: Path },
    sfast: { any },
    scount: number,
    unit: Path,
    circ: Path,
    icons: { [string]: Path },
    grads: { [string]: Gradient },
    gcount: number,
    pc: { [number]: { [number]: { any } } },
    px: { [string]: { any } },
    pn: number,
    ga: number,
    ox: number,
    oy: number,
    ostack: { number },
    clipTop: number,
    clipBot: number,
    hits: { Hit },
    frame: number,
    retired: { { any } },
    ui: { [string]: UiState },
    hover: { x: number, y: number, on: boolean },
    press: { id: string, x: number, y: number },
    atlas: { [string]: Image },
    sampler: ImageSampler,
    -- data binding
    vm: { [string]: any },
    auto: boolean,
    feedMode: boolean,           -- true once a feed has arrived: no demo simulation
    vmOut: { [string]: any },    -- what the app last wrote to its two-way properties
    vmPoll: { [string]: any },   -- string properties read by polling (no listener)
    vmPrimed: boolean,
    evIds: { [string]: number },  -- live events already played, by match and event id
    -- app state
    day: number,
    liveOnly: boolean,
    liveK: Tween,
    liveOnT: number,
    liveOffT: number,
    openId: number,
    tab: number,
    screen: Tween,
    screenT: number,
    feedT: number,
    feedDir: number,
    paneT: number,
    paneDir: number,
    dayShift: Tween,
    dayIndX: Tween,
    dayIndW: Tween,
    tabIndX: Tween,
    listScroll: Scroll,
    detailScroll: Scroll,
    playerScroll: Scroll,
    drag: { active: boolean, x0: number, y0: number, lastY: number, lastT: number, moved: boolean, target: string, start: number, vy: number },
    collapsed: { [string]: Tween },
    favMatch: { [number]: boolean },
    fol: Follow?,
    luSide: string,
    luK: Tween,
    luT: number,
    evAll: boolean,
    evT: number,
    heads: { [string]: { number } },
    pv: { open: boolean, t: number, team: string, n: number, mid: number, from: { number }, prevT: number, dir: number, bars: { Tween }, rating: Tween, origin: string },
    sheetOpen: boolean,
    sheetT: number,
    toast: { m: number, ev: Event?, t: number, dy: number, outT: number, outFrom: number, held: boolean },
    clock0: number,
    scene: Scene?,
    lastGoal: { m: number, ev: Event? },
    tickAcc: number,
    endedT: number,
    rand: () -> number,
    evSeq: number,
    matches: { Match },
    tabOpenT: number,
    heroBumpT: number,
    heroBumpSide: string,
    firstLayout: boolean,
    -- desktop: three panes; the third shows the player, the tables or tonight's leaders
    desk: boolean,
    aw: number,
    ah: number,
    deskTab: number,
    deskTabK: Tween,
    deskTabT: number,
    insightScroll: Scroll,
    clipL: number,
    clipR: number,
    iconO: { number },
    toastO: { number },
}

-- W x H: one screen (the whole phone, or one pane of the desktop app).
-- The artboard itself is self.aw x self.ah: the same on the phone, three panes wide on the desktop.
local W, H = 390, 844
-- the desktop app: three panes on a 1280 x 892 artboard (list | match | player, table, leaders)
local DESK_W, DESK_H = 1280, 892
local PANES: { [string]: { number } } = { a = { 31, 24 }, b = { 445, 24 }, c = { 859, 24 } }
local TIMING_KEYS = { "cards", "live", "list", "screen", "tabs", "momentum", "events", "stats", "lineup", "squad", "player", "toast", "goal", "follow" }
local TIMING_DEF: { [string]: { number } } = {
    cards = { 0.75, 0.1, 0.06, 0.16, 1, 0.3, 1 },
    live = { 0.6, 0, 0.04, 0.16, 1, 0.3, 1 },
    list = { 0.5, 0.05, 0.03, 0.2, 0.8, 0.2, 1 },
    screen = { 0.55, 0, 0.05, 0.16, 1, 0.3, 1 },
    tabs = { 0.45, 0, 0.06, 0.2, 0.8, 0.2, 1 },
    momentum = { 0.9, 0.1, 0.06, 0.16, 1, 0.3, 1 },
    events = { 0.5, 0.15, 0.04, 0.16, 1, 0.3, 1 },
    stats = { 0.9, 0.15, 0.06, 0.16, 1, 0.3, 1 },
    lineup = { 0.6, 0.1, 0.14, 0.16, 1, 0.3, 1 },
    squad = { 0.5, 0.3, 0.03, 0.16, 1, 0.3, 1 },
    player = { 0.72, 0.12, 0.05, 0.32, 0, 0.1, 1 },
    toast = { 0.6, 0.45, 0.2, 0.16, 1, 0.3, 1 },
    goal = { 0.7, 0.1, 0.55, 0.16, 1, 0.3, 1 },
    follow = { 0.5, 0, 0.06, 0.16, 1, 0.3, 1 },
}



local GLYPHS: { [string]: { [string]: { any } } } = {}
GLYPHS.L = {
    ["%"] = { 743, "M 120 0 L 573 -697 L 620 -697 L 167 0 Z M 538 7 Q 495 7 460 -14 Q 425 -34 404 -70 Q 382 -107 382 -153 Q 382 -199 403 -235 Q 424 -271 459 -292 Q 494 -312 537 -312 Q 580 -312 615 -290 Q 650 -269 671 -233 Q 692 -197 692 -153 Q 692 -109 671 -73 Q 650 -37 616 -15 Q 581 7 538 7 Z M 538 -37 Q 569 -37 594 -52 Q 618 -68 633 -94 Q 648 -121 648 -153 Q 648 -186 633 -212 Q 618 -238 593 -253 Q 568 -268 537 -268 Q 506 -268 481 -253 Q 456 -238 441 -212 Q 426 -187 426 -153 Q 426 -119 442 -92 Q 457 -66 482 -52 Q 508 -37 538 -37 Z M 207 -386 Q 164 -386 128 -406 Q 93 -427 72 -463 Q 51 -499 51 -544 Q 51 -591 72 -627 Q 93 -663 128 -684 Q 163 -704 205 -704 Q 249 -704 284 -682 Q 319 -661 340 -625 Q 361 -589 361 -544 Q 361 -501 340 -465 Q 319 -429 284 -408 Q 250 -386 207 -386 Z M 207 -430 Q 237 -430 262 -445 Q 286 -460 301 -486 Q 316 -512 316 -544 Q 316 -578 301 -604 Q 286 -630 261 -645 Q 236 -660 205 -660 Q 175 -660 150 -646 Q 125 -631 110 -605 Q 95 -579 95 -544 Q 95 -511 110 -485 Q 125 -459 150 -444 Q 176 -430 207 -430 Z" },
    ["0"] = { 560, "M 283 7 Q 228 7 190 -14 Q 151 -35 126 -71 Q 101 -107 87 -152 Q 73 -198 68 -249 Q 62 -300 62 -350 Q 62 -400 67 -450 Q 72 -501 86 -546 Q 100 -592 124 -628 Q 149 -664 187 -684 Q 225 -705 279 -705 Q 330 -705 368 -686 Q 405 -666 430 -632 Q 456 -598 470 -553 Q 485 -508 492 -456 Q 499 -404 499 -349 Q 499 -294 492 -242 Q 486 -190 471 -145 Q 456 -100 431 -66 Q 406 -32 370 -12 Q 333 7 283 7 Z M 283 -54 Q 337 -54 370 -92 Q 404 -130 420 -196 Q 435 -262 435 -347 Q 435 -435 419 -502 Q 403 -569 369 -607 Q 335 -645 279 -645 Q 234 -645 204 -621 Q 175 -597 158 -556 Q 141 -515 134 -462 Q 126 -408 126 -348 Q 126 -290 134 -237 Q 141 -184 158 -143 Q 176 -102 206 -78 Q 237 -54 283 -54 Z" },
    ["1"] = { 560, "M 301 0 L 301 -533 L 118 -533 L 118 -585 L 246 -585 Q 273 -585 287 -596 Q 301 -608 301 -637 L 301 -697 L 365 -697 L 365 0 Z" },
    ["2"] = { 560, "M 53 0 L 53 -57 Q 90 -87 138 -123 Q 187 -159 236 -200 Q 285 -242 326 -289 Q 368 -336 394 -388 Q 419 -439 419 -495 Q 419 -561 381 -602 Q 343 -642 273 -642 Q 222 -642 187 -620 Q 152 -597 134 -557 Q 117 -517 116 -464 L 54 -468 Q 54 -518 68 -560 Q 83 -603 112 -635 Q 140 -667 181 -685 Q 222 -703 275 -703 Q 337 -703 383 -678 Q 429 -652 455 -606 Q 481 -560 481 -497 Q 481 -439 458 -386 Q 436 -332 398 -284 Q 359 -236 310 -193 Q 262 -150 209 -112 Q 171 -84 133 -59 L 509 -59 L 509 0 Z" },
    ["3"] = { 560, "M 275 7 Q 202 7 147 -20 Q 92 -46 62 -94 Q 32 -143 32 -207 L 94 -211 Q 94 -138 144 -96 Q 194 -54 277 -54 Q 331 -54 371 -72 Q 411 -90 432 -124 Q 454 -157 454 -201 Q 454 -243 436 -270 Q 418 -298 387 -314 Q 356 -329 316 -336 Q 277 -342 234 -342 L 234 -393 Q 266 -393 298 -398 Q 331 -404 358 -418 Q 384 -432 400 -457 Q 416 -482 416 -520 Q 416 -556 398 -584 Q 380 -613 348 -628 Q 316 -644 274 -644 Q 206 -644 166 -606 Q 127 -569 126 -509 L 64 -513 Q 64 -570 91 -613 Q 118 -656 166 -680 Q 214 -704 276 -704 Q 335 -704 380 -681 Q 426 -658 452 -618 Q 479 -578 479 -525 Q 479 -491 468 -466 Q 457 -440 437 -422 Q 417 -403 394 -392 Q 370 -381 345 -374 Q 376 -369 406 -357 Q 437 -345 462 -324 Q 487 -303 502 -272 Q 517 -242 517 -201 Q 517 -139 486 -92 Q 455 -45 401 -19 Q 347 7 275 7 Z" },
    ["4"] = { 560, "M 365 0 L 365 -167 L 20 -167 L 20 -219 L 368 -697 L 428 -697 L 428 -226 L 542 -226 L 542 -167 L 428 -167 L 428 0 Z M 89 -226 L 365 -226 L 365 -612 Z" },
    ["5"] = { 560, "M 279 7 Q 220 7 170 -18 Q 120 -43 88 -88 Q 55 -133 43 -192 L 105 -203 Q 113 -160 136 -126 Q 160 -92 196 -72 Q 232 -53 278 -53 Q 331 -53 370 -78 Q 409 -104 430 -146 Q 452 -187 452 -236 Q 452 -284 432 -322 Q 412 -360 375 -382 Q 338 -405 286 -405 Q 240 -405 200 -384 Q 160 -362 130 -320 L 65 -339 L 129 -697 L 485 -697 L 485 -638 L 180 -638 L 138 -399 Q 168 -430 203 -446 Q 248 -466 295 -466 Q 360 -466 410 -435 Q 461 -404 490 -352 Q 518 -299 518 -236 Q 518 -186 500 -142 Q 483 -98 450 -64 Q 418 -31 374 -12 Q 330 7 279 7 Z" },
    ["6"] = { 560, "M 350 -697 L 184 -425 Q 199 -433 216 -439 Q 245 -449 275 -449 Q 338 -449 390 -418 Q 442 -388 472 -336 Q 502 -285 502 -222 Q 502 -158 470 -106 Q 438 -54 385 -24 Q 332 7 267 7 Q 203 7 149 -23 Q 95 -53 63 -105 Q 31 -157 31 -221 Q 31 -257 42 -288 Q 52 -319 68 -346 L 278 -697 Z M 267 -393 Q 221 -393 182 -370 Q 143 -348 120 -310 Q 96 -271 96 -222 Q 96 -174 119 -136 Q 142 -97 181 -75 Q 220 -53 267 -53 Q 314 -53 353 -75 Q 392 -97 415 -136 Q 438 -175 438 -223 Q 438 -271 415 -310 Q 392 -348 354 -370 Q 315 -393 267 -393 Z" },
    ["7"] = { 560, "M 114 0 L 453 -638 L 29 -638 L 29 -697 L 527 -697 L 527 -646 L 184 0 Z" },
    ["8"] = { 560, "M 280 7 Q 221 7 168 -16 Q 114 -39 80 -84 Q 47 -130 47 -198 Q 47 -263 82 -312 Q 118 -360 180 -379 Q 138 -397 112 -436 Q 87 -474 87 -527 Q 87 -583 116 -622 Q 144 -662 188 -683 Q 233 -704 281 -704 Q 335 -704 379 -682 Q 423 -659 448 -618 Q 474 -578 474 -522 Q 474 -471 448 -434 Q 423 -396 380 -379 Q 442 -359 477 -311 Q 512 -263 512 -198 Q 512 -130 479 -84 Q 446 -39 393 -16 Q 340 7 280 7 Z M 280 -53 Q 325 -53 364 -70 Q 402 -87 426 -120 Q 449 -154 449 -204 Q 449 -249 428 -282 Q 406 -316 368 -334 Q 330 -353 280 -353 Q 230 -353 192 -334 Q 154 -316 132 -282 Q 110 -249 110 -204 Q 110 -154 134 -120 Q 158 -87 197 -70 Q 236 -53 280 -53 Z M 282 -397 Q 339 -397 376 -431 Q 412 -465 412 -518 Q 412 -574 376 -609 Q 341 -644 281 -644 Q 247 -644 217 -630 Q 187 -616 168 -589 Q 150 -562 150 -523 Q 150 -466 187 -432 Q 224 -397 282 -397 Z" },
    ["9"] = { 560, "M 197 0 L 362 -273 Q 347 -264 331 -259 Q 302 -248 271 -248 Q 208 -248 156 -278 Q 105 -309 74 -360 Q 44 -412 44 -475 Q 44 -540 76 -592 Q 108 -643 162 -674 Q 215 -704 279 -704 Q 344 -704 398 -674 Q 451 -644 483 -592 Q 515 -541 515 -476 Q 515 -440 504 -410 Q 494 -379 478 -351 L 268 0 Z M 279 -304 Q 326 -304 364 -326 Q 403 -349 426 -388 Q 450 -426 450 -475 Q 450 -523 427 -562 Q 404 -600 365 -622 Q 326 -644 279 -644 Q 232 -644 193 -622 Q 154 -600 131 -561 Q 108 -522 108 -474 Q 108 -426 131 -388 Q 154 -349 193 -326 Q 232 -304 279 -304 Z" },
    [":"] = { 240, "M 82 -363 L 82 -471 L 158 -471 L 158 -363 Z M 82 0 L 82 -108 L 158 -108 L 158 0 Z" },
    ["–"] = { 394, "M 19 -284 L 19 -332 L 375 -332 L 375 -284 Z" },
}
GLYPHS.R = {
    [" "] = { 260, "" },
    ["!"] = { 240, "M 88 -202 L 78 -697 L 163 -697 L 153 -202 Z M 70 0 L 70 -116 L 170 -116 L 170 0 Z" },
    ["\""] = { 338, "M 51 -414 L 51 -697 L 123 -697 L 123 -414 Z M 214 -414 L 214 -697 L 286 -697 L 286 -414 Z" },
    ["#"] = { 699, "M 128 0 L 173 -209 L 53 -209 L 53 -270 L 186 -270 L 221 -439 L 94 -439 L 94 -503 L 234 -503 L 277 -697 L 345 -697 L 302 -500 L 458 -500 L 500 -697 L 568 -697 L 525 -500 L 646 -500 L 646 -439 L 512 -439 L 475 -270 L 605 -270 L 605 -209 L 463 -209 L 418 0 L 351 0 L 396 -209 L 239 -209 L 196 0 Z M 254 -270 L 410 -270 L 444 -439 L 288 -439 Z" },
    ["$"] = { 560, "M 253 112 L 253 9 Q 174 0 120 -44 Q 53 -99 38 -190 L 124 -211 Q 135 -141 182 -104 Q 228 -68 295 -68 Q 334 -68 365 -83 Q 396 -98 414 -126 Q 432 -153 432 -188 Q 432 -225 412 -249 Q 392 -273 356 -291 Q 321 -309 274 -327 Q 216 -349 172 -375 Q 129 -401 105 -438 Q 81 -474 81 -527 Q 81 -580 107 -621 Q 133 -662 180 -686 Q 213 -702 253 -707 L 253 -808 L 313 -808 L 313 -708 Q 364 -703 406 -679 Q 457 -649 488 -590 L 418 -547 Q 395 -588 362 -610 Q 329 -631 286 -631 Q 252 -631 226 -618 Q 199 -605 184 -582 Q 169 -559 169 -529 Q 169 -497 187 -474 Q 205 -452 239 -435 Q 273 -418 321 -400 Q 382 -377 426 -350 Q 470 -323 494 -286 Q 519 -248 519 -193 Q 519 -134 490 -88 Q 461 -42 410 -16 Q 367 7 313 10 L 313 112 Z" },
    ["%"] = { 747, "M 116 0 L 565 -697 L 627 -697 L 178 0 Z M 543 8 Q 500 8 466 -12 Q 431 -33 410 -70 Q 389 -106 389 -153 Q 389 -200 410 -236 Q 430 -272 464 -292 Q 499 -313 542 -313 Q 585 -313 620 -292 Q 655 -270 676 -234 Q 696 -198 696 -153 Q 696 -109 676 -72 Q 655 -36 620 -14 Q 586 8 543 8 Z M 543 -50 Q 570 -50 592 -64 Q 613 -77 626 -100 Q 638 -124 638 -153 Q 638 -183 625 -206 Q 612 -229 590 -242 Q 569 -255 542 -255 Q 516 -255 494 -242 Q 473 -229 460 -206 Q 447 -184 447 -153 Q 447 -122 460 -98 Q 474 -75 496 -62 Q 518 -50 543 -50 Z M 206 -385 Q 163 -385 128 -406 Q 93 -426 72 -462 Q 51 -498 51 -544 Q 51 -592 72 -628 Q 93 -664 128 -684 Q 162 -705 204 -705 Q 247 -705 282 -684 Q 317 -662 338 -626 Q 358 -589 358 -544 Q 358 -501 338 -464 Q 317 -428 283 -406 Q 249 -385 206 -385 Z M 206 -443 Q 232 -443 253 -456 Q 274 -470 286 -493 Q 299 -516 299 -544 Q 299 -575 286 -598 Q 273 -621 252 -634 Q 230 -647 204 -647 Q 178 -647 156 -634 Q 135 -622 122 -599 Q 109 -576 109 -544 Q 109 -514 122 -491 Q 135 -468 157 -456 Q 179 -443 206 -443 Z" },
    ["&"] = { 686, "M 276 10 Q 212 10 162 -10 Q 112 -30 84 -69 Q 55 -108 55 -163 Q 55 -208 74 -242 Q 92 -277 122 -304 Q 152 -330 189 -352 Q 206 -362 223 -372 Q 205 -394 187 -418 Q 167 -444 154 -475 Q 141 -506 141 -543 Q 141 -592 166 -628 Q 190 -664 232 -684 Q 274 -704 324 -704 Q 404 -704 449 -664 Q 494 -623 494 -557 Q 494 -501 465 -460 Q 436 -420 392 -390 Q 368 -373 343 -358 L 490 -189 Q 531 -258 549 -360 L 624 -349 Q 606 -231 558 -151 Q 551 -139 543 -127 L 636 -19 L 576 34 L 490 -67 Q 466 -46 438 -31 Q 366 10 276 10 Z M 440 -125 L 276 -318 Q 249 -302 224 -286 Q 188 -263 165 -235 Q 142 -207 142 -167 Q 142 -119 178 -91 Q 215 -63 276 -63 Q 374 -63 440 -125 Z M 289 -409 Q 315 -424 338 -440 Q 373 -463 394 -491 Q 415 -519 415 -556 Q 415 -588 394 -612 Q 372 -637 325 -637 Q 280 -637 251 -610 Q 222 -584 222 -541 Q 222 -515 233 -491 Q 244 -467 261 -445 Q 275 -426 289 -409 Z" },
    ["'"] = { 174, "M 51 -414 L 51 -697 L 123 -697 L 123 -414 Z" },
    ["("] = { 222, "M 143 204 Q 114 163 92 108 Q 70 54 55 -6 Q 40 -67 32 -128 Q 25 -190 25 -245 Q 25 -327 38 -410 Q 52 -492 78 -566 Q 105 -640 144 -697 L 221 -697 Q 177 -636 148 -560 Q 120 -484 106 -404 Q 93 -323 93 -246 Q 93 -190 101 -129 Q 109 -68 126 -8 Q 142 53 166 108 Q 190 162 221 204 Z" },
    [")"] = { 222, "M 79 204 L 1 204 Q 33 162 56 108 Q 80 53 96 -8 Q 113 -68 121 -129 Q 129 -190 129 -246 Q 129 -323 116 -404 Q 102 -484 74 -560 Q 45 -636 1 -697 L 78 -697 Q 118 -640 144 -566 Q 170 -492 184 -410 Q 197 -327 197 -245 Q 197 -190 190 -128 Q 182 -67 167 -6 Q 152 54 130 108 Q 108 163 79 204 Z" },
    ["*"] = { 398, "M 126 -395 L 86 -426 L 173 -530 L 41 -564 L 57 -614 L 183 -562 L 173 -697 L 225 -697 L 216 -562 L 342 -614 L 357 -564 L 226 -530 L 313 -426 L 272 -395 L 199 -511 Z" },
    ["+"] = { 560, "M 246 -9 L 246 -214 L 41 -214 L 41 -281 L 246 -281 L 246 -486 L 314 -486 L 314 -281 L 519 -281 L 519 -214 L 314 -214 L 314 -9 Z" },
    [","] = { 240, "M 24 154 L 117 -147 L 211 -147 L 81 154 Z" },
    ["-"] = { 327, "M 40 -272 L 40 -335 L 288 -335 L 288 -272 Z" },
    ["."] = { 240, "M 70 0 L 70 -116 L 170 -116 L 170 0 Z" },
    ["/"] = { 418, "M -42 211 L 315 -697 L 381 -697 L 23 211 Z" },
    ["0"] = { 560, "M 282 8 Q 224 8 184 -14 Q 143 -35 117 -72 Q 91 -109 78 -156 Q 64 -202 58 -252 Q 53 -303 53 -351 Q 53 -398 58 -448 Q 63 -498 76 -544 Q 90 -590 116 -626 Q 141 -663 181 -684 Q 221 -706 279 -706 Q 335 -706 374 -686 Q 414 -665 440 -630 Q 466 -594 480 -548 Q 495 -503 501 -452 Q 507 -401 507 -350 Q 507 -298 501 -247 Q 495 -196 480 -150 Q 466 -104 440 -68 Q 415 -33 376 -12 Q 337 8 282 8 Z M 282 -74 Q 334 -74 364 -110 Q 395 -146 408 -208 Q 421 -270 421 -347 Q 421 -428 408 -490 Q 394 -553 363 -589 Q 332 -625 279 -625 Q 237 -625 210 -603 Q 183 -581 168 -542 Q 153 -504 146 -454 Q 140 -404 140 -348 Q 140 -294 146 -244 Q 153 -195 168 -157 Q 184 -119 212 -96 Q 239 -74 282 -74 Z" },
    ["1"] = { 560, "M 291 0 L 291 -518 L 109 -518 L 109 -586 L 230 -586 Q 260 -586 276 -599 Q 291 -612 291 -644 L 291 -697 L 376 -697 L 376 0 Z" },
    ["2"] = { 560, "M 48 0 L 48 -70 Q 83 -98 130 -132 Q 176 -166 224 -206 Q 271 -246 312 -291 Q 352 -336 377 -386 Q 402 -436 402 -489 Q 402 -548 369 -585 Q 336 -622 272 -622 Q 225 -622 194 -600 Q 162 -579 146 -542 Q 131 -504 130 -456 L 47 -462 Q 47 -511 62 -554 Q 77 -598 106 -632 Q 135 -665 178 -684 Q 220 -704 275 -704 Q 338 -704 385 -678 Q 432 -651 458 -604 Q 485 -556 485 -492 Q 485 -436 464 -384 Q 444 -332 408 -285 Q 371 -238 324 -196 Q 277 -154 224 -117 Q 196 -97 167 -79 L 513 -79 L 513 0 Z" },
    ["3"] = { 560, "M 275 8 Q 200 8 144 -20 Q 88 -47 57 -96 Q 26 -146 26 -212 L 110 -217 Q 110 -151 156 -112 Q 202 -74 278 -74 Q 328 -74 364 -90 Q 400 -106 420 -136 Q 439 -166 439 -206 Q 439 -243 423 -268 Q 407 -292 380 -306 Q 352 -321 315 -327 Q 278 -333 236 -333 L 236 -400 Q 267 -400 296 -406 Q 326 -411 350 -424 Q 373 -437 386 -459 Q 400 -481 400 -514 Q 400 -547 384 -572 Q 368 -597 340 -610 Q 312 -624 274 -624 Q 212 -624 177 -590 Q 142 -556 141 -503 L 58 -508 Q 58 -566 86 -610 Q 114 -655 164 -680 Q 213 -705 277 -705 Q 338 -705 384 -682 Q 431 -658 458 -617 Q 485 -576 485 -522 Q 485 -492 476 -468 Q 467 -445 450 -427 Q 434 -409 412 -396 Q 391 -384 367 -376 Q 397 -369 425 -356 Q 453 -343 475 -322 Q 497 -301 510 -272 Q 523 -243 523 -205 Q 523 -142 492 -94 Q 460 -46 404 -19 Q 349 8 275 8 Z" },
    ["4"] = { 560, "M 348 0 L 348 -166 L 16 -166 L 16 -233 L 355 -697 L 433 -697 L 433 -245 L 545 -245 L 545 -166 L 433 -166 L 433 0 Z M 108 -245 L 348 -245 L 348 -581 Z" },
    ["5"] = { 560, "M 278 8 Q 217 8 166 -18 Q 114 -44 80 -90 Q 47 -136 36 -195 L 119 -210 Q 126 -172 146 -140 Q 167 -109 200 -91 Q 234 -73 277 -73 Q 327 -73 362 -96 Q 397 -120 416 -158 Q 434 -196 434 -239 Q 434 -281 416 -316 Q 399 -350 366 -370 Q 332 -391 283 -391 Q 239 -391 203 -371 Q 167 -351 141 -313 L 58 -336 L 123 -697 L 491 -697 L 491 -618 L 192 -618 L 157 -420 Q 182 -442 209 -453 Q 252 -471 295 -471 Q 362 -471 414 -440 Q 465 -408 494 -355 Q 523 -302 523 -239 Q 523 -189 505 -144 Q 487 -100 454 -66 Q 421 -31 376 -12 Q 331 8 278 8 Z" },
    ["6"] = { 560, "M 361 -697 L 201 -440 Q 211 -445 221 -448 Q 246 -456 271 -456 Q 336 -456 388 -425 Q 441 -394 472 -342 Q 502 -290 502 -226 Q 502 -159 469 -106 Q 436 -53 382 -22 Q 327 8 260 8 Q 194 8 138 -22 Q 83 -53 50 -106 Q 17 -159 17 -225 Q 17 -259 28 -292 Q 38 -324 55 -352 L 264 -697 Z M 260 -381 Q 218 -381 182 -361 Q 147 -341 126 -306 Q 104 -271 104 -226 Q 104 -182 125 -147 Q 146 -112 182 -92 Q 217 -72 260 -72 Q 303 -72 338 -92 Q 374 -112 395 -147 Q 416 -182 416 -227 Q 416 -271 395 -306 Q 374 -341 339 -361 Q 304 -381 260 -381 Z" },
    ["7"] = { 560, "M 104 0 L 428 -618 L 28 -618 L 28 -697 L 528 -697 L 528 -632 L 198 0 Z" },
    ["8"] = { 560, "M 280 8 Q 218 8 162 -16 Q 107 -39 72 -86 Q 38 -132 38 -201 Q 38 -263 70 -310 Q 101 -357 159 -379 Q 121 -398 98 -434 Q 75 -471 75 -520 Q 75 -579 105 -620 Q 135 -661 182 -683 Q 229 -705 281 -705 Q 337 -705 384 -682 Q 430 -659 458 -617 Q 485 -575 485 -517 Q 485 -468 462 -433 Q 440 -398 401 -379 Q 459 -357 490 -310 Q 522 -263 522 -201 Q 522 -132 488 -86 Q 453 -39 398 -16 Q 343 8 280 8 Z M 280 -72 Q 323 -72 358 -88 Q 394 -103 416 -134 Q 437 -164 437 -209 Q 437 -251 417 -282 Q 397 -312 362 -328 Q 326 -345 280 -345 Q 234 -345 198 -328 Q 163 -312 142 -282 Q 122 -251 122 -209 Q 122 -164 144 -134 Q 166 -103 202 -88 Q 238 -72 280 -72 Z M 282 -403 Q 334 -403 368 -433 Q 401 -463 401 -511 Q 401 -562 368 -594 Q 336 -625 281 -625 Q 248 -625 220 -612 Q 193 -599 176 -574 Q 160 -550 160 -515 Q 160 -464 194 -434 Q 228 -403 282 -403 Z" },
    ["9"] = { 560, "M 178 0 L 338 -256 Q 329 -252 319 -249 Q 293 -241 268 -241 Q 203 -241 150 -272 Q 98 -303 68 -355 Q 37 -407 37 -471 Q 37 -538 70 -591 Q 103 -644 158 -674 Q 213 -705 279 -705 Q 346 -705 401 -674 Q 456 -644 489 -592 Q 522 -539 522 -472 Q 522 -438 512 -406 Q 501 -374 484 -345 L 275 0 Z M 279 -316 Q 322 -316 357 -336 Q 392 -356 414 -391 Q 435 -426 435 -471 Q 435 -516 414 -550 Q 393 -585 358 -605 Q 322 -625 279 -625 Q 236 -625 200 -605 Q 165 -585 144 -550 Q 123 -515 123 -470 Q 123 -426 144 -391 Q 165 -356 200 -336 Q 236 -316 279 -316 Z" },
    [":"] = { 240, "M 70 -354 L 70 -471 L 170 -471 L 170 -354 Z M 70 0 L 70 -116 L 170 -116 L 170 0 Z" },
    [";"] = { 240, "M 8 154 L 102 -130 L 196 -130 L 66 154 Z M 86 -354 L 86 -471 L 186 -471 L 186 -354 Z" },
    ["<"] = { 560, "M 521 -7 L 24 -210 L 24 -283 L 521 -487 L 521 -415 L 104 -247 L 521 -78 Z" },
    ["="] = { 560, "M 82 -317 L 82 -384 L 479 -384 L 479 -317 Z M 82 -110 L 82 -177 L 479 -177 L 479 -110 Z" },
    [">"] = { 560, "M 39 -7 L 39 -78 L 456 -247 L 39 -415 L 39 -487 L 536 -283 L 536 -210 Z" },
    ["?"] = { 516, "M 218 -200 L 218 -257 Q 218 -297 230 -324 Q 243 -350 262 -369 Q 282 -388 304 -404 Q 327 -419 346 -435 Q 366 -451 378 -472 Q 391 -494 391 -525 Q 391 -578 356 -606 Q 320 -634 257 -634 Q 191 -634 154 -600 Q 118 -565 118 -503 L 43 -503 Q 44 -568 72 -613 Q 99 -658 148 -682 Q 196 -705 258 -705 Q 317 -705 364 -686 Q 411 -666 438 -626 Q 465 -586 465 -524 Q 465 -481 452 -452 Q 440 -423 420 -403 Q 400 -383 378 -368 Q 356 -353 336 -338 Q 316 -323 304 -302 Q 291 -282 291 -251 L 291 -200 Z M 206 0 L 206 -116 L 306 -116 L 306 0 Z" },
    ["@"] = { 874, "M 438 107 Q 360 107 292 79 Q 223 51 172 0 Q 120 -50 90 -118 Q 61 -186 61 -266 Q 61 -348 90 -418 Q 118 -487 170 -538 Q 221 -590 290 -618 Q 358 -647 438 -647 Q 519 -647 588 -618 Q 656 -590 707 -540 Q 758 -489 786 -421 Q 814 -353 814 -274 Q 814 -214 799 -169 Q 784 -124 752 -98 Q 721 -73 671 -73 Q 635 -73 609 -86 Q 583 -100 569 -122 Q 561 -134 558 -147 Q 538 -114 507 -96 Q 463 -70 414 -70 Q 363 -70 322 -94 Q 281 -119 257 -162 Q 233 -206 233 -264 Q 233 -323 257 -367 Q 281 -411 322 -436 Q 363 -460 414 -460 Q 463 -460 501 -436 Q 531 -416 549 -382 L 557 -452 L 622 -452 L 622 -205 Q 622 -170 635 -154 Q 648 -138 678 -138 Q 717 -138 734 -174 Q 752 -209 752 -273 Q 752 -341 728 -398 Q 705 -454 663 -496 Q 621 -538 564 -561 Q 506 -584 438 -584 Q 372 -584 314 -560 Q 257 -537 214 -494 Q 172 -452 148 -394 Q 124 -336 124 -266 Q 124 -199 148 -142 Q 173 -86 216 -44 Q 259 -2 316 22 Q 373 45 438 45 Q 524 45 603 -2 L 632 53 Q 590 80 540 94 Q 489 107 438 107 Z M 430 -137 Q 464 -137 490 -153 Q 515 -169 530 -198 Q 545 -226 545 -264 Q 545 -303 530 -332 Q 515 -361 490 -377 Q 464 -393 430 -393 Q 397 -393 370 -376 Q 344 -360 329 -331 Q 314 -302 314 -264 Q 314 -227 329 -198 Q 344 -169 370 -153 Q 397 -137 430 -137 Z" },
    ["A"] = { 637, "M 17 0 L 283 -697 L 353 -697 L 619 0 L 523 0 L 464 -164 L 173 -164 L 114 0 Z M 436 -243 L 319 -571 L 201 -243 Z" },
    ["B"] = { 601, "M 79 0 L 79 -697 L 302 -697 Q 401 -697 458 -651 Q 514 -605 514 -523 Q 514 -471 491 -432 Q 468 -393 426 -373 Q 487 -356 518 -311 Q 550 -266 550 -197 Q 550 -103 492 -52 Q 433 0 326 0 Z M 167 -81 L 320 -81 Q 463 -81 463 -201 Q 463 -258 430 -290 Q 398 -321 339 -321 L 167 -321 Z M 167 -400 L 316 -400 Q 366 -400 396 -430 Q 427 -459 427 -510 Q 427 -560 394 -588 Q 361 -616 302 -616 L 167 -616 Z" },
    ["C"] = { 704, "M 372 12 Q 276 12 204 -33 Q 131 -78 90 -160 Q 50 -241 50 -349 Q 50 -457 90 -538 Q 131 -619 204 -664 Q 276 -709 372 -709 Q 477 -709 554 -657 Q 631 -605 665 -513 L 583 -482 Q 557 -550 503 -588 Q 449 -625 372 -625 Q 301 -625 248 -591 Q 195 -557 166 -496 Q 138 -434 138 -349 Q 138 -264 166 -202 Q 195 -140 248 -106 Q 301 -72 372 -72 Q 449 -72 503 -110 Q 557 -148 583 -215 L 665 -185 Q 631 -94 554 -41 Q 477 12 372 12 Z" },
    ["D"] = { 682, "M 79 0 L 79 -697 L 272 -697 Q 443 -697 537 -604 Q 631 -512 631 -343 Q 631 -177 538 -88 Q 445 0 271 0 Z M 167 -81 L 263 -81 Q 352 -81 414 -108 Q 477 -134 510 -192 Q 542 -251 542 -346 Q 542 -441 510 -500 Q 477 -560 416 -588 Q 356 -616 271 -616 L 167 -616 Z" },
    ["E"] = { 585, "M 79 0 L 79 -697 L 538 -697 L 538 -618 L 167 -618 L 167 -395 L 504 -395 L 504 -316 L 167 -316 L 167 -79 L 538 -79 L 538 0 Z" },
    ["F"] = { 565, "M 79 0 L 79 -697 L 536 -697 L 536 -618 L 167 -618 L 167 -395 L 487 -395 L 487 -316 L 167 -316 L 167 0 Z" },
    ["G"] = { 731, "M 367 12 Q 273 12 202 -33 Q 130 -78 90 -160 Q 50 -241 50 -349 Q 50 -457 90 -538 Q 131 -619 204 -664 Q 276 -709 372 -709 Q 477 -709 554 -657 Q 631 -605 665 -513 L 583 -482 Q 557 -550 503 -588 Q 449 -625 372 -625 Q 301 -625 248 -591 Q 195 -557 166 -496 Q 138 -434 138 -349 Q 138 -264 166 -202 Q 195 -140 248 -106 Q 301 -72 372 -72 Q 408 -72 446 -82 Q 484 -92 516 -117 Q 548 -142 568 -186 Q 586 -226 587 -287 L 411 -287 L 411 -366 L 665 -366 L 665 0 L 587 0 L 578 -99 Q 562 -68 538 -47 Q 504 -17 460 -2 Q 415 12 367 12 Z" },
    ["H"] = { 678, "M 79 0 L 79 -697 L 167 -697 L 167 -398 L 511 -398 L 511 -697 L 599 -697 L 599 0 L 511 0 L 511 -316 L 167 -316 L 167 0 Z" },
    ["I"] = { 246, "M 79 0 L 79 -697 L 167 -697 L 167 0 Z" },
    ["J"] = { 552, "M 256 12 Q 159 12 97 -47 Q 35 -106 28 -209 L 115 -218 Q 120 -142 157 -106 Q 194 -70 256 -70 Q 327 -70 360 -117 Q 392 -164 392 -252 L 392 -618 L 116 -618 L 116 -697 L 480 -697 L 480 -247 Q 480 -166 454 -108 Q 427 -50 377 -19 Q 327 12 256 12 Z" },
    ["K"] = { 634, "M 79 0 L 79 -697 L 167 -697 L 167 -354 L 495 -697 L 613 -697 L 347 -426 L 615 0 L 512 0 L 284 -361 L 167 -241 L 167 0 Z" },
    ["L"] = { 495, "M 79 0 L 79 -697 L 167 -697 L 167 -79 L 479 -79 L 479 0 Z" },
    ["M"] = { 839, "M 79 0 L 79 -697 L 209 -697 L 420 -166 L 631 -697 L 760 -697 L 760 0 L 672 0 L 672 -577 L 463 -59 L 377 -59 L 167 -577 L 167 0 Z" },
    ["N"] = { 676, "M 79 0 L 79 -697 L 172 -697 L 509 -147 L 509 -697 L 597 -697 L 597 0 L 502 0 L 167 -551 L 167 0 Z" },
    ["O"] = { 748, "M 372 12 Q 276 12 204 -33 Q 131 -78 90 -159 Q 50 -240 50 -348 Q 50 -457 90 -538 Q 131 -619 204 -664 Q 276 -709 372 -709 Q 470 -709 543 -664 Q 616 -619 656 -538 Q 697 -457 697 -348 Q 697 -240 656 -159 Q 615 -78 542 -33 Q 469 12 372 12 Z M 372 -72 Q 445 -72 498 -106 Q 550 -140 579 -202 Q 608 -264 608 -348 Q 608 -433 579 -495 Q 550 -557 498 -591 Q 445 -625 372 -625 Q 301 -625 248 -592 Q 195 -558 166 -496 Q 138 -434 138 -348 Q 138 -263 166 -201 Q 195 -139 248 -106 Q 301 -72 372 -72 Z" },
    ["P"] = { 554, "M 79 0 L 79 -697 L 287 -697 Q 400 -697 460 -647 Q 519 -597 519 -500 Q 519 -403 459 -352 Q 399 -300 287 -300 L 166 -300 L 166 0 Z M 166 -378 L 278 -378 Q 350 -378 390 -408 Q 431 -437 431 -499 Q 431 -560 392 -589 Q 352 -618 278 -618 L 166 -618 Z" },
    ["Q"] = { 774, "M 372 12 Q 276 12 204 -33 Q 131 -78 90 -159 Q 50 -240 50 -348 Q 50 -457 90 -538 Q 131 -619 204 -664 Q 276 -709 372 -709 Q 470 -709 543 -664 Q 616 -619 656 -538 Q 697 -457 697 -348 Q 697 -240 656 -159 Q 641 -130 622 -105 L 723 -6 L 670 46 L 569 -52 Q 556 -42 542 -33 Q 469 12 372 12 Z M 372 -72 Q 445 -72 498 -106 Q 502 -109 507 -113 L 399 -218 L 451 -273 L 559 -167 Q 570 -183 579 -202 Q 608 -264 608 -348 Q 608 -433 579 -495 Q 550 -557 498 -591 Q 445 -625 372 -625 Q 301 -625 248 -592 Q 195 -558 166 -496 Q 138 -434 138 -348 Q 138 -263 166 -201 Q 195 -139 248 -106 Q 301 -72 372 -72 Z" },
    ["R"] = { 598, "M 79 0 L 79 -697 L 287 -697 Q 367 -697 418 -674 Q 469 -650 494 -606 Q 519 -562 519 -501 Q 519 -414 469 -364 Q 436 -330 384 -315 L 570 0 L 469 0 L 294 -303 Q 291 -303 288 -303 L 167 -303 L 167 0 Z M 167 -381 L 278 -381 Q 324 -381 358 -393 Q 392 -405 412 -431 Q 431 -457 431 -500 Q 431 -544 412 -570 Q 392 -595 358 -606 Q 323 -618 278 -618 L 167 -618 Z" },
    ["S"] = { 564, "M 292 11 Q 187 11 120 -44 Q 53 -99 38 -190 L 124 -211 Q 135 -141 182 -104 Q 228 -68 295 -68 Q 334 -68 365 -83 Q 396 -98 414 -126 Q 432 -153 432 -188 Q 432 -225 412 -249 Q 392 -273 356 -291 Q 321 -309 274 -327 Q 216 -349 172 -375 Q 129 -401 105 -438 Q 81 -474 81 -527 Q 81 -580 107 -621 Q 133 -662 180 -686 Q 227 -709 289 -709 Q 355 -709 406 -679 Q 457 -649 488 -590 L 418 -547 Q 395 -588 362 -610 Q 329 -631 286 -631 Q 252 -631 226 -618 Q 199 -605 184 -582 Q 169 -559 169 -529 Q 169 -497 187 -474 Q 205 -452 239 -435 Q 273 -418 321 -400 Q 382 -377 426 -350 Q 470 -323 494 -286 Q 519 -248 519 -193 Q 519 -134 490 -88 Q 461 -42 410 -16 Q 359 11 292 11 Z" },
    ["T"] = { 587, "M 249 0 L 249 -618 L 15 -618 L 15 -697 L 571 -697 L 571 -618 L 338 -618 L 338 0 Z" },
    ["U"] = { 656, "M 327 12 Q 203 12 138 -55 Q 72 -122 72 -252 L 72 -697 L 160 -697 L 160 -262 Q 160 -199 176 -156 Q 193 -113 230 -91 Q 267 -69 327 -69 Q 387 -69 424 -92 Q 462 -114 479 -157 Q 496 -200 496 -263 L 496 -697 L 583 -697 L 583 -257 Q 583 -125 518 -56 Q 452 12 327 12 Z" },
    ["V"] = { 656, "M 295 0 L 17 -697 L 114 -697 L 329 -140 L 542 -697 L 639 -697 L 363 0 Z" },
    ["W"] = { 957, "M 227 0 L 23 -697 L 115 -697 L 276 -133 L 435 -659 L 523 -659 L 682 -133 L 842 -697 L 934 -697 L 730 0 L 643 0 L 479 -531 L 315 0 Z" },
    ["X"] = { 641, "M 21 0 L 260 -350 L 24 -697 L 129 -697 L 321 -412 L 512 -697 L 617 -697 L 381 -350 L 621 0 L 516 0 L 320 -286 L 125 0 Z" },
    ["Y"] = { 602, "M 258 0 L 258 -269 L 12 -697 L 112 -697 L 299 -357 L 490 -697 L 590 -697 L 346 -269 L 346 0 Z" },
    ["Z"] = { 582, "M 32 0 L 32 -75 L 429 -618 L 56 -618 L 56 -697 L 537 -697 L 537 -623 L 139 -79 L 549 -79 L 549 0 Z" },
    ["["] = { 258, "M 58 247 L 58 -740 L 253 -740 L 253 -683 L 128 -683 L 128 190 L 253 190 L 253 247 Z" },
    ["\\"] = { 448, "M 490 211 L 425 211 L 67 -697 L 133 -697 Z" },
    ["]"] = { 258, "M 200 247 L 5 247 L 5 190 L 130 190 L 130 -683 L 5 -683 L 5 -740 L 200 -740 Z" },
    ["^"] = { 552, "M 30 -219 L 223 -697 L 329 -697 L 522 -219 L 432 -219 L 276 -624 L 120 -219 Z" },
    ["_"] = { 405, "M 0 65 L 0 0 L 405 0 L 405 65 Z" },
    ["`"] = { 292, "M 179 -556 L 49 -697 L 139 -697 L 243 -556 Z" },
    ["a"] = { 540, "M 396 0 L 391 -76 Q 366 -36 327 -15 Q 286 8 233 8 Q 177 8 136 -12 Q 94 -31 72 -66 Q 49 -101 49 -147 Q 49 -188 66 -216 Q 82 -245 108 -261 Q 134 -278 168 -284 Q 201 -291 238 -291 L 390 -291 L 390 -309 Q 390 -366 358 -397 Q 327 -428 265 -428 Q 225 -428 190 -412 Q 155 -395 122 -356 L 61 -408 Q 102 -456 155 -478 Q 208 -501 271 -501 Q 368 -501 421 -451 Q 474 -401 474 -309 L 474 0 Z M 390 -227 L 250 -227 Q 228 -227 204 -223 Q 180 -219 162 -206 Q 149 -196 142 -181 Q 134 -166 134 -146 Q 134 -107 163 -84 Q 192 -61 241 -61 Q 282 -61 316 -80 Q 349 -99 370 -132 Q 390 -166 390 -208 Z" },
    ["b"] = { 587, "M 314 8 Q 267 8 230 -10 Q 192 -29 167 -62 Q 161 -69 156 -77 L 156 0 L 72 0 L 72 -697 L 156 -697 L 156 -414 Q 162 -423 168 -431 Q 193 -463 230 -482 Q 267 -501 314 -501 Q 376 -501 427 -470 Q 478 -439 508 -382 Q 538 -325 538 -247 Q 538 -175 510 -117 Q 482 -59 432 -26 Q 381 8 314 8 Z M 300 -70 Q 345 -70 380 -92 Q 414 -115 434 -155 Q 453 -195 453 -247 Q 453 -299 434 -339 Q 414 -379 380 -402 Q 345 -424 300 -424 Q 255 -424 221 -402 Q 187 -379 168 -339 Q 149 -299 149 -247 Q 149 -195 168 -155 Q 187 -115 221 -92 Q 255 -70 300 -70 Z" },
    ["c"] = { 518, "M 277 8 Q 222 8 180 -12 Q 137 -32 108 -68 Q 79 -103 64 -149 Q 49 -195 49 -247 Q 49 -298 64 -344 Q 79 -390 108 -426 Q 137 -461 180 -481 Q 222 -501 277 -501 Q 347 -501 400 -467 Q 452 -433 477 -363 L 402 -334 Q 388 -376 357 -402 Q 326 -428 277 -428 Q 228 -428 196 -402 Q 164 -376 148 -335 Q 133 -294 133 -247 Q 133 -200 148 -158 Q 164 -117 196 -92 Q 228 -66 277 -66 Q 326 -66 357 -92 Q 388 -117 402 -160 L 477 -131 Q 452 -61 400 -26 Q 347 8 277 8 Z" },
    ["d"] = { 587, "M 273 8 Q 206 8 156 -26 Q 105 -59 77 -117 Q 49 -175 49 -247 Q 49 -325 79 -382 Q 109 -439 160 -470 Q 211 -501 273 -501 Q 320 -501 357 -482 Q 394 -464 420 -433 Q 426 -425 431 -417 L 431 -697 L 515 -697 L 515 0 L 431 0 L 431 -77 Q 426 -69 420 -62 Q 394 -29 357 -10 Q 320 8 273 8 Z M 287 -70 Q 332 -70 366 -92 Q 400 -115 419 -155 Q 438 -195 438 -247 Q 438 -299 419 -339 Q 400 -379 366 -402 Q 332 -424 287 -424 Q 242 -424 208 -402 Q 173 -379 154 -339 Q 134 -299 134 -247 Q 134 -195 154 -155 Q 173 -115 208 -92 Q 242 -70 287 -70 Z" },
    ["e"] = { 540, "M 280 8 Q 222 8 178 -12 Q 135 -31 106 -66 Q 78 -101 64 -146 Q 49 -192 49 -243 Q 49 -294 63 -340 Q 77 -387 104 -423 Q 132 -459 174 -480 Q 216 -501 272 -501 Q 329 -501 370 -482 Q 412 -462 438 -428 Q 465 -394 478 -352 Q 491 -310 491 -265 Q 491 -261 490 -246 Q 490 -232 488 -221 L 133 -221 Q 136 -149 175 -109 Q 214 -69 281 -69 Q 324 -69 356 -83 Q 388 -97 416 -128 L 475 -76 Q 448 -47 418 -28 Q 388 -10 354 -1 Q 321 8 280 8 Z M 410 -284 Q 410 -290 410 -296 Q 410 -320 402 -344 Q 393 -368 376 -388 Q 360 -407 334 -418 Q 309 -430 274 -430 Q 231 -430 200 -410 Q 169 -390 152 -357 Q 135 -324 132 -284 Z" },
    ["f"] = { 335, "M 112 0 L 112 -427 L 10 -427 L 10 -493 L 113 -493 L 113 -557 Q 113 -613 131 -646 Q 149 -678 180 -692 Q 212 -705 251 -705 Q 278 -705 299 -700 Q 320 -695 339 -685 L 311 -621 Q 300 -627 287 -630 Q 274 -634 260 -634 Q 228 -634 212 -614 Q 197 -594 197 -557 L 197 -493 L 312 -493 L 312 -427 L 197 -427 L 197 0 Z" },
    ["g"] = { 514, "M 271 213 Q 165 213 103 174 Q 41 135 41 66 Q 41 61 42 53 Q 42 45 44 38 L 126 -21 Q 100 -33 81 -50 Q 53 -75 53 -116 Q 53 -151 78 -180 Q 92 -197 111 -210 Q 99 -222 90 -237 Q 65 -276 65 -326 Q 65 -378 90 -418 Q 116 -457 160 -479 Q 203 -501 256 -501 Q 308 -501 351 -479 Q 365 -472 378 -462 L 457 -528 L 500 -475 L 424 -410 Q 446 -372 446 -323 Q 446 -272 422 -234 Q 398 -196 356 -175 Q 314 -154 259 -154 Q 202 -154 158 -176 Q 157 -176 157 -177 Q 152 -173 148 -169 Q 134 -152 134 -129 Q 134 -110 148 -98 Q 161 -86 186 -80 Q 212 -73 248 -68 Q 296 -61 338 -53 Q 380 -45 412 -30 Q 445 -16 463 8 Q 481 33 481 72 Q 481 140 425 176 Q 369 213 271 213 Z M 257 -223 Q 307 -223 334 -254 Q 362 -284 362 -328 Q 362 -375 333 -404 Q 304 -433 257 -433 Q 209 -433 179 -404 Q 149 -374 149 -329 Q 149 -284 178 -254 Q 207 -223 257 -223 Z M 175 -5 L 126 56 Q 125 60 125 63 L 125 69 Q 125 109 167 128 Q 209 148 271 148 Q 326 148 362 132 Q 398 117 398 82 Q 398 62 386 50 Q 375 37 354 30 Q 332 23 303 18 Q 274 13 238 8 Q 206 3 175 -5 Z" },
    ["h"] = { 547, "M 72 0 L 72 -697 L 157 -697 L 157 -422 Q 165 -434 175 -445 Q 200 -472 234 -486 Q 268 -501 308 -501 Q 389 -501 435 -454 Q 481 -406 481 -313 L 481 0 L 396 0 L 396 -282 Q 396 -357 368 -392 Q 341 -428 285 -428 Q 224 -428 190 -384 Q 157 -341 157 -246 L 157 0 Z" },
    ["i"] = { 226, "M 71 0 L 71 -493 L 155 -493 L 155 0 Z M 63 -582 L 63 -697 L 163 -697 L 163 -582 Z" },
    ["j"] = { 226, "M 52 212 Q 35 212 15 208 Q -5 205 -25 199 L -25 125 Q -9 130 3 132 Q 15 134 22 134 Q 46 134 58 120 Q 71 107 71 73 L 71 -493 L 155 -493 L 155 95 Q 155 156 127 184 Q 99 212 52 212 Z M 64 -582 L 64 -697 L 164 -697 L 164 -582 Z" },
    ["k"] = { 532, "M 408 0 L 244 -254 L 157 -161 L 157 0 L 72 0 L 72 -697 L 157 -697 L 157 -269 L 374 -493 L 483 -493 L 306 -311 L 509 0 Z" },
    ["l"] = { 265, "M 171 8 Q 126 8 98 -20 Q 70 -48 70 -109 L 70 -697 L 154 -697 L 154 -125 Q 154 -96 166 -83 Q 178 -70 198 -70 Q 207 -70 218 -72 Q 229 -74 241 -78 L 241 -6 Q 224 1 205 4 Q 186 8 171 8 Z" },
    ["m"] = { 828, "M 72 0 L 72 -493 L 157 -493 L 157 -413 Q 161 -420 165 -427 Q 180 -452 201 -468 Q 222 -485 246 -493 Q 271 -501 298 -501 Q 343 -501 377 -484 Q 411 -467 433 -433 Q 439 -423 444 -413 Q 448 -421 453 -429 Q 476 -464 510 -482 Q 545 -501 593 -501 Q 654 -501 691 -474 Q 728 -446 745 -400 Q 762 -355 762 -300 L 762 0 L 678 0 L 678 -280 Q 678 -326 668 -359 Q 657 -392 634 -410 Q 612 -428 574 -428 Q 538 -428 512 -410 Q 487 -392 474 -356 Q 460 -319 460 -265 L 460 0 L 375 0 L 375 -287 Q 375 -358 349 -393 Q 323 -428 273 -428 Q 237 -428 211 -410 Q 185 -391 171 -355 Q 157 -319 157 -265 L 157 0 Z" },
    ["n"] = { 547, "M 72 0 L 72 -493 L 157 -493 L 157 -422 Q 165 -435 175 -446 Q 199 -472 233 -486 Q 267 -501 308 -501 Q 389 -501 435 -454 Q 481 -406 481 -313 L 481 0 L 396 0 L 396 -282 Q 396 -357 368 -392 Q 341 -428 285 -428 Q 244 -428 216 -409 Q 187 -390 172 -350 Q 157 -309 157 -246 L 157 0 Z" },
    ["o"] = { 577, "M 289 8 Q 220 8 166 -24 Q 111 -57 80 -115 Q 49 -173 49 -247 Q 49 -321 80 -378 Q 110 -436 164 -468 Q 219 -501 289 -501 Q 359 -501 412 -468 Q 466 -436 497 -378 Q 528 -321 528 -247 Q 528 -173 497 -116 Q 466 -58 412 -25 Q 358 8 289 8 Z M 289 -67 Q 336 -67 370 -90 Q 405 -112 424 -152 Q 443 -193 443 -247 Q 443 -302 424 -342 Q 405 -383 370 -405 Q 336 -427 289 -427 Q 241 -427 206 -404 Q 171 -382 152 -342 Q 133 -302 133 -247 Q 133 -193 152 -152 Q 171 -112 206 -90 Q 241 -67 289 -67 Z" },
    ["p"] = { 587, "M 72 204 L 72 -493 L 156 -493 L 156 -423 Q 161 -431 168 -439 Q 193 -469 230 -485 Q 267 -501 314 -501 Q 381 -501 432 -468 Q 482 -434 510 -376 Q 538 -319 538 -246 Q 538 -169 508 -112 Q 478 -54 427 -23 Q 376 8 314 8 Q 267 8 230 -9 Q 193 -26 168 -56 Q 162 -64 156 -72 L 156 204 Z M 300 -69 Q 345 -69 380 -92 Q 414 -114 434 -154 Q 453 -194 453 -246 Q 453 -298 434 -338 Q 414 -378 380 -400 Q 345 -423 300 -423 Q 255 -423 221 -400 Q 187 -378 168 -338 Q 149 -298 149 -246 Q 149 -194 168 -154 Q 187 -114 221 -92 Q 255 -69 300 -69 Z" },
    ["q"] = { 587, "M 431 204 L 431 -71 Q 426 -63 420 -56 Q 394 -26 357 -9 Q 320 8 273 8 Q 211 8 160 -23 Q 109 -54 79 -112 Q 49 -169 49 -246 Q 49 -319 77 -376 Q 105 -434 156 -468 Q 206 -501 273 -501 Q 320 -501 357 -485 Q 394 -469 420 -439 Q 426 -431 431 -423 L 431 -493 L 515 -493 L 515 204 Z M 287 -69 Q 332 -69 366 -92 Q 400 -114 419 -154 Q 438 -194 438 -246 Q 438 -298 419 -338 Q 400 -378 366 -400 Q 332 -423 287 -423 Q 242 -423 208 -400 Q 173 -378 154 -338 Q 134 -298 134 -246 Q 134 -194 154 -154 Q 173 -114 208 -92 Q 242 -69 287 -69 Z" },
    ["r"] = { 407, "M 72 0 L 72 -493 L 157 -493 L 157 -416 Q 162 -425 169 -433 Q 195 -465 230 -483 Q 266 -501 300 -501 Q 323 -501 344 -496 Q 365 -491 387 -479 L 345 -403 Q 333 -409 316 -413 Q 300 -417 285 -417 Q 261 -417 238 -408 Q 214 -399 195 -380 Q 176 -361 166 -329 Q 162 -315 160 -292 Q 157 -270 157 -231 L 157 0 Z" },
    ["s"] = { 470, "M 235 8 Q 185 8 145 -7 Q 105 -22 76 -47 Q 48 -72 31 -100 L 90 -150 Q 109 -112 146 -88 Q 184 -63 236 -63 Q 283 -63 311 -83 Q 339 -103 339 -137 Q 339 -165 322 -181 Q 305 -197 277 -207 Q 249 -217 216 -225 Q 188 -232 160 -242 Q 131 -252 108 -267 Q 85 -282 71 -306 Q 57 -330 57 -365 Q 57 -426 104 -464 Q 152 -501 229 -501 Q 285 -501 332 -478 Q 378 -454 404 -407 L 350 -367 Q 330 -402 298 -418 Q 265 -433 226 -433 Q 187 -433 161 -417 Q 135 -401 135 -373 Q 135 -352 147 -339 Q 159 -326 182 -317 Q 206 -308 240 -300 Q 271 -293 303 -283 Q 335 -273 362 -257 Q 389 -241 406 -214 Q 422 -188 422 -146 Q 422 -100 399 -65 Q 376 -30 334 -11 Q 292 8 235 8 Z" },
    ["t"] = { 346, "M 236 8 Q 201 8 172 -6 Q 144 -19 128 -49 Q 112 -79 112 -126 L 112 -427 L 10 -427 L 10 -493 L 112 -493 L 112 -625 L 198 -673 L 198 -493 L 312 -493 L 312 -427 L 198 -427 L 198 -148 Q 198 -107 211 -84 Q 224 -62 258 -62 Q 268 -62 282 -64 Q 296 -67 312 -71 L 312 -5 Q 293 2 274 5 Q 254 8 236 8 Z" },
    ["u"] = { 547, "M 238 8 Q 185 8 146 -14 Q 107 -35 86 -77 Q 66 -119 66 -181 L 66 -493 L 150 -493 L 150 -211 Q 150 -162 162 -130 Q 175 -97 200 -82 Q 225 -66 262 -66 Q 303 -66 332 -86 Q 360 -105 375 -145 Q 390 -185 390 -248 L 390 -493 L 474 -493 L 474 0 L 390 0 L 390 -65 Q 371 -38 344 -21 Q 298 8 238 8 Z" },
    ["v"] = { 521, "M 225 0 L 23 -493 L 116 -493 L 260 -109 L 405 -493 L 497 -493 L 296 0 Z" },
    ["w"] = { 748, "M 174 0 L 28 -493 L 118 -493 L 218 -128 L 336 -493 L 411 -493 L 529 -130 L 630 -493 L 720 -493 L 573 0 L 495 0 L 374 -375 L 253 0 Z" },
    ["x"] = { 520, "M 27 0 L 204 -248 L 27 -493 L 131 -493 L 260 -306 L 391 -493 L 493 -493 L 315 -248 L 493 0 L 389 0 L 260 -189 L 129 0 Z" },
    ["y"] = { 521, "M 121 203 L 215 -24 L 23 -493 L 116 -493 L 260 -109 L 405 -493 L 497 -493 L 213 203 Z" },
    ["z"] = { 472, "M 37 0 L 37 -60 L 334 -425 L 51 -425 L 51 -493 L 431 -493 L 431 -429 L 142 -69 L 429 -69 L 429 0 Z" },
    ["{"] = { 239, "M 174 247 Q 121 247 93 214 Q 65 180 65 119 L 65 -136 Q 65 -162 58 -178 Q 50 -195 36 -204 Q 23 -214 4 -216 L 4 -278 Q 23 -281 36 -290 Q 50 -299 58 -316 Q 65 -332 65 -357 L 65 -612 Q 65 -674 93 -707 Q 121 -740 174 -740 L 235 -740 L 235 -685 L 201 -685 Q 166 -685 152 -664 Q 138 -644 138 -611 L 138 -356 Q 138 -311 121 -287 Q 104 -263 73 -250 L 73 -243 Q 104 -231 121 -206 Q 138 -182 138 -138 L 138 118 Q 138 151 152 172 Q 166 192 201 192 L 235 192 L 235 247 Z" },
    ["|"] = { 258, "M 97 254 L 97 -746 L 161 -746 L 161 254 Z" },
    ["}"] = { 239, "M 65 247 L 4 247 L 4 192 L 38 192 Q 73 192 87 172 Q 101 151 101 118 L 101 -138 Q 101 -182 118 -206 Q 135 -231 166 -243 L 166 -250 Q 135 -263 118 -287 Q 101 -311 101 -356 L 101 -611 Q 101 -644 87 -664 Q 73 -685 38 -685 L 4 -685 L 4 -740 L 65 -740 Q 118 -740 146 -707 Q 174 -674 174 -612 L 174 -357 Q 174 -332 182 -316 Q 189 -299 203 -290 Q 217 -281 235 -278 L 235 -216 Q 217 -214 203 -204 Q 189 -195 182 -178 Q 174 -162 174 -136 L 174 119 Q 174 180 146 214 Q 118 247 65 247 Z" },
    ["~"] = { 560, "M 367 -157 Q 334 -157 313 -169 Q 292 -181 278 -198 Q 264 -216 252 -234 Q 241 -251 227 -263 Q 213 -275 191 -275 Q 165 -275 150 -250 Q 136 -224 136 -183 L 68 -183 Q 68 -251 102 -294 Q 135 -337 191 -337 Q 225 -337 247 -325 Q 269 -313 284 -295 Q 298 -277 310 -259 Q 321 -241 334 -229 Q 347 -217 367 -217 Q 393 -217 410 -247 Q 426 -277 426 -322 L 493 -322 Q 493 -249 459 -203 Q 425 -157 367 -157 Z" },
    ["·"] = { 334, "M 109 -291 L 109 -407 L 209 -407 L 209 -291 Z" },
    ["Á"] = { 637, "M 17 0 L 283 -697 L 353 -697 L 619 0 L 523 0 L 464 -164 L 173 -164 L 114 0 Z M 436 -243 L 319 -571 L 201 -243 Z M 287 -760 L 396 -901 L 487 -901 L 350 -760 Z" },
    ["á"] = { 540, "M 396 0 L 391 -76 Q 366 -36 327 -15 Q 286 8 233 8 Q 177 8 136 -12 Q 94 -31 72 -66 Q 49 -101 49 -147 Q 49 -188 66 -216 Q 82 -245 108 -261 Q 134 -278 168 -284 Q 201 -291 238 -291 L 390 -291 L 390 -309 Q 390 -366 358 -397 Q 327 -428 265 -428 Q 225 -428 190 -412 Q 155 -395 122 -356 L 61 -408 Q 102 -456 155 -478 Q 208 -501 271 -501 Q 368 -501 421 -451 Q 474 -401 474 -309 L 474 0 Z M 390 -227 L 250 -227 Q 228 -227 204 -223 Q 180 -219 162 -206 Q 149 -196 142 -181 Q 134 -166 134 -146 Q 134 -107 163 -84 Q 192 -61 241 -61 Q 282 -61 316 -80 Q 349 -99 370 -132 Q 390 -166 390 -208 Z M 242 -556 L 351 -697 L 442 -697 L 305 -556 Z" },
    ["è"] = { 540, "M 280 8 Q 222 8 178 -12 Q 135 -31 106 -66 Q 78 -101 64 -146 Q 49 -192 49 -243 Q 49 -294 63 -340 Q 77 -387 104 -423 Q 132 -459 174 -480 Q 216 -501 272 -501 Q 329 -501 370 -482 Q 412 -462 438 -428 Q 465 -394 478 -352 Q 491 -310 491 -265 Q 491 -261 490 -246 Q 490 -232 488 -221 L 133 -221 Q 136 -149 175 -109 Q 214 -69 281 -69 Q 324 -69 356 -83 Q 388 -97 416 -128 L 475 -76 Q 448 -47 418 -28 Q 388 -10 354 -1 Q 321 8 280 8 Z M 410 -284 Q 410 -290 410 -296 Q 410 -320 402 -344 Q 393 -368 376 -388 Q 360 -407 334 -418 Q 309 -430 274 -430 Q 231 -430 200 -410 Q 169 -390 152 -357 Q 135 -324 132 -284 Z M 241 -556 L 111 -697 L 201 -697 L 305 -556 Z" },
    ["é"] = { 540, "M 280 8 Q 222 8 178 -12 Q 135 -31 106 -66 Q 78 -101 64 -146 Q 49 -192 49 -243 Q 49 -294 63 -340 Q 77 -387 104 -423 Q 132 -459 174 -480 Q 216 -501 272 -501 Q 329 -501 370 -482 Q 412 -462 438 -428 Q 465 -394 478 -352 Q 491 -310 491 -265 Q 491 -261 490 -246 Q 490 -232 488 -221 L 133 -221 Q 136 -149 175 -109 Q 214 -69 281 -69 Q 324 -69 356 -83 Q 388 -97 416 -128 L 475 -76 Q 448 -47 418 -28 Q 388 -10 354 -1 Q 321 8 280 8 Z M 410 -284 Q 410 -290 410 -296 Q 410 -320 402 -344 Q 393 -368 376 -388 Q 360 -407 334 -418 Q 309 -430 274 -430 Q 231 -430 200 -410 Q 169 -390 152 -357 Q 135 -324 132 -284 Z M 241 -556 L 350 -697 L 441 -697 L 304 -556 Z" },
    ["í"] = { 226, "M 71 0 L 71 -493 L 155 -493 L 155 0 Z M 81 -556 L 190 -697 L 281 -697 L 144 -556 Z" },
    ["ï"] = { 226, "M 71 0 L 71 -493 L 155 -493 L 155 0 Z M 156 -582 L 156 -697 L 256 -697 L 256 -582 Z M -29 -582 L -29 -697 L 71 -697 L 71 -582 Z" },
    ["ñ"] = { 547, "M 72 0 L 72 -493 L 157 -493 L 157 -422 Q 165 -435 175 -446 Q 199 -472 233 -486 Q 267 -501 308 -501 Q 389 -501 435 -454 Q 481 -406 481 -313 L 481 0 L 396 0 L 396 -282 Q 396 -357 368 -392 Q 341 -428 285 -428 Q 244 -428 216 -409 Q 187 -390 172 -350 Q 157 -309 157 -246 L 157 0 Z M 334 -567 Q 304 -567 286 -579 Q 267 -591 254 -607 Q 242 -623 230 -635 Q 217 -647 199 -647 Q 180 -647 168 -628 Q 156 -608 156 -573 L 106 -573 Q 106 -634 132 -668 Q 158 -701 203 -701 Q 230 -701 248 -688 Q 265 -676 278 -660 Q 291 -644 304 -632 Q 317 -619 335 -619 Q 352 -619 364 -640 Q 376 -661 376 -697 L 428 -697 Q 428 -636 402 -602 Q 377 -567 334 -567 Z" },
    ["ó"] = { 577, "M 289 8 Q 220 8 166 -24 Q 111 -57 80 -115 Q 49 -173 49 -247 Q 49 -321 80 -378 Q 110 -436 164 -468 Q 219 -501 289 -501 Q 359 -501 412 -468 Q 466 -436 497 -378 Q 528 -321 528 -247 Q 528 -173 497 -116 Q 466 -58 412 -25 Q 358 8 289 8 Z M 289 -67 Q 336 -67 370 -90 Q 405 -112 424 -152 Q 443 -193 443 -247 Q 443 -302 424 -342 Q 405 -383 370 -405 Q 336 -427 289 -427 Q 241 -427 206 -404 Q 171 -382 152 -342 Q 133 -302 133 -247 Q 133 -193 152 -152 Q 171 -112 206 -90 Q 241 -67 289 -67 Z M 257 -556 L 366 -697 L 457 -697 L 320 -556 Z" },
    ["ø"] = { 577, "M 289 8 Q 224 8 172 -21 L 129 48 L 86 48 L 141 -41 Q 104 -71 80 -115 Q 49 -173 49 -247 Q 49 -321 80 -378 Q 110 -436 164 -468 Q 219 -501 289 -501 Q 355 -501 406 -472 L 448 -540 L 491 -540 L 437 -452 Q 473 -422 497 -379 Q 528 -321 528 -247 Q 528 -173 497 -116 Q 466 -58 412 -25 Q 358 8 289 8 Z M 182 -109 L 366 -407 Q 333 -427 289 -427 Q 241 -427 206 -404 Q 171 -382 152 -342 Q 133 -302 133 -247 Q 133 -193 152 -153 Q 164 -127 182 -109 Z M 289 -67 Q 336 -67 370 -90 Q 405 -112 424 -152 Q 443 -193 443 -247 Q 443 -302 424 -343 Q 413 -367 395 -385 L 212 -86 Q 245 -67 289 -67 Z" },
    ["ü"] = { 547, "M 238 8 Q 185 8 146 -14 Q 107 -35 86 -77 Q 66 -119 66 -181 L 66 -493 L 150 -493 L 150 -211 Q 150 -162 162 -130 Q 175 -97 200 -82 Q 225 -66 262 -66 Q 303 -66 332 -86 Q 360 -105 375 -145 Q 390 -185 390 -248 L 390 -493 L 474 -493 L 474 0 L 390 0 L 390 -65 Q 371 -38 344 -21 Q 298 8 238 8 Z M 312 -582 L 312 -697 L 412 -697 L 412 -582 Z M 127 -582 L 127 -697 L 227 -697 L 227 -582 Z" },
    ["ą"] = { 540, "M 396 0 L 391 -76 Q 366 -36 327 -15 Q 286 8 233 8 Q 177 8 136 -12 Q 94 -31 72 -66 Q 49 -101 49 -147 Q 49 -188 66 -216 Q 82 -245 108 -261 Q 134 -278 168 -284 Q 201 -291 238 -291 L 390 -291 L 390 -309 Q 390 -366 358 -397 Q 327 -428 265 -428 Q 225 -428 190 -412 Q 155 -395 122 -356 L 61 -408 Q 102 -456 155 -478 Q 208 -501 271 -501 Q 368 -501 421 -451 Q 474 -401 474 -309 L 474 0 Q 459 8 442 20 Q 424 31 408 46 Q 391 60 381 78 Q 371 95 371 114 Q 371 134 382 144 Q 394 154 411 154 Q 427 154 446 146 Q 465 137 483 121 L 509 161 Q 487 183 462 194 Q 436 204 411 204 Q 374 204 347 182 Q 320 161 320 121 Q 320 92 334 68 Q 347 45 367 27 Q 385 11 403 0 Z M 390 -227 L 250 -227 Q 228 -227 204 -223 Q 180 -219 162 -206 Q 149 -196 142 -181 Q 134 -166 134 -146 Q 134 -107 163 -84 Q 192 -61 241 -61 Q 282 -61 316 -80 Q 349 -99 370 -132 Q 390 -166 390 -208 Z" },
    ["ł"] = { 251, "M 171 8 Q 126 8 98 -20 Q 70 -48 70 -109 L 70 -287 L 19 -246 L 19 -333 L 70 -373 L 70 -697 L 154 -697 L 154 -440 L 241 -509 L 241 -423 L 154 -354 L 154 -125 Q 154 -96 166 -83 Q 178 -70 198 -70 Q 207 -70 218 -72 Q 229 -74 241 -78 L 241 -6 Q 224 1 205 4 Q 186 8 171 8 Z" },
    ["ń"] = { 547, "M 72 0 L 72 -493 L 157 -493 L 157 -422 Q 165 -435 175 -446 Q 199 -472 233 -486 Q 267 -501 308 -501 Q 389 -501 435 -454 Q 481 -406 481 -313 L 481 0 L 396 0 L 396 -282 Q 396 -357 368 -392 Q 341 -428 285 -428 Q 244 -428 216 -409 Q 187 -390 172 -350 Q 157 -309 157 -246 L 157 0 Z M 236 -556 L 345 -697 L 436 -697 L 299 -556 Z" },
    ["ś"] = { 470, "M 235 8 Q 185 8 145 -7 Q 105 -22 76 -47 Q 48 -72 31 -100 L 90 -150 Q 109 -112 146 -88 Q 184 -63 236 -63 Q 283 -63 311 -83 Q 339 -103 339 -137 Q 339 -165 322 -181 Q 305 -197 277 -207 Q 249 -217 216 -225 Q 188 -232 160 -242 Q 131 -252 108 -267 Q 85 -282 71 -306 Q 57 -330 57 -365 Q 57 -426 104 -464 Q 152 -501 229 -501 Q 285 -501 332 -478 Q 378 -454 404 -407 L 350 -367 Q 330 -402 298 -418 Q 265 -433 226 -433 Q 187 -433 161 -417 Q 135 -401 135 -373 Q 135 -352 147 -339 Q 159 -326 182 -317 Q 206 -308 240 -300 Q 271 -293 303 -283 Q 335 -273 362 -257 Q 389 -241 406 -214 Q 422 -188 422 -146 Q 422 -100 399 -65 Q 376 -30 334 -11 Q 292 8 235 8 Z M 200 -556 L 309 -697 L 400 -697 L 263 -556 Z" },
    ["ź"] = { 472, "M 37 0 L 37 -60 L 334 -425 L 51 -425 L 51 -493 L 431 -493 L 431 -429 L 142 -69 L 429 -69 L 429 0 Z M 205 -556 L 314 -697 L 405 -697 L 268 -556 Z" },
    ["–"] = { 412, "M 24 -272 L 24 -335 L 388 -335 L 388 -272 Z" },
}
GLYPHS.M = {
    [" "] = { 260, "" },
    ["!"] = { 244, "M 85 -205 L 74 -697 L 171 -697 L 160 -205 Z M 66 0 L 66 -121 L 178 -121 L 178 0 Z" },
    ["\""] = { 347, "M 49 -413 L 49 -697 L 131 -697 L 131 -413 Z M 215 -413 L 215 -697 L 298 -697 L 298 -413 Z" },
    ["#"] = { 697, "M 124 0 L 168 -207 L 50 -207 L 50 -277 L 183 -277 L 215 -431 L 91 -431 L 91 -505 L 230 -505 L 274 -697 L 352 -697 L 308 -501 L 452 -501 L 494 -697 L 572 -697 L 529 -501 L 647 -501 L 647 -431 L 514 -431 L 480 -277 L 607 -277 L 607 -207 L 466 -207 L 421 0 L 344 0 L 389 -207 L 244 -207 L 201 0 Z M 261 -277 L 405 -277 L 436 -431 L 292 -431 Z" },
    ["$"] = { 560, "M 248 113 L 248 9 Q 170 0 117 -44 Q 48 -100 33 -193 L 132 -217 Q 143 -149 187 -114 Q 231 -79 295 -79 Q 332 -79 360 -92 Q 389 -106 406 -132 Q 423 -157 423 -189 Q 423 -223 404 -245 Q 386 -267 352 -284 Q 319 -302 272 -320 Q 211 -343 168 -370 Q 124 -397 100 -434 Q 77 -472 77 -525 Q 77 -579 104 -620 Q 130 -662 178 -686 Q 210 -702 248 -707 L 248 -808 L 319 -808 L 319 -708 Q 368 -703 409 -680 Q 461 -649 492 -588 L 411 -538 Q 389 -578 358 -599 Q 326 -620 286 -620 Q 255 -620 230 -608 Q 206 -596 192 -576 Q 179 -555 179 -527 Q 179 -498 196 -477 Q 212 -456 244 -440 Q 277 -423 326 -405 Q 388 -381 432 -354 Q 476 -326 500 -288 Q 524 -250 524 -195 Q 524 -135 494 -88 Q 465 -42 413 -15 Q 371 7 319 11 L 319 113 Z" },
    ["%"] = { 743, "M 111 0 L 557 -697 L 628 -697 L 181 0 Z M 543 9 Q 501 9 466 -12 Q 432 -32 411 -68 Q 390 -105 390 -153 Q 390 -201 410 -237 Q 431 -273 465 -293 Q 499 -313 542 -313 Q 585 -313 620 -292 Q 655 -270 675 -234 Q 695 -198 695 -153 Q 695 -109 675 -72 Q 655 -35 620 -13 Q 586 9 543 9 Z M 543 -58 Q 568 -58 587 -70 Q 606 -83 618 -104 Q 629 -126 629 -153 Q 629 -181 617 -202 Q 605 -223 586 -235 Q 566 -247 542 -247 Q 519 -247 500 -236 Q 480 -224 468 -203 Q 457 -182 457 -153 Q 457 -124 469 -102 Q 481 -80 501 -69 Q 521 -58 543 -58 Z M 202 -384 Q 159 -384 124 -404 Q 90 -425 69 -461 Q 48 -497 48 -544 Q 48 -593 68 -629 Q 89 -665 124 -686 Q 158 -706 200 -706 Q 243 -706 278 -684 Q 313 -663 333 -626 Q 353 -589 353 -544 Q 353 -501 333 -464 Q 313 -428 279 -406 Q 245 -384 202 -384 Z M 202 -451 Q 226 -451 244 -464 Q 263 -476 274 -497 Q 286 -518 286 -544 Q 286 -573 274 -594 Q 262 -615 243 -627 Q 224 -639 200 -639 Q 177 -639 158 -628 Q 138 -617 126 -596 Q 114 -574 114 -544 Q 114 -516 126 -494 Q 138 -473 158 -462 Q 178 -451 202 -451 Z" },
    ["&"] = { 691, "M 277 11 Q 212 11 161 -9 Q 110 -29 80 -68 Q 51 -108 51 -164 Q 51 -209 70 -244 Q 89 -279 119 -306 Q 149 -332 186 -354 Q 202 -364 217 -373 Q 201 -393 183 -417 Q 163 -442 150 -473 Q 136 -504 136 -542 Q 136 -592 162 -628 Q 187 -664 230 -684 Q 272 -704 323 -704 Q 404 -704 450 -663 Q 497 -622 497 -554 Q 497 -497 468 -456 Q 439 -415 395 -384 Q 375 -371 356 -358 L 489 -205 Q 526 -270 544 -365 L 631 -351 Q 612 -232 563 -151 Q 557 -142 551 -134 L 645 -26 L 575 35 L 490 -64 Q 466 -44 440 -30 Q 367 11 277 11 Z M 432 -131 L 278 -311 Q 253 -296 230 -281 Q 195 -258 174 -232 Q 152 -205 152 -169 Q 152 -125 186 -99 Q 220 -73 277 -73 Q 369 -73 432 -131 Z M 293 -416 Q 314 -429 333 -442 Q 366 -465 386 -492 Q 406 -518 406 -552 Q 406 -582 386 -604 Q 367 -627 324 -627 Q 283 -627 256 -603 Q 230 -579 230 -539 Q 230 -515 241 -492 Q 252 -469 268 -449 Q 280 -432 293 -416 Z" },
    ["'"] = { 180, "M 49 -413 L 49 -697 L 132 -697 L 132 -413 Z" },
    ["("] = { 240, "M 147 204 Q 118 163 96 109 Q 73 55 58 -5 Q 43 -65 36 -126 Q 28 -188 28 -245 Q 28 -328 42 -410 Q 55 -493 82 -566 Q 109 -640 148 -697 L 237 -697 Q 192 -637 163 -562 Q 134 -486 120 -405 Q 106 -324 106 -246 Q 106 -189 114 -128 Q 122 -67 139 -7 Q 156 53 180 108 Q 205 162 237 204 Z" },
    [")"] = { 240, "M 93 204 L 4 204 Q 36 162 60 108 Q 85 53 102 -7 Q 118 -67 126 -128 Q 134 -189 134 -246 Q 134 -324 120 -405 Q 107 -486 78 -562 Q 48 -637 4 -697 L 92 -697 Q 133 -640 159 -566 Q 185 -493 198 -410 Q 212 -328 212 -245 Q 212 -188 204 -126 Q 197 -65 182 -5 Q 167 55 145 109 Q 123 163 93 204 Z" },
    ["*"] = { 398, "M 129 -391 L 82 -426 L 170 -528 L 39 -559 L 57 -617 L 181 -564 L 169 -697 L 229 -697 L 218 -564 L 342 -617 L 359 -559 L 229 -528 L 317 -426 L 270 -391 L 199 -507 Z" },
    ["+"] = { 560, "M 241 -7 L 241 -209 L 39 -209 L 39 -286 L 241 -286 L 241 -488 L 319 -488 L 319 -286 L 521 -286 L 521 -209 L 319 -209 L 319 -7 Z" },
    [","] = { 240, "M 24 152 L 109 -150 L 218 -150 L 90 152 Z" },
    ["-"] = { 327, "M 40 -264 L 40 -337 L 288 -337 L 288 -264 Z" },
    ["."] = { 240, "M 65 0 L 65 -121 L 175 -121 L 175 0 Z" },
    ["/"] = { 419, "M -47 211 L 311 -697 L 386 -697 L 27 211 Z" },
    ["0"] = { 560, "M 282 8 Q 221 8 180 -14 Q 138 -36 112 -74 Q 85 -111 72 -158 Q 58 -204 53 -254 Q 48 -305 48 -351 Q 48 -397 52 -446 Q 57 -496 70 -542 Q 84 -589 110 -626 Q 136 -663 178 -685 Q 219 -707 279 -707 Q 338 -707 379 -686 Q 420 -664 446 -628 Q 473 -592 487 -546 Q 501 -500 506 -450 Q 512 -399 512 -351 Q 512 -301 506 -250 Q 501 -199 486 -153 Q 472 -107 446 -70 Q 420 -34 380 -13 Q 340 8 282 8 Z M 282 -86 Q 332 -86 360 -121 Q 389 -156 401 -215 Q 413 -274 413 -347 Q 413 -424 400 -484 Q 388 -543 359 -578 Q 330 -613 279 -613 Q 239 -613 214 -592 Q 188 -571 174 -534 Q 160 -497 154 -450 Q 148 -402 148 -348 Q 148 -296 154 -249 Q 160 -202 174 -166 Q 189 -129 215 -108 Q 241 -86 282 -86 Z" },
    ["1"] = { 560, "M 284 0 L 284 -509 L 104 -509 L 104 -587 L 220 -587 Q 252 -587 268 -600 Q 284 -614 284 -648 L 284 -697 L 383 -697 L 383 0 Z" },
    ["2"] = { 560, "M 46 0 L 46 -78 Q 80 -105 125 -138 Q 170 -171 216 -210 Q 263 -249 303 -293 Q 343 -337 368 -386 Q 392 -434 392 -485 Q 392 -540 362 -574 Q 332 -609 272 -609 Q 227 -609 198 -588 Q 168 -567 154 -531 Q 140 -495 139 -451 L 43 -458 Q 43 -507 58 -551 Q 73 -595 102 -630 Q 132 -664 176 -684 Q 219 -704 275 -704 Q 339 -704 386 -677 Q 434 -650 461 -602 Q 488 -554 488 -489 Q 488 -434 468 -383 Q 449 -332 414 -286 Q 379 -239 333 -198 Q 287 -157 234 -121 Q 212 -105 189 -91 L 516 -91 L 516 0 Z" },
    ["3"] = { 560, "M 275 8 Q 199 8 142 -20 Q 85 -47 54 -98 Q 22 -148 22 -215 L 119 -221 Q 119 -159 162 -122 Q 206 -86 278 -86 Q 325 -86 359 -101 Q 393 -116 411 -144 Q 429 -171 429 -209 Q 429 -243 414 -266 Q 400 -288 374 -302 Q 349 -316 314 -322 Q 278 -327 237 -327 L 237 -404 Q 267 -404 295 -410 Q 323 -415 344 -427 Q 366 -439 378 -460 Q 390 -480 390 -510 Q 390 -541 376 -564 Q 361 -587 335 -600 Q 309 -612 274 -612 Q 216 -612 184 -580 Q 151 -549 150 -499 L 54 -505 Q 54 -564 82 -609 Q 111 -654 162 -680 Q 212 -705 277 -705 Q 339 -705 386 -682 Q 434 -658 461 -616 Q 488 -575 488 -520 Q 488 -492 480 -470 Q 472 -447 457 -429 Q 442 -411 422 -398 Q 403 -386 380 -377 Q 409 -369 436 -356 Q 462 -342 482 -321 Q 503 -300 515 -272 Q 527 -244 527 -208 Q 527 -144 495 -95 Q 463 -46 406 -19 Q 350 8 275 8 Z" },
    ["4"] = { 560, "M 337 0 L 337 -165 L 13 -165 L 13 -242 L 347 -697 L 436 -697 L 436 -257 L 547 -257 L 547 -165 L 436 -165 L 436 0 Z M 118 -257 L 337 -257 L 337 -564 Z" },
    ["5"] = { 560, "M 278 9 Q 215 9 162 -18 Q 110 -45 76 -92 Q 42 -138 32 -197 L 128 -214 Q 134 -180 152 -150 Q 171 -120 202 -102 Q 234 -85 276 -85 Q 324 -85 356 -108 Q 389 -130 406 -166 Q 423 -201 423 -241 Q 423 -279 407 -311 Q 391 -343 360 -362 Q 328 -382 281 -382 Q 238 -382 204 -362 Q 171 -343 148 -309 L 53 -334 L 119 -697 L 495 -697 L 495 -606 L 200 -606 L 168 -431 Q 190 -449 213 -458 Q 255 -474 295 -474 Q 363 -474 416 -442 Q 468 -410 497 -357 Q 526 -304 526 -241 Q 526 -191 508 -146 Q 490 -101 456 -66 Q 423 -31 378 -11 Q 332 9 278 9 Z" },
    ["6"] = { 560, "M 376 -697 L 219 -449 Q 226 -452 232 -454 Q 255 -460 277 -460 Q 343 -460 396 -429 Q 449 -398 480 -346 Q 510 -293 510 -228 Q 510 -160 476 -106 Q 443 -53 388 -22 Q 332 9 264 9 Q 197 9 140 -22 Q 84 -53 50 -106 Q 17 -160 17 -227 Q 17 -262 28 -294 Q 38 -327 55 -356 L 264 -697 Z M 264 -374 Q 224 -374 191 -356 Q 158 -337 138 -304 Q 117 -271 117 -228 Q 117 -187 137 -154 Q 157 -121 190 -102 Q 224 -84 264 -84 Q 305 -84 338 -102 Q 371 -121 391 -154 Q 411 -187 411 -229 Q 411 -271 392 -304 Q 372 -337 339 -356 Q 306 -374 264 -374 Z" },
    ["7"] = { 560, "M 98 0 L 413 -606 L 28 -606 L 28 -697 L 529 -697 L 529 -623 L 207 0 Z" },
    ["8"] = { 560, "M 280 9 Q 216 9 160 -15 Q 103 -39 68 -86 Q 32 -133 32 -203 Q 32 -263 62 -309 Q 91 -355 146 -379 Q 110 -399 89 -434 Q 68 -469 68 -516 Q 68 -576 98 -618 Q 129 -660 178 -683 Q 227 -706 281 -706 Q 338 -706 386 -682 Q 434 -659 463 -616 Q 492 -573 492 -514 Q 492 -466 471 -432 Q 450 -399 414 -379 Q 469 -355 498 -309 Q 528 -263 528 -203 Q 528 -133 492 -86 Q 457 -39 401 -15 Q 345 9 280 9 Z M 280 -84 Q 322 -84 356 -98 Q 389 -113 410 -142 Q 430 -170 430 -212 Q 430 -252 410 -280 Q 391 -309 358 -324 Q 324 -340 280 -340 Q 236 -340 202 -324 Q 169 -309 150 -280 Q 130 -252 130 -212 Q 130 -170 150 -142 Q 171 -113 205 -98 Q 239 -84 280 -84 Z M 282 -407 Q 331 -407 363 -434 Q 395 -462 395 -507 Q 395 -554 364 -584 Q 333 -613 281 -613 Q 249 -613 223 -600 Q 197 -588 182 -566 Q 166 -543 166 -510 Q 166 -463 198 -435 Q 230 -407 282 -407 Z" },
    ["9"] = { 560, "M 167 0 L 324 -247 Q 318 -245 312 -244 Q 289 -237 266 -237 Q 200 -237 147 -268 Q 94 -299 64 -352 Q 33 -404 33 -469 Q 33 -537 66 -590 Q 100 -644 156 -675 Q 212 -706 279 -706 Q 347 -706 403 -675 Q 459 -644 492 -591 Q 526 -538 526 -470 Q 526 -436 516 -404 Q 506 -371 488 -341 L 279 0 Z M 279 -323 Q 320 -323 353 -342 Q 386 -360 406 -393 Q 426 -426 426 -469 Q 426 -511 406 -544 Q 386 -576 353 -594 Q 320 -613 279 -613 Q 239 -613 206 -594 Q 172 -576 152 -544 Q 132 -511 132 -468 Q 132 -426 152 -393 Q 172 -360 205 -342 Q 238 -323 279 -323 Z" },
    [":"] = { 240, "M 64 -349 L 64 -471 L 176 -471 L 176 -349 Z M 64 0 L 64 -121 L 176 -121 L 176 0 Z" },
    [";"] = { 240, "M 7 152 L 93 -130 L 202 -130 L 74 152 Z M 80 -349 L 80 -471 L 192 -471 L 192 -349 Z" },
    ["<"] = { 560, "M 524 0 L 25 -201 L 25 -293 L 524 -494 L 524 -411 L 109 -247 L 524 -82 Z" },
    ["="] = { 560, "M 79 -315 L 79 -393 L 482 -393 L 482 -315 Z M 79 -101 L 79 -179 L 482 -179 L 482 -101 Z" },
    [">"] = { 560, "M 36 0 L 36 -82 L 451 -247 L 36 -411 L 36 -494 L 535 -293 L 535 -201 Z" },
    ["?"] = { 516, "M 212 -203 L 212 -254 Q 212 -295 224 -322 Q 237 -350 256 -370 Q 275 -390 298 -406 Q 320 -421 339 -437 Q 358 -453 370 -474 Q 383 -494 383 -524 Q 383 -573 350 -598 Q 316 -624 258 -624 Q 195 -624 160 -591 Q 126 -558 126 -498 L 40 -498 Q 40 -565 68 -611 Q 96 -657 146 -682 Q 196 -706 259 -706 Q 318 -706 366 -686 Q 413 -667 440 -626 Q 468 -586 468 -522 Q 468 -479 456 -450 Q 443 -421 424 -400 Q 404 -380 382 -365 Q 360 -350 340 -334 Q 321 -319 308 -298 Q 296 -278 296 -247 L 296 -203 Z M 200 0 L 200 -121 L 311 -121 L 311 0 Z" },
    ["@"] = { 874, "M 438 109 Q 359 109 290 80 Q 221 52 169 1 Q 117 -50 87 -118 Q 57 -186 57 -267 Q 57 -350 86 -420 Q 115 -491 166 -543 Q 218 -595 288 -624 Q 357 -652 438 -652 Q 520 -652 589 -624 Q 658 -596 710 -546 Q 761 -495 790 -426 Q 818 -358 818 -279 Q 818 -217 802 -172 Q 786 -126 753 -100 Q 720 -75 669 -75 Q 632 -75 604 -89 Q 577 -103 562 -126 Q 556 -135 552 -145 Q 533 -115 504 -98 Q 460 -72 410 -72 Q 359 -72 318 -96 Q 277 -121 253 -164 Q 229 -208 229 -265 Q 229 -324 253 -368 Q 277 -412 318 -436 Q 359 -460 410 -460 Q 457 -460 494 -438 Q 521 -420 540 -390 L 549 -453 L 624 -453 L 624 -216 Q 624 -181 636 -166 Q 648 -150 677 -150 Q 714 -150 730 -183 Q 746 -216 746 -278 Q 746 -344 724 -399 Q 701 -454 660 -495 Q 618 -536 562 -558 Q 505 -580 438 -580 Q 373 -580 316 -557 Q 260 -534 218 -492 Q 176 -450 153 -393 Q 130 -336 130 -267 Q 130 -202 154 -146 Q 178 -91 220 -50 Q 262 -9 318 14 Q 374 37 438 37 Q 525 37 603 -10 L 637 53 Q 594 81 542 95 Q 490 109 438 109 Z M 429 -149 Q 461 -149 484 -164 Q 508 -179 522 -205 Q 535 -231 535 -265 Q 535 -301 521 -328 Q 507 -354 484 -368 Q 461 -383 429 -383 Q 399 -383 374 -368 Q 350 -353 336 -326 Q 323 -300 323 -265 Q 323 -231 336 -205 Q 350 -179 374 -164 Q 399 -149 429 -149 Z" },
    ["A"] = { 649, "M 14 0 L 285 -697 L 364 -697 L 634 0 L 523 0 L 467 -155 L 182 -155 L 126 0 Z M 434 -246 L 325 -549 L 215 -246 Z" },
    ["B"] = { 604, "M 75 0 L 75 -697 L 305 -697 Q 406 -697 464 -651 Q 521 -605 521 -522 Q 521 -472 499 -434 Q 477 -395 437 -374 Q 497 -356 527 -312 Q 557 -267 557 -199 Q 557 -105 498 -52 Q 439 0 332 0 Z M 177 -94 L 325 -94 Q 456 -94 456 -204 Q 456 -257 426 -286 Q 395 -315 340 -315 L 177 -315 Z M 177 -406 L 317 -406 Q 363 -406 392 -433 Q 420 -460 420 -507 Q 420 -553 390 -578 Q 360 -603 305 -603 L 177 -603 Z" },
    ["C"] = { 706, "M 372 13 Q 275 13 202 -32 Q 128 -77 87 -159 Q 46 -241 46 -349 Q 46 -457 87 -538 Q 128 -620 202 -665 Q 275 -710 372 -710 Q 479 -710 558 -657 Q 636 -604 670 -510 L 575 -475 Q 550 -540 498 -576 Q 446 -613 372 -613 Q 304 -613 254 -580 Q 203 -548 176 -490 Q 148 -431 148 -349 Q 148 -267 176 -208 Q 203 -149 254 -116 Q 304 -84 372 -84 Q 446 -84 498 -120 Q 550 -157 575 -222 L 670 -188 Q 636 -95 558 -41 Q 479 13 372 13 Z" },
    ["D"] = { 679, "M 75 0 L 75 -697 L 271 -697 Q 443 -697 538 -604 Q 632 -512 632 -343 Q 632 -177 538 -88 Q 445 0 270 0 Z M 177 -94 L 261 -94 Q 346 -94 406 -118 Q 466 -142 498 -198 Q 529 -254 529 -347 Q 529 -439 498 -496 Q 467 -552 409 -578 Q 351 -603 270 -603 L 177 -603 Z" },
    ["E"] = { 583, "M 75 0 L 75 -697 L 536 -697 L 536 -606 L 177 -606 L 177 -402 L 506 -402 L 506 -311 L 177 -311 L 177 -91 L 536 -91 L 536 0 Z" },
    ["F"] = { 563, "M 75 0 L 75 -697 L 535 -697 L 535 -606 L 177 -606 L 177 -402 L 488 -402 L 488 -311 L 177 -311 L 177 0 Z" },
    ["G"] = { 732, "M 366 13 Q 272 13 200 -32 Q 128 -77 87 -159 Q 46 -241 46 -349 Q 46 -457 87 -538 Q 128 -620 202 -665 Q 275 -710 372 -710 Q 479 -710 558 -657 Q 636 -604 670 -510 L 575 -475 Q 550 -540 498 -576 Q 446 -613 372 -613 Q 304 -613 254 -580 Q 203 -548 176 -490 Q 148 -431 148 -349 Q 148 -267 176 -208 Q 203 -149 254 -116 Q 304 -84 372 -84 Q 407 -84 444 -94 Q 480 -103 511 -128 Q 542 -152 561 -194 Q 577 -228 579 -279 L 405 -279 L 405 -370 L 670 -370 L 670 0 L 580 0 L 570 -89 Q 555 -62 532 -43 Q 499 -14 456 0 Q 414 13 366 13 Z" },
    ["H"] = { 683, "M 75 0 L 75 -697 L 177 -697 L 177 -405 L 506 -405 L 506 -697 L 608 -697 L 608 0 L 506 0 L 506 -310 L 177 -310 L 177 0 Z" },
    ["I"] = { 252, "M 75 0 L 75 -697 L 177 -697 L 177 0 Z" },
    ["J"] = { 553, "M 257 13 Q 158 13 96 -47 Q 33 -107 26 -212 L 126 -223 Q 131 -149 165 -115 Q 199 -81 257 -81 Q 324 -81 354 -126 Q 383 -170 383 -251 L 383 -606 L 112 -606 L 112 -697 L 485 -697 L 485 -245 Q 485 -165 458 -107 Q 430 -49 379 -18 Q 328 13 257 13 Z" },
    ["K"] = { 644, "M 75 0 L 75 -697 L 177 -697 L 177 -370 L 489 -697 L 625 -697 L 359 -426 L 627 0 L 508 0 L 286 -351 L 177 -240 L 177 0 Z" },
    ["L"] = { 498, "M 75 0 L 75 -697 L 177 -697 L 177 -91 L 484 -91 L 484 0 Z" },
    ["M"] = { 845, "M 75 0 L 75 -697 L 225 -697 L 423 -184 L 621 -697 L 770 -697 L 770 0 L 668 0 L 668 -554 L 472 -60 L 373 -60 L 177 -554 L 177 0 Z" },
    ["N"] = { 680, "M 75 0 L 75 -697 L 181 -697 L 504 -171 L 504 -697 L 605 -697 L 605 0 L 497 0 L 177 -527 L 177 0 Z" },
    ["O"] = { 748, "M 372 13 Q 275 13 202 -32 Q 128 -77 87 -158 Q 46 -240 46 -348 Q 46 -457 87 -538 Q 128 -620 202 -665 Q 275 -710 372 -710 Q 471 -710 545 -665 Q 619 -620 660 -538 Q 701 -457 701 -348 Q 701 -240 660 -158 Q 618 -77 544 -32 Q 470 13 372 13 Z M 372 -84 Q 442 -84 492 -116 Q 542 -149 570 -208 Q 598 -268 598 -348 Q 598 -429 570 -488 Q 542 -548 492 -580 Q 442 -613 372 -613 Q 304 -613 254 -581 Q 203 -549 176 -490 Q 148 -430 148 -348 Q 148 -267 176 -208 Q 203 -148 254 -116 Q 304 -84 372 -84 Z" },
    ["P"] = { 557, "M 75 0 L 75 -697 L 290 -697 Q 405 -697 464 -647 Q 524 -597 524 -498 Q 524 -400 464 -348 Q 404 -296 290 -296 L 176 -296 L 176 0 Z M 176 -386 L 280 -386 Q 347 -386 385 -412 Q 423 -439 423 -497 Q 423 -554 386 -580 Q 350 -606 280 -606 L 176 -606 Z" },
    ["Q"] = { 778, "M 372 13 Q 275 13 202 -32 Q 129 -77 88 -158 Q 46 -240 46 -348 Q 46 -457 87 -538 Q 128 -620 202 -665 Q 275 -710 372 -710 Q 471 -710 545 -665 Q 619 -620 660 -538 Q 701 -457 701 -348 Q 701 -240 660 -159 Q 646 -132 630 -110 L 731 -11 L 669 49 L 569 -49 Q 557 -40 544 -32 Q 470 13 372 13 Z M 372 -84 Q 442 -84 492 -117 Q 494 -118 496 -119 L 394 -219 L 454 -282 L 556 -182 Q 564 -195 570 -209 Q 598 -268 598 -348 Q 598 -429 570 -488 Q 542 -548 492 -580 Q 442 -613 372 -613 Q 304 -613 254 -581 Q 203 -549 176 -490 Q 148 -430 148 -348 Q 148 -267 176 -208 Q 203 -148 254 -116 Q 304 -84 372 -84 Z" },
    ["R"] = { 603, "M 75 0 L 75 -697 L 290 -697 Q 372 -697 424 -673 Q 475 -649 500 -604 Q 524 -560 524 -499 Q 524 -409 473 -358 Q 441 -327 393 -312 L 578 0 L 461 0 L 289 -298 Q 287 -298 285 -298 L 177 -298 L 177 0 Z M 177 -388 L 280 -388 Q 322 -388 354 -398 Q 385 -409 404 -433 Q 423 -457 423 -498 Q 423 -539 404 -562 Q 385 -586 353 -596 Q 321 -606 280 -606 L 177 -606 Z" },
    ["S"] = { 568, "M 294 12 Q 187 12 118 -44 Q 50 -100 35 -193 L 134 -217 Q 145 -149 189 -114 Q 233 -79 297 -79 Q 334 -79 362 -92 Q 391 -106 408 -132 Q 425 -157 425 -189 Q 425 -223 406 -245 Q 388 -267 354 -284 Q 321 -302 274 -320 Q 213 -343 170 -370 Q 126 -397 102 -434 Q 79 -472 79 -525 Q 79 -579 106 -620 Q 132 -662 180 -686 Q 228 -710 291 -710 Q 358 -710 410 -680 Q 463 -649 494 -588 L 413 -538 Q 391 -578 360 -599 Q 328 -620 288 -620 Q 257 -620 232 -608 Q 208 -596 194 -576 Q 181 -555 181 -527 Q 181 -498 198 -477 Q 214 -456 246 -440 Q 279 -423 328 -405 Q 390 -381 434 -354 Q 478 -326 502 -288 Q 526 -250 526 -195 Q 526 -135 496 -88 Q 467 -42 415 -15 Q 363 12 294 12 Z" },
    ["T"] = { 586, "M 242 0 L 242 -606 L 14 -606 L 14 -697 L 572 -697 L 572 -606 L 345 -606 L 345 0 Z" },
    ["U"] = { 656, "M 327 13 Q 201 13 134 -54 Q 68 -121 68 -252 L 68 -697 L 170 -697 L 170 -264 Q 170 -204 185 -163 Q 200 -122 234 -101 Q 269 -80 327 -80 Q 385 -80 420 -102 Q 456 -123 471 -164 Q 486 -204 486 -264 L 486 -697 L 587 -697 L 587 -257 Q 587 -124 521 -56 Q 455 13 327 13 Z" },
    ["V"] = { 661, "M 293 0 L 14 -697 L 126 -697 L 332 -163 L 535 -697 L 647 -697 L 370 0 Z" },
    ["W"] = { 964, "M 226 0 L 20 -697 L 126 -697 L 282 -155 L 432 -658 L 533 -658 L 683 -155 L 838 -697 L 945 -697 L 739 0 L 639 0 L 483 -509 L 326 0 Z" },
    ["X"] = { 651, "M 19 0 L 255 -349 L 21 -697 L 142 -697 L 326 -421 L 508 -697 L 630 -697 L 395 -349 L 633 0 L 511 0 L 325 -275 L 139 0 Z" },
    ["Y"] = { 610, "M 255 0 L 255 -270 L 9 -697 L 125 -697 L 303 -372 L 485 -697 L 600 -697 L 357 -270 L 357 0 Z" },
    ["Z"] = { 590, "M 31 0 L 31 -85 L 421 -606 L 54 -606 L 54 -697 L 546 -697 L 546 -612 L 155 -91 L 558 -91 L 558 0 Z" },
    ["["] = { 272, "M 61 247 L 61 -740 L 263 -740 L 263 -675 L 141 -675 L 141 182 L 263 182 L 263 247 Z" },
    ["\\"] = { 454, "M 502 211 L 427 211 L 68 -697 L 143 -697 Z" },
    ["]"] = { 272, "M 211 247 L 9 247 L 9 182 L 130 182 L 130 -675 L 9 -675 L 9 -740 L 211 -740 Z" },
    ["^"] = { 577, "M 30 -215 L 227 -697 L 350 -697 L 547 -215 L 443 -215 L 288 -614 L 134 -215 Z" },
    ["_"] = { 434, "M 12 75 L 12 0 L 422 0 L 422 75 Z" },
    ["`"] = { 299, "M 180 -556 L 45 -697 L 149 -697 L 253 -556 Z" },
    ["a"] = { 542, "M 390 0 L 384 -72 Q 383 -71 382 -70 Q 356 -31 318 -11 Q 279 9 231 9 Q 176 9 134 -11 Q 92 -31 69 -66 Q 46 -102 46 -149 Q 46 -190 63 -220 Q 80 -249 107 -265 Q 132 -281 164 -288 Q 197 -294 234 -294 L 382 -294 L 382 -310 Q 382 -362 352 -390 Q 322 -418 265 -418 Q 225 -418 188 -402 Q 152 -386 119 -350 L 58 -413 Q 102 -459 156 -480 Q 209 -502 272 -502 Q 371 -502 426 -452 Q 480 -401 480 -310 L 480 0 Z M 382 -220 L 248 -220 Q 228 -220 206 -216 Q 185 -213 170 -202 Q 158 -193 151 -180 Q 144 -166 144 -148 Q 144 -113 171 -92 Q 198 -71 243 -71 Q 281 -71 312 -88 Q 344 -106 363 -136 Q 382 -167 382 -206 Z" },
    ["b"] = { 583, "M 318 9 Q 274 9 238 -8 Q 201 -26 176 -60 Q 171 -66 166 -73 L 166 0 L 68 0 L 68 -697 L 166 -697 L 166 -418 Q 171 -426 176 -433 Q 201 -465 238 -484 Q 274 -502 318 -502 Q 379 -502 429 -471 Q 479 -440 508 -383 Q 537 -326 537 -247 Q 537 -175 510 -116 Q 483 -58 434 -24 Q 384 9 318 9 Z M 297 -81 Q 340 -81 372 -102 Q 403 -123 421 -160 Q 439 -198 439 -247 Q 439 -296 421 -334 Q 403 -371 372 -392 Q 340 -412 297 -412 Q 255 -412 224 -392 Q 192 -371 174 -334 Q 157 -296 157 -247 Q 157 -198 174 -160 Q 192 -123 224 -102 Q 255 -81 297 -81 Z" },
    ["c"] = { 519, "M 277 9 Q 221 9 178 -12 Q 134 -32 104 -68 Q 75 -104 60 -150 Q 45 -196 45 -247 Q 45 -297 60 -343 Q 75 -389 104 -425 Q 134 -461 178 -482 Q 221 -502 277 -502 Q 349 -502 402 -467 Q 456 -432 481 -361 L 395 -328 Q 382 -367 353 -392 Q 324 -417 277 -417 Q 231 -417 201 -392 Q 171 -368 157 -330 Q 143 -291 143 -247 Q 143 -203 157 -164 Q 171 -125 201 -101 Q 231 -77 277 -77 Q 324 -77 353 -102 Q 382 -126 395 -166 L 481 -133 Q 456 -61 402 -26 Q 349 9 277 9 Z" },
    ["d"] = { 583, "M 265 9 Q 198 9 149 -24 Q 100 -58 72 -116 Q 45 -175 45 -247 Q 45 -326 74 -383 Q 104 -440 154 -471 Q 204 -502 265 -502 Q 309 -502 346 -484 Q 382 -466 407 -434 Q 412 -427 417 -420 L 417 -697 L 514 -697 L 514 0 L 417 0 L 417 -74 Q 412 -66 407 -60 Q 381 -26 344 -8 Q 308 9 265 9 Z M 285 -81 Q 328 -81 360 -102 Q 391 -123 408 -160 Q 426 -198 426 -247 Q 426 -296 408 -334 Q 391 -371 360 -392 Q 328 -412 285 -412 Q 243 -412 211 -392 Q 179 -371 162 -334 Q 144 -296 144 -247 Q 144 -198 162 -160 Q 179 -123 211 -102 Q 243 -81 285 -81 Z" },
    ["e"] = { 540, "M 280 9 Q 220 9 176 -11 Q 132 -31 103 -66 Q 74 -102 60 -148 Q 45 -193 45 -243 Q 45 -293 59 -340 Q 73 -386 101 -422 Q 129 -459 172 -480 Q 214 -502 272 -502 Q 330 -502 372 -482 Q 414 -463 441 -428 Q 468 -394 482 -351 Q 495 -308 495 -260 Q 495 -255 494 -242 Q 494 -228 492 -216 L 143 -216 Q 146 -150 184 -114 Q 221 -79 283 -79 Q 325 -79 358 -92 Q 391 -106 419 -135 L 479 -73 Q 450 -44 420 -26 Q 389 -8 356 0 Q 322 9 280 9 Z M 401 -288 Q 401 -293 401 -297 Q 401 -320 393 -342 Q 385 -364 369 -382 Q 353 -399 330 -410 Q 306 -420 275 -420 Q 234 -420 205 -402 Q 176 -383 160 -353 Q 145 -323 142 -288 Z" },
    ["f"] = { 339, "M 108 0 L 108 -417 L 10 -417 L 10 -493 L 109 -493 L 109 -553 Q 109 -612 128 -645 Q 147 -678 180 -692 Q 212 -706 252 -706 Q 280 -706 302 -700 Q 323 -695 343 -685 L 311 -611 Q 300 -617 288 -620 Q 276 -624 263 -624 Q 233 -624 220 -605 Q 206 -586 206 -553 L 206 -493 L 318 -493 L 318 -417 L 206 -417 L 206 0 Z" },
    ["g"] = { 517, "M 270 213 Q 163 213 100 174 Q 38 135 38 66 Q 38 61 38 53 Q 39 45 41 37 L 119 -17 Q 95 -28 78 -44 Q 50 -69 50 -111 Q 50 -147 76 -178 Q 89 -194 107 -207 Q 95 -219 86 -234 Q 61 -273 61 -324 Q 61 -377 87 -417 Q 113 -457 158 -480 Q 202 -502 256 -502 Q 308 -502 353 -480 Q 364 -474 375 -466 L 455 -531 L 504 -470 L 429 -406 Q 450 -369 450 -320 Q 450 -268 426 -230 Q 401 -191 358 -170 Q 315 -149 259 -149 Q 202 -149 158 -170 Q 155 -168 153 -166 Q 139 -150 139 -128 Q 139 -110 152 -99 Q 166 -88 191 -82 Q 216 -76 251 -71 Q 300 -64 342 -56 Q 385 -48 418 -34 Q 450 -19 468 6 Q 485 30 485 69 Q 485 139 428 176 Q 372 213 270 213 Z M 257 -227 Q 303 -227 328 -256 Q 353 -284 353 -325 Q 353 -369 326 -396 Q 300 -422 257 -422 Q 212 -422 185 -395 Q 158 -368 158 -326 Q 158 -284 184 -256 Q 210 -227 257 -227 Z M 176 2 L 131 58 Q 130 62 130 64 L 130 70 Q 130 106 170 124 Q 210 142 270 142 Q 323 142 356 128 Q 389 113 389 81 Q 389 64 379 53 Q 369 42 349 36 Q 329 29 302 24 Q 274 20 238 15 Q 206 10 176 2 Z" },
    ["h"] = { 553, "M 68 0 L 68 -697 L 167 -697 L 167 -425 Q 175 -437 185 -447 Q 210 -474 244 -488 Q 277 -502 315 -502 Q 397 -502 444 -454 Q 490 -407 490 -316 L 490 0 L 392 0 L 392 -280 Q 392 -351 366 -384 Q 341 -417 288 -417 Q 229 -417 198 -376 Q 167 -334 167 -243 L 167 0 Z" },
    ["i"] = { 232, "M 67 0 L 67 -493 L 165 -493 L 165 0 Z M 60 -578 L 60 -697 L 171 -697 L 171 -578 Z" },
    ["j"] = { 232, "M 56 213 Q 38 213 17 209 Q -4 205 -25 199 L -25 114 Q -10 118 2 120 Q 13 122 21 122 Q 43 122 55 110 Q 67 98 67 66 L 67 -493 L 165 -493 L 165 92 Q 165 154 135 184 Q 105 213 56 213 Z M 61 -578 L 61 -697 L 172 -697 L 172 -578 Z" },
    ["k"] = { 541, "M 404 0 L 247 -244 L 167 -158 L 167 0 L 68 0 L 68 -697 L 167 -697 L 167 -282 L 371 -493 L 496 -493 L 318 -310 L 520 0 Z" },
    ["l"] = { 269, "M 173 9 Q 126 9 96 -20 Q 66 -49 66 -112 L 66 -697 L 163 -697 L 163 -131 Q 163 -105 174 -94 Q 186 -82 205 -82 Q 213 -82 224 -84 Q 234 -85 245 -89 L 245 -6 Q 227 2 208 6 Q 188 9 173 9 Z" },
    ["m"] = { 833, "M 68 0 L 68 -493 L 167 -493 L 167 -418 Q 169 -422 171 -425 Q 187 -452 208 -469 Q 230 -486 255 -494 Q 280 -502 306 -502 Q 349 -502 384 -486 Q 418 -469 442 -435 Q 446 -427 451 -419 Q 454 -424 457 -428 Q 481 -465 516 -484 Q 552 -502 598 -502 Q 660 -502 698 -474 Q 735 -446 752 -402 Q 770 -357 770 -304 L 770 0 L 673 0 L 673 -280 Q 673 -323 663 -354 Q 653 -384 632 -400 Q 611 -417 576 -417 Q 542 -417 518 -400 Q 494 -382 482 -347 Q 469 -312 469 -260 L 469 0 L 371 0 L 371 -286 Q 371 -352 346 -384 Q 322 -417 276 -417 Q 242 -417 218 -400 Q 193 -382 180 -347 Q 167 -312 167 -260 L 167 0 Z" },
    ["n"] = { 553, "M 68 0 L 68 -493 L 167 -493 L 167 -424 Q 175 -437 185 -448 Q 209 -474 242 -488 Q 276 -502 315 -502 Q 397 -502 444 -454 Q 490 -407 490 -316 L 490 0 L 392 0 L 392 -280 Q 392 -351 366 -384 Q 341 -417 288 -417 Q 248 -417 222 -399 Q 195 -381 181 -342 Q 167 -303 167 -243 L 167 0 Z" },
    ["o"] = { 575, "M 288 9 Q 218 9 163 -24 Q 108 -57 76 -115 Q 45 -173 45 -247 Q 45 -321 76 -378 Q 107 -436 162 -469 Q 218 -502 288 -502 Q 359 -502 413 -469 Q 467 -436 498 -378 Q 530 -321 530 -247 Q 530 -173 498 -116 Q 467 -58 412 -24 Q 358 9 288 9 Z M 288 -78 Q 332 -78 364 -99 Q 397 -120 414 -158 Q 432 -196 432 -247 Q 432 -299 414 -337 Q 397 -375 364 -396 Q 332 -416 288 -416 Q 243 -416 210 -395 Q 178 -374 160 -336 Q 143 -299 143 -247 Q 143 -196 160 -158 Q 178 -120 210 -99 Q 243 -78 288 -78 Z" },
    ["p"] = { 583, "M 68 204 L 68 -493 L 166 -493 L 166 -426 Q 171 -433 177 -440 Q 202 -471 238 -486 Q 274 -502 318 -502 Q 384 -502 434 -468 Q 483 -435 510 -377 Q 537 -319 537 -246 Q 537 -168 508 -110 Q 479 -53 429 -22 Q 379 9 318 9 Q 274 9 238 -8 Q 201 -25 176 -56 Q 171 -62 166 -69 L 166 204 Z M 297 -81 Q 340 -81 372 -102 Q 403 -122 421 -160 Q 439 -197 439 -246 Q 439 -295 421 -332 Q 403 -370 372 -391 Q 340 -412 297 -412 Q 255 -412 224 -391 Q 192 -370 174 -332 Q 157 -295 157 -246 Q 157 -197 174 -160 Q 192 -122 224 -102 Q 255 -81 297 -81 Z" },
    ["q"] = { 583, "M 417 204 L 417 -69 Q 412 -62 407 -56 Q 382 -25 346 -8 Q 309 9 265 9 Q 204 9 154 -22 Q 104 -53 74 -110 Q 45 -168 45 -246 Q 45 -319 72 -377 Q 100 -435 149 -468 Q 198 -502 265 -502 Q 308 -502 344 -486 Q 381 -471 407 -440 Q 412 -433 417 -426 L 417 -493 L 514 -493 L 514 204 Z M 285 -81 Q 328 -81 360 -102 Q 391 -122 408 -160 Q 426 -197 426 -246 Q 426 -295 408 -332 Q 391 -370 360 -391 Q 328 -412 285 -412 Q 243 -412 211 -391 Q 179 -370 162 -332 Q 144 -295 144 -246 Q 144 -197 162 -160 Q 179 -122 211 -102 Q 243 -81 285 -81 Z" },
    ["r"] = { 413, "M 68 0 L 68 -493 L 167 -493 L 167 -419 Q 171 -426 177 -433 Q 202 -465 237 -484 Q 272 -502 306 -502 Q 330 -502 352 -496 Q 373 -491 395 -478 L 347 -390 Q 336 -396 319 -400 Q 302 -404 287 -404 Q 264 -404 242 -396 Q 220 -388 202 -370 Q 185 -352 176 -323 Q 172 -309 170 -286 Q 167 -264 167 -225 L 167 0 Z" },
    ["s"] = { 471, "M 234 9 Q 182 9 142 -6 Q 102 -22 74 -46 Q 45 -71 28 -97 L 95 -155 Q 114 -121 150 -96 Q 185 -72 235 -72 Q 279 -72 304 -90 Q 330 -109 330 -139 Q 330 -163 314 -178 Q 298 -192 272 -202 Q 246 -211 215 -218 Q 187 -226 158 -236 Q 129 -246 106 -262 Q 82 -277 68 -302 Q 53 -326 53 -362 Q 53 -425 102 -464 Q 150 -502 230 -502 Q 287 -502 334 -478 Q 381 -455 407 -409 L 346 -362 Q 326 -395 294 -410 Q 263 -425 226 -425 Q 191 -425 168 -410 Q 144 -396 144 -371 Q 144 -353 154 -342 Q 165 -330 188 -322 Q 210 -313 243 -305 Q 274 -298 306 -288 Q 338 -278 365 -262 Q 392 -246 409 -219 Q 426 -192 426 -149 Q 426 -102 402 -66 Q 378 -31 335 -11 Q 292 9 234 9 Z" },
    ["t"] = { 353, "M 240 9 Q 204 9 174 -5 Q 143 -19 126 -50 Q 108 -82 108 -132 L 108 -417 L 10 -417 L 10 -493 L 108 -493 L 108 -619 L 207 -674 L 207 -493 L 319 -493 L 319 -417 L 207 -417 L 207 -158 Q 207 -117 220 -94 Q 232 -72 266 -72 Q 276 -72 290 -74 Q 303 -77 319 -81 L 319 -5 Q 299 2 279 6 Q 259 9 240 9 Z" },
    ["u"] = { 553, "M 237 9 Q 182 9 142 -14 Q 103 -36 82 -78 Q 62 -121 62 -182 L 62 -493 L 160 -493 L 160 -213 Q 160 -169 171 -138 Q 182 -108 206 -92 Q 229 -77 265 -77 Q 307 -77 334 -98 Q 360 -119 373 -160 Q 386 -202 386 -264 L 386 -493 L 483 -493 L 483 0 L 386 0 L 386 -64 Q 367 -36 339 -19 Q 294 9 237 9 Z" },
    ["v"] = { 526, "M 222 0 L 20 -493 L 128 -493 L 262 -127 L 398 -493 L 504 -493 L 304 0 Z" },
    ["w"] = { 750, "M 173 0 L 25 -493 L 129 -493 L 223 -149 L 332 -493 L 417 -493 L 526 -151 L 621 -493 L 725 -493 L 576 0 L 487 0 L 375 -356 L 263 0 Z" },
    ["x"] = { 527, "M 25 0 L 199 -248 L 25 -493 L 143 -493 L 264 -314 L 386 -493 L 503 -493 L 327 -248 L 503 0 L 384 0 L 264 -181 L 141 0 Z" },
    ["y"] = { 526, "M 114 203 L 210 -29 L 20 -493 L 128 -493 L 262 -127 L 398 -493 L 504 -493 L 221 203 Z" },
    ["z"] = { 472, "M 36 0 L 36 -68 L 316 -413 L 49 -413 L 49 -493 L 431 -493 L 431 -421 L 159 -80 L 430 -80 L 430 0 Z" },
    ["{"] = { 254, "M 178 247 Q 125 247 97 212 Q 69 178 69 115 L 69 -131 Q 69 -159 60 -176 Q 52 -193 38 -202 Q 24 -211 6 -212 L 6 -281 Q 24 -284 38 -292 Q 52 -301 60 -318 Q 69 -335 69 -362 L 69 -608 Q 69 -672 97 -706 Q 125 -740 178 -740 L 246 -740 L 246 -677 L 210 -677 Q 178 -677 166 -657 Q 153 -637 153 -607 L 153 -360 Q 153 -313 135 -288 Q 117 -264 86 -250 L 86 -243 Q 117 -230 135 -205 Q 153 -180 153 -134 L 153 114 Q 153 144 166 164 Q 178 184 210 184 L 246 184 L 246 247 Z" },
    ["|"] = { 262, "M 94 254 L 94 -746 L 168 -746 L 168 254 Z" },
    ["}"] = { 254, "M 75 247 L 8 247 L 8 184 L 43 184 Q 76 184 88 164 Q 101 144 101 114 L 101 -134 Q 101 -180 118 -205 Q 136 -230 168 -243 L 168 -250 Q 136 -264 118 -288 Q 101 -313 101 -360 L 101 -607 Q 101 -637 88 -657 Q 76 -677 43 -677 L 8 -677 L 8 -740 L 75 -740 Q 128 -740 156 -706 Q 185 -672 185 -608 L 185 -362 Q 185 -335 194 -318 Q 202 -301 216 -292 Q 230 -284 247 -281 L 247 -212 Q 230 -211 216 -202 Q 202 -193 194 -176 Q 185 -159 185 -131 L 185 115 Q 185 178 156 212 Q 128 247 75 247 Z" },
    ["~"] = { 560, "M 367 -154 Q 333 -154 312 -166 Q 290 -177 276 -194 Q 262 -212 250 -229 Q 239 -246 226 -258 Q 212 -269 191 -269 Q 168 -269 154 -244 Q 141 -220 141 -181 L 63 -181 Q 63 -251 98 -296 Q 133 -340 191 -340 Q 226 -340 248 -328 Q 271 -317 286 -300 Q 300 -282 312 -264 Q 323 -246 336 -234 Q 348 -223 367 -223 Q 391 -223 406 -252 Q 421 -281 421 -324 L 498 -324 Q 498 -249 462 -202 Q 427 -154 367 -154 Z" },
    ["·"] = { 325, "M 102 -288 L 102 -410 L 210 -410 L 210 -288 Z" },
    ["Á"] = { 649, "M 14 0 L 285 -697 L 364 -697 L 634 0 L 523 0 L 467 -155 L 182 -155 L 126 0 Z M 434 -246 L 325 -549 L 215 -246 Z M 288 -760 L 398 -901 L 503 -901 L 361 -760 Z" },
    ["á"] = { 542, "M 390 0 L 384 -72 Q 383 -71 382 -70 Q 356 -31 318 -11 Q 279 9 231 9 Q 176 9 134 -11 Q 92 -31 69 -66 Q 46 -102 46 -149 Q 46 -190 63 -220 Q 80 -249 107 -265 Q 132 -281 164 -288 Q 197 -294 234 -294 L 382 -294 L 382 -310 Q 382 -362 352 -390 Q 322 -418 265 -418 Q 225 -418 188 -402 Q 152 -386 119 -350 L 58 -413 Q 102 -459 156 -480 Q 209 -502 272 -502 Q 371 -502 426 -452 Q 480 -401 480 -310 L 480 0 Z M 382 -220 L 248 -220 Q 228 -220 206 -216 Q 185 -213 170 -202 Q 158 -193 151 -180 Q 144 -166 144 -148 Q 144 -113 171 -92 Q 198 -71 243 -71 Q 281 -71 312 -88 Q 344 -106 363 -136 Q 382 -167 382 -206 Z M 237 -556 L 347 -697 L 452 -697 L 310 -556 Z" },
    ["è"] = { 540, "M 280 9 Q 220 9 176 -11 Q 132 -31 103 -66 Q 74 -102 60 -148 Q 45 -193 45 -243 Q 45 -293 59 -340 Q 73 -386 101 -422 Q 129 -459 172 -480 Q 214 -502 272 -502 Q 330 -502 372 -482 Q 414 -463 441 -428 Q 468 -394 482 -351 Q 495 -308 495 -260 Q 495 -255 494 -242 Q 494 -228 492 -216 L 143 -216 Q 146 -150 184 -114 Q 221 -79 283 -79 Q 325 -79 358 -92 Q 391 -106 419 -135 L 479 -73 Q 450 -44 420 -26 Q 389 -8 356 0 Q 322 9 280 9 Z M 401 -288 Q 401 -293 401 -297 Q 401 -320 393 -342 Q 385 -364 369 -382 Q 353 -399 330 -410 Q 306 -420 275 -420 Q 234 -420 205 -402 Q 176 -383 160 -353 Q 145 -323 142 -288 Z M 237 -556 L 102 -697 L 206 -697 L 310 -556 Z" },
    ["é"] = { 540, "M 280 9 Q 220 9 176 -11 Q 132 -31 103 -66 Q 74 -102 60 -148 Q 45 -193 45 -243 Q 45 -293 59 -340 Q 73 -386 101 -422 Q 129 -459 172 -480 Q 214 -502 272 -502 Q 330 -502 372 -482 Q 414 -463 441 -428 Q 468 -394 482 -351 Q 495 -308 495 -260 Q 495 -255 494 -242 Q 494 -228 492 -216 L 143 -216 Q 146 -150 184 -114 Q 221 -79 283 -79 Q 325 -79 358 -92 Q 391 -106 419 -135 L 479 -73 Q 450 -44 420 -26 Q 389 -8 356 0 Q 322 9 280 9 Z M 401 -288 Q 401 -293 401 -297 Q 401 -320 393 -342 Q 385 -364 369 -382 Q 353 -399 330 -410 Q 306 -420 275 -420 Q 234 -420 205 -402 Q 176 -383 160 -353 Q 145 -323 142 -288 Z M 236 -556 L 346 -697 L 451 -697 L 309 -556 Z" },
    ["í"] = { 232, "M 67 0 L 67 -493 L 165 -493 L 165 0 Z M 79 -556 L 189 -697 L 294 -697 L 152 -556 Z" },
    ["ï"] = { 232, "M 67 0 L 67 -493 L 165 -493 L 165 0 Z M 155 -578 L 155 -697 L 266 -697 L 266 -578 Z M -34 -578 L -34 -697 L 77 -697 L 77 -578 Z" },
    ["ñ"] = { 553, "M 68 0 L 68 -493 L 167 -493 L 167 -424 Q 175 -437 185 -448 Q 209 -474 242 -488 Q 276 -502 315 -502 Q 397 -502 444 -454 Q 490 -407 490 -316 L 490 0 L 392 0 L 392 -280 Q 392 -351 366 -384 Q 341 -417 288 -417 Q 248 -417 222 -399 Q 195 -381 181 -342 Q 167 -303 167 -243 L 167 0 Z M 335 -563 Q 305 -563 286 -574 Q 268 -586 256 -601 Q 243 -616 231 -628 Q 219 -639 202 -639 Q 185 -639 174 -620 Q 164 -602 164 -568 L 106 -568 Q 106 -631 133 -666 Q 160 -701 207 -701 Q 233 -701 251 -689 Q 269 -677 282 -662 Q 295 -647 308 -635 Q 320 -623 336 -623 Q 351 -623 362 -642 Q 373 -662 373 -697 L 433 -697 Q 433 -634 406 -598 Q 380 -563 335 -563 Z" },
    ["ó"] = { 575, "M 288 9 Q 218 9 163 -24 Q 108 -57 76 -115 Q 45 -173 45 -247 Q 45 -321 76 -378 Q 107 -436 162 -469 Q 218 -502 288 -502 Q 359 -502 413 -469 Q 467 -436 498 -378 Q 530 -321 530 -247 Q 530 -173 498 -116 Q 467 -58 412 -24 Q 358 9 288 9 Z M 288 -78 Q 332 -78 364 -99 Q 397 -120 414 -158 Q 432 -196 432 -247 Q 432 -299 414 -337 Q 397 -375 364 -396 Q 332 -416 288 -416 Q 243 -416 210 -395 Q 178 -374 160 -336 Q 143 -299 143 -247 Q 143 -196 160 -158 Q 178 -120 210 -99 Q 243 -78 288 -78 Z M 251 -556 L 361 -697 L 466 -697 L 324 -556 Z" },
    ["ø"] = { 575, "M 288 9 Q 224 9 173 -19 L 133 46 L 84 46 L 138 -42 Q 100 -71 77 -115 Q 45 -173 45 -247 Q 45 -321 76 -378 Q 107 -436 162 -469 Q 218 -502 288 -502 Q 352 -502 403 -475 L 442 -539 L 491 -539 L 438 -452 Q 475 -422 499 -379 Q 530 -321 530 -247 Q 530 -173 498 -116 Q 467 -58 412 -24 Q 358 9 288 9 Z M 186 -120 L 357 -400 Q 327 -416 288 -416 Q 243 -416 210 -395 Q 178 -374 160 -336 Q 143 -299 143 -247 Q 143 -196 161 -158 Q 171 -136 186 -120 Z M 288 -78 Q 332 -78 364 -99 Q 397 -120 414 -158 Q 432 -196 432 -247 Q 432 -299 415 -337 Q 405 -358 390 -374 L 219 -94 Q 249 -78 288 -78 Z" },
    ["ü"] = { 553, "M 237 9 Q 182 9 142 -14 Q 103 -36 82 -78 Q 62 -121 62 -182 L 62 -493 L 160 -493 L 160 -213 Q 160 -169 171 -138 Q 182 -108 206 -92 Q 229 -77 265 -77 Q 307 -77 334 -98 Q 360 -119 373 -160 Q 386 -202 386 -264 L 386 -493 L 483 -493 L 483 0 L 386 0 L 386 -64 Q 367 -36 339 -19 Q 294 9 237 9 Z M 311 -578 L 311 -697 L 422 -697 L 422 -578 Z M 122 -578 L 122 -697 L 233 -697 L 233 -578 Z" },
    ["ą"] = { 542, "M 390 0 L 384 -72 L 382 -70 Q 356 -31 318 -11 Q 279 9 231 9 Q 176 9 134 -11 Q 92 -31 69 -66 Q 46 -102 46 -149 Q 46 -190 63 -220 Q 80 -249 107 -265 Q 132 -281 164 -288 Q 197 -294 234 -294 L 382 -294 L 382 -310 Q 382 -362 352 -390 Q 322 -418 265 -418 Q 225 -418 188 -402 Q 152 -386 119 -350 L 58 -413 Q 102 -459 156 -480 Q 209 -502 272 -502 Q 371 -502 426 -452 Q 480 -401 480 -310 L 480 0 L 479 0 Q 466 7 448 18 Q 431 28 414 42 Q 397 56 386 73 Q 376 90 376 109 Q 376 128 388 138 Q 399 149 416 149 Q 432 149 450 140 Q 468 132 485 116 L 517 157 Q 496 180 470 192 Q 444 204 415 204 Q 375 204 346 182 Q 317 159 317 118 Q 317 88 330 65 Q 344 42 364 25 Q 382 10 398 0 Z M 382 -220 L 248 -220 Q 228 -220 206 -216 Q 185 -213 170 -202 Q 158 -193 151 -180 Q 144 -166 144 -148 Q 144 -113 171 -92 Q 198 -71 243 -71 Q 281 -71 312 -88 Q 344 -106 363 -136 Q 382 -167 382 -206 Z" },
    ["ł"] = { 256, "M 173 9 Q 126 9 96 -20 Q 66 -49 66 -112 L 66 -275 L 14 -235 L 14 -331 L 66 -371 L 66 -697 L 163 -697 L 163 -446 L 246 -510 L 246 -415 L 163 -351 L 163 -131 Q 163 -105 174 -94 Q 186 -82 205 -82 Q 213 -82 224 -84 Q 234 -85 245 -89 L 245 -6 Q 227 2 208 6 Q 188 9 173 9 Z" },
    ["ń"] = { 553, "M 68 0 L 68 -493 L 167 -493 L 167 -424 Q 175 -437 185 -448 Q 209 -474 242 -488 Q 276 -502 315 -502 Q 397 -502 444 -454 Q 490 -407 490 -316 L 490 0 L 392 0 L 392 -280 Q 392 -351 366 -384 Q 341 -417 288 -417 Q 248 -417 222 -399 Q 195 -381 181 -342 Q 167 -303 167 -243 L 167 0 Z M 233 -556 L 343 -697 L 448 -697 L 306 -556 Z" },
    ["ś"] = { 471, "M 234 9 Q 182 9 142 -6 Q 102 -22 74 -46 Q 45 -71 28 -97 L 95 -155 Q 114 -121 150 -96 Q 185 -72 235 -72 Q 279 -72 304 -90 Q 330 -109 330 -139 Q 330 -163 314 -178 Q 298 -192 272 -202 Q 246 -211 215 -218 Q 187 -226 158 -236 Q 129 -246 106 -262 Q 82 -277 68 -302 Q 53 -326 53 -362 Q 53 -425 102 -464 Q 150 -502 230 -502 Q 287 -502 334 -478 Q 381 -455 407 -409 L 346 -362 Q 326 -395 294 -410 Q 263 -425 226 -425 Q 191 -425 168 -410 Q 144 -396 144 -371 Q 144 -353 154 -342 Q 165 -330 188 -322 Q 210 -313 243 -305 Q 274 -298 306 -288 Q 338 -278 365 -262 Q 392 -246 409 -219 Q 426 -192 426 -149 Q 426 -102 402 -66 Q 378 -31 335 -11 Q 292 9 234 9 Z M 196 -556 L 306 -697 L 411 -697 L 269 -556 Z" },
    ["ź"] = { 472, "M 36 0 L 36 -68 L 316 -413 L 49 -413 L 49 -493 L 431 -493 L 431 -421 L 159 -80 L 430 -80 L 430 0 Z M 200 -556 L 310 -697 L 415 -697 L 273 -556 Z" },
    ["–"] = { 417, "M 24 -264 L 24 -337 L 393 -337 L 393 -264 Z" },
}
GLYPHS.S = {
    [" "] = { 260, "" },
    ["!"] = { 248, "M 82 -209 L 69 -697 L 180 -697 L 167 -209 Z M 63 0 L 63 -126 L 185 -126 L 185 0 Z" },
    ["\""] = { 357, "M 46 -411 L 46 -697 L 140 -697 L 140 -411 Z M 216 -411 L 216 -697 L 310 -697 L 310 -411 Z" },
    ["#"] = { 696, "M 119 0 L 164 -205 L 47 -205 L 47 -284 L 180 -284 L 209 -423 L 88 -423 L 88 -506 L 226 -506 L 270 -697 L 359 -697 L 315 -502 L 446 -502 L 488 -697 L 576 -697 L 532 -502 L 649 -502 L 649 -423 L 516 -423 L 485 -284 L 608 -284 L 608 -205 L 469 -205 L 424 0 L 337 0 L 382 -205 L 249 -205 L 207 0 Z M 269 -284 L 400 -284 L 428 -423 L 296 -423 Z" },
    ["$"] = { 560, "M 243 114 L 243 10 Q 166 0 113 -44 Q 43 -101 27 -196 L 140 -224 Q 151 -158 192 -124 Q 234 -90 295 -90 Q 329 -90 356 -102 Q 383 -115 398 -138 Q 414 -161 414 -190 Q 414 -221 397 -242 Q 380 -262 348 -278 Q 316 -295 270 -313 Q 207 -337 163 -365 Q 119 -393 96 -432 Q 73 -470 73 -523 Q 73 -578 100 -620 Q 127 -663 176 -687 Q 207 -702 243 -708 L 243 -808 L 324 -808 L 324 -709 Q 372 -703 411 -680 Q 464 -649 496 -586 L 404 -530 Q 383 -568 353 -588 Q 323 -609 285 -609 Q 258 -609 236 -598 Q 214 -588 202 -569 Q 189 -550 189 -525 Q 189 -499 204 -480 Q 219 -460 250 -444 Q 282 -428 331 -409 Q 394 -385 438 -357 Q 482 -329 506 -290 Q 529 -252 529 -197 Q 529 -136 499 -89 Q 469 -42 416 -15 Q 375 7 324 11 L 324 114 Z" },
    ["%"] = { 739, "M 105 0 L 549 -697 L 629 -697 L 185 0 Z M 544 9 Q 501 9 466 -11 Q 432 -31 412 -68 Q 391 -104 391 -153 Q 391 -201 411 -238 Q 431 -274 466 -294 Q 500 -314 542 -314 Q 585 -314 620 -292 Q 654 -271 674 -234 Q 695 -198 695 -153 Q 695 -108 675 -72 Q 655 -35 621 -13 Q 587 9 544 9 Z M 544 -66 Q 566 -66 583 -78 Q 600 -89 610 -108 Q 620 -128 620 -153 Q 620 -179 610 -198 Q 599 -217 582 -228 Q 564 -239 542 -239 Q 522 -239 504 -228 Q 487 -218 476 -199 Q 466 -180 466 -153 Q 466 -125 477 -106 Q 488 -86 506 -76 Q 524 -66 544 -66 Z M 198 -384 Q 156 -384 121 -404 Q 86 -424 66 -460 Q 45 -497 45 -544 Q 45 -594 66 -630 Q 86 -666 120 -686 Q 154 -706 196 -706 Q 239 -706 274 -684 Q 308 -663 328 -626 Q 348 -590 348 -544 Q 348 -501 328 -464 Q 309 -427 275 -406 Q 241 -384 198 -384 Z M 198 -459 Q 219 -459 236 -470 Q 253 -482 263 -501 Q 273 -520 273 -544 Q 273 -571 262 -590 Q 252 -610 234 -620 Q 217 -631 196 -631 Q 175 -631 158 -621 Q 141 -611 130 -592 Q 120 -573 120 -544 Q 120 -518 130 -498 Q 141 -479 159 -469 Q 177 -459 198 -459 Z" },
    ["&"] = { 696, "M 277 11 Q 212 11 160 -9 Q 108 -29 78 -68 Q 48 -108 48 -165 Q 48 -211 67 -246 Q 86 -281 116 -308 Q 146 -334 183 -356 Q 198 -365 213 -374 Q 197 -393 178 -416 Q 158 -440 144 -472 Q 131 -503 131 -540 Q 131 -592 157 -628 Q 183 -665 226 -685 Q 270 -705 322 -705 Q 403 -705 452 -664 Q 500 -622 500 -550 Q 500 -494 471 -452 Q 442 -411 398 -379 Q 383 -368 368 -358 L 488 -221 Q 522 -283 540 -369 L 638 -354 Q 618 -232 567 -151 Q 563 -145 560 -140 L 654 -33 L 575 36 L 490 -62 Q 467 -43 442 -30 Q 368 11 277 11 Z M 424 -138 L 281 -303 Q 257 -289 236 -275 Q 203 -253 182 -228 Q 162 -204 162 -170 Q 162 -130 194 -107 Q 225 -84 277 -84 Q 364 -84 424 -138 Z M 297 -424 Q 313 -434 327 -444 Q 359 -466 378 -492 Q 397 -517 397 -549 Q 397 -576 380 -596 Q 362 -617 323 -617 Q 286 -617 262 -596 Q 238 -575 238 -538 Q 238 -515 248 -493 Q 259 -471 275 -452 Q 287 -436 297 -424 Z" },
    ["'"] = { 186, "M 46 -411 L 46 -697 L 140 -697 L 140 -411 Z" },
    ["("] = { 259, "M 151 204 Q 122 163 99 110 Q 76 56 61 -4 Q 46 -63 38 -125 Q 31 -187 31 -245 Q 31 -329 44 -412 Q 58 -494 85 -568 Q 112 -641 152 -697 L 252 -697 Q 207 -637 178 -562 Q 148 -487 134 -406 Q 119 -326 119 -246 Q 119 -188 128 -126 Q 136 -65 153 -6 Q 170 54 195 108 Q 220 161 252 204 Z" },
    [")"] = { 259, "M 107 204 L 7 204 Q 40 161 64 108 Q 89 54 106 -6 Q 123 -65 132 -126 Q 140 -188 140 -246 Q 140 -326 126 -406 Q 111 -487 82 -562 Q 52 -637 7 -697 L 107 -697 Q 148 -641 174 -568 Q 201 -494 214 -412 Q 228 -329 228 -245 Q 228 -187 220 -125 Q 213 -63 198 -4 Q 182 56 160 110 Q 137 163 107 204 Z" },
    ["*"] = { 399, "M 132 -386 L 78 -427 L 167 -526 L 37 -554 L 57 -620 L 179 -565 L 165 -697 L 233 -697 L 220 -565 L 342 -620 L 362 -554 L 232 -526 L 321 -427 L 267 -386 L 199 -502 Z" },
    ["+"] = { 560, "M 236 -5 L 236 -204 L 38 -204 L 38 -291 L 236 -291 L 236 -489 L 324 -489 L 324 -291 L 523 -291 L 523 -204 L 324 -204 L 324 -5 Z" },
    [","] = { 240, "M 25 150 L 101 -153 L 225 -153 L 98 150 Z" },
    ["-"] = { 327, "M 40 -257 L 40 -339 L 288 -339 L 288 -257 Z" },
    ["."] = { 240, "M 59 0 L 59 -126 L 181 -126 L 181 0 Z" },
    ["/"] = { 420, "M -53 211 L 307 -697 L 392 -697 L 31 211 Z" },
    ["0"] = { 560, "M 281 9 Q 218 9 176 -14 Q 133 -36 106 -74 Q 80 -112 66 -159 Q 52 -206 48 -256 Q 43 -306 43 -352 Q 43 -396 48 -445 Q 52 -494 66 -540 Q 79 -587 105 -624 Q 131 -662 174 -684 Q 217 -707 279 -707 Q 341 -707 384 -685 Q 426 -663 452 -626 Q 479 -589 493 -543 Q 507 -497 512 -447 Q 517 -397 517 -351 Q 517 -303 512 -252 Q 507 -202 492 -156 Q 478 -109 452 -72 Q 426 -35 384 -13 Q 342 9 281 9 Z M 281 -98 Q 330 -98 356 -132 Q 383 -165 394 -222 Q 404 -279 404 -347 Q 404 -420 394 -477 Q 383 -534 356 -568 Q 329 -601 279 -601 Q 241 -601 217 -581 Q 193 -561 180 -526 Q 167 -490 162 -444 Q 156 -399 156 -348 Q 156 -299 162 -254 Q 167 -209 180 -174 Q 193 -139 218 -118 Q 242 -98 281 -98 Z" },
    ["1"] = { 560, "M 278 0 L 278 -499 L 98 -499 L 98 -588 L 210 -588 Q 244 -588 261 -602 Q 278 -616 278 -652 L 278 -697 L 389 -697 L 389 0 Z" },
    ["2"] = { 560, "M 43 0 L 43 -86 Q 76 -111 120 -143 Q 164 -175 210 -213 Q 255 -251 294 -294 Q 333 -338 358 -385 Q 382 -432 382 -482 Q 382 -532 355 -564 Q 328 -597 272 -597 Q 229 -597 202 -576 Q 175 -555 162 -520 Q 149 -486 148 -446 L 39 -455 Q 39 -503 54 -548 Q 70 -592 100 -628 Q 130 -663 174 -684 Q 218 -704 275 -704 Q 339 -704 388 -677 Q 436 -650 464 -601 Q 491 -552 491 -486 Q 491 -432 472 -382 Q 454 -332 420 -286 Q 387 -241 342 -200 Q 297 -160 244 -125 Q 227 -113 210 -103 L 519 -103 L 519 0 Z" },
    ["3"] = { 560, "M 275 9 Q 198 9 140 -20 Q 82 -48 50 -99 Q 18 -150 18 -218 L 129 -225 Q 129 -167 170 -132 Q 211 -98 278 -98 Q 323 -98 354 -112 Q 386 -125 402 -151 Q 419 -177 419 -212 Q 419 -243 406 -264 Q 393 -285 370 -298 Q 346 -310 312 -316 Q 279 -321 238 -321 L 238 -409 Q 267 -409 293 -414 Q 319 -419 338 -430 Q 358 -442 369 -460 Q 380 -479 380 -507 Q 380 -535 366 -556 Q 353 -577 330 -588 Q 306 -600 274 -600 Q 220 -600 190 -571 Q 160 -542 159 -495 L 50 -502 Q 50 -562 79 -608 Q 108 -654 160 -680 Q 211 -706 277 -706 Q 340 -706 388 -682 Q 436 -658 464 -616 Q 491 -574 491 -518 Q 491 -492 484 -470 Q 477 -448 464 -430 Q 450 -413 432 -400 Q 414 -387 393 -378 Q 422 -369 447 -355 Q 472 -341 490 -320 Q 509 -299 520 -272 Q 530 -245 530 -211 Q 530 -146 498 -96 Q 466 -47 408 -19 Q 351 9 275 9 Z" },
    ["4"] = { 560, "M 327 0 L 327 -165 L 11 -165 L 11 -251 L 339 -697 L 438 -697 L 438 -268 L 549 -268 L 549 -165 L 438 -165 L 438 0 Z M 127 -268 L 327 -268 L 327 -550 Z" },
    ["5"] = { 560, "M 277 9 Q 213 9 160 -18 Q 106 -46 72 -93 Q 37 -140 28 -199 L 137 -218 Q 141 -188 158 -160 Q 175 -131 205 -114 Q 235 -97 276 -97 Q 322 -97 352 -118 Q 382 -139 397 -172 Q 412 -206 412 -242 Q 412 -277 398 -307 Q 383 -337 354 -355 Q 325 -373 279 -373 Q 237 -373 206 -354 Q 175 -335 154 -305 L 49 -332 L 116 -697 L 498 -697 L 498 -594 L 207 -594 L 179 -443 Q 197 -456 217 -463 Q 258 -477 295 -477 Q 364 -477 417 -445 Q 470 -413 500 -359 Q 529 -305 529 -242 Q 529 -192 511 -147 Q 493 -102 459 -66 Q 425 -31 378 -11 Q 332 9 277 9 Z" },
    ["6"] = { 560, "M 391 -697 L 237 -457 Q 240 -458 243 -459 Q 263 -464 283 -464 Q 350 -464 404 -433 Q 457 -402 488 -349 Q 519 -296 519 -231 Q 519 -161 484 -107 Q 450 -53 394 -22 Q 337 9 268 9 Q 200 9 142 -22 Q 85 -53 51 -107 Q 17 -161 17 -230 Q 17 -264 28 -297 Q 38 -330 55 -360 L 264 -697 Z M 268 -366 Q 231 -366 200 -349 Q 168 -332 149 -302 Q 130 -271 130 -231 Q 130 -191 149 -160 Q 168 -130 199 -113 Q 230 -96 268 -96 Q 307 -96 338 -113 Q 369 -130 388 -160 Q 406 -191 406 -231 Q 406 -271 388 -302 Q 369 -332 338 -349 Q 307 -366 268 -366 Z" },
    ["7"] = { 560, "M 92 0 L 398 -594 L 28 -594 L 28 -697 L 530 -697 L 530 -615 L 216 0 Z" },
    ["8"] = { 560, "M 280 9 Q 214 9 156 -15 Q 98 -39 62 -86 Q 26 -134 26 -205 Q 26 -263 53 -308 Q 80 -353 133 -379 Q 100 -400 80 -434 Q 61 -467 61 -512 Q 61 -573 92 -616 Q 124 -660 174 -683 Q 224 -706 281 -706 Q 339 -706 389 -682 Q 439 -659 468 -615 Q 498 -571 498 -510 Q 498 -465 480 -432 Q 461 -400 427 -379 Q 480 -353 507 -308 Q 534 -263 534 -205 Q 534 -134 498 -86 Q 462 -39 404 -15 Q 347 9 280 9 Z M 280 -96 Q 320 -96 352 -110 Q 384 -123 403 -150 Q 422 -176 422 -216 Q 422 -253 404 -280 Q 386 -306 354 -320 Q 322 -335 280 -335 Q 238 -335 206 -320 Q 174 -306 156 -280 Q 137 -253 137 -216 Q 137 -176 156 -150 Q 176 -123 208 -110 Q 240 -96 280 -96 Z M 281 -410 Q 328 -410 358 -436 Q 388 -461 388 -503 Q 388 -547 359 -574 Q 330 -601 281 -601 Q 250 -601 226 -590 Q 201 -578 186 -556 Q 172 -535 172 -505 Q 172 -462 202 -436 Q 233 -410 281 -410 Z" },
    ["9"] = { 560, "M 156 0 L 310 -239 Q 307 -239 305 -238 Q 284 -233 264 -233 Q 197 -233 144 -264 Q 91 -295 60 -348 Q 29 -401 29 -466 Q 29 -536 63 -590 Q 97 -644 154 -675 Q 211 -706 279 -706 Q 348 -706 405 -675 Q 462 -644 496 -590 Q 531 -537 531 -467 Q 531 -433 520 -400 Q 510 -367 492 -337 L 284 0 Z M 279 -331 Q 317 -331 348 -348 Q 379 -365 398 -396 Q 417 -426 417 -466 Q 417 -507 398 -537 Q 380 -567 348 -584 Q 317 -601 279 -601 Q 241 -601 210 -584 Q 179 -567 160 -536 Q 141 -506 141 -466 Q 141 -426 160 -396 Q 178 -365 210 -348 Q 241 -331 279 -331 Z" },
    [":"] = { 240, "M 59 -343 L 59 -471 L 181 -471 L 181 -343 Z M 59 0 L 59 -126 L 181 -126 L 181 0 Z" },
    [";"] = { 240, "M 7 150 L 84 -130 L 208 -130 L 82 150 Z M 74 -343 L 74 -471 L 197 -471 L 197 -343 Z" },
    ["<"] = { 560, "M 527 8 L 27 -192 L 27 -302 L 527 -501 L 527 -407 L 114 -247 L 527 -86 Z" },
    ["="] = { 560, "M 76 -313 L 76 -401 L 485 -401 L 485 -313 Z M 76 -93 L 76 -180 L 485 -180 L 485 -93 Z" },
    [">"] = { 560, "M 33 8 L 33 -86 L 446 -247 L 33 -407 L 33 -501 L 533 -302 L 533 -192 Z" },
    ["?"] = { 515, "M 207 -207 L 207 -251 Q 207 -293 219 -322 Q 231 -350 250 -370 Q 269 -391 290 -407 Q 312 -423 331 -438 Q 350 -454 362 -474 Q 374 -494 374 -522 Q 374 -567 344 -590 Q 313 -614 259 -614 Q 198 -614 166 -582 Q 134 -551 134 -493 L 36 -493 Q 37 -561 66 -608 Q 94 -656 144 -681 Q 195 -706 260 -706 Q 319 -706 366 -687 Q 414 -668 442 -627 Q 471 -586 471 -520 Q 471 -477 458 -448 Q 446 -418 427 -398 Q 408 -377 386 -362 Q 365 -347 346 -331 Q 326 -315 314 -294 Q 301 -274 301 -243 L 301 -207 Z M 195 0 L 195 -126 L 317 -126 L 317 0 Z" },
    ["@"] = { 874, "M 438 110 Q 358 110 288 82 Q 218 53 166 2 Q 113 -49 84 -118 Q 54 -187 54 -267 Q 54 -352 82 -424 Q 111 -495 163 -548 Q 215 -600 286 -629 Q 356 -658 438 -658 Q 521 -658 591 -630 Q 661 -601 712 -550 Q 764 -500 792 -432 Q 821 -364 821 -284 Q 821 -220 804 -174 Q 788 -128 754 -103 Q 720 -78 668 -78 Q 630 -78 600 -92 Q 571 -106 555 -129 Q 550 -136 546 -143 Q 528 -116 500 -100 Q 457 -75 406 -75 Q 354 -75 313 -99 Q 272 -123 248 -166 Q 225 -210 225 -267 Q 225 -325 248 -368 Q 272 -412 313 -436 Q 354 -461 406 -461 Q 452 -461 487 -440 Q 512 -424 530 -397 L 541 -453 L 626 -453 L 626 -227 Q 626 -192 638 -177 Q 649 -162 676 -162 Q 710 -162 726 -192 Q 741 -223 741 -282 Q 741 -347 718 -400 Q 696 -454 656 -494 Q 615 -533 560 -554 Q 505 -576 438 -576 Q 373 -576 318 -554 Q 262 -531 222 -490 Q 181 -449 158 -392 Q 136 -336 136 -268 Q 136 -204 159 -150 Q 182 -96 224 -56 Q 265 -16 320 6 Q 375 29 438 29 Q 525 29 603 -19 L 641 53 Q 597 81 544 96 Q 492 110 438 110 Z M 428 -162 Q 457 -162 478 -175 Q 500 -188 512 -212 Q 525 -235 525 -267 Q 525 -299 512 -323 Q 500 -347 478 -360 Q 457 -374 428 -374 Q 400 -374 378 -360 Q 356 -347 344 -323 Q 331 -299 331 -267 Q 331 -236 344 -212 Q 356 -188 378 -175 Q 400 -162 428 -162 Z" },
    ["A"] = { 661, "M 11 0 L 287 -697 L 375 -697 L 650 0 L 524 0 L 471 -146 L 191 -146 L 138 0 Z M 433 -249 L 331 -528 L 229 -249 Z" },
    ["B"] = { 608, "M 71 0 L 71 -697 L 309 -697 Q 411 -697 470 -650 Q 528 -604 528 -522 Q 528 -472 507 -434 Q 486 -397 448 -375 Q 506 -356 535 -312 Q 564 -268 564 -202 Q 564 -107 504 -54 Q 445 0 338 0 Z M 187 -106 L 329 -106 Q 449 -106 449 -207 Q 449 -255 420 -282 Q 392 -308 341 -308 L 187 -308 Z M 187 -412 L 317 -412 Q 361 -412 387 -436 Q 413 -461 413 -504 Q 413 -545 386 -568 Q 358 -591 309 -591 L 187 -591 Z" },
    ["C"] = { 708, "M 372 14 Q 274 14 200 -31 Q 126 -76 84 -158 Q 43 -240 43 -349 Q 43 -458 84 -540 Q 126 -621 200 -666 Q 274 -711 372 -711 Q 481 -711 560 -657 Q 640 -603 675 -507 L 567 -468 Q 543 -531 493 -566 Q 443 -601 372 -601 Q 307 -601 259 -570 Q 211 -539 184 -483 Q 158 -427 158 -349 Q 158 -271 184 -214 Q 211 -158 259 -127 Q 307 -96 372 -96 Q 443 -96 493 -132 Q 543 -167 567 -229 L 675 -190 Q 640 -96 560 -41 Q 481 14 372 14 Z" },
    ["D"] = { 676, "M 71 0 L 71 -697 L 271 -697 Q 443 -697 538 -604 Q 633 -512 633 -343 Q 633 -177 540 -88 Q 446 0 270 0 Z M 187 -106 L 259 -106 Q 340 -106 398 -128 Q 456 -151 486 -204 Q 516 -257 516 -347 Q 516 -437 486 -490 Q 457 -544 402 -568 Q 346 -591 269 -591 L 187 -591 Z" },
    ["E"] = { 580, "M 71 0 L 71 -697 L 534 -697 L 534 -594 L 187 -594 L 187 -409 L 507 -409 L 507 -305 L 187 -305 L 187 -103 L 534 -103 L 534 0 Z" },
    ["F"] = { 560, "M 71 0 L 71 -697 L 534 -697 L 534 -594 L 187 -594 L 187 -409 L 488 -409 L 488 -305 L 187 -305 L 187 0 Z" },
    ["G"] = { 734, "M 365 14 Q 271 14 198 -31 Q 125 -76 84 -158 Q 43 -240 43 -349 Q 43 -458 84 -540 Q 126 -621 200 -666 Q 274 -711 372 -711 Q 481 -711 560 -657 Q 640 -603 675 -507 L 567 -468 Q 543 -531 493 -566 Q 443 -601 372 -601 Q 307 -601 259 -570 Q 211 -539 184 -483 Q 158 -427 158 -349 Q 158 -271 184 -214 Q 211 -158 259 -127 Q 307 -96 372 -96 Q 406 -96 441 -106 Q 476 -115 506 -138 Q 536 -161 555 -203 Q 567 -232 571 -271 L 400 -271 L 400 -374 L 675 -374 L 675 0 L 573 0 L 563 -79 Q 547 -56 527 -39 Q 495 -12 454 1 Q 412 14 365 14 Z" },
    ["H"] = { 688, "M 71 0 L 71 -697 L 187 -697 L 187 -412 L 501 -412 L 501 -697 L 617 -697 L 617 0 L 501 0 L 501 -305 L 187 -305 L 187 0 Z" },
    ["I"] = { 258, "M 71 0 L 71 -697 L 187 -697 L 187 0 Z" },
    ["J"] = { 554, "M 258 14 Q 157 14 94 -47 Q 31 -108 23 -215 L 137 -228 Q 142 -157 172 -125 Q 203 -93 258 -93 Q 321 -93 348 -134 Q 374 -175 374 -250 L 374 -594 L 108 -594 L 108 -697 L 490 -697 L 490 -243 Q 490 -164 462 -106 Q 434 -48 382 -17 Q 330 14 258 14 Z" },
    ["K"] = { 653, "M 71 0 L 71 -697 L 187 -697 L 187 -385 L 483 -697 L 638 -697 L 372 -426 L 640 0 L 504 0 L 288 -341 L 187 -238 L 187 0 Z" },
    ["L"] = { 501, "M 71 0 L 71 -697 L 187 -697 L 187 -103 L 488 -103 L 488 0 Z" },
    ["M"] = { 851, "M 71 0 L 71 -697 L 241 -697 L 426 -204 L 611 -697 L 780 -697 L 780 0 L 664 0 L 664 -534 L 482 -61 L 369 -61 L 187 -532 L 187 0 Z" },
    ["N"] = { 685, "M 71 0 L 71 -697 L 191 -697 L 498 -198 L 498 -697 L 614 -697 L 614 0 L 492 0 L 187 -501 L 187 0 Z" },
    ["O"] = { 748, "M 372 14 Q 274 14 200 -31 Q 126 -76 84 -158 Q 43 -240 43 -348 Q 43 -457 84 -539 Q 126 -621 200 -666 Q 274 -711 372 -711 Q 472 -711 546 -666 Q 621 -621 662 -540 Q 704 -458 704 -348 Q 704 -239 662 -158 Q 620 -76 546 -31 Q 471 14 372 14 Z M 372 -96 Q 439 -96 487 -127 Q 535 -158 562 -214 Q 588 -271 588 -348 Q 588 -426 562 -482 Q 535 -539 487 -570 Q 439 -601 372 -601 Q 307 -601 259 -570 Q 211 -540 184 -484 Q 158 -427 158 -348 Q 158 -270 184 -214 Q 210 -157 258 -126 Q 307 -96 372 -96 Z" },
    ["P"] = { 559, "M 71 0 L 71 -697 L 294 -697 Q 410 -697 470 -647 Q 530 -597 530 -497 Q 530 -397 470 -344 Q 409 -292 294 -292 L 186 -292 L 186 0 Z M 186 -395 L 282 -395 Q 344 -395 379 -418 Q 414 -441 414 -495 Q 414 -548 380 -571 Q 347 -594 282 -594 L 186 -594 Z" },
    ["Q"] = { 782, "M 372 14 Q 275 14 200 -31 Q 126 -76 84 -158 Q 43 -239 43 -348 Q 43 -458 84 -540 Q 126 -621 200 -666 Q 274 -711 372 -711 Q 472 -711 546 -666 Q 621 -621 662 -540 Q 704 -458 704 -348 Q 704 -239 662 -158 Q 650 -135 636 -115 L 738 -15 L 669 52 L 568 -46 Q 557 -38 546 -31 Q 471 14 372 14 Z M 372 -96 Q 438 -96 485 -126 L 389 -219 L 456 -291 L 552 -197 Q 557 -205 562 -215 Q 588 -271 588 -348 Q 588 -426 562 -482 Q 535 -539 487 -570 Q 439 -601 372 -601 Q 307 -601 259 -570 Q 211 -540 184 -484 Q 158 -427 158 -348 Q 158 -270 184 -214 Q 210 -157 258 -126 Q 307 -96 372 -96 Z" },
    ["R"] = { 607, "M 71 0 L 71 -697 L 294 -697 Q 377 -697 429 -672 Q 481 -648 506 -603 Q 530 -558 530 -497 Q 530 -404 477 -353 Q 446 -324 402 -308 L 587 0 L 453 0 L 284 -293 L 187 -293 L 187 0 Z M 187 -395 L 282 -395 Q 320 -395 350 -404 Q 379 -413 396 -435 Q 414 -457 414 -496 Q 414 -535 396 -556 Q 379 -577 349 -586 Q 319 -594 282 -594 L 187 -594 Z" },
    ["S"] = { 572, "M 296 13 Q 186 13 116 -44 Q 47 -101 31 -196 L 144 -224 Q 155 -158 196 -124 Q 238 -90 299 -90 Q 333 -90 360 -102 Q 387 -115 402 -138 Q 418 -161 418 -190 Q 418 -221 401 -242 Q 384 -262 352 -278 Q 320 -295 274 -313 Q 211 -337 167 -365 Q 123 -393 100 -432 Q 77 -470 77 -523 Q 77 -578 104 -620 Q 131 -663 180 -687 Q 229 -711 293 -711 Q 362 -711 415 -680 Q 468 -649 500 -586 L 408 -530 Q 387 -568 357 -588 Q 327 -609 289 -609 Q 262 -609 240 -598 Q 218 -588 206 -569 Q 193 -550 193 -525 Q 193 -499 208 -480 Q 223 -460 254 -444 Q 286 -428 335 -409 Q 398 -385 442 -357 Q 486 -329 510 -290 Q 533 -252 533 -197 Q 533 -136 503 -89 Q 473 -42 420 -14 Q 366 13 296 13 Z" },
    ["T"] = { 585, "M 234 0 L 234 -594 L 12 -594 L 12 -697 L 572 -697 L 572 -594 L 351 -594 L 351 0 Z" },
    ["U"] = { 657, "M 328 14 Q 199 14 132 -53 Q 64 -120 64 -252 L 64 -697 L 180 -697 L 180 -265 Q 180 -208 194 -170 Q 207 -131 240 -112 Q 272 -92 328 -92 Q 384 -92 416 -112 Q 449 -132 463 -170 Q 477 -208 477 -265 L 477 -697 L 592 -697 L 592 -257 Q 592 -122 525 -54 Q 458 14 328 14 Z" },
    ["V"] = { 666, "M 291 0 L 11 -697 L 139 -697 L 334 -187 L 527 -697 L 655 -697 L 377 0 Z" },
    ["W"] = { 972, "M 224 0 L 17 -697 L 137 -697 L 288 -177 L 429 -657 L 543 -657 L 685 -177 L 834 -697 L 955 -697 L 748 0 L 635 0 L 486 -489 L 337 0 Z" },
    ["X"] = { 660, "M 16 0 L 250 -348 L 18 -697 L 156 -697 L 331 -429 L 505 -697 L 643 -697 L 410 -348 L 645 0 L 507 0 L 330 -265 L 154 0 Z" },
    ["Y"] = { 617, "M 252 0 L 252 -271 L 6 -697 L 138 -697 L 307 -387 L 479 -697 L 610 -697 L 368 -271 L 368 0 Z" },
    ["Z"] = { 598, "M 29 0 L 29 -96 L 410 -594 L 53 -594 L 53 -697 L 555 -697 L 555 -601 L 172 -103 L 567 -103 L 567 0 Z" },
    ["["] = { 286, "M 64 248 L 64 -741 L 273 -741 L 273 -667 L 155 -667 L 155 174 L 273 174 L 273 248 Z" },
    ["\\"] = { 460, "M 513 211 L 429 211 L 69 -697 L 153 -697 Z" },
    ["]"] = { 286, "M 222 248 L 13 248 L 13 174 L 131 174 L 131 -667 L 13 -667 L 13 -741 L 222 -741 Z" },
    ["^"] = { 602, "M 30 -210 L 231 -697 L 371 -697 L 572 -210 L 454 -210 L 301 -602 L 148 -210 Z" },
    ["_"] = { 463, "M 24 85 L 24 0 L 439 0 L 439 85 Z" },
    ["`"] = { 306, "M 181 -555 L 42 -697 L 160 -697 L 264 -555 Z" },
    ["a"] = { 544, "M 383 0 L 376 -69 Q 374 -65 371 -62 Q 345 -26 309 -8 Q 273 9 230 9 Q 175 9 132 -11 Q 90 -31 66 -67 Q 43 -103 43 -151 Q 43 -192 60 -222 Q 78 -252 106 -269 Q 130 -284 162 -290 Q 194 -297 229 -297 L 375 -297 L 375 -311 Q 375 -359 346 -384 Q 317 -408 265 -408 Q 225 -408 186 -392 Q 148 -377 116 -345 L 54 -418 Q 102 -463 156 -482 Q 210 -502 274 -502 Q 374 -502 430 -452 Q 485 -401 485 -311 L 485 0 Z M 375 -214 L 245 -214 Q 227 -214 209 -210 Q 191 -207 177 -198 Q 167 -190 160 -178 Q 154 -166 154 -150 Q 154 -118 178 -100 Q 203 -81 244 -81 Q 280 -81 310 -97 Q 339 -113 357 -141 Q 375 -169 375 -204 Z" },
    ["b"] = { 579, "M 322 9 Q 282 9 246 -7 Q 211 -23 185 -57 Q 180 -63 175 -71 L 175 0 L 65 0 L 65 -697 L 175 -697 L 175 -420 Q 179 -428 185 -435 Q 209 -467 244 -484 Q 280 -502 322 -502 Q 382 -502 430 -472 Q 479 -441 508 -384 Q 537 -327 537 -247 Q 537 -174 510 -116 Q 484 -58 436 -24 Q 388 9 322 9 Z M 295 -93 Q 334 -93 364 -112 Q 393 -131 409 -166 Q 425 -201 425 -247 Q 425 -293 409 -328 Q 393 -363 364 -382 Q 334 -401 295 -401 Q 256 -401 226 -382 Q 197 -362 181 -328 Q 165 -293 165 -247 Q 165 -201 181 -166 Q 197 -131 226 -112 Q 256 -93 295 -93 Z" },
    ["c"] = { 521, "M 278 9 Q 220 9 176 -12 Q 131 -32 102 -68 Q 72 -105 57 -151 Q 42 -197 42 -247 Q 42 -297 57 -343 Q 72 -389 102 -425 Q 131 -461 176 -482 Q 220 -502 278 -502 Q 351 -502 406 -467 Q 460 -432 486 -359 L 388 -321 Q 376 -359 349 -382 Q 322 -406 278 -406 Q 234 -406 206 -383 Q 179 -360 166 -324 Q 153 -288 153 -247 Q 153 -206 166 -170 Q 179 -133 206 -110 Q 234 -88 278 -88 Q 322 -88 349 -111 Q 376 -134 388 -172 L 486 -134 Q 460 -62 406 -26 Q 351 9 278 9 Z" },
    ["d"] = { 579, "M 257 9 Q 191 9 142 -24 Q 94 -58 68 -116 Q 42 -174 42 -247 Q 42 -327 70 -384 Q 99 -441 148 -472 Q 197 -502 257 -502 Q 299 -502 334 -485 Q 370 -468 395 -436 Q 399 -430 403 -423 L 403 -697 L 514 -697 L 514 0 L 403 0 L 403 -70 Q 398 -63 394 -57 Q 367 -23 332 -7 Q 297 9 257 9 Z M 284 -93 Q 323 -93 352 -112 Q 381 -131 397 -166 Q 413 -201 413 -247 Q 413 -293 397 -328 Q 381 -362 352 -382 Q 323 -401 284 -401 Q 245 -401 216 -382 Q 186 -363 170 -328 Q 153 -293 153 -247 Q 153 -201 170 -166 Q 186 -131 216 -112 Q 245 -93 284 -93 Z" },
    ["e"] = { 541, "M 281 9 Q 219 9 174 -11 Q 128 -31 99 -67 Q 70 -103 56 -148 Q 42 -194 42 -243 Q 42 -292 56 -338 Q 69 -385 97 -422 Q 125 -459 169 -480 Q 213 -502 273 -502 Q 330 -502 372 -482 Q 415 -463 443 -428 Q 471 -394 484 -350 Q 498 -306 498 -256 Q 498 -249 498 -236 Q 497 -223 495 -210 L 153 -210 Q 157 -151 193 -120 Q 229 -89 285 -89 Q 326 -89 360 -102 Q 394 -115 422 -143 L 483 -69 Q 452 -41 421 -24 Q 390 -7 356 1 Q 323 9 281 9 Z M 392 -292 Q 392 -295 392 -298 Q 392 -320 384 -340 Q 377 -360 362 -376 Q 347 -391 325 -400 Q 303 -410 275 -410 Q 236 -410 210 -393 Q 183 -376 168 -350 Q 154 -323 151 -292 Z" },
    ["f"] = { 344, "M 104 0 L 104 -407 L 10 -407 L 10 -493 L 105 -493 L 105 -549 Q 105 -610 125 -644 Q 145 -679 178 -692 Q 212 -706 253 -706 Q 282 -706 304 -700 Q 327 -695 347 -685 L 311 -601 Q 301 -607 290 -610 Q 278 -614 265 -614 Q 238 -614 226 -596 Q 215 -579 215 -549 L 215 -493 L 323 -493 L 323 -407 L 215 -407 L 215 0 Z" },
    ["g"] = { 520, "M 270 214 Q 161 214 98 174 Q 35 135 35 67 Q 35 61 36 53 Q 36 45 38 37 L 113 -12 Q 93 -22 77 -37 Q 48 -63 48 -106 Q 48 -144 74 -176 Q 86 -190 102 -203 Q 91 -215 82 -230 Q 56 -270 56 -321 Q 56 -376 83 -416 Q 110 -457 156 -480 Q 201 -502 255 -502 Q 309 -502 354 -480 Q 363 -475 371 -470 L 452 -535 L 509 -466 L 434 -403 Q 454 -366 454 -317 Q 454 -265 430 -226 Q 405 -186 361 -164 Q 317 -143 259 -143 Q 203 -143 159 -163 Q 158 -163 158 -163 Q 144 -148 144 -128 Q 144 -111 157 -100 Q 170 -90 194 -84 Q 219 -79 253 -74 Q 304 -68 347 -60 Q 390 -52 422 -38 Q 454 -23 472 2 Q 489 27 489 67 Q 489 138 432 176 Q 374 214 270 214 Z M 257 -232 Q 300 -232 322 -258 Q 344 -285 344 -322 Q 344 -362 320 -386 Q 296 -411 257 -411 Q 216 -411 192 -386 Q 167 -362 167 -323 Q 167 -285 190 -258 Q 213 -232 257 -232 Z M 177 10 L 137 60 Q 136 63 136 65 L 136 71 Q 136 102 174 118 Q 211 135 270 135 Q 320 135 350 122 Q 380 108 380 81 Q 380 66 371 56 Q 362 47 344 41 Q 326 35 300 30 Q 273 26 237 22 Q 207 17 177 10 Z" },
    ["h"] = { 559, "M 65 0 L 65 -697 L 176 -697 L 176 -425 Q 184 -438 195 -449 Q 220 -476 253 -489 Q 286 -502 323 -502 Q 406 -502 452 -454 Q 499 -407 499 -319 L 499 0 L 388 0 L 388 -278 Q 388 -344 364 -375 Q 340 -406 290 -406 Q 234 -406 205 -366 Q 176 -326 176 -240 L 176 0 Z" },
    ["i"] = { 239, "M 64 0 L 64 -493 L 175 -493 L 175 0 Z M 59 -574 L 59 -697 L 180 -697 L 180 -574 Z" },
    ["j"] = { 239, "M 60 213 Q 41 213 18 209 Q -4 205 -25 199 L -25 103 Q -11 106 0 108 Q 12 110 19 110 Q 41 110 52 100 Q 64 89 64 58 L 64 -493 L 175 -493 L 175 88 Q 175 153 143 183 Q 111 213 60 213 Z M 59 -574 L 59 -697 L 180 -697 L 180 -574 Z" },
    ["k"] = { 550, "M 399 0 L 250 -235 L 176 -153 L 176 0 L 65 0 L 65 -697 L 176 -697 L 176 -293 L 367 -493 L 509 -493 L 331 -309 L 531 0 Z" },
    ["l"] = { 273, "M 174 9 Q 126 9 94 -20 Q 62 -50 62 -115 L 62 -697 L 173 -697 L 173 -137 Q 173 -114 184 -104 Q 194 -93 211 -93 Q 220 -93 230 -95 Q 239 -97 249 -100 L 249 -6 Q 230 2 210 6 Q 190 9 174 9 Z" },
    ["m"] = { 838, "M 65 0 L 65 -493 L 176 -493 L 176 -420 Q 177 -422 178 -423 Q 194 -452 216 -470 Q 238 -487 264 -494 Q 289 -502 315 -502 Q 355 -502 390 -486 Q 425 -471 450 -437 Q 454 -431 458 -424 Q 459 -426 460 -428 Q 487 -466 524 -484 Q 560 -502 603 -502 Q 666 -502 704 -474 Q 743 -447 761 -402 Q 779 -358 779 -307 L 779 0 L 668 0 L 668 -280 Q 668 -321 658 -349 Q 649 -377 629 -392 Q 609 -406 578 -406 Q 545 -406 523 -390 Q 501 -373 490 -339 Q 478 -305 478 -255 L 478 0 L 367 0 L 367 -285 Q 367 -346 344 -376 Q 321 -406 279 -406 Q 246 -406 223 -389 Q 200 -372 188 -338 Q 176 -305 176 -255 L 176 0 Z" },
    ["n"] = { 559, "M 65 0 L 65 -493 L 176 -493 L 176 -425 Q 184 -438 194 -449 Q 219 -476 252 -489 Q 286 -502 323 -502 Q 406 -502 452 -454 Q 499 -407 499 -319 L 499 0 L 388 0 L 388 -278 Q 388 -344 364 -375 Q 340 -406 290 -406 Q 253 -406 228 -388 Q 202 -371 189 -334 Q 176 -297 176 -240 L 176 0 Z" },
    ["o"] = { 574, "M 287 9 Q 217 9 161 -24 Q 105 -57 74 -115 Q 42 -173 42 -247 Q 42 -321 74 -379 Q 105 -437 160 -470 Q 216 -502 287 -502 Q 359 -502 414 -470 Q 468 -437 500 -379 Q 532 -321 532 -247 Q 532 -173 500 -115 Q 469 -57 414 -24 Q 358 9 287 9 Z M 288 -89 Q 329 -89 359 -108 Q 389 -127 405 -163 Q 421 -199 421 -247 Q 421 -296 405 -332 Q 389 -367 359 -386 Q 329 -405 288 -405 Q 245 -405 215 -386 Q 185 -366 169 -331 Q 153 -296 153 -247 Q 153 -199 169 -163 Q 185 -127 215 -108 Q 245 -89 288 -89 Z" },
    ["p"] = { 579, "M 65 204 L 65 -493 L 175 -493 L 175 -426 Q 180 -434 186 -441 Q 211 -473 246 -488 Q 282 -502 322 -502 Q 388 -502 436 -468 Q 484 -435 510 -377 Q 537 -319 537 -246 Q 537 -167 508 -110 Q 479 -52 430 -22 Q 382 9 322 9 Q 280 9 244 -7 Q 209 -23 185 -55 Q 179 -62 175 -69 L 175 204 Z M 295 -92 Q 334 -92 364 -111 Q 393 -130 409 -165 Q 425 -200 425 -246 Q 425 -292 409 -327 Q 393 -362 364 -381 Q 334 -400 295 -400 Q 256 -400 226 -381 Q 197 -362 181 -327 Q 165 -292 165 -246 Q 165 -200 181 -166 Q 197 -131 226 -112 Q 256 -92 295 -92 Z" },
    ["q"] = { 579, "M 403 204 L 403 -67 Q 399 -61 395 -55 Q 370 -23 334 -7 Q 299 9 257 9 Q 197 9 148 -22 Q 99 -52 70 -110 Q 42 -167 42 -246 Q 42 -319 68 -377 Q 94 -435 142 -468 Q 191 -502 257 -502 Q 297 -502 332 -488 Q 367 -473 393 -441 Q 398 -435 403 -427 L 403 -493 L 514 -493 L 514 204 Z M 284 -92 Q 323 -92 352 -112 Q 381 -131 397 -166 Q 413 -200 413 -246 Q 413 -292 397 -327 Q 381 -362 352 -381 Q 323 -400 284 -400 Q 245 -400 216 -381 Q 186 -362 170 -327 Q 153 -292 153 -246 Q 153 -200 170 -165 Q 186 -130 216 -111 Q 245 -92 284 -92 Z" },
    ["r"] = { 420, "M 65 0 L 65 -493 L 177 -493 L 177 -421 Q 181 -427 185 -433 Q 209 -465 244 -484 Q 278 -502 312 -502 Q 336 -502 358 -496 Q 380 -490 404 -476 L 350 -376 Q 339 -383 322 -388 Q 304 -392 288 -392 Q 267 -392 246 -384 Q 226 -376 210 -360 Q 194 -343 186 -317 Q 181 -303 178 -280 Q 176 -258 176 -218 L 176 0 Z" },
    ["s"] = { 471, "M 233 9 Q 180 9 139 -6 Q 98 -22 70 -46 Q 42 -70 24 -94 L 100 -160 Q 119 -129 152 -105 Q 186 -81 234 -81 Q 274 -81 298 -98 Q 321 -115 321 -140 Q 321 -162 306 -174 Q 291 -187 267 -196 Q 243 -205 214 -212 Q 186 -219 157 -230 Q 128 -240 104 -256 Q 79 -272 64 -297 Q 49 -322 49 -359 Q 49 -424 99 -463 Q 149 -502 230 -502 Q 288 -502 336 -479 Q 384 -456 411 -410 L 342 -357 Q 322 -387 292 -402 Q 262 -417 227 -417 Q 195 -417 174 -404 Q 152 -391 152 -370 Q 152 -354 162 -344 Q 172 -334 193 -326 Q 214 -318 246 -310 Q 276 -303 308 -293 Q 340 -283 368 -266 Q 395 -250 412 -222 Q 430 -195 430 -152 Q 430 -104 406 -68 Q 381 -31 336 -11 Q 292 9 233 9 Z" },
    ["t"] = { 360, "M 244 9 Q 207 9 174 -6 Q 142 -20 123 -52 Q 104 -85 104 -138 L 104 -407 L 10 -407 L 10 -493 L 104 -493 L 104 -613 L 216 -675 L 216 -493 L 326 -493 L 326 -407 L 216 -407 L 216 -169 Q 216 -127 228 -104 Q 241 -82 274 -82 Q 284 -82 298 -84 Q 311 -87 326 -91 L 326 -5 Q 306 2 286 6 Q 265 9 244 9 Z" },
    ["u"] = { 559, "M 236 9 Q 178 9 138 -14 Q 99 -37 79 -80 Q 59 -123 59 -184 L 59 -493 L 170 -493 L 170 -214 Q 170 -175 180 -146 Q 189 -118 210 -103 Q 232 -88 269 -88 Q 312 -88 336 -110 Q 361 -133 372 -176 Q 382 -220 382 -281 L 382 -493 L 493 -493 L 493 0 L 382 0 L 382 -63 Q 362 -34 335 -17 Q 291 9 236 9 Z" },
    ["v"] = { 530, "M 219 0 L 18 -493 L 140 -493 L 265 -144 L 392 -493 L 512 -493 L 311 0 Z" },
    ["w"] = { 752, "M 172 0 L 22 -493 L 140 -493 L 228 -170 L 328 -493 L 423 -493 L 523 -172 L 612 -493 L 730 -493 L 579 0 L 479 0 L 376 -336 L 273 0 Z" },
    ["x"] = { 534, "M 22 0 L 193 -248 L 22 -493 L 155 -493 L 267 -322 L 381 -493 L 512 -493 L 340 -248 L 512 0 L 379 0 L 267 -174 L 153 0 Z" },
    ["y"] = { 530, "M 108 203 L 206 -33 L 18 -493 L 140 -493 L 265 -144 L 392 -493 L 512 -493 L 228 203 Z" },
    ["z"] = { 471, "M 35 0 L 35 -75 L 299 -402 L 47 -402 L 47 -493 L 432 -493 L 432 -413 L 178 -92 L 431 -92 L 431 0 Z" },
    ["{"] = { 268, "M 183 248 Q 130 248 102 212 Q 73 176 73 112 L 73 -127 Q 73 -156 64 -174 Q 54 -191 40 -200 Q 25 -208 9 -209 L 9 -285 Q 25 -287 40 -295 Q 54 -303 64 -320 Q 73 -338 73 -366 L 73 -605 Q 73 -669 102 -705 Q 130 -741 183 -741 L 256 -741 L 256 -670 L 220 -670 Q 189 -670 178 -650 Q 168 -630 168 -603 L 168 -364 Q 168 -315 150 -290 Q 131 -265 99 -250 L 99 -243 Q 131 -229 150 -204 Q 168 -178 168 -129 L 168 110 Q 168 137 178 157 Q 189 177 220 177 L 256 177 L 256 248 Z" },
    ["|"] = { 267, "M 92 254 L 92 -746 L 175 -746 L 175 254 Z" },
    ["}"] = { 268, "M 85 248 L 12 248 L 12 177 L 48 177 Q 79 177 90 157 Q 101 137 101 110 L 101 -129 Q 101 -178 119 -204 Q 137 -229 169 -243 L 169 -250 Q 137 -265 119 -290 Q 101 -315 101 -364 L 101 -603 Q 101 -630 90 -650 Q 79 -670 48 -670 L 12 -670 L 12 -741 L 85 -741 Q 138 -741 167 -705 Q 196 -669 196 -605 L 196 -366 Q 196 -338 205 -320 Q 214 -303 229 -295 Q 244 -287 259 -285 L 259 -209 Q 244 -208 229 -200 Q 214 -191 205 -174 Q 196 -156 196 -127 L 196 112 Q 196 176 167 212 Q 138 248 85 248 Z" },
    ["~"] = { 560, "M 367 -151 Q 332 -151 310 -162 Q 288 -173 274 -190 Q 260 -207 249 -224 Q 238 -241 225 -252 Q 212 -264 191 -264 Q 170 -264 158 -240 Q 147 -216 147 -179 L 58 -179 Q 58 -252 94 -298 Q 131 -343 191 -343 Q 228 -343 251 -332 Q 274 -320 288 -303 Q 303 -286 314 -269 Q 325 -252 337 -240 Q 349 -229 367 -229 Q 389 -229 402 -257 Q 416 -285 416 -326 L 503 -326 Q 503 -249 466 -200 Q 430 -151 367 -151 Z" },
    ["·"] = { 316, "M 96 -286 L 96 -412 L 212 -412 L 212 -286 Z" },
    ["–"] = { 422, "M 24 -257 L 24 -339 L 398 -339 L 398 -257 Z" },
}
GLYPHS.B = {
    [" "] = { 260, "" },
    ["+"] = { 560, "M 231 -4 L 231 -198 L 36 -198 L 36 -296 L 231 -296 L 231 -491 L 330 -491 L 330 -296 L 524 -296 L 524 -198 L 330 -198 L 330 -4 Z" },
    ["."] = { 240, "M 54 0 L 54 -132 L 186 -132 L 186 0 Z" },
    ["0"] = { 560, "M 281 9 Q 216 9 172 -14 Q 128 -37 101 -76 Q 74 -114 60 -161 Q 47 -208 42 -258 Q 37 -308 37 -352 Q 37 -395 42 -444 Q 46 -492 60 -539 Q 73 -586 100 -624 Q 127 -662 170 -685 Q 214 -708 280 -708 Q 345 -708 388 -686 Q 432 -663 459 -625 Q 486 -587 500 -540 Q 513 -493 518 -444 Q 523 -396 523 -352 Q 523 -306 518 -256 Q 513 -206 499 -159 Q 485 -112 458 -74 Q 431 -36 388 -14 Q 345 9 281 9 Z M 281 -110 Q 328 -110 353 -142 Q 378 -175 387 -229 Q 396 -283 396 -348 Q 396 -415 386 -470 Q 377 -524 352 -556 Q 327 -588 280 -588 Q 243 -588 220 -569 Q 197 -550 186 -517 Q 174 -484 170 -440 Q 165 -397 165 -348 Q 165 -301 170 -258 Q 174 -215 186 -182 Q 198 -149 221 -130 Q 244 -110 281 -110 Z" },
    ["1"] = { 560, "M 271 0 L 271 -490 L 93 -490 L 93 -588 L 201 -588 Q 235 -588 253 -604 Q 271 -619 271 -657 L 271 -697 L 396 -697 L 396 0 Z" },
    ["2"] = { 560, "M 41 0 L 41 -94 Q 73 -118 116 -149 Q 159 -180 204 -217 Q 248 -254 286 -296 Q 324 -338 348 -384 Q 371 -430 371 -478 Q 371 -523 347 -554 Q 323 -584 272 -584 Q 230 -584 206 -563 Q 181 -542 170 -510 Q 159 -477 157 -442 L 35 -451 Q 35 -498 50 -543 Q 66 -588 96 -624 Q 127 -661 172 -683 Q 217 -705 276 -705 Q 340 -705 390 -677 Q 439 -649 467 -599 Q 495 -549 495 -482 Q 495 -430 478 -381 Q 460 -332 428 -287 Q 396 -242 352 -202 Q 308 -162 254 -128 Q 245 -122 236 -116 L 522 -116 L 522 0 Z" },
    ["3"] = { 560, "M 274 9 Q 196 9 138 -20 Q 80 -48 48 -100 Q 15 -152 15 -221 L 138 -228 Q 138 -174 176 -142 Q 215 -110 279 -110 Q 320 -110 349 -122 Q 378 -135 394 -158 Q 410 -182 410 -214 Q 410 -242 398 -262 Q 387 -281 364 -293 Q 342 -305 310 -310 Q 279 -316 239 -316 L 239 -413 Q 268 -413 292 -418 Q 316 -423 334 -434 Q 351 -444 360 -462 Q 369 -479 369 -503 Q 369 -530 358 -548 Q 346 -567 324 -577 Q 303 -587 273 -587 Q 225 -587 197 -561 Q 169 -535 168 -491 L 45 -499 Q 45 -559 75 -606 Q 105 -653 158 -680 Q 210 -706 278 -706 Q 342 -706 390 -682 Q 439 -657 466 -614 Q 494 -572 494 -516 Q 494 -491 488 -470 Q 481 -450 470 -432 Q 458 -415 442 -402 Q 426 -389 407 -379 Q 434 -370 458 -354 Q 481 -339 498 -318 Q 515 -298 524 -272 Q 534 -245 534 -213 Q 534 -147 501 -97 Q 468 -47 410 -19 Q 352 9 274 9 Z" },
    ["4"] = { 560, "M 316 0 L 316 -164 L 8 -164 L 8 -260 L 332 -697 L 441 -697 L 441 -280 L 552 -280 L 552 -164 L 441 -164 L 441 0 Z M 136 -280 L 316 -280 L 316 -533 Z" },
    ["5"] = { 560, "M 277 10 Q 211 10 156 -18 Q 102 -46 68 -94 Q 33 -142 23 -202 L 145 -223 Q 149 -195 164 -169 Q 179 -143 207 -126 Q 235 -109 275 -109 Q 319 -109 346 -129 Q 374 -149 388 -180 Q 401 -211 401 -244 Q 401 -276 388 -303 Q 376 -330 348 -347 Q 321 -364 278 -364 Q 236 -364 207 -346 Q 178 -328 161 -300 L 44 -330 L 112 -697 L 502 -697 L 502 -581 L 214 -581 L 190 -454 Q 205 -463 220 -468 Q 260 -481 295 -481 Q 366 -481 420 -448 Q 473 -415 503 -361 Q 533 -307 533 -244 Q 533 -194 514 -148 Q 495 -103 461 -68 Q 427 -32 380 -11 Q 333 10 277 10 Z" },
    ["6"] = { 560, "M 407 -697 L 254 -465 Q 272 -469 290 -469 Q 357 -469 411 -438 Q 465 -406 496 -353 Q 527 -300 527 -233 Q 527 -162 492 -107 Q 458 -52 400 -21 Q 343 10 273 10 Q 203 10 144 -21 Q 86 -52 51 -107 Q 16 -162 16 -232 Q 16 -267 26 -300 Q 37 -334 56 -363 L 263 -697 Z M 273 -359 Q 237 -359 208 -344 Q 179 -328 162 -300 Q 144 -272 144 -233 Q 144 -196 161 -168 Q 178 -140 208 -124 Q 237 -109 273 -109 Q 308 -109 337 -124 Q 366 -140 384 -168 Q 401 -196 401 -234 Q 401 -272 384 -300 Q 367 -328 338 -344 Q 309 -359 273 -359 Z" },
    ["7"] = { 560, "M 87 0 L 383 -581 L 28 -581 L 28 -697 L 531 -697 L 531 -606 L 225 0 Z" },
    ["8"] = { 560, "M 280 10 Q 213 10 154 -14 Q 94 -38 58 -86 Q 21 -135 21 -207 Q 21 -262 46 -307 Q 70 -352 119 -379 Q 89 -400 72 -432 Q 54 -464 54 -508 Q 54 -571 86 -615 Q 118 -659 170 -683 Q 222 -707 280 -707 Q 341 -707 392 -682 Q 443 -658 474 -614 Q 505 -569 505 -507 Q 505 -463 488 -432 Q 471 -400 441 -379 Q 490 -352 514 -307 Q 539 -262 539 -207 Q 539 -135 502 -86 Q 466 -38 407 -14 Q 348 10 280 10 Z M 280 -108 Q 319 -108 350 -120 Q 380 -133 398 -158 Q 415 -183 415 -219 Q 415 -255 398 -280 Q 380 -304 350 -316 Q 319 -329 280 -329 Q 241 -329 210 -316 Q 180 -304 162 -280 Q 145 -255 145 -219 Q 145 -183 162 -158 Q 180 -133 211 -120 Q 242 -108 280 -108 Z M 281 -414 Q 326 -414 354 -437 Q 382 -460 382 -498 Q 382 -539 355 -564 Q 328 -588 280 -588 Q 250 -588 227 -578 Q 204 -567 192 -548 Q 179 -528 179 -500 Q 179 -460 207 -437 Q 235 -414 281 -414 Z" },
    ["9"] = { 560, "M 145 0 L 298 -232 Q 280 -228 262 -228 Q 195 -228 141 -260 Q 87 -291 56 -344 Q 24 -397 24 -464 Q 24 -535 59 -590 Q 94 -645 152 -676 Q 210 -707 279 -707 Q 350 -707 408 -676 Q 466 -645 500 -590 Q 535 -535 535 -465 Q 535 -431 525 -398 Q 515 -364 496 -334 L 288 0 Z M 279 -338 Q 315 -338 344 -354 Q 373 -369 390 -397 Q 408 -425 408 -464 Q 408 -502 390 -530 Q 373 -557 344 -572 Q 315 -588 279 -588 Q 244 -588 214 -572 Q 185 -557 168 -530 Q 151 -502 151 -463 Q 151 -426 168 -398 Q 185 -369 214 -354 Q 243 -338 279 -338 Z" },
    ["A"] = { 674, "M 8 0 L 288 -697 L 385 -697 L 665 0 L 524 0 L 474 -136 L 200 -136 L 149 0 Z M 431 -252 L 338 -506 L 243 -252 Z" },
    ["D"] = { 674, "M 67 0 L 67 -697 L 270 -697 Q 444 -697 539 -605 Q 634 -513 634 -343 Q 634 -177 540 -88 Q 446 0 269 0 Z M 196 -119 L 256 -119 Q 335 -119 390 -139 Q 445 -159 474 -209 Q 504 -259 504 -348 Q 504 -434 476 -484 Q 447 -535 394 -556 Q 342 -578 268 -578 L 196 -578 Z" },
    ["G"] = { 735, "M 365 16 Q 269 16 196 -30 Q 123 -76 81 -158 Q 39 -240 39 -349 Q 39 -458 81 -540 Q 123 -621 198 -667 Q 274 -713 373 -713 Q 484 -713 564 -658 Q 645 -602 680 -505 L 558 -460 Q 536 -521 488 -555 Q 441 -589 373 -589 Q 311 -589 264 -560 Q 218 -531 194 -478 Q 169 -424 169 -349 Q 169 -274 194 -220 Q 218 -166 264 -137 Q 311 -108 373 -108 Q 405 -108 439 -117 Q 473 -126 502 -148 Q 530 -171 548 -211 Q 557 -234 562 -263 L 394 -263 L 394 -379 L 680 -379 L 680 0 L 566 0 L 555 -70 Q 540 -50 521 -34 Q 490 -9 450 4 Q 411 16 365 16 Z" },
    ["L"] = { 504, "M 67 0 L 67 -697 L 196 -697 L 196 -116 L 493 -116 L 493 0 Z" },
    ["O"] = { 747, "M 373 16 Q 274 16 198 -30 Q 123 -75 81 -157 Q 39 -239 39 -348 Q 39 -458 81 -540 Q 123 -622 198 -668 Q 274 -713 373 -713 Q 473 -713 548 -668 Q 624 -622 666 -540 Q 708 -458 708 -348 Q 708 -239 666 -157 Q 623 -75 548 -30 Q 472 16 373 16 Z M 372 -108 Q 436 -108 482 -138 Q 527 -167 552 -221 Q 577 -275 577 -348 Q 577 -422 552 -476 Q 527 -530 482 -560 Q 436 -589 372 -589 Q 311 -589 264 -560 Q 218 -531 194 -477 Q 169 -423 169 -348 Q 169 -274 194 -220 Q 218 -166 264 -137 Q 311 -108 372 -108 Z" },
    ["U"] = { 657, "M 328 16 Q 196 16 128 -51 Q 61 -118 61 -252 L 61 -697 L 190 -697 L 190 -267 Q 190 -213 202 -176 Q 213 -140 244 -122 Q 274 -103 328 -103 Q 382 -103 412 -122 Q 443 -140 455 -176 Q 467 -213 467 -266 L 467 -697 L 596 -697 L 596 -257 Q 596 -121 528 -52 Q 460 16 328 16 Z" },
    ["W"] = { 979, "M 223 0 L 13 -697 L 149 -697 L 293 -198 L 426 -657 L 554 -657 L 686 -198 L 831 -697 L 966 -697 L 756 0 L 631 0 L 490 -467 L 349 0 Z" },
    ["d"] = { 574, "M 248 10 Q 183 10 136 -24 Q 89 -57 64 -116 Q 38 -174 38 -247 Q 38 -328 66 -385 Q 95 -442 143 -472 Q 191 -503 248 -503 Q 288 -503 322 -486 Q 357 -470 382 -437 Q 386 -431 390 -425 L 390 -697 L 513 -697 L 513 0 L 390 0 L 390 -67 Q 386 -60 381 -54 Q 354 -19 320 -4 Q 285 10 248 10 Z M 282 -104 Q 319 -104 346 -122 Q 372 -140 386 -172 Q 401 -204 401 -247 Q 401 -290 386 -322 Q 372 -354 346 -372 Q 319 -389 282 -389 Q 246 -389 219 -372 Q 192 -354 178 -322 Q 163 -291 163 -247 Q 163 -203 178 -171 Q 192 -139 219 -122 Q 246 -104 282 -104 Z" },
    ["e"] = { 541, "M 281 10 Q 217 10 171 -11 Q 125 -32 96 -68 Q 66 -103 52 -148 Q 38 -194 38 -244 Q 38 -292 52 -338 Q 66 -384 94 -421 Q 122 -458 166 -480 Q 211 -503 273 -503 Q 331 -503 374 -484 Q 417 -464 445 -430 Q 473 -395 488 -349 Q 502 -303 502 -251 Q 502 -244 502 -232 Q 501 -219 499 -205 L 162 -205 Q 167 -152 202 -125 Q 236 -98 288 -98 Q 326 -98 362 -112 Q 398 -125 426 -150 L 488 -66 Q 453 -39 422 -22 Q 391 -5 358 2 Q 324 10 281 10 Z M 384 -297 Q 384 -298 384 -298 Q 384 -319 376 -338 Q 368 -356 354 -370 Q 340 -384 320 -392 Q 301 -399 276 -399 Q 239 -399 214 -384 Q 189 -369 176 -346 Q 164 -322 161 -297 Z" },
    ["n"] = { 564, "M 61 0 L 61 -493 L 186 -493 L 186 -427 Q 194 -440 204 -451 Q 229 -478 262 -490 Q 295 -503 330 -503 Q 414 -503 462 -456 Q 509 -408 509 -322 L 509 0 L 384 0 L 384 -276 Q 384 -338 362 -366 Q 340 -395 293 -395 Q 257 -395 234 -378 Q 210 -362 198 -327 Q 186 -292 186 -236 L 186 0 Z" },
    ["r"] = { 426, "M 61 0 L 61 -493 L 186 -493 L 186 -422 Q 189 -428 193 -433 Q 216 -466 250 -484 Q 283 -503 318 -503 Q 343 -503 366 -496 Q 388 -490 412 -475 L 352 -363 Q 341 -369 324 -374 Q 307 -379 290 -379 Q 270 -379 252 -372 Q 233 -365 218 -350 Q 204 -335 195 -310 Q 191 -296 188 -274 Q 186 -253 186 -212 L 186 0 Z" },
    ["–"] = { 428, "M 24 -249 L 24 -342 L 404 -342 L 404 -249 Z" },
}


-- extra glyphs (accents for the real squads, minute marks)
GLYPHS.L["'"] = { 156, "M 51 -416 L 51 -697 L 105 -697 L 105 -416 Z" }
GLYPHS.L["+"] = { 560, "M 254 -12 L 254 -222 L 44 -222 L 44 -273 L 254 -273 L 254 -483 L 306 -483 L 306 -273 L 516 -273 L 516 -222 L 306 -222 L 306 -12 Z" }
GLYPHS.L["F"] = { 568, "M 85 0 L 85 -697 L 537 -697 L 537 -638 L 150 -638 L 150 -384 L 486 -384 L 486 -325 L 150 -325 L 150 0 Z" }
GLYPHS.L["T"] = { 591, "M 262 0 L 262 -638 L 18 -638 L 18 -697 L 571 -697 L 571 -638 L 328 -638 L 328 0 Z" }
GLYPHS.R["ú"] = { 547, "M 238 8 Q 185 8 146 -14 Q 107 -35 86 -77 Q 66 -119 66 -181 L 66 -493 L 150 -493 L 150 -211 Q 150 -162 162 -130 Q 175 -97 200 -82 Q 225 -66 262 -66 Q 303 -66 332 -86 Q 360 -105 375 -145 Q 390 -185 390 -248 L 390 -493 L 474 -493 L 474 0 L 390 0 L 390 -65 Q 371 -38 344 -21 Q 298 8 238 8 Z M 237 -556 L 346 -697 L 437 -697 L 300 -556 Z" }
GLYPHS.R["ç"] = { 518, "M 268 204 Q 252 204 234 200 Q 217 197 202 189 Q 186 181 174 170 L 203 136 Q 217 148 234 154 Q 251 160 267 160 Q 287 160 302 151 Q 317 142 317 123 Q 317 108 306 100 Q 296 91 278 86 Q 261 82 241 80 Q 221 78 203 78 L 255 7 Q 213 4 180 -12 Q 137 -32 108 -68 Q 79 -103 64 -149 Q 49 -195 49 -247 Q 49 -298 64 -344 Q 79 -390 108 -426 Q 137 -461 180 -481 Q 222 -501 277 -501 Q 347 -501 400 -467 Q 452 -433 477 -363 L 402 -334 Q 388 -376 357 -402 Q 326 -428 277 -428 Q 228 -428 196 -402 Q 164 -376 148 -335 Q 133 -294 133 -247 Q 133 -200 148 -158 Q 164 -117 196 -92 Q 228 -66 277 -66 Q 326 -66 357 -92 Q 388 -117 402 -160 L 477 -131 Q 452 -61 400 -27 Q 358 0 307 6 L 273 46 Q 311 52 340 69 Q 369 86 369 121 Q 369 161 339 182 Q 309 204 268 204 Z" }
GLYPHS.R["à"] = { 540, "M 396 0 L 391 -76 Q 366 -36 327 -15 Q 286 8 233 8 Q 177 8 136 -12 Q 94 -31 72 -66 Q 49 -101 49 -147 Q 49 -188 66 -216 Q 82 -245 108 -261 Q 134 -278 168 -284 Q 201 -291 238 -291 L 390 -291 L 390 -309 Q 390 -366 358 -397 Q 327 -428 265 -428 Q 225 -428 190 -412 Q 155 -395 122 -356 L 61 -408 Q 102 -456 155 -478 Q 208 -501 271 -501 Q 368 -501 421 -451 Q 474 -401 474 -309 L 474 0 Z M 390 -227 L 250 -227 Q 228 -227 204 -223 Q 180 -219 162 -206 Q 149 -196 142 -181 Q 134 -166 134 -146 Q 134 -107 163 -84 Q 192 -61 241 -61 Q 282 -61 316 -80 Q 349 -99 370 -132 Q 390 -166 390 -208 Z M 242 -556 L 112 -697 L 202 -697 L 306 -556 Z" }
GLYPHS.R["â"] = { 540, "M 396 0 L 391 -76 Q 366 -36 327 -15 Q 286 8 233 8 Q 177 8 136 -12 Q 94 -31 72 -66 Q 49 -101 49 -147 Q 49 -188 66 -216 Q 82 -245 108 -261 Q 134 -278 168 -284 Q 201 -291 238 -291 L 390 -291 L 390 -309 Q 390 -366 358 -397 Q 327 -428 265 -428 Q 225 -428 190 -412 Q 155 -395 122 -356 L 61 -408 Q 102 -456 155 -478 Q 208 -501 271 -501 Q 368 -501 421 -451 Q 474 -401 474 -309 L 474 0 Z M 390 -227 L 250 -227 Q 228 -227 204 -223 Q 180 -219 162 -206 Q 149 -196 142 -181 Q 134 -166 134 -146 Q 134 -107 163 -84 Q 192 -61 241 -61 Q 282 -61 316 -80 Q 349 -99 370 -132 Q 390 -166 390 -208 Z M 123 -547 L 274 -709 L 425 -547 L 356 -547 L 274 -636 L 193 -547 Z" }
GLYPHS.R["ê"] = { 540, "M 280 8 Q 222 8 178 -12 Q 135 -31 106 -66 Q 78 -101 64 -146 Q 49 -192 49 -243 Q 49 -294 63 -340 Q 77 -387 104 -423 Q 132 -459 174 -480 Q 216 -501 272 -501 Q 329 -501 370 -482 Q 412 -462 438 -428 Q 465 -394 478 -352 Q 491 -310 491 -265 Q 491 -261 490 -246 Q 490 -232 488 -221 L 133 -221 Q 136 -149 175 -109 Q 214 -69 281 -69 Q 324 -69 356 -83 Q 388 -97 416 -128 L 475 -76 Q 448 -47 418 -28 Q 388 -10 354 -1 Q 321 8 280 8 Z M 410 -284 Q 410 -290 410 -296 Q 410 -320 402 -344 Q 393 -368 376 -388 Q 360 -407 334 -418 Q 309 -430 274 -430 Q 231 -430 200 -410 Q 169 -390 152 -357 Q 135 -324 132 -284 Z M 122 -547 L 273 -709 L 424 -547 L 355 -547 L 273 -636 L 192 -547 Z" }
GLYPHS.R["ô"] = { 577, "M 289 8 Q 220 8 166 -24 Q 111 -57 80 -115 Q 49 -173 49 -247 Q 49 -321 80 -378 Q 110 -436 164 -468 Q 219 -501 289 -501 Q 359 -501 412 -468 Q 466 -436 497 -378 Q 528 -321 528 -247 Q 528 -173 497 -116 Q 466 -58 412 -25 Q 358 8 289 8 Z M 289 -67 Q 336 -67 370 -90 Q 405 -112 424 -152 Q 443 -193 443 -247 Q 443 -302 424 -342 Q 405 -383 370 -405 Q 336 -427 289 -427 Q 241 -427 206 -404 Q 171 -382 152 -342 Q 133 -302 133 -247 Q 133 -193 152 -152 Q 171 -112 206 -90 Q 241 -67 289 -67 Z M 138 -547 L 289 -709 L 440 -547 L 371 -547 L 289 -636 L 208 -547 Z" }
GLYPHS.R["ć"] = { 518, "M 277 8 Q 222 8 180 -12 Q 137 -32 108 -68 Q 79 -103 64 -149 Q 49 -195 49 -247 Q 49 -298 64 -344 Q 79 -390 108 -426 Q 137 -461 180 -481 Q 222 -501 277 -501 Q 347 -501 400 -467 Q 452 -433 477 -363 L 402 -334 Q 388 -376 357 -402 Q 326 -428 277 -428 Q 228 -428 196 -402 Q 164 -376 148 -335 Q 133 -294 133 -247 Q 133 -200 148 -158 Q 164 -117 196 -92 Q 228 -66 277 -66 Q 326 -66 357 -92 Q 388 -117 402 -160 L 477 -131 Q 452 -61 400 -26 Q 347 8 277 8 Z M 236 -556 L 345 -697 L 436 -697 L 299 -556 Z" }
GLYPHS.R["ż"] = { 472, "M 37 0 L 37 -60 L 334 -425 L 51 -425 L 51 -493 L 431 -493 L 431 -429 L 142 -69 L 429 -69 L 429 0 Z M 187 -582 L 187 -697 L 287 -697 L 287 -582 Z" }
GLYPHS.R["š"] = { 470, "M 235 8 Q 185 8 145 -7 Q 105 -22 76 -47 Q 48 -72 31 -100 L 90 -150 Q 109 -112 146 -88 Q 184 -63 236 -63 Q 283 -63 311 -83 Q 339 -103 339 -137 Q 339 -165 322 -181 Q 305 -197 277 -207 Q 249 -217 216 -225 Q 188 -232 160 -242 Q 131 -252 108 -267 Q 85 -282 71 -306 Q 57 -330 57 -365 Q 57 -426 104 -464 Q 152 -501 229 -501 Q 285 -501 332 -478 Q 378 -454 404 -407 L 350 -367 Q 330 -402 298 -418 Q 265 -433 226 -433 Q 187 -433 161 -417 Q 135 -401 135 -373 Q 135 -352 147 -339 Q 159 -326 182 -317 Q 206 -308 240 -300 Q 271 -293 303 -283 Q 335 -273 362 -257 Q 389 -241 406 -214 Q 422 -188 422 -146 Q 422 -100 399 -65 Q 376 -30 334 -11 Q 292 8 235 8 Z M 232 -541 L 81 -697 L 148 -697 L 232 -611 L 316 -697 L 383 -697 Z" }
GLYPHS.R["ž"] = { 472, "M 37 0 L 37 -60 L 334 -425 L 51 -425 L 51 -493 L 431 -493 L 431 -429 L 142 -69 L 429 -69 L 429 0 Z M 237 -541 L 86 -697 L 153 -697 L 237 -611 L 321 -697 L 388 -697 Z" }
GLYPHS.R["ő"] = { 577, "M 289 8 Q 220 8 166 -24 Q 111 -57 80 -115 Q 49 -173 49 -247 Q 49 -321 80 -378 Q 110 -436 164 -468 Q 219 -501 289 -501 Q 359 -501 412 -468 Q 466 -436 497 -378 Q 528 -321 528 -247 Q 528 -173 497 -116 Q 466 -58 412 -25 Q 358 8 289 8 Z M 289 -67 Q 336 -67 370 -90 Q 405 -112 424 -152 Q 443 -193 443 -247 Q 443 -302 424 -342 Q 405 -383 370 -405 Q 336 -427 289 -427 Q 241 -427 206 -404 Q 171 -382 152 -342 Q 133 -302 133 -247 Q 133 -193 152 -152 Q 171 -112 206 -90 Q 241 -67 289 -67 Z M 345 -542 L 455 -697 L 545 -697 L 409 -542 Z M 169 -542 L 278 -697 L 355 -697 L 232 -542 Z" }
GLYPHS.R["ř"] = { 407, "M 72 0 L 72 -493 L 157 -493 L 157 -416 Q 162 -425 169 -433 Q 195 -465 230 -483 Q 266 -501 300 -501 Q 323 -501 344 -496 Q 365 -491 387 -479 L 345 -403 Q 333 -409 316 -413 Q 300 -417 285 -417 Q 261 -417 238 -408 Q 214 -399 195 -380 Q 176 -361 166 -329 Q 162 -315 160 -292 Q 157 -270 157 -231 L 157 0 Z M 190 -541 L 39 -697 L 106 -697 L 190 -611 L 274 -697 L 341 -697 Z" }
GLYPHS.R["ė"] = { 540, "M 280 8 Q 222 8 178 -12 Q 135 -31 106 -66 Q 78 -101 64 -146 Q 49 -192 49 -243 Q 49 -294 63 -340 Q 77 -387 104 -423 Q 132 -459 174 -480 Q 216 -501 272 -501 Q 329 -501 370 -482 Q 412 -462 438 -428 Q 465 -394 478 -352 Q 491 -310 491 -265 Q 491 -261 490 -246 Q 490 -232 488 -221 L 133 -221 Q 136 -149 175 -109 Q 214 -69 281 -69 Q 324 -69 356 -83 Q 388 -97 416 -128 L 475 -76 Q 448 -47 418 -28 Q 388 -10 354 -1 Q 321 8 280 8 Z M 410 -284 Q 410 -290 410 -296 Q 410 -320 402 -344 Q 393 -368 376 -388 Q 360 -407 334 -418 Q 309 -430 274 -430 Q 231 -430 200 -410 Q 169 -390 152 -357 Q 135 -324 132 -284 Z M 223 -582 L 223 -697 L 323 -697 L 323 -582 Z" }
GLYPHS.R["É"] = { 585, "M 79 0 L 79 -697 L 538 -697 L 538 -618 L 167 -618 L 167 -395 L 504 -395 L 504 -316 L 167 -316 L 167 -79 L 538 -79 L 538 0 Z M 277 -760 L 386 -901 L 477 -901 L 340 -760 Z" }
GLYPHS.R["Í"] = { 246, "M 79 0 L 79 -697 L 167 -697 L 167 0 Z M 92 -760 L 201 -901 L 292 -901 L 155 -760 Z" }
GLYPHS.R["Ó"] = { 748, "M 372 12 Q 276 12 204 -33 Q 131 -78 90 -159 Q 50 -240 50 -348 Q 50 -457 90 -538 Q 131 -619 204 -664 Q 276 -709 372 -709 Q 470 -709 543 -664 Q 616 -619 656 -538 Q 697 -457 697 -348 Q 697 -240 656 -159 Q 615 -78 542 -33 Q 469 12 372 12 Z M 372 -72 Q 445 -72 498 -106 Q 550 -140 579 -202 Q 608 -264 608 -348 Q 608 -433 579 -495 Q 550 -557 498 -591 Q 445 -625 372 -625 Q 301 -625 248 -592 Q 195 -558 166 -496 Q 138 -434 138 -348 Q 138 -263 166 -201 Q 195 -139 248 -106 Q 301 -72 372 -72 Z M 341 -760 L 450 -901 L 541 -901 L 404 -760 Z" }
GLYPHS.R["Ú"] = { 656, "M 327 12 Q 203 12 138 -55 Q 72 -122 72 -252 L 72 -697 L 160 -697 L 160 -262 Q 160 -199 176 -156 Q 193 -113 230 -91 Q 267 -69 327 -69 Q 387 -69 424 -92 Q 462 -114 479 -157 Q 496 -200 496 -263 L 496 -697 L 583 -697 L 583 -257 Q 583 -125 518 -56 Q 452 12 327 12 Z M 296 -760 L 405 -901 L 496 -901 L 359 -760 Z" }
GLYPHS.R["Ï"] = { 246, "M 79 0 L 79 -697 L 167 -697 L 167 0 Z M 167 -786 L 167 -901 L 267 -901 L 267 -786 Z M -18 -786 L -18 -901 L 82 -901 L 82 -786 Z" }
GLYPHS.R["Ü"] = { 656, "M 327 12 Q 203 12 138 -55 Q 72 -122 72 -252 L 72 -697 L 160 -697 L 160 -262 Q 160 -199 176 -156 Q 193 -113 230 -91 Q 267 -69 327 -69 Q 387 -69 424 -92 Q 462 -114 479 -157 Q 496 -200 496 -263 L 496 -697 L 583 -697 L 583 -257 Q 583 -125 518 -56 Q 452 12 327 12 Z M 371 -786 L 371 -901 L 471 -901 L 471 -786 Z M 186 -786 L 186 -901 L 286 -901 L 286 -786 Z" }
GLYPHS.R["Ñ"] = { 676, "M 79 0 L 79 -697 L 172 -697 L 509 -147 L 509 -697 L 597 -697 L 597 0 L 502 0 L 167 -551 L 167 0 Z M 400 -743 Q 376 -743 360 -752 Q 343 -760 332 -772 Q 320 -785 310 -798 Q 301 -810 290 -818 Q 280 -827 265 -827 Q 246 -827 234 -807 Q 222 -787 222 -751 L 172 -751 Q 172 -810 198 -842 Q 224 -875 269 -875 Q 291 -875 306 -866 Q 321 -858 332 -845 Q 344 -832 354 -820 Q 364 -807 375 -798 Q 386 -790 401 -790 Q 418 -790 430 -812 Q 442 -834 442 -871 L 494 -871 Q 494 -811 468 -777 Q 443 -743 400 -743 Z" }
GLYPHS.R["Ç"] = { 704, "M 342 204 Q 326 204 308 200 Q 291 197 276 189 Q 260 181 248 170 L 277 136 Q 291 148 308 154 Q 325 160 341 160 Q 361 160 376 151 Q 391 142 391 123 Q 391 108 380 100 Q 370 91 352 86 Q 335 82 315 80 Q 295 78 277 78 L 327 9 Q 259 1 204 -33 Q 131 -78 90 -160 Q 50 -241 50 -349 Q 50 -457 90 -538 Q 131 -619 204 -664 Q 276 -709 372 -709 Q 477 -709 554 -657 Q 631 -605 665 -513 L 583 -482 Q 557 -550 503 -588 Q 449 -625 372 -625 Q 301 -625 248 -591 Q 195 -557 166 -496 Q 138 -434 138 -349 Q 138 -264 166 -202 Q 195 -140 248 -106 Q 301 -72 372 -72 Q 449 -72 503 -110 Q 557 -148 583 -215 L 665 -185 Q 631 -94 554 -41 Q 478 11 376 12 L 347 46 Q 385 52 414 69 Q 443 86 443 121 Q 443 161 413 182 Q 383 204 342 204 Z" }
GLYPHS.R["È"] = { 585, "M 79 0 L 79 -697 L 538 -697 L 538 -618 L 167 -618 L 167 -395 L 504 -395 L 504 -316 L 167 -316 L 167 -79 L 538 -79 L 538 0 Z M 277 -760 L 147 -901 L 237 -901 L 341 -760 Z" }
GLYPHS.R["Ø"] = { 748, "M 372 12 Q 276 12 204 -33 Q 194 -39 186 -45 L 154 0 L 94 0 L 149 -77 Q 114 -112 91 -159 Q 50 -240 50 -348 Q 50 -457 90 -538 Q 131 -619 204 -664 Q 276 -709 372 -709 Q 470 -709 543 -664 Q 552 -659 560 -653 L 592 -697 L 651 -697 L 597 -621 Q 632 -586 657 -538 Q 697 -457 697 -348 Q 697 -240 656 -159 Q 615 -78 542 -33 Q 469 12 372 12 Z M 200 -148 L 510 -582 Q 504 -587 498 -591 Q 445 -625 372 -625 Q 301 -625 248 -592 Q 195 -558 166 -496 Q 138 -434 138 -348 Q 138 -263 167 -201 Q 180 -171 200 -148 Z M 372 -72 Q 445 -72 498 -106 Q 550 -140 579 -202 Q 608 -264 608 -348 Q 608 -433 579 -495 Q 565 -525 545 -549 L 235 -114 Q 242 -110 248 -106 Q 301 -72 372 -72 Z" }
GLYPHS.R["’"] = { 263, "M 39 -415 L 129 -697 L 227 -697 L 96 -415 Z" }
GLYPHS.R["“"] = { 436, "M 210 -414 L 339 -697 L 397 -697 L 308 -414 Z M 34 -414 L 165 -697 L 222 -697 L 132 -414 Z" }
GLYPHS.R["”"] = { 438, "M 215 -415 L 305 -697 L 402 -697 L 272 -415 Z M 39 -415 L 129 -697 L 227 -697 L 96 -415 Z" }
GLYPHS.R["…"] = { 668, "M 509 0 L 509 -116 L 598 -116 L 598 0 Z M 70 0 L 70 -116 L 158 -116 L 158 0 Z M 290 0 L 290 -116 L 379 -116 L 379 0 Z" }
GLYPHS.R["—"] = { 1058, "M 24 -272 L 24 -335 L 1034 -335 L 1034 -272 Z" }
GLYPHS.M["ú"] = { 553, "M 237 9 Q 182 9 142 -14 Q 103 -36 82 -78 Q 62 -121 62 -182 L 62 -493 L 160 -493 L 160 -213 Q 160 -169 171 -138 Q 182 -108 206 -92 Q 229 -77 265 -77 Q 307 -77 334 -98 Q 360 -119 373 -160 Q 386 -202 386 -264 L 386 -493 L 483 -493 L 483 0 L 386 0 L 386 -64 Q 367 -36 339 -19 Q 294 9 237 9 Z M 235 -556 L 345 -697 L 450 -697 L 308 -556 Z" }
GLYPHS.M["ç"] = { 519, "M 267 204 Q 253 204 236 201 Q 218 198 202 190 Q 185 183 173 173 L 203 134 Q 217 144 234 150 Q 250 155 265 155 Q 284 155 298 146 Q 312 138 312 120 Q 312 106 302 98 Q 291 89 274 85 Q 257 81 238 79 Q 218 77 200 77 L 251 8 Q 210 4 178 -12 Q 134 -32 104 -68 Q 75 -104 60 -150 Q 45 -196 45 -247 Q 45 -297 60 -343 Q 75 -389 104 -425 Q 134 -461 178 -482 Q 221 -502 277 -502 Q 349 -502 402 -467 Q 456 -432 481 -361 L 395 -328 Q 382 -367 353 -392 Q 324 -417 277 -417 Q 231 -417 201 -392 Q 171 -368 157 -330 Q 143 -291 143 -247 Q 143 -203 157 -164 Q 171 -125 201 -101 Q 231 -77 277 -77 Q 324 -77 353 -102 Q 382 -126 395 -166 L 481 -133 Q 456 -61 403 -26 Q 359 2 304 8 L 275 43 Q 315 49 342 67 Q 370 85 370 119 Q 370 159 340 182 Q 310 204 267 204 Z" }
GLYPHS.M["à"] = { 542, "M 390 0 L 384 -72 Q 383 -71 382 -70 Q 356 -31 318 -11 Q 279 9 231 9 Q 176 9 134 -11 Q 92 -31 69 -66 Q 46 -102 46 -149 Q 46 -190 63 -220 Q 80 -249 107 -265 Q 132 -281 164 -288 Q 197 -294 234 -294 L 382 -294 L 382 -310 Q 382 -362 352 -390 Q 322 -418 265 -418 Q 225 -418 188 -402 Q 152 -386 119 -350 L 58 -413 Q 102 -459 156 -480 Q 209 -502 272 -502 Q 371 -502 426 -452 Q 480 -401 480 -310 L 480 0 Z M 382 -220 L 248 -220 Q 228 -220 206 -216 Q 185 -213 170 -202 Q 158 -193 151 -180 Q 144 -166 144 -148 Q 144 -113 171 -92 Q 198 -71 243 -71 Q 281 -71 312 -88 Q 344 -106 363 -136 Q 382 -167 382 -206 Z M 238 -556 L 103 -697 L 207 -697 L 311 -556 Z" }
GLYPHS.M["â"] = { 542, "M 390 0 L 384 -72 Q 383 -71 382 -70 Q 356 -31 318 -11 Q 279 9 231 9 Q 176 9 134 -11 Q 92 -31 69 -66 Q 46 -102 46 -149 Q 46 -190 63 -220 Q 80 -249 107 -265 Q 132 -281 164 -288 Q 197 -294 234 -294 L 382 -294 L 382 -310 Q 382 -362 352 -390 Q 322 -418 265 -418 Q 225 -418 188 -402 Q 152 -386 119 -350 L 58 -413 Q 102 -459 156 -480 Q 209 -502 272 -502 Q 371 -502 426 -452 Q 480 -401 480 -310 L 480 0 Z M 382 -220 L 248 -220 Q 228 -220 206 -216 Q 185 -213 170 -202 Q 158 -193 151 -180 Q 144 -166 144 -148 Q 144 -113 171 -92 Q 198 -71 243 -71 Q 281 -71 312 -88 Q 344 -106 363 -136 Q 382 -167 382 -206 Z M 121 -545 L 274 -711 L 427 -545 L 348 -545 L 274 -627 L 201 -545 Z" }
GLYPHS.M["ê"] = { 540, "M 280 9 Q 220 9 176 -11 Q 132 -31 103 -66 Q 74 -102 60 -148 Q 45 -193 45 -243 Q 45 -293 59 -340 Q 73 -386 101 -422 Q 129 -459 172 -480 Q 214 -502 272 -502 Q 330 -502 372 -482 Q 414 -463 441 -428 Q 468 -394 482 -351 Q 495 -308 495 -260 Q 495 -255 494 -242 Q 494 -228 492 -216 L 143 -216 Q 146 -150 184 -114 Q 221 -79 283 -79 Q 325 -79 358 -92 Q 391 -106 419 -135 L 479 -73 Q 450 -44 420 -26 Q 389 -8 356 0 Q 322 9 280 9 Z M 401 -288 Q 401 -293 401 -297 Q 401 -320 393 -342 Q 385 -364 369 -382 Q 353 -399 330 -410 Q 306 -420 275 -420 Q 234 -420 205 -402 Q 176 -383 160 -353 Q 145 -323 142 -288 Z M 120 -545 L 273 -711 L 426 -545 L 347 -545 L 273 -627 L 200 -545 Z" }
GLYPHS.M["ô"] = { 575, "M 288 9 Q 218 9 163 -24 Q 108 -57 76 -115 Q 45 -173 45 -247 Q 45 -321 76 -378 Q 107 -436 162 -469 Q 218 -502 288 -502 Q 359 -502 413 -469 Q 467 -436 498 -378 Q 530 -321 530 -247 Q 530 -173 498 -116 Q 467 -58 412 -24 Q 358 9 288 9 Z M 288 -78 Q 332 -78 364 -99 Q 397 -120 414 -158 Q 432 -196 432 -247 Q 432 -299 414 -337 Q 397 -375 364 -396 Q 332 -416 288 -416 Q 243 -416 210 -395 Q 178 -374 160 -336 Q 143 -299 143 -247 Q 143 -196 160 -158 Q 178 -120 210 -99 Q 243 -78 288 -78 Z M 135 -545 L 288 -711 L 441 -545 L 362 -545 L 288 -627 L 215 -545 Z" }
GLYPHS.M["ć"] = { 519, "M 277 9 Q 221 9 178 -12 Q 134 -32 104 -68 Q 75 -104 60 -150 Q 45 -196 45 -247 Q 45 -297 60 -343 Q 75 -389 104 -425 Q 134 -461 178 -482 Q 221 -502 277 -502 Q 349 -502 402 -467 Q 456 -432 481 -361 L 395 -328 Q 382 -367 353 -392 Q 324 -417 277 -417 Q 231 -417 201 -392 Q 171 -368 157 -330 Q 143 -291 143 -247 Q 143 -203 157 -164 Q 171 -125 201 -101 Q 231 -77 277 -77 Q 324 -77 353 -102 Q 382 -126 395 -166 L 481 -133 Q 456 -61 402 -26 Q 349 9 277 9 Z M 230 -556 L 340 -697 L 445 -697 L 303 -556 Z" }
GLYPHS.M["ż"] = { 472, "M 36 0 L 36 -68 L 316 -413 L 49 -413 L 49 -493 L 431 -493 L 431 -421 L 159 -80 L 430 -80 L 430 0 Z M 181 -578 L 181 -697 L 292 -697 L 292 -578 Z" }
GLYPHS.M["š"] = { 471, "M 234 9 Q 182 9 142 -6 Q 102 -22 74 -46 Q 45 -71 28 -97 L 95 -155 Q 114 -121 150 -96 Q 185 -72 235 -72 Q 279 -72 304 -90 Q 330 -109 330 -139 Q 330 -163 314 -178 Q 298 -192 272 -202 Q 246 -211 215 -218 Q 187 -226 158 -236 Q 129 -246 106 -262 Q 82 -277 68 -302 Q 53 -326 53 -362 Q 53 -425 102 -464 Q 150 -502 230 -502 Q 287 -502 334 -478 Q 381 -455 407 -409 L 346 -362 Q 326 -395 294 -410 Q 263 -425 226 -425 Q 191 -425 168 -410 Q 144 -396 144 -371 Q 144 -353 154 -342 Q 165 -330 188 -322 Q 210 -313 243 -305 Q 274 -298 306 -288 Q 338 -278 365 -262 Q 392 -246 409 -219 Q 426 -192 426 -149 Q 426 -102 402 -66 Q 378 -31 335 -11 Q 292 9 234 9 Z M 233 -538 L 80 -697 L 157 -697 L 233 -616 L 310 -697 L 386 -697 Z" }
GLYPHS.M["ž"] = { 472, "M 36 0 L 36 -68 L 316 -413 L 49 -413 L 49 -493 L 431 -493 L 431 -421 L 159 -80 L 430 -80 L 430 0 Z M 237 -538 L 84 -697 L 161 -697 L 237 -616 L 314 -697 L 390 -697 Z" }
GLYPHS.M["ő"] = { 575, "M 288 9 Q 218 9 163 -24 Q 108 -57 76 -115 Q 45 -173 45 -247 Q 45 -321 76 -378 Q 107 -436 162 -469 Q 218 -502 288 -502 Q 359 -502 413 -469 Q 467 -436 498 -378 Q 530 -321 530 -247 Q 530 -173 498 -116 Q 467 -58 412 -24 Q 358 9 288 9 Z M 288 -78 Q 332 -78 364 -99 Q 397 -120 414 -158 Q 432 -196 432 -247 Q 432 -299 414 -337 Q 397 -375 364 -396 Q 332 -416 288 -416 Q 243 -416 210 -395 Q 178 -374 160 -336 Q 143 -299 143 -247 Q 143 -196 160 -158 Q 178 -120 210 -99 Q 243 -78 288 -78 Z M 342 -539 L 453 -697 L 557 -697 L 415 -539 Z M 160 -539 L 270 -697 L 359 -697 L 233 -539 Z" }
GLYPHS.M["ř"] = { 413, "M 68 0 L 68 -493 L 167 -493 L 167 -419 Q 171 -426 177 -433 Q 202 -465 237 -484 Q 272 -502 306 -502 Q 330 -502 352 -496 Q 373 -491 395 -478 L 347 -390 Q 336 -396 319 -400 Q 302 -404 287 -404 Q 264 -404 242 -396 Q 220 -388 202 -370 Q 185 -352 176 -323 Q 172 -309 170 -286 Q 167 -264 167 -225 L 167 0 Z M 192 -538 L 39 -697 L 116 -697 L 192 -616 L 269 -697 L 345 -697 Z" }
GLYPHS.M["ė"] = { 540, "M 280 9 Q 220 9 176 -11 Q 132 -31 103 -66 Q 74 -102 60 -148 Q 45 -193 45 -243 Q 45 -293 59 -340 Q 73 -386 101 -422 Q 129 -459 172 -480 Q 214 -502 272 -502 Q 330 -502 372 -482 Q 414 -463 441 -428 Q 468 -394 482 -351 Q 495 -308 495 -260 Q 495 -255 494 -242 Q 494 -228 492 -216 L 143 -216 Q 146 -150 184 -114 Q 221 -79 283 -79 Q 325 -79 358 -92 Q 391 -106 419 -135 L 479 -73 Q 450 -44 420 -26 Q 389 -8 356 0 Q 322 9 280 9 Z M 401 -288 Q 401 -293 401 -297 Q 401 -320 393 -342 Q 385 -364 369 -382 Q 353 -399 330 -410 Q 306 -420 275 -420 Q 234 -420 205 -402 Q 176 -383 160 -353 Q 145 -323 142 -288 Z M 218 -578 L 218 -697 L 329 -697 L 329 -578 Z" }
GLYPHS.M["É"] = { 583, "M 75 0 L 75 -697 L 536 -697 L 536 -606 L 177 -606 L 177 -402 L 506 -402 L 506 -311 L 177 -311 L 177 -91 L 536 -91 L 536 0 Z M 269 -760 L 379 -901 L 484 -901 L 342 -760 Z" }
GLYPHS.M["Í"] = { 252, "M 75 0 L 75 -697 L 177 -697 L 177 0 Z M 90 -760 L 200 -901 L 305 -901 L 163 -760 Z" }
GLYPHS.M["Ó"] = { 748, "M 372 13 Q 275 13 202 -32 Q 128 -77 87 -158 Q 46 -240 46 -348 Q 46 -457 87 -538 Q 128 -620 202 -665 Q 275 -710 372 -710 Q 471 -710 545 -665 Q 619 -620 660 -538 Q 701 -457 701 -348 Q 701 -240 660 -158 Q 618 -77 544 -32 Q 470 13 372 13 Z M 372 -84 Q 442 -84 492 -116 Q 542 -149 570 -208 Q 598 -268 598 -348 Q 598 -429 570 -488 Q 542 -548 492 -580 Q 442 -613 372 -613 Q 304 -613 254 -581 Q 203 -549 176 -490 Q 148 -430 148 -348 Q 148 -267 176 -208 Q 203 -148 254 -116 Q 304 -84 372 -84 Z M 336 -760 L 446 -901 L 551 -901 L 409 -760 Z" }
GLYPHS.M["Ú"] = { 656, "M 327 13 Q 201 13 134 -54 Q 68 -121 68 -252 L 68 -697 L 170 -697 L 170 -264 Q 170 -204 185 -163 Q 200 -122 234 -101 Q 269 -80 327 -80 Q 385 -80 420 -102 Q 456 -123 471 -164 Q 486 -204 486 -264 L 486 -697 L 587 -697 L 587 -257 Q 587 -124 521 -56 Q 455 13 327 13 Z M 291 -760 L 401 -901 L 506 -901 L 364 -760 Z" }
GLYPHS.M["Ï"] = { 252, "M 75 0 L 75 -697 L 177 -697 L 177 0 Z M 166 -782 L 166 -901 L 277 -901 L 277 -782 Z M -23 -782 L -23 -901 L 88 -901 L 88 -782 Z" }
GLYPHS.M["Ü"] = { 656, "M 327 13 Q 201 13 134 -54 Q 68 -121 68 -252 L 68 -697 L 170 -697 L 170 -264 Q 170 -204 185 -163 Q 200 -122 234 -101 Q 269 -80 327 -80 Q 385 -80 420 -102 Q 456 -123 471 -164 Q 486 -204 486 -264 L 486 -697 L 587 -697 L 587 -257 Q 587 -124 521 -56 Q 455 13 327 13 Z M 368 -782 L 368 -901 L 479 -901 L 479 -782 Z M 179 -782 L 179 -901 L 290 -901 L 290 -782 Z" }
GLYPHS.M["Ñ"] = { 680, "M 75 0 L 75 -697 L 181 -697 L 504 -171 L 504 -697 L 605 -697 L 605 0 L 497 0 L 177 -527 L 177 0 Z M 402 -743 Q 378 -743 362 -750 Q 345 -758 334 -770 Q 322 -781 312 -792 Q 303 -804 293 -812 Q 283 -820 269 -820 Q 252 -820 242 -802 Q 231 -783 231 -749 L 173 -749 Q 173 -809 200 -842 Q 227 -875 274 -875 Q 295 -875 310 -867 Q 326 -859 338 -847 Q 349 -835 359 -824 Q 369 -812 380 -804 Q 390 -796 403 -796 Q 418 -796 429 -816 Q 440 -836 440 -871 L 500 -871 Q 500 -810 474 -776 Q 447 -743 402 -743 Z" }
GLYPHS.M["Ç"] = { 706, "M 340 204 Q 326 204 308 201 Q 291 198 274 190 Q 258 183 246 173 L 276 134 Q 290 144 306 150 Q 323 155 338 155 Q 357 155 371 146 Q 385 138 385 120 Q 385 106 374 98 Q 364 89 347 85 Q 330 81 310 79 Q 291 77 273 77 L 322 10 Q 256 1 202 -32 Q 128 -77 87 -159 Q 46 -241 46 -349 Q 46 -457 87 -538 Q 128 -620 202 -665 Q 275 -710 372 -710 Q 479 -710 558 -657 Q 636 -604 670 -510 L 575 -475 Q 550 -540 498 -576 Q 446 -613 372 -613 Q 304 -613 254 -580 Q 203 -548 176 -490 Q 148 -431 148 -349 Q 148 -267 176 -208 Q 203 -149 254 -116 Q 304 -84 372 -84 Q 446 -84 498 -120 Q 550 -157 575 -222 L 670 -188 Q 636 -95 558 -41 Q 479 13 373 13 L 348 43 Q 388 49 416 67 Q 443 85 443 119 Q 443 159 413 182 Q 383 204 340 204 Z" }
GLYPHS.M["È"] = { 583, "M 75 0 L 75 -697 L 536 -697 L 536 -606 L 177 -606 L 177 -402 L 506 -402 L 506 -311 L 177 -311 L 177 -91 L 536 -91 L 536 0 Z M 269 -760 L 134 -901 L 238 -901 L 342 -760 Z" }
GLYPHS.M["Ø"] = { 748, "M 372 13 Q 275 13 202 -32 Q 193 -37 185 -43 L 154 0 L 85 0 L 143 -79 Q 110 -113 87 -159 Q 46 -240 46 -348 Q 46 -457 87 -538 Q 128 -620 202 -665 Q 275 -710 372 -710 Q 471 -710 545 -665 Q 554 -660 562 -654 L 593 -697 L 661 -697 L 604 -618 Q 637 -584 660 -539 Q 701 -457 701 -348 Q 701 -240 660 -158 Q 618 -77 544 -32 Q 470 13 372 13 Z M 203 -162 L 503 -573 Q 497 -577 492 -581 Q 442 -613 372 -613 Q 304 -613 254 -581 Q 203 -549 176 -490 Q 148 -430 148 -348 Q 148 -267 176 -208 Q 187 -182 203 -162 Z M 372 -84 Q 442 -84 492 -116 Q 542 -149 570 -208 Q 598 -268 598 -348 Q 598 -429 570 -489 Q 558 -514 542 -534 L 243 -123 Q 248 -119 254 -116 Q 304 -84 372 -84 Z" }
GLYPHS.M["’"] = { 265, "M 37 -416 L 119 -697 L 232 -697 L 103 -416 Z" }
GLYPHS.M["“"] = { 445, "M 214 -415 L 341 -697 L 407 -697 L 327 -415 Z M 32 -415 L 161 -697 L 226 -697 L 145 -415 Z" }
GLYPHS.M["”"] = { 446, "M 219 -416 L 301 -697 L 413 -697 L 285 -416 Z M 37 -416 L 119 -697 L 232 -697 L 103 -416 Z" }
GLYPHS.M["…"] = { 676, "M 509 0 L 509 -121 L 611 -121 L 611 0 Z M 65 0 L 65 -121 L 166 -121 L 166 0 Z M 287 0 L 287 -121 L 389 -121 L 389 0 Z" }
GLYPHS.M["—"] = { 1058, "M 24 -264 L 24 -337 L 1034 -337 L 1034 -264 Z" }
GLYPHS.S["á"] = { 544, "M 383 0 L 376 -69 Q 374 -65 371 -62 Q 345 -26 309 -8 Q 273 9 230 9 Q 175 9 132 -11 Q 90 -31 66 -67 Q 43 -103 43 -151 Q 43 -192 60 -222 Q 78 -252 106 -269 Q 130 -284 162 -290 Q 194 -297 229 -297 L 375 -297 L 375 -311 Q 375 -359 346 -384 Q 317 -408 265 -408 Q 225 -408 186 -392 Q 148 -377 116 -345 L 54 -418 Q 102 -463 156 -482 Q 210 -502 274 -502 Q 374 -502 430 -452 Q 485 -401 485 -311 L 485 0 Z M 375 -214 L 245 -214 Q 227 -214 209 -210 Q 191 -207 177 -198 Q 167 -190 160 -178 Q 154 -166 154 -150 Q 154 -118 178 -100 Q 203 -81 244 -81 Q 280 -81 310 -97 Q 339 -113 357 -141 Q 375 -169 375 -204 Z M 234 -555 L 344 -697 L 464 -697 L 315 -555 Z" }
GLYPHS.S["é"] = { 541, "M 281 9 Q 219 9 174 -11 Q 128 -31 99 -67 Q 70 -103 56 -148 Q 42 -194 42 -243 Q 42 -292 56 -338 Q 69 -385 97 -422 Q 125 -459 169 -480 Q 213 -502 273 -502 Q 330 -502 372 -482 Q 415 -463 443 -428 Q 471 -394 484 -350 Q 498 -306 498 -256 Q 498 -249 498 -236 Q 497 -223 495 -210 L 153 -210 Q 157 -151 193 -120 Q 229 -89 285 -89 Q 326 -89 360 -102 Q 394 -115 422 -143 L 483 -69 Q 452 -41 421 -24 Q 390 -7 356 1 Q 323 9 281 9 Z M 392 -292 Q 392 -295 392 -298 Q 392 -320 384 -340 Q 377 -360 362 -376 Q 347 -391 325 -400 Q 303 -410 275 -410 Q 236 -410 210 -393 Q 183 -376 168 -350 Q 154 -323 151 -292 Z M 233 -555 L 343 -697 L 463 -697 L 314 -555 Z" }
GLYPHS.S["í"] = { 239, "M 64 0 L 64 -493 L 175 -493 L 175 0 Z M 78 -555 L 188 -697 L 308 -697 L 159 -555 Z" }
GLYPHS.S["ó"] = { 574, "M 287 9 Q 217 9 161 -24 Q 105 -57 74 -115 Q 42 -173 42 -247 Q 42 -321 74 -379 Q 105 -437 160 -470 Q 216 -502 287 -502 Q 359 -502 414 -470 Q 468 -437 500 -379 Q 532 -321 532 -247 Q 532 -173 500 -115 Q 469 -57 414 -24 Q 358 9 287 9 Z M 288 -89 Q 329 -89 359 -108 Q 389 -127 405 -163 Q 421 -199 421 -247 Q 421 -296 405 -332 Q 389 -367 359 -386 Q 329 -405 288 -405 Q 245 -405 215 -386 Q 185 -366 169 -331 Q 153 -296 153 -247 Q 153 -199 169 -163 Q 185 -127 215 -108 Q 245 -89 288 -89 Z M 246 -555 L 356 -697 L 476 -697 L 327 -555 Z" }
GLYPHS.S["ú"] = { 559, "M 236 9 Q 178 9 138 -14 Q 99 -37 79 -80 Q 59 -123 59 -184 L 59 -493 L 170 -493 L 170 -214 Q 170 -175 180 -146 Q 189 -118 210 -103 Q 232 -88 269 -88 Q 312 -88 336 -110 Q 361 -133 372 -176 Q 382 -220 382 -281 L 382 -493 L 493 -493 L 493 0 L 382 0 L 382 -63 Q 362 -34 335 -17 Q 291 9 236 9 Z M 234 -555 L 344 -697 L 464 -697 L 315 -555 Z" }
GLYPHS.S["ï"] = { 239, "M 64 0 L 64 -493 L 175 -493 L 175 0 Z M 155 -574 L 155 -697 L 277 -697 L 277 -574 Z M -37 -574 L -37 -697 L 84 -697 L 84 -574 Z" }
GLYPHS.S["ü"] = { 559, "M 236 9 Q 178 9 138 -14 Q 99 -37 79 -80 Q 59 -123 59 -184 L 59 -493 L 170 -493 L 170 -214 Q 170 -175 180 -146 Q 189 -118 210 -103 Q 232 -88 269 -88 Q 312 -88 336 -110 Q 361 -133 372 -176 Q 382 -220 382 -281 L 382 -493 L 493 -493 L 493 0 L 382 0 L 382 -63 Q 362 -34 335 -17 Q 291 9 236 9 Z M 310 -574 L 310 -697 L 432 -697 L 432 -574 Z M 118 -574 L 118 -697 L 239 -697 L 239 -574 Z" }
GLYPHS.S["ñ"] = { 559, "M 65 0 L 65 -493 L 176 -493 L 176 -425 Q 184 -438 194 -449 Q 219 -476 252 -489 Q 286 -502 323 -502 Q 406 -502 452 -454 Q 499 -407 499 -319 L 499 0 L 388 0 L 388 -278 Q 388 -344 364 -375 Q 340 -406 290 -406 Q 253 -406 228 -388 Q 202 -371 189 -334 Q 176 -297 176 -240 L 176 0 Z M 336 -559 Q 307 -559 288 -570 Q 269 -581 256 -595 Q 244 -609 232 -620 Q 220 -631 205 -631 Q 190 -631 180 -614 Q 171 -596 171 -563 L 107 -563 Q 107 -628 135 -664 Q 163 -700 211 -700 Q 236 -700 254 -689 Q 272 -678 286 -664 Q 299 -649 311 -638 Q 323 -627 337 -627 Q 351 -627 360 -646 Q 370 -664 370 -697 L 437 -697 Q 437 -631 410 -595 Q 383 -559 336 -559 Z" }
GLYPHS.S["ç"] = { 521, "M 267 204 Q 254 204 236 202 Q 219 199 202 192 Q 186 186 174 176 L 204 131 Q 218 140 234 145 Q 249 150 264 150 Q 281 150 294 142 Q 308 134 308 118 Q 308 104 298 96 Q 288 88 272 84 Q 255 80 236 78 Q 217 76 199 76 L 248 8 Q 208 4 176 -12 Q 131 -32 102 -68 Q 72 -105 57 -151 Q 42 -197 42 -247 Q 42 -297 57 -343 Q 72 -389 102 -425 Q 131 -461 176 -482 Q 220 -502 278 -502 Q 351 -502 406 -467 Q 460 -432 486 -359 L 388 -321 Q 376 -359 349 -382 Q 322 -406 278 -406 Q 234 -406 206 -383 Q 179 -360 166 -324 Q 153 -288 153 -247 Q 153 -206 166 -170 Q 179 -133 206 -110 Q 234 -88 278 -88 Q 322 -88 349 -111 Q 376 -134 388 -172 L 486 -134 Q 460 -62 406 -27 Q 361 3 303 8 L 278 39 Q 319 46 346 64 Q 373 83 373 117 Q 373 157 342 180 Q 312 204 267 204 Z" }
GLYPHS.S["è"] = { 541, "M 281 9 Q 219 9 174 -11 Q 128 -31 99 -67 Q 70 -103 56 -148 Q 42 -194 42 -243 Q 42 -292 56 -338 Q 69 -385 97 -422 Q 125 -459 169 -480 Q 213 -502 273 -502 Q 330 -502 372 -482 Q 415 -463 443 -428 Q 471 -394 484 -350 Q 498 -306 498 -256 Q 498 -249 498 -236 Q 497 -223 495 -210 L 153 -210 Q 157 -151 193 -120 Q 229 -89 285 -89 Q 326 -89 360 -102 Q 394 -115 422 -143 L 483 -69 Q 452 -41 421 -24 Q 390 -7 356 1 Q 323 9 281 9 Z M 392 -292 Q 392 -295 392 -298 Q 392 -320 384 -340 Q 377 -360 362 -376 Q 347 -391 325 -400 Q 303 -410 275 -410 Q 236 -410 210 -393 Q 183 -376 168 -350 Q 154 -323 151 -292 Z M 232 -555 L 93 -697 L 211 -697 L 315 -555 Z" }
GLYPHS.S["à"] = { 544, "M 383 0 L 376 -69 Q 374 -65 371 -62 Q 345 -26 309 -8 Q 273 9 230 9 Q 175 9 132 -11 Q 90 -31 66 -67 Q 43 -103 43 -151 Q 43 -192 60 -222 Q 78 -252 106 -269 Q 130 -284 162 -290 Q 194 -297 229 -297 L 375 -297 L 375 -311 Q 375 -359 346 -384 Q 317 -408 265 -408 Q 225 -408 186 -392 Q 148 -377 116 -345 L 54 -418 Q 102 -463 156 -482 Q 210 -502 274 -502 Q 374 -502 430 -452 Q 485 -401 485 -311 L 485 0 Z M 375 -214 L 245 -214 Q 227 -214 209 -210 Q 191 -207 177 -198 Q 167 -190 160 -178 Q 154 -166 154 -150 Q 154 -118 178 -100 Q 203 -81 244 -81 Q 280 -81 310 -97 Q 339 -113 357 -141 Q 375 -169 375 -204 Z M 233 -555 L 94 -697 L 212 -697 L 316 -555 Z" }
GLYPHS.S["â"] = { 544, "M 383 0 L 376 -69 Q 374 -65 371 -62 Q 345 -26 309 -8 Q 273 9 230 9 Q 175 9 132 -11 Q 90 -31 66 -67 Q 43 -103 43 -151 Q 43 -192 60 -222 Q 78 -252 106 -269 Q 130 -284 162 -290 Q 194 -297 229 -297 L 375 -297 L 375 -311 Q 375 -359 346 -384 Q 317 -408 265 -408 Q 225 -408 186 -392 Q 148 -377 116 -345 L 54 -418 Q 102 -463 156 -482 Q 210 -502 274 -502 Q 374 -502 430 -452 Q 485 -401 485 -311 L 485 0 Z M 375 -214 L 245 -214 Q 227 -214 209 -210 Q 191 -207 177 -198 Q 167 -190 160 -178 Q 154 -166 154 -150 Q 154 -118 178 -100 Q 203 -81 244 -81 Q 280 -81 310 -97 Q 339 -113 357 -141 Q 375 -169 375 -204 Z M 120 -543 L 274 -713 L 429 -543 L 340 -543 L 274 -619 L 209 -543 Z" }
GLYPHS.S["ê"] = { 541, "M 281 9 Q 219 9 174 -11 Q 128 -31 99 -67 Q 70 -103 56 -148 Q 42 -194 42 -243 Q 42 -292 56 -338 Q 69 -385 97 -422 Q 125 -459 169 -480 Q 213 -502 273 -502 Q 330 -502 372 -482 Q 415 -463 443 -428 Q 471 -394 484 -350 Q 498 -306 498 -256 Q 498 -249 498 -236 Q 497 -223 495 -210 L 153 -210 Q 157 -151 193 -120 Q 229 -89 285 -89 Q 326 -89 360 -102 Q 394 -115 422 -143 L 483 -69 Q 452 -41 421 -24 Q 390 -7 356 1 Q 323 9 281 9 Z M 392 -292 Q 392 -295 392 -298 Q 392 -320 384 -340 Q 377 -360 362 -376 Q 347 -391 325 -400 Q 303 -410 275 -410 Q 236 -410 210 -393 Q 183 -376 168 -350 Q 154 -323 151 -292 Z M 119 -543 L 273 -713 L 428 -543 L 339 -543 L 273 -619 L 208 -543 Z" }
GLYPHS.S["ô"] = { 574, "M 287 9 Q 217 9 161 -24 Q 105 -57 74 -115 Q 42 -173 42 -247 Q 42 -321 74 -379 Q 105 -437 160 -470 Q 216 -502 287 -502 Q 359 -502 414 -470 Q 468 -437 500 -379 Q 532 -321 532 -247 Q 532 -173 500 -115 Q 469 -57 414 -24 Q 358 9 287 9 Z M 288 -89 Q 329 -89 359 -108 Q 389 -127 405 -163 Q 421 -199 421 -247 Q 421 -296 405 -332 Q 389 -367 359 -386 Q 329 -405 288 -405 Q 245 -405 215 -386 Q 185 -366 169 -331 Q 153 -296 153 -247 Q 153 -199 169 -163 Q 185 -127 215 -108 Q 245 -89 288 -89 Z M 133 -543 L 287 -713 L 442 -543 L 353 -543 L 287 -619 L 222 -543 Z" }
GLYPHS.S["ø"] = { 574, "M 287 9 Q 225 9 174 -17 L 137 44 L 83 44 L 135 -42 Q 97 -71 74 -115 Q 42 -173 42 -247 Q 42 -321 74 -379 Q 105 -437 160 -470 Q 216 -502 287 -502 Q 350 -502 399 -477 L 436 -538 L 491 -538 L 439 -452 Q 476 -423 500 -379 Q 532 -321 532 -247 Q 532 -173 500 -115 Q 469 -57 414 -24 Q 358 9 287 9 Z M 288 -89 Q 329 -89 359 -108 Q 389 -127 405 -163 Q 421 -199 421 -247 Q 421 -296 405 -332 Q 397 -350 385 -364 L 226 -102 Q 252 -89 288 -89 Z M 189 -131 L 348 -392 Q 321 -405 288 -405 Q 245 -405 215 -386 Q 185 -366 169 -331 Q 153 -296 153 -247 Q 153 -199 169 -163 Q 177 -145 189 -131 Z" }
GLYPHS.S["ą"] = { 544, "M 383 0 L 376 -69 Q 374 -65 371 -62 Q 345 -26 309 -8 Q 273 9 230 9 Q 175 9 132 -11 Q 90 -31 66 -67 Q 43 -103 43 -151 Q 43 -192 60 -222 Q 78 -252 106 -269 Q 130 -284 162 -290 Q 194 -297 229 -297 L 375 -297 L 375 -311 Q 375 -359 346 -384 Q 317 -408 265 -408 Q 225 -408 186 -392 Q 148 -377 116 -345 L 54 -418 Q 102 -463 156 -482 Q 210 -502 274 -502 Q 374 -502 430 -452 Q 485 -401 485 -311 L 485 0 Q 473 5 456 15 Q 438 25 421 38 Q 404 52 392 69 Q 381 86 381 104 Q 381 123 393 133 Q 405 143 422 143 Q 437 143 454 135 Q 471 127 487 111 L 525 153 Q 505 177 478 190 Q 452 204 419 204 Q 376 204 346 180 Q 315 156 315 114 Q 315 85 328 62 Q 342 40 361 24 Q 379 9 395 0 Z M 375 -214 L 245 -214 Q 227 -214 209 -210 Q 191 -207 177 -198 Q 167 -190 160 -178 Q 154 -166 154 -150 Q 154 -118 178 -100 Q 203 -81 244 -81 Q 280 -81 310 -97 Q 339 -113 357 -141 Q 375 -169 375 -204 Z" }
GLYPHS.S["ł"] = { 261, "M 174 9 Q 126 9 94 -20 Q 62 -50 62 -115 L 62 -263 L 10 -223 L 10 -329 L 62 -368 L 62 -697 L 173 -697 L 173 -453 L 250 -511 L 250 -406 L 173 -347 L 173 -137 Q 173 -114 184 -104 Q 194 -93 211 -93 Q 220 -93 230 -95 Q 239 -97 249 -100 L 249 -6 Q 230 2 210 6 Q 190 9 174 9 Z" }
GLYPHS.S["ń"] = { 559, "M 65 0 L 65 -493 L 176 -493 L 176 -425 Q 184 -438 194 -449 Q 219 -476 252 -489 Q 286 -502 323 -502 Q 406 -502 452 -454 Q 499 -407 499 -319 L 499 0 L 388 0 L 388 -278 Q 388 -344 364 -375 Q 340 -406 290 -406 Q 253 -406 228 -388 Q 202 -371 189 -334 Q 176 -297 176 -240 L 176 0 Z M 232 -555 L 342 -697 L 462 -697 L 313 -555 Z" }
GLYPHS.S["ś"] = { 471, "M 233 9 Q 180 9 139 -6 Q 98 -22 70 -46 Q 42 -70 24 -94 L 100 -160 Q 119 -129 152 -105 Q 186 -81 234 -81 Q 274 -81 298 -98 Q 321 -115 321 -140 Q 321 -162 306 -174 Q 291 -187 267 -196 Q 243 -205 214 -212 Q 186 -219 157 -230 Q 128 -240 104 -256 Q 79 -272 64 -297 Q 49 -322 49 -359 Q 49 -424 99 -463 Q 149 -502 230 -502 Q 288 -502 336 -479 Q 384 -456 411 -410 L 342 -357 Q 322 -387 292 -402 Q 262 -417 227 -417 Q 195 -417 174 -404 Q 152 -391 152 -370 Q 152 -354 162 -344 Q 172 -334 193 -326 Q 214 -318 246 -310 Q 276 -303 308 -293 Q 340 -283 368 -266 Q 395 -250 412 -222 Q 430 -195 430 -152 Q 430 -104 406 -68 Q 381 -31 336 -11 Q 292 9 233 9 Z M 193 -555 L 303 -697 L 423 -697 L 274 -555 Z" }
GLYPHS.S["ź"] = { 471, "M 35 0 L 35 -75 L 299 -402 L 47 -402 L 47 -493 L 432 -493 L 432 -413 L 178 -92 L 431 -92 L 431 0 Z M 196 -555 L 306 -697 L 426 -697 L 277 -555 Z" }
GLYPHS.S["ć"] = { 521, "M 278 9 Q 220 9 176 -12 Q 131 -32 102 -68 Q 72 -105 57 -151 Q 42 -197 42 -247 Q 42 -297 57 -343 Q 72 -389 102 -425 Q 131 -461 176 -482 Q 220 -502 278 -502 Q 351 -502 406 -467 Q 460 -432 486 -359 L 388 -321 Q 376 -359 349 -382 Q 322 -406 278 -406 Q 234 -406 206 -383 Q 179 -360 166 -324 Q 153 -288 153 -247 Q 153 -206 166 -170 Q 179 -133 206 -110 Q 234 -88 278 -88 Q 322 -88 349 -111 Q 376 -134 388 -172 L 486 -134 Q 460 -62 406 -26 Q 351 9 278 9 Z M 224 -555 L 334 -697 L 454 -697 L 305 -555 Z" }
GLYPHS.S["ż"] = { 471, "M 35 0 L 35 -75 L 299 -402 L 47 -402 L 47 -493 L 432 -493 L 432 -413 L 178 -92 L 431 -92 L 431 0 Z M 176 -574 L 176 -697 L 297 -697 L 297 -574 Z" }
GLYPHS.S["š"] = { 471, "M 233 9 Q 180 9 139 -6 Q 98 -22 70 -46 Q 42 -70 24 -94 L 100 -160 Q 119 -129 152 -105 Q 186 -81 234 -81 Q 274 -81 298 -98 Q 321 -115 321 -140 Q 321 -162 306 -174 Q 291 -187 267 -196 Q 243 -205 214 -212 Q 186 -219 157 -230 Q 128 -240 104 -256 Q 79 -272 64 -297 Q 49 -322 49 -359 Q 49 -424 99 -463 Q 149 -502 230 -502 Q 288 -502 336 -479 Q 384 -456 411 -410 L 342 -357 Q 322 -387 292 -402 Q 262 -417 227 -417 Q 195 -417 174 -404 Q 152 -391 152 -370 Q 152 -354 162 -344 Q 172 -334 193 -326 Q 214 -318 246 -310 Q 276 -303 308 -293 Q 340 -283 368 -266 Q 395 -250 412 -222 Q 430 -195 430 -152 Q 430 -104 406 -68 Q 381 -31 336 -11 Q 292 9 233 9 Z M 234 -535 L 80 -697 L 166 -697 L 234 -621 L 303 -697 L 389 -697 Z" }
GLYPHS.S["ž"] = { 471, "M 35 0 L 35 -75 L 299 -402 L 47 -402 L 47 -493 L 432 -493 L 432 -413 L 178 -92 L 431 -92 L 431 0 Z M 236 -535 L 82 -697 L 168 -697 L 236 -621 L 305 -697 L 391 -697 Z" }
GLYPHS.S["ő"] = { 574, "M 287 9 Q 217 9 161 -24 Q 105 -57 74 -115 Q 42 -173 42 -247 Q 42 -321 74 -379 Q 105 -437 160 -470 Q 216 -502 287 -502 Q 359 -502 414 -470 Q 468 -437 500 -379 Q 532 -321 532 -247 Q 532 -173 500 -115 Q 469 -57 414 -24 Q 358 9 287 9 Z M 288 -89 Q 329 -89 359 -108 Q 389 -127 405 -163 Q 421 -199 421 -247 Q 421 -296 405 -332 Q 389 -367 359 -386 Q 329 -405 288 -405 Q 245 -405 215 -386 Q 185 -366 169 -331 Q 153 -296 153 -247 Q 153 -199 169 -163 Q 185 -127 215 -108 Q 245 -89 288 -89 Z M 340 -536 L 452 -697 L 570 -697 L 422 -536 Z M 153 -536 L 263 -697 L 364 -697 L 234 -536 Z" }
GLYPHS.S["ř"] = { 420, "M 65 0 L 65 -493 L 177 -493 L 177 -421 Q 181 -427 185 -433 Q 209 -465 244 -484 Q 278 -502 312 -502 Q 336 -502 358 -496 Q 380 -490 404 -476 L 350 -376 Q 339 -383 322 -388 Q 304 -392 288 -392 Q 267 -392 246 -384 Q 226 -376 210 -360 Q 194 -343 186 -317 Q 181 -303 178 -280 Q 176 -258 176 -218 L 176 0 Z M 194 -535 L 40 -697 L 126 -697 L 194 -621 L 263 -697 L 349 -697 Z" }
GLYPHS.S["ė"] = { 541, "M 281 9 Q 219 9 174 -11 Q 128 -31 99 -67 Q 70 -103 56 -148 Q 42 -194 42 -243 Q 42 -292 56 -338 Q 69 -385 97 -422 Q 125 -459 169 -480 Q 213 -502 273 -502 Q 330 -502 372 -482 Q 415 -463 443 -428 Q 471 -394 484 -350 Q 498 -306 498 -256 Q 498 -249 498 -236 Q 497 -223 495 -210 L 153 -210 Q 157 -151 193 -120 Q 229 -89 285 -89 Q 326 -89 360 -102 Q 394 -115 422 -143 L 483 -69 Q 452 -41 421 -24 Q 390 -7 356 1 Q 323 9 281 9 Z M 392 -292 Q 392 -295 392 -298 Q 392 -320 384 -340 Q 377 -360 362 -376 Q 347 -391 325 -400 Q 303 -410 275 -410 Q 236 -410 210 -393 Q 183 -376 168 -350 Q 154 -323 151 -292 Z M 213 -574 L 213 -697 L 334 -697 L 334 -574 Z" }
GLYPHS.S["Á"] = { 661, "M 11 0 L 287 -697 L 375 -697 L 650 0 L 524 0 L 471 -146 L 191 -146 L 138 0 Z M 433 -249 L 331 -528 L 229 -249 Z M 290 -759 L 400 -901 L 520 -901 L 371 -759 Z" }
GLYPHS.S["É"] = { 580, "M 71 0 L 71 -697 L 534 -697 L 534 -594 L 187 -594 L 187 -409 L 507 -409 L 507 -305 L 187 -305 L 187 -103 L 534 -103 L 534 0 Z M 262 -759 L 372 -901 L 492 -901 L 343 -759 Z" }
GLYPHS.S["Í"] = { 258, "M 71 0 L 71 -697 L 187 -697 L 187 0 Z M 89 -759 L 199 -901 L 319 -901 L 170 -759 Z" }
GLYPHS.S["Ó"] = { 748, "M 372 14 Q 274 14 200 -31 Q 126 -76 84 -158 Q 43 -240 43 -348 Q 43 -457 84 -539 Q 126 -621 200 -666 Q 274 -711 372 -711 Q 472 -711 546 -666 Q 621 -621 662 -540 Q 704 -458 704 -348 Q 704 -239 662 -158 Q 620 -76 546 -31 Q 471 14 372 14 Z M 372 -96 Q 439 -96 487 -127 Q 535 -158 562 -214 Q 588 -271 588 -348 Q 588 -426 562 -482 Q 535 -539 487 -570 Q 439 -601 372 -601 Q 307 -601 259 -570 Q 211 -540 184 -484 Q 158 -427 158 -348 Q 158 -270 184 -214 Q 210 -157 258 -126 Q 307 -96 372 -96 Z M 332 -759 L 442 -901 L 562 -901 L 413 -759 Z" }
GLYPHS.S["Ú"] = { 657, "M 328 14 Q 199 14 132 -53 Q 64 -120 64 -252 L 64 -697 L 180 -697 L 180 -265 Q 180 -208 194 -170 Q 207 -131 240 -112 Q 272 -92 328 -92 Q 384 -92 416 -112 Q 449 -132 463 -170 Q 477 -208 477 -265 L 477 -697 L 592 -697 L 592 -257 Q 592 -122 525 -54 Q 458 14 328 14 Z M 288 -759 L 398 -901 L 518 -901 L 369 -759 Z" }
GLYPHS.S["Ï"] = { 258, "M 71 0 L 71 -697 L 187 -697 L 187 0 Z M 165 -778 L 165 -901 L 287 -901 L 287 -778 Z M -27 -778 L -27 -901 L 94 -901 L 94 -778 Z" }
GLYPHS.S["Ü"] = { 657, "M 328 14 Q 199 14 132 -53 Q 64 -120 64 -252 L 64 -697 L 180 -697 L 180 -265 Q 180 -208 194 -170 Q 207 -131 240 -112 Q 272 -92 328 -92 Q 384 -92 416 -112 Q 449 -132 463 -170 Q 477 -208 477 -265 L 477 -697 L 592 -697 L 592 -257 Q 592 -122 525 -54 Q 458 14 328 14 Z M 364 -778 L 364 -901 L 486 -901 L 486 -778 Z M 172 -778 L 172 -901 L 293 -901 L 293 -778 Z" }
GLYPHS.S["Ñ"] = { 685, "M 71 0 L 71 -697 L 191 -697 L 498 -198 L 498 -697 L 614 -697 L 614 0 L 492 0 L 187 -501 L 187 0 Z M 404 -742 Q 380 -742 364 -749 Q 347 -756 336 -767 Q 324 -778 314 -788 Q 305 -799 296 -806 Q 286 -813 273 -813 Q 258 -813 248 -796 Q 239 -779 239 -747 L 175 -747 Q 175 -808 203 -841 Q 231 -874 279 -874 Q 299 -874 314 -867 Q 330 -860 342 -849 Q 354 -838 364 -828 Q 374 -817 384 -810 Q 394 -802 405 -802 Q 419 -802 428 -820 Q 438 -839 438 -871 L 505 -871 Q 505 -809 478 -776 Q 451 -742 404 -742 Z" }
GLYPHS.S["Ç"] = { 708, "M 372 14 Q 371 14 369 14 L 349 39 Q 390 46 417 64 Q 444 83 444 117 Q 444 157 414 180 Q 383 204 338 204 Q 325 204 308 202 Q 290 199 274 192 Q 257 186 245 176 L 275 131 Q 289 140 304 145 Q 320 150 335 150 Q 352 150 366 142 Q 379 134 379 118 Q 379 104 369 96 Q 359 88 342 84 Q 326 80 307 78 Q 288 76 270 76 L 317 10 Q 253 1 200 -31 Q 126 -76 84 -158 Q 43 -240 43 -349 Q 43 -458 84 -540 Q 126 -621 200 -666 Q 274 -711 372 -711 Q 481 -711 560 -657 Q 640 -603 675 -507 L 567 -468 Q 543 -531 493 -566 Q 443 -601 372 -601 Q 307 -601 259 -570 Q 211 -539 184 -483 Q 158 -427 158 -349 Q 158 -271 184 -214 Q 211 -158 259 -127 Q 307 -96 372 -96 Q 443 -96 493 -132 Q 543 -167 567 -229 L 675 -190 Q 640 -96 560 -41 Q 481 14 372 14 Z" }
GLYPHS.S["È"] = { 580, "M 71 0 L 71 -697 L 534 -697 L 534 -594 L 187 -594 L 187 -409 L 507 -409 L 507 -305 L 187 -305 L 187 -103 L 534 -103 L 534 0 Z M 261 -759 L 122 -901 L 240 -901 L 344 -759 Z" }
GLYPHS.S["Ø"] = { 748, "M 372 14 Q 274 14 200 -31 Q 192 -36 184 -41 L 154 0 L 77 0 L 138 -82 Q 106 -115 85 -158 Q 43 -240 43 -348 Q 43 -457 84 -539 Q 126 -621 200 -666 Q 274 -711 372 -711 Q 472 -711 547 -666 Q 555 -661 563 -655 L 594 -697 L 670 -697 L 610 -615 Q 641 -582 663 -540 Q 704 -458 704 -348 Q 704 -239 662 -158 Q 620 -76 546 -31 Q 471 14 372 14 Z M 207 -175 L 495 -564 Q 491 -567 487 -570 Q 439 -601 372 -601 Q 307 -601 259 -570 Q 211 -540 184 -484 Q 158 -427 158 -348 Q 158 -270 184 -214 Q 194 -192 207 -175 Z M 372 -96 Q 439 -96 487 -127 Q 535 -158 562 -214 Q 588 -271 588 -348 Q 588 -426 562 -483 Q 552 -503 539 -520 L 251 -131 Q 255 -129 259 -127 Q 307 -96 372 -96 Z" }
GLYPHS.S["’"] = { 268, "M 36 -417 L 108 -697 L 237 -697 L 109 -417 Z" }


-- extra glyphs (Hanken Grotesk): accented letters for every squad + bold capitals
GLYPHS.R["ã"] = { 540, "M 396 0 L 390 -99 L 390 -309 Q 390 -366 358 -397 Q 327 -428 265 -428 Q 225 -428 190 -412 Q 155 -395 122 -356 L 61 -408 Q 102 -456 155 -478 Q 208 -501 271 -501 Q 368 -501 421 -451 Q 474 -401 474 -309 L 474 0 Z M 233 8 Q 177 8 136 -12 Q 94 -31 72 -66 Q 49 -101 49 -147 Q 49 -188 66 -216 Q 82 -245 108 -261 Q 134 -278 168 -284 Q 201 -291 238 -291 L 398 -291 L 398 -227 L 250 -227 Q 228 -227 204 -223 Q 180 -219 162 -206 Q 149 -196 142 -181 Q 134 -166 134 -146 Q 134 -107 163 -84 Q 192 -61 241 -61 Q 282 -61 316 -80 Q 349 -99 370 -132 Q 390 -166 390 -208 L 425 -172 Q 419 -119 393 -78 Q 367 -37 326 -14 Q 286 8 233 8 Z M 340 -567 Q 310 -567 292 -579 Q 273 -591 260 -607 Q 248 -623 236 -635 Q 223 -647 205 -647 Q 186 -647 174 -628 Q 162 -608 162 -573 L 112 -573 Q 112 -634 138 -668 Q 164 -701 209 -701 Q 236 -701 254 -688 Q 271 -676 284 -660 Q 297 -644 310 -632 Q 323 -619 341 -619 Q 358 -619 370 -640 Q 382 -661 382 -697 L 434 -697 Q 434 -636 408 -602 Q 383 -567 340 -567 Z" }
GLYPHS.R["ö"] = { 577, "M 289 8 Q 220 8 166 -24 Q 111 -57 80 -115 Q 49 -173 49 -247 Q 49 -321 80 -378 Q 110 -436 164 -468 Q 219 -501 289 -501 Q 359 -501 412 -468 Q 466 -436 497 -378 Q 528 -321 528 -247 Q 528 -173 497 -116 Q 466 -58 412 -25 Q 358 8 289 8 Z M 289 -67 Q 336 -67 370 -90 Q 405 -112 424 -152 Q 443 -193 443 -247 Q 443 -302 424 -342 Q 405 -383 370 -405 Q 336 -427 289 -427 Q 241 -427 206 -404 Q 171 -382 152 -342 Q 133 -302 133 -247 Q 133 -193 152 -152 Q 171 -112 206 -90 Q 241 -67 289 -67 Z M 332 -582 L 332 -697 L 432 -697 L 432 -582 Z M 147 -582 L 147 -697 L 247 -697 L 247 -582 Z" }
GLYPHS.R["ä"] = { 540, "M 396 0 L 390 -99 L 390 -309 Q 390 -366 358 -397 Q 327 -428 265 -428 Q 225 -428 190 -412 Q 155 -395 122 -356 L 61 -408 Q 102 -456 155 -478 Q 208 -501 271 -501 Q 368 -501 421 -451 Q 474 -401 474 -309 L 474 0 Z M 233 8 Q 177 8 136 -12 Q 94 -31 72 -66 Q 49 -101 49 -147 Q 49 -188 66 -216 Q 82 -245 108 -261 Q 134 -278 168 -284 Q 201 -291 238 -291 L 398 -291 L 398 -227 L 250 -227 Q 228 -227 204 -223 Q 180 -219 162 -206 Q 149 -196 142 -181 Q 134 -166 134 -146 Q 134 -107 163 -84 Q 192 -61 241 -61 Q 282 -61 316 -80 Q 349 -99 370 -132 Q 390 -166 390 -208 L 425 -172 Q 419 -119 393 -78 Q 367 -37 326 -14 Q 286 8 233 8 Z M 317 -582 L 317 -697 L 417 -697 L 417 -582 Z M 132 -582 L 132 -697 L 232 -697 L 232 -582 Z" }
GLYPHS.R["ß"] = { 634, "M 415 8 Q 366 8 324 -10 Q 283 -27 254 -57 Q 225 -87 212 -124 L 280 -155 Q 290 -130 308 -109 Q 325 -88 352 -76 Q 379 -63 414 -63 Q 462 -63 488 -84 Q 513 -106 513 -138 Q 513 -164 498 -180 Q 483 -195 459 -204 Q 435 -214 406 -222 Q 377 -229 348 -238 Q 318 -247 294 -262 Q 270 -277 255 -301 Q 240 -325 240 -362 Q 240 -402 255 -426 Q 270 -451 294 -465 Q 317 -479 343 -488 Q 369 -497 392 -505 Q 416 -513 431 -525 Q 446 -537 446 -558 Q 446 -580 428 -595 Q 411 -610 384 -618 Q 356 -626 326 -626 Q 276 -626 244 -614 Q 213 -603 196 -584 Q 178 -565 170 -542 Q 163 -520 162 -498 Q 160 -476 160 -459 L 160 0 L 72 0 L 72 -459 Q 72 -505 82 -548 Q 92 -592 118 -628 Q 144 -663 193 -684 Q 242 -705 320 -705 Q 381 -705 428 -688 Q 475 -671 502 -638 Q 529 -606 529 -560 Q 529 -524 514 -501 Q 499 -478 476 -464 Q 452 -450 426 -440 Q 400 -431 376 -422 Q 353 -412 338 -398 Q 323 -385 323 -362 Q 323 -341 338 -329 Q 353 -317 377 -310 Q 401 -302 430 -295 Q 460 -288 489 -278 Q 518 -269 542 -254 Q 566 -238 581 -212 Q 596 -186 596 -146 Q 596 -107 581 -78 Q 566 -49 540 -30 Q 515 -11 482 -2 Q 450 8 415 8 Z" }
GLYPHS.R["ę"] = { 540, "M 280 8 Q 222 8 178 -12 Q 135 -31 106 -66 Q 78 -101 64 -146 Q 49 -192 49 -243 Q 49 -294 63 -340 Q 77 -387 104 -423 Q 132 -459 174 -480 Q 216 -501 272 -501 Q 329 -501 370 -482 Q 412 -462 438 -428 Q 465 -394 478 -352 Q 491 -310 491 -265 Q 491 -261 490 -246 Q 490 -232 488 -221 L 133 -221 Q 136 -149 175 -109 Q 214 -69 281 -69 Q 324 -69 356 -83 Q 388 -97 416 -128 L 475 -76 Q 448 -47 418 -28 Q 388 -10 354 -1 Q 321 8 280 8 Z M 407 -264 Q 409 -272 410 -280 Q 410 -288 410 -296 Q 410 -320 402 -344 Q 393 -368 376 -388 Q 360 -407 334 -418 Q 309 -430 274 -430 Q 231 -430 200 -410 Q 169 -390 152 -357 Q 135 -324 132 -284 L 435 -284 Z M 284 204 Q 247 204 220 182 Q 193 161 193 121 Q 193 92 206 68 Q 220 45 240 27 Q 260 9 280 -2 L 347 0 Q 332 8 314 20 Q 297 31 280 46 Q 264 60 254 78 Q 244 95 244 114 Q 244 134 256 144 Q 267 154 284 154 Q 300 154 319 146 Q 338 137 356 121 L 382 161 Q 360 183 334 194 Q 309 204 284 204 Z" }
GLYPHS.R["ë"] = { 540, "M 280 8 Q 222 8 178 -12 Q 135 -31 106 -66 Q 78 -101 64 -146 Q 49 -192 49 -243 Q 49 -294 63 -340 Q 77 -387 104 -423 Q 132 -459 174 -480 Q 216 -501 272 -501 Q 329 -501 370 -482 Q 412 -462 438 -428 Q 465 -394 478 -352 Q 491 -310 491 -265 Q 491 -261 490 -246 Q 490 -232 488 -221 L 133 -221 Q 136 -149 175 -109 Q 214 -69 281 -69 Q 324 -69 356 -83 Q 388 -97 416 -128 L 475 -76 Q 448 -47 418 -28 Q 388 -10 354 -1 Q 321 8 280 8 Z M 407 -264 Q 409 -272 410 -280 Q 410 -288 410 -296 Q 410 -320 402 -344 Q 393 -368 376 -388 Q 360 -407 334 -418 Q 309 -430 274 -430 Q 231 -430 200 -410 Q 169 -390 152 -357 Q 135 -324 132 -284 L 435 -284 Z M 316 -582 L 316 -697 L 416 -697 L 416 -582 Z M 131 -582 L 131 -697 L 231 -697 L 231 -582 Z" }
GLYPHS.R["ò"] = { 577, "M 289 8 Q 220 8 166 -24 Q 111 -57 80 -115 Q 49 -173 49 -247 Q 49 -321 80 -378 Q 110 -436 164 -468 Q 219 -501 289 -501 Q 359 -501 412 -468 Q 466 -436 497 -378 Q 528 -321 528 -247 Q 528 -173 497 -116 Q 466 -58 412 -25 Q 358 8 289 8 Z M 289 -67 Q 336 -67 370 -90 Q 405 -112 424 -152 Q 443 -193 443 -247 Q 443 -302 424 -342 Q 405 -383 370 -405 Q 336 -427 289 -427 Q 241 -427 206 -404 Q 171 -382 152 -342 Q 133 -302 133 -247 Q 133 -193 152 -152 Q 171 -112 206 -90 Q 241 -67 289 -67 Z M 257 -556 L 127 -697 L 217 -697 L 321 -556 Z" }
GLYPHS.R["õ"] = { 577, "M 289 8 Q 220 8 166 -24 Q 111 -57 80 -115 Q 49 -173 49 -247 Q 49 -321 80 -378 Q 110 -436 164 -468 Q 219 -501 289 -501 Q 359 -501 412 -468 Q 466 -436 497 -378 Q 528 -321 528 -247 Q 528 -173 497 -116 Q 466 -58 412 -25 Q 358 8 289 8 Z M 289 -67 Q 336 -67 370 -90 Q 405 -112 424 -152 Q 443 -193 443 -247 Q 443 -302 424 -342 Q 405 -383 370 -405 Q 336 -427 289 -427 Q 241 -427 206 -404 Q 171 -382 152 -342 Q 133 -302 133 -247 Q 133 -193 152 -152 Q 171 -112 206 -90 Q 241 -67 289 -67 Z M 355 -567 Q 325 -567 306 -579 Q 288 -591 276 -607 Q 263 -623 250 -635 Q 238 -647 220 -647 Q 201 -647 189 -628 Q 177 -608 177 -573 L 127 -573 Q 127 -634 153 -668 Q 179 -701 224 -701 Q 251 -701 268 -688 Q 286 -676 299 -660 Q 312 -644 325 -632 Q 338 -619 356 -619 Q 373 -619 385 -640 Q 397 -661 397 -697 L 449 -697 Q 449 -636 424 -602 Q 398 -567 355 -567 Z" }
GLYPHS.R["Ã"] = { 637, "M 17 0 L 283 -697 L 353 -697 L 619 0 L 523 0 L 319 -571 L 114 0 Z M 165 -164 L 192 -243 L 444 -243 L 473 -164 Z M 385 -743 Q 361 -743 344 -752 Q 328 -760 316 -772 Q 305 -785 296 -798 Q 286 -810 276 -818 Q 265 -827 250 -827 Q 231 -827 219 -807 Q 207 -787 207 -751 L 157 -751 Q 157 -810 183 -842 Q 209 -875 254 -875 Q 276 -875 291 -866 Q 306 -858 318 -845 Q 329 -832 339 -820 Q 349 -807 360 -798 Q 371 -790 386 -790 Q 403 -790 415 -812 Q 427 -834 427 -871 L 479 -871 Q 479 -811 454 -777 Q 428 -743 385 -743 Z" }
GLYPHS.R["Ö"] = { 748, "M 372 12 Q 276 12 204 -33 Q 131 -78 90 -159 Q 50 -240 50 -348 Q 50 -457 90 -538 Q 131 -619 204 -664 Q 276 -709 372 -709 Q 470 -709 543 -664 Q 616 -619 656 -538 Q 697 -457 697 -348 Q 697 -240 656 -159 Q 615 -78 542 -33 Q 469 12 372 12 Z M 372 -72 Q 445 -72 498 -106 Q 550 -140 579 -202 Q 608 -264 608 -348 Q 608 -433 579 -495 Q 550 -557 498 -591 Q 445 -625 372 -625 Q 301 -625 248 -592 Q 195 -558 166 -496 Q 138 -434 138 -348 Q 138 -263 166 -201 Q 195 -139 248 -106 Q 301 -72 372 -72 Z M 416 -786 L 416 -901 L 516 -901 L 516 -786 Z M 231 -786 L 231 -901 L 331 -901 L 331 -786 Z" }
GLYPHS.R["Ä"] = { 637, "M 17 0 L 283 -697 L 353 -697 L 619 0 L 523 0 L 319 -571 L 114 0 Z M 165 -164 L 192 -243 L 444 -243 L 473 -164 Z M 362 -786 L 362 -901 L 462 -901 L 462 -786 Z M 177 -786 L 177 -901 L 277 -901 L 277 -786 Z" }
GLYPHS.R["Ò"] = { 748, "M 372 12 Q 276 12 204 -33 Q 131 -78 90 -159 Q 50 -240 50 -348 Q 50 -457 90 -538 Q 131 -619 204 -664 Q 276 -709 372 -709 Q 470 -709 543 -664 Q 616 -619 656 -538 Q 697 -457 697 -348 Q 697 -240 656 -159 Q 615 -78 542 -33 Q 469 12 372 12 Z M 372 -72 Q 445 -72 498 -106 Q 550 -140 579 -202 Q 608 -264 608 -348 Q 608 -433 579 -495 Q 550 -557 498 -591 Q 445 -625 372 -625 Q 301 -625 248 -592 Q 195 -558 166 -496 Q 138 -434 138 -348 Q 138 -263 166 -201 Q 195 -139 248 -106 Q 301 -72 372 -72 Z M 341 -760 L 211 -901 L 301 -901 L 405 -760 Z" }
GLYPHS.R["Ë"] = { 585, "M 79 0 L 79 -697 L 538 -697 L 538 -618 L 167 -618 L 167 -395 L 504 -395 L 504 -316 L 167 -316 L 167 -79 L 538 -79 L 538 0 Z M 352 -786 L 352 -901 L 452 -901 L 452 -786 Z M 167 -786 L 167 -901 L 267 -901 L 267 -786 Z" }
GLYPHS.R["Ê"] = { 585, "M 79 0 L 79 -697 L 538 -697 L 538 -618 L 167 -618 L 167 -395 L 504 -395 L 504 -316 L 167 -316 L 167 -79 L 538 -79 L 538 0 Z M 158 -751 L 309 -913 L 460 -751 L 390 -751 L 309 -840 L 229 -751 Z" }
GLYPHS.R["Ł"] = { 495, "M 79 0 L 79 -697 L 167 -697 L 167 -79 L 479 -79 L 479 0 Z M 14 -189 L 13 -277 L 307 -509 L 307 -422 Z" }
GLYPHS.R["Ś"] = { 564, "M 292 11 Q 187 11 120 -44 Q 53 -99 38 -190 L 124 -211 Q 135 -141 182 -104 Q 228 -68 295 -68 Q 334 -68 365 -83 Q 396 -98 414 -126 Q 432 -153 432 -188 Q 432 -225 412 -249 Q 392 -273 356 -291 Q 321 -309 274 -327 Q 216 -349 172 -375 Q 129 -401 105 -438 Q 81 -474 81 -527 Q 81 -580 107 -621 Q 133 -662 180 -686 Q 227 -709 289 -709 Q 355 -709 406 -679 Q 457 -649 488 -590 L 418 -547 Q 395 -588 362 -610 Q 329 -631 286 -631 Q 252 -631 226 -618 Q 199 -605 184 -582 Q 169 -559 169 -529 Q 169 -497 187 -474 Q 205 -452 239 -435 Q 273 -418 321 -400 Q 382 -377 426 -350 Q 470 -323 494 -286 Q 519 -248 519 -193 Q 519 -134 490 -88 Q 461 -42 410 -16 Q 359 11 292 11 Z M 250 -760 L 359 -901 L 450 -901 L 313 -760 Z" }
GLYPHS.R["Ń"] = { 676, "M 79 0 L 79 -697 L 172 -697 L 529 -114 L 509 -114 L 509 -697 L 597 -697 L 597 0 L 502 0 L 147 -584 L 167 -584 L 167 0 Z M 302 -760 L 411 -901 L 502 -901 L 365 -760 Z" }
GLYPHS.R["Ą"] = { 637, "M 17 0 L 283 -697 L 353 -697 L 619 0 L 523 0 L 319 -571 L 114 0 Z M 165 -164 L 192 -243 L 444 -243 L 473 -164 Z M 545 204 Q 508 204 481 182 Q 454 161 454 121 Q 454 92 468 68 Q 481 45 501 27 Q 521 9 541 -2 L 608 0 Q 593 8 576 20 Q 558 31 542 46 Q 525 60 515 78 Q 505 95 505 114 Q 505 134 516 144 Q 528 154 545 154 Q 561 154 580 146 Q 599 137 617 121 L 643 161 Q 621 183 596 194 Q 570 204 545 204 Z" }
GLYPHS.R["Ć"] = { 704, "M 372 12 Q 276 12 204 -33 Q 131 -78 90 -160 Q 50 -241 50 -349 Q 50 -457 90 -538 Q 131 -619 204 -664 Q 276 -709 372 -709 Q 477 -709 554 -657 Q 631 -605 665 -513 L 583 -482 Q 557 -550 503 -588 Q 449 -625 372 -625 Q 301 -625 248 -591 Q 195 -557 166 -496 Q 138 -434 138 -349 Q 138 -264 166 -202 Q 195 -140 248 -106 Q 301 -72 372 -72 Q 449 -72 503 -110 Q 557 -148 583 -215 L 665 -185 Q 631 -94 554 -41 Q 477 12 372 12 Z M 329 -760 L 438 -901 L 529 -901 L 392 -760 Z" }
GLYPHS.R["Ę"] = { 585, "M 79 0 L 79 -697 L 538 -697 L 538 -618 L 167 -618 L 167 -395 L 504 -395 L 504 -316 L 167 -316 L 167 -79 L 538 -79 L 538 0 Z M 475 204 Q 438 204 411 182 Q 384 161 384 121 Q 384 92 398 68 Q 411 45 431 27 Q 451 9 471 -2 L 538 0 Q 523 8 506 20 Q 488 31 472 46 Q 455 60 445 78 Q 435 95 435 114 Q 435 134 446 144 Q 458 154 475 154 Q 491 154 510 146 Q 529 137 547 121 L 573 161 Q 551 183 526 194 Q 500 204 475 204 Z" }
GLYPHS.R["Ż"] = { 582, "M 32 0 L 32 -75 L 449 -645 L 461 -618 L 56 -618 L 56 -697 L 537 -697 L 537 -623 L 127 -63 L 116 -79 L 549 -79 L 549 0 Z M 243 -786 L 243 -901 L 343 -901 L 343 -786 Z" }
GLYPHS.R["Ź"] = { 582, "M 32 0 L 32 -75 L 449 -645 L 461 -618 L 56 -618 L 56 -697 L 537 -697 L 537 -623 L 127 -63 L 116 -79 L 549 -79 L 549 0 Z M 261 -760 L 370 -901 L 461 -901 L 324 -760 Z" }
GLYPHS.R["Ž"] = { 582, "M 32 0 L 32 -75 L 449 -645 L 461 -618 L 56 -618 L 56 -697 L 537 -697 L 537 -623 L 127 -63 L 116 -79 L 549 -79 L 549 0 Z M 293 -745 L 142 -901 L 209 -901 L 293 -815 L 377 -901 L 444 -901 Z" }
GLYPHS.R["Š"] = { 564, "M 292 11 Q 187 11 120 -44 Q 53 -99 38 -190 L 124 -211 Q 135 -141 182 -104 Q 228 -68 295 -68 Q 334 -68 365 -83 Q 396 -98 414 -126 Q 432 -153 432 -188 Q 432 -225 412 -249 Q 392 -273 356 -291 Q 321 -309 274 -327 Q 216 -349 172 -375 Q 129 -401 105 -438 Q 81 -474 81 -527 Q 81 -580 107 -621 Q 133 -662 180 -686 Q 227 -709 289 -709 Q 355 -709 406 -679 Q 457 -649 488 -590 L 418 -547 Q 395 -588 362 -610 Q 329 -631 286 -631 Q 252 -631 226 -618 Q 199 -605 184 -582 Q 169 -559 169 -529 Q 169 -497 187 -474 Q 205 -452 239 -435 Q 273 -418 321 -400 Q 382 -377 426 -350 Q 470 -323 494 -286 Q 519 -248 519 -193 Q 519 -134 490 -88 Q 461 -42 410 -16 Q 359 11 292 11 Z M 282 -745 L 131 -901 L 198 -901 L 282 -815 L 366 -901 L 433 -901 Z" }
GLYPHS.R["Ő"] = { 748, "M 372 12 Q 276 12 204 -33 Q 131 -78 90 -159 Q 50 -240 50 -348 Q 50 -457 90 -538 Q 131 -619 204 -664 Q 276 -709 372 -709 Q 470 -709 543 -664 Q 616 -619 656 -538 Q 697 -457 697 -348 Q 697 -240 656 -159 Q 615 -78 542 -33 Q 469 12 372 12 Z M 372 -72 Q 445 -72 498 -106 Q 550 -140 579 -202 Q 608 -264 608 -348 Q 608 -433 579 -495 Q 550 -557 498 -591 Q 445 -625 372 -625 Q 301 -625 248 -592 Q 195 -558 166 -496 Q 138 -434 138 -348 Q 138 -263 166 -201 Q 195 -139 248 -106 Q 301 -72 372 -72 Z M 429 -746 L 539 -901 L 629 -901 L 493 -746 Z M 253 -746 L 362 -901 L 439 -901 L 316 -746 Z" }
GLYPHS.R["Õ"] = { 748, "M 372 12 Q 276 12 204 -33 Q 131 -78 90 -159 Q 50 -240 50 -348 Q 50 -457 90 -538 Q 131 -619 204 -664 Q 276 -709 372 -709 Q 470 -709 543 -664 Q 616 -619 656 -538 Q 697 -457 697 -348 Q 697 -240 656 -159 Q 615 -78 542 -33 Q 469 12 372 12 Z M 372 -72 Q 445 -72 498 -106 Q 550 -140 579 -202 Q 608 -264 608 -348 Q 608 -433 579 -495 Q 550 -557 498 -591 Q 445 -625 372 -625 Q 301 -625 248 -592 Q 195 -558 166 -496 Q 138 -434 138 -348 Q 138 -263 166 -201 Q 195 -139 248 -106 Q 301 -72 372 -72 Z M 439 -743 Q 415 -743 398 -752 Q 382 -760 370 -772 Q 359 -785 350 -798 Q 340 -810 330 -818 Q 319 -827 304 -827 Q 285 -827 273 -807 Q 261 -787 261 -751 L 211 -751 Q 211 -810 237 -842 Q 263 -875 308 -875 Q 330 -875 345 -866 Q 360 -858 372 -845 Q 383 -832 393 -820 Q 403 -807 414 -798 Q 425 -790 440 -790 Q 457 -790 469 -812 Q 481 -834 481 -871 L 533 -871 Q 533 -811 508 -777 Q 482 -743 439 -743 Z" }
GLYPHS.R["×"] = { 560, "M 126 -41 L 74 -93 L 227 -246 L 73 -401 L 125 -453 L 278 -299 L 433 -453 L 485 -400 L 332 -246 L 485 -93 L 433 -41 L 278 -194 Z" }
GLYPHS.R["→"] = { 1106, "M 564 -22 L 536 -79 L 902 -284 L 905 -272 L 24 -272 L 24 -335 L 905 -335 L 902 -323 L 536 -527 L 564 -585 L 1069 -304 Z" }
GLYPHS.M["ã"] = { 542, "M 390 0 L 382 -91 L 382 -310 Q 382 -362 352 -390 Q 322 -418 265 -418 Q 225 -418 188 -402 Q 152 -386 119 -350 L 58 -413 Q 102 -459 156 -481 Q 209 -502 272 -502 Q 371 -502 425 -451 Q 480 -401 480 -310 L 480 0 Z M 231 9 Q 176 9 134 -11 Q 92 -31 69 -66 Q 46 -102 46 -149 Q 46 -190 63 -219 Q 80 -249 107 -265 Q 132 -281 165 -287 Q 197 -294 234 -294 L 391 -294 L 391 -220 L 248 -220 Q 228 -220 207 -217 Q 185 -213 170 -202 Q 158 -193 151 -179 Q 144 -166 144 -148 Q 144 -113 171 -92 Q 198 -71 243 -71 Q 281 -71 312 -88 Q 344 -106 363 -137 Q 382 -167 382 -206 L 417 -160 Q 408 -108 382 -70 Q 356 -31 318 -11 Q 279 9 231 9 Z M 339 -563 Q 309 -563 291 -575 Q 272 -586 259 -601 Q 247 -616 235 -628 Q 223 -639 206 -639 Q 189 -639 178 -620 Q 168 -602 168 -568 L 110 -568 Q 110 -631 137 -666 Q 164 -701 211 -701 Q 237 -701 255 -689 Q 273 -677 286 -662 Q 299 -647 312 -635 Q 324 -623 340 -623 Q 355 -623 366 -643 Q 377 -662 377 -697 L 437 -697 Q 437 -634 410 -598 Q 384 -563 339 -563 Z" }
GLYPHS.M["ö"] = { 575, "M 288 9 Q 218 9 163 -24 Q 108 -57 77 -115 Q 45 -173 45 -247 Q 45 -321 76 -379 Q 107 -436 162 -469 Q 218 -502 288 -502 Q 359 -502 413 -469 Q 467 -436 499 -379 Q 530 -321 530 -247 Q 530 -173 499 -115 Q 467 -58 413 -25 Q 358 9 288 9 Z M 288 -78 Q 332 -78 365 -99 Q 397 -120 414 -158 Q 432 -196 432 -247 Q 432 -299 414 -337 Q 397 -375 365 -395 Q 332 -416 288 -416 Q 243 -416 211 -395 Q 178 -374 160 -337 Q 143 -299 143 -247 Q 143 -196 160 -158 Q 178 -120 211 -99 Q 243 -78 288 -78 Z M 328 -578 L 328 -697 L 438 -697 L 438 -578 Z M 139 -578 L 139 -697 L 250 -697 L 250 -578 Z" }
GLYPHS.M["ä"] = { 542, "M 390 0 L 382 -91 L 382 -310 Q 382 -362 352 -390 Q 322 -418 265 -418 Q 225 -418 188 -402 Q 152 -386 119 -350 L 58 -413 Q 102 -459 156 -481 Q 209 -502 272 -502 Q 371 -502 425 -451 Q 480 -401 480 -310 L 480 0 Z M 231 9 Q 176 9 134 -11 Q 92 -31 69 -66 Q 46 -102 46 -149 Q 46 -190 63 -219 Q 80 -249 107 -265 Q 132 -281 165 -287 Q 197 -294 234 -294 L 391 -294 L 391 -220 L 248 -220 Q 228 -220 207 -217 Q 185 -213 170 -202 Q 158 -193 151 -179 Q 144 -166 144 -148 Q 144 -113 171 -92 Q 198 -71 243 -71 Q 281 -71 312 -88 Q 344 -106 363 -137 Q 382 -167 382 -206 L 417 -160 Q 408 -108 382 -70 Q 356 -31 318 -11 Q 279 9 231 9 Z M 314 -578 L 314 -697 L 425 -697 L 425 -578 Z M 125 -578 L 125 -697 L 236 -697 L 236 -578 Z" }
GLYPHS.M["ß"] = { 640, "M 419 9 Q 369 9 327 -9 Q 285 -27 256 -58 Q 227 -88 214 -126 L 293 -161 Q 302 -138 318 -118 Q 333 -98 358 -86 Q 383 -73 418 -73 Q 462 -73 485 -93 Q 508 -112 508 -140 Q 508 -163 494 -177 Q 479 -192 456 -200 Q 433 -209 405 -217 Q 377 -224 348 -233 Q 320 -243 297 -258 Q 273 -273 259 -297 Q 244 -322 244 -358 Q 244 -398 259 -423 Q 274 -447 297 -462 Q 320 -476 345 -485 Q 371 -495 394 -503 Q 417 -511 431 -522 Q 446 -534 446 -553 Q 446 -573 429 -587 Q 412 -600 386 -607 Q 360 -614 332 -614 Q 283 -614 252 -603 Q 222 -592 205 -574 Q 188 -555 180 -534 Q 173 -512 172 -491 Q 170 -469 170 -453 L 170 0 L 68 0 L 68 -453 Q 68 -500 79 -545 Q 89 -590 116 -626 Q 144 -663 194 -684 Q 245 -705 325 -705 Q 389 -705 437 -688 Q 486 -671 514 -637 Q 542 -604 542 -556 Q 542 -519 527 -495 Q 513 -471 490 -456 Q 467 -441 441 -431 Q 416 -421 393 -411 Q 370 -402 355 -390 Q 340 -378 340 -358 Q 340 -340 355 -330 Q 369 -320 393 -313 Q 416 -306 444 -299 Q 473 -292 501 -283 Q 529 -273 552 -257 Q 575 -241 590 -215 Q 604 -189 604 -149 Q 604 -109 588 -79 Q 573 -49 546 -30 Q 520 -11 487 -1 Q 454 9 419 9 Z" }
GLYPHS.M["ę"] = { 540, "M 280 9 Q 220 9 176 -11 Q 132 -31 103 -67 Q 74 -102 60 -147 Q 45 -193 45 -243 Q 45 -293 59 -340 Q 73 -386 101 -422 Q 129 -459 171 -480 Q 214 -502 272 -502 Q 330 -502 372 -482 Q 414 -463 441 -428 Q 468 -394 481 -351 Q 495 -308 495 -260 Q 495 -255 494 -241 Q 494 -228 492 -216 L 143 -216 Q 146 -150 184 -114 Q 221 -79 283 -79 Q 325 -79 358 -93 Q 391 -106 419 -135 L 479 -73 Q 450 -44 419 -26 Q 389 -8 356 0 Q 322 9 280 9 Z M 398 -265 Q 400 -273 400 -281 Q 401 -289 401 -297 Q 401 -320 393 -342 Q 385 -364 369 -382 Q 353 -399 330 -409 Q 306 -420 275 -420 Q 234 -420 205 -401 Q 176 -383 160 -353 Q 145 -323 142 -288 L 430 -288 Z M 286 204 Q 246 204 217 181 Q 188 159 188 118 Q 188 88 202 65 Q 215 42 235 25 Q 255 8 273 -2 L 350 0 Q 337 7 320 17 Q 302 28 285 42 Q 268 56 258 73 Q 247 90 247 109 Q 247 128 259 138 Q 270 149 287 149 Q 303 149 321 140 Q 339 132 356 116 L 388 157 Q 367 180 341 192 Q 315 204 286 204 Z" }
GLYPHS.M["ë"] = { 540, "M 280 9 Q 220 9 176 -11 Q 132 -31 103 -67 Q 74 -102 60 -147 Q 45 -193 45 -243 Q 45 -293 59 -340 Q 73 -386 101 -422 Q 129 -459 171 -480 Q 214 -502 272 -502 Q 330 -502 372 -482 Q 414 -463 441 -428 Q 468 -394 481 -351 Q 495 -308 495 -260 Q 495 -255 494 -241 Q 494 -228 492 -216 L 143 -216 Q 146 -150 184 -114 Q 221 -79 283 -79 Q 325 -79 358 -93 Q 391 -106 419 -135 L 479 -73 Q 450 -44 419 -26 Q 389 -8 356 0 Q 322 9 280 9 Z M 398 -265 Q 400 -273 400 -281 Q 401 -289 401 -297 Q 401 -320 393 -342 Q 385 -364 369 -382 Q 353 -399 330 -409 Q 306 -420 275 -420 Q 234 -420 205 -401 Q 176 -383 160 -353 Q 145 -323 142 -288 L 430 -288 Z M 313 -578 L 313 -697 L 424 -697 L 424 -578 Z M 124 -578 L 124 -697 L 235 -697 L 235 -578 Z" }
GLYPHS.M["ò"] = { 575, "M 288 9 Q 218 9 163 -24 Q 108 -57 77 -115 Q 45 -173 45 -247 Q 45 -321 76 -379 Q 107 -436 162 -469 Q 218 -502 288 -502 Q 359 -502 413 -469 Q 467 -436 499 -379 Q 530 -321 530 -247 Q 530 -173 499 -115 Q 467 -58 413 -25 Q 358 9 288 9 Z M 288 -78 Q 332 -78 365 -99 Q 397 -120 414 -158 Q 432 -196 432 -247 Q 432 -299 414 -337 Q 397 -375 365 -395 Q 332 -416 288 -416 Q 243 -416 211 -395 Q 178 -374 160 -337 Q 143 -299 143 -247 Q 143 -196 160 -158 Q 178 -120 211 -99 Q 243 -78 288 -78 Z M 251 -556 L 117 -697 L 221 -697 L 325 -556 Z" }
GLYPHS.M["õ"] = { 575, "M 288 9 Q 218 9 163 -24 Q 108 -57 77 -115 Q 45 -173 45 -247 Q 45 -321 76 -379 Q 107 -436 162 -469 Q 218 -502 288 -502 Q 359 -502 413 -469 Q 467 -436 499 -379 Q 530 -321 530 -247 Q 530 -173 499 -115 Q 467 -58 413 -25 Q 358 9 288 9 Z M 288 -78 Q 332 -78 365 -99 Q 397 -120 414 -158 Q 432 -196 432 -247 Q 432 -299 414 -337 Q 397 -375 365 -395 Q 332 -416 288 -416 Q 243 -416 211 -395 Q 178 -374 160 -337 Q 143 -299 143 -247 Q 143 -196 160 -158 Q 178 -120 211 -99 Q 243 -78 288 -78 Z M 353 -563 Q 323 -563 304 -575 Q 286 -586 273 -601 Q 261 -616 248 -628 Q 236 -639 220 -639 Q 203 -639 192 -620 Q 181 -602 181 -568 L 124 -568 Q 124 -631 151 -666 Q 178 -701 225 -701 Q 251 -701 269 -689 Q 286 -677 300 -662 Q 313 -647 325 -635 Q 338 -623 354 -623 Q 369 -623 380 -643 Q 391 -662 391 -697 L 450 -697 Q 450 -634 424 -598 Q 398 -563 353 -563 Z" }
GLYPHS.M["Ã"] = { 649, "M 14 0 L 285 -697 L 364 -697 L 634 0 L 523 0 L 325 -549 L 126 0 Z M 174 -155 L 205 -246 L 443 -246 L 477 -155 Z M 390 -743 Q 366 -743 350 -750 Q 333 -758 321 -770 Q 310 -781 300 -793 Q 291 -804 281 -812 Q 271 -820 257 -820 Q 240 -820 229 -801 Q 218 -783 218 -749 L 161 -749 Q 161 -809 188 -842 Q 215 -875 262 -875 Q 283 -875 298 -867 Q 313 -859 325 -847 Q 337 -835 347 -824 Q 357 -812 367 -804 Q 378 -796 391 -796 Q 406 -796 417 -816 Q 428 -836 428 -871 L 487 -871 Q 487 -810 461 -776 Q 435 -743 390 -743 Z" }
GLYPHS.M["Ö"] = { 748, "M 372 13 Q 275 13 202 -32 Q 128 -77 87 -158 Q 46 -240 46 -348 Q 46 -457 87 -539 Q 128 -620 202 -665 Q 275 -710 372 -710 Q 471 -710 545 -665 Q 619 -620 660 -539 Q 701 -457 701 -348 Q 701 -240 659 -158 Q 618 -77 544 -32 Q 470 13 372 13 Z M 372 -84 Q 442 -84 492 -117 Q 542 -149 570 -208 Q 598 -268 598 -348 Q 598 -429 570 -489 Q 542 -548 492 -580 Q 442 -613 372 -613 Q 304 -613 253 -581 Q 203 -549 175 -490 Q 148 -430 148 -348 Q 148 -267 175 -207 Q 203 -148 253 -116 Q 304 -84 372 -84 Z M 412 -782 L 412 -901 L 523 -901 L 523 -782 Z M 224 -782 L 224 -901 L 334 -901 L 334 -782 Z" }
GLYPHS.M["Ä"] = { 649, "M 14 0 L 285 -697 L 364 -697 L 634 0 L 523 0 L 325 -549 L 126 0 Z M 174 -155 L 205 -246 L 443 -246 L 477 -155 Z M 365 -782 L 365 -901 L 475 -901 L 475 -782 Z M 176 -782 L 176 -901 L 287 -901 L 287 -782 Z" }
GLYPHS.M["Ò"] = { 748, "M 372 13 Q 275 13 202 -32 Q 128 -77 87 -158 Q 46 -240 46 -348 Q 46 -457 87 -539 Q 128 -620 202 -665 Q 275 -710 372 -710 Q 471 -710 545 -665 Q 619 -620 660 -539 Q 701 -457 701 -348 Q 701 -240 659 -158 Q 618 -77 544 -32 Q 470 13 372 13 Z M 372 -84 Q 442 -84 492 -117 Q 542 -149 570 -208 Q 598 -268 598 -348 Q 598 -429 570 -489 Q 542 -548 492 -580 Q 442 -613 372 -613 Q 304 -613 253 -581 Q 203 -549 175 -490 Q 148 -430 148 -348 Q 148 -267 175 -207 Q 203 -148 253 -116 Q 304 -84 372 -84 Z M 336 -760 L 202 -901 L 306 -901 L 410 -760 Z" }
GLYPHS.M["Ë"] = { 583, "M 75 0 L 75 -697 L 536 -697 L 536 -606 L 177 -606 L 177 -402 L 506 -402 L 506 -311 L 177 -311 L 177 -91 L 536 -91 L 536 0 Z M 345 -782 L 345 -901 L 456 -901 L 456 -782 Z M 156 -782 L 156 -901 L 267 -901 L 267 -782 Z" }
GLYPHS.M["Ê"] = { 583, "M 75 0 L 75 -697 L 536 -697 L 536 -606 L 177 -606 L 177 -402 L 506 -402 L 506 -311 L 177 -311 L 177 -91 L 536 -91 L 536 0 Z M 153 -749 L 306 -915 L 459 -749 L 379 -749 L 306 -831 L 234 -749 Z" }
GLYPHS.M["Ł"] = { 498, "M 75 0 L 75 -697 L 177 -697 L 177 -91 L 484 -91 L 484 0 Z M 13 -177 L 12 -279 L 306 -511 L 306 -410 Z" }
GLYPHS.M["Ś"] = { 568, "M 294 12 Q 187 12 118 -44 Q 50 -100 35 -193 L 134 -217 Q 145 -149 189 -114 Q 233 -79 297 -79 Q 334 -79 362 -93 Q 391 -106 408 -132 Q 425 -157 425 -189 Q 425 -223 407 -245 Q 388 -267 354 -285 Q 321 -302 274 -320 Q 213 -343 170 -370 Q 126 -397 102 -435 Q 79 -472 79 -525 Q 79 -579 105 -621 Q 132 -662 180 -686 Q 228 -710 291 -710 Q 358 -710 411 -680 Q 463 -649 494 -588 L 413 -538 Q 391 -578 359 -599 Q 328 -620 288 -620 Q 257 -620 233 -608 Q 208 -596 195 -575 Q 181 -555 181 -527 Q 181 -498 197 -477 Q 214 -456 247 -440 Q 279 -423 328 -405 Q 390 -381 434 -354 Q 478 -326 502 -288 Q 526 -250 526 -195 Q 526 -135 496 -89 Q 467 -42 415 -15 Q 363 12 294 12 Z M 247 -760 L 357 -901 L 462 -901 L 319 -760 Z" }
GLYPHS.M["Ń"] = { 680, "M 75 0 L 75 -697 L 181 -697 L 528 -132 L 504 -132 L 504 -697 L 605 -697 L 605 0 L 497 0 L 153 -566 L 177 -566 L 177 0 Z M 301 -760 L 410 -901 L 516 -901 L 373 -760 Z" }
GLYPHS.M["Ą"] = { 649, "M 14 0 L 285 -697 L 364 -697 L 634 0 L 523 0 L 325 -549 L 126 0 Z M 174 -155 L 205 -246 L 443 -246 L 477 -155 Z M 557 204 Q 517 204 488 181 Q 460 159 460 118 Q 460 88 473 65 Q 487 42 506 25 Q 526 8 544 -2 L 622 0 Q 608 7 591 17 Q 573 28 557 42 Q 540 56 529 73 Q 518 90 518 109 Q 518 128 530 138 Q 542 149 559 149 Q 574 149 592 140 Q 610 132 627 116 L 659 157 Q 638 180 612 192 Q 586 204 557 204 Z" }
GLYPHS.M["Ć"] = { 706, "M 372 13 Q 275 13 202 -32 Q 128 -77 87 -159 Q 46 -241 46 -349 Q 46 -457 87 -539 Q 128 -620 202 -665 Q 275 -710 372 -710 Q 479 -710 557 -657 Q 636 -604 670 -510 L 575 -475 Q 550 -540 498 -577 Q 446 -613 372 -613 Q 304 -613 254 -581 Q 203 -548 176 -489 Q 148 -431 148 -349 Q 148 -267 176 -208 Q 203 -149 254 -116 Q 304 -84 372 -84 Q 446 -84 498 -121 Q 550 -157 575 -222 L 670 -188 Q 636 -95 557 -41 Q 479 13 372 13 Z M 323 -760 L 433 -901 L 538 -901 L 396 -760 Z" }
GLYPHS.M["Ę"] = { 583, "M 75 0 L 75 -697 L 536 -697 L 536 -606 L 177 -606 L 177 -402 L 506 -402 L 506 -311 L 177 -311 L 177 -91 L 536 -91 L 536 0 Z M 472 204 Q 431 204 402 181 Q 374 159 374 118 Q 374 88 387 65 Q 401 42 420 25 Q 440 8 459 -2 L 536 0 Q 522 7 505 17 Q 488 28 471 42 Q 454 56 443 73 Q 432 90 432 109 Q 432 128 444 138 Q 456 149 473 149 Q 488 149 506 140 Q 525 132 542 116 L 573 157 Q 552 180 527 192 Q 501 204 472 204 Z" }
GLYPHS.M["Ż"] = { 590, "M 31 0 L 31 -85 L 444 -637 L 458 -606 L 54 -606 L 54 -697 L 546 -697 L 546 -612 L 141 -72 L 128 -91 L 558 -91 L 558 0 Z M 242 -782 L 242 -901 L 353 -901 L 353 -782 Z" }
GLYPHS.M["Ź"] = { 590, "M 31 0 L 31 -85 L 444 -637 L 458 -606 L 54 -606 L 54 -697 L 546 -697 L 546 -612 L 141 -72 L 128 -91 L 558 -91 L 558 0 Z M 261 -760 L 370 -901 L 476 -901 L 333 -760 Z" }
GLYPHS.M["Ž"] = { 590, "M 31 0 L 31 -85 L 444 -637 L 458 -606 L 54 -606 L 54 -697 L 546 -697 L 546 -612 L 141 -72 L 128 -91 L 558 -91 L 558 0 Z M 297 -742 L 144 -901 L 221 -901 L 297 -820 L 374 -901 L 450 -901 Z" }
GLYPHS.M["Š"] = { 568, "M 294 12 Q 187 12 118 -44 Q 50 -100 35 -193 L 134 -217 Q 145 -149 189 -114 Q 233 -79 297 -79 Q 334 -79 362 -93 Q 391 -106 408 -132 Q 425 -157 425 -189 Q 425 -223 407 -245 Q 388 -267 354 -285 Q 321 -302 274 -320 Q 213 -343 170 -370 Q 126 -397 102 -435 Q 79 -472 79 -525 Q 79 -579 105 -621 Q 132 -662 180 -686 Q 228 -710 291 -710 Q 358 -710 411 -680 Q 463 -649 494 -588 L 413 -538 Q 391 -578 359 -599 Q 328 -620 288 -620 Q 257 -620 233 -608 Q 208 -596 195 -575 Q 181 -555 181 -527 Q 181 -498 197 -477 Q 214 -456 247 -440 Q 279 -423 328 -405 Q 390 -381 434 -354 Q 478 -326 502 -288 Q 526 -250 526 -195 Q 526 -135 496 -89 Q 467 -42 415 -15 Q 363 12 294 12 Z M 284 -742 L 131 -901 L 208 -901 L 284 -820 L 360 -901 L 437 -901 Z" }
GLYPHS.M["Ő"] = { 748, "M 372 13 Q 275 13 202 -32 Q 128 -77 87 -158 Q 46 -240 46 -348 Q 46 -457 87 -539 Q 128 -620 202 -665 Q 275 -710 372 -710 Q 471 -710 545 -665 Q 619 -620 660 -539 Q 701 -457 701 -348 Q 701 -240 659 -158 Q 618 -77 544 -32 Q 470 13 372 13 Z M 372 -84 Q 442 -84 492 -117 Q 542 -149 570 -208 Q 598 -268 598 -348 Q 598 -429 570 -489 Q 542 -548 492 -580 Q 442 -613 372 -613 Q 304 -613 253 -581 Q 203 -549 175 -490 Q 148 -430 148 -348 Q 148 -267 175 -207 Q 203 -148 253 -116 Q 304 -84 372 -84 Z M 427 -743 L 538 -901 L 642 -901 L 500 -743 Z M 246 -743 L 355 -901 L 444 -901 L 318 -743 Z" }
GLYPHS.M["Õ"] = { 748, "M 372 13 Q 275 13 202 -32 Q 128 -77 87 -158 Q 46 -240 46 -348 Q 46 -457 87 -539 Q 128 -620 202 -665 Q 275 -710 372 -710 Q 471 -710 545 -665 Q 619 -620 660 -539 Q 701 -457 701 -348 Q 701 -240 659 -158 Q 618 -77 544 -32 Q 470 13 372 13 Z M 372 -84 Q 442 -84 492 -117 Q 542 -149 570 -208 Q 598 -268 598 -348 Q 598 -429 570 -489 Q 542 -548 492 -580 Q 442 -613 372 -613 Q 304 -613 253 -581 Q 203 -549 175 -490 Q 148 -430 148 -348 Q 148 -267 175 -207 Q 203 -148 253 -116 Q 304 -84 372 -84 Z M 438 -743 Q 414 -743 397 -750 Q 381 -758 369 -770 Q 357 -781 348 -793 Q 338 -804 328 -812 Q 318 -820 305 -820 Q 288 -820 277 -801 Q 266 -783 266 -749 L 209 -749 Q 209 -809 236 -842 Q 263 -875 309 -875 Q 331 -875 346 -867 Q 361 -859 373 -847 Q 384 -835 394 -824 Q 404 -812 415 -804 Q 425 -796 439 -796 Q 454 -796 465 -816 Q 476 -836 476 -871 L 535 -871 Q 535 -810 509 -776 Q 482 -743 438 -743 Z" }
GLYPHS.M["×"] = { 560, "M 129 -36 L 69 -96 L 219 -246 L 69 -397 L 129 -458 L 278 -307 L 430 -458 L 490 -397 L 340 -246 L 490 -96 L 430 -36 L 278 -186 Z" }
GLYPHS.M["→"] = { 1121, "M 567 -13 L 534 -78 L 891 -278 L 895 -264 L 24 -264 L 24 -337 L 895 -337 L 891 -323 L 534 -523 L 567 -589 L 1084 -301 Z" }
GLYPHS.S["ã"] = { 544, "M 383 0 L 375 -83 L 375 -311 Q 375 -359 346 -383 Q 317 -408 265 -408 Q 225 -408 187 -392 Q 148 -377 116 -345 L 54 -418 Q 102 -463 156 -483 Q 210 -502 274 -502 Q 374 -502 430 -452 Q 485 -401 485 -311 L 485 0 Z M 230 9 Q 175 9 133 -11 Q 90 -31 67 -67 Q 43 -103 43 -151 Q 43 -192 60 -222 Q 78 -252 106 -269 Q 130 -284 162 -290 Q 194 -297 229 -297 L 384 -297 L 384 -214 L 245 -214 Q 227 -214 209 -211 Q 191 -207 177 -198 Q 167 -190 161 -178 Q 154 -166 154 -150 Q 154 -118 179 -99 Q 203 -81 244 -81 Q 280 -81 309 -97 Q 339 -113 357 -141 Q 375 -169 375 -204 L 409 -149 Q 397 -97 371 -61 Q 345 -26 309 -8 Q 273 9 230 9 Z M 338 -559 Q 309 -559 290 -570 Q 271 -581 258 -595 Q 246 -609 234 -620 Q 222 -631 207 -631 Q 192 -631 183 -613 Q 173 -596 173 -563 L 109 -563 Q 109 -628 137 -664 Q 165 -700 213 -700 Q 238 -700 256 -689 Q 274 -678 288 -664 Q 301 -649 313 -638 Q 325 -627 339 -627 Q 353 -627 362 -645 Q 372 -664 372 -697 L 439 -697 Q 439 -631 412 -595 Q 385 -559 338 -559 Z" }
GLYPHS.S["ö"] = { 574, "M 287 9 Q 217 9 161 -24 Q 105 -57 74 -115 Q 42 -173 42 -247 Q 42 -321 73 -379 Q 105 -437 160 -470 Q 216 -502 287 -502 Q 359 -502 413 -470 Q 468 -437 500 -379 Q 532 -321 532 -247 Q 532 -173 500 -115 Q 469 -57 413 -24 Q 358 9 287 9 Z M 288 -89 Q 329 -89 359 -108 Q 389 -127 405 -163 Q 421 -199 421 -247 Q 421 -296 405 -332 Q 389 -367 359 -386 Q 329 -405 288 -405 Q 245 -405 215 -386 Q 185 -366 169 -331 Q 153 -296 153 -247 Q 153 -199 169 -163 Q 185 -127 215 -108 Q 245 -89 288 -89 Z M 323 -574 L 323 -697 L 445 -697 L 445 -574 Z M 131 -574 L 131 -697 L 252 -697 L 252 -574 Z" }
GLYPHS.S["ä"] = { 544, "M 383 0 L 375 -83 L 375 -311 Q 375 -359 346 -383 Q 317 -408 265 -408 Q 225 -408 187 -392 Q 148 -377 116 -345 L 54 -418 Q 102 -463 156 -483 Q 210 -502 274 -502 Q 374 -502 430 -452 Q 485 -401 485 -311 L 485 0 Z M 230 9 Q 175 9 133 -11 Q 90 -31 67 -67 Q 43 -103 43 -151 Q 43 -192 60 -222 Q 78 -252 106 -269 Q 130 -284 162 -290 Q 194 -297 229 -297 L 384 -297 L 384 -214 L 245 -214 Q 227 -214 209 -211 Q 191 -207 177 -198 Q 167 -190 161 -178 Q 154 -166 154 -150 Q 154 -118 179 -99 Q 203 -81 244 -81 Q 280 -81 309 -97 Q 339 -113 357 -141 Q 375 -169 375 -204 L 409 -149 Q 397 -97 371 -61 Q 345 -26 309 -8 Q 273 9 230 9 Z M 311 -574 L 311 -697 L 432 -697 L 432 -574 Z M 118 -574 L 118 -697 L 240 -697 L 240 -574 Z" }
GLYPHS.S["ß"] = { 646, "M 423 9 Q 372 9 330 -9 Q 287 -28 258 -59 Q 229 -90 217 -127 L 306 -167 Q 314 -147 328 -127 Q 341 -108 365 -96 Q 388 -83 422 -83 Q 462 -83 483 -101 Q 503 -118 503 -142 Q 503 -163 489 -175 Q 475 -188 453 -196 Q 430 -205 403 -212 Q 376 -219 349 -229 Q 322 -239 299 -254 Q 276 -270 263 -294 Q 249 -318 249 -355 Q 249 -394 263 -419 Q 277 -443 300 -458 Q 322 -473 347 -483 Q 372 -493 395 -501 Q 417 -509 431 -519 Q 446 -530 446 -548 Q 446 -567 430 -579 Q 413 -590 389 -596 Q 364 -602 338 -602 Q 290 -602 260 -591 Q 230 -581 214 -563 Q 197 -546 190 -525 Q 183 -504 182 -483 Q 180 -463 180 -446 L 180 0 L 65 0 L 65 -446 Q 65 -495 76 -541 Q 87 -588 115 -625 Q 143 -662 195 -684 Q 248 -706 330 -706 Q 396 -706 447 -688 Q 497 -671 526 -636 Q 555 -602 555 -551 Q 555 -514 540 -489 Q 526 -464 504 -448 Q 481 -432 456 -421 Q 431 -411 409 -401 Q 386 -392 372 -382 Q 358 -371 358 -355 Q 358 -340 372 -331 Q 385 -322 408 -316 Q 431 -310 458 -303 Q 485 -297 512 -287 Q 539 -277 562 -261 Q 584 -244 598 -218 Q 612 -192 612 -153 Q 612 -111 596 -80 Q 579 -49 552 -30 Q 525 -10 491 0 Q 458 9 423 9 Z" }
GLYPHS.S["ę"] = { 541, "M 281 9 Q 219 9 173 -11 Q 128 -31 99 -67 Q 70 -103 56 -148 Q 42 -194 42 -243 Q 42 -292 56 -339 Q 69 -385 97 -422 Q 125 -459 169 -480 Q 213 -502 273 -502 Q 330 -502 373 -483 Q 415 -463 443 -429 Q 471 -394 484 -350 Q 498 -306 498 -256 Q 498 -249 498 -236 Q 497 -223 495 -210 L 153 -210 Q 157 -151 193 -120 Q 229 -89 285 -89 Q 326 -89 360 -102 Q 394 -115 422 -143 L 483 -69 Q 452 -41 421 -24 Q 390 -7 357 1 Q 323 9 281 9 Z M 389 -266 Q 391 -274 391 -282 Q 392 -290 392 -298 Q 392 -320 384 -340 Q 377 -360 362 -376 Q 347 -391 325 -400 Q 303 -410 275 -410 Q 236 -410 209 -393 Q 183 -376 168 -349 Q 154 -323 151 -292 L 425 -292 Z M 288 204 Q 245 204 214 180 Q 184 156 184 114 Q 184 85 197 62 Q 211 40 230 24 Q 249 8 266 -1 L 354 0 Q 342 5 325 15 Q 307 25 290 38 Q 273 52 261 69 Q 250 86 250 104 Q 250 123 262 133 Q 274 143 291 143 Q 306 143 323 135 Q 340 127 356 111 L 394 153 Q 374 177 348 190 Q 321 204 288 204 Z" }
GLYPHS.S["ë"] = { 541, "M 281 9 Q 219 9 173 -11 Q 128 -31 99 -67 Q 70 -103 56 -148 Q 42 -194 42 -243 Q 42 -292 56 -339 Q 69 -385 97 -422 Q 125 -459 169 -480 Q 213 -502 273 -502 Q 330 -502 373 -483 Q 415 -463 443 -429 Q 471 -394 484 -350 Q 498 -306 498 -256 Q 498 -249 498 -236 Q 497 -223 495 -210 L 153 -210 Q 157 -151 193 -120 Q 229 -89 285 -89 Q 326 -89 360 -102 Q 394 -115 422 -143 L 483 -69 Q 452 -41 421 -24 Q 390 -7 357 1 Q 323 9 281 9 Z M 389 -266 Q 391 -274 391 -282 Q 392 -290 392 -298 Q 392 -320 384 -340 Q 377 -360 362 -376 Q 347 -391 325 -400 Q 303 -410 275 -410 Q 236 -410 209 -393 Q 183 -376 168 -349 Q 154 -323 151 -292 L 425 -292 Z M 310 -574 L 310 -697 L 431 -697 L 431 -574 Z M 117 -574 L 117 -697 L 239 -697 L 239 -574 Z" }
GLYPHS.S["ò"] = { 574, "M 287 9 Q 217 9 161 -24 Q 105 -57 74 -115 Q 42 -173 42 -247 Q 42 -321 73 -379 Q 105 -437 160 -470 Q 216 -502 287 -502 Q 359 -502 413 -470 Q 468 -437 500 -379 Q 532 -321 532 -247 Q 532 -173 500 -115 Q 469 -57 413 -24 Q 358 9 287 9 Z M 288 -89 Q 329 -89 359 -108 Q 389 -127 405 -163 Q 421 -199 421 -247 Q 421 -296 405 -332 Q 389 -367 359 -386 Q 329 -405 288 -405 Q 245 -405 215 -386 Q 185 -366 169 -331 Q 153 -296 153 -247 Q 153 -199 169 -163 Q 185 -127 215 -108 Q 245 -89 288 -89 Z M 246 -555 L 107 -697 L 225 -697 L 329 -555 Z" }
GLYPHS.S["õ"] = { 574, "M 287 9 Q 217 9 161 -24 Q 105 -57 74 -115 Q 42 -173 42 -247 Q 42 -321 73 -379 Q 105 -437 160 -470 Q 216 -502 287 -502 Q 359 -502 413 -470 Q 468 -437 500 -379 Q 532 -321 532 -247 Q 532 -173 500 -115 Q 469 -57 413 -24 Q 358 9 287 9 Z M 288 -89 Q 329 -89 359 -108 Q 389 -127 405 -163 Q 421 -199 421 -247 Q 421 -296 405 -332 Q 389 -367 359 -386 Q 329 -405 288 -405 Q 245 -405 215 -386 Q 185 -366 169 -331 Q 153 -296 153 -247 Q 153 -199 169 -163 Q 185 -127 215 -108 Q 245 -89 288 -89 Z M 351 -559 Q 321 -559 302 -570 Q 284 -581 271 -595 Q 258 -609 246 -620 Q 235 -631 220 -631 Q 205 -631 195 -613 Q 186 -596 186 -563 L 121 -563 Q 121 -628 149 -664 Q 177 -700 225 -700 Q 251 -700 269 -689 Q 287 -678 300 -664 Q 314 -649 326 -638 Q 338 -627 352 -627 Q 365 -627 375 -645 Q 385 -664 385 -697 L 452 -697 Q 452 -631 425 -595 Q 397 -559 351 -559 Z" }
GLYPHS.S["Ã"] = { 661, "M 11 0 L 287 -697 L 375 -697 L 650 0 L 524 0 L 331 -528 L 138 0 Z M 183 -146 L 219 -249 L 442 -249 L 480 -146 Z M 395 -742 Q 371 -742 355 -749 Q 338 -756 326 -767 Q 314 -778 305 -788 Q 295 -799 286 -806 Q 276 -813 264 -813 Q 249 -813 239 -796 Q 230 -779 230 -747 L 165 -747 Q 165 -808 193 -841 Q 221 -874 269 -874 Q 290 -874 305 -867 Q 321 -860 333 -849 Q 344 -838 354 -828 Q 364 -817 374 -810 Q 384 -802 396 -802 Q 409 -802 419 -821 Q 429 -839 429 -871 L 496 -871 Q 496 -809 469 -776 Q 441 -742 395 -742 Z" }
GLYPHS.S["Ö"] = { 748, "M 372 14 Q 274 14 200 -31 Q 126 -76 84 -158 Q 43 -240 43 -348 Q 43 -457 84 -539 Q 126 -621 200 -666 Q 274 -711 372 -711 Q 472 -711 547 -666 Q 621 -621 663 -539 Q 704 -458 704 -348 Q 704 -239 662 -158 Q 620 -76 546 -31 Q 471 14 372 14 Z M 372 -96 Q 439 -96 487 -127 Q 535 -158 561 -215 Q 588 -271 588 -348 Q 588 -426 561 -482 Q 535 -539 487 -570 Q 439 -601 372 -601 Q 307 -601 259 -570 Q 211 -540 184 -483 Q 158 -427 158 -348 Q 158 -270 184 -214 Q 210 -157 259 -127 Q 307 -96 372 -96 Z M 409 -778 L 409 -901 L 530 -901 L 530 -778 Z M 216 -778 L 216 -901 L 338 -901 L 338 -778 Z" }
GLYPHS.S["Ä"] = { 661, "M 11 0 L 287 -697 L 375 -697 L 650 0 L 524 0 L 331 -528 L 138 0 Z M 183 -146 L 219 -249 L 442 -249 L 480 -146 Z M 367 -778 L 367 -901 L 489 -901 L 489 -778 Z M 175 -778 L 175 -901 L 296 -901 L 296 -778 Z" }
GLYPHS.S["Ò"] = { 748, "M 372 14 Q 274 14 200 -31 Q 126 -76 84 -158 Q 43 -240 43 -348 Q 43 -457 84 -539 Q 126 -621 200 -666 Q 274 -711 372 -711 Q 472 -711 547 -666 Q 621 -621 663 -539 Q 704 -458 704 -348 Q 704 -239 662 -158 Q 620 -76 546 -31 Q 471 14 372 14 Z M 372 -96 Q 439 -96 487 -127 Q 535 -158 561 -215 Q 588 -271 588 -348 Q 588 -426 561 -482 Q 535 -539 487 -570 Q 439 -601 372 -601 Q 307 -601 259 -570 Q 211 -540 184 -483 Q 158 -427 158 -348 Q 158 -270 184 -214 Q 210 -157 259 -127 Q 307 -96 372 -96 Z M 331 -759 L 192 -901 L 310 -901 L 414 -759 Z" }
GLYPHS.S["Ë"] = { 580, "M 71 0 L 71 -697 L 534 -697 L 534 -594 L 187 -594 L 187 -409 L 507 -409 L 507 -305 L 187 -305 L 187 -103 L 534 -103 L 534 0 Z M 338 -778 L 338 -901 L 460 -901 L 460 -778 Z M 146 -778 L 146 -901 L 267 -901 L 267 -778 Z" }
GLYPHS.S["Ê"] = { 580, "M 71 0 L 71 -697 L 534 -697 L 534 -594 L 187 -594 L 187 -409 L 507 -409 L 507 -305 L 187 -305 L 187 -103 L 534 -103 L 534 0 Z M 148 -747 L 303 -917 L 457 -747 L 368 -747 L 303 -823 L 238 -747 Z" }
GLYPHS.S["Ł"] = { 501, "M 71 0 L 71 -697 L 187 -697 L 187 -103 L 488 -103 L 488 0 Z M 12 -165 L 11 -280 L 305 -512 L 305 -399 Z" }
GLYPHS.S["Ś"] = { 572, "M 296 13 Q 186 13 116 -44 Q 47 -101 31 -196 L 144 -224 Q 155 -158 197 -124 Q 238 -90 299 -90 Q 333 -90 360 -103 Q 387 -115 402 -138 Q 418 -161 418 -190 Q 418 -221 401 -241 Q 384 -262 352 -278 Q 320 -295 274 -313 Q 211 -337 167 -365 Q 123 -393 100 -432 Q 77 -470 77 -523 Q 77 -578 104 -620 Q 131 -663 180 -687 Q 229 -711 293 -711 Q 362 -711 415 -680 Q 468 -649 500 -586 L 408 -530 Q 387 -568 357 -589 Q 327 -609 289 -609 Q 262 -609 240 -598 Q 218 -588 205 -569 Q 193 -550 193 -525 Q 193 -499 208 -480 Q 223 -460 254 -444 Q 286 -428 335 -409 Q 398 -385 442 -357 Q 486 -329 509 -291 Q 533 -252 533 -197 Q 533 -136 503 -89 Q 473 -42 419 -14 Q 366 13 296 13 Z M 244 -759 L 355 -901 L 474 -901 L 326 -759 Z" }
GLYPHS.S["Ń"] = { 685, "M 71 0 L 71 -697 L 191 -697 L 527 -151 L 498 -151 L 498 -697 L 614 -697 L 614 0 L 492 0 L 159 -547 L 187 -547 L 187 0 Z M 299 -759 L 410 -901 L 529 -901 L 381 -759 Z" }
GLYPHS.S["Ą"] = { 661, "M 11 0 L 287 -697 L 375 -697 L 650 0 L 524 0 L 331 -528 L 138 0 Z M 183 -146 L 219 -249 L 442 -249 L 480 -146 Z M 570 204 Q 526 204 496 180 Q 465 156 465 114 Q 465 85 479 62 Q 492 40 511 24 Q 531 8 548 -1 L 635 0 Q 623 5 606 15 Q 589 25 572 38 Q 554 52 543 69 Q 531 86 531 104 Q 531 123 543 133 Q 555 143 572 143 Q 587 143 605 135 Q 622 127 638 111 L 675 153 Q 655 177 629 190 Q 603 204 570 204 Z" }
GLYPHS.S["Ć"] = { 708, "M 372 14 Q 274 14 200 -31 Q 126 -76 84 -158 Q 43 -240 43 -349 Q 43 -458 84 -539 Q 126 -621 200 -666 Q 274 -711 372 -711 Q 481 -711 561 -657 Q 640 -603 675 -507 L 567 -468 Q 543 -531 493 -566 Q 443 -601 372 -601 Q 307 -601 259 -570 Q 211 -539 185 -483 Q 158 -427 158 -349 Q 158 -271 185 -214 Q 211 -158 259 -127 Q 307 -96 372 -96 Q 443 -96 493 -131 Q 543 -167 567 -229 L 675 -190 Q 640 -96 561 -41 Q 481 14 372 14 Z M 318 -759 L 428 -901 L 548 -901 L 399 -759 Z" }
GLYPHS.S["Ę"] = { 580, "M 71 0 L 71 -697 L 534 -697 L 534 -594 L 187 -594 L 187 -409 L 507 -409 L 507 -305 L 187 -305 L 187 -103 L 534 -103 L 534 0 Z M 468 204 Q 424 204 394 180 Q 364 156 364 114 Q 364 85 377 62 Q 391 40 410 24 Q 429 8 446 -1 L 534 0 Q 522 5 504 15 Q 487 25 470 38 Q 453 52 441 69 Q 430 86 430 104 Q 430 123 442 133 Q 454 143 471 143 Q 486 143 503 135 Q 520 127 536 111 L 574 153 Q 554 177 528 190 Q 501 204 468 204 Z" }
GLYPHS.S["Ż"] = { 598, "M 29 0 L 29 -96 L 438 -630 L 455 -594 L 53 -594 L 53 -697 L 555 -697 L 555 -601 L 155 -81 L 140 -103 L 567 -103 L 567 0 Z M 241 -778 L 241 -901 L 362 -901 L 362 -778 Z" }
GLYPHS.S["Ź"] = { 598, "M 29 0 L 29 -96 L 438 -630 L 455 -594 L 53 -594 L 53 -697 L 555 -697 L 555 -601 L 155 -81 L 140 -103 L 567 -103 L 567 0 Z M 260 -759 L 371 -901 L 490 -901 L 342 -759 Z" }
GLYPHS.S["Ž"] = { 598, "M 29 0 L 29 -96 L 438 -630 L 455 -594 L 53 -594 L 53 -697 L 555 -697 L 555 -601 L 155 -81 L 140 -103 L 567 -103 L 567 0 Z M 301 -739 L 147 -901 L 233 -901 L 301 -825 L 370 -901 L 456 -901 Z" }
GLYPHS.S["Š"] = { 572, "M 296 13 Q 186 13 116 -44 Q 47 -101 31 -196 L 144 -224 Q 155 -158 197 -124 Q 238 -90 299 -90 Q 333 -90 360 -103 Q 387 -115 402 -138 Q 418 -161 418 -190 Q 418 -221 401 -241 Q 384 -262 352 -278 Q 320 -295 274 -313 Q 211 -337 167 -365 Q 123 -393 100 -432 Q 77 -470 77 -523 Q 77 -578 104 -620 Q 131 -663 180 -687 Q 229 -711 293 -711 Q 362 -711 415 -680 Q 468 -649 500 -586 L 408 -530 Q 387 -568 357 -589 Q 327 -609 289 -609 Q 262 -609 240 -598 Q 218 -588 205 -569 Q 193 -550 193 -525 Q 193 -499 208 -480 Q 223 -460 254 -444 Q 286 -428 335 -409 Q 398 -385 442 -357 Q 486 -329 509 -291 Q 533 -252 533 -197 Q 533 -136 503 -89 Q 473 -42 419 -14 Q 366 13 296 13 Z M 286 -739 L 131 -901 L 217 -901 L 286 -825 L 354 -901 L 440 -901 Z" }
GLYPHS.S["Ő"] = { 748, "M 372 14 Q 274 14 200 -31 Q 126 -76 84 -158 Q 43 -240 43 -348 Q 43 -457 84 -539 Q 126 -621 200 -666 Q 274 -711 372 -711 Q 472 -711 547 -666 Q 621 -621 663 -539 Q 704 -458 704 -348 Q 704 -239 662 -158 Q 620 -76 546 -31 Q 471 14 372 14 Z M 372 -96 Q 439 -96 487 -127 Q 535 -158 561 -215 Q 588 -271 588 -348 Q 588 -426 561 -482 Q 535 -539 487 -570 Q 439 -601 372 -601 Q 307 -601 259 -570 Q 211 -540 184 -483 Q 158 -427 158 -348 Q 158 -270 184 -214 Q 210 -157 259 -127 Q 307 -96 372 -96 Z M 426 -740 L 537 -901 L 655 -901 L 508 -740 Z M 238 -740 L 349 -901 L 449 -901 L 320 -740 Z" }
GLYPHS.S["Õ"] = { 748, "M 372 14 Q 274 14 200 -31 Q 126 -76 84 -158 Q 43 -240 43 -348 Q 43 -457 84 -539 Q 126 -621 200 -666 Q 274 -711 372 -711 Q 472 -711 547 -666 Q 621 -621 663 -539 Q 704 -458 704 -348 Q 704 -239 662 -158 Q 620 -76 546 -31 Q 471 14 372 14 Z M 372 -96 Q 439 -96 487 -127 Q 535 -158 561 -215 Q 588 -271 588 -348 Q 588 -426 561 -482 Q 535 -539 487 -570 Q 439 -601 372 -601 Q 307 -601 259 -570 Q 211 -540 184 -483 Q 158 -427 158 -348 Q 158 -270 184 -214 Q 210 -157 259 -127 Q 307 -96 372 -96 Z M 436 -742 Q 413 -742 396 -749 Q 380 -756 368 -767 Q 356 -778 346 -788 Q 337 -799 327 -806 Q 318 -813 306 -813 Q 290 -813 281 -796 Q 271 -779 271 -747 L 207 -747 Q 207 -808 235 -841 Q 263 -874 311 -874 Q 332 -874 347 -867 Q 362 -860 374 -849 Q 386 -838 396 -828 Q 406 -817 416 -810 Q 426 -802 438 -802 Q 451 -802 461 -821 Q 470 -839 470 -871 L 537 -871 Q 537 -809 510 -776 Q 483 -742 436 -742 Z" }
GLYPHS.S["×"] = { 560, "M 133 -32 L 65 -99 L 211 -246 L 64 -394 L 132 -462 L 278 -315 L 426 -462 L 495 -393 L 348 -246 L 495 -99 L 426 -32 L 278 -178 Z" }
GLYPHS.S["→"] = { 1136, "M 570 -3 L 532 -77 L 881 -273 L 885 -257 L 24 -257 L 24 -339 L 885 -339 L 881 -323 L 532 -518 L 570 -593 L 1099 -298 Z" }
GLYPHS.B["A"] = { 674, "M 8 0 L 288 -697 L 385 -697 L 665 0 L 524 0 L 338 -506 L 149 0 Z M 192 -136 L 232 -252 L 442 -252 L 484 -136 Z" }
GLYPHS.B["B"] = { 611, "M 67 0 L 67 -697 L 312 -697 Q 416 -697 475 -650 Q 534 -604 534 -521 Q 534 -473 514 -436 Q 494 -398 458 -377 Q 516 -355 544 -312 Q 572 -268 572 -204 Q 572 -108 511 -54 Q 451 0 344 0 Z M 196 -119 L 334 -119 Q 443 -119 443 -210 Q 443 -254 416 -278 Q 390 -302 341 -302 L 196 -302 Z M 196 -417 L 318 -417 Q 358 -417 382 -440 Q 405 -462 405 -501 Q 405 -538 381 -558 Q 357 -578 312 -578 L 196 -578 Z" }
GLYPHS.B["C"] = { 709, "M 373 16 Q 274 16 198 -30 Q 123 -76 81 -158 Q 39 -240 39 -349 Q 39 -458 81 -540 Q 123 -621 198 -667 Q 274 -713 373 -713 Q 484 -713 564 -657 Q 645 -602 680 -505 L 558 -460 Q 536 -521 488 -555 Q 441 -589 373 -589 Q 311 -589 264 -560 Q 218 -531 193 -477 Q 169 -424 169 -349 Q 169 -274 193 -220 Q 218 -166 264 -137 Q 311 -108 373 -108 Q 441 -108 488 -142 Q 536 -176 558 -237 L 680 -193 Q 645 -96 564 -40 Q 484 16 373 16 Z" }
GLYPHS.B["D"] = { 674, "M 67 0 L 67 -697 L 270 -697 Q 444 -697 539 -605 Q 634 -513 634 -343 Q 634 -177 540 -88 Q 446 0 269 0 Z M 196 -119 L 256 -119 Q 335 -119 390 -139 Q 445 -159 474 -209 Q 504 -259 504 -348 Q 504 -434 475 -485 Q 447 -535 394 -557 Q 342 -578 268 -578 L 196 -578 Z" }
GLYPHS.B["E"] = { 578, "M 67 0 L 67 -697 L 531 -697 L 531 -581 L 196 -581 L 196 -415 L 509 -415 L 509 -300 L 196 -300 L 196 -116 L 531 -116 L 531 0 Z" }
GLYPHS.B["F"] = { 558, "M 67 0 L 67 -697 L 533 -697 L 533 -581 L 196 -581 L 196 -415 L 489 -415 L 489 -300 L 196 -300 L 196 0 Z" }
GLYPHS.B["G"] = { 735, "M 365 16 Q 269 16 196 -30 Q 123 -76 81 -158 Q 39 -240 39 -349 Q 39 -458 81 -540 Q 123 -621 198 -667 Q 274 -713 373 -713 Q 484 -713 564 -657 Q 645 -602 680 -505 L 558 -460 Q 536 -521 488 -555 Q 441 -589 373 -589 Q 311 -589 264 -560 Q 218 -531 193 -477 Q 169 -424 169 -349 Q 169 -274 193 -220 Q 218 -166 264 -137 Q 311 -108 373 -108 Q 405 -108 439 -117 Q 473 -126 501 -148 Q 530 -171 548 -211 Q 565 -251 565 -313 L 565 -353 L 594 -263 L 394 -263 L 394 -379 L 680 -379 L 680 0 L 566 0 L 548 -113 L 570 -96 Q 552 -59 521 -34 Q 490 -9 451 3 Q 411 16 365 16 Z" }
GLYPHS.B["H"] = { 693, "M 67 0 L 67 -697 L 196 -697 L 196 -418 L 497 -418 L 497 -697 L 626 -697 L 626 0 L 497 0 L 497 -299 L 196 -299 L 196 0 Z" }
GLYPHS.B["I"] = { 263, "M 67 0 L 67 -697 L 196 -697 L 196 0 Z" }
GLYPHS.B["J"] = { 556, "M 258 16 Q 157 16 93 -46 Q 28 -108 21 -219 L 149 -232 Q 153 -164 180 -134 Q 208 -104 258 -104 Q 317 -104 341 -142 Q 364 -181 364 -249 L 364 -581 L 103 -581 L 103 -697 L 494 -697 L 494 -242 Q 494 -162 466 -105 Q 437 -47 384 -16 Q 331 16 258 16 Z" }
GLYPHS.B["K"] = { 663, "M 170 -210 L 170 -374 L 476 -697 L 650 -697 Z M 67 0 L 67 -697 L 196 -697 L 196 0 Z M 499 0 L 279 -351 L 375 -441 L 652 0 Z" }
GLYPHS.B["L"] = { 504, "M 67 0 L 67 -697 L 196 -697 L 196 -116 L 493 -116 L 493 0 Z" }
GLYPHS.B["M"] = { 856, "M 67 0 L 67 -697 L 256 -697 L 440 -191 L 417 -191 L 600 -697 L 789 -697 L 789 0 L 660 0 L 660 -546 L 672 -544 L 491 -61 L 366 -61 L 185 -544 L 196 -546 L 196 0 Z" }
GLYPHS.B["N"] = { 689, "M 67 0 L 67 -697 L 200 -697 L 525 -169 L 493 -169 L 493 -697 L 622 -697 L 622 0 L 488 0 L 164 -529 L 196 -529 L 196 0 Z" }
GLYPHS.B["O"] = { 747, "M 373 16 Q 274 16 198 -30 Q 123 -75 81 -157 Q 39 -239 39 -348 Q 39 -458 81 -540 Q 123 -622 198 -667 Q 274 -713 373 -713 Q 473 -713 548 -667 Q 624 -622 666 -540 Q 708 -458 708 -348 Q 708 -239 665 -157 Q 623 -75 547 -30 Q 472 16 373 16 Z M 372 -108 Q 436 -108 482 -138 Q 527 -167 552 -221 Q 577 -275 577 -348 Q 577 -422 552 -476 Q 527 -530 481 -559 Q 436 -589 372 -589 Q 311 -589 264 -560 Q 218 -531 193 -477 Q 169 -423 169 -348 Q 169 -274 193 -220 Q 218 -166 264 -137 Q 311 -108 372 -108 Z" }
GLYPHS.B["P"] = { 562, "M 67 0 L 67 -697 L 297 -697 Q 415 -697 475 -647 Q 535 -596 535 -495 Q 535 -394 474 -341 Q 413 -288 297 -288 L 195 -288 L 195 0 Z M 195 -403 L 284 -403 Q 342 -403 374 -423 Q 406 -444 406 -494 Q 406 -542 375 -562 Q 345 -581 284 -581 L 195 -581 Z" }
GLYPHS.B["Q"] = { 785, "M 373 16 Q 274 16 199 -30 Q 124 -75 82 -157 Q 39 -239 39 -348 Q 39 -458 81 -540 Q 123 -621 198 -667 Q 274 -713 373 -713 Q 473 -713 548 -667 Q 624 -622 666 -540 Q 708 -458 708 -348 Q 708 -239 665 -157 Q 623 -75 547 -30 Q 472 16 373 16 Z M 668 56 L 383 -220 L 459 -300 L 746 -20 Z M 372 -108 Q 436 -108 482 -138 Q 527 -167 552 -221 Q 577 -275 577 -348 Q 577 -422 552 -476 Q 527 -530 481 -559 Q 436 -589 372 -589 Q 311 -589 264 -560 Q 218 -531 193 -477 Q 169 -423 169 -348 Q 169 -274 193 -220 Q 218 -166 264 -137 Q 311 -108 372 -108 Z" }
GLYPHS.B["R"] = { 612, "M 67 0 L 67 -697 L 297 -697 Q 382 -697 434 -672 Q 486 -648 511 -602 Q 535 -557 535 -495 Q 535 -399 480 -347 Q 426 -294 325 -288 Q 302 -287 278 -287 Q 254 -287 237 -287 L 196 -287 L 196 0 Z M 446 0 L 271 -302 L 403 -318 L 595 0 Z M 196 -403 L 284 -403 Q 317 -403 345 -410 Q 372 -418 389 -437 Q 406 -457 406 -493 Q 406 -530 389 -549 Q 372 -568 345 -575 Q 317 -581 284 -581 L 196 -581 Z" }
GLYPHS.B["S"] = { 575, "M 297 13 Q 186 13 115 -45 Q 43 -103 28 -199 L 154 -230 Q 165 -166 204 -134 Q 244 -102 302 -102 Q 333 -102 358 -112 Q 382 -123 397 -144 Q 411 -164 411 -192 Q 411 -218 396 -237 Q 381 -256 350 -272 Q 320 -288 274 -305 Q 208 -331 164 -360 Q 119 -390 97 -429 Q 75 -468 75 -521 Q 75 -577 103 -620 Q 130 -663 180 -688 Q 229 -713 295 -713 Q 365 -713 419 -680 Q 474 -648 507 -584 L 404 -521 Q 383 -559 355 -578 Q 326 -598 291 -598 Q 266 -598 247 -589 Q 227 -579 216 -563 Q 204 -546 204 -524 Q 204 -501 218 -483 Q 231 -465 262 -448 Q 292 -432 341 -414 Q 406 -390 450 -361 Q 493 -332 516 -293 Q 539 -255 539 -200 Q 539 -138 509 -89 Q 478 -41 424 -14 Q 370 13 297 13 Z" }
GLYPHS.B["T"] = { 584, "M 227 0 L 227 -581 L 11 -581 L 11 -697 L 573 -697 L 573 -581 L 358 -581 L 358 0 Z" }
GLYPHS.B["U"] = { 657, "M 328 16 Q 196 16 129 -51 Q 61 -118 61 -252 L 61 -697 L 190 -697 L 190 -267 Q 190 -213 202 -176 Q 213 -140 244 -122 Q 274 -103 328 -103 Q 382 -103 413 -122 Q 443 -140 455 -176 Q 467 -213 467 -266 L 467 -697 L 596 -697 L 596 -257 Q 596 -121 528 -53 Q 460 16 328 16 Z" }
GLYPHS.B["V"] = { 672, "M 288 0 L 9 -697 L 151 -697 L 358 -159 L 317 -159 L 520 -697 L 663 -697 L 385 0 Z" }
GLYPHS.B["W"] = { 979, "M 223 0 L 13 -697 L 149 -697 L 293 -198 L 426 -657 L 554 -657 L 686 -198 L 831 -697 L 966 -697 L 756 0 L 631 0 L 479 -502 L 500 -502 L 349 0 Z" }
GLYPHS.B["X"] = { 670, "M 14 0 L 246 -348 L 14 -697 L 169 -697 L 335 -438 L 501 -697 L 655 -697 L 424 -348 L 657 0 L 502 0 L 334 -254 L 168 0 Z" }
GLYPHS.B["Y"] = { 625, "M 249 0 L 249 -273 L 4 -697 L 152 -697 L 310 -401 L 474 -697 L 621 -697 L 378 -273 L 378 0 Z" }
GLYPHS.B["Z"] = { 605, "M 28 0 L 28 -106 L 433 -622 L 452 -581 L 51 -581 L 51 -697 L 563 -697 L 563 -591 L 170 -90 L 152 -116 L 577 -116 L 577 0 Z" }
GLYPHS.B["a"] = { 546, "M 377 0 L 367 -74 L 367 -311 Q 367 -355 340 -377 Q 312 -398 265 -398 Q 226 -398 185 -383 Q 145 -367 114 -339 L 51 -424 Q 103 -466 157 -484 Q 212 -503 275 -503 Q 377 -503 434 -452 Q 491 -401 491 -311 L 491 0 Z M 228 10 Q 174 10 131 -10 Q 89 -30 64 -67 Q 40 -104 40 -152 Q 40 -195 58 -225 Q 75 -256 104 -272 Q 129 -287 159 -293 Q 190 -299 225 -299 L 378 -299 L 378 -207 L 243 -207 Q 227 -207 211 -204 Q 196 -202 185 -193 Q 175 -186 170 -176 Q 165 -165 165 -152 Q 165 -124 187 -107 Q 209 -90 246 -90 Q 279 -90 307 -105 Q 334 -119 351 -145 Q 367 -170 367 -203 L 400 -137 Q 387 -85 360 -53 Q 334 -20 300 -5 Q 266 10 228 10 Z" }
GLYPHS.B["b"] = { 574, "M 326 10 Q 289 10 255 -5 Q 220 -19 194 -54 Q 168 -88 155 -146 L 185 -132 L 185 0 L 61 0 L 61 -697 L 185 -697 L 185 -360 L 159 -352 Q 168 -403 193 -436 Q 217 -470 252 -486 Q 287 -503 326 -503 Q 384 -503 432 -472 Q 480 -442 508 -385 Q 536 -328 536 -247 Q 536 -174 511 -116 Q 486 -57 438 -24 Q 391 10 326 10 Z M 292 -104 Q 329 -104 356 -122 Q 382 -139 397 -171 Q 412 -203 412 -247 Q 412 -291 397 -323 Q 382 -354 356 -372 Q 329 -389 292 -389 Q 256 -389 229 -372 Q 203 -354 188 -322 Q 174 -290 174 -247 Q 174 -204 188 -172 Q 203 -140 229 -122 Q 256 -104 292 -104 Z" }
GLYPHS.B["c"] = { 522, "M 278 10 Q 218 10 174 -11 Q 129 -33 98 -69 Q 68 -105 53 -151 Q 38 -197 38 -247 Q 38 -296 53 -342 Q 68 -388 98 -424 Q 129 -460 174 -482 Q 218 -503 278 -503 Q 353 -503 408 -467 Q 463 -431 490 -358 L 382 -315 Q 370 -350 345 -373 Q 321 -395 278 -395 Q 238 -395 212 -374 Q 186 -352 174 -318 Q 162 -284 162 -247 Q 162 -210 174 -175 Q 186 -141 212 -120 Q 238 -98 278 -98 Q 321 -98 345 -121 Q 370 -143 382 -179 L 490 -136 Q 463 -62 408 -26 Q 353 10 278 10 Z" }
GLYPHS.B["f"] = { 348, "M 99 0 L 99 -396 L 10 -396 L 10 -493 L 100 -493 L 100 -545 Q 100 -609 121 -644 Q 142 -679 178 -693 Q 213 -707 254 -707 Q 285 -707 307 -701 Q 330 -696 351 -686 L 311 -591 Q 301 -596 290 -600 Q 279 -603 268 -603 Q 244 -603 234 -587 Q 224 -571 224 -544 L 224 -493 L 329 -493 L 329 -396 L 224 -396 L 224 0 Z" }
GLYPHS.B["g"] = { 522, "M 269 214 Q 159 214 96 175 Q 32 136 32 67 Q 32 61 33 53 Q 34 44 36 36 L 174 -50 L 205 -15 L 142 62 Q 141 65 141 67 Q 141 69 141 71 Q 141 99 176 114 Q 211 129 269 129 Q 318 129 344 116 Q 370 104 370 80 Q 370 67 363 59 Q 356 51 340 46 Q 324 41 298 37 Q 273 33 237 28 Q 191 23 147 9 Q 103 -4 74 -31 Q 45 -57 45 -101 Q 45 -140 72 -173 Q 99 -205 143 -226 L 203 -178 Q 176 -174 163 -160 Q 149 -146 149 -127 Q 149 -111 162 -102 Q 175 -92 199 -87 Q 223 -82 256 -78 Q 307 -71 351 -63 Q 394 -55 427 -41 Q 459 -26 476 -1 Q 494 24 494 64 Q 494 137 435 176 Q 377 214 269 214 Z M 259 -138 Q 197 -138 151 -161 Q 104 -185 78 -226 Q 52 -266 52 -319 Q 52 -374 79 -416 Q 107 -457 154 -480 Q 200 -503 255 -503 Q 309 -503 355 -480 Q 402 -457 430 -415 Q 459 -372 459 -315 Q 459 -261 433 -221 Q 408 -182 363 -160 Q 318 -138 259 -138 Z M 256 -236 Q 296 -236 316 -261 Q 335 -285 335 -320 Q 335 -356 314 -378 Q 293 -401 256 -401 Q 219 -401 198 -378 Q 176 -355 176 -320 Q 176 -285 196 -261 Q 216 -236 256 -236 Z M 425 -389 L 336 -447 L 450 -538 L 513 -461 Z" }
GLYPHS.B["h"] = { 564, "M 61 0 L 61 -697 L 186 -697 L 186 -381 L 165 -378 Q 178 -423 204 -451 Q 229 -478 262 -490 Q 296 -503 330 -503 Q 414 -503 461 -455 Q 509 -408 509 -322 L 509 0 L 384 0 L 384 -276 Q 384 -338 362 -366 Q 340 -395 293 -395 Q 240 -395 213 -357 Q 186 -319 186 -236 L 186 0 Z" }
GLYPHS.B["i"] = { 245, "M 60 0 L 60 -493 L 184 -493 L 184 0 Z M 56 -569 L 56 -697 L 189 -697 L 189 -569 Z" }
GLYPHS.B["j"] = { 245, "M 63 214 Q 43 214 20 210 Q -3 206 -25 199 L -25 91 Q -12 95 -1 96 Q 10 98 18 98 Q 38 98 49 89 Q 60 79 60 51 L 60 -493 L 184 -493 L 184 85 Q 184 151 151 183 Q 118 214 63 214 Z M 57 -569 L 57 -697 L 189 -697 L 189 -569 Z" }
GLYPHS.B["k"] = { 560, "M 395 0 L 252 -225 L 175 -139 L 175 -294 L 364 -493 L 522 -493 L 343 -309 L 543 0 Z M 61 0 L 61 -697 L 186 -697 L 186 0 Z" }
GLYPHS.B["l"] = { 278, "M 176 10 Q 125 10 92 -21 Q 59 -52 59 -119 L 59 -697 L 182 -697 L 182 -143 Q 182 -122 192 -114 Q 202 -105 218 -105 Q 226 -105 235 -106 Q 244 -108 254 -111 L 254 -5 Q 233 3 212 6 Q 192 10 176 10 Z" }
GLYPHS.B["m"] = { 843, "M 61 0 L 61 -493 L 186 -493 L 186 -365 L 159 -344 Q 166 -391 183 -422 Q 200 -453 223 -470 Q 247 -488 272 -495 Q 298 -503 323 -503 Q 362 -503 397 -488 Q 432 -474 458 -439 Q 484 -404 494 -343 L 420 -316 Q 435 -386 463 -427 Q 492 -468 530 -485 Q 567 -503 609 -503 Q 672 -503 711 -475 Q 750 -447 769 -403 Q 787 -360 787 -311 L 787 0 L 663 0 L 663 -281 Q 663 -318 654 -344 Q 644 -369 626 -382 Q 608 -395 579 -395 Q 549 -395 528 -379 Q 507 -363 497 -331 Q 486 -299 486 -249 L 486 0 L 362 0 L 362 -283 Q 362 -339 342 -367 Q 321 -395 282 -395 Q 251 -395 229 -379 Q 208 -363 197 -331 Q 186 -299 186 -249 L 186 0 Z" }
GLYPHS.B["o"] = { 572, "M 287 10 Q 215 10 159 -23 Q 103 -56 70 -115 Q 38 -173 38 -247 Q 38 -322 70 -379 Q 102 -437 159 -470 Q 215 -503 287 -503 Q 358 -503 414 -470 Q 470 -437 502 -379 Q 534 -322 534 -247 Q 534 -173 502 -115 Q 470 -57 414 -24 Q 358 10 287 10 Z M 287 -99 Q 325 -99 353 -117 Q 380 -135 395 -168 Q 409 -201 409 -247 Q 409 -294 395 -326 Q 380 -359 353 -377 Q 325 -394 287 -394 Q 248 -394 220 -376 Q 192 -359 177 -326 Q 162 -294 162 -247 Q 162 -201 177 -168 Q 192 -135 220 -117 Q 248 -99 287 -99 Z" }
GLYPHS.B["p"] = { 574, "M 61 204 L 61 -493 L 185 -493 L 185 -361 L 155 -351 Q 168 -410 194 -443 Q 221 -476 255 -489 Q 289 -503 326 -503 Q 391 -503 438 -469 Q 486 -436 511 -378 Q 536 -320 536 -246 Q 536 -166 508 -109 Q 480 -51 432 -21 Q 384 10 326 10 Q 287 10 252 -6 Q 217 -22 193 -55 Q 168 -87 159 -137 L 185 -133 L 185 204 Z M 292 -104 Q 329 -104 356 -121 Q 382 -139 397 -171 Q 412 -203 412 -246 Q 412 -290 397 -322 Q 382 -354 356 -371 Q 329 -389 292 -389 Q 256 -389 229 -371 Q 203 -353 188 -322 Q 174 -290 174 -246 Q 174 -203 188 -171 Q 203 -139 229 -121 Q 256 -104 292 -104 Z" }
GLYPHS.B["q"] = { 574, "M 390 204 L 390 -133 L 415 -137 Q 407 -87 382 -55 Q 357 -22 323 -6 Q 288 10 248 10 Q 191 10 143 -21 Q 95 -51 66 -109 Q 38 -166 38 -246 Q 38 -320 64 -378 Q 89 -436 136 -469 Q 183 -503 248 -503 Q 285 -503 320 -489 Q 354 -476 380 -443 Q 407 -410 419 -351 L 390 -361 L 390 -493 L 513 -493 L 513 204 Z M 282 -104 Q 319 -104 345 -121 Q 372 -139 386 -171 Q 401 -203 401 -246 Q 401 -290 386 -322 Q 372 -353 345 -371 Q 319 -389 282 -389 Q 246 -389 219 -371 Q 192 -354 177 -322 Q 163 -290 163 -246 Q 163 -203 177 -171 Q 192 -139 219 -121 Q 246 -104 282 -104 Z" }
GLYPHS.B["s"] = { 472, "M 232 10 Q 177 10 136 -6 Q 95 -22 67 -46 Q 38 -70 21 -92 L 106 -166 Q 123 -138 155 -114 Q 186 -91 233 -91 Q 270 -91 291 -105 Q 311 -120 311 -142 Q 311 -160 298 -171 Q 285 -183 263 -191 Q 241 -198 214 -205 Q 186 -213 156 -223 Q 126 -233 101 -250 Q 76 -266 61 -292 Q 45 -318 45 -357 Q 45 -422 96 -463 Q 147 -503 231 -503 Q 290 -503 338 -480 Q 386 -456 414 -412 L 337 -351 Q 319 -380 289 -394 Q 260 -409 227 -409 Q 198 -409 180 -398 Q 161 -387 161 -368 Q 161 -355 169 -346 Q 178 -337 198 -330 Q 217 -324 249 -316 Q 279 -309 311 -299 Q 343 -289 371 -272 Q 399 -255 416 -227 Q 433 -199 433 -156 Q 433 -107 408 -69 Q 383 -32 338 -11 Q 293 10 232 10 Z" }
GLYPHS.B["t"] = { 367, "M 249 10 Q 209 10 175 -5 Q 141 -20 121 -54 Q 100 -88 100 -145 L 100 -608 L 226 -675 L 226 -179 Q 226 -136 237 -114 Q 249 -92 283 -92 Q 293 -92 305 -94 Q 318 -96 333 -100 L 333 -5 Q 312 3 291 6 Q 270 10 249 10 Z M 10 -396 L 10 -493 L 333 -493 L 333 -396 Z" }
GLYPHS.B["u"] = { 564, "M 235 10 Q 175 10 135 -14 Q 94 -38 75 -82 Q 55 -126 55 -185 L 55 -493 L 179 -493 L 179 -216 Q 179 -182 187 -155 Q 195 -129 216 -114 Q 236 -98 272 -98 Q 316 -98 339 -123 Q 361 -148 370 -192 Q 378 -237 378 -297 L 378 -493 L 502 -493 L 502 0 L 378 0 L 378 -107 L 395 -97 Q 373 -40 330 -15 Q 287 10 235 10 Z" }
GLYPHS.B["v"] = { 535, "M 217 0 L 15 -493 L 151 -493 L 267 -162 L 385 -493 L 519 -493 L 319 0 Z" }
GLYPHS.B["x"] = { 542, "M 20 0 L 188 -249 L 20 -493 L 167 -493 L 271 -330 L 375 -493 L 522 -493 L 352 -249 L 522 0 L 375 0 L 271 -166 L 166 0 Z" }
GLYPHS.B["y"] = { 535, "M 101 204 L 201 -38 L 15 -493 L 151 -493 L 267 -162 L 385 -493 L 519 -493 L 236 204 Z" }
GLYPHS.B["z"] = { 471, "M 35 0 L 35 -83 L 308 -423 L 318 -390 L 46 -390 L 46 -493 L 432 -493 L 432 -404 L 162 -63 L 152 -103 L 432 -103 L 432 0 Z" }
GLYPHS.B[" "] = { 260, "" }
GLYPHS.B["'"] = { 193, "M 44 -410 L 44 -697 L 149 -697 L 149 -410 Z" }
GLYPHS.B[","] = { 240, "M 25 149 L 94 -156 L 233 -156 L 107 149 Z" }
GLYPHS.B["-"] = { 327, "M 40 -249 L 40 -342 L 288 -342 L 288 -249 Z" }
GLYPHS.B["·"] = { 308, "M 89 -283 L 89 -415 L 213 -415 L 213 -283 Z" }
GLYPHS.B["É"] = { 578, "M 67 0 L 67 -697 L 531 -697 L 531 -581 L 196 -581 L 196 -415 L 509 -415 L 509 -300 L 196 -300 L 196 -116 L 531 -116 L 531 0 Z M 254 -759 L 365 -901 L 499 -901 L 344 -759 Z" }
GLYPHS.B["é"] = { 541, "M 281 10 Q 217 10 171 -11 Q 125 -32 95 -67 Q 66 -103 52 -149 Q 38 -194 38 -244 Q 38 -292 52 -338 Q 66 -384 94 -421 Q 122 -458 167 -481 Q 211 -503 273 -503 Q 331 -503 374 -483 Q 417 -464 445 -429 Q 473 -395 488 -349 Q 502 -303 502 -251 Q 502 -244 501 -231 Q 501 -219 499 -205 L 162 -205 Q 167 -152 202 -125 Q 236 -98 288 -98 Q 326 -98 362 -111 Q 398 -125 426 -150 L 488 -66 Q 453 -39 422 -22 Q 391 -5 357 2 Q 324 10 281 10 Z M 379 -267 Q 381 -275 383 -283 Q 384 -291 384 -298 Q 384 -319 376 -338 Q 368 -356 354 -370 Q 340 -384 320 -392 Q 301 -399 276 -399 Q 239 -399 214 -384 Q 189 -369 177 -346 Q 164 -322 161 -297 L 421 -297 Z M 228 -555 L 340 -697 L 473 -697 L 319 -555 Z" }
GLYPHS.B["á"] = { 546, "M 377 0 L 367 -74 L 367 -311 Q 367 -355 340 -377 Q 312 -398 265 -398 Q 226 -398 185 -383 Q 145 -367 114 -339 L 51 -424 Q 103 -466 157 -484 Q 212 -503 275 -503 Q 377 -503 434 -452 Q 491 -401 491 -311 L 491 0 Z M 228 10 Q 174 10 131 -10 Q 89 -30 64 -67 Q 40 -104 40 -152 Q 40 -195 58 -225 Q 75 -256 104 -272 Q 129 -287 159 -293 Q 190 -299 225 -299 L 378 -299 L 378 -207 L 243 -207 Q 227 -207 211 -204 Q 196 -202 185 -193 Q 175 -186 170 -176 Q 165 -165 165 -152 Q 165 -124 187 -107 Q 209 -90 246 -90 Q 279 -90 307 -105 Q 334 -119 351 -145 Q 367 -170 367 -203 L 400 -137 Q 387 -85 360 -53 Q 334 -20 300 -5 Q 266 10 228 10 Z M 229 -555 L 341 -697 L 474 -697 L 320 -555 Z" }
GLYPHS.B["í"] = { 245, "M 60 0 L 60 -493 L 184 -493 L 184 0 Z M 77 -555 L 188 -697 L 322 -697 L 167 -555 Z" }
GLYPHS.B["ó"] = { 572, "M 287 10 Q 215 10 159 -23 Q 103 -56 70 -115 Q 38 -173 38 -247 Q 38 -322 70 -379 Q 102 -437 159 -470 Q 215 -503 287 -503 Q 358 -503 414 -470 Q 470 -437 502 -379 Q 534 -322 534 -247 Q 534 -173 502 -115 Q 470 -57 414 -24 Q 358 10 287 10 Z M 287 -99 Q 325 -99 353 -117 Q 380 -135 395 -168 Q 409 -201 409 -247 Q 409 -294 395 -326 Q 380 -359 353 -377 Q 325 -394 287 -394 Q 248 -394 220 -376 Q 192 -359 177 -326 Q 162 -294 162 -247 Q 162 -201 177 -168 Q 192 -135 220 -117 Q 248 -99 287 -99 Z M 241 -555 L 352 -697 L 486 -697 L 331 -555 Z" }
GLYPHS.B["ú"] = { 564, "M 235 10 Q 175 10 135 -14 Q 94 -38 75 -82 Q 55 -126 55 -185 L 55 -493 L 179 -493 L 179 -216 Q 179 -182 187 -155 Q 195 -129 216 -114 Q 236 -98 272 -98 Q 316 -98 339 -123 Q 361 -148 370 -192 Q 378 -237 378 -297 L 378 -493 L 502 -493 L 502 0 L 378 0 L 378 -107 L 395 -97 Q 373 -40 330 -15 Q 287 10 235 10 Z M 232 -555 L 344 -697 L 477 -697 L 323 -555 Z" }
GLYPHS.B["ñ"] = { 564, "M 61 0 L 61 -493 L 186 -493 L 186 -381 L 166 -379 Q 179 -424 204 -451 Q 229 -478 262 -490 Q 295 -503 330 -503 Q 414 -503 461 -455 Q 509 -408 509 -322 L 509 0 L 384 0 L 384 -276 Q 384 -338 362 -366 Q 340 -395 293 -395 Q 257 -395 233 -378 Q 210 -362 198 -327 Q 186 -292 186 -236 L 186 0 Z M 337 -556 Q 308 -556 289 -566 Q 270 -576 257 -589 Q 244 -603 233 -613 Q 222 -623 209 -623 Q 195 -623 187 -606 Q 179 -589 179 -557 L 107 -557 Q 107 -626 136 -663 Q 165 -700 214 -700 Q 240 -700 258 -689 Q 276 -679 289 -665 Q 303 -652 314 -641 Q 326 -631 339 -631 Q 350 -631 359 -648 Q 367 -665 367 -697 L 442 -697 Q 442 -629 414 -592 Q 385 -556 337 -556 Z" }
GLYPHS.B["ç"] = { 522, "M 278 10 Q 218 10 174 -11 Q 129 -33 98 -69 Q 68 -105 53 -151 Q 38 -197 38 -247 Q 38 -296 53 -342 Q 68 -388 98 -424 Q 129 -460 174 -482 Q 218 -503 278 -503 Q 353 -503 408 -467 Q 463 -431 490 -358 L 382 -315 Q 370 -350 345 -373 Q 321 -395 278 -395 Q 238 -395 212 -374 Q 186 -352 174 -318 Q 162 -284 162 -247 Q 162 -210 174 -175 Q 186 -141 212 -120 Q 238 -98 278 -98 Q 321 -98 345 -121 Q 370 -143 382 -179 L 490 -136 Q 463 -62 408 -26 Q 353 10 278 10 Z M 267 204 Q 255 204 237 202 Q 220 199 203 194 Q 185 188 173 180 L 205 129 Q 218 136 233 141 Q 248 145 262 145 Q 278 145 290 138 Q 303 131 303 115 Q 303 102 293 94 Q 283 86 267 82 Q 251 78 233 77 Q 214 76 196 76 L 258 -11 L 317 -10 L 280 36 Q 323 42 349 62 Q 374 82 374 116 Q 374 156 344 180 Q 313 204 267 204 Z" }
GLYPHS.B["ü"] = { 564, "M 235 10 Q 175 10 135 -14 Q 94 -38 75 -82 Q 55 -126 55 -185 L 55 -493 L 179 -493 L 179 -216 Q 179 -182 187 -155 Q 195 -129 216 -114 Q 236 -98 272 -98 Q 316 -98 339 -123 Q 361 -148 370 -192 Q 378 -237 378 -297 L 378 -493 L 502 -493 L 502 0 L 378 0 L 378 -107 L 395 -97 Q 373 -40 330 -15 Q 287 10 235 10 Z M 310 -569 L 310 -697 L 443 -697 L 443 -569 Z M 114 -569 L 114 -697 L 246 -697 L 246 -569 Z" }
GLYPHS.B["ã"] = { 546, "M 377 0 L 367 -74 L 367 -311 Q 367 -355 340 -377 Q 312 -398 265 -398 Q 226 -398 185 -383 Q 145 -367 114 -339 L 51 -424 Q 103 -466 157 -484 Q 212 -503 275 -503 Q 377 -503 434 -452 Q 491 -401 491 -311 L 491 0 Z M 228 10 Q 174 10 131 -10 Q 89 -30 64 -67 Q 40 -104 40 -152 Q 40 -195 58 -225 Q 75 -256 104 -272 Q 129 -287 159 -293 Q 190 -299 225 -299 L 378 -299 L 378 -207 L 243 -207 Q 227 -207 211 -204 Q 196 -202 185 -193 Q 175 -186 170 -176 Q 165 -165 165 -152 Q 165 -124 187 -107 Q 209 -90 246 -90 Q 279 -90 307 -105 Q 334 -119 351 -145 Q 367 -170 367 -203 L 400 -137 Q 387 -85 360 -53 Q 334 -20 300 -5 Q 266 10 228 10 Z M 337 -556 Q 308 -556 289 -566 Q 270 -576 257 -589 Q 244 -603 233 -613 Q 222 -623 209 -623 Q 195 -623 187 -606 Q 179 -589 179 -557 L 107 -557 Q 107 -626 136 -663 Q 165 -700 214 -700 Q 240 -700 258 -689 Q 276 -679 289 -665 Q 303 -652 314 -641 Q 326 -631 339 -631 Q 350 -631 359 -648 Q 367 -665 367 -697 L 442 -697 Q 442 -629 414 -592 Q 385 -556 337 -556 Z" }
GLYPHS.B["ö"] = { 572, "M 287 10 Q 215 10 159 -23 Q 103 -56 70 -115 Q 38 -173 38 -247 Q 38 -322 70 -379 Q 102 -437 159 -470 Q 215 -503 287 -503 Q 358 -503 414 -470 Q 470 -437 502 -379 Q 534 -322 534 -247 Q 534 -173 502 -115 Q 470 -57 414 -24 Q 358 10 287 10 Z M 287 -99 Q 325 -99 353 -117 Q 380 -135 395 -168 Q 409 -201 409 -247 Q 409 -294 395 -326 Q 380 -359 353 -377 Q 325 -394 287 -394 Q 248 -394 220 -376 Q 192 -359 177 -326 Q 162 -294 162 -247 Q 162 -201 177 -168 Q 192 -135 220 -117 Q 248 -99 287 -99 Z M 319 -569 L 319 -697 L 451 -697 L 451 -569 Z M 122 -569 L 122 -697 L 255 -697 L 255 -569 Z" }
GLYPHS.B["è"] = { 541, "M 281 10 Q 217 10 171 -11 Q 125 -32 95 -67 Q 66 -103 52 -149 Q 38 -194 38 -244 Q 38 -292 52 -338 Q 66 -384 94 -421 Q 122 -458 167 -481 Q 211 -503 273 -503 Q 331 -503 374 -483 Q 417 -464 445 -429 Q 473 -395 488 -349 Q 502 -303 502 -251 Q 502 -244 501 -231 Q 501 -219 499 -205 L 162 -205 Q 167 -152 202 -125 Q 236 -98 288 -98 Q 326 -98 362 -111 Q 398 -125 426 -150 L 488 -66 Q 453 -39 422 -22 Q 391 -5 357 2 Q 324 10 281 10 Z M 379 -267 Q 381 -275 383 -283 Q 384 -291 384 -298 Q 384 -319 376 -338 Q 368 -356 354 -370 Q 340 -384 320 -392 Q 301 -399 276 -399 Q 239 -399 214 -384 Q 189 -369 177 -346 Q 164 -322 161 -297 L 421 -297 Z M 228 -555 L 84 -697 L 216 -697 L 320 -555 Z" }
GLYPHS.B["ï"] = { 245, "M 60 0 L 60 -493 L 184 -493 L 184 0 Z M 155 -569 L 155 -697 L 287 -697 L 287 -569 Z M -42 -569 L -42 -697 L 91 -697 L 91 -569 Z" }
GLYPHS.B["Á"] = { 674, "M 8 0 L 288 -697 L 385 -697 L 665 0 L 524 0 L 338 -506 L 149 0 Z M 192 -136 L 232 -252 L 442 -252 L 484 -136 Z M 292 -759 L 403 -901 L 537 -901 L 382 -759 Z" }
GLYPHS.B["%"] = { 735, "M 100 0 L 541 -697 L 629 -697 L 188 0 Z M 544 10 Q 502 10 467 -10 Q 433 -30 412 -67 Q 392 -104 392 -153 Q 392 -202 412 -238 Q 432 -274 466 -294 Q 500 -314 542 -314 Q 585 -314 619 -293 Q 654 -271 674 -235 Q 694 -198 694 -152 Q 694 -108 674 -71 Q 654 -34 621 -12 Q 587 10 544 10 Z M 544 -74 Q 563 -74 578 -84 Q 593 -94 602 -112 Q 610 -130 610 -152 Q 610 -177 601 -194 Q 592 -212 577 -221 Q 561 -230 542 -230 Q 524 -230 509 -222 Q 494 -213 485 -196 Q 476 -179 476 -153 Q 476 -127 485 -109 Q 495 -91 511 -83 Q 526 -74 544 -74 Z M 195 -383 Q 152 -383 118 -403 Q 83 -423 62 -460 Q 41 -496 41 -545 Q 41 -594 62 -631 Q 82 -667 116 -687 Q 151 -707 192 -707 Q 235 -707 269 -685 Q 304 -664 324 -627 Q 344 -590 344 -544 Q 344 -500 324 -464 Q 304 -427 271 -405 Q 238 -383 195 -383 Z M 195 -467 Q 213 -467 228 -477 Q 242 -487 251 -505 Q 259 -523 259 -544 Q 259 -569 250 -587 Q 241 -604 226 -614 Q 211 -623 192 -623 Q 174 -623 159 -614 Q 143 -606 134 -589 Q 125 -571 125 -545 Q 125 -519 135 -502 Q 144 -484 160 -476 Q 175 -467 195 -467 Z" }
GLYPHS.B[":"] = { 240, "M 53 -338 L 53 -471 L 187 -471 L 187 -338 Z M 53 0 L 53 -132 L 187 -132 L 187 0 Z" }
GLYPHS.L["Á"] = { 619, "M 23 0 L 282 -697 L 337 -697 L 595 0 L 524 0 L 310 -606 L 96 0 Z M 151 -179 L 172 -238 L 447 -238 L 469 -179 Z M 286 -761 L 393 -901 L 461 -901 L 334 -761 Z" }
GLYPHS.L["É"] = { 587, "M 85 0 L 85 -697 L 541 -697 L 541 -638 L 150 -638 L 150 -384 L 501 -384 L 501 -325 L 150 -325 L 150 -59 L 541 -59 L 541 0 Z M 289 -761 L 397 -901 L 465 -901 L 337 -761 Z" }

-- =====================================================================
-- colours, easing, tweens
-- =====================================================================
local function hex(h: number, a: number?): Color
    local r = bit32.band(bit32.rshift(h, 16), 255)
    local g = bit32.band(bit32.rshift(h, 8), 255)
    local b = bit32.band(h, 255)
    return Color.rgba(r, g, b, math.floor(255 * math.clamp(a or 1, 0, 1) + 0.5))
end

local BG, SURF, TEXT, MUTED, DIM = hex(0x000000), hex(0x161616), hex(0xF3F2EF), hex(0x85847F), hex(0x43423F)
local HAIR = hex(0xFFFFFF, 0.1)
local LIVE, CARD, RED = hex(0x34E39A), hex(0xE7C94A), hex(0xFF5A5A)
local INK = hex(0x000000, 0.86)
local INK_DARK = hex(0x032616)
-- brand spectrum gradients (header mark, tab indicators, sheet)
local STOPS: { { { number } } } = {
    { { 0, 0xF7B9D0 }, { 0.55, 0xF9DCD6 }, { 0.76, 0xFBE9DF }, { 1, 0xF2A132 } },
    { { 0, 0x6AAEF0 }, { 0.34, 0xC9B8E0 }, { 0.58, 0xF2B3C9 }, { 1, 0xB0243C } },
    { { 0, 0x6B58F5 }, { 0.40, 0xA58FE6 }, { 0.76, 0xE7C1D6 }, { 1, 0xFFF0E6 } },
    { { 0, 0x3D6A45 }, { 0.45, 0x89A987 }, { 0.85, 0xE9B8CF }, { 1, 0xF6BDD6 } },
    { { 0, 0xA8C3EA }, { 0.38, 0xE2E2E4 }, { 0.68, 0xC9C92A }, { 1, 0xF0EED0 } },
}

local function C(x1: number, y1: number, x2: number, y2: number): Curve
    return { x1 = x1, y1 = y1, x2 = x2, y2 = y2 }
end
-- no curve overshoots: movement settles, it never bounces or wobbles
local EASE = C(0.2, 0.8, 0.2, 1)
local GLIDE = C(0.16, 1, 0.3, 1)
local INOUT = C(0.42, 0, 0.58, 1)
local IN = C(0.5, 0, 0.75, 0)
local LINEAR = C(0, 0, 1, 1)

local function bez(c: Curve, x: number): number
    if x <= 0 then return 0 end
    if x >= 1 then return 1 end
    local lo, hi, t = 0, 1, x
    for _ = 1, 16 do
        t = (lo + hi) * 0.5
        local u = 1 - t
        local cx = 3 * c.x1 * t * u * u + 3 * c.x2 * t * t * u + t * t * t
        if cx < x then lo = t else hi = t end
    end
    local u = 1 - t
    return 3 * c.y1 * t * u * u + 3 * c.y2 * t * t * u + t * t * t
end
local function prog(t: number, delay: number, dur: number): number
    if dur <= 0 then return if t >= delay then 1 else 0 end
    return math.clamp((t - delay) / dur, 0, 1)
end
local function ease(c: Curve, t: number, delay: number, dur: number): number
    return bez(c, prog(t, delay, dur))
end
local function lerp(a: number, b: number, p: number): number
    return a + (b - a) * p
end
-- rises over `inn` seconds, holds, falls over `out` seconds (0..1 envelope)
local function env(t: number, inn: number, hold: number, out: number): number
    if t <= 0 or t >= inn + hold + out then return 0 end
    if t < inn then return bez(EASE, t / inn) end
    if t < inn + hold then return 1 end
    return 1 - bez(INOUT, (t - inn - hold) / out)
end

local function tween(v: number): Tween
    return { a = v, b = v, t0 = -100, dur = 0.001, c = nil }
end
local function tv(tw: Tween, now: number): number
    return lerp(tw.a, tw.b, bez(tw.c or EASE, prog(now, tw.t0, tw.dur)))
end
local function retarget(tw: Tween, now: number, to: number, dur: number, c: Curve?)
    if math.abs(tw.b - to) < 0.0001 then return end
    tw.a = tv(tw, now)
    tw.b = to
    tw.t0 = now
    tw.dur = dur
    tw.c = c
end

-- motion controls: self.tm[key] = { dur, delay, stagger, curve }, read from the script inputs
local DEF_T: Timing = { dur = 0.5, delay = 0, stagger = 0.05, c = GLIDE }
local function tmOf(self: Scoreline, key: string): Timing
    return self.tm[key] or DEF_T
end
-- eased progress (0..1) of item i (0-based) of a section that started at t0
local function anim(self: Scoreline, key: string, now: number, t0: number, i: number?): number
    local s = self.tm[key] or DEF_T
    return bez(s.c, prog(now - t0, s.delay + (i or 0) * s.stagger, s.dur))
end
-- same, with a custom start offset instead of delay + i * stagger
local function animAt(self: Scoreline, key: string, now: number, t0: number, at: number): number
    local s = self.tm[key] or DEF_T
    return bez(s.c, prog(now - t0, at, s.dur))
end
-- retarget a tween with a section's duration and curve
local function retargetS(self: Scoreline, tw: Tween, now: number, to: number, key: string)
    local s = self.tm[key] or DEF_T
    retarget(tw, now, to, s.dur, s.c)
end

local function pad2(n: number): string
    return string.format("%02d", math.floor(n))
end

-- deterministic random (Park-Miller)
local function rng(seed: number): () -> number
    local s = ((math.floor(seed) * 16807 + 12345) % 2147483646) + 1
    for _ = 1, 4 do s = (s * 48271) % 2147483647 end
    return function(): number
        s = (s * 48271) % 2147483647
        return (s - 1) / 2147483646
    end
end

-- colour maths on 0xRRGGBB numbers
local function mix(a: number, b: number, p: number): number
    local function ch(x: number, s: number): number return bit32.band(bit32.rshift(x, s), 255) end
    local r = math.floor(lerp(ch(a, 16), ch(b, 16), p) + 0.5)
    local g = math.floor(lerp(ch(a, 8), ch(b, 8), p) + 0.5)
    local bl = math.floor(lerp(ch(a, 0), ch(b, 0), p) + 0.5)
    return r * 65536 + g * 256 + bl
end
local function luma(x: number): number
    local function lin(c: number): number
        c /= 255
        return if c <= 0.04045 then c / 12.92 else ((c + 0.055) / 1.055) ^ 2.4
    end
    return 0.2126 * lin(bit32.band(bit32.rshift(x, 16), 255)) + 0.7152 * lin(bit32.band(bit32.rshift(x, 8), 255)) + 0.0722 * lin(bit32.band(x, 255))
end
-- lighten a team colour until black text on it passes WCAG AA comfortably
local function pastel(x: number): number
    local p = 0.22
    local c = mix(x, 0xF7F2EA, p)
    while luma(c) < 0.36 and p < 0.95 do
        p += 0.06
        c = mix(x, 0xF7F2EA, p)
    end
    return c
end

-- =====================================================================
-- paths
-- =====================================================================
-- path commands as flat numbers: 1 = move, 2 = line, 3 = cubic, 4 = close, 5 = quadratic
local function parseCmds(s: string): { number }
    local out: { number } = {}
    local ops: { [string]: number } = { M = 1, L = 2, C = 3, Z = 4, Q = 5 }
    for w in string.gmatch(s, "%S+") do
        local op = ops[w]
        if op then table.insert(out, -op) else table.insert(out, tonumber(w) or 0) end
    end
    return out
end
-- writes commands into a path, shifted by (dx, dy) and scaled by k.
-- Quadratic curves are converted to cubics (only moveTo, lineTo, cubicTo are used).
local function emit(p: Path, c: { number }, dx: number, dy: number, k: number)
    local i, n = 1, #c
    local cx, cy = 0, 0
    while i <= n do
        local op = -c[i]
        if op == 1 then
            cx, cy = c[i + 1], c[i + 2]
            p:moveTo(Vector.xy(cx * k + dx, cy * k + dy))
            i += 3
        elseif op == 2 then
            cx, cy = c[i + 1], c[i + 2]
            p:lineTo(Vector.xy(cx * k + dx, cy * k + dy))
            i += 3
        elseif op == 3 then
            p:cubicTo(Vector.xy(c[i + 1] * k + dx, c[i + 2] * k + dy), Vector.xy(c[i + 3] * k + dx, c[i + 4] * k + dy), Vector.xy(c[i + 5] * k + dx, c[i + 6] * k + dy))
            cx, cy = c[i + 5], c[i + 6]
            i += 7
        elseif op == 5 then
            local qx, qy, ex, ey = c[i + 1], c[i + 2], c[i + 3], c[i + 4]
            local c1x, c1y = cx + (qx - cx) * 2 / 3, cy + (qy - cy) * 2 / 3
            local c2x, c2y = ex + (qx - ex) * 2 / 3, ey + (qy - ey) * 2 / 3
            p:cubicTo(Vector.xy(c1x * k + dx, c1y * k + dy), Vector.xy(c2x * k + dx, c2y * k + dy), Vector.xy(ex * k + dx, ey * k + dy))
            cx, cy = ex, ey
            i += 5
        elseif op == 4 then
            p:close()
            i += 1
        else
            i += 1
        end
    end
end

local function parsePath(s: string): Path
    local p = Path.new()
    emit(p, parseCmds(s), 0, 0, 1)
    return p
end

local addCircle: (p: Path, cx: number, cy: number, r: number) -> ()
local roundRectPath: (w: number, h: number, tl: number, tr: number, br: number, bl: number) -> Path
do
    local K = 0.5523
    addCircle = function(p: Path, cx: number, cy: number, r: number)
        local k = K * r
        p:moveTo(Vector.xy(cx + r, cy))
        p:cubicTo(Vector.xy(cx + r, cy + k), Vector.xy(cx + k, cy + r), Vector.xy(cx, cy + r))
        p:cubicTo(Vector.xy(cx - k, cy + r), Vector.xy(cx - r, cy + k), Vector.xy(cx - r, cy))
        p:cubicTo(Vector.xy(cx - r, cy - k), Vector.xy(cx - k, cy - r), Vector.xy(cx, cy - r))
        p:cubicTo(Vector.xy(cx + k, cy - r), Vector.xy(cx + r, cy - k), Vector.xy(cx + r, cy))
        p:close()
    end

    roundRectPath = function(w: number, h: number, tl: number, tr: number, br: number, bl: number): Path
        local m = math.min(w, h) / 2
        tl, tr, br, bl = math.min(tl, m), math.min(tr, m), math.min(br, m), math.min(bl, m)
        local p = Path.new()
        p:moveTo(Vector.xy(tl, 0))
        p:lineTo(Vector.xy(w - tr, 0))
        if tr > 0 then p:cubicTo(Vector.xy(w - tr + tr * K, 0), Vector.xy(w, tr - tr * K), Vector.xy(w, tr)) end
        p:lineTo(Vector.xy(w, h - br))
        if br > 0 then p:cubicTo(Vector.xy(w, h - br + br * K), Vector.xy(w - br + br * K, h), Vector.xy(w - br, h)) end
        p:lineTo(Vector.xy(bl, h))
        if bl > 0 then p:cubicTo(Vector.xy(bl - bl * K, h), Vector.xy(0, h - bl + bl * K), Vector.xy(0, h - bl)) end
        p:lineTo(Vector.xy(0, tl))
        if tl > 0 then p:cubicTo(Vector.xy(0, tl - tl * K), Vector.xy(tl - tl * K, 0), Vector.xy(tl, 0)) end
        p:close()
        return p
    end
end

local function shape(self: Scoreline, w: number, h: number, tl: number, tr: number, br: number, bl: number): Path
    -- the same few hundred shapes are asked for every frame: a small direct-mapped table in
    -- front of the keyed cache answers them without building a key string each time
    local shapes = self.shapes
    local fast = self.sfast
    local slot = math.floor(w * 4 + h * 9 + tl * 17 + tr * 29 + br * 41 + bl * 53) % 1024 + 1
    local e = fast[slot]
    if e ~= nil and e[1] == w and e[2] == h and e[3] == tl and e[4] == tr and e[5] == br and e[6] == bl and e[8] == shapes then
        return e[7] :: Path
    end
    local key = string.format("%.1f|%.1f|%.1f|%.1f|%.1f|%.1f", w, h, tl, tr, br, bl)
    local p = shapes[key]
    if p == nil then
        p = roundRectPath(w, h, tl, tr, br, bl)
        shapes[key] = p
        self.scount += 1
    end
    if e == nil then
        e = {}
        fast[slot] = e
    end
    e[1], e[2], e[3], e[4], e[5], e[6], e[7], e[8] = w, h, tl, tr, br, bl, p, shapes
    return p
end

-- =====================================================================
-- drawing helpers (paints, offsets for hit testing)
-- Every Paint is made once, for one look (colour, style, thickness, feather,
-- join or gradient), and is never changed after that. Recycling paints was
-- the one-frame flicker: Rive resets a paint's colour to black when its
-- gradient is cleared, so a recycled paint that had last carried a gradient
-- drew its next element black for a frame. Looks are cached; one that has
-- not been drawn for a second is let go.
-- =====================================================================
local function col(self: Scoreline, c: Color): Color
    if self.ga >= 0.999 then return c end
    return Color.opacity(c, Color.opacity(c) * math.clamp(self.ga, 0, 1))
end

-- a cache that is being replaced stays referenced for a while (see draw)
local function retire(self: Scoreline, t: any)
    table.insert(self.retired, { self.frame, t })
end

-- a solid look: colour (global opacity already applied) and stroke width (nil = fill)
local function solid(self: Scoreline, cc: Color, stroke: number?): Paint
    local byCol = self.pc[cc]
    if byCol == nil then
        byCol = {}
        self.pc[cc] = byCol
    end
    local k = stroke or 0
    local e = byCol[k]
    if e == nil then
        local p = if stroke then Paint.with({ style = "stroke", thickness = stroke, color = cc, cap = "round", join = "round" })
            else Paint.with({ style = "fill", color = cc })
        e = { p, self.frame }
        byCol[k] = e
        self.pn += 1
        return p
    end
    e[2] = self.frame
    return e[1] :: Paint
end

local function paint(self: Scoreline, c: Color, stroke: number?): Paint
    return solid(self, col(self, c), stroke)
end

-- a look with a feather and/or a miter join
local function lookPaint(self: Scoreline, c: Color, stroke: number?, feather: number, join: string?): Paint
    local cc = col(self, c)
    local key = tostring(cc) .. "|" .. tostring(stroke or 0) .. "|" .. tostring(feather) .. "|" .. (join or "")
    local e = self.px[key]
    if e == nil then
        local def: PaintDefinition = { style = if stroke then "stroke" else "fill", color = cc, feather = feather, cap = "round", join = "round" }
        if stroke then def.thickness = stroke end
        if join == "miter" then def.join = "miter" end
        local p = Paint.with(def)
        e = { p, self.frame }
        self.px[key] = e
        self.pn += 1
        return p
    end
    e[2] = self.frame
    return e[1] :: Paint
end

-- a gradient look; key names the gradient (it bakes in its own opacity).
-- No colour is ever set on it: setting one would drop the gradient.
local function gradLook(self: Scoreline, key: string, gr: Gradient, stroke: number?, feather: number?): Paint
    local k = if stroke then key .. "|s" .. tostring(stroke) else key
    if feather then k = k .. "|f" .. tostring(feather) end
    local e = self.px[k]
    if e == nil then
        local p = if stroke then Paint.with({ style = "stroke", thickness = stroke, gradient = gr, cap = "round", join = "round", feather = feather or 0 })
            else Paint.with({ style = "fill", gradient = gr, feather = feather or 0 })
        e = { p, self.frame }
        self.px[k] = e
        self.pn += 1
        return p
    end
    e[2] = self.frame
    return e[1] :: Paint
end

-- cached linear gradient from { {position, 0xRRGGBB}, ... }, in a 0..1 box
local function stopsPaint(self: Scoreline, key: string, stops: { { number } }, horizontal: boolean): Paint
    local a = math.clamp(math.floor(self.ga * 20 + 0.5), 0, 20)
    local k = key .. (if horizontal then "h" else "v") .. tostring(a)
    local gr = self.grads[k]
    if gr == nil then
        local gs: { GradientStop } = {}
        for _, s in stops do
            table.insert(gs, { position = s[1], color = hex(s[2], (s[3] or 1) * a / 20) })
        end
        gr = Gradient.linear(Vector.xy(0, 0), if horizontal then Vector.xy(1, 0) else Vector.xy(0, 1), gs)
        self.grads[k] = gr
        self.gcount += 1
    end
    return gradLook(self, k, gr)
end
local function gradPaint(self: Scoreline, g: number, horizontal: boolean): Paint
    return stopsPaint(self, "b" .. tostring(g), STOPS[g + 1], horizontal)
end

local function push(self: Scoreline, r: Renderer, dx: number, dy: number)
    r:save()
    r:transform(Mat2D.withTranslation(dx, dy))
    table.insert(self.ostack, dx)
    table.insert(self.ostack, dy)
    self.ox += dx
    self.oy += dy
end
local function pop(self: Scoreline, r: Renderer)
    local dy = table.remove(self.ostack) or 0
    local dx = table.remove(self.ostack) or 0
    self.ox -= dx
    self.oy -= dy
    r:restore()
end

-- a tap target; `id` lets the thing drawn there react to the press
local function hit(self: Scoreline, x: number, y: number, w: number, h: number, fn: () -> (), id: string?)
    local ax, ay = x + self.ox, y + self.oy
    local top = math.max(ay, self.clipTop)
    local bot = math.min(ay + h, self.clipBot)
    if bot - top < 2 then return end
    local left, right = math.max(ax, self.clipL), math.min(ax + w, self.clipR)
    if right - left < 2 then return end
    table.insert(self.hits, { x = left, y = top, w = right - left, h = bot - top, fn = fn, id = id or "" })
end

-- is a band of the current space (y .. y + h) inside what the pane is showing?
-- Rows, tiles and markers scrolled out of view are never drawn: they cost as much
-- as the ones you see, and the cost grows with every match, event and player added.
local function inView(self: Scoreline, y: number, h: number): boolean
    local ay = y + self.oy
    return ay + h > self.clipTop - 6 and ay < self.clipBot + 6
end

-- fills a w x h box at (x, y) with any paint (solid or gradient)
local function box(self: Scoreline, r: Renderer, x: number, y: number, w: number, h: number, p: Paint)
    if w <= 0 or h <= 0 then return end
    r:save()
    r:transform(Mat2D.withTranslation(x, y) * Mat2D.withScale(w, h))
    r:drawPath(self.unit, p)
    r:restore()
end
local function rect(self: Scoreline, r: Renderer, x: number, y: number, w: number, h: number, c: Color)
    box(self, r, x, y, w, h, paint(self, c))
end
local function gradRect(self: Scoreline, r: Renderer, x: number, y: number, w: number, h: number, g: number, horizontal: boolean)
    box(self, r, x, y, w, h, gradPaint(self, g, horizontal))
end
local function rrect(self: Scoreline, r: Renderer, x: number, y: number, w: number, h: number, rad: number, c: Color, stroke: number?)
    if w <= 0 or h <= 0 then return end
    r:save()
    r:transform(Mat2D.withTranslation(x, y))
    r:drawPath(shape(self, w, h, rad, rad, rad, rad), paint(self, c, stroke))
    r:restore()
end
-- rounded box filled with any paint; the paint's gradient spans the box
local function rbox(self: Scoreline, r: Renderer, x: number, y: number, w: number, h: number, rad: number, p: Paint)
    if w <= 0 or h <= 0 then return end
    r:save()
    r:transform(Mat2D.withTranslation(x, y))
    r:clipPath(shape(self, w, h, rad, rad, rad, rad))
    r:transform(Mat2D.withScale(w, h))
    r:drawPath(self.unit, p)
    r:restore()
end
local function rrect4(self: Scoreline, r: Renderer, x: number, y: number, w: number, h: number, tl: number, tr: number, br: number, bl: number, c: Color)
    if w <= 0 or h <= 0 then return end
    r:save()
    r:transform(Mat2D.withTranslation(x, y))
    r:drawPath(shape(self, w, h, tl, tr, br, bl), paint(self, c))
    r:restore()
end
local function circle(self: Scoreline, r: Renderer, cx: number, cy: number, rad: number, c: Color, stroke: number?)
    if rad <= 0 then return end
    r:save()
    r:transform(Mat2D.withTranslation(cx, cy) * Mat2D.withScale(rad, rad))
    local p = paint(self, c, if stroke then stroke / rad else nil)
    r:drawPath(self.circ, p)
    r:restore()
end
local function hline(self: Scoreline, r: Renderer, x: number, y: number, w: number, c: Color?)
    rect(self, r, x, y, w, 1, c or HAIR)
end
-- clips everything drawn until the caller's matching restore().
-- Uses the shared unit square, so no path is created per frame.
local function clipRect(self: Scoreline, r: Renderer, x: number, y: number, w: number, h: number)
    w, h = math.max(w, 0.001), math.max(h, 0.001)
    r:transform(Mat2D.withTranslation(x, y) * Mat2D.withScale(w, h))
    r:clipPath(self.unit)
    r:transform(Mat2D.withScale(1 / w, 1 / h) * Mat2D.withTranslation(-x, -y))
end

-- =====================================================================
-- photos: one atlas per squad (squad_fra / squad_arg, 4032 x 3556).
--   busts   576 x 720, 7 per row: waist-up, a short soft fade at the bottom
--   heads   224 x 224 from y 2880: head and neck, shoulders melted away
--   blurred 144 x 180 from y 3376: the bust, frosted (seen through glass)
-- Layout maths stays in the old 288 x 360 "design" units; ATLAS.k maps
-- them to atlas pixels.
-- =====================================================================
local ATLAS = { bw = 288, bh = 360, bcols = 7, k = 2, headY = 2880, headS = 224, headP = 232, headC = 17, blurY = 3376, blurW = 144, blurH = 180 }
local CROP: { face: { number }, chest: { number }, full: { number }, head: { number } } = {
    face = { 60, 8, 168, 168 },    -- head and the top of the shoulders
    chest = { 0, 8, 288, 268 },    -- down to just below the shirt number
    full = { 0, 0, 288, 360 },     -- the whole bust, soft bottom edge
    head = { 54, 4, 180, 180 },    -- what a head cut-out covers, in bust units
}

local function blit(self: Scoreline, r: Renderer, img: Image, sx: number, sy: number, sw: number, sh: number, dx: number, dy: number, dw: number, dh: number, opacity: number)
    if opacity * self.ga <= 0.004 or dw <= 0 or dh <= 0 then return end
    r:save()
    r:transform(Mat2D.withTranslation(dx, dy) * Mat2D.withScale(dw, dh))
    r:clipPath(self.unit)
    r:transform(Mat2D.withScale(1 / sw, 1 / sh) * Mat2D.withTranslation(-sx, -sy))
    r:drawImage(img, self.sampler, "srcOver", math.clamp(opacity * self.ga, 0, 1))
    r:restore()
end

local function hasPhoto(self: Scoreline, p: Person?): boolean
    return p ~= nil and p.cell > 0 and self.atlas[p.team] ~= nil
end

-- the part `src` (design units) of p's bust, drawn into the box (dx, dy, dw, dh)
local function bust(self: Scoreline, r: Renderer, p: Person, src: { number }, dx: number, dy: number, dw: number, dh: number, opacity: number?)
    local img = self.atlas[p.team]
    if img == nil or p.cell <= 0 then return end
    local i = p.cell - 1
    local k = ATLAS.k
    local cx = (i % ATLAS.bcols) * ATLAS.bw * k
    local cy = math.floor(i / ATLAS.bcols) * ATLAS.bh * k
    blit(self, r, img, cx + src[1] * k, cy + src[2] * k, src[3] * k, src[4] * k, dx, dy, dw, dh, opacity or 1)
end

-- the frosted copy of the whole bust, for the box the full bust occupies
local function frosted(self: Scoreline, r: Renderer, p: Person, dx: number, dy: number, dw: number, dh: number, opacity: number?)
    local img = self.atlas[p.team]
    if img == nil or p.cell <= 0 then return end
    blit(self, r, img, (p.cell - 1) * ATLAS.blurW, ATLAS.blurY, ATLAS.blurW, ATLAS.blurH, dx, dy, dw, dh, opacity or 1)
end

-- =====================================================================
-- text: glyphs baked from Hanken Grotesk (1000 units per em)
--   L = 300, R = 400, M = 500, S = 600, B = 700
-- =====================================================================
local function textPath(self: Scoreline, font: string, s: string, track: number): TextPath
    -- looked up by font, then tracking, then the string itself: no key string per call
    local tc = self.tcache
    local byFont = tc[font]
    if byFont == nil then
        byFont = {}
        tc[font] = byFont
    end
    local byTrack = byFont[track]
    if byTrack == nil then
        byTrack = {}
        byFont[track] = byTrack
    end
    local tp = byTrack[s]
    if tp ~= nil then return tp end
    local set = self.fonts[font]
    local p = Path.new()
    local x = 0
    local tr = track * 1000
    for _, cp in utf8.codes(s) do
        local ch = utf8.char(cp)
        local g = set[ch] or self.fonts.M[ch]
        if g then
            emit(p, g.cmds, x, 0, 1)
            x += g.adv + tr
        else
            x += 250 + tr
        end
    end
    tp = { path = p, adv = x }
    byTrack[s] = tp
    self.tcount += 1
    return tp
end

local function tw(self: Scoreline, font: string, s: string, size: number, track: number?): number
    return textPath(self, font, s, track or 0).adv * size / 1000
end

-- draws text; align 0 = left, 0.5 = centre, 1 = right. Returns width.
local function txt(self: Scoreline, r: Renderer, font: string, s: string, x: number, base: number, size: number, track: number, c: Color, align: number?): number
    if s == "" then return 0 end
    local tp = textPath(self, font, s, track)
    local w = tp.adv * size / 1000
    local x0 = x - w * (align or 0)
    local k = size / 1000
    r:save()
    r:transform(Mat2D.withTranslation(x0, base) * Mat2D.withScale(k, k))
    r:drawPath(tp.path, paint(self, c))
    r:restore()
    return w
end
-- the same text filled with one of our spectrum gradients (g = 0..4), running
-- diagonally across the glyphs. Returns width.
local function gradTxt(self: Scoreline, r: Renderer, font: string, s: string, x: number, base: number, size: number, track: number, g: number, align: number?): number
    if s == "" then return 0 end
    local tp = textPath(self, font, s, track)
    local w = tp.adv * size / 1000
    local x0 = x - w * (align or 0)
    local k = size / 1000
    local a = math.clamp(math.floor(self.ga * 20 + 0.5), 0, 20)
    local key = "gt" .. tostring(g) .. "|" .. tostring(math.floor(tp.adv)) .. "|" .. tostring(a)
    local gr = self.grads[key]
    if gr == nil then
        local gs: { GradientStop } = {}
        for _, st in STOPS[g + 1] do
            table.insert(gs, { position = st[1], color = hex(st[2], a / 20) })
        end
        gr = Gradient.linear(Vector.xy(0, -720), Vector.xy(tp.adv, 0), gs)
        self.grads[key] = gr
        self.gcount += 1
    end
    r:save()
    r:transform(Mat2D.withTranslation(x0, base) * Mat2D.withScale(k, k))
    r:drawPath(tp.path, gradLook(self, key, gr))
    r:restore()
    return w
end
-- a grey veil: drawn over something, it takes the colour out of it and keeps
-- its light and dark (saturation blend). k = 0..1
local function greyLook(self: Scoreline, k: number): Paint
    local a = math.clamp(math.floor(k * self.ga * 40 + 0.5), 0, 40)
    local key = "grey|" .. tostring(a)
    local e = self.px[key]
    if e == nil then
        local def: any = { style = "fill", color = hex(0x808080, a / 40), blendMode = "saturation" }
        local p = Paint.with(def)
        e = { p, self.frame }
        self.px[key] = e
        self.pn += 1
        return p
    end
    e[2] = self.frame
    return e[1] :: Paint
end
-- upper case that also handles the accented letters in the squads
local upper: (s: string) -> string
do
    local UPMAP: { [string]: string } = {
        ["é"] = "É", ["á"] = "Á", ["í"] = "Í", ["ó"] = "Ó", ["ú"] = "Ú", ["ï"] = "Ï", ["ü"] = "Ü", ["ñ"] = "Ñ",
        ["è"] = "È", ["ç"] = "Ç", ["ø"] = "Ø", ["ã"] = "Ã", ["ö"] = "Ö", ["ä"] = "Ä", ["ò"] = "Ò", ["ë"] = "Ë",
        ["ê"] = "Ê", ["õ"] = "Õ", ["ß"] = "SS", ["ł"] = "Ł", ["ś"] = "Ś", ["ń"] = "Ń", ["ą"] = "Ą", ["ć"] = "Ć",
        ["ę"] = "Ę", ["ż"] = "Ż", ["ź"] = "Ź", ["ž"] = "Ž", ["š"] = "Š", ["ő"] = "Ő",
    }
    upper = function(s: string): string
        local u = string.upper(s)
        return (string.gsub(u, "[\xC3-\xC5][\x80-\xBF]", function(c: string): string return UPMAP[c] or c end))
    end
end
-- uppercase tracked label (10.5px, +0.16em)
local function lab(self: Scoreline, r: Renderer, s: string, x: number, base: number, c: Color?, align: number?): number
    return txt(self, r, "M", upper(s), x, base, 10.5, 0.16, c or MUTED, align)
end
local function labW(self: Scoreline, s: string): number
    return tw(self, "M", upper(s), 10.5, 0.16)
end
-- baseline for text vertically centred on cy (CSS line-height: normal)
local function bc(cy: number, size: number): number
    return cy + 0.3485 * size
end
-- largest size (<= size) at which s fits in maxW
local function fit(self: Scoreline, font: string, s: string, size: number, track: number, maxW: number): number
    local w = tw(self, font, s, size, track)
    if w <= maxW or w <= 0 then return size end
    return size * maxW / w
end

-- word wrap into lines no wider than maxW
local function wrap(self: Scoreline, font: string, s: string, size: number, track: number, maxW: number): { string }
    local lines: { string } = {}
    local cur = ""
    for word in string.gmatch(s, "%S+") do
        local cand = if cur == "" then word else cur .. " " .. word
        if cur ~= "" and tw(self, font, cand, size, track) > maxW then
            table.insert(lines, cur)
            cur = word
        else
            cur = cand
        end
    end
    if cur ~= "" then table.insert(lines, cur) end
    return lines
end

-- =====================================================================
-- JSON: a small decoder for the live data (the feed and event properties)
-- =====================================================================
local jsonDecode: (s: string) -> any
do
    local sub, find = string.sub, string.find
    local ESC: { [string]: string } = { ['"'] = '"', ["\\"] = "\\", ["/"] = "/", b = "\b", f = "\f", n = "\n", r = "\r", t = "\t" }
    local function skip(s: string, i: number): number
        local _, e = find(s, "^[ \t\r\n]*", i)
        return (e or (i - 1)) + 1
    end
    local function str(s: string, i: number): (string, number)
        local out: { string } = {}
        local j = i + 1
        while true do
            local a = find(s, '["\\]', j)
            if a == nil then error("json: unterminated string") end
            table.insert(out, sub(s, j, a - 1))
            if sub(s, a, a) == '"' then return table.concat(out), a + 1 end
            local c = sub(s, a + 1, a + 1)
            if c == "u" then
                local cp = tonumber(sub(s, a + 2, a + 5), 16) or 63
                j = a + 6
                if cp >= 0xD800 and cp <= 0xDBFF and sub(s, j, j + 1) == "\\u" then
                    local lo = tonumber(sub(s, j + 2, j + 5), 16) or 0xDC00
                    cp = 0x10000 + (cp - 0xD800) * 0x400 + (lo - 0xDC00)
                    j += 6
                end
                table.insert(out, utf8.char(cp))
            else
                table.insert(out, ESC[c] or c)
                j = a + 2
            end
        end
    end
    local function value(s: string, i: number): (any, number)
        i = skip(s, i)
        local c = sub(s, i, i)
        if c == "{" then
            local t: { [string]: any } = {}
            i = skip(s, i + 1)
            if sub(s, i, i) == "}" then return t, i + 1 end
            while true do
                local k, v
                k, i = str(s, skip(s, i))
                i = skip(s, i) + 1 -- the colon
                v, i = value(s, i)
                t[k] = v
                i = skip(s, i)
                if sub(s, i, i) == "}" then return t, i + 1 end
                i += 1 -- the comma
            end
        elseif c == "[" then
            local t: { any } = {}
            local n = 0
            i = skip(s, i + 1)
            if sub(s, i, i) == "]" then return t, i + 1 end
            while true do
                local v
                v, i = value(s, i)
                n += 1
                t[n] = v
                i = skip(s, i)
                if sub(s, i, i) == "]" then return t, i + 1 end
                i += 1
            end
        elseif c == '"' then
            return str(s, i)
        elseif sub(s, i, i + 3) == "true" then
            return true, i + 4
        elseif sub(s, i, i + 4) == "false" then
            return false, i + 5
        elseif sub(s, i, i + 3) == "null" then
            return nil, i + 4
        end
        local a, b = find(s, "^-?%d+%.?%d*[eE]?[-+]?%d*", i)
        if a == nil or b == nil then error("json: unexpected character at " .. tostring(i)) end
        return tonumber(sub(s, a, b)), b + 1
    end
    jsonDecode = function(s: string): any
        if s == "" then return nil end
        local ok, v = pcall(value, s, 1)
        if ok then return v end
        return nil
    end
end



-- =====================================================================
-- DATA — plain tables only. Nothing in this section draws or animates.
-- =====================================================================
local DATA: { [string]: any } = {}
local TEAMS: { [string]: Team } = {}
do
    local function T(key: string, name: string, short: string, c1: number, c2: number)
        TEAMS[key] = { key = key, name = name, short = short, c1 = c1, c2 = c2 }
    end
    -- c1 is the colour the side is known by (flag / first kit), c2 the second one
    T("fra", "France", "FRA", 0x0055A4, 0xEF4135); T("arg", "Argentina", "ARG", 0x74ACDF, 0xF6B40E)
    T("eng", "England", "ENG", 0xCE1124, 0x1D3E8A); T("bra", "Brazil", "BRA", 0xFFDF00, 0x009C3B)
    T("ger", "Germany", "GER", 0xFFCE00, 0xDD0000); T("ned", "Netherlands", "NED", 0xF36C21, 0x21468B)
    T("bel", "Belgium", "BEL", 0xED2939, 0xFDDA24); T("aut", "Austria", "AUT", 0xC8102E, 0xF4F4F4)
    T("irl", "Ireland", "IRL", 0x169B62, 0xFF883E); T("pol", "Poland", "POL", 0xDC143C, 0xF4F4F4)
    T("nga", "Nigeria", "NGA", 0x008751, 0xF4F4F4); T("sen", "Senegal", "SEN", 0x00853F, 0xFDEF42)
    T("civ", "Ivory Coast", "CIV", 0xF77F00, 0x009E60); T("mli", "Mali", "MLI", 0x14B53A, 0xFCD116)
    T("swe", "Sweden", "SWE", 0x006AA7, 0xFECC02); T("den", "Denmark", "DEN", 0xC8102E, 0xF4F4F4)
    T("esp", "Spain", "ESP", 0xAA151B, 0xF1BF00); T("por", "Portugal", "POR", 0xDA291C, 0x046A38)
    T("col", "Colombia", "COL", 0xFCD116, 0x003893); T("mex", "Mexico", "MEX", 0x006847, 0xCE1126)
    T("ita", "Italy", "ITA", 0x0066B3, 0x009246); T("jpn", "Japan", "JPN", 0x1C3F94, 0xBC002D)
    T("mar", "Morocco", "MAR", 0xC1272D, 0x006233)
end

-- flags in a 30 x 30 box. ops: h/v stripes, r rect, c circle, cs ring, s star, p5 pentagram, d diamond, a arc, rr rounded rect
local FLAGS: { [string]: { { any } } } = {
    fra = { { "v", 0x0055A4, 0xFFFFFF, 0xEF4135 } },
    arg = { { "h", 0x74ACDF, 0xFFFFFF, 0x74ACDF }, { "c", 15, 15, 3.1, 0xF6B40E } },
    eng = { { "r", 0, 0, 30, 30, 0xFFFFFF }, { "r", 12.4, 0, 5.2, 30, 0xCE1124 }, { "r", 0, 12.4, 30, 5.2, 0xCE1124 } },
    bra = { { "r", 0, 0, 30, 30, 0x009C3B }, { "d", 0xFFDF00 }, { "c", 15, 15, 5.4, 0x002776 } },
    ger = { { "h", 0x2A2A2A, 0xDD0000, 0xFFCE00 } },
    ned = { { "h", 0xAE1C28, 0xFFFFFF, 0x21468B } },
    ita = { { "v", 0x009246, 0xFFFFFF, 0xCE2B37 } },
    bel = { { "v", 0x2A2A2A, 0xFDDA24, 0xEF3340 } },
    aut = { { "h", 0xEF3340, 0xFFFFFF, 0xEF3340 } },
    irl = { { "v", 0x169B62, 0xFFFFFF, 0xFF883E } },
    pol = { { "h", 0xFFFFFF, 0xDC143C } },
    jpn = { { "r", 0, 0, 30, 30, 0xFFFFFF }, { "c", 15, 15, 7.2, 0xBC002D } },
    col = { { "r", 0, 0, 30, 15.2, 0xFCD116 }, { "r", 0, 15, 30, 7.7, 0x003893 }, { "r", 0, 22.5, 30, 7.5, 0xCE1126 } },
    nga = { { "v", 0x008751, 0xFFFFFF, 0x008751 } },
    sen = { { "v", 0x00853F, 0xFDEF42, 0xE31B23 }, { "s", 15, 15, 3.6, 0x00853F } },
    civ = { { "v", 0xF77F00, 0xFFFFFF, 0x009E60 } },
    mli = { { "v", 0x14B53A, 0xFCD116, 0xCE1126 } },
    swe = { { "r", 0, 0, 30, 30, 0x006AA7 }, { "r", 8.5, 0, 5.5, 30, 0xFECC02 }, { "r", 0, 12.25, 30, 5.5, 0xFECC02 } },
    den = { { "r", 0, 0, 30, 30, 0xC8102E }, { "r", 8.5, 0, 5.5, 30, 0xFFFFFF }, { "r", 0, 12.25, 30, 5.5, 0xFFFFFF } },
    esp = { { "r", 0, 0, 30, 30, 0xAA151B }, { "r", 0, 7.5, 30, 15, 0xF1BF00 } },
    por = { { "r", 0, 0, 12.2, 30, 0x046A38 }, { "r", 12, 0, 18, 30, 0xDA291C }, { "cs", 12, 15, 5, 1.6, 0xFFE000 }, { "rr", 10.2, 12.6, 3.6, 4.6, 0.8, 0xFFFFFF, 0xDA291C } },
    mar = { { "r", 0, 0, 30, 30, 0xC1272D }, { "p5", 15, 15.6, 6.4, 0x006233, 1.15 } },
    mex = { { "v", 0x006847, 0xFFFFFF, 0xCE1126 }, { "c", 15, 15, 3.2, 0x8C5A2B }, { "a", 0x006847 } },
}

-- q: how many places qualify (top of the table), ql: what they qualify for
type League = { key: string, country: string, name: string, md: number, teams: { string }, prior: { { any } }, q: number?, ql: string? }
local LEAGUES: { [string]: League } = {
    wns = { key = "wns", country = "World", name = "Nations Series", md = 2, teams = { "fra", "arg", "eng", "bra" },
        prior = { { "fra", "eng", 1, 1 }, { "arg", "bra", 2, 0 } } },
    nla = { key = "nla", country = "Europe", name = "Nations League A", md = 2, teams = { "ger", "ned", "bel", "aut" },
        prior = { { "ger", "bel", 2, 1 }, { "ned", "aut", 0, 0 } } },
    nlb = { key = "nlb", country = "Europe", name = "Nations League B", md = 2, teams = { "irl", "pol", "swe", "den" },
        prior = { { "irl", "swe", 0, 1 }, { "pol", "den", 2, 2 } } },
    afq = { key = "afq", country = "Africa", name = "AFCON Qualifiers", md = 3, teams = { "nga", "sen", "civ", "mli" },
        prior = { { "nga", "mli", 2, 0 }, { "sen", "civ", 1, 1 }, { "civ", "nga", 1, 1 }, { "mli", "sen", 1, 3 } } },
    fri = { key = "fri", country = "World", name = "Friendlies", md = 1, teams = {}, prior = {} },
}
local LEAGUE_ORDER = { "wns", "nla", "nlb", "afq", "fri" }

local DAYS = { "Sat 19", "Yesterday", "Today", "Tomorrow", "Wed 23" }
local DAYMAP: { number } = { -1, 0, 1, 2, -1 }
local TABS = { "Facts", "Stats", "Lineup", "Table" }

-- fixtures: day (0 yesterday, 1 today, 2 tomorrow), league, home, away, score, status, minute, kick-off
DATA.fixtures = {
    { 1, "wns", "fra", "arg", 2, 1, "live", 58 },
    { 1, "wns", "eng", "bra", 0, 1, "live", 63 },
    { 1, "nla", "ger", "ned", 1, 1, "live", 76 },
    { 1, "nla", "bel", "aut", 0, 2, "live", 47 },
    { 1, "nlb", "irl", "pol", 2, 1, "live", 66 },
    { 1, "afq", "nga", "sen", 0, 0, "ns", 0, "21:00" },
    { 1, "afq", "civ", "mli", 0, 0, "ns", 0, "23:30" },
    { 0, "nlb", "swe", "den", 2, 2, "ft", 90 },
    { 0, "fri", "esp", "por", 1, 0, "ft", 90 },
    { 0, "fri", "col", "mex", 0, 3, "ft", 90 },
    { 2, "fri", "ita", "jpn", 0, 0, "ns", 0, "20:45" },
    { 2, "fri", "mar", "col", 0, 0, "ns", 0, "18:00" },
}

-- venue, city, referee, attendance (by home side)
DATA.venues = {
    fra = { "Stade de France", "Saint-Denis", "Szymon Marciniak", "78,412" },
    eng = { "Wembley Stadium", "London", "Felix Zwayer", "83,106" },
    ger = { "Allianz Arena", "Munich", "Anthony Taylor", "75,000" },
    bel = { "King Baudouin Stadium", "Brussels", "Clément Turpin", "47,560" },
    irl = { "Aviva Stadium", "Dublin", "Danny Makkelie", "49,212" },
    nga = { "Godswill Akpabio Stadium", "Uyo", "Mustapha Ghorbal", "" },
    civ = { "Stade Alassane Ouattara", "Abidjan", "Dahane Beida", "" },
    swe = { "Strawberry Arena", "Solna", "Daniel Siebert", "48,377" },
    esp = { "Riyadh Air Metropolitano", "Madrid", "Michael Oliver", "64,912" },
    col = { "Estadio Metropolitano", "Barranquilla", "Andrés Rojas", "45,808" },
    ita = { "Stadio Olimpico", "Rome", "François Letexier", "" },
    mar = { "Prince Moulay Abdellah Stadium", "Rabat", "Jesús Valenzuela", "" },
}

-- ---------------------------------------------------------------------
-- squads. France and Argentina: official FIFA World Cup 2026 numbers,
--   n, first, last, shirt name, line, role, club, born y m d, height cm
--   (the row order is the order of the photos in squad_fra / squad_arg)
-- every other side: n, first, last, shirt name, line
-- ---------------------------------------------------------------------
DATA.squads = {
    fra = {
        { 1, "Brice", "Samba", "Samba", "GK", "Goalkeeper", "Rennes", 1994, 4, 25, 186 },
        { 2, "Malo", "Gusto", "Gusto", "DF", "Right-back", "Chelsea", 2003, 5, 19, 179 },
        { 3, "Lucas", "Digne", "Digne", "DF", "Left-back", "Aston Villa", 1993, 7, 20, 178 },
        { 4, "Dayot", "Upamecano", "Upamecano", "DF", "Centre-back", "Bayern Munich", 1998, 10, 27, 186 },
        { 5, "Jules", "Koundé", "Koundé", "DF", "Right-back", "Barcelona", 1998, 11, 12, 178 },
        { 6, "Manu", "Koné", "Koné", "MF", "Central midfielder", "Roma", 2001, 5, 17, 185 },
        { 7, "Ousmane", "Dembélé", "Dembélé", "FW", "Forward", "Paris Saint-Germain", 1997, 5, 15, 178 },
        { 8, "Aurélien", "Tchouaméni", "Tchouaméni", "MF", "Defensive midfielder", "Real Madrid", 2000, 1, 27, 187 },
        { 9, "Marcus", "Thuram", "Thuram", "FW", "Centre-forward", "Inter", 1997, 8, 6, 192 },
        { 10, "Kylian", "Mbappé", "Mbappé", "FW", "Centre-forward", "Real Madrid", 1998, 12, 20, 178 },
        { 11, "Michael", "Olise", "Olise", "FW", "Right winger", "Bayern Munich", 2001, 12, 12, 184 },
        { 12, "Bradley", "Barcola", "Barcola", "FW", "Left winger", "Paris Saint-Germain", 2002, 9, 2, 182 },
        { 13, "N'Golo", "Kanté", "Kanté", "MF", "Defensive midfielder", "Fenerbahçe", 1991, 3, 29, 168 },
        { 14, "Adrien", "Rabiot", "Rabiot", "MF", "Central midfielder", "AC Milan", 1995, 4, 3, 188 },
        { 15, "Ibrahima", "Konaté", "Konaté", "DF", "Centre-back", "Liverpool", 1999, 5, 25, 194 },
        { 16, "Mike", "Maignan", "Maignan", "GK", "Goalkeeper", "AC Milan", 1995, 7, 3, 191 },
        { 17, "William", "Saliba", "Saliba", "DF", "Centre-back", "Arsenal", 2001, 3, 24, 192 },
        { 18, "Warren", "Zaïre-Emery", "Zaïre-Emery", "MF", "Central midfielder", "Paris Saint-Germain", 2006, 3, 8, 178 },
        { 19, "Theo", "Hernández", "T. Hernández", "DF", "Left-back", "Al Hilal", 1997, 10, 6, 184 },
        { 20, "Désiré", "Doué", "Doué", "FW", "Left winger", "Paris Saint-Germain", 2005, 6, 3, 181 },
        { 21, "Lucas", "Hernández", "L. Hernández", "DF", "Centre-back", "Paris Saint-Germain", 1996, 2, 14, 184 },
        { 22, "Jean-Philippe", "Mateta", "Mateta", "FW", "Centre-forward", "Crystal Palace", 1997, 6, 28, 192 },
        { 23, "Robin", "Risser", "Risser", "GK", "Goalkeeper", "Lens", 2004, 12, 2, 193 },
        { 24, "Rayan", "Cherki", "Cherki", "MF", "Attacking midfielder", "Manchester City", 2003, 8, 17, 177 },
        { 25, "Maghnes", "Akliouche", "Akliouche", "MF", "Attacking midfielder", "Monaco", 2002, 2, 25, 180 },
        { 26, "Maxence", "Lacroix", "Lacroix", "DF", "Centre-back", "Crystal Palace", 2000, 4, 6, 190 },
        { 0, "Didier", "Deschamps", "Deschamps", "CO", "Head coach", "France", 1968, 10, 15, 174 },
    },
    arg = {
        { 1, "Juan", "Musso", "Musso", "GK", "Goalkeeper", "Atlético Madrid", 1994, 5, 6, 191 },
        { 2, "Marcos", "Senesi", "Senesi", "DF", "Centre-back", "Tottenham", 1997, 5, 10, 185 },
        { 3, "Nicolás", "Tagliafico", "Tagliafico", "DF", "Left-back", "Lyon", 1992, 8, 31, 172 },
        { 4, "Gonzalo", "Montiel", "Montiel", "DF", "Right-back", "River Plate", 1997, 1, 1, 175 },
        { 5, "Leandro", "Paredes", "Paredes", "MF", "Defensive midfielder", "Boca Juniors", 1994, 6, 29, 180 },
        { 6, "Lisandro", "Martínez", "Li. Martínez", "DF", "Centre-back", "Manchester United", 1998, 1, 18, 175 },
        { 7, "Rodrigo", "De Paul", "De Paul", "MF", "Central midfielder", "Inter Miami", 1994, 5, 24, 180 },
        { 8, "Valentín", "Barco", "Barco", "MF", "Central midfielder", "Strasbourg", 2004, 7, 23, 172 },
        { 9, "Julián", "Álvarez", "Álvarez", "FW", "Centre-forward", "Atlético Madrid", 2000, 1, 31, 170 },
        { 10, "Lionel", "Messi", "Messi", "FW", "Forward", "Inter Miami", 1987, 6, 24, 170 },
        { 11, "Giovani", "Lo Celso", "Lo Celso", "MF", "Attacking midfielder", "Real Betis", 1996, 4, 9, 177 },
        { 12, "Gerónimo", "Rulli", "Rulli", "GK", "Goalkeeper", "Marseille", 1992, 5, 20, 189 },
        { 13, "Cristian", "Romero", "Romero", "DF", "Centre-back", "Tottenham", 1998, 4, 27, 185 },
        { 14, "Exequiel", "Palacios", "Palacios", "MF", "Central midfielder", "Bayer Leverkusen", 1998, 10, 5, 177 },
        { 15, "Nicolás", "González", "N. González", "MF", "Left winger", "Atlético Madrid", 1998, 4, 6, 180 },
        { 16, "Thiago", "Almada", "Almada", "FW", "Attacking midfielder", "Atlético Madrid", 2001, 4, 26, 171 },
        { 17, "Giuliano", "Simeone", "G. Simeone", "FW", "Right winger", "Atlético Madrid", 2002, 12, 18, 177 },
        { 18, "Nico", "Paz", "Nico Paz", "FW", "Attacking midfielder", "Como", 2004, 9, 8, 186 },
        { 19, "Nicolás", "Otamendi", "Otamendi", "DF", "Centre-back", "Benfica", 1988, 2, 12, 183 },
        { 20, "Alexis", "Mac Allister", "Mac Allister", "MF", "Central midfielder", "Liverpool", 1998, 12, 24, 176 },
        { 21, "José Manuel", "López", "López", "FW", "Centre-forward", "Palmeiras", 2000, 12, 6, 190 },
        { 22, "Lautaro", "Martínez", "Lautaro", "FW", "Centre-forward", "Inter", 1997, 8, 22, 174 },
        { 23, "Emiliano", "Martínez", "E. Martínez", "GK", "Goalkeeper", "Aston Villa", 1992, 9, 2, 195 },
        { 24, "Enzo", "Fernández", "E. Fernández", "MF", "Central midfielder", "Chelsea", 2001, 1, 17, 178 },
        { 25, "Facundo", "Medina", "Medina", "DF", "Centre-back", "Marseille", 1999, 5, 28, 184 },
        { 26, "Nahuel", "Molina", "Molina", "DF", "Right-back", "Atlético Madrid", 1998, 4, 6, 175 },
        { 0, "Lionel", "Scaloni", "Scaloni", "CO", "Head coach", "Argentina", 1978, 5, 16, 179 },
    },
    eng = {
        { 1, "Jordan", "Pickford", "Pickford", "GK" }, { 13, "Dean", "Henderson", "D. Henderson", "GK" }, { 23, "James", "Trafford", "Trafford", "GK" },
        { 2, "Reece", "James", "James", "DF" }, { 3, "Nico", "O'Reilly", "O'Reilly", "DF" }, { 5, "John", "Stones", "Stones", "DF" },
        { 6, "Marc", "Guéhi", "Guéhi", "DF" }, { 12, "Tino", "Livramento", "Livramento", "DF" }, { 15, "Ezri", "Konsa", "Konsa", "DF" },
        { 16, "Dan", "Burn", "Burn", "DF" }, { 4, "Declan", "Rice", "Rice", "MF" }, { 8, "Elliot", "Anderson", "Anderson", "MF" },
        { 10, "Jude", "Bellingham", "Bellingham", "MF" }, { 14, "Jordan", "Henderson", "J. Henderson", "MF" }, { 17, "Morgan", "Rogers", "Rogers", "MF" },
        { 20, "Kobbie", "Mainoo", "Mainoo", "MF" }, { 7, "Bukayo", "Saka", "Saka", "FW" }, { 9, "Harry", "Kane", "Kane", "FW" },
        { 11, "Marcus", "Rashford", "Rashford", "FW" }, { 18, "Anthony", "Gordon", "Gordon", "FW" }, { 19, "Ollie", "Watkins", "Watkins", "FW" },
        { 21, "Jarrod", "Bowen", "Bowen", "FW" }, { 22, "Eberechi", "Eze", "Eze", "FW" },
    },
    bra = {
        { 1, "Alisson", "Becker", "Alisson", "GK" }, { 23, "Ederson", "Moraes", "Ederson", "GK" }, { 12, "Bento", "Krepski", "Bento", "GK" },
        { 2, "Wesley", "França", "Wesley", "DF" }, { 3, "Gabriel", "Magalhães", "Gabriel", "DF" }, { 4, "", "Marquinhos", "Marquinhos", "DF" },
        { 6, "Alex", "Sandro", "Alex Sandro", "DF" }, { 14, "Éder", "Militão", "Militão", "DF" }, { 16, "Douglas", "Santos", "D. Santos", "DF" },
        { 22, "Gleison", "Bremer", "Bremer", "DF" }, { 5, "", "Casemiro", "Casemiro", "MF" }, { 8, "Bruno", "Guimarães", "Guimarães", "MF" },
        { 15, "Lucas", "Paquetá", "Paquetá", "MF" }, { 17, "Andrey", "Santos", "A. Santos", "MF" }, { 7, "Vinícius", "Júnior", "Vinícius Jr.", "FW" },
        { 9, "João", "Pedro", "João Pedro", "FW" }, { 10, "", "Rodrygo", "Rodrygo", "FW" }, { 11, "", "Raphinha", "Raphinha", "FW" },
        { 18, "Gabriel", "Martinelli", "Martinelli", "FW" }, { 19, "", "Estêvão", "Estêvão", "FW" }, { 20, "Matheus", "Cunha", "Cunha", "FW" },
    },
    ger = {
        { 1, "Oliver", "Baumann", "Baumann", "GK" }, { 12, "Alexander", "Nübel", "Nübel", "GK" }, { 21, "Jonas", "Urbig", "Urbig", "GK" },
        { 6, "Joshua", "Kimmich", "Kimmich", "DF" }, { 2, "Antonio", "Rüdiger", "Rüdiger", "DF" }, { 4, "Jonathan", "Tah", "Tah", "DF" },
        { 15, "Nico", "Schlotterbeck", "Schlotterbeck", "DF" }, { 3, "David", "Raum", "Raum", "DF" }, { 18, "Maximilian", "Mittelstädt", "Mittelstädt", "DF" },
        { 16, "Waldemar", "Anton", "Anton", "DF" }, { 13, "Ridle", "Baku", "Baku", "DF" }, { 23, "Aleksandar", "Pavlović", "Pavlović", "MF" },
        { 8, "Leon", "Goretzka", "Goretzka", "MF" }, { 5, "Pascal", "Groß", "Groß", "MF" }, { 17, "Florian", "Wirtz", "Wirtz", "MF" },
        { 10, "Jamal", "Musiala", "Musiala", "MF" }, { 7, "Serge", "Gnabry", "Gnabry", "FW" }, { 19, "Leroy", "Sané", "Sané", "FW" },
        { 11, "Karim", "Adeyemi", "Adeyemi", "FW" }, { 9, "Nick", "Woltemade", "Woltemade", "FW" }, { 20, "Deniz", "Undav", "Undav", "FW" },
        { 14, "Maximilian", "Beier", "Beier", "FW" },
    },
    ned = {
        { 1, "Bart", "Verbruggen", "Verbruggen", "GK" }, { 13, "Mark", "Flekken", "Flekken", "GK" }, { 23, "Robin", "Roefs", "Roefs", "GK" },
        { 4, "Virgil", "van Dijk", "Van Dijk", "DF" }, { 5, "Nathan", "Aké", "Aké", "DF" }, { 15, "Micky", "van de Ven", "Van de Ven", "DF" },
        { 22, "Denzel", "Dumfries", "Dumfries", "DF" }, { 2, "Jurriën", "Timber", "J. Timber", "DF" }, { 3, "Jan Paul", "van Hecke", "Van Hecke", "DF" },
        { 12, "Jeremie", "Frimpong", "Frimpong", "DF" }, { 21, "Frenkie", "de Jong", "De Jong", "MF" }, { 14, "Tijjani", "Reijnders", "Reijnders", "MF" },
        { 8, "Ryan", "Gravenberch", "Gravenberch", "MF" }, { 20, "Teun", "Koopmeiners", "Koopmeiners", "MF" }, { 16, "Quinten", "Timber", "Q. Timber", "MF" },
        { 7, "Xavi", "Simons", "Simons", "MF" }, { 11, "Cody", "Gakpo", "Gakpo", "FW" }, { 10, "Memphis", "Depay", "Depay", "FW" },
        { 18, "Donyell", "Malen", "Malen", "FW" }, { 9, "Wout", "Weghorst", "Weghorst", "FW" }, { 19, "Brian", "Brobbey", "Brobbey", "FW" },
    },
    bel = {
        { 1, "Thibaut", "Courtois", "Courtois", "GK" }, { 12, "Senne", "Lammens", "Lammens", "GK" }, { 13, "Matz", "Sels", "Sels", "GK" },
        { 21, "Timothy", "Castagne", "Castagne", "DF" }, { 2, "Zeno", "Debast", "Debast", "DF" }, { 3, "Arthur", "Theate", "Theate", "DF" },
        { 5, "Maxim", "De Cuyper", "De Cuyper", "DF" }, { 4, "Koni", "De Winter", "De Winter", "DF" }, { 15, "Thomas", "Meunier", "Meunier", "DF" },
        { 24, "Amadou", "Onana", "Onana", "MF" }, { 8, "Youri", "Tielemans", "Tielemans", "MF" }, { 7, "Kevin", "De Bruyne", "De Bruyne", "MF" },
        { 20, "Hans", "Vanaken", "Vanaken", "MF" }, { 18, "Nicolas", "Raskin", "Raskin", "MF" }, { 11, "Jérémy", "Doku", "Doku", "FW" },
        { 10, "Leandro", "Trossard", "Trossard", "FW" }, { 14, "Dodi", "Lukebakio", "Lukebakio", "FW" }, { 19, "Loïs", "Openda", "Openda", "FW" },
        { 22, "Charles", "De Ketelaere", "De Ketelaere", "FW" }, { 16, "Malick", "Fofana", "Fofana", "FW" }, { 9, "Romelu", "Lukaku", "Lukaku", "FW" },
    },
    aut = {
        { 13, "Patrick", "Pentz", "Pentz", "GK" }, { 1, "Alexander", "Schlager", "Schlager", "GK" }, { 12, "Tobias", "Lawal", "Lawal", "GK" },
        { 5, "Stefan", "Posch", "Posch", "DF" }, { 15, "Philipp", "Lienhart", "Lienhart", "DF" }, { 4, "Kevin", "Danso", "Danso", "DF" },
        { 16, "Phillipp", "Mwene", "Mwene", "DF" }, { 3, "Gernot", "Trauner", "Trauner", "DF" }, { 8, "David", "Alaba", "Alaba", "DF" },
        { 2, "Alexander", "Prass", "Prass", "DF" }, { 6, "Nicolas", "Seiwald", "Seiwald", "MF" }, { 20, "Konrad", "Laimer", "Laimer", "MF" },
        { 9, "Marcel", "Sabitzer", "Sabitzer", "MF" }, { 19, "Christoph", "Baumgartner", "Baumgartner", "MF" }, { 18, "Romano", "Schmid", "Schmid", "MF" },
        { 10, "Florian", "Grillitsch", "Grillitsch", "MF" }, { 23, "Patrick", "Wimmer", "Wimmer", "MF" }, { 7, "Marko", "Arnautović", "Arnautović", "FW" },
        { 11, "Michael", "Gregoritsch", "Gregoritsch", "FW" }, { 21, "Marco", "Grüll", "Grüll", "FW" },
    },
    irl = {
        { 1, "Caoimhín", "Kelleher", "Kelleher", "GK" }, { 23, "Gavin", "Bazunu", "Bazunu", "GK" }, { 16, "Mark", "Travers", "Travers", "GK" },
        { 2, "Jake", "O'Brien", "O'Brien", "DF" }, { 5, "Nathan", "Collins", "Collins", "DF" }, { 4, "Dara", "O'Shea", "O'Shea", "DF" },
        { 3, "Ryan", "Manning", "Manning", "DF" }, { 12, "Liam", "Scales", "Scales", "DF" }, { 21, "Festy", "Ebosele", "Ebosele", "DF" },
        { 6, "Josh", "Cullen", "Cullen", "MF" }, { 8, "Jason", "Knight", "Knight", "MF" }, { 14, "Finn", "Azaz", "Azaz", "MF" },
        { 13, "Jayson", "Molumby", "Molumby", "MF" }, { 10, "Will", "Smallbone", "Smallbone", "MF" }, { 11, "Chiedozie", "Ogbene", "Ogbene", "FW" },
        { 17, "Mikey", "Johnston", "Johnston", "FW" }, { 9, "Evan", "Ferguson", "Ferguson", "FW" }, { 20, "Troy", "Parrott", "Parrott", "FW" },
        { 7, "Sammie", "Szmodics", "Szmodics", "FW" }, { 19, "Adam", "Idah", "Idah", "FW" },
    },
    pol = {
        { 1, "Łukasz", "Skorupski", "Skorupski", "GK" }, { 22, "Marcin", "Bułka", "Bułka", "GK" }, { 12, "Kamil", "Grabara", "Grabara", "GK" },
        { 2, "Matty", "Cash", "Cash", "DF" }, { 5, "Jan", "Bednarek", "Bednarek", "DF" }, { 14, "Jakub", "Kiwior", "Kiwior", "DF" },
        { 4, "Przemysław", "Wiśniewski", "Wiśniewski", "DF" }, { 18, "Bartosz", "Bereszyński", "Bereszyński", "DF" }, { 21, "Nicola", "Zalewski", "Zalewski", "DF" },
        { 10, "Piotr", "Zieliński", "Zieliński", "MF" }, { 20, "Sebastian", "Szymański", "Szymański", "MF" }, { 6, "Jakub", "Moder", "Moder", "MF" },
        { 8, "Bartosz", "Slisz", "Slisz", "MF" }, { 19, "Przemysław", "Frankowski", "Frankowski", "MF" }, { 13, "Jakub", "Kamiński", "Kamiński", "MF" },
        { 16, "Kacper", "Urbański", "Urbański", "MF" }, { 9, "Robert", "Lewandowski", "Lewandowski", "FW" }, { 7, "Karol", "Świderski", "Świderski", "FW" },
        { 11, "Krzysztof", "Piątek", "Piątek", "FW" }, { 17, "Adam", "Buksa", "Buksa", "FW" },
    },
    nga = {
        { 23, "Stanley", "Nwabali", "Nwabali", "GK" }, { 16, "Maduka", "Okoye", "Okoye", "GK" }, { 1, "Francis", "Uzoho", "Uzoho", "GK" },
        { 2, "Ola", "Aina", "Aina", "DF" }, { 3, "Calvin", "Bassey", "Bassey", "DF" }, { 5, "William", "Troost-Ekong", "Troost-Ekong", "DF" },
        { 6, "Semi", "Ajayi", "Ajayi", "DF" }, { 21, "Bright", "Osayi-Samuel", "Osayi-Samuel", "DF" }, { 12, "Bruno", "Onyemaechi", "Onyemaechi", "DF" },
        { 4, "Wilfred", "Ndidi", "Ndidi", "MF" }, { 8, "Frank", "Onyeka", "Onyeka", "MF" }, { 17, "Alex", "Iwobi", "Iwobi", "MF" },
        { 13, "Raphael", "Onyedika", "Onyedika", "MF" }, { 14, "Joe", "Aribo", "Aribo", "MF" }, { 18, "Ademola", "Lookman", "Lookman", "FW" },
        { 9, "Victor", "Osimhen", "Osimhen", "FW" }, { 11, "Samuel", "Chukwueze", "Chukwueze", "FW" }, { 7, "Moses", "Simon", "Simon", "FW" },
        { 15, "Victor", "Boniface", "Boniface", "FW" }, { 20, "Akor", "Adams", "Adams", "FW" },
    },
    sen = {
        { 16, "Édouard", "Mendy", "Mendy", "GK" }, { 1, "Mory", "Diaw", "Diaw", "GK" }, { 23, "Yehvann", "Diouf", "Y. Diouf", "GK" },
        { 3, "Kalidou", "Koulibaly", "Koulibaly", "DF" }, { 19, "Moussa", "Niakhaté", "Niakhaté", "DF" }, { 22, "Abdoulaye", "Seck", "Seck", "DF" },
        { 15, "Krépin", "Diatta", "Diatta", "DF" }, { 14, "Ismail", "Jakobs", "Jakobs", "DF" }, { 2, "El Hadji Malick", "Diouf", "M. Diouf", "DF" },
        { 5, "Idrissa Gana", "Gueye", "I. Gueye", "MF" }, { 26, "Pape", "Gueye", "P. Gueye", "MF" }, { 17, "Pape Matar", "Sarr", "P. M. Sarr", "MF" },
        { 6, "Lamine", "Camara", "Camara", "MF" }, { 8, "Habib", "Diarra", "Diarra", "MF" }, { 10, "Sadio", "Mané", "Mané", "FW" },
        { 18, "Ismaïla", "Sarr", "I. Sarr", "FW" }, { 11, "Nicolas", "Jackson", "Jackson", "FW" }, { 13, "Iliman", "Ndiaye", "Ndiaye", "FW" },
        { 9, "Boulaye", "Dia", "Dia", "FW" },
    },
    civ = {
        { 1, "Yahia", "Fofana", "Y. Fofana", "GK" }, { 16, "Badra Ali", "Sangaré", "B. Sangaré", "GK" }, { 23, "Mohamed", "Koné", "Koné", "GK" },
        { 21, "Evan", "Ndicka", "Ndicka", "DF" }, { 7, "Odilon", "Kossounou", "Kossounou", "DF" }, { 5, "Wilfried", "Singo", "Singo", "DF" },
        { 3, "Ghislain", "Konan", "Konan", "DF" }, { 4, "Emmanuel", "Agbadou", "Agbadou", "DF" }, { 2, "Ousmane", "Diomande", "Diomande", "DF" },
        { 8, "Franck", "Kessié", "Kessié", "MF" }, { 6, "Seko", "Fofana", "S. Fofana", "MF" }, { 18, "Ibrahim", "Sangaré", "I. Sangaré", "MF" },
        { 20, "Jean Michaël", "Seri", "Seri", "MF" }, { 14, "Oumar", "Diakité", "Diakité", "FW" }, { 22, "Sébastien", "Haller", "Haller", "FW" },
        { 9, "Simon", "Adingra", "Adingra", "FW" }, { 10, "Nicolas", "Pépé", "Pépé", "FW" }, { 11, "Amad", "Diallo", "Amad", "FW" },
        { 17, "Evann", "Guessand", "Guessand", "FW" },
    },
    mli = {
        { 16, "Djigui", "Diarra", "Diarra", "GK" }, { 1, "Ismaël", "Diawara", "Diawara", "GK" },
        { 2, "Hamari", "Traoré", "H. Traoré", "DF" }, { 4, "Kiki", "Kouyaté", "K. Kouyaté", "DF" }, { 5, "Boubakar", "Kouyaté", "B. Kouyaté", "DF" },
        { 13, "Sikou", "Niakaté", "Niakaté", "DF" }, { 3, "Woyo", "Coulibaly", "W. Coulibaly", "DF" }, { 12, "Falaye", "Sacko", "Sacko", "DF" },
        { 8, "Yves", "Bissouma", "Bissouma", "MF" }, { 15, "Amadou", "Haidara", "Haidara", "MF" }, { 6, "Diadie", "Samassékou", "Samassékou", "MF" },
        { 10, "Kamory", "Doumbia", "Doumbia", "MF" }, { 14, "Mohamed", "Camara", "Camara", "MF" }, { 7, "Dorgeles", "Nene", "Nene", "FW" },
        { 9, "El Bilal", "Touré", "Touré", "FW" }, { 19, "Lassine", "Sinayoko", "Sinayoko", "FW" }, { 11, "Adama", "Traoré", "A. Traoré", "FW" },
        { 17, "Kalifa", "Coulibaly", "K. Coulibaly", "FW" },
    },
    swe = {
        { 1, "Robin", "Olsen", "Olsen", "GK" }, { 12, "Viktor", "Johansson", "Johansson", "GK" }, { 23, "Kristoffer", "Nordfeldt", "Nordfeldt", "GK" },
        { 2, "Emil", "Holm", "Holm", "DF" }, { 4, "Isak", "Hien", "Hien", "DF" }, { 3, "Victor", "Lindelöf", "Lindelöf", "DF" },
        { 5, "Gabriel", "Gudmundsson", "Gudmundsson", "DF" }, { 14, "Hjalmar", "Ekdal", "Ekdal", "DF" }, { 6, "Carl", "Starfelt", "Starfelt", "DF" },
        { 8, "Jens", "Cajuste", "Cajuste", "MF" }, { 20, "Yasin", "Ayari", "Ayari", "MF" }, { 7, "Lucas", "Bergvall", "Bergvall", "MF" },
        { 16, "Jesper", "Karlström", "Karlström", "MF" }, { 13, "Hugo", "Larsson", "Larsson", "MF" }, { 10, "Dejan", "Kulusevski", "Kulusevski", "MF" },
        { 11, "Anthony", "Elanga", "Elanga", "FW" }, { 9, "Alexander", "Isak", "Isak", "FW" }, { 17, "Viktor", "Gyökeres", "Gyökeres", "FW" },
        { 19, "Roony", "Bardghji", "Bardghji", "FW" }, { 21, "Benjamin", "Nygren", "Nygren", "FW" },
    },
    den = {
        { 1, "Kasper", "Schmeichel", "Schmeichel", "GK" }, { 16, "Mads", "Hermansen", "Hermansen", "GK" }, { 22, "Frederik", "Rønnow", "Rønnow", "GK" },
        { 2, "Rasmus", "Kristensen", "R. Kristensen", "DF" }, { 3, "Joachim", "Andersen", "Andersen", "DF" }, { 6, "Andreas", "Christensen", "Christensen", "DF" },
        { 5, "Victor", "Kristiansen", "V. Kristiansen", "DF" }, { 4, "Jannik", "Vestergaard", "Vestergaard", "DF" }, { 18, "Alexander", "Bah", "Bah", "DF" },
        { 13, "Patrick", "Dorgu", "Dorgu", "DF" }, { 8, "Morten", "Hjulmand", "Hjulmand", "MF" }, { 23, "Pierre-Emile", "Højbjerg", "Højbjerg", "MF" },
        { 10, "Christian", "Eriksen", "Eriksen", "MF" }, { 15, "Christian", "Nørgaard", "Nørgaard", "MF" }, { 14, "Mikkel", "Damsgaard", "Damsgaard", "MF" },
        { 9, "Rasmus", "Højlund", "Højlund", "FW" }, { 19, "Jonas", "Wind", "Wind", "FW" }, { 11, "Andreas", "Skov Olsen", "Skov Olsen", "FW" },
        { 20, "Gustav", "Isaksen", "Isaksen", "FW" }, { 12, "Kasper", "Dolberg", "Dolberg", "FW" },
    },
    esp = {
        { 23, "Unai", "Simón", "Unai Simón", "GK" }, { 1, "David", "Raya", "Raya", "GK" }, { 13, "Álex", "Remiro", "Remiro", "GK" },
        { 24, "Marc", "Cucurella", "Cucurella", "DF" }, { 14, "Aymeric", "Laporte", "Laporte", "DF" }, { 3, "Dean", "Huijsen", "Huijsen", "DF" },
        { 12, "Pedro", "Porro", "Porro", "DF" }, { 2, "Dani", "Carvajal", "Carvajal", "DF" }, { 4, "Pau", "Cubarsí", "Cubarsí", "DF" },
        { 5, "Robin", "Le Normand", "Le Normand", "DF" }, { 20, "", "Pedri", "Pedri", "MF" }, { 18, "Martín", "Zubimendi", "Zubimendi", "MF" },
        { 8, "Fabián", "Ruiz", "Fabián", "MF" }, { 16, "", "Rodri", "Rodri", "MF" }, { 6, "Mikel", "Merino", "Merino", "MF" },
        { 10, "Dani", "Olmo", "Olmo", "MF" }, { 17, "Nico", "Williams", "N. Williams", "FW" }, { 21, "Mikel", "Oyarzabal", "Oyarzabal", "FW" },
        { 19, "Lamine", "Yamal", "Lamine Yamal", "FW" }, { 9, "Ferran", "Torres", "Ferran", "FW" }, { 11, "Yeremy", "Pino", "Y. Pino", "FW" },
    },
    por = {
        { 1, "Diogo", "Costa", "Diogo Costa", "GK" }, { 12, "José", "Sá", "José Sá", "GK" }, { 22, "Rui", "Silva", "R. Silva", "GK" },
        { 19, "Nuno", "Mendes", "N. Mendes", "DF" }, { 3, "Gonçalo", "Inácio", "Inácio", "DF" }, { 4, "Rúben", "Dias", "R. Dias", "DF" },
        { 20, "João", "Cancelo", "Cancelo", "DF" }, { 5, "Diogo", "Dalot", "Dalot", "DF" }, { 13, "Renato", "Veiga", "Veiga", "DF" },
        { 14, "António", "Silva", "A. Silva", "DF" }, { 23, "", "Vitinha", "Vitinha", "MF" }, { 15, "João", "Neves", "João Neves", "MF" },
        { 8, "Bruno", "Fernandes", "B. Fernandes", "MF" }, { 10, "Bernardo", "Silva", "B. Silva", "MF" }, { 6, "João", "Palhinha", "Palhinha", "MF" },
        { 7, "Cristiano", "Ronaldo", "Ronaldo", "FW" }, { 17, "Rafael", "Leão", "Leão", "FW" }, { 18, "Pedro", "Neto", "Neto", "FW" },
        { 21, "Francisco", "Conceição", "Conceição", "FW" }, { 9, "Gonçalo", "Ramos", "G. Ramos", "FW" }, { 11, "João", "Félix", "João Félix", "FW" },
    },
    col = {
        { 12, "Camilo", "Vargas", "Vargas", "GK" }, { 1, "David", "Ospina", "Ospina", "GK" }, { 22, "Álvaro", "Montero", "Montero", "GK" },
        { 21, "Daniel", "Muñoz", "Muñoz", "DF" }, { 23, "Davinson", "Sánchez", "D. Sánchez", "DF" }, { 2, "Jhon", "Lucumí", "Lucumí", "DF" },
        { 17, "Johan", "Mojica", "Mojica", "DF" }, { 4, "Santiago", "Arias", "S. Arias", "DF" }, { 13, "Yerry", "Mina", "Mina", "DF" },
        { 16, "Jefferson", "Lerma", "Lerma", "MF" }, { 6, "Richard", "Ríos", "Ríos", "MF" }, { 10, "James", "Rodríguez", "James", "MF" },
        { 8, "Kevin", "Castaño", "Castaño", "MF" }, { 20, "Juan Fernando", "Quintero", "Quintero", "MF" }, { 15, "Jorge", "Carrascal", "Carrascal", "MF" },
        { 11, "Jhon", "Arias", "J. Arias", "FW" }, { 7, "Luis", "Díaz", "L. Díaz", "FW" }, { 9, "Jhon", "Córdoba", "Córdoba", "FW" },
        { 18, "Jhon", "Durán", "Durán", "FW" }, { 14, "Luis", "Suárez", "L. Suárez", "FW" },
    },
    mex = {
        { 1, "Luis", "Malagón", "Malagón", "GK" }, { 13, "Guillermo", "Ochoa", "Ochoa", "GK" }, { 12, "Raúl", "Rangel", "Rangel", "GK" },
        { 2, "Jorge", "Sánchez", "J. Sánchez", "DF" }, { 3, "César", "Montes", "Montes", "DF" }, { 5, "Johan", "Vásquez", "Vásquez", "DF" },
        { 23, "Jesús", "Gallardo", "Gallardo", "DF" }, { 15, "Israel", "Reyes", "Reyes", "DF" }, { 21, "Julián", "Araujo", "Araujo", "DF" },
        { 4, "Edson", "Álvarez", "E. Álvarez", "MF" }, { 18, "Luis", "Chávez", "Chávez", "MF" }, { 17, "Orbelín", "Pineda", "Pineda", "MF" },
        { 7, "Luis", "Romo", "Romo", "MF" }, { 14, "Marcel", "Ruiz", "M. Ruiz", "MF" }, { 22, "Hirving", "Lozano", "Lozano", "FW" },
        { 9, "Raúl", "Jiménez", "R. Jiménez", "FW" }, { 16, "Julián", "Quiñones", "Quiñones", "FW" }, { 11, "Santiago", "Giménez", "S. Giménez", "FW" },
        { 10, "Alexis", "Vega", "Vega", "FW" }, { 20, "César", "Huerta", "Huerta", "FW" },
    },
    ita = {
        { 1, "Gianluigi", "Donnarumma", "Donnarumma", "GK" }, { 12, "Guglielmo", "Vicario", "Vicario", "GK" }, { 26, "Alex", "Meret", "Meret", "GK" },
        { 2, "Giovanni", "Di Lorenzo", "Di Lorenzo", "DF" }, { 23, "Alessandro", "Bastoni", "Bastoni", "DF" }, { 5, "Riccardo", "Calafiori", "Calafiori", "DF" },
        { 4, "Alessandro", "Buongiorno", "Buongiorno", "DF" }, { 3, "Federico", "Dimarco", "Dimarco", "DF" }, { 13, "Destiny", "Udogie", "Udogie", "DF" },
        { 15, "Andrea", "Cambiaso", "Cambiaso", "DF" }, { 18, "Nicolò", "Barella", "Barella", "MF" }, { 8, "Sandro", "Tonali", "Tonali", "MF" },
        { 16, "Davide", "Frattesi", "Frattesi", "MF" }, { 6, "Samuele", "Ricci", "Ricci", "MF" }, { 14, "Manuel", "Locatelli", "Locatelli", "MF" },
        { 9, "Mateo", "Retegui", "Retegui", "FW" }, { 20, "Moise", "Kean", "Kean", "FW" }, { 10, "Giacomo", "Raspadori", "Raspadori", "FW" },
        { 17, "Riccardo", "Orsolini", "Orsolini", "FW" }, { 19, "Matteo", "Politano", "Politano", "FW" }, { 11, "Federico", "Chiesa", "Chiesa", "FW" },
    },
    jpn = {
        { 1, "Zion", "Suzuki", "Suzuki", "GK" }, { 12, "Keisuke", "Osako", "Osako", "GK" }, { 23, "Kosei", "Tani", "Tani", "GK" },
        { 4, "Ko", "Itakura", "Itakura", "DF" }, { 3, "Shogo", "Taniguchi", "Taniguchi", "DF" }, { 16, "Takehiro", "Tomiyasu", "Tomiyasu", "DF" },
        { 21, "Hiroki", "Ito", "H. Ito", "DF" }, { 22, "Ayumu", "Seko", "Seko", "DF" }, { 2, "Yukinari", "Sugawara", "Sugawara", "DF" },
        { 6, "Wataru", "Endo", "Endo", "MF" }, { 15, "Daichi", "Kamada", "Kamada", "MF" }, { 13, "Hidemasa", "Morita", "Morita", "MF" },
        { 7, "Kaoru", "Mitoma", "Mitoma", "MF" }, { 14, "Junya", "Ito", "J. Ito", "MF" }, { 8, "Takumi", "Minamino", "Minamino", "MF" },
        { 20, "Takefusa", "Kubo", "Kubo", "MF" }, { 10, "Ritsu", "Doan", "Doan", "MF" }, { 18, "Ayase", "Ueda", "Ueda", "FW" },
        { 11, "Daizen", "Maeda", "Maeda", "FW" }, { 9, "Kyogo", "Furuhashi", "Furuhashi", "FW" },
    },
    mar = {
        { 1, "Yassine", "Bounou", "Bounou", "GK" }, { 12, "Munir", "Mohamedi", "Munir", "GK" }, { 22, "Ahmed Reda", "Tagnaouti", "Tagnaouti", "GK" },
        { 2, "Achraf", "Hakimi", "Hakimi", "DF" }, { 5, "Nayef", "Aguerd", "Aguerd", "DF" }, { 20, "Achraf", "Dari", "Dari", "DF" },
        { 3, "Noussair", "Mazraoui", "Mazraoui", "DF" }, { 6, "Romain", "Saïss", "Saïss", "DF" }, { 18, "Jawad", "El Yamiq", "El Yamiq", "DF" },
        { 25, "Adam", "Masina", "Masina", "DF" }, { 4, "Sofyan", "Amrabat", "Amrabat", "MF" }, { 8, "Azzedine", "Ounahi", "Ounahi", "MF" },
        { 24, "Neil", "El Aynaoui", "El Aynaoui", "MF" }, { 15, "Ismael", "Saibari", "Saibari", "MF" }, { 10, "Brahim", "Díaz", "Brahim", "MF" },
        { 11, "Bilal", "El Khannouss", "El Khannouss", "MF" }, { 7, "Abde", "Ezzalzouli", "Abde", "FW" }, { 19, "Youssef", "En-Nesyri", "En-Nesyri", "FW" },
        { 17, "Soufiane", "Rahimi", "Rahimi", "FW" }, { 9, "Ayoub", "El Kaabi", "El Kaabi", "FW" }, { 16, "Eliesse", "Ben Seghir", "Ben Seghir", "FW" },
    },
}

-- head coaches of the sides without a photo atlas
DATA.coaches = {
    eng = { "Thomas", "Tuchel" }, bra = { "Carlo", "Ancelotti" }, ger = { "Julian", "Nagelsmann" }, ned = { "Ronald", "Koeman" },
    bel = { "Rudi", "Garcia" }, aut = { "Ralf", "Rangnick" }, irl = { "Heimir", "Hallgrímsson" }, pol = { "Jan", "Urban" },
    nga = { "Éric", "Chelle" }, sen = { "Pape", "Thiaw" }, civ = { "Emerse", "Faé" }, mli = { "Tom", "Saintfiet" },
    swe = { "Graham", "Potter" }, den = { "Brian", "Riemer" }, esp = { "Luis", "de la Fuente" }, por = { "Roberto", "Martínez" },
    col = { "Néstor", "Lorenzo" }, mex = { "Javier", "Aguirre" }, ita = { "Gennaro", "Gattuso" }, jpn = { "Hajime", "Moriyasu" },
    mar = { "Walid", "Regragui" },
}

-- starting XI (goalkeeper, then each line from left to right) and bench
DATA.lineups = {
    fra = { "4-2-3-1", { 16, 19, 17, 4, 5, 14, 8, 20, 7, 11, 10 }, { 1, 23, 2, 3, 15, 21, 26, 6, 13, 18, 24, 25, 9, 12, 22 } },
    arg = { "4-3-3", { 23, 3, 6, 13, 26, 20, 24, 7, 9, 22, 10 }, { 1, 12, 2, 4, 19, 25, 5, 8, 11, 14, 15, 16, 17, 18, 21 } },
    eng = { "4-2-3-1", { 1, 3, 6, 5, 2, 4, 8, 11, 10, 7, 9 }, { 13, 23, 12, 15, 16, 14, 17, 20, 18, 19, 22, 21 } },
    bra = { "4-2-3-1", { 1, 6, 4, 3, 2, 5, 8, 7, 20, 11, 9 }, { 23, 12, 14, 22, 16, 15, 17, 19, 10, 18 } },
    ger = { "4-2-3-1", { 1, 3, 15, 4, 6, 23, 8, 17, 10, 7, 9 }, { 12, 21, 2, 18, 16, 13, 5, 19, 11, 20, 14 } },
    ned = { "4-3-3", { 1, 5, 4, 15, 22, 14, 21, 8, 11, 10, 7 }, { 13, 23, 2, 3, 12, 20, 16, 18, 9, 19 } },
    bel = { "4-2-3-1", { 1, 5, 3, 2, 21, 24, 8, 11, 7, 14, 19 }, { 12, 13, 4, 15, 20, 18, 10, 22, 16, 9 } },
    aut = { "4-2-3-1", { 13, 16, 4, 15, 5, 6, 20, 9, 19, 18, 7 }, { 1, 12, 8, 3, 2, 10, 23, 11, 21 } },
    irl = { "4-2-3-1", { 1, 3, 4, 5, 2, 6, 8, 17, 14, 11, 20 }, { 23, 16, 12, 21, 13, 10, 7, 9, 19 } },
    pol = { "4-4-2", { 1, 21, 14, 5, 2, 13, 10, 8, 19, 9, 7 }, { 22, 12, 4, 18, 6, 20, 16, 11, 17 } },
    nga = { "4-3-3", { 23, 3, 5, 6, 2, 8, 4, 17, 18, 9, 11 }, { 16, 1, 21, 12, 13, 14, 7, 15, 20 } },
    sen = { "4-3-3", { 16, 14, 3, 19, 15, 17, 5, 6, 10, 11, 18 }, { 1, 23, 22, 2, 26, 8, 13, 9 } },
    civ = { "4-3-3", { 1, 3, 21, 7, 5, 6, 8, 18, 9, 22, 11 }, { 16, 23, 4, 2, 20, 14, 10, 17 } },
    mli = { "4-3-3", { 16, 3, 5, 13, 2, 15, 8, 10, 7, 9, 19 }, { 1, 4, 12, 6, 14, 11, 17 } },
    swe = { "4-4-2", { 1, 5, 3, 4, 2, 11, 20, 8, 10, 9, 17 }, { 12, 23, 14, 6, 7, 16, 13, 19, 21 } },
    den = { "4-3-3", { 1, 5, 3, 6, 2, 8, 23, 10, 14, 9, 20 }, { 16, 22, 4, 18, 13, 15, 19, 11, 12 } },
    esp = { "4-3-3", { 23, 24, 14, 3, 12, 20, 18, 8, 17, 21, 19 }, { 1, 13, 2, 4, 5, 16, 6, 10, 9, 11 } },
    por = { "4-3-3", { 1, 19, 3, 4, 20, 23, 15, 8, 17, 7, 10 }, { 12, 22, 5, 13, 14, 6, 18, 21, 9, 11 } },
    col = { "4-2-3-1", { 12, 17, 2, 23, 21, 16, 6, 7, 10, 11, 9 }, { 1, 22, 4, 13, 8, 20, 15, 18, 14 } },
    mex = { "4-3-3", { 1, 23, 5, 3, 2, 18, 4, 17, 22, 9, 16 }, { 13, 12, 15, 21, 7, 14, 11, 10, 20 } },
    ita = { "4-3-3", { 1, 3, 23, 4, 2, 18, 6, 8, 10, 9, 19 }, { 12, 26, 5, 13, 15, 16, 14, 20, 17, 11 } },
    jpn = { "3-4-2-1", { 1, 21, 4, 3, 7, 6, 15, 10, 8, 20, 18 }, { 12, 23, 16, 22, 2, 13, 14, 11, 9 } },
    mar = { "4-3-3", { 1, 3, 5, 20, 2, 8, 4, 24, 7, 19, 10 }, { 12, 22, 6, 18, 25, 15, 11, 17, 9, 16 } },
}

-- France – Argentina: what already happened, and what is planned for later
-- kind, side, minute, player, other (assist or player off), goal style
DATA.past = {
    { "yc", "a", 12, 13, 0, "" },
    { "goal", "h", 23, 10, 11, "through" },
    { "goal", "a", 39, 10, 0, "solo" },
    { "goal", "h", 52, 10, 20, "cutback" },
    { "sub", "a", 55, 18, 7, "" },
    { "yc", "h", 57, 8, 0, "" },
}
DATA.plan = {
    { "sub", "h", 64, 12, 20, "" },
    { "sub", "a", 69, 15, 9, "" },
    { "sub", "h", 73, 9, 7, "" },
    { "yc", "a", 76, 26, 0, "" },
    { "sub", "a", 78, 16, 20, "" },
    { "sub", "h", 81, 13, 14, "" },
    { "sub", "a", 84, 21, 22, "" },
}

-- commentary for goals. {S} scorer, {A} assist, {K} keeper
DATA.lines = {
    through = {
        "{A} slips it between the centre-backs and {S} is gone. One touch, then low past {K} at the near post.",
        "Perfect weight from {A}. {S} times the run, stays onside and rolls it under {K}.",
    },
    cutback = {
        "{A} gets to the byline and pulls it back. {S} arrives on cue and sweeps it first time into the corner.",
        "Patient build-up, then {A} cuts it back across the six-yard box and {S} makes no mistake.",
    },
    header = {
        "{A} whips it in from the right and {S} rises highest, powering a header beyond {K}.",
        "Pinpoint delivery from {A}. {S} meets it at the far post and nods it home.",
    },
    solo = {
        "{S} picks it up thirty yards out, glides past two challenges and curls it into the top corner.",
        "Nobody gets close. {S} drifts inside, shifts it onto the stronger foot and bends it past {K}.",
    },
}

-- commentary for everything else. {P} player, {Q} opponent, {K} keeper, {T} team, {M} team-mate
DATA.say = {
    corner = {
        "Corner to {T}. {P} whips it in and {Q} heads it clear.",
        "{P} wins a corner off {Q}. The delivery is punched away by {K}.",
        "{T} force a corner. {P}'s inswinger is cleared at the near post.",
    },
    sot = {
        "{P} hits it low from the edge of the box. {K} gets down well to save.",
        "Good chance for {P}, but {K} stands tall and blocks with his legs.",
        "{P} lets fly from 25 yards. {K} tips it over the bar.",
    },
    miss = {
        "{P} curls one towards the far corner. Just wide.",
        "{P} gets on the end of a cross from {M} but heads over.",
        "Half-chance for {P}, who drags his shot past the post.",
    },
    block = {
        "{P} shapes to shoot and {Q} throws himself in the way.",
        "{P} lets fly, but the shot is blocked by {Q}.",
    },
    big = {
        "Big chance! {P} is clean through but {K} spreads himself and saves.",
        "What a chance. {M} squares it for {P}, who somehow puts it wide.",
    },
    foul = {
        "{Q} brings down {P} just outside the box. Free kick to {T}.",
        "{P} is clipped by {Q} on the counter. The referee waves play on, then blows.",
    },
    offside = {
        "{P} races clear, but the flag is up. Offside.",
        "{M} finds {P} in behind. Offside, by a stride.",
    },
    yc = {
        "{P} is booked for a late challenge on {Q}.",
        "Yellow card for {P}, who pulls back {Q} to stop the break.",
    },
    rc = {
        "Straight red! {P} goes in high on {Q} and the referee doesn't hesitate.",
        "{P} is sent off. A last-man foul on {Q}, and {T} are down to ten.",
    },
    sub = {
        "{T} make a change. {P} comes on for {Q}.",
        "Fresh legs for {T}: {P} replaces {Q}.",
    },
}

-- what the followed player just did. {M} team-mate, {Q} opponent, {K} keeper
DATA.acts = {
    { "touch", 9, "Receives the ball on the half-turn" },
    { "pass", 14, "Plays it short to {M}" },
    { "pass", 8, "One-two with {M}" },
    { "long", 4, "Switches play to {M}" },
    { "drib", 5, "Dribbles past {Q}" },
    { "key", 3, "Threads a pass for {M}" },
    { "cross", 3, "Whips a cross into the box" },
    { "shot", 2, "Shoots. Saved by {K}" },
    { "miss", 2, "Shoots from range. Just wide" },
    { "fouled", 3, "Wins a free kick off {Q}" },
    { "lost", 4, "Loses it under pressure from {Q}" },
    { "run", 7, "Off the ball, drifting into space" },
    { "press", 5, "Presses {Q} into a hurried pass" },
}

-- per-90 output by line: touches, pass accuracy, duels won %, shots, chances created, saves
DATA.profile = {
    GK = { 36, 79, 62, 0, 0, 3.4 },
    DF = { 74, 89, 58, 0.5, 0.5, 0 },
    MF = { 80, 88, 52, 1.3, 1.6, 0 },
    FW = { 46, 79, 44, 3.2, 1.4, 0 },
}

-- quick follows offered when nobody is followed
DATA.stars = { { "arg", 10 }, { "fra", 10 }, { "eng", 9 }, { "bra", 7 }, { "ger", 17 }, { "ned", 4 } }

-- the next fixture after tonight: opponent, days after Monday 21 September, kick-off.
-- The demo clock starts at 21:58 on that Monday (countdowns run from there).
DATA.next = {
    fra = { "bra", 3, "20:45" }, bra = { "fra", 3, "20:45" }, arg = { "eng", 3, "18:00" }, eng = { "arg", 3, "18:00" },
    ger = { "aut", 4, "20:45" }, aut = { "ger", 4, "20:45" }, ned = { "bel", 4, "18:00" }, bel = { "ned", 4, "18:00" },
    irl = { "den", 4, "19:45" }, pol = { "swe", 4, "20:45" }, esp = { "ita", 5, "21:00" }, por = { "mex", 5, "19:00" },
}


-- =====================================================================
-- MODEL — match state and rules. Still no drawing in here.
-- =====================================================================
local PEOPLE: { [string]: { [number]: Person } } = {}
local COACH: { [string]: Person } = {}
for team, rows in DATA.squads do
    PEOPLE[team] = {}
    for i, row in rows :: { { any } } do
        local p: Person
        if #row >= 11 then
            p = {
                team = team, n = row[1] :: number, first = row[2] :: string, last = row[3] :: string, short = row[4] :: string,
                pos = row[5] :: string, role = row[6] :: string, club = row[7] :: string,
                born = { row[8] :: number, row[9] :: number, row[10] :: number }, h = row[11] :: number, cell = i,
            }
        else
            p = {
                team = team, n = row[1] :: number, first = row[2] :: string, last = row[3] :: string, short = row[4] :: string,
                pos = row[5] :: string, role = "", club = "", born = { 0, 0, 0 }, h = 0, cell = 0,
            }
        end
        if p.pos == "CO" then COACH[team] = p else PEOPLE[team][p.n] = p end
    end
end
for team, c in DATA.coaches :: { [string]: { string } } do
    if COACH[team] == nil then
        COACH[team] = { team = team, n = 0, first = c[1], last = c[2], short = c[2], pos = "CO", role = "Head coach", club = "", born = { 0, 0, 0 }, h = 0, cell = 0 }
    end
end

local function person(team: string, n: number): Person?
    local s = PEOPLE[team]
    if s == nil then return nil end
    return s[n]
end
local function fullName(p: Person): string
    if p.first == "" then return p.last end
    return p.first .. " " .. p.last
end
-- age on the day this demo is set (Monday 21 September 2026); 0 = unknown
local function age(p: Person): number
    local y, m, d = p.born[1], p.born[2], p.born[3]
    if y <= 0 then return 0 end
    local a = 2026 - y
    if m > 9 or (m == 9 and d > 21) then a -= 1 end
    return a
end
local function nameOf(team: string, n: number): string
    local p = person(team, n)
    if p then return p.short end
    return "#" .. tostring(n)
end

-- ---------------------------------------------------------------------
-- formations: "4-2-3-1" -> rows { 1, 4, 2, 3, 1 } (keeper first)
-- ---------------------------------------------------------------------
local formRows: (form: string) -> { number }
local slotRow: (form: string, slot: number) -> (number, number, number)
local slotLine: (form: string, slot: number) -> string
local slotRole: (form: string, slot: number) -> string
do
    local CACHE: { [string]: { number } } = {}
    formRows = function(form: string): { number }
        local rows = CACHE[form]
        if rows == nil then
            rows = { 1 }
            for d in string.gmatch(form, "%d+") do table.insert(rows, tonumber(d) or 1) end
            CACHE[form] = rows
        end
        return rows
    end
    -- row (1 = keeper), index inside the row (1 = left), players in that row
    slotRow = function(form: string, slot: number): (number, number, number)
        local rows = formRows(form)
        local k = slot
        for i, n in rows do
            if k <= n then return i, k, n end
            k -= n
        end
        return #rows, 1, 1
    end
    slotLine = function(form: string, slot: number): string
        local row = slotRow(form, slot)
        local rows = formRows(form)
        if row == 1 then return "GK" elseif row == 2 then return "DF" elseif row == #rows then return "FW" end
        return "MF"
    end
    slotRole = function(form: string, slot: number): string
        local row, i, n = slotRow(form, slot)
        local rows = formRows(form)
        local last = #rows
        if row == 1 then return "Goalkeeper" end
        local wide = n >= 3 and (i == 1 or i == n)
        local side = if i == 1 then "Left" else "Right"
        if row == 2 then
            if n >= 5 and wide then return side .. " wing-back" end
            if n == 4 and wide then return side .. "-back" end
            return "Centre-back"
        end
        if row == last then
            if n == 1 then return "Centre-forward" end
            if n == 3 and wide then return side .. " winger" end
            if n == 3 then return "Centre-forward" end
            return "Forward"
        end
        -- midfield rows
        if n == 4 and wide then return if rows[2] == 3 then side .. " wing-back" else side .. " midfielder" end
        if row == last - 1 and n == 3 and #rows >= 5 then return if wide then side .. " winger" else "Attacking midfielder" end
        if row == last - 1 and n == 2 and #rows >= 5 then return "Attacking midfielder" end
        if n == 2 then return "Defensive midfielder" end
        return "Central midfielder"
    end
end

local function lineOf(team: string, n: number, form: string, slot: number): string
    local p = person(team, n)
    if p then return p.pos end
    return slotLine(form, slot)
end

local makeMatches: () -> { Match }
do
    local function newLineup(team: string): Lineup
        local src = DATA.lineups[team]
        local lu: Lineup = { team = team, form = "4-3-3", xi = { 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11 }, bench = {}, on = {}, off = {}, forr = {}, goals = {}, assists = {}, yc = {}, rc = {} }
        if src then
            lu.form = src[1] :: string
            lu.xi = {}
            lu.bench = {}
            for _, n in src[2] :: { number } do table.insert(lu.xi, n) end
            for _, n in src[3] :: { number } do table.insert(lu.bench, n) end
        end
        return lu
    end

    local function newMatch(id: number, f: { any }): Match
        local r = rng(id * 7919)
        local h, a = f[3] :: string, f[4] :: string
        local m: Match = {
            id = id, day = f[1] :: number, lg = f[2] :: string, h = h, a = a, hs = f[5] :: number, as = f[6] :: number,
            status = f[7] :: string, min = f[8] :: number, sec = math.floor(r() * 50), time = (f[9] or "") :: string,
            feat = h == "fra" and a == "arg",
            ready = false, events = {}, plan = {}, mom = {}, poss = 50, stats = {},
            lu = { h = newLineup(h), a = newLineup(a) },
            flashT = -100, bumpSide = "", bumpT = -100, goalT = -100, goalSide = "",
            ftT = -100, cw = tween(0), sink = 0, fx = {}, ver = 0,
            fstats = false, pst = {},
        }
        return m
    end

    makeMatches = function(): { Match }
        local list: { Match } = {}
        for i, f in DATA.fixtures do table.insert(list, newMatch(i, f)) end
        return list
    end
end

local function sideTeam(m: Match, side: string): string
    return if side == "h" then m.h else m.a
end
local function otherSide(side: string): string
    return if side == "h" then "a" else "h"
end
local function scoreStr(a: number, b: number): string
    return tostring(a) .. "–" .. tostring(b)
end

-- record a goal / card / substitution on the lineups
local function applyEvent(m: Match, e: Event)
    local lu = m.lu[e.side]
    if e.kind == "goal" and e.pn > 0 then
        lu.goals[e.pn] = (lu.goals[e.pn] or 0) + 1
        if e.on > 0 then lu.assists[e.on] = (lu.assists[e.on] or 0) + 1 end
    elseif e.kind == "yc" and e.pn > 0 then
        lu.yc[e.pn] = e.min
    elseif e.kind == "rc" and e.pn > 0 then
        lu.rc[e.pn] = e.min
    elseif e.kind == "sub" then
        lu.on[e.pn] = e.min
        lu.off[e.on] = e.min
        lu.forr[e.pn] = e.on
    end
    m.ver += 1
end

-- `on` belongs to the same side for goals (assist) and subs (player off), to the other side otherwise
local function mkEvent(m: Match, kind: string, side: string, min: number, pn: number, on: number, gt: string): Event
    local team = sideTeam(m, side)
    local own = kind == "goal" or kind == "sub"
    local oteam = if own then team else sideTeam(m, otherSide(side))
    return {
        id = 0, kind = kind, side = side, min = min,
        p = nameOf(team, pn), o = if on > 0 then nameOf(oteam, on) else "",
        pn = pn, on = on, gt = gt, s = "", t0 = -100, txt = "", xg = 0,
    }
end

-- 93 -> "90+3'"
local function minText(min: number): string
    if min > 90 then return "90+" .. tostring(min - 90) .. "'" end
    return tostring(min) .. "'"
end
local function minLabel(m: Match): string
    if m.status == "live" then
        return minText(m.min)
    elseif m.status == "ft" then
        return "FT"
    end
    return m.time
end
local function trails(m: Match, side: string): boolean
    if m.status == "ns" or m.hs == m.as then return false end
    return (side == "h") ~= (m.hs > m.as)
end
-- home / away colours that stay apart even when both teams wear similar colours
local function sideColors(m: Match): (Color, Color)
    local a, b = TEAMS[m.h].c1, TEAMS[m.a].c1
    local function ch(x: number, s: number): number return bit32.band(bit32.rshift(x, s), 255) end
    local d = math.sqrt((ch(a, 16) - ch(b, 16)) ^ 2 + (ch(a, 8) - ch(b, 8)) ^ 2 + (ch(a, 0) - ch(b, 0)) ^ 2)
    if d < 150 then b = TEAMS[m.a].c2 end
    local d2 = math.sqrt((ch(a, 16) - ch(b, 16)) ^ 2 + (ch(a, 8) - ch(b, 8)) ^ 2 + (ch(a, 0) - ch(b, 0)) ^ 2)
    return hex(a), hex(if d2 < 90 then 0xE9E7E1 else b)
end
-- the card gradient of a match: home colour on top, away colour at the bottom
local matchStops: (m: Match) -> { { number } }
do
    local STOP_CACHE: { [string]: { { number } } } = {}
    matchStops = function(m: Match): { { number } }
        local key = m.h .. m.a
        local st = STOP_CACHE[key]
        if st == nil then
            local h, a = TEAMS[m.h], TEAMS[m.a]
            st = {
                { 0, pastel(h.c1) },
                { 0.42, pastel(mix(h.c2, 0xF7F2EA, 0.35)) },
                { 0.62, pastel(mix(a.c2, 0xF7F2EA, 0.35)) },
                { 1, pastel(a.c1) },
            }
            STOP_CACHE[key] = st
        end
        return st
    end
end

local function goalsOf(m: Match): { Event }
    local g: { Event } = {}
    for _, e in m.events do
        if e.kind == "goal" then table.insert(g, e) end
    end
    table.sort(g, function(a: Event, b: Event): boolean return a.min < b.min end)
    return g
end

-- ---------------------------------------------------------------------
-- who is on the pitch, weighted picks, goals and commentary
-- ---------------------------------------------------------------------
-- real: the numbers are known (the demo models them; live data must send them)
type PStats = {
    rating: number, mins: number, goals: number, assists: number, yc: number, onMin: number, offMin: number,
    played: boolean, bars: { { any } }, touches: number, passes: number, passOk: number, shots: number, sot: number, keyp: number,
    real: boolean,
}
-- live data is running the app (set by the feed): nothing is modelled any more
local LIVE_DATA = { on = false }

local playerStats: (m: Match, side: string, n: number) -> PStats
local onPitch: (m: Match, side: string) -> { { any } }
local keeperOf: (m: Match, side: string) -> number
local pickPlayer: (m: Match, side: string, kind: string, skip: number, rnd: () -> number) -> number
local makeGoal: (m: Match, side: string, forced: number, rnd: () -> number) -> Event
local commentary: (m: Match, e: Event) -> string
local sayLine: (m: Match, e: Event, rnd: () -> number) -> string
local slotOf: (lu: Lineup, n: number) -> number
do
    slotOf = function(lu: Lineup, n: number): number
        for i, x in lu.xi do
            if x == n then return i end
        end
        return 0
    end

    -- players on the pitch right now: { n, line, slot }
    onPitch = function(m: Match, side: string): { { any } }
        local lu = m.lu[side]
        local out: { { any } } = {}
        for i, n in lu.xi do
            if lu.off[n] == nil and lu.rc[n] == nil then table.insert(out, { n, lineOf(lu.team, n, lu.form, i), i }) end
        end
        for n, _ in lu.on do
            if lu.off[n] == nil and lu.rc[n] == nil then
                local sl = slotOf(lu, lu.forr[n] or 0)
                table.insert(out, { n, lineOf(lu.team, n, lu.form, if sl > 0 then sl else 9), if sl > 0 then sl else 9 })
            end
        end
        return out
    end

    keeperOf = function(m: Match, side: string): number
        return m.lu[side].xi[1]
    end

    local W_BY: { [string]: { [string]: number } } = {
        score = { GK = 0, DF = 0.5, MF = 1.6, FW = 4.5 },
        assist = { GK = 0.05, DF = 1.1, MF = 2.6, FW = 1.8 },
        shot = { GK = 0, DF = 0.6, MF = 1.6, FW = 3.2 },
        corner = { GK = 0, DF = 0.4, MF = 2.4, FW = 1.6 },
        defend = { GK = 0, DF = 3, MF = 1.4, FW = 0.3 },
        foul = { GK = 0, DF = 1.4, MF = 1.6, FW = 1.8 },
        card = { GK = 0.1, DF = 2.2, MF = 2, FW = 0.8 },
        any = { GK = 0.3, DF = 1, MF = 1, FW = 1 },
    }
    pickPlayer = function(m: Match, side: string, kind: string, skip: number, rnd: () -> number): number
        local list = onPitch(m, side)
        local weights = W_BY[kind] or W_BY.any
        local total = 0
        for _, p in list do
            if p[1] ~= skip then total += weights[p[2] :: string] or 1 end
        end
        local x = rnd() * total
        for _, p in list do
            if p[1] ~= skip then
                x -= weights[p[2] :: string] or 1
                if x <= 0 then return p[1] :: number end
            end
        end
        return list[#list][1] :: number
    end

    -- builds a goal event (does not change the score yet)
    makeGoal = function(m: Match, side: string, forced: number, rnd: () -> number): Event
        local players = onPitch(m, side)
        local scorer = forced
        local found = false
        for _, p in players do
            if p[1] == forced then found = true end
        end
        if not found then scorer = pickPlayer(m, side, "score", -1, rnd) end
        local assist = if rnd() < 0.18 then 0 else pickPlayer(m, side, "assist", scorer, rnd)
        local gt = "solo"
        if assist > 0 then
            local aline = ""
            for _, p in players do
                if p[1] == assist then aline = p[2] :: string end
            end
            local roll = rnd()
            if aline == "DF" then gt = if roll < 0.6 then "header" else "cutback"
            elseif aline == "FW" then gt = if roll < 0.5 then "cutback" else "through"
            else gt = if roll < 0.65 then "through" else "header" end
        end
        local e = mkEvent(m, "goal", side, math.min(m.min, 95), scorer, assist, gt)
        e.xg = 0.12 + rnd() * 0.45
        return e
    end

    commentary = function(m: Match, e: Event): string
        local set = DATA.lines[e.gt] or DATA.lines.solo
        local s = set[(e.min % #set) + 1]
        local k = nameOf(sideTeam(m, otherSide(e.side)), keeperOf(m, otherSide(e.side)))
        s = string.gsub(s, "{S}", e.p)
        s = string.gsub(s, "{A}", if e.o ~= "" then e.o else "a team-mate")
        s = string.gsub(s, "{K}", k)
        return s
    end

    -- one line of commentary for any non-goal event
    sayLine = function(m: Match, e: Event, rnd: () -> number): string
        local kind = e.kind
        if kind == "foulx" then return "" end
        local set = DATA.say[kind]
        if set == nil then return "" end
        local s = set[1 + math.floor(rnd() * #set)] :: string
        local team = sideTeam(m, e.side)
        local os = otherSide(e.side)
        local mate = pickPlayer(m, e.side, "any", e.pn, rnd)
        local q = if kind == "sub" then e.o else (if e.o ~= "" then e.o else nameOf(sideTeam(m, os), pickPlayer(m, os, "defend", -1, rnd)))
        s = string.gsub(s, "{P}", e.p)
        s = string.gsub(s, "{Q}", q)
        s = string.gsub(s, "{K}", nameOf(sideTeam(m, os), keeperOf(m, os)))
        s = string.gsub(s, "{M}", nameOf(team, mate))
        s = string.gsub(s, "{T}", TEAMS[team].name)
        return s
    end
end

-- ---------------------------------------------------------------------
-- the match, minute by minute: corners, shots, saves, fouls, offsides
-- ---------------------------------------------------------------------
local genMinute: (m: Match, minute: number, rnd: () -> number) -> { Event }
local refreshStats: (m: Match) -> ()
local stepMomentum: (m: Match, minute: number, rnd: () -> number) -> ()
local ensureEvents: (m: Match) -> ()
do
    -- per team, per minute
    local RATE = { { "sot", 0.042 }, { "miss", 0.045 }, { "block", 0.028 }, { "big", 0.012 }, { "corner", 0.052 }, { "foul", 0.026 }, { "foulx", 0.085 }, { "offside", 0.02 } }
    local XG: { [string]: { number } } = { sot = { 0.05, 0.16 }, miss = { 0.03, 0.1 }, block = { 0.03, 0.07 }, big = { 0.35, 0.3 } }

    local function strength(m: Match, side: string): number
        -- the side ahead and the home side push a little more
        local lead = if side == "h" then m.hs - m.as else m.as - m.hs
        return math.clamp(1 + (if side == "h" then 0.08 else 0) - lead * 0.06, 0.7, 1.3)
    end

    genMinute = function(m: Match, minute: number, rnd: () -> number): { Event }
        local out: { Event } = {}
        for _, side in { "h", "a" } do
            local k = strength(m, side)
            for _, rt in RATE do
                local kind = rt[1] :: string
                if rnd() < (rt[2] :: number) * k then
                    local os = otherSide(side)
                    local pk = if kind == "corner" then "corner" elseif kind == "foul" or kind == "foulx" or kind == "offside" then "foul" else "shot"
                    local pn = pickPlayer(m, side, pk, -1, rnd)
                    local on = 0
                    if kind == "sot" or kind == "big" then on = keeperOf(m, os)
                    elseif kind == "block" or kind == "corner" or kind == "foul" or kind == "foulx" then on = pickPlayer(m, os, "defend", -1, rnd) end
                    local e = mkEvent(m, kind, side, minute, pn, on, "")
                    local xr = XG[kind]
                    if xr then e.xg = xr[1] + rnd() * xr[2] end
                    e.txt = sayLine(m, e, rnd)
                    table.insert(out, e)
                end
            end
        end
        return out
    end

    stepMomentum = function(m: Match, minute: number, rnd: () -> number)
        local prev = m.mom[minute] or 0
        local push = 0
        for _, e in m.events do
            if e.min == minute then
                local s = if e.side == "h" then 1 else -1
                local w = if e.kind == "goal" then 1.4 elseif e.kind == "big" then 0.9 elseif e.kind == "sot" then 0.6
                    elseif e.kind == "miss" or e.kind == "block" then 0.4 elseif e.kind == "corner" then 0.35 else 0
                push += s * w
            end
        end
        local v = prev * 0.55 + (rnd() - 0.5 + (m.hs - m.as) * 0.04) * 0.9 + push * 0.6
        m.mom[minute + 1] = math.clamp(v, -1, 1)
    end

    refreshStats = function(m: Match)
        local c: { [string]: { number } } = { h = { 0, 0, 0, 0, 0, 0, 0 }, a = { 0, 0, 0, 0, 0, 0, 0 } }
        -- xG, shots, on target, big chances, corners, fouls, offsides
        for _, e in m.events do
            local t = c[e.side]
            local k = e.kind
            if k == "goal" or k == "sot" or k == "miss" or k == "block" or k == "big" then
                t[1] += e.xg
                t[2] += 1
                if k == "goal" or k == "sot" or k == "big" then t[3] += 1 end
                if k == "big" or (k == "goal" and e.xg > 0.33) then t[4] += 1 end
            elseif k == "corner" then t[5] += 1
            elseif k == "foul" or k == "foulx" then c[otherSide(e.side)][6] += 1
            elseif k == "offside" then t[7] += 1 end
        end
        local mins = math.max(m.min, 1)
        local ph = math.floor(m.poss * mins * 5.4 / 50 + 0.5)
        local pa = math.floor((100 - m.poss) * mins * 5.4 / 50 + 0.5)
        local function r2(x: number): number return math.floor(x * 100 + 0.5) / 100 end
        m.stats = {
            { name = "xG", a = r2(c.h[1]), b = r2(c.a[1]), fmt = "%.2f" },
            { name = "Shots", a = c.h[2], b = c.a[2], fmt = "%d" },
            { name = "On target", a = c.h[3], b = c.a[3], fmt = "%d" },
            { name = "Big chances", a = c.h[4], b = c.a[4], fmt = "%d" },
            { name = "Corners", a = c.h[5], b = c.a[5], fmt = "%d" },
            { name = "Passes", a = ph, b = pa, fmt = "%d" },
            { name = "Fouls", a = c.h[6], b = c.a[6], fmt = "%d" },
            { name = "Offsides", a = c.h[7], b = c.a[7], fmt = "%d" },
        }
    end

    -- builds the whole match up to its current minute the first time it is needed
    ensureEvents = function(m: Match)
        if m.ready then return end
        m.ready = true
        local r = rng(m.id * 977)
        m.poss = 42 + math.floor(r() * 18)
        if m.status == "ns" then
            refreshStats(m)
            return
        end
        -- the big moments, by minute: { kind, side, minute, player, other, style }
        local majors: { { any } } = {}
        if m.feat then
            for _, f in DATA.past do table.insert(majors, f) end
            for _, f in DATA.plan do
                table.insert(m.plan, mkEvent(m, f[1] :: string, f[2] :: string, f[3] :: number, f[4] :: number, f[5] :: number, f[6] :: string))
            end
        else
            local top = math.max(m.min, 10)
            for _, side in { "h", "a" } do
                for _ = 1, (if side == "h" then m.hs else m.as) do
                    table.insert(majors, { "goal", side, math.max(3, math.floor(r() * top)), 0, 0, "" })
                end
            end
            for _ = 1, 1 + math.floor(r() * 3) do
                table.insert(majors, { "yc", if r() < 0.5 then "h" else "a", 5 + math.floor(r() * math.max(top - 5, 5)), 0, 0, "" })
            end
            if m.min > 56 then
                for _, side in { "h", "a" } do
                    for _ = 1, 1 + math.floor(r() * 2) do
                        table.insert(majors, { "sub", side, 56 + math.floor(r() * math.min(m.min - 56, 25)), 0, 0, "" })
                    end
                end
            end
        end
        table.sort(majors, function(x: { any }, y: { any }): boolean return (x[3] :: number) < (y[3] :: number) end)
        local hs, as = 0, 0
        local mi = 1
        m.mom[1] = 0
        local last = math.min(m.min, 95)
        for minute = 1, last do
            while mi <= #majors and (majors[mi][3] :: number) <= minute do
                local f = majors[mi]
                mi += 1
                local kind, side = f[1] :: string, f[2] :: string
                local e: Event? = nil
                if kind == "goal" then
                    local ge = if m.feat then mkEvent(m, "goal", side, f[3] :: number, f[4] :: number, f[5] :: number, f[6] :: string) else makeGoal(m, side, 0, r)
                    ge.min = f[3] :: number
                    if ge.xg <= 0 then ge.xg = 0.15 + r() * 0.4 end
                    if side == "h" then hs += 1 else as += 1 end
                    ge.s = scoreStr(hs, as)
                    ge.txt = commentary(m, ge)
                    e = ge
                elseif kind == "yc" then
                    local pn = if (f[4] :: number) > 0 then f[4] :: number else pickPlayer(m, side, "card", -1, r)
                    local ye = mkEvent(m, "yc", side, f[3] :: number, pn, pickPlayer(m, otherSide(side), "any", -1, r), "")
                    ye.txt = sayLine(m, ye, r)
                    e = ye
                elseif kind == "sub" then
                    local lu = m.lu[side]
                    local onN, offN = f[4] :: number, f[5] :: number
                    if onN <= 0 then
                        -- an outfield starter still on, replaced by an unused outfield sub
                        local starters: { number } = {}
                        for si, x in lu.xi do
                            if si > 1 and lu.off[x] == nil then table.insert(starters, x) end
                        end
                        offN = if #starters > 0 then starters[1 + math.floor(r() * #starters)] else 0
                        local pool: { number } = {}
                        for _, b in lu.bench do
                            local p = person(lu.team, b)
                            if lu.on[b] == nil and (p == nil or p.pos ~= "GK") then table.insert(pool, b) end
                        end
                        onN = if #pool > 0 then pool[1 + math.floor(r() * #pool)] else 0
                    end
                    if onN > 0 and offN > 0 and lu.off[offN] == nil then
                        local se = mkEvent(m, "sub", side, f[3] :: number, onN, offN, "")
                        se.txt = sayLine(m, se, r)
                        e = se
                    end
                end
                if e then
                    applyEvent(m, e)
                    table.insert(m.events, e)
                end
            end
            for _, e in genMinute(m, minute, r) do table.insert(m.events, e) end
            stepMomentum(m, minute, r)
        end
        refreshStats(m)
    end
end

-- ---------------------------------------------------------------------
-- players: minutes, rating and match numbers (deterministic per player)
-- ---------------------------------------------------------------------
do
    local PS_CACHE: { [string]: PStats } = {}
    local PS_COUNT = 0
    playerStats = function(m: Match, side: string, n: number): PStats
        local ck = string.format("%d%s%d|%d|%d", m.id, side, n, m.min, m.ver)
        local hitc = PS_CACHE[ck]
        if hitc then return hitc end
        local lu = m.lu[side]
        local team = lu.team
        local slot = slotOf(lu, n)
        local line = lineOf(team, n, lu.form, if slot > 0 then slot else 6)
        local now = if m.status == "ns" then 0 else math.min(m.min, 90)
        local start = if slot > 0 then 0 else (lu.on[n] or -1)
        local stop = lu.off[n] or lu.rc[n] or now
        local mins = if start < 0 or m.status == "ns" then 0 else math.max(0, math.min(stop, now) - start)
        local played = mins > 0 or (start >= 0 and m.status ~= "ns")
        local r = rng(n * 131 + string.byte(team, 1) * 7 + string.byte(team, 2))
        local f = mins / 90
        local pr = DATA.profile[line] or DATA.profile.MF
        local g, a, y = lu.goals[n] or 0, lu.assists[n] or 0, if lu.yc[n] then 1 else 0
        local red = if lu.rc[n] then 1 else 0
        -- shots straight from the match feed
        local shots, sot = 0, 0
        for _, e in m.events do
            if e.side == side and e.pn == n then
                local k = e.kind
                if k == "goal" or k == "sot" or k == "miss" or k == "block" or k == "big" then shots += 1 end
                if k == "goal" or k == "sot" or k == "big" then sot += 1 end
            end
        end
        local fx = m.fx[side .. tostring(n)] or { 0, 0, 0, 0, 0 }
        local touches = math.floor(pr[1] * (0.8 + r() * 0.45) * f + 0.5) + fx[1]
        local passes = math.floor(touches * (0.62 + r() * 0.12) + 0.5) + fx[2]
        local acc = math.clamp(pr[2] + (r() - 0.5) * 12, 55, 98)
        local passOk = math.floor(passes * acc / 100 + 0.5) + fx[3]
        passes = math.max(passes, passOk)
        local duels = math.floor(math.clamp(pr[3] + (r() - 0.5) * 30, 20, 90) + 0.5)
        local keyp = math.floor(pr[5] * (0.6 + r() * 0.8) * f + 0.5) + a + fx[4]
        local saves = math.floor(pr[6] * (0.6 + r() * 0.8) * f + 0.5)
        local conceded = if side == "h" then m.as else m.hs
        local rating = 6.2 + r() * 0.8 + g * 1.1 + a * 0.7 - y * 0.35 - red * 1.4 + (keyp - a) * 0.08 + sot * 0.12
        if line == "GK" then rating += saves * 0.18 - conceded * 0.3 end
        if not played then rating = 0 end
        local accP = if passes > 0 then math.floor(passOk / passes * 100 + 0.5) else 0
        local bars: { { any } }
        if line == "GK" then
            bars = { { "Saves", saves, 8, "%d" }, { "Pass accuracy", accP, 100, "%d%%" }, { "Touches", touches, 60, "%d" }, { "Duels won", duels, 100, "%d%%" }, { "Goals conceded", conceded, 5, "%d" } }
        else
            bars = { { "Touches", touches, 110, "%d" }, { "Pass accuracy", accP, 100, "%d%%" }, { "Duels won", duels, 100, "%d%%" }, { "Shots", shots, 8, "%d" }, { "Chances created", keyp, 6, "%d" } }
        end
        local res: PStats = {
            rating = math.clamp(math.floor(rating * 10 + 0.5) / 10, 0, 10),
            mins = mins, goals = g, assists = a, yc = y, onMin = if slot > 0 then 0 else (lu.on[n] or -1), offMin = lu.off[n] or -1,
            played = played, bars = bars, touches = touches, passes = passes, passOk = passOk, shots = shots, sot = sot, keyp = keyp,
            real = true,
        }
        -- live data: the provider's numbers replace the modelled ones; without them
        -- only what the events tell (minutes, goals, assists, shots) is shown
        local fp = m.pst[side .. tostring(n)]
        if LIVE_DATA.on and fp == nil then
            res.real, res.rating, res.touches, res.passes, res.passOk, res.keyp = false, 0, 0, 0, 0, 0
        end
        if fp then
            if fp.rating then res.rating = fp.rating end
            if fp.minutes then res.mins = fp.minutes; res.played = fp.minutes > 0 or res.played end
            if fp.touches then res.touches = fp.touches end
            if fp.passes then res.passes = fp.passes end
            if fp.passesOk then res.passOk = fp.passesOk end
            if fp.shots then res.shots = fp.shots end
            for _, b in res.bars do
                local key = b[1] :: string
                if key == "Touches" then b[2] = res.touches
                elseif key == "Shots" then b[2] = res.shots
                elseif key == "Pass accuracy" and res.passes > 0 then b[2] = math.floor(res.passOk / res.passes * 100 + 0.5) end
            end
        end
        if PS_COUNT > 400 then
            PS_CACHE = {}
            PS_COUNT = 0
        end
        PS_CACHE[ck] = res
        PS_COUNT += 1
        return res
    end
end

-- ---------------------------------------------------------------------
-- standings (prior results + every started match of the matchday)
-- ---------------------------------------------------------------------
type Row = { k: string, p: number, w: number, d: number, l: number, gf: number, ga: number, gd: number, pts: number, live: boolean, i: number }
-- tables sent by the live data, by league
local FEED_TABLES: { [string]: { Row } } = {}
local function standings(lg: string, matches: { Match }): { Row }
    local L = LEAGUES[lg]
    local rows: { [string]: Row } = {}
    local list: { Row } = {}
    local given = FEED_TABLES[lg]
    if given then
        for _, g in given do
            local row = table.clone(g)
            row.live = false
            for _, m in matches do
                if m.lg == lg and m.status == "live" and (m.h == row.k or m.a == row.k) then row.live = true end
            end
            table.insert(list, row)
        end
        return list
    end
    for i, k in L.teams do
        local row: Row = { k = k, p = 0, w = 0, d = 0, l = 0, gf = 0, ga = 0, gd = 0, pts = 0, live = false, i = i }
        rows[k] = row
        table.insert(list, row)
    end
    local function add(h: string, a: string, hs: number, as: number, live: boolean)
        local rh, ra = rows[h], rows[a]
        if rh == nil or ra == nil then return end
        rh.p += 1; ra.p += 1
        rh.gf += hs; rh.ga += as; ra.gf += as; ra.ga += hs
        if hs > as then rh.w += 1; ra.l += 1; rh.pts += 3
        elseif hs < as then ra.w += 1; rh.l += 1; ra.pts += 3
        else rh.d += 1; ra.d += 1; rh.pts += 1; ra.pts += 1 end
        rh.live = rh.live or live
        ra.live = ra.live or live
    end
    for _, f in L.prior do add(f[1] :: string, f[2] :: string, f[3] :: number, f[4] :: number, false) end
    for _, m in matches do
        if m.lg == lg and m.status ~= "ns" then add(m.h, m.a, m.hs, m.as, m.status == "live") end
    end
    for _, row in list do row.gd = row.gf - row.ga end
    table.sort(list, function(a: Row, b: Row): boolean
        if a.pts ~= b.pts then return a.pts > b.pts end
        if a.gd ~= b.gd then return a.gd > b.gd end
        if a.gf ~= b.gf then return a.gf > b.gf end
        return a.i < b.i
    end)
    return list
end


-- =====================================================================
-- screen entry points (built below; used by ACTIONS and LIFECYCLE)
-- =====================================================================
-- actions (defined in ACTIONS below)
local openMatch: (self: Scoreline, id: number) -> ()
local closeMatch: (self: Scoreline) -> ()
local setTab: (self: Scoreline, i: number) -> ()
local setDay: (self: Scoreline, d: number) -> ()
local toggleLive: (self: Scoreline) -> ()
local openSheet: (self: Scoreline) -> ()
local closeSheet: (self: Scoreline) -> ()
local toggleGroup: (self: Scoreline, key: string) -> ()
local toggleFavMatch: (self: Scoreline, id: number) -> ()
local setSide: (self: Scoreline, side: string) -> ()
local openPlayer: (self: Scoreline, team: string, n: number, from: { number }?) -> ()
local closePlayer: (self: Scoreline) -> ()
local stepPlayer: (self: Scoreline, dir: number) -> ()
local followPlayer: (self: Scoreline, team: string, n: number) -> ()
local unfollow: (self: Scoreline) -> ()
local isFollowed: (self: Scoreline, team: string, n: number) -> boolean
local openScene: (self: Scoreline, m: Match, ev: Event, kind: string) -> ()
local openFollowed: (self: Scoreline, m: Match, team: string, n: number) -> ()
local closeScene: (self: Scoreline) -> ()
local tapScene: (self: Scoreline) -> ()
local findMatch: (self: Scoreline, id: number) -> Match?
local matchOf: (self: Scoreline, team: string) -> (Match?, string)
local LIST_TOP, DETAIL_TOP = 159, 96
local drawListScreen: (self: Scoreline, r: Renderer, now: number) -> ()
local placeDayInd: (self: Scoreline, now: number, animate: boolean) -> ()
local liveMatches: (self: Scoreline) -> { Match }
local followInfo: (self: Scoreline) -> (Match?, string, Person?)
local drawDetailScreen: (self: Scoreline, r: Renderer, m: Match, now: number) -> ()
local drawPlayerView: (self: Scoreline, r: Renderer, now: number) -> ()
local drawScene: (self: Scoreline, r: Renderer, now: number) -> ()
local drawToast: (self: Scoreline, r: Renderer, now: number) -> ()
local drawSheet: (self: Scoreline, r: Renderer, now: number) -> ()
local leagueRows: (self: Scoreline, r: Renderer, lg: string, hiA: string, hiB: string, y: number, now: number, t0: number) -> number
local drawDesktop: (self: Scoreline, r: Renderer, now: number) -> ()
local toastRect: (self: Scoreline, now: number) -> (number, boolean)
local sceneEnd: (self: Scoreline) -> number
local TOAST = { x = 16, w = 358, h = 66, y = 50 }
-- the app clock. Before Play it stands at 0, the same instant the first played
-- frame shows, so pressing Play never makes anything jump.
local function nowOf(self: Scoreline): number
    return self.t
end
local buildIcons: () -> { [string]: Path }

-- Every drawing helper and screen is built inside one function, so their
-- locals live in its own frame (Luau allows 200 locals per function).
local function buildViews()

-- =====================================================================
-- VIEW — shared pieces: icons, flags, header, photos, badges
-- =====================================================================
do
    local ICON_SRC: { [string]: string } = {
        sub = "M 7 4 L 7 17 M 3 13 L 7 17 L 11 13 M 17 20 L 17 7 M 13 11 L 17 7 L 21 11",
        back = "M 7.5 1.5 L 1.5 8 L 7.5 14.5",
        fwd = "M 1.5 1.5 L 7.5 8 L 1.5 14.5",
        follow = "M 12 3 L 14.6 8.6 L 20.7 9.4 L 16.2 13.6 L 17.3 19.7 L 12 16.8 L 6.6 19.7 L 7.7 13.6 L 3.2 9.4 L 9.3 8.6 Z",
        close = "M 1 1 L 11 11 M 11 1 L 1 11",
        chev = "M 1 1 L 5 5 L 9 1",
        chevR = "M 1 1 L 5 5 L 1 9",
        up = "M 4 9 L 4 1 M 1 4 L 4 1 L 7 4",
        down = "M 4 1 L 4 9 M 1 6 L 4 9 L 7 6",
        play = "M 0 0 L 7 4.5 L 0 9 Z",
        plus = "M 5 0 L 5 10 M 0 5 L 10 5",
        diamond = "M 15 4.3 L 27 15 L 15 25.7 L 3 15 Z",
        mexArc = "M 12.4 16.6 C 14.13 17.8 15.87 17.8 17.6 16.6",
        -- unit-sized glyphs for the round tags (centred on 0, 0)
        -- the football boot, drawn like the ball: an outlined upper, a solid sole
        -- with four studs, two laces (unit-sized, centred, toe to the right)
        bootUp = "M -0.60 -0.27 C -0.50 -0.31 -0.36 -0.29 -0.27 -0.22 C -0.19 -0.17 -0.11 -0.19 -0.05 -0.27 "
            .. "C 0.08 -0.12 0.28 -0.01 0.50 0.04 C 0.63 0.07 0.67 0.15 0.62 0.18 L -0.60 0.18 C -0.64 0.05 -0.65 -0.16 -0.60 -0.27 Z",
        bootSole = "M -0.62 0.14 L 0.63 0.14 C 0.66 0.19 0.63 0.25 0.57 0.25 L -0.59 0.25 C -0.63 0.24 -0.64 0.19 -0.62 0.14 Z "
            .. "M -0.545 0.25 L -0.415 0.25 L -0.438 0.36 L -0.522 0.36 Z M -0.275 0.25 L -0.165 0.25 L -0.185 0.36 L -0.255 0.36 Z "
            .. "M 0.105 0.25 L 0.215 0.25 L 0.195 0.36 L 0.125 0.36 Z M 0.355 0.25 L 0.485 0.25 L 0.462 0.36 L 0.378 0.36 Z",
        bootLace = "M -0.01 -0.17 L 0.06 -0.09 M 0.12 -0.09 L 0.19 -0.01",
        arrowL = "M 0.42 0 L -0.4 0 M -0.04 -0.36 L -0.42 0 L -0.04 0.36",
        arrowR = "M -0.42 0 L 0.4 0 M 0.04 -0.36 L 0.42 0 L 0.04 0.36",
        chevUp = "M 1 5 L 5 1 L 9 5",
    }

    buildIcons = function(): { [string]: Path }
        local out: { [string]: Path } = {}
        for k, s in ICON_SRC do out[k] = parsePath(s) end
        -- five-point star and pentagon, radius 1 around the origin
        local st = Path.new()
        local pg = Path.new()
        local p5 = Path.new()
        local v5: { Vector } = {}
        for i = 0, 9 do
            local a = -math.pi / 2 + i * math.pi / 5
            local rr = if i % 2 == 1 then 0.42 else 1
            local v = Vector.xy(math.cos(a) * rr, math.sin(a) * rr)
            if i == 0 then st:moveTo(v) else st:lineTo(v) end
            if i % 2 == 0 then
                local w = Vector.xy(math.cos(a), math.sin(a))
                table.insert(v5, w)
                if i == 0 then pg:moveTo(w) else pg:lineTo(w) end
            end
        end
        st:close()
        pg:close()
        -- pentagram (Morocco): every second vertex
        for i = 0, 5 do
            local v = v5[((i * 2) % 5) + 1]
            if i == 0 then p5:moveTo(v) else p5:lineTo(v) end
        end
        out.star = st
        out.pent = pg
        out.p5 = p5
        -- ball seams: from the centre panel's corners to the rim panels
        local sm = Path.new()
        for i = 0, 4 do
            local a = -math.pi / 2 + i * 2 * math.pi / 5
            sm:moveTo(Vector.xy(math.cos(a) * 0.36, math.sin(a) * 0.36))
            sm:lineTo(Vector.xy(math.cos(a) * 0.72, math.sin(a) * 0.72))
        end
        out.seams = sm
        local c30 = Path.new()
        addCircle(c30, 15, 15, 15)
        out.clip30 = c30
        return out
    end
end

-- draw a named icon path at (x, y) scaled by k
local function icon(self: Scoreline, r: Renderer, name: string, x: number, y: number, k: number, c: Color, stroke: number?)
    r:save()
    r:transform(Mat2D.withTranslation(x, y) * Mat2D.withScale(k, k))
    local p = paint(self, c, stroke)
    r:drawPath(self.icons[name], p)
    r:restore()
end

local function star(self: Scoreline, r: Renderer, cx: number, cy: number, rad: number, c: Color, stroke: number?)
    r:save()
    r:transform(Mat2D.withTranslation(cx, cy) * Mat2D.withScale(rad, rad))
    r:drawPath(self.icons.star, paint(self, c, if stroke then stroke / rad else nil))
    r:restore()
end
-- the active "favourite" star: filled with the same spectrum as the Today indicator
local function gstar(self: Scoreline, r: Renderer, cx: number, cy: number, rad: number)
    r:save()
    r:transform(Mat2D.withTranslation(cx, cy) * Mat2D.withScale(rad, rad))
    r:clipPath(self.icons.star)
    r:transform(Mat2D.withTranslation(-1, -1) * Mat2D.withScale(2, 2))
    r:drawPath(self.unit, gradPaint(self, 2, true))
    r:restore()
end
-- the follow / favourite button glyph (24 px box at x, y)
local function followIcon(self: Scoreline, r: Renderer, x: number, y: number, on: boolean)
    if on then
        r:save()
        r:transform(Mat2D.withTranslation(x, y))
        r:clipPath(self.icons.follow)
        r:transform(Mat2D.withTranslation(3, 3) * Mat2D.withScale(18, 17))
        r:drawPath(self.unit, gradPaint(self, 2, true))
        r:restore()
    else
        icon(self, r, "follow", x, y, 1, TEXT, 1.5)
    end
end

-- round national flag, (x, y) = top-left, size in px
local function crest(self: Scoreline, r: Renderer, key: string, x: number, y: number, size: number)
    local ops = FLAGS[key]
    if ops == nil then return end
    local k = size / 30
    r:save()
    r:transform(Mat2D.withTranslation(x, y) * Mat2D.withScale(k, k))
    r:clipPath(self.icons.clip30)
    for _, op in ops do
        local kind = op[1] :: string
        if kind == "h" or kind == "v" then
            local n = #op - 1
            for i = 1, n do
                local c = hex(op[i + 1] :: number)
                local a, b = (i - 1) * 30 / n, 30 / n + 0.4
                if kind == "h" then rect(self, r, 0, a, 30, b, c) else rect(self, r, a, 0, b, 30, c) end
            end
        elseif kind == "r" then
            rect(self, r, op[2] :: number, op[3] :: number, op[4] :: number, op[5] :: number, hex(op[6] :: number))
        elseif kind == "c" then
            circle(self, r, op[2] :: number, op[3] :: number, op[4] :: number, hex(op[5] :: number))
        elseif kind == "cs" then
            circle(self, r, op[2] :: number, op[3] :: number, op[4] :: number, hex(op[6] :: number), op[5] :: number)
        elseif kind == "s" then
            star(self, r, op[2] :: number, op[3] :: number, op[4] :: number, hex(op[5] :: number))
        elseif kind == "p5" then
            local rad = op[4] :: number
            r:save()
            r:transform(Mat2D.withTranslation(op[2] :: number, op[3] :: number) * Mat2D.withScale(rad, rad))
            r:drawPath(self.icons.p5, lookPaint(self, hex(op[5] :: number), (op[6] :: number) / rad, 0, "miter"))
            r:restore()
        elseif kind == "d" then
            r:drawPath(self.icons.diamond, paint(self, hex(op[2] :: number)))
        elseif kind == "a" then
            r:drawPath(self.icons.mexArc, paint(self, hex(op[2] :: number), 0.9))
        elseif kind == "rr" then
            local x0, y0, w0, h0, rad = op[2] :: number, op[3] :: number, op[4] :: number, op[5] :: number, op[6] :: number
            rrect(self, r, x0, y0, w0, h0, rad, hex(op[7] :: number))
            rrect(self, r, x0, y0, w0, h0, rad, hex(op[8] :: number), 0.6)
        end
    end
    r:restore()
end

local function statusBar(self: Scoreline, r: Renderer)
    if self.desk then return end
    txt(self, r, "S", "16:07", 36, 39.5, 15, 0, TEXT)
    rrect(self, r, 335.7, 29.7, 23.6, 10.6, 4.3, hex(0xFFFFFF, 0.5), 1.4)
    rrect(self, r, 338, 32, 7.6, 6, 1.5, hex(0xFF5A5A))
    local lw = txt(self, r, "M", "LTE", 329, bc(35.5, 13), 13, 0, TEXT, 1)
    local sx = 329 - lw - 6 - 18
    for i = 0, 3 do
        local hh = 4 + i * 2
        rrect(self, r, sx + i * 5, 40.5 - hh, 3, hh, 1, TEXT)
    end
end

-- =====================================================================
-- MATERIAL — glass, soft light, buttons.
-- Glass is the base of the Live icon: a dark pane, a 1 px light rim that
-- is a touch brighter at the bottom, a faint second rim inside it and a
-- whisper of sheen. Over pictures the pane thins and the picture under it
-- is drawn frosted. Every button is glass: a soft white halo on hover, a
-- small dip when pressed, and its label rolls letter by letter when it is
-- clicked or when its section opens (never on hover). The hover light is a
-- soft white spot that follows the cursor inside the control, never the
-- whole control.
-- =====================================================================

-- a vertical gradient spanning y0..y1 of the current space (cached)
local function vgrad(self: Scoreline, key: string, stops: { { number } }, y0: number, y1: number, stroke: number?): Paint
    local a = math.clamp(math.floor(self.ga * 20 + 0.5), 0, 20)
    local k = key .. "|" .. tostring(math.floor(y0)) .. "|" .. tostring(math.floor(y1)) .. "|" .. tostring(a)
    local gr = self.grads[k]
    if gr == nil then
        local gs: { GradientStop } = {}
        for _, st in stops do
            table.insert(gs, { position = st[1], color = hex(st[2], (st[3] or 1) * a / 20) })
        end
        gr = Gradient.linear(Vector.xy(0, y0), Vector.xy(0, y1), gs)
        self.grads[k] = gr
        self.gcount += 1
    end
    return gradLook(self, k, gr, stroke)
end

local GL_RIM = { { 0, 0xFFFFFF, 0.22 }, { 0.45, 0xFFFFFF, 0.13 }, { 0.8, 0xFFFFFF, 0.15 }, { 1, 0xFFFFFF, 0.28 } }
local GL_SHEEN = { { 0, 0xFFFFFF, 0.045 }, { 0.55, 0xFFFFFF, 0 }, { 1, 0xFFFFFF, 0.015 } }

-- the hover light: a soft white spot centred under the cursor at (sx, sy) in the
-- current space; rad its radius, a its peak opacity. Cached in 2 px steps.
local HALO = 0.9 -- the hover light's overall strength, on every control
local function spotLook(self: Scoreline, sx: number, sy: number, rad: number, a: number, stroke: number?, feather: number?): Paint
    local qx, qy = math.floor(sx * 0.5 + 0.5) * 2, math.floor(sy * 0.5 + 0.5) * 2
    local qr = math.max(math.floor(rad + 0.5), 4)
    local qa = math.clamp(math.floor(a * HALO * self.ga * 200 + 0.5), 0, 200)
    local k = "spot|" .. tostring(qx) .. "|" .. tostring(qy) .. "|" .. tostring(qr) .. "|" .. tostring(qa)
    local gr = self.grads[k]
    if gr == nil then
        local gs: { GradientStop } = {}
        for i = 0, 10 do
            local t = i / 10
            table.insert(gs, { position = t, color = hex(0xFFFFFF, (1 - t * t) ^ 2 * qa / 200) })
        end
        gr = Gradient.radial(Vector.xy(qx, qy), qr, gs)
        self.grads[k] = gr
        self.gcount += 1
    end
    return gradLook(self, k, gr, stroke, feather)
end
-- how far the hover light reaches on a control of this size
local function spotR(w: number, h: number): number
    return math.clamp(math.max(w, h) * 0.42, 26, 78)
end
-- where the hover light sits when the control keeps no state: the cursor
local function hoverAt(self: Scoreline, x: number, y: number): (number, number)
    return self.hover.x - (x + self.ox), self.hover.y - (y + self.oy)
end

-- the rim of a glass pane: a single 1 px line, brighter at the bottom.
-- Drawn after anything that sits on the pane (photos rise behind it, never over it).
-- lit / (sx, sy): the hover light and where the cursor is, in the pane's space.
local function glassRim(self: Scoreline, r: Renderer, x: number, y: number, w: number, h: number, rad: number, lit: number?, sx: number?, sy: number?)
    local l = lit or 0
    rad = math.min(rad, w / 2, h / 2)
    r:save()
    r:transform(Mat2D.withTranslation(x + 0.5, y + 0.5))
    local rp = vgrad(self, "glr", GL_RIM, 0, h, 1)
    local sh = shape(self, w - 1, h - 1, rad - 0.5, rad - 0.5, rad - 0.5, rad - 0.5)
    r:drawPath(sh, rp)
    if l > 0.003 then
        -- the rim catches the light only near the cursor
        local hx, hy = sx, sy
        if hx == nil or hy == nil then hx, hy = hoverAt(self, x, y) end
        local hr = spotR(w, h) * 1.2
        r:drawPath(sh, spotLook(self, (hx :: number) - 0.5, (hy :: number) - 0.5, hr, 0.3 * l, 3, 10))
        r:drawPath(sh, spotLook(self, (hx :: number) - 0.5, (hy :: number) - 0.5, hr, 0.6 * l, 1))
    end
    r:restore()
end

-- the pane of glass without its rim. body: opacity of the dark pane (about 1 on
-- black, lower over pictures); lit: 0..1, the hover light, a soft spot under the
-- cursor at (sx, sy) in the pane's space; tint: optional colour for the pane
local function glassPane(self: Scoreline, r: Renderer, x: number, y: number, w: number, h: number, rad: number, body: number?, lit: number?, tint: Color?, sx: number?, sy: number?)
    if w <= 2 or h <= 2 then return end
    local l = lit or 0
    rad = math.min(rad, w / 2, h / 2)
    r:save()
    r:transform(Mat2D.withTranslation(x, y))
    local sh = shape(self, w, h, rad, rad, rad, rad)
    r:drawPath(sh, paint(self, tint or hex(0x121212, body or 0.96)))
    r:drawPath(sh, vgrad(self, "gls", GL_SHEEN, 0, h))
    if l > 0.003 then
        local hx, hy = sx, sy
        if hx == nil or hy == nil then hx, hy = hoverAt(self, x, y) end
        r:drawPath(sh, spotLook(self, hx :: number, hy :: number, spotR(w, h), 0.14 * l))
    end
    r:restore()
end

-- a glass pane with its rim
local function glass(self: Scoreline, r: Renderer, x: number, y: number, w: number, h: number, rad: number, body: number?, lit: number?, tint: Color?, sx: number?, sy: number?)
    if w <= 2 or h <= 2 then return end
    glassPane(self, r, x, y, w, h, rad, body, lit, tint, sx, sy)
    glassRim(self, r, x, y, w, h, rad, lit, sx, sy)
end

-- a soft light, without any noise: a smooth bump fall-off, (1 - t^2)^3, that
-- reaches zero with no visible edge, and a core a touch whiter than its rim.
-- All three colour channels change at different rates, so their 8-bit steps
-- interleave and the light reads smooth instead of in rings.
-- (cx, cy) centre and (rx, ry) radii, drawn inside the box (x, y, w, h).
local function softLight(self: Scoreline, r: Renderer, x: number, y: number, w: number, h: number, cx: number, cy: number, rx: number, ry: number, color: number, alpha: number)
    if alpha * self.ga <= 0.003 or w <= 0 or h <= 0 then return end
    local a = math.clamp(math.floor(self.ga * alpha * 80 + 0.5), 0, 80)
    local gk = "sl" .. tostring(color) .. "|" .. tostring(a)
    local gr = self.grads[gk]
    if gr == nil then
        local gs: { GradientStop } = {}
        for i = 0, 24 do
            local t = i / 24
            local v = (1 - t * t) ^ 3
            table.insert(gs, { position = t * 0.5, color = hex(mix(color, 0xFFFFFF, 0.35 * (1 - t) ^ 2), v * a / 80) })
        end
        gr = Gradient.radial(Vector.xy(0.5, 0.5), 0.5, gs)
        self.grads[gk] = gr
        self.gcount += 1
    end
    r:save()
    clipRect(self, r, x, y, w, h)
    r:transform(Mat2D.withTranslation(cx - rx, cy - ry) * Mat2D.withScale(rx * 2, ry * 2))
    r:drawPath(self.unit, gradLook(self, gk, gr))
    r:restore()
end

-- the motion state of a control
local function uiOf(self: Scoreline, id: string): UiState
    local st = self.ui[id]
    if st == nil then
        st = { h = tween(0), hv = false, pr = false, pt = -100, rt = -100, pk = 0, rollT = -100, seen = 0, hx = 0, hy = 0 }
        self.ui[id] = st
    end
    st.seen = self.frame
    return st
end

-- hover light (0..1) and press dip (0..1) of a control at (x, y, w, h) in the current offset
local function uiFeel(self: Scoreline, id: string, x: number, y: number, w: number, h: number): (number, number, UiState)
    local now = nowOf(self)
    local st = uiOf(self, id)
    local hv = self.hover
    local ax, ay = x + self.ox, y + self.oy
    local inside = hv.on and hv.x >= ax and hv.x <= ax + w and hv.y >= ay and hv.y <= ay + h
        and hv.y >= self.clipTop and hv.y <= self.clipBot
    -- the hover light follows the cursor, and stays where it left when it fades
    if inside then st.hx, st.hy = hv.x - ax, hv.y - ay end
    if inside ~= st.hv then
        st.hv = inside
        retarget(st.h, now, if inside then 1 else 0, if inside then 0.28 else 0.55, GLIDE)
    end
    local pr = self.press.id == id
    if pr ~= st.pr then
        st.pr = pr
        if pr then
            st.pt = now
            if not inside then st.hx, st.hy = self.press.x - ax, self.press.y - ay end
            -- a click rolls the label (hovering never does)
            if now - st.rollT > 0.6 then st.rollT = now end
        else
            -- a quick tap still shows the whole dip
            st.pk = math.max(ease(EASE, now, st.pt, 0.12), 0.8)
            st.rt = now
        end
    end
    local p = if pr then ease(EASE, now, st.pt, 0.12) else st.pk * (1 - ease(GLIDE, now, st.rt, 0.5))
    return tv(st.h, now), p, st
end

-- a glass button. Draw its label between btnOpen and btnClose: the label dips with it.
-- Returns hover light, press dip and the state (for the letter roll).
local function btnOpen(self: Scoreline, r: Renderer, id: string, x: number, y: number, w: number, h: number, rad: number, onTap: () -> (), body: number?): (number, number, UiState)
    local lit, p, st = uiFeel(self, id, x, y, w, h)
    local s = 1 - 0.05 * p
    local cx, cy = x + w / 2, y + h / 2
    r:save()
    r:transform(Mat2D.withTranslation(cx, cy) * Mat2D.withScale(s, s) * Mat2D.withTranslation(-cx, -cy))
    glass(self, r, x, y, w, h, rad, body, math.max(lit, p * 0.7), nil, st.hx, st.hy)
    hit(self, x, y, w, h, onTap, id)
    return lit, p, st
end
local function btnClose(r: Renderer)
    r:restore()
end

-- a label whose letters roll up and come back in from below, one after another
-- (t = seconds since the roll started; otherwise plain text). Returns width.
local ROLL = C(0.7, 0, 0.2, 1)
local function rollTxt(self: Scoreline, r: Renderer, font: string, s: string, x: number, base: number, size: number, track: number, c: Color, align: number?, t: number): number
    local nch = utf8.len(s) or #s
    if t < 0 or t > 0.42 + nch * 0.011 then return txt(self, r, font, s, x, base, size, track, c, align) end
    local tp = textPath(self, font, s, track)
    local w = tp.adv * size / 1000
    local x0 = x - w * (align or 0)
    local k = size / 1000
    local hgt = size * 1.25
    local set = self.fonts[font]
    local pc = paint(self, c)
    r:save()
    clipRect(self, r, x0 - 3, base - size * 1.02, w + 6, size * 1.34)
    local adv, i = 0, 0
    for _, cp in utf8.codes(s) do
        local ch = utf8.char(cp)
        local g = set[ch] or self.fonts.M[ch]
        if g then
            local p = bez(ROLL, prog(t, i * 0.011, 0.42))
            if p < 1 then
                r:save()
                r:transform(Mat2D.withTranslation(x0 + adv * k, base - hgt * p) * Mat2D.withScale(k, k))
                r:drawPath(g.path, pc)
                r:restore()
            end
            if p > 0 then
                r:save()
                r:transform(Mat2D.withTranslation(x0 + adv * k, base + hgt * (1 - p)) * Mat2D.withScale(k, k))
                r:drawPath(g.path, pc)
                r:restore()
            end
            adv += g.adv + track * 1000
        else
            adv += 250 + track * 1000
        end
        i += 1
    end
    r:restore()
    return w
end

-- a glass pill button with a rolling label
local function pillBtn(self: Scoreline, r: Renderer, id: string, label: string, cx: number, y: number, h: number, onTap: () -> (), minW: number?): number
    local fs = 13
    local w = math.max(tw(self, "S", label, fs) + 40, minW or 0)
    local _, _, st = btnOpen(self, r, id, cx - w / 2, y, w, h, h / 2, onTap)
    rollTxt(self, r, "S", label, cx, bc(y + h / 2, fs), fs, 0, TEXT, 0.5, nowOf(self) - st.rollT)
    btnClose(r)
    return w
end

-- a round glass icon button (40 px); draw the glyph between this and btnClose
local function roundBtn(self: Scoreline, r: Renderer, id: string, x: number, y: number, onTap: () -> ()): number
    local _, p = btnOpen(self, r, id, x, y, 40, 40, 20, onTap)
    return p
end

-- press feedback for things that are not glass (rows, cards, tabs): 0..1
local function pressOf(self: Scoreline, id: string, x: number, y: number, w: number, h: number): (number, number)
    local lit, p = uiFeel(self, id, x, y, w, h)
    return p, lit
end

-- ---------------------------------------------------------------------
-- tags: the ball, assists, cards and ratings are small, compact tags
-- ---------------------------------------------------------------------
local BALL_INK = hex(0x161616)

-- the ball, line-drawn: dark outline, a solid centre panel, seams to the rim panels
local function ballGlyph(self: Scoreline, r: Renderer, cx: number, cy: number, rad: number, ink: Color)
    r:save()
    r:transform(Mat2D.withTranslation(cx, cy) * Mat2D.withScale(rad, rad))
    local ip = paint(self, ink)
    r:save()
    r:transform(Mat2D.withScale(0.36, 0.36))
    r:drawPath(self.icons.pent, ip)
    r:restore()
    r:save()
    r:clipPath(self.circ)
    for i = 0, 4 do
        local a = -math.pi / 2 + i * 2 * math.pi / 5
        r:save()
        r:transform(Mat2D.withTranslation(math.cos(a) * 1.02, math.sin(a) * 1.02) * Mat2D.withRotation(a - math.pi / 2) * Mat2D.withScale(0.32, 0.32))
        r:drawPath(self.icons.pent, ip)
        r:restore()
    end
    r:restore()
    r:drawPath(self.icons.seams, paint(self, ink, 0.1))
    r:drawPath(self.circ, paint(self, ink, 0.12))
    r:restore()
end

-- a round tag: just the disc, no outline
local function tagDisc(self: Scoreline, r: Renderer, cx: number, cy: number, rad: number, fill: Color)
    circle(self, r, cx, cy, rad, fill)
end

-- the ball tag, used everywhere a goal is shown
local function ball(self: Scoreline, r: Renderer, cx: number, cy: number, rad: number)
    tagDisc(self, r, cx, cy, rad, TEXT)
    ballGlyph(self, r, cx, cy, rad * 0.76, BALL_INK)
end

local function bootTag(self: Scoreline, r: Renderer, cx: number, cy: number, rad: number)
    tagDisc(self, r, cx, cy, rad, TEXT)
    r:save()
    r:transform(Mat2D.withTranslation(cx, cy - rad * 0.06) * Mat2D.withScale(rad * 1.166, rad * 1.166))
    r:drawPath(self.icons.bootUp, paint(self, BALL_INK, 0.085))
    r:drawPath(self.icons.bootSole, paint(self, BALL_INK))
    r:drawPath(self.icons.bootLace, paint(self, BALL_INK, 0.085))
    r:restore()
end

-- a card, slightly tilted, on a white tag
local function cardTag(self: Scoreline, r: Renderer, cx: number, cy: number, rad: number, c: Color)
    tagDisc(self, r, cx, cy, rad, TEXT)
    r:save()
    r:transform(Mat2D.withTranslation(cx, cy) * Mat2D.withRotation(0.2))
    local w, h = rad * 0.82, rad * 1.18
    rrect(self, r, -w / 2, -h / 2, w, h, rad * 0.16, c)
    r:restore()
end

-- substitution tags: red with an arrow out, green with an arrow in
local function subTag(self: Scoreline, r: Renderer, cx: number, cy: number, rad: number, out: boolean)
    tagDisc(self, r, cx, cy, rad, if out then RED else LIVE)
    r:save()
    r:transform(Mat2D.withTranslation(cx, cy) * Mat2D.withScale(rad * 1.12, rad * 1.12))
    local ap = paint(self, if out then TEXT else INK_DARK, 0.17)
    r:drawPath(if out then self.icons.arrowL else self.icons.arrowR, ap)
    r:restore()
end

-- substituted off, on the pitch: a red capsule with the arrow and the minute.
-- (right, cy) anchor: it grows to the left from `right`. Returns width.
local function subOffTag(self: Scoreline, r: Renderer, minute: number, right: number, cy: number): number
    local fs = 9.5
    local hgt = 16
    local label = tostring(minute) .. "'"
    local lw = tw(self, "B", label, fs)
    local w = 5 + 8 + 3 + lw + 6
    local x0 = right - w
    local rad = hgt / 2
    rrect(self, r, x0, cy - hgt / 2, w, hgt, rad, RED)
    r:save()
    r:transform(Mat2D.withTranslation(x0 + 5 + 4, cy) * Mat2D.withScale(8.4, 8.4))
    r:drawPath(self.icons.arrowL, paint(self, TEXT, 0.19))
    r:restore()
    txt(self, r, "B", label, x0 + 5 + 8 + 3, bc(cy, fs), fs, 0, TEXT)
    return w
end

-- rating colours: our spectrum for the great games (8+), then green, yellow, orange, red
local function ratingInk(v: number): (Color?, Color)
    if v >= 8 then return nil, INK end
    if v >= 7 then return hex(0x34E39A), hex(0x03261A) end
    if v >= 6.5 then return hex(0xF5C542), hex(0x2A1F00) end
    if v >= 6 then return hex(0xF28C3A), hex(0x2A1100) end
    return hex(0xFF4D4D), hex(0xFFFFFF)
end
-- fills a rounded box with a rating's colour (or the spectrum)
local function ratingBox(self: Scoreline, r: Renderer, v: number, x: number, y: number, w: number, h: number, rad: number)
    local bg = ratingInk(v)
    if bg then rrect(self, r, x, y, w, h, rad, bg) else rbox(self, r, x, y, w, h, rad, gradPaint(self, 2, true)) end
end
-- the rating tag; (x, cy) anchor, align 0 grows right, 1 grows left. Returns width.
local function ratingTag(self: Scoreline, r: Renderer, v: number, x: number, cy: number, best: boolean, align: number?, size: number?): number
    local fs = size or 10
    local hgt = math.floor(fs * 1.6 + 0.5)
    local label = string.format("%.1f", v)
    local w = tw(self, "B", label, fs) + fs * 1.1 + (if best then fs * 1.05 else 0)
    local x0 = x - w * (align or 0)
    local rad = hgt * 0.32
    ratingBox(self, r, v, x0, cy - hgt / 2, w, hgt, rad)
    local _, fg = ratingInk(v)
    local tx = x0 + fs * 0.55
    if best then
        star(self, r, tx + fs * 0.4, cy, fs * 0.42, fg)
        tx += fs * 1.05
    end
    txt(self, r, "B", label, tx, bc(cy, fs), fs, 0, fg)
    return w
end

-- what a player did, as round tags: goals, assists, cards. Repeats stack like coins.
-- (x, cy) anchor; align 0 grows right, 1 grows left. Returns width.
local function eventTags(self: Scoreline, r: Renderer, lu: Lineup, n: number, x: number, cy: number, align: number, rad: number?): number
    local R = rad or 7
    local list: { string } = {}
    for _ = 1, math.min(lu.goals[n] or 0, 3) do table.insert(list, "g") end
    for _ = 1, math.min(lu.assists[n] or 0, 3) do table.insert(list, "a") end
    if lu.yc[n] then table.insert(list, "y") end
    if lu.rc[n] then table.insert(list, "r") end
    if #list == 0 then return 0 end
    local xs: { number } = {}
    local at = 0
    for i, k in list do
        if i > 1 then at += if list[i - 1] == k then R * 1.15 else R * 2 + 3 end
        xs[i] = at
    end
    local total = at + R * 2
    local ox = if align >= 1 then x - total + R else x + R
    for i = #list, 1, -1 do
        local k = list[i]
        local px = ox + xs[i]
        -- stacked like coins: a thin shade only where this one lies on the next,
        -- never around the outside
        if i < #list and xs[i + 1] - xs[i] < R * 2 then
            local nx = ox + xs[i + 1]
            local kk = (R + 1.2) / R
            r:save()
            r:transform(Mat2D.withTranslation(nx, cy) * Mat2D.withScale(R, R))
            r:clipPath(self.circ)
            r:transform(Mat2D.withTranslation((px - nx) / R, 0) * Mat2D.withScale(kk, kk))
            r:drawPath(self.circ, paint(self, hex(0x000000, 0.6)))
            r:restore()
        end
        if k == "g" then ball(self, r, px, cy, R)
        elseif k == "a" then bootTag(self, r, px, cy, R)
        elseif k == "y" then cardTag(self, r, px, cy, R, CARD)
        else cardTag(self, r, px, cy, R, RED) end
    end
    return total
end

-- tags for plain counts (goals, assists, cards) where there is no line-up entry
local function countTags(self: Scoreline, r: Renderer, g: number, a: number, y: number, red: number, x: number, cy: number, align: number, rad: number?): number
    local lu: Lineup = { team = "", form = "", xi = {}, bench = {}, on = {}, off = {}, forr = {}, goals = { [1] = g }, assists = { [1] = a }, yc = {}, rc = {} }
    if y > 0 then lu.yc[1] = 1 end
    if red > 0 then lu.rc[1] = 1 end
    return eventTags(self, r, lu, 1, x, cy, align, rad)
end

-- ---------------------------------------------------------------------
-- photos and kit tokens. Every photo edge is sharp: either the frame
-- (a circle) masks it, or something opaque is drawn over the cut.
-- ---------------------------------------------------------------------
-- shirt-number token for players without a photo: a dark disc with a ring in the team colour
local function kitDisc(self: Scoreline, r: Renderer, team: string, n: number, cx: number, cy: number, rad: number)
    -- no player known (a goal credited to the team): the crest stands in
    if n <= 0 then
        crest(self, r, team, cx - rad, cy - rad, rad * 2)
        return
    end
    local c = TEAMS[team].c1
    circle(self, r, cx, cy, rad, hex(mix(0x151515, c, 0.2)))
    circle(self, r, cx, cy, rad - 0.9, hex(pastel(c)), math.clamp(rad * 0.075, 1.4, 3))
    local s = tostring(n)
    local fs = rad * (if #s > 1 then 0.86 else 0.98)
    txt(self, r, "B", s, cx, bc(cy, fs), fs, -0.02, TEXT, 0.5)
end

-- a face cut like the notification's: head and shoulders standing on `bottom`,
-- w wide from x. Whatever clips it (a tile, a card, a chip) cuts the shoulders
-- sharp; nothing is faded. Without a photo: the shirt-number token.
-- Returns the box the bust's face crop covers (for the zoom into his page).
local function riseFace(self: Scoreline, r: Renderer, p: Person?, team: string, n: number, x: number, w: number, bottom: number, opacity: number?): { number }
    local old = self.ga
    self.ga = old * (opacity or 1)
    local f = CROP.face
    local k = w / f[3]
    local top = bottom - (f[4] - 14) * k
    if p ~= nil and hasPhoto(self, p) then
        bust(self, r, p :: Person, { f[1], f[2], f[3], f[4] + 30 }, x, top, w, (f[4] + 30) * k)
    else
        kitDisc(self, r, team, n, x + w / 2, bottom - w * 0.42, w * 0.34)
    end
    self.ga = old
    return { x, top, w, w }
end

-- a list avatar: a small glass tile lit softly in the team colour, the player
-- rising from its bottom edge and its rim drawn over him
local function photoTile(self: Scoreline, r: Renderer, p: Person?, team: string, n: number, x: number, y: number, s: number): { number }
    local rad = s * 0.3
    glassPane(self, r, x, y, s, s, rad)
    r:save()
    r:transform(Mat2D.withTranslation(x, y))
    r:clipPath(shape(self, s, s, rad, rad, rad, rad))
    r:transform(Mat2D.withTranslation(-x, -y))
    softLight(self, r, x, y, s, s, x + s / 2, y + s, s * 0.95, s * 0.8, TEAMS[team].c1, 0.5)
    local fb = riseFace(self, r, p, team, n, x, s, y + s)
    r:restore()
    glassRim(self, r, x, y, s, s, rad)
    return fb
end

-- =====================================================================
-- LIST SCREEN — Ongoing / Today, the player you follow, every match
-- =====================================================================

do
    local SEC_H = 26 + 244 + 30 -- live section: header, cards, gap
    local AREA_H = 244

    liveMatches = function(self: Scoreline): { Match }
        local fav, rest = {}, {}
        for _, m in self.matches do
            if m.status == "live" then
                table.insert(if self.favMatch[m.id] then fav else rest, m)
            end
        end
        for _, m in rest do table.insert(fav, m) end
        return fav
    end

    local function dayLayout(self: Scoreline, k: number): ({ number }, { number })
        local xs: { number }, ws: { number } = {}, {}
        local x = 0
        for i, d in DAYS do
            local w = tw(self, "M", d, 15, -0.01) + 26
            if i == 3 then w = lerp(tw(self, "M", "Today", 15, -0.01), tw(self, "M", "Ongoing", 15, -0.01), k) + 26 end
            xs[i] = x
            ws[i] = w
            x += w
        end
        return xs, ws
    end
    placeDayInd = function(self: Scoreline, now: number, animate: boolean)
        local xs, ws = dayLayout(self, if self.liveOnly then 1 else 0)
        local d = self.day
        local shift = math.floor(354 / 2 - (xs[d] + ws[d] / 2) + 0.5)
        if animate then
            retargetS(self, self.dayShift, now, shift, "list")
            retargetS(self, self.dayIndX, now, xs[d] + shift + 13, "list")
            retargetS(self, self.dayIndW, now, ws[d] - 26, "list")
        else
            self.dayShift, self.dayIndX, self.dayIndW = tween(shift), tween(xs[d] + shift + 13), tween(ws[d] - 26)
        end
    end

    -- -----------------------------------------------------------------
    -- live cards
    -- -----------------------------------------------------------------
    local SWEEP = { { 0, 0xFFFFFF, 0 }, { 0.5, 0xFFFFFF, 0.55 }, { 1, 0xFFFFFF, 0 } }

    -- a fresh goal: the side that scored keeps its new number in our spectrum
    -- for a while (input goalMark), on its card and on its row. 0..1
    local function goalMarkK(self: Scoreline, m: Match, side: string, now: number): number
        if m.goalSide ~= side then return 0 end
        local hold = math.max(tonumber((self :: any).goalMark) or 8, 0.5)
        return env(now - m.goalT, 0.35, hold, 1.2)
    end

    local function drawCard(self: Scoreline, r: Renderer, m: Match, x: number, bottom: number, w: number, rise: number, sc: number, alpha: number, grey: number, now: number)
        if w < 1 then return end
        local mm = math.min(m.min + m.sec / 60, 90)
        local hgt = 128 + 116 * mm / 90
        local top = bottom - hgt
        -- goal: a short, small dip; colours flood from the scoring side
        local gt = now - m.goalT
        local dip, flood = 0, 0
        if gt >= 0 and gt < 2.4 then
            dip = if gt < 0.09 then 6 * bez(GLIDE, gt / 0.09) else 6 * (1 - ease(INOUT, gt - 0.09, 0, 0.34))
            flood = env(gt, 0.35, 0.8, 1.0)
        end
        local cx, cy = x + w / 2, top + hgt / 2
        local cid = "card" .. tostring(m.id)
        local pk, lit = pressOf(self, cid, x, top + rise, w, hgt)
        sc *= 1 - 0.03 * pk + 0.008 * lit
        local oldGa = self.ga
        self.ga = oldGa * alpha
        if flood > 0.01 then
            local tm = TEAMS[sideTeam(m, m.goalSide)]
            local gp = lookPaint(self, hex(pastel(tm.c1), 0.55 * flood), nil, 26)
            r:save()
            r:transform(Mat2D.withTranslation(x - 4, top + rise + dip - 4))
            r:drawPath(shape(self, w + 8, hgt + 8, 10, 10, 10, 10), gp)
            r:restore()
        end
        r:save()
        r:transform(Mat2D.withTranslation(cx, cy + rise + dip) * Mat2D.withScale(sc, sc) * Mat2D.withTranslation(-cx, -cy))
        r:save()
        clipRect(self, r, x, top, w, hgt)
        local stops = matchStops(m)
        local q = math.floor(flood * 12 + 0.5) / 12
        if q > 0 then
            stops = table.clone(stops)
            local home = m.goalSide == "h"
            local tm = TEAMS[sideTeam(m, m.goalSide)]
            local hot = mix(pastel(tm.c1), tm.c1, 0.28 * q)
            if home then
                stops[1] = { 0, hot }
                stops[2] = { 0.42 + 0.36 * q, stops[2][2] }
                stops[3] = { 0.62 + 0.3 * q, stops[3][2] }
            else
                stops[4] = { 1, hot }
                stops[3] = { 0.62 - 0.36 * q, stops[3][2] }
                stops[2] = { 0.42 - 0.3 * q, stops[2][2] }
            end
        end
        box(self, r, x, top, w, hgt, stopsPaint(self, "m" .. tostring(m.id) .. m.goalSide .. tostring(q), stops, false))
        if gt >= 0 and gt < 1.2 then
            local p = ease(GLIDE, gt, 0.04, 1.0)
            local bh = 110
            local sy = if m.goalSide == "h" then lerp(top - bh, bottom, p) else lerp(bottom, top - bh, p)
            box(self, r, x, sy, w, bh, stopsPaint(self, "sweep", SWEEP, false))
        end
        local s = math.clamp((w - 62) / 110, 0, 1)
        local pad = lerp(8, 14, s)
        local f = math.clamp(w * 0.19, 14, 24)
        local fs = math.clamp(w * 0.13, 10.5, 15)
        local ss = math.clamp(w * 0.18, 13, 24)
        local rowY = top + pad + f / 2
        for _, side in { "h", "a" } do
            local k = sideTeam(m, side)
            local v = if side == "h" then m.hs else m.as
            local ink = if trails(m, side) then hex(0x000000, 0.5) else INK
            crest(self, r, k, x + pad, rowY - f / 2, f)
            local lx = x + pad + f + lerp(4, 8, s)
            local scoreW = tw(self, "B", tostring(v), ss)
            local room = x + w - pad - scoreW - 6 - lx
            local label = TEAMS[k].short
            if s > 0.35 and tw(self, "S", TEAMS[k].name, fs, 0) <= room then label = TEAMS[k].name end
            if tw(self, "S", label, fs, 0.02) <= room + 2 then
                txt(self, r, "S", label, lx, bc(rowY, fs), fs, 0.02, ink)
            end
            local bp = if m.bumpSide == side then prog(now, m.bumpT, 0.6) else 1
            local ps = if bp < 1 then 1 + 0.28 * (1 - bez(GLIDE, bp)) else 1
            local sx = x + w - pad
            local mk = goalMarkK(self, m, side, now)
            r:save()
            r:transform(Mat2D.withTranslation(sx - scoreW / 2, rowY) * Mat2D.withScale(ps, ps) * Mat2D.withTranslation(-(sx - scoreW / 2), -rowY))
            if mk > 0.01 then
                -- the new number: our spectrum on a small dark chip, so it reads on any card
                local old = self.ga
                local chH, chW = ss * 1.08, scoreW + ss * 0.52
                self.ga = old * mk
                rrect(self, r, sx + ss * 0.26 - chW, rowY - chH / 2, chW, chH, chH * 0.32, INK)
                gradTxt(self, r, "B", tostring(v), sx, bc(rowY, ss), ss, 0, 2, 1)
                self.ga = old * (1 - mk)
                txt(self, r, "B", tostring(v), sx, bc(rowY, ss), ss, 0, ink, 1)
                self.ga = old
            else
                txt(self, r, "B", tostring(v), sx, bc(rowY, ss), ss, 0, ink, 1)
            end
            r:restore()
            rowY += f + lerp(5, 8, s)
        end
        local ml = if m.status == "ft" then "FT" else minLabel(m)
        local ms = fit(self, "L", ml, math.clamp(w * 0.46, 34, 58), -0.03, w - 2 * pad - 8)
        local base = bottom - pad - 9
        txt(self, r, "L", ml, x + pad - ms * 0.03, base, ms, -0.03, INK)
        local bw = w - 2 * pad
        local by = bottom - pad - 2
        rect(self, r, x + pad, by, bw, 2, hex(0x000000, 0.16))
        rect(self, r, x + pad, by, bw * mm / 90, 2, INK)
        if m.status == "live" then
            local pulse = 0.5 + 0.5 * math.cos(now * 4)
            circle(self, r, x + pad + bw * mm / 90, by + 1, 3 + 2.5 * pulse, hex(0x000000, 0.14 * (1 - pulse)))
            circle(self, r, x + pad + bw * mm / 90, by + 1, 2.6, INK)
        end
        -- another match just scored: this card steps back into grey for a moment
        if grey > 0.004 then box(self, r, x, top, w, hgt, greyLook(self, grey)) end
        r:restore()
        r:restore()
        self.ga = oldGa
        local id = m.id
        hit(self, x, top + rise, w, hgt, function() openMatch(self, id) end, cid)
        -- desktop: a short line under the card whose match is open beside the list
        if self.desk and m.id == self.openId and alpha > 0.01 then
            local old = self.ga
            self.ga = old * alpha
            rrect(self, r, x + w / 2 - 9, bottom + rise + 7, 18, 3, 1.5, TEXT)
            self.ga = old
        end
    end

    local function drawCards(self: Scoreline, r: Renderer, top: number, now: number)
        local bottom = top + AREA_H
        -- cards on stage: live matches, plus ones that just finished (they fold away)
        local set: { Match } = {}
        local nLive = 0
        for _, m in liveMatches(self) do
            table.insert(set, m)
            nLive += 1
        end
        for _, m in self.matches do
            if m.status == "ft" and now - m.ftT < 0.9 then table.insert(set, m) end
        end
        table.sort(set, function(a: Match, b: Match): boolean
            local fa, fb = self.favMatch[a.id] == true, self.favMatch[b.id] == true
            if fa ~= fb then return fa end
            return a.id < b.id
        end)
        local gap = 4
        local target = if nLive > 0 then (366 - gap * (nLive - 1)) / nLive else 0
        local gm, gtime = 0, 99
        for _, m in set do
            local t = now - m.goalT
            if t >= 0 and t < gtime then gm, gtime = m.id, t end
        end
        local e = if gm > 0 then env(gtime, 0.3, 1.1, 0.7) else 0
        -- while a goal is fresh only the scoring card keeps its colour (input goalFocus);
        -- goals that land together keep all their cards in colour
        local focusHold = math.max(tonumber((self :: any).goalFocus) or 4, 0.5)
        local function focusOf(m: Match): number return env(now - m.goalT, 0.45, focusHold, 0.9) end
        local focus = 0
        for _, m in set do focus = math.max(focus, focusOf(m)) end
        local closing = not self.liveOnly
        local x = 12
        for i, m in set do
            local live = m.status == "live"
            retarget(m.cw, now, if live then target else 0, 0.7, GLIDE)
            local w = tv(m.cw, now)
            -- entrance: each card rises in turn (motion: cards)
            -- (playback clock: before Play the cards wait below, so pressing Play never flashes them)
            local clk = if self.playing then now else 0
            local rise = (AREA_H + 40) * (1 - anim(self, "cards", clk, self.liveOnT, i - 1))
            -- Live off: the cards settle down and fade in turn while the list slides over them (motion: live)
            local fade = 1
            if closing then
                local k = anim(self, "live", now, self.liveOffT, i - 1)
                rise += 28 * k
                fade = 1 - k
            end
            local sc = if gm == 0 then 1 elseif m.id == gm then 1 + 0.03 * e else 1 - 0.03 * e
            local alpha = (if live then 1 else 1 - prog(now, m.ftT, 0.45)) * fade
            drawCard(self, r, m, x, bottom, w, rise, sc, alpha, math.max(focus - focusOf(m), 0), now)
            x += w + gap * math.clamp(w / 24, 0, 1)
        end
    end

    -- -----------------------------------------------------------------
    -- rows and groups
    -- -----------------------------------------------------------------
    local function drawRow(self: Scoreline, r: Renderer, m: Match, y: number, now: number)
        local rid = "row" .. tostring(m.id)
        local pk, lit = pressOf(self, rid, 12, y, 366, 76)
        local fp = prog(now, m.flashT, 1.6)
        local glow = 0.035 * lit + 0.06 * pk + (if fp > 0 and fp < 1 then 0.07 * (1 - bez(EASE, fp)) else 0)
        if self.desk and m.id == self.openId then glow += 0.06 end
        if glow > 0.002 then rrect(self, r, 12, y + 2, 366, 72, 14, hex(0xFFFFFF, glow)) end
        local cy = y + 37.5
        local ml = minLabel(m)
        if m.status == "live" then
            circle(self, r, 20.5, cy, 2.5, LIVE)
            txt(self, r, "M", ml, 29, bc(cy, 12), 12, 0, LIVE)
        else
            txt(self, r, "M", ml, 18, bc(cy, 12), 12, 0, MUTED)
        end
        for li, side in { "h", "a" } do
            local k = sideTeam(m, side)
            local lcy = y + 23 + (li - 1) * 29
            crest(self, r, k, 78, lcy - 8, 16)
            txt(self, r, "M", TEAMS[k].name, 104, bc(lcy, 15), 15, -0.01, if trails(m, side) then MUTED else TEXT)
            if m.status ~= "ns" then
                local v = tostring(if side == "h" then m.hs else m.as)
                local c = if trails(m, side) then MUTED else TEXT
                local bp = if m.bumpSide == side then prog(now, m.bumpT, 0.6) else 1
                local s = if bp < 1 then 1 + 0.3 * (1 - bez(GLIDE, bp)) else 1
                local w = tw(self, "M", v, 17)
                local mk = goalMarkK(self, m, side, now)
                r:save()
                r:transform(Mat2D.withTranslation(370 - w / 2, lcy) * Mat2D.withScale(s, s) * Mat2D.withTranslation(-(370 - w / 2), -lcy))
                if mk > 0.01 then
                    -- the new number, in our spectrum while the goal is fresh
                    local old = self.ga
                    self.ga = old * mk
                    gradTxt(self, r, "S", v, 370, bc(lcy, 17), 17, 0, 2, 1)
                    self.ga = old * (1 - mk)
                    txt(self, r, "M", v, 370, bc(lcy, 17), 17, 0, if bp < 1 then TEXT else c, 1)
                    self.ga = old
                else
                    txt(self, r, "M", v, 370, bc(lcy, 17), 17, 0, if bp < 1 then TEXT else c, 1)
                end
                r:restore()
            end
        end
        hline(self, r, 12, y + 75, 366)
        local id = m.id
        hit(self, 12, y, 366, 76, function() openMatch(self, id) end, rid)
    end

    local function openK(self: Scoreline, key: string, now: number): number
        local t = self.collapsed[key]
        if t == nil then
            t = tween(1)
            self.collapsed[key] = t
        end
        return tv(t, now)
    end

    -- rows and blocks of the feed come in one after another after a day change (motion: list)
    local blockI = 0
    local function blockIn(self: Scoreline, r: Renderer, now: number): number
        local p = anim(self, "list", now, self.feedT, blockI)
        blockI += 1
        push(self, r, 18 * (1 - p) * self.feedDir, 6 * (1 - p))
        return p
    end

    -- a collapsible group: header + rows. Returns the new y.
    local function drawGroup(self: Scoreline, r: Renderer, key: string, left: string, name: string, list: { Match }, y: number, now: number): number
        local k = openK(self, key, now)
        local oldGa = self.ga
        local gid = "grp" .. key
        local gp = pressOf(self, gid, 12, y - 10, 366, 34)
        self.ga = oldGa * blockIn(self, r, now) * (1 - 0.35 * gp)
        local hx = 18
        if key == "fav" then
            gstar(self, r, 23, y + 7, 5.6)
            hx = 34
        else
            hx += lab(self, r, left, hx, y + 10.5, MUTED) + 10
        end
        lab(self, r, name, hx, y + 10.5, TEXT)
        lab(self, r, tostring(#list), 350, y + 10.5, DIM, 1)
        r:save()
        r:transform(Mat2D.withTranslation(366, y + 7) * Mat2D.withRotation(-math.pi / 2 * (1 - k)) * Mat2D.withTranslation(-5, -3))
        r:drawPath(self.icons.chev, paint(self, MUTED, 1.4))
        r:restore()
        local gk = key
        hit(self, 12, y - 10, 366, 34, function() toggleGroup(self, gk) end, gid)
        pop(self, r)
        self.ga = oldGa
        y += 13.7 + 10
        hline(self, r, 12, y, 366, if k < 0.5 then hex(0xFFFFFF, 0.06) else HAIR)
        y += 1
        local full = #list * 76
        local vis = full * k
        if vis > 0.5 then
            -- no hard cut through a row: closing, each row fades and tucks up under
            -- the one above as the edge passes it (the last row first); opening, they
            -- come down into place in order. A row is gone before the next group
            -- can reach it.
            local oldBot = self.clipBot
            self.clipBot = math.min(oldBot, y + vis + self.oy)
            for i, m in list do
                local top = (i - 1) * 76
                local q = math.clamp((vis - top) / 76, 0, 1)
                local e = math.clamp((q - 0.25) / 0.7, 0, 1)
                e = e * e * (3 - 2 * e)
                self.ga = oldGa * blockIn(self, r, now) * e
                if e > 0.003 and inView(self, y + top - 10 * (1 - e), 76) then drawRow(self, r, m, y + top - 10 * (1 - e), now) end
                pop(self, r)
            end
            self.ga, self.clipBot = oldGa, oldBot
        end
        return y + vis + 28
    end

    -- -----------------------------------------------------------------
    -- the player you follow
    -- -----------------------------------------------------------------
    -- his match today (live first), else tomorrow's, else yesterday's
    followInfo = function(self: Scoreline): (Match?, string, Person?)
        local f = self.fol
        if f == nil then return nil, "", nil end
        local m, side = matchOf(self, f.team)
        return m, side, person(f.team, f.n)
    end

    -- his next match: opponent and kick-off (seconds since Monday 00:00 of the demo week)
    local WEEK = { "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun" }
    -- "Thu 24 Sep", "20:45"
    local function kickoffText(sec: number): (string, string)
        local d = math.floor(sec / 86400)
        local rem = sec - d * 86400
        return WEEK[(d % 7) + 1] .. " " .. tostring(21 + d) .. " Sep", pad2(rem / 3600) .. ":" .. pad2((rem % 3600) / 60)
    end
    -- opponent, kick-off (on the app clock), and its day and time as shown.
    -- Live data sends { opp, at, date, time }; the demo { opp, day, "hh:mm" }.
    local function nextMatch(team: string): (string, number, string, string)
        local nx = DATA.next[team]
        if nx then
            if nx.at then return nx.opp :: string, nx.at :: number, nx.date :: string, nx.time :: string end
            local hh, mm = string.match(nx[3] :: string, "(%d+):(%d+)")
            local ko = (nx[2] :: number) * 86400 + (tonumber(hh) or 20) * 3600 + (tonumber(mm) or 0) * 60
            local day, clock = kickoffText(ko)
            return nx[1] :: string, ko, day, clock
        end
        local ko = 5 * 86400 + 20 * 3600
        local day, clock = kickoffText(ko)
        return "", ko, day, clock
    end

    local function followPicker(self: Scoreline, r: Renderer, y: number, now: number): number
        local f = self.fol
        local h = 148
        glass(self, r, 12, y, 366, h, 24)
        txt(self, r, "S", "Follow a player", 30, y + 34, 17, -0.01, TEXT)
        txt(self, r, "R", "Live touches, stats and every goal, right here.", 30, y + 54, 12.5, 0, MUTED)
        if f ~= nil then
            local uw = labW(self, "Unfollow")
            local up = pressOf(self, "unfollow", 360 - uw - 12, y + 12, uw + 24, 32)
            local old = self.ga
            self.ga = old * (1 - 0.4 * up)
            lab(self, r, "Unfollow", 360, y + 30, RED, 1)
            self.ga = old
            hit(self, 360 - uw - 12, y + 12, uw + 24, 32, function() unfollow(self) end, "unfollow")
        end
        -- quick picks: glass chips with the head cut-out
        local cw = 108
        for i, s in DATA.stars do
            local col0 = (i - 1) % 3
            local row0 = math.floor((i - 1) / 3)
            local cx = 22 + col0 * (cw + 4)
            local cy = y + 70 + row0 * 34
            local team, n = s[1] :: string, s[2] :: number
            local on = f ~= nil and f.team == team and f.n == n
            local pe = anim(self, "follow", now, f and f.pickT or self.liveOnT, i - 1)
            local old = self.ga
            self.ga = old * pe
            local tk, nn = team, n
            local _, _, st = btnOpen(self, r, "pick" .. team .. tostring(n), cx, cy, cw, 28, 14, function() followPlayer(self, tk, nn) end)
            if on then rrect(self, r, cx + 0.5, cy + 0.5, cw - 1, 27, 13.5, hex(0xFFFFFF, 0.42), 1) end
            r:save()
            r:transform(Mat2D.withTranslation(cx, cy))
            r:clipPath(shape(self, cw, 28, 14, 14, 14, 14))
            r:transform(Mat2D.withTranslation(-cx, -cy))
            riseFace(self, r, person(team, n), team, n, cx + 3, 28, cy + 28)
            r:restore()
            local nm = nameOf(team, n)
            rollTxt(self, r, "S", nm, cx + 33, bc(cy + 14, 12.5), fit(self, "S", nm, 12.5, 0, cw - 42), 0, TEXT, 0, now - st.rollT)
            btnClose(r)
            self.ga = old
        end
        return y + h
    end

    -- the state of his evening: live, red (just sent off), post (his match is over), pre, none
    local function followPhase(f: Follow, m: Match?, lu: Lineup?, now: number): string
        if m == nil or lu == nil then return "none" end
        if lu.rc[f.n] ~= nil then return if now - f.redT < 3.2 then "red" else "post" end
        if m.status == "ft" then return "post" end
        if m.status == "ns" then return "pre" end
        return "live"
    end

    -- the four-cell stats band (Rating / Touches / ... or Kick-off / Opponent)
    local function followBand(self: Scoreline, r: Renderer, ff: Follow, m: Match?, side: string, st: PStats?, phase: string, x0: number, by: number, w0: number, baseGa: number, now: number)
        rect(self, r, x0, by, w0, 64, hex(0x121212))
        hline(self, r, x0, by, w0, hex(0xFFFFFF, 0.08))
        local cells: { { any } } = {}
        if st and (st :: PStats).played and not (st :: PStats).real then
            -- live data without player numbers: what the events tell
            local s2 = st :: PStats
            table.insert(cells, { "Minutes", s2.mins :: any, "n" })
            table.insert(cells, { "Goals", s2.goals :: any, "n" })
            table.insert(cells, { "Assists", s2.assists :: any, "n" })
            table.insert(cells, { "Shots", s2.shots :: any, "n" })
        elseif st and (st :: PStats).played then
            local s2 = st :: PStats
            if phase == "post" then
                table.insert(cells, { "Minutes", s2.mins :: any, "n" })
            else
                table.insert(cells, { "Rating", s2.rating :: any, "r" })
            end
            table.insert(cells, { "Touches", s2.touches :: any, "n" })
            table.insert(cells, { "Passes", tostring(s2.passOk) .. "/" .. tostring(s2.passes), "s" })
            table.insert(cells, { "Shots", s2.shots :: any, "n" })
        elseif m and (m :: Match).status == "ns" then
            local mm = m :: Match
            table.insert(cells, { "Kick-off", mm.time, "s" })
            table.insert(cells, { "Opponent", TEAMS[sideTeam(mm, otherSide(side))].name, "s" })
        else
            table.insert(cells, { "This match", if m then "Didn't play" else "—", "s" })
            table.insert(cells, { "Shirt", "#" .. tostring(ff.n), "s" })
        end
        local cw = w0 / #cells
        for i, c in cells do
            local cx = x0 + (i - 1) * cw
            local ce = anim(self, "follow", now, ff.statT, i - 1)
            self.ga = baseGa * lerp(0.35, 1, ce)
            lab(self, r, c[1] :: string, cx + 18, by + 24, MUTED)
            local kind = c[3] :: string
            local vy = by + 48 - 5 * (1 - ce)
            if kind == "r" then
                ratingTag(self, r, c[2] :: number, cx + 18, vy - 5, false, 0, 12.5)
            elseif kind == "n" then
                txt(self, r, "M", tostring(c[2]), cx + 18, vy, 18, 0, TEXT)
            else
                local s = tostring(c[2])
                txt(self, r, "M", s, cx + 18, vy, fit(self, "M", s, 16, 0, cw - 26), 0, TEXT)
            end
            if i > 1 then rect(self, r, cx, by + 14, 1, 38, hex(0xFFFFFF, 0.07)) end
        end
        self.ga = baseGa
    end

    -- next match: who, when, and a quiet countdown
    local function followNext(self: Scoreline, r: Renderer, team: string, x0: number, y: number, w0: number, now: number)
        local opp, ko, day, clock = nextMatch(team)
        lab(self, r, "Next match", x0 + 18, y + 26, MUTED)
        local nm = if opp ~= "" then "vs " .. TEAMS[opp].name else "Friendly · TBC"
        if opp ~= "" then crest(self, r, opp, x0 + 18, y + 40, 20) end
        local nx = x0 + 18 + (if opp ~= "" then 28 else 0)
        txt(self, r, "S", nm, nx, bc(y + 50, 16), fit(self, "S", nm, 16, -0.01, 150), -0.01, TEXT)
        txt(self, r, "R", day .. " · " .. clock, x0 + 18, bc(y + 76, 12.5), 12.5, 0, MUTED)
        -- the countdown, kept quiet: days, hours and minutes in soft white with small
        -- units under them. A unit that changes eases up and fades while the new value
        -- eases in from just below: no tiles, no jumps.
        local left = math.max(0, ko - (self.clock0 + nowOf(self)))
        local units = { 86400, 3600, 60 }
        local mods = { 100, 24, 60 }
        local names = { "D", "H", "M" }
        local SLOT, SEP, fs, DUR = 21, 9, 15, 0.55
        local right = x0 + w0 - 18
        local x = right - #units * SLOT - (#units - 1) * SEP
        local quiet = hex(0x6A6964)
        lab(self, r, "Kick-off in", right, y + 26, quiet, 1)
        local base = bc(y + 51, fs)
        local ink = hex(0xD6D4CF)
        local old = self.ga
        for i = 1, #units do
            local u = units[i]
            local function val(sec: number): number return math.floor(sec / u) % mods[i] end
            local cur = val(left)
            local cx = x + SLOT / 2
            local since = math.ceil(left / u) * u - left
            if left > 0 and since < DUR then
                local p = bez(INOUT, since / DUR)
                self.ga = old * (1 - p)
                txt(self, r, "M", pad2(val(left + since + 0.0001)), cx, base - 7 * p, fs, 0, ink, 0.5)
                self.ga = old * p
                txt(self, r, "M", pad2(cur), cx, base + 7 * (1 - p), fs, 0, ink, 0.5)
                self.ga = old
            else
                txt(self, r, "M", pad2(cur), cx, base, fs, 0, ink, 0.5)
            end
            txt(self, r, "M", names[i], cx, y + 70, 8, 0.14, quiet, 0.5)
            if i < #units then txt(self, r, "R", ":", x + SLOT + SEP / 2, base - 1, fs, 0, DIM, 0.5) end
            x += SLOT + SEP
        end
    end

    local function drawFollow(self: Scoreline, r: Renderer, y: number, now: number): number
        local f = self.fol
        local oldGa = self.ga
        local pin = blockIn(self, r, now)
        self.ga = oldGa * pin
        local baseGa = self.ga
        -- section header
        gstar(self, r, 23, y + 7, 5.6)
        lab(self, r, if f then "Following" else "Your player", 34, y + 10.5, TEXT)
        local picking = f ~= nil and f.pickT > 0
        if f ~= nil then
            local lbl = if picking then "Done" else "Change"
            local lw = labW(self, lbl)
            local cp = pressOf(self, "folChange", 372 - lw - 14, y - 10, lw + 28, 34)
            self.ga = baseGa * (1 - 0.4 * cp)
            lab(self, r, lbl, 372, y + 10.5, MUTED, 1)
            self.ga = baseGa
            hit(self, 372 - lw - 14, y - 10, lw + 28, 34, function()
                local ff = self.fol
                if ff then ff.pickT = if ff.pickT > 0 then -1 else nowOf(self) end
            end, "folChange")
        end
        y += 26
        if f == nil or picking then
            y = followPicker(self, r, y, now)
            pop(self, r)
            self.ga = oldGa
            return y + 30
        end
        local ff = f :: Follow
        local m, side, p = followInfo(self)
        local team = TEAMS[ff.team]
        local lu: Lineup? = if m then m.lu[side] else nil
        local st: PStats? = if m then playerStats(m, side, ff.n) else nil
        local phase = followPhase(ff, m, lu, now)
        if phase ~= ff.phase then
            ff.phase, ff.phT = phase, now
        end
        local onP = false
        if phase == "live" and lu then
            local l = lu :: Lineup
            onP = (slotOf(l, ff.n) > 0 or l.on[ff.n] ~= nil) and l.off[ff.n] == nil
        end
        local topH = 136
        local fullH = topH + 64 + (if phase == "post" or phase == "red" then 100 elseif onP then 66 else 0)
        retarget(ff.hgt, now, fullH, 0.6, GLIDE)
        local k = tv(ff.openK, now)
        local h = lerp(64, tv(ff.hgt, now), k)
        local x0, w0 = 12, 366
        local fin = ease(GLIDE, now, ff.phT, 0.55)     -- the phase's content fades in
        local gt = now - ff.goalT
        local gm = if gt >= 0 and gt < 7.5 and phase == "live" then env(gt, tmOf(self, "follow").dur, 5.4, 0.9) else 0
        local rt = now - ff.redT
        -- sent off: the card shakes for a moment
        local shake = if phase == "red" and rt < 0.6 then 6 * math.sin(rt * 70) * math.exp(-rt * 6) else 0
        local cid = "follow"
        local pk = pressOf(self, cid, x0, y, w0, h)
        local sc = 1 - 0.015 * pk
        r:save()
        r:transform(Mat2D.withTranslation(195 + shake, y + h / 2) * Mat2D.withScale(sc, sc) * Mat2D.withTranslation(-195, -(y + h / 2)))
        glassPane(self, r, x0, y, w0, h, 24)
        -- everything inside is cut by the card's own shape (no square corners)
        r:save()
        r:transform(Mat2D.withTranslation(x0, y))
        r:clipPath(shape(self, w0, h, 24, 24, 24, 24))
        r:transform(Mat2D.withTranslation(-x0, -y))
        softLight(self, r, x0, y, w0, h, x0 + w0 * 0.8, y + 88, 230, 150, team.c1, 0.5)
        if gm > 0.01 then
            self.ga = baseGa * gm
            local st2 = { { 0, pastel(team.c1) }, { 0.55, pastel(mix(team.c2, 0xF7F2EA, 0.3)) }, { 1, pastel(team.c1) } }
            box(self, r, x0, y, w0, math.min(topH, h), stopsPaint(self, "fg" .. team.key, st2, true))
            self.ga = baseGa
        end
        local ek = math.clamp((k - 0.35) / 0.65, 0, 1)    -- open content
        local ck = math.clamp((0.6 - k) / 0.6, 0, 1)      -- closed content
        local first = if p then p.first else ""
        local last = if p then p.last else nameOf(ff.team, ff.n)
        local opp = if m then TEAMS[sideTeam(m :: Match, otherSide(side))] else nil
        local rimClear = 1 -- how much of the open content the moving edge has cleared
        if ek > 0.01 then
            local eg = baseGa * ek
            -- chest-up photo; its bottom edge sits under the stats band
            local pe = anim(self, "follow", now, ff.t, 0)
            local kk = 0.5 + 0.03 * gm
            local pw, ph = CROP.chest[3] * kk, CROP.chest[4] * kk
            local px, py = x0 + w0 - pw + 8, y + topH - ph
            self.ga = eg
            if p ~= nil and hasPhoto(self, p) then
                bust(self, r, p :: Person, CROP.chest, px + 12 * (1 - pe), py + 18 * (1 - pe), pw, ph, pe)
            else
                self.ga = eg * pe
                kitDisc(self, r, ff.team, ff.n, x0 + w0 - 76, y + topH - 62, 44)
            end
            -- the name, or his goal moment
            local gIn = math.clamp(gm * 2 - 1, 0, 1)
            local nIn = math.clamp(1 - gm * 2, 0, 1)
            if gIn > 0.01 then
                self.ga = eg * gIn
                local goals = if lu then (lu :: Lineup).goals[ff.n] or 0 else 0
                local words = { "First", "Second", "Third" }
                local nth = if goals >= 1 and goals <= 3 then words[goals] else tostring(goals) .. "th"
                txt(self, r, "B", "GOAL", x0 + 18, y + 66, 46, -0.02, INK)
                txt(self, r, "S", last, x0 + 18, y + 94, 17, 0, INK)
                txt(self, r, "R", if goals == 3 then "Hat-trick tonight" else nth .. " goal of the match", x0 + 18, y + 114, 12.5, 0, hex(0x000000, 0.62))
            end
            if nIn > 0.01 then
                self.ga = eg * nIn
                txt(self, r, "R", first, x0 + 18, y + 36, 13, 0, MUTED)
                txt(self, r, "S", last, x0 + 18, y + 62, fit(self, "S", last, 26, -0.02, 196), -0.02, TEXT)
                crest(self, r, ff.team, x0 + 18, y + 76, 14)
                local ctx = if opp then "vs " .. opp.name else team.name
                txt(self, r, "M", ctx, x0 + 38, bc(y + 83, 12.5), 12.5, 0, MUTED)
                local gy = y + 110
                self.ga = eg * nIn * (if phase == "live" or phase == "pre" or phase == "none" then 1 else fin)
                if phase == "post" and m and st and lu then
                    -- his last match in one line: rating, what he did, minutes
                    local mm, s2 = m :: Match, st :: PStats
                    local gx = x0 + 18
                    if s2.played then gx += ratingTag(self, r, s2.rating, gx, gy, false, 0, 11.5) + 8 end
                    local ew = eventTags(self, r, lu :: Lineup, ff.n, gx, gy, 0, 7.5)
                    if ew > 0 then gx += ew + 8 end
                    local sent = (lu :: Lineup).rc[ff.n]
                    local note = if sent then "Sent off " .. minText(sent) else "Full time · " .. TEAMS[mm.h].short .. " " .. scoreStr(mm.hs, mm.as) .. " " .. TEAMS[mm.a].short
                    txt(self, r, "M", note, gx, bc(gy, 12), fit(self, "M", note, 12, 0, x0 + 214 - gx), 0, if sent then RED else MUTED)
                else
                    -- his goals tonight: glass chips with the ball and the minute
                    local gx = x0 + 18
                    local any = false
                    if m and lu then
                        for _, e in goalsOf(m :: Match) do
                            if e.side == side and e.pn == ff.n then
                                any = true
                                local s = minText(e.min)
                                local w = tw(self, "S", s, 11.5) + 32
                                if gx + w < x0 + 210 then
                                    glass(self, r, gx, gy - 12, w, 24, 12, 0.7)
                                    ball(self, r, gx + 12, gy, 7)
                                    txt(self, r, "S", s, gx + 24, bc(gy, 11.5), 11.5, 0, TEXT)
                                end
                                gx += w + 6
                            end
                        end
                    end
                    if not any then
                        local note = "No goals yet tonight"
                        if m == nil then note = "No match scheduled"
                        elseif (m :: Match).status == "ns" then note = (if (m :: Match).day == 2 then "Tomorrow" else "Today") .. " · kick-off " .. (m :: Match).time
                        elseif not onP then note = if st and (st :: PStats).played then "Substituted" else "On the bench" end
                        txt(self, r, "R", note, x0 + 18, bc(gy, 12), 12, 0, DIM)
                    end
                end
            end
            self.ga = eg
            -- stats band (opaque: the photo's cut stands behind it)
            -- what the card's moving edge has not cleared yet stays hidden, so nothing
            -- inside is ever sliced while the card opens or closes
            local bot = y + h
            local function clear(lowest: number): number return math.clamp((bot - lowest) / 12, 0, 1) end
            if phase == "post" or phase == "red" then
                rimClear = clear(y + topH + 64 + 84)
            elseif onP then
                rimClear = clear(y + topH + 64 + 32)
            end
            followBand(self, r, ff, m, side, st, phase, x0, y + topH, w0, eg * (if phase == "post" then fin else 1) * clear(y + topH + 56), now)
            self.ga = eg
            if phase == "post" or phase == "red" then
                self.ga = eg * fin
                hline(self, r, x0 + 18, y + topH + 64, w0 - 36, hex(0xFFFFFF, 0.07))
                self.ga = eg * fin * clear(y + topH + 64 + 84)
                followNext(self, r, ff.team, x0, y + topH + 64, w0, now)
            elseif onP then
                -- on the ball (green, pulsing) or off it (grey, said in words)
                local ay = y + topH + 64
                hline(self, r, x0 + 18, ay, w0 - 36, hex(0xFFFFFF, 0.07))
                local acts = ff.acts
                local onBall = ff.ball and #acts > 0
                local pulse = 0.5 + 0.5 * math.cos(now * 4)
                self.ga = eg * clear(ay + 32)
                if onBall then
                    circle(self, r, x0 + 22, ay + 23, 3 + 3 * pulse, hex(0x34E39A, 0.25 * (1 - pulse)))
                    circle(self, r, x0 + 22, ay + 23, 3, LIVE)
                else
                    circle(self, r, x0 + 22, ay + 23, 3, DIM)
                end
                -- line 1: what he is doing with the ball, or that he is off it; line 2: the action before
                local rows: { { any } } = {}
                if #acts == 0 then
                    table.insert(rows, { "Watching every touch…", "", MUTED, "R", ff.t })
                elseif onBall then
                    table.insert(rows, { acts[1].txt, acts[1].clock, if acts[1].kind == "goal" then LIVE else TEXT, "M", acts[1].t })
                    if acts[2] then table.insert(rows, { acts[2].txt, acts[2].clock, MUTED, "R", acts[2].t }) end
                else
                    table.insert(rows, { "Off the ball right now", "", MUTED, "M", ff.ballT })
                    table.insert(rows, { acts[1].txt, acts[1].clock, MUTED, "R", acts[1].t })
                end
                for i = #rows, 1, -1 do
                    local row = rows[i]
                    local ae = anim(self, "follow", now, row[5] :: number, 0)
                    local yy = ay + 23 + (i - 1) * 22 + 12 * (1 - ae)
                    self.ga = eg * ae * (if i == 1 then 1 else 0.6) * clear(ay + 32 + (i - 1) * 22)
                    local font = row[4] :: string
                    local fs = if i == 1 then 14 else 12.5
                    local clock = row[2] :: string
                    local mx = x0 + w0 - 18 - (if clock ~= "" then tw(self, "M", clock, 11) + 10 else 0)
                    local s = row[1] :: string
                    txt(self, r, font, s, x0 + 34, bc(yy, fs), fit(self, font, s, fs, 0, mx - x0 - 34), 0, row[3] :: Color)
                    if clock ~= "" then txt(self, r, "M", clock, x0 + w0 - 18, bc(yy, 11), 11, 0, DIM, 1) end
                end
            end
        end
        if ck > 0.01 then
            -- closed: his face, his name and only what matters now
            local cg = baseGa * ck
            self.ga = cg
            local cy = y + 32
            riseFace(self, r, p, ff.team, ff.n, x0 + 12, 54, y + h)
            local nx = x0 + 78
            txt(self, r, "S", last, nx, bc(cy - 8, 16), fit(self, "S", last, 16, -0.01, 120), -0.01, TEXT)
            local right = x0 + w0 - 58
            if phase == "post" or phase == "red" then
                self.ga = cg * fin
                local on, _, day, clock = nextMatch(ff.team)
                local who = if on ~= "" then "Next · vs " .. TEAMS[on].name else "Next · Friendly"
                txt(self, r, "R", who, nx, bc(cy + 11, 12), fit(self, "R", who, 12, 0, right - nx - 84), 0, MUTED)
                txt(self, r, "M", day, right, bc(cy - 8, 13), 13, 0, TEXT, 1)
                txt(self, r, "R", clock, right, bc(cy + 11, 12), 12, 0, MUTED, 1)
            else
                local sub = if phase == "live" and m then minLabel(m :: Match) .. " · " .. (if opp then "vs " .. opp.name else "") else (if opp then "vs " .. opp.name else team.name)
                if phase == "live" then
                    local pulse = 0.5 + 0.5 * math.cos(now * 4)
                    circle(self, r, nx + 3, cy + 11, 2.6 + 2 * pulse, hex(0x34E39A, 0.25 * (1 - pulse)))
                    circle(self, r, nx + 3, cy + 11, 2.6, if ff.ball then LIVE else DIM)
                    txt(self, r, "R", sub, nx + 11, bc(cy + 11, 12), 12, 0, MUTED)
                else
                    txt(self, r, "R", sub, nx, bc(cy + 11, 12), 12, 0, MUTED)
                end
                if st and (st :: PStats).played and lu then
                    local rw = if (st :: PStats).rating > 0 then ratingTag(self, r, (st :: PStats).rating, right, cy, false, 1, 12) else -8
                    eventTags(self, r, lu :: Lineup, ff.n, right - rw - 8, cy, 1, 8)
                end
            end
        end
        -- sent off: the card floods red, pulses, then says it
        if phase == "red" then
            local flood = if rt < 0.12 then rt / 0.12 elseif rt < 1.3 then 0.9 + 0.1 * math.cos((rt - 0.12) * 11) else 0.95
            flood *= 1 - ease(INOUT, rt, 2.6, 0.6)
            self.ga = baseGa * flood
            box(self, r, x0, y, w0, h, stopsPaint(self, "redcard", { { 0, 0xFF3B30 }, { 0.6, 0xD9141B }, { 1, 0x8E0A10 } }, false))
            local tIn = ease(GLIDE, rt, 0.9, 0.45) * (1 - ease(INOUT, rt, 2.6, 0.5))
            if tIn > 0.01 then
                self.ga = baseGa * tIn
                local big = h > 120
                local fs = if big then 44 else 26
                local sl = lerp(1.25, 1, tIn)
                local tx, base = x0 + 18, if big then y + h / 2 + 4 else y + 41
                r:save()
                r:transform(Mat2D.withTranslation(tx, base) * Mat2D.withScale(sl, sl) * Mat2D.withTranslation(-tx, -base))
                txt(self, r, "B", "RED CARD", tx, base, fs, -0.02, TEXT)
                r:restore()
                local sent = if lu then (lu :: Lineup).rc[ff.n] else nil
                local meta = last .. (if sent then " · " .. minText(sent) else "") .. " · off"
                if big then txt(self, r, "M", meta, tx, base + 26, 13, 0, hex(0xFFFFFF, 0.82)) end
                -- a big tilted card
                r:save()
                r:transform(Mat2D.withTranslation(x0 + w0 - (if big then 70 else 40), y + h / 2) * Mat2D.withRotation(0.22 - 0.3 * (1 - tIn)))
                local cw2, ch2 = if big then 52 else 26, if big then 74 else 36
                rrect(self, r, -cw2 / 2 + 2, -ch2 / 2 + 3, cw2, ch2, 5, hex(0x000000, 0.35))
                rrect(self, r, -cw2 / 2, -ch2 / 2, cw2, ch2, 5, hex(0xFF2D2D))
                rrect(self, r, -cw2 / 2 + 0.5, -ch2 / 2 + 0.5, cw2 - 1, ch2 - 1, 4.5, hex(0xFFFFFF, 0.35), 1)
                r:restore()
            end
            self.ga = baseGa
        end
        r:restore()
        -- the rim and the open / close button fade only while the card opens or
        -- closes; a new line of commentary inside never touches them
        self.ga = baseGa * (if ck > 0.01 then ck else ek * rimClear)
        glassRim(self, r, x0, y, w0, h, 24)
        -- open / close: a small glass button, top right when open, centred right when closed
        local bw, bh = 34, 30
        local bx = x0 + w0 - 12 - bw
        local by = lerp(y + (64 - bh) / 2, y + 12, k)
        local tk = ff
        hit(self, x0, y, w0, h, function()
            local mm = m
            if mm ~= nil then openFollowed(self, mm, tk.team, tk.n) end
        end, cid)
        btnOpen(self, r, "folToggle", bx, by, bw, bh, bh / 2, function()
            tk.open = not tk.open
            retarget(tk.openK, nowOf(self), if tk.open then 1 else 0, 0.55, GLIDE)
        end, 0.6)
        r:save()
        r:transform(Mat2D.withTranslation(bx + bw / 2, by + bh / 2) * Mat2D.withRotation(math.pi * (1 - k)) * Mat2D.withTranslation(-5, -3))
        r:drawPath(self.icons.chevUp, paint(self, TEXT, 1.6))
        r:restore()
        btnClose(r)
        r:restore()
        pop(self, r)
        self.ga = oldGa
        return y + h + 30
    end

    local function drawFeed(self: Scoreline, r: Renderer, now: number): number
        local dIdx = DAYMAP[self.day]
        local lk = tv(self.liveK, now)
        local live = liveMatches(self)
        local y = LIST_TOP + 22 - self.listScroll.y
        local y0 = y
        blockI = 0
        -- live section: opens up and pushes the list down; cards rise inside it.
        -- It is never part of the list's fade, so switching Live off cannot blink it.
        if lk > 0.002 then
            local secH = SEC_H * lk
            r:save()
            clipRect(self, r, 0, y - 4, W, secH + 4)
            local oldGa = self.ga
            self.ga = oldGa * math.clamp(lk * 1.6 - 0.3, 0, 1)
            lab(self, r, "Live now", 18, y + 10.5, TEXT)
            lab(self, r, tostring(#live) .. " in play", 372, y + 10.5, MUTED, 1)
            self.ga = oldGa
            drawCards(self, r, y + 26, now)
            r:restore()
            y += secH
        end
        -- the player you follow lives on Ongoing and Today only
        if self.liveOnly or self.day == 3 then y = drawFollow(self, r, y, now) end
        -- which matches go in the list
        local list: { Match } = {}
        for _, m in self.matches do
            if self.liveOnly then
                if m.status == "live" then table.insert(list, m) end
            elseif m.day == dIdx then
                table.insert(list, m)
            end
        end
        local favs: { Match } = {}
        local groups: { [string]: { Match } } = {}
        for _, m in list do
            if self.favMatch[m.id] then
                table.insert(favs, m)
            else
                groups[m.lg] = groups[m.lg] or {}
                table.insert(groups[m.lg], m)
            end
        end
        local any = false
        if #favs > 0 then
            y = drawGroup(self, r, "fav", "", "Favourites", favs, y, now)
            any = true
        end
        for _, lg in LEAGUE_ORDER do
            local g = groups[lg]
            if g then
                local L = LEAGUES[lg]
                y = drawGroup(self, r, lg, L.country, L.name, g, y, now)
                any = true
            end
        end
        if not any then
            txt(self, r, "R", if self.liveOnly then "Nothing in play." else "Nothing scheduled.", 195, y + 110, 20, -0.02, MUTED, 0.5)
            lab(self, r, if self.liveOnly then "Check back soon" else "Pick another date", 195, y + 136.6, MUTED, 0.5)
            y += 240
        end
        return y - y0 + 56
    end

    drawListScreen = function(self: Scoreline, r: Renderer, now: number)
        rect(self, r, 0, 0, W, H, BG)
        r:save()
        clipRect(self, r, 0, LIST_TOP, W, H - LIST_TOP)
        self.clipTop, self.clipBot = self.oy + LIST_TOP, self.oy + H
        local contentH = drawFeed(self, r, now)
        self.clipTop, self.clipBot = self.oy, self.oy + H
        r:restore()
        self.listScroll.max = math.max(0, contentH + 22 - (H - LIST_TOP))

        -- header
        statusBar(self, r)
        local mh = { 16, 22, 12 }
        local mt = { 6, 0, 4 }
        local mg = { 1, 2, 4 }
        for i = 1, 3 do
            gradRect(self, r, 18 + (i - 1) * 6, 72.5 + mt[i], 6, mh[i], mg[i], false)
        end
        txt(self, r, "M", "scoreline", 46, 90.7, 25, -0.045, TEXT)

        -- your Rive Live icon, if one is assigned to the liveIcon input
        local ic = self.icon
        if ic ~= nil then
            local ir = self.iconRect
            self.iconO = { self.ox, self.oy }
            r:save()
            r:transform(Mat2D.withTranslation(ir[1], ir[2]) * Mat2D.withScale(ir[5], ir[5]) * Mat2D.withTranslation(-ir[6], -ir[7]))
            ic:draw(r)
            r:restore()
        else
            local liveW = tw(self, "S", "Live", 14)
            local lpW = 9 + 9 + 7 + liveW + 11
            local pillW = 1 + 5 + lpW + 8 + 24 + 9 + 1
            local px = 324 - pillW
            glass(self, r, px, 63, pillW, 38, 19)
            local lpx = px + 6
            local lk = tv(self.liveK, now)
            if lk > 0.01 then
                local old = self.ga
                self.ga = old * lk
                rrect(self, r, lpx, 68.5, lpW, 27, 13.5, LIVE)
                self.ga = old
            end
            local on = self.liveOnly
            local dotx = lpx + 9 + 4.5
            if not on then
                local pp = (now % 1.8) / 1.8
                if pp < 0.7 then
                    circle(self, r, dotx, 82, 4.5 + 7 * (pp / 0.7), hex(0x34E39A, 0.55 * (1 - pp / 0.7)))
                end
            end
            circle(self, r, dotx, 82, 4.5, if on then INK_DARK else LIVE)
            txt(self, r, "S", "Live", lpx + 9 + 9 + 7, bc(82, 14), 14, 0, if on then INK_DARK else TEXT)
            local cx = lpx + lpW + 8
            rrect(self, r, cx + 0.7, 73.7, 22.6, 16.6, 4.3, TEXT, 1.4)
            txt(self, r, "B", tostring(#liveMatches(self)), cx + 12, bc(82, 11), 11, 0, TEXT, 0.5)
            hit(self, px, 63, pillW, 38, function() toggleLive(self) end)
        end

        roundBtn(self, r, "menu", 332, 62, function() openSheet(self) end)
        rect(self, r, 344, 77, 16, 1.6, TEXT)
        rect(self, r, 344, 85.4, 16, 1.6, TEXT)
        btnClose(r)

        -- day tabs ("Today" becomes "Ongoing" in live mode)
        local lk = tv(self.liveK, now)
        r:save()
        clipRect(self, r, 18, 110, 354, 50)
        local xs, ws = dayLayout(self, lk)
        local shift = tv(self.dayShift, now)
        for i, d in DAYS do
            local bx = 18 + xs[i] + shift
            local did = "day" .. tostring(i)
            local dp, dl = pressOf(self, did, bx, 118, ws[i], 40)
            local c = Color.lerp(if i == self.day then TEXT else DIM, TEXT, 0.35 * dl)
            local oldD = self.ga
            self.ga = oldD * (1 - 0.35 * dp)
            if i == 3 then
                local old = self.ga
                self.ga = old * (1 - lk)
                txt(self, r, "M", "Today", bx + 13, bc(138, 15), 15, -0.01, c)
                self.ga = old * lk
                txt(self, r, "M", "Ongoing", bx + 13, bc(138, 15), 15, -0.01, c)
                self.ga = old
            else
                txt(self, r, "M", d, bx + 13, bc(138, 15), 15, -0.01, c)
            end
            self.ga = oldD
            local di = i
            hit(self, bx, 118, ws[i], 40, function() setDay(self, di) end, did)
        end
        box(self, r, 18, 116, 28, 40, stopsPaint(self, "edgeL", { { 0, 0x000000, 1 }, { 1, 0x000000, 0 } }, true))
        box(self, r, 344, 116, 28, 40, stopsPaint(self, "edgeR", { { 0, 0x000000, 0 }, { 1, 0x000000, 1 } }, true))
        r:restore()
        hline(self, r, 18, 158, 354)
        gradRect(self, r, 18 + tv(self.dayIndX, now), 157, tv(self.dayIndW, now), 2, 2, true)
    end
end


-- =====================================================================
-- DETAIL SCREEN — hero, then Facts / Stats / Lineup / Table
-- =====================================================================

do
    local function fmtNum(v: number, f: string): string
        if f == "%d" then return tostring(math.floor(v)) end
        local s = string.format(f, v)
        s = string.gsub(s, "0+$", "")
        s = string.gsub(s, "%.$", "")
        return s
    end

    local function h4(self: Scoreline, r: Renderer, left: string, right: string, y: number): number
        lab(self, r, left, 18, y + 10.5, MUTED)
        if right ~= "" then lab(self, r, right, 372, y + 10.5, TEXT, 1) end
        return y + 13.7 + 14
    end

    -- a block of the open match fades and lifts in (motion: screen)
    local function blockIn(self: Scoreline, r: Renderer, now: number, i: number): number
        local p = anim(self, "screen", now, self.screenT, i)
        push(self, r, 0, 12 * (1 - p))
        return p
    end

    -- -----------------------------------------------------------------
    -- hero
    -- -----------------------------------------------------------------
    local function drawHero(self: Scoreline, r: Renderer, m: Match, y: number, now: number): number
        local L = LEAGUES[m.lg]
        local cy = y + 14 + 8.45
        local oldGa = self.ga
        self.ga = oldGa * blockIn(self, r, now, 0)
        lab(self, r, "Matchday " .. tostring(L.md), 18, bc(cy, 10.5), MUTED)
        if m.status == "live" then
            local main = if m.min >= 90 then "90:00" else pad2(m.min) .. ":" .. pad2(m.sec)
            local plus = if m.min >= 90 then "+" .. tostring(m.min - 90) else ""
            local pw = if plus ~= "" then tw(self, "M", plus, 10.5) + 8 + 7 else 0
            local mw = tw(self, "M", main, 13, 0.02)
            local x = 372 - pw - mw - 13
            circle(self, r, x + 3, cy, 3, LIVE)
            txt(self, r, "M", main, x + 13, bc(cy, 13), 13, 0.02, LIVE)
            if plus ~= "" then
                local bx = x + 13 + mw + 7
                rrect(self, r, bx, cy - 7, pw - 7, 14, 4, hex(0x34E39A, 0.45), 1)
                txt(self, r, "M", plus, bx + 4, bc(cy, 10.5), 10.5, 0, LIVE)
            end
        else
            local s = if m.status == "ft" then "Full time" else "Kick-off " .. m.time
            txt(self, r, "M", s, 372, bc(cy, 13), 13, 0.02, MUTED, 1)
        end
        pop(self, r)
        self.ga = oldGa
        local top = y + 14 + 16.9 + 18
        hline(self, r, 18, top, 354)
        top += 1
        local goals = goalsOf(m)
        for si, side in { "h", "a" } do
            local k = sideTeam(m, side)
            self.ga = oldGa * blockIn(self, r, now, si)
            -- scorers under the name: each one opens his page
            local order: { number } = {}
            local mins: { [number]: { string } } = {}
            for _, g in goals do
                if g.side == side then
                    if mins[g.pn] == nil then
                        mins[g.pn] = {}
                        table.insert(order, g.pn)
                    end
                    table.insert(mins[g.pn], minText(g.min))
                end
            end
            local ns = m.status == "ns"
            local avail = 372 - 72 - 14 - (if ns then 0 else 70)
            local SEP = tw(self, "R", " · ", 11.5)
            local lines: { { { any } } } = {}
            local cur: { { any } } = {}
            local lx = 0
            for _, pn in order do
                local nm, ms = nameOf(k, pn), table.concat(mins[pn], " ")
                local nw = tw(self, "R", nm, 11.5)
                local w = nw + 4 + tw(self, "R", ms, 11.5)
                local sep = if #cur > 0 then SEP else 0
                if #cur > 0 and lx + sep + w > avail then
                    table.insert(lines, cur)
                    cur, lx, sep = {}, 0, 0
                end
                table.insert(cur, { pn, nm, ms, lx + sep, w, nw })
                lx += sep + w
            end
            if #cur > 0 then table.insert(lines, cur) end
            local blockH = 27.3 + (if #lines > 0 then 6 + 16.1 * #lines else 0)
            local rowH = math.max(38, blockH, if ns then 0 else 74) + 24
            local c = top + rowH / 2
            crest(self, r, k, 18, c - 19, 38)
            local bt = c - blockH / 2
            txt(self, r, "M", TEAMS[k].name, 72, bt + 22.7, 26, -0.035, TEXT)
            for li, ln in lines do
                local base = bt + 27.3 + 6 + 16.1 * (li - 1) + 12.3
                for ti, it in ln do
                    local x = 72 + (it[4] :: number)
                    local w = it[5] :: number
                    if ti > 1 then txt(self, r, "R", " · ", x - SEP, base, 11.5, 0, DIM) end
                    local sid = "scorer" .. k .. tostring(it[1])
                    local sp, sl = pressOf(self, sid, x - 3, base - 13, w + 6, 18)
                    local old = self.ga
                    self.ga = old * (1 - 0.4 * sp)
                    txt(self, r, "R", it[2] :: string, x, base, 11.5, 0, Color.lerp(hex(0xC9C7C2), TEXT, sl))
                    txt(self, r, "R", it[3] :: string, x + (it[6] :: number) + 4, base, 11.5, 0, MUTED)
                    self.ga = old
                    local tk, pn = k, it[1] :: number
                    hit(self, x - 3, base - 13, w + 6, 18, function() openPlayer(self, tk, pn, nil) end, sid)
                end
            end
            if not ns then
                local v = tostring(if side == "h" then m.hs else m.as)
                local colr = if trails(m, side) then DIM else TEXT
                local bp = if self.heroBumpSide == side then prog(now, self.heroBumpT, 0.7) else 1
                local s = if bp < 1 then 1 + 0.16 * (1 - bez(GLIDE, bp)) else 1
                local w = tw(self, "L", v, 86, -0.05)
                r:save()
                r:transform(Mat2D.withTranslation(372 - w / 2, c) * Mat2D.withScale(s, s) * Mat2D.withTranslation(-(372 - w / 2), -c))
                txt(self, r, "L", v, 372, c + 30, 86, -0.05, colr, 1)
                r:restore()
            end
            pop(self, r)
            self.ga = oldGa
            top += rowH
            hline(self, r, 18, top, 354)
            top += 1
        end
        return top + 22
    end

    -- -----------------------------------------------------------------
    -- FACTS · momentum: one continuous wave in the teams' colours, as in Stats
    -- -----------------------------------------------------------------
    -- the two sides' colours for the wave: exactly the possession colours in Stats
    -- (each side's own colour; the away side takes its second one when the two
    -- would read alike, and a light neutral if even that is too close)
    local function sideHex(m: Match): (number, number)
        local a, b = TEAMS[m.h].c1, TEAMS[m.a].c1
        local function ch(x: number, s: number): number return bit32.band(bit32.rshift(x, s), 255) end
        local function dist(x: number, z: number): number
            return math.sqrt((ch(x, 16) - ch(z, 16)) ^ 2 + (ch(x, 8) - ch(z, 8)) ^ 2 + (ch(x, 0) - ch(z, 0)) ^ 2)
        end
        if dist(a, b) < 150 then b = TEAMS[m.a].c2 end
        if dist(a, b) < 90 then b = 0xE9E7E1 end
        return a, b
    end

    local MOM_CACHE: { [string]: { any } } = {}
    local MOM_COUNT = 0
    local MOM_W, MOM_H = 322, 156
    -- the wave in chart pixels (x 0..MOM_W = 0'..90', midline MOM_H / 2).
    -- Both lobes are wound clockwise, so every renderer fills them.
    local function momPaths(self: Scoreline, m: Match): (Path, Path, Path, number)
        local key = tostring(m.id) .. "|" .. tostring(m.min) .. "|" .. tostring(m.ver)
        local c = MOM_CACHE[key]
        if c then return c[1] :: Path, c[2] :: Path, c[3] :: Path, c[4] :: number end
        if MOM_COUNT > 40 then
            retire(self, MOM_CACHE)
            MOM_CACHE = {}
            MOM_COUNT = 0
        end
        local last = math.min(m.min, 90)
        local mid = MOM_H / 2
        local xs: { number }, ys: { number } = {}, {}
        for i = 0, last do
            local s, n = 0, 0
            for j = math.max(0, i - 2), math.min(last, i + 2) do
                local wgt = 3 - math.abs(j - i)
                s += (m.mom[j + 1] or 0) * wgt
                n += wgt
            end
            local v = if n > 0 then s / n else 0
            xs[i + 1] = i / 90 * MOM_W
            ys[i + 1] = mid - math.clamp(v * 1.25, -1, 1) * 0.44 * MOM_H
        end
        local top, bot, line = Path.new(), Path.new(), Path.new()
        -- home lobe: along the curve to the right, back along the midline
        top:moveTo(Vector.xy(0, mid))
        for i = 1, #xs do top:lineTo(Vector.xy(xs[i], math.min(ys[i], mid))) end
        top:lineTo(Vector.xy(xs[#xs], mid))
        top:close()
        -- away lobe: along the midline to the right, back along the curve
        bot:moveTo(Vector.xy(0, mid))
        bot:lineTo(Vector.xy(xs[#xs], mid))
        for i = #xs, 1, -1 do bot:lineTo(Vector.xy(xs[i], math.max(ys[i], mid))) end
        bot:close()
        for i = 1, #xs do
            if i == 1 then line:moveTo(Vector.xy(xs[i], ys[i])) else line:lineTo(Vector.xy(xs[i], ys[i])) end
        end
        local endY = ys[#ys] / MOM_H
        MOM_CACHE[key] = { top, bot, line, endY }
        MOM_COUNT += 1
        return top, bot, line, endY
    end

    local function momentum(self: Scoreline, r: Renderer, m: Match, y: number, now: number): number
        local lo = math.max(0, m.min - 10)
        local pos, neg = 0, 0
        for i = lo, math.min(m.min, 96) - 1 do
            local v = m.mom[i + 1] or 0
            if v > 0 then pos += v else neg -= v end
        end
        local share = if pos + neg > 0 then math.floor(pos / (pos + neg) * 100 + 0.5) else 50
        local lead = if share >= 58 then "h" elseif share <= 42 then "a" else ""
        if lead ~= "" then
            local k = sideTeam(m, lead)
            crest(self, r, k, 18, y + 21.9 - 13, 26)
            txt(self, r, "M", TEAMS[k].name .. " on top", 56, y + 19.75, 22, -0.03, TEXT)
            txt(self, r, "R", tostring(if lead == "h" then share else 100 - share) .. "% of the pressure in the last 10 minutes", 56, y + 40.2, 12, 0, MUTED)
        else
            txt(self, r, "M", "Evenly matched", 18, y + 19.75, 22, -0.03, TEXT)
            txt(self, r, "R", "Neither side has pulled ahead in the last 10 minutes", 18, y + 40.2, 12, 0, MUTED)
        end
        y += 43.8 + 18
        -- the chart sits on glass
        local cx0, cw0, chH = 18, 354, 184
        glass(self, r, cx0, y, cw0, chH, 20)
        local px0, pw = cx0 + 16, MOM_W
        local pt, ph = y + 14, MOM_H
        local mid = pt + ph / 2
        local function X(min: number): number return px0 + math.min(min, 90) / 90 * pw end
        local hc, ac = sideHex(m)
        crest(self, r, m.h, px0, pt + 2, 13)
        lab(self, r, TEAMS[m.h].short, px0 + 18, pt + 12, MUTED)
        crest(self, r, m.a, px0, pt + ph - 15, 13)
        lab(self, r, TEAMS[m.a].short, px0 + 18, pt + ph - 5, MUTED)
        -- half-time and the minutes still to play
        local xx = pt + 22
        while xx < pt + ph - 22 do
            rect(self, r, X(45), xx, 1, 3, hex(0xFFFFFF, 0.14))
            xx += 7
        end
        local reveal = anim(self, "momentum", now, self.tabOpenT, 0)
        local endM = math.min(m.min, 90)
        if m.status ~= "ft" then
            local fx = X(endM) + 6
            while fx < px0 + pw do
                rect(self, r, fx, mid - 0.5, math.min(3, px0 + pw - fx), 1, hex(0xFFFFFF, 0.22))
                fx += 7
            end
        end
        rect(self, r, px0, mid - 0.5, (X(endM) - px0) * reveal, 1, hex(0xFFFFFF, 0.3))
        -- the wave, like the Live pill: a tinted glass body, a bright rim and its soft glow
        local top, bot, line, endY = momPaths(self, m)
        r:save()
        r:transform(Mat2D.withTranslation(px0, pt))
        clipRect(self, r, 0, 0, reveal * endM / 90 * pw + 1, ph)
        r:drawPath(top, vgrad(self, "mh" .. tostring(hc), { { 0, hc, 0.62 }, { 1, hc, 0.1 } }, ph * 0.06, ph / 2))
        r:drawPath(bot, vgrad(self, "ma" .. tostring(ac), { { 0, ac, 0.1 }, { 1, ac, 0.62 } }, ph / 2, ph * 0.94))
        for half = 0, 1 do
            local c = if half == 0 then hc else ac
            r:save()
            clipRect(self, r, 0, if half == 0 then -4 else ph / 2, pw, ph / 2 + 4)
            r:drawPath(line, lookPaint(self, hex(c, 0.45), 3, 9))
            r:drawPath(line, paint(self, hex(c, 0.95), 1.4))
            r:restore()
        end
        r:restore()
        -- goals: a ball tag on a thin stem, on the scoring side
        local gi = 0
        for _, e in goalsOf(m) do
            local p = anim(self, "momentum", now, self.tabOpenT, gi + 1)
            if p > 0.001 then
                local gx = X(e.min)
                local home = e.side == "h"
                local by = if home then pt + 10 else pt + ph - 10
                local old = self.ga
                self.ga = old * p
                rect(self, r, gx - 0.5, math.min(by, mid), 1, math.abs(mid - by), hex(0xFFFFFF, 0.35))
                ball(self, r, gx, by + (if home then 6 else -6) * (1 - p), 7.5)
                self.ga = old
                gi += 1
            end
        end
        -- now
        if m.status == "live" and reveal > 0.98 then
            local nx = X(endM)
            local ny = pt + endY * ph
            local pulse = 0.5 + 0.5 * math.cos(now * 4)
            circle(self, r, nx, ny, 4 + 5 * pulse, hex(0x34E39A, 0.22 * (1 - pulse)))
            circle(self, r, nx, ny, 4, LIVE)
            circle(self, r, nx, ny, 4.6, BG, 1.2)
        end
        y += chH + 10
        local ax = { { 0, "0'" }, { 45, "HT" }, { 90, "90'" } }
        for i, a in ax do
            local al = if i == 1 then 0 elseif i == #ax then 1 else 0.5
            txt(self, r, "M", a[2] :: string, X(a[1] :: number), y + 10, 10, 0, DIM, al)
        end
        return y + 14
    end

    -- -----------------------------------------------------------------
    -- FACTS · events: live commentary, newest first
    -- -----------------------------------------------------------------
    local KIND_LABEL: { [string]: string } = {
        corner = "Corner", sot = "Shot on target", miss = "Shot off target", block = "Blocked shot",
        big = "Big chance", foul = "Free kick", offside = "Offside", yc = "Yellow card", rc = "Red card", sub = "Substitution", goal = "Goal",
    }
    local RAIL = 60
    local WRAP: { [Event]: { string } } = {}
    local WRAP_N = 0
    local function lines(self: Scoreline, e: Event, size: number, width: number): { string }
        local c = WRAP[e]
        if c == nil then
            if WRAP_N > 500 then
                WRAP = {}
                WRAP_N = 0
            end
            c = wrap(self, "R", e.txt, size, 0, width)
            WRAP[e] = c
            WRAP_N += 1
        end
        return c
    end

    local function scoreAt(m: Match, t: number): string
        local a, b = 0, 0
        for _, e in m.events do
            if e.kind == "goal" and e.min <= t then
                if e.side == "h" then a += 1 else b += 1 end
            end
        end
        return scoreStr(a, b)
    end

    local function rowHeight(self: Scoreline, e: Event): number
        if e.kind == "goal" then return 66 + 19 * #lines(self, e, 13.5, 246) + 4 end
        if e.kind == "sub" then return 74 end
        return 24 + 19 * #lines(self, e, 13.5, 290) + 20
    end

    -- a substitution: centred, a touch larger than the other rows, its minute right beside it
    local function subRow(self: Scoreline, r: Renderer, e: Event, team: string, top: number, rowH: number)
        local S = 1.08
        local mt = minText(e.min)
        local mw = tw(self, "M", mt, 13)
        local lw = labW(self, "Substitution")
        local n1 = tw(self, "S", e.p, 14)
        local n2 = tw(self, "R", e.o, 13.5)
        local content = math.max(19 + lw, 14 + n1 + 14 + 14 + n2)
        local bw = mw + 10 + content
        local cy = top + rowH / 2
        circle(self, r, RAIL, cy - 9, 5.5, BG)
        circle(self, r, RAIL, cy - 9, 4, MUTED, 1.2)
        r:save()
        r:transform(Mat2D.withTranslation(195, cy) * Mat2D.withScale(S, S) * Mat2D.withTranslation(-bw / 2, -19))
        txt(self, r, "M", mt, 0, bc(11.5, 13), 13, 0, MUTED)
        local cx = mw + 10
        crest(self, r, team, cx, 5, 13)
        lab(self, r, "Substitution", cx + 19, bc(11.5, 10.5), MUTED)
        icon(self, r, "up", cx, 24, 1, LIVE, 1.5)
        local w1 = txt(self, r, "S", e.p, cx + 14, bc(29, 14), 14, 0, TEXT)
        icon(self, r, "down", cx + 14 + w1 + 14, 24, 1, RED, 1.5)
        txt(self, r, "R", e.o, cx + 14 + w1 + 28, bc(29, 13.5), 13.5, 0, MUTED)
        r:restore()
    end

    -- live commentary, newest first. New rows open at the top and slide down into
    -- place; the rows below follow a frame behind each other (follow-through), and
    -- rows that arrive together start two frames apart.
    local LAG, PAIR = 1 / 60, 2 / 60
    local function eventsFeed(self: Scoreline, r: Renderer, m: Match, y: number, now: number): number
        local ev: { Event } = {}
        for _, e in m.events do
            if e.kind ~= "foulx" then table.insert(ev, e) end
        end
        local idx: { [Event]: number } = {}
        for i, e in ev do idx[e] = i end
        table.sort(ev, function(a: Event, b: Event): boolean
            if a.min ~= b.min then return a.min > b.min end
            return idx[a] > idx[b]
        end)
        if #ev == 0 then
            lab(self, r, "Kick-off soon", 18, y + 10.5, MUTED)
            return y + 13.7
        end
        local LIMIT = 10
        local total = #ev
        local T = tmOf(self, "events")
        local busy = T.dur + 0.3
        -- when each new row starts (rows that came in together are two frames apart)
        local start: { [Event]: number } = {}
        local prevT0, rank = -1000, 0
        local growing = 0
        local newest = 1
        for i, e in ev do
            if math.abs(e.t0 - prevT0) < 0.001 then rank += 1 else rank = 0 end
            prevT0 = e.t0
            start[e] = e.t0 + rank * PAIR
            if now - start[e] < busy then
                if growing == 0 then newest = i end
                if i <= LIMIT then growing += 1 end
            end
        end
        local shown = if self.evAll then total else math.min(total, LIMIT + growing)
        local ch, ca = sideColors(m)
        local stops = matchStops(m)
        -- rows: { kind, event or nil, full height, start, index }
        local rows: { { any } } = {}
        local ht = false
        for i = 1, shown do
            local e = ev[i]
            if not ht and e.min <= 45 and m.min > 45 then
                table.insert(rows, { "ht", nil, 44, -100, 0 })
                ht = true
            end
            table.insert(rows, { "e", e, rowHeight(self, e), start[e], i })
        end
        if shown == total then
            if not ht and m.min > 45 then table.insert(rows, { "ht", nil, 44, -100, 0 }) end
            table.insert(rows, { "ko", nil, 44, -100, 0 })
        end
        -- the rows past the limit fold away while the new ones open
        local foldT = if growing > 0 then start[ev[newest]] else -100
        local fold = if growing > 0 and not self.evAll then 1 - anim(self, "events", now, foldT, 0) else 0
        local function grow(row: { any }, at: number): number
            local i = row[5] :: number
            if not self.evAll and i > LIMIT then return 1 - animAt(self, "events", at, foldT, 0) end
            local s0 = row[4] :: number
            if at - s0 >= busy then return 1 end
            return animAt(self, "events", at, s0, 0)
        end
        -- each row's top: full heights above it, minus what is still opening (a frame later per row)
        local tops: { number } = {}
        local base = 0
        for j = 1, #rows + 1 do
            local deficit = 0
            for i = math.max(1, j - 40), j - 1 do
                local ri = rows[i]
                local s0 = ri[4] :: number
                local i5 = ri[5] :: number
                if now - s0 < busy + 0.2 or (not self.evAll and i5 > LIMIT) then
                    -- the feed's own end (j past the last row) moves without lag, so the
                    -- rows that fold away below and the new ones above balance out
                    local lag = if j > #rows then 0 else LAG * math.min(j - i, 6)
                    deficit += (ri[3] :: number) * (1 - grow(ri, now - lag))
                end
            end
            tops[j] = y + base - deficit
            if j <= #rows then base += rows[j][3] :: number end
        end
        local tot = tops[#rows + 1] - y
        if #rows > 0 then
            rect(self, r, RAIL - 0.5, y + 14, 1, math.max(0, tot - 36), hex(0xFFFFFF, 0.12))
        end
        r:save()
        clipRect(self, r, 0, y, W, tot + 1)
        local edge = y + tot
        for ri, row in rows do
            local top = tops[ri]
            local rowH = row[3] :: number
            local kind = row[1] :: string
            -- leaving past the bottom: gone before the edge reaches its words (every row
            -- has at least 10 px of air under its last line), so it is never sliced
            local keep = math.clamp(1 - (top + rowH - edge) / 10, 0, 1)
            if kind == "ht" or kind == "ko" then
                local cy = top + rowH / 2
                local label = if kind == "ht" then upper("Half-time · " .. scoreAt(m, 45)) else upper("Kick-off")
                local w = labW(self, label)
                local og = self.ga
                self.ga = og * keep
                glass(self, r, 195 - w / 2 - 12, cy - 12, w + 24, 24, 12)
                lab(self, r, label, 195, bc(cy, 10.5), MUTED, 0.5)
                self.ga = og
            else
                local e = row[2] :: Event
                local i = row[5] :: number
                -- the tab opening cascade and the row's own arrival, both from above
                local open = anim(self, "events", now, self.tabOpenT, math.min(ri - 1, 12))
                local arrive = if now - (row[4] :: number) < busy then animAt(self, "events", now, (row[4] :: number) + 0.04, 0) else 1
                local np = open * arrive
                if not self.evAll and i > LIMIT then np *= fold end
                if self.evAll and i > LIMIT then np *= anim(self, "events", now, self.evT, i - LIMIT - 1) end
                np *= keep
                local oldGa = self.ga
                self.ga = oldGa * np
                push(self, r, 0, -14 * (1 - arrive) - 12 * (1 - open))
                if inView(self, top - 8, rowH + 16) then
                    local team = sideTeam(m, e.side)
                    local tc = if e.side == "h" then ch else ca
                    if e.kind == "goal" then
                        local gid = "ev" .. tostring(e.id)
                        local gp, gl = pressOf(self, gid, 70, top, 310, rowH)
                        if gp + gl > 0.01 then rrect(self, r, 70, top + 2, 310, rowH - 6, 16, hex(0xFFFFFF, 0.03 * gl + 0.05 * gp)) end
                        local cy = top + 25
                        txt(self, r, "M", minText(e.min), 18, bc(cy, 13), if e.min > 90 then 11 else 13, 0, TEXT)
                        circle(self, r, RAIL, cy, 7, BG)
                        circle(self, r, RAIL, cy, 5, tc)
                        circle(self, r, RAIL, cy, 5.8, hex(0xFFFFFF, 0.5), 1)
                        photoTile(self, r, person(team, e.pn), team, e.pn, 77, top + 4, 42)
                        local tx = 128
                        lab(self, r, "Goal", tx, top + 18, LIVE)
                        txt(self, r, "S", e.p, tx, top + 38, 16, 0, TEXT)
                        if e.o ~= "" then
                            local nw = tw(self, "S", e.p, 16)
                            txt(self, r, "R", "Assist " .. e.o, tx + nw + 8, top + 38, 12, 0, MUTED)
                        end
                        -- score chip in the match colours
                        local sw = tw(self, "B", e.s, 13) + 20
                        rbox(self, r, 372 - sw - 18, top + 13, sw, 24, 12, stopsPaint(self, "chip" .. tostring(m.id), stops, true))
                        txt(self, r, "B", e.s, 372 - 18 - sw / 2, bc(top + 25, 13), 13, 0, INK, 0.5)
                        icon(self, r, "chevR", 365, top + 20.5, 1, MUTED, 1.5)
                        for li, ln in lines(self, e, 13.5, 246) do
                            txt(self, r, "R", ln, tx, top + 66 + (li - 1) * 19, 13.5, 0, hex(0xD9D7D2))
                        end
                        local mid, ref = m.id, e
                        hit(self, 70, top, 310, rowH, function()
                            local mm = findMatch(self, mid)
                            if mm then openScene(self, mm, ref, "goal") end
                        end, gid)
                    elseif e.kind == "sub" then
                        subRow(self, r, e, team, top, rowH)
                    else
                        local cy = top + 22
                        txt(self, r, "M", minText(e.min), 18, bc(cy, 13), if e.min > 90 then 11 else 13, 0, MUTED)
                        -- node: a card, or a quiet dot in the side's colour
                        if e.kind == "yc" or e.kind == "rc" then
                            circle(self, r, RAIL, cy, 6.5, BG)
                            rrect(self, r, RAIL - 3, cy - 4.5, 6, 9, 1, if e.kind == "yc" then CARD else RED)
                        else
                            circle(self, r, RAIL, cy, 5, BG)
                            circle(self, r, RAIL, cy, 3, Color.opacity(tc, 0.9))
                        end
                        crest(self, r, team, 78, cy - 6.5, 13)
                        lab(self, r, KIND_LABEL[e.kind] or e.kind, 97, bc(cy, 10.5), if e.kind == "big" then TEXT elseif e.kind == "rc" then RED else MUTED)
                        for li, ln in lines(self, e, 13.5, 290) do
                            txt(self, r, "R", ln, 78, top + 48 + (li - 1) * 19, 13.5, 0, TEXT)
                        end
                    end
                end
                pop(self, r)
                self.ga = oldGa
            end
        end
        r:restore()
        y += tot
        if total > LIMIT then
            local label = if self.evAll then "Show less" else "Show all " .. tostring(total) .. " events"
            y += 8
            pillBtn(self, r, "evAll", label, 195, y, 36, function()
                self.evAll = not self.evAll
                self.evT = nowOf(self)
            end)
            y += 36
        end
        return y
    end

    local function matchInfo(self: Scoreline, r: Renderer, m: Match, y: number): number
        y = h4(self, r, "Match info", "", y)
        local v = DATA.venues[m.h]
        local tiles: { { string } } = {}
        if v then
            table.insert(tiles, { "Venue", v[1], v[2] })
            table.insert(tiles, { "Referee", v[3], "" })
            if v[4] ~= "" then table.insert(tiles, { "Attendance", v[4], "" }) end
        end
        table.insert(tiles, { "Kick-off", if m.status == "ns" then m.time else (if m.feat then "20:45" else "20:00"), "Local time" })
        if #tiles % 2 == 1 then table.insert(tiles, { "Competition", LEAGUES[m.lg].name, "Matchday " .. tostring(LEAGUES[m.lg].md) }) end
        local tw2 = (354 - 8) / 2
        for i, t in tiles do
            local cx = 18 + ((i - 1) % 2) * (tw2 + 8)
            local ty = y + math.floor((i - 1) / 2) * 76
            glass(self, r, cx, ty, tw2, 68, 16)
            lab(self, r, t[1], cx + 14, ty + 22, MUTED)
            local vs = fit(self, "M", t[2], 15, 0, tw2 - 28)
            txt(self, r, "M", t[2], cx + 14, ty + 43, vs, 0, TEXT)
            if t[3] ~= "" then txt(self, r, "R", t[3], cx + 14, ty + 58.5, 11, 0, MUTED) end
        end
        return y + math.ceil(#tiles / 2) * 76
    end

    local function formBlock(self: Scoreline, r: Renderer, m: Match, y: number): number
        y = h4(self, r, "Form", "Last five", y)
        for _, k in { m.h, m.a } do
            local rr = rng(#k * 13 + m.id + string.byte(k, 1))
            local cy = y + 21
            crest(self, r, k, 18, cy - 8, 16)
            txt(self, r, "M", TEAMS[k].name, 46, bc(cy, 16), 16, 0, TEXT)
            for i = 0, 4 do
                local x = rr()
                local c = if x < 0.45 then "W" elseif x < 0.7 then "D" else "L"
                local bx = 250 + i * 25
                if c == "W" then
                    rrect(self, r, bx, cy - 11, 22, 22, 6, TEXT)
                    txt(self, r, "B", c, bx + 11, bc(cy, 11), 11, 0, BG, 0.5)
                elseif c == "D" then
                    rrect(self, r, bx, cy - 11, 22, 22, 6, hex(0x232321))
                    txt(self, r, "B", c, bx + 11, bc(cy, 11), 11, 0, MUTED, 0.5)
                else
                    rrect(self, r, bx + 0.5, cy - 10.5, 21, 21, 6, DIM, 1)
                    txt(self, r, "B", c, bx + 11, bc(cy, 11), 11, 0, MUTED, 0.5)
                end
            end
            hline(self, r, 18, y + 42, 354)
            y += 43
        end
        return y
    end

    local function facts(self: Scoreline, r: Renderer, m: Match, y: number, now: number): number
        if m.status == "ns" then
            y = h4(self, r, "Kick-off", "Matchday " .. tostring(LEAGUES[m.lg].md), y)
            txt(self, r, "L", m.time, 18, y + 40, 40, -0.04, TEXT)
            y += 52 + 34
            y = formBlock(self, r, m, y)
            return matchInfo(self, r, m, y + 34)
        end
        y = h4(self, r, "Momentum", minLabel(m), y)
        y = momentum(self, r, m, y, now)
        y += 36
        local n = 0
        for _, e in m.events do
            if e.kind ~= "foulx" then n += 1 end
        end
        y = h4(self, r, "Events", if m.status == "live" then "Live" else tostring(n), y)
        if m.status == "live" then
            -- a small live dot before the label
            local lw = labW(self, "Live")
            local pulse = 0.5 + 0.5 * math.cos(nowOf(self) * 4)
            circle(self, r, 372 - lw - 9, y - 27.7 + 6.8, 2.6 + 2.5 * pulse, hex(0x34E39A, 0.25 * (1 - pulse)))
            circle(self, r, 372 - lw - 9, y - 27.7 + 6.8, 2.6, LIVE)
        end
        y = eventsFeed(self, r, m, y, now)
        y += 34
        return matchInfo(self, r, m, y)
    end

    -- -----------------------------------------------------------------
    -- STATS
    -- -----------------------------------------------------------------
    local function stats(self: Scoreline, r: Renderer, m: Match, y: number, now: number): number
        if m.status == "ns" then return formBlock(self, r, m, y) end
        local ch, ca = sideColors(m)
        local t = m.poss
        local lead = if t == 50 then "" elseif t > 50 then "h" else "a"
        y = h4(self, r, "Possession", minLabel(m), y)
        local cy = y + 10
        crest(self, r, m.h, 18, y, 20)
        txt(self, r, "M", TEAMS[m.h].name, 46, bc(cy, 13), 13, 0, TEXT)
        crest(self, r, m.a, 352, y, 20)
        txt(self, r, "M", TEAMS[m.a].name, 344, bc(cy, 13), 13, 0, TEXT, 1)
        y += 20 + 12
        local v = 50 + (t - 50) * anim(self, "stats", now, self.tabOpenT, 0)
        local hv, av = math.floor(v + 0.5), math.floor(100 - v + 0.5)
        local base = y + 46.4
        local hw = txt(self, r, "L", tostring(hv), 18, base, 60, -0.05, if lead == "a" then DIM else TEXT)
        txt(self, r, "R", "%", 18 + hw + 2, base, 22, 0, if lead == "a" then DIM else TEXT)
        local pw = tw(self, "R", "%", 22)
        txt(self, r, "R", "%", 372, base, 22, 0, if lead == "h" then DIM else TEXT, 1)
        txt(self, r, "L", tostring(av), 372 - pw - 2, base, 60, -0.05, if lead == "h" then DIM else TEXT, 1)
        y += 51 + 14
        local gp = anim(self, "stats", now, self.tabOpenT, 0)
        local lw = 350 * v / 100
        local old = self.ga
        self.ga = old * gp
        rrect4(self, r, 18, y, lw, 46, 8, 3, 3, 8, ch)
        rrect4(self, r, 18 + lw + 4, y, 350 - lw, 46, 3, 8, 8, 3, ca)
        self.ga = old
        y += 46 + 12
        local note = if lead ~= "" then TEAMS[sideTeam(m, lead)].name .. " keep more of the ball" else "Possession shared evenly"
        lab(self, r, note, 18, y + 10.5, MUTED)
        y += 13.7 + 34
        y = h4(self, r, "Top stats", TEAMS[m.h].short .. " · " .. TEAMS[m.a].short, y)
        for i, s in m.stats do
            local base2 = y + 29
            txt(self, r, "M", fmtNum(s.a, s.fmt), 18, base2, 17, 0, TEXT)
            txt(self, r, "M", fmtNum(s.b, s.fmt), 372, base2, 17, 0, TEXT, 1)
            lab(self, r, s.name, 195, base2 - 0.5, MUTED, 0.5)
            local sy2 = y + 43.15
            local fa = math.max(s.a, 0.01) / (math.max(s.a, 0.01) + math.max(s.b, 0.01))
            local f = 0.5 + (fa - 0.5) * anim(self, "stats", now, self.tabOpenT, i)
            local w1 = 351 * f
            local oldGa = self.ga
            self.ga = oldGa * (if s.a < s.b then 0.28 else 1)
            rrect(self, r, 18, sy2, w1, 4, 2, ch)
            self.ga = oldGa * (if s.b < s.a then 0.28 else 1)
            rrect(self, r, 18 + w1 + 3, sy2, 351 - w1, 4, 2, ca)
            self.ga = oldGa
            hline(self, r, 18, y + 57.15, 354)
            y += 58.15
        end
        return y
    end

    -- -----------------------------------------------------------------
    -- LINEUP
    -- -----------------------------------------------------------------
    local PITCH_H = 540
    local FACE = 56      -- photo token width on the pitch
    local PLATE_H = 20

    -- one player on the pitch: the photo stands behind his name plate (the cut is never seen).
    -- Tags sit on the photo like stickers: rating top right, off capsule (arrow and minute) top left,
    -- goals and assists bottom right, cards bottom left.
    local function pitchMarker(self: Scoreline, r: Renderer, m: Match, side: string, n: number, cx: number, py: number, maxW: number, best: boolean, p: number)
        if p <= 0.001 then return end
        local lu = m.lu[side]
        local team = lu.team
        local old = self.ga
        local sentOff = lu.rc[n] ~= nil
        self.ga = old * p * (if sentOff then 0.5 else 1)
        local dy = 26 * (1 - p)
        py += dy
        local plateTop = py - PLATE_H / 2
        local photoTop = plateTop + 5 - FACE
        local pp = person(team, n)
        local photo = pp ~= nil and hasPhoto(self, pp)
        local id = "pm" .. team .. tostring(n)
        local pk, lit = pressOf(self, id, cx - 38, photoTop - 4, 76, FACE + PLATE_H + 8)
        local s = 1 - 0.05 * pk + 0.02 * lit
        self.heads[team .. tostring(n)] = { cx - FACE / 2 + self.ox, photoTop + self.oy, FACE, FACE }
        if inView(self, photoTop - 14, FACE + PLATE_H + 28) then
            r:save()
            r:transform(Mat2D.withTranslation(cx, py) * Mat2D.withScale(s, s) * Mat2D.withTranslation(-cx, -py))
            if photo then
                bust(self, r, pp :: Person, CROP.face, cx - FACE / 2, photoTop, FACE, FACE)
            else
                kitDisc(self, r, team, n, cx, plateTop - 24, 19)
            end
            -- name plate: a small glass bar
            local num = if photo then tostring(n) else ""
            local name = nameOf(team, n)
            local fol = isFollowed(self, team, n)
            local numW = if photo then tw(self, "S", num, 10.5) else -5
            local nameSize = fit(self, "S", name, 11.5, 0, maxW - numW - 22 - (if fol then 13 else 0))
            local nameW = tw(self, "S", name, nameSize)
            local inner = numW + 5 + nameW + (if fol then 13 else 0)
            local w = math.clamp(inner + 18, FACE + 8, maxW)
            glass(self, r, cx - w / 2, plateTop, w, PLATE_H, PLATE_H / 2, 1, lit)
            local tx = cx - inner / 2
            if fol then
                gstar(self, r, tx + 4.5, py, 4.6)
                tx += 13
            end
            if photo then txt(self, r, "S", num, tx, bc(py, 10.5), 10.5, 0, MUTED) end
            txt(self, r, "S", name, tx + numW + 5, bc(py, nameSize), nameSize, 0, TEXT)
            -- tags
            local st = playerStats(m, side, n)
            local tagY = photoTop + 7
            if m.status ~= "ns" and st.played and st.rating > 0 then
                ratingTag(self, r, st.rating, cx + FACE / 2 + 7, tagY, best, 1)
            end
            local off = lu.off[n]
            if off then
                -- substituted: the sticker sits against his head, opposite the rating
                subOffTag(self, r, off, cx - 9, tagY)
            end
            local lowY = plateTop - 5
            countTags(self, r, lu.goals[n] or 0, lu.assists[n] or 0, 0, 0, cx + FACE / 2 - 9, lowY, 0, 7)
            countTags(self, r, 0, 0, if lu.yc[n] then 1 else 0, if sentOff then 1 else 0, cx - FACE / 2 + 9, lowY, 1, 7)
            r:restore()
        end
        self.ga = old
        local tk, nn = team, n
        hit(self, cx - 38, photoTop - 4, 76, FACE + PLATE_H + 8, function()
            openPlayer(self, tk, nn, self.heads[tk .. tostring(nn)])
        end, id)
    end

    -- Home / away: a glass switch; the chosen side wears its colours. Hovering a
    -- side rolls its letters up and back in from below.
    local function teamSwitch(self: Scoreline, r: Renderer, m: Match, y: number, now: number)
        local k = tv(self.luK, now)
        glass(self, r, 18, y, 354, 46, 23)
        local seg = (354 - 8) / 2
        local ix = 22 + k * seg
        local side = if k < 0.5 then "h" else "a"
        local tm = TEAMS[sideTeam(m, side)]
        local st = { { 0, pastel(tm.c1) }, { 1, pastel(mix(tm.c2, 0xF7F2EA, 0.3)) } }
        rbox(self, r, ix, y + 4, seg, 38, 19, stopsPaint(self, "sw" .. tm.key, st, true))
        for i, sd in { "h", "a" } do
            local key = sideTeam(m, sd)
            local sx = 22 + (i - 1) * seg
            local cx = sx + seg / 2
            local id = "lu" .. sd
            local lit, pk, us = uiFeel(self, id, sx, y, seg, 46)
            local on = if sd == "h" then 1 - k else k
            if lit * (1 - on) > 0.01 then
                r:save()
                r:transform(Mat2D.withTranslation(sx, y + 4))
                r:drawPath(shape(self, seg, 38, 19, 19, 19, 19), spotLook(self, us.hx, us.hy - 4, spotR(seg, 38), 0.1 * lit * (1 - on)))
                r:restore()
            end
            local nw = tw(self, "S", TEAMS[key].name, 14) + 26
            local sc = 1 - 0.04 * pk
            r:save()
            r:transform(Mat2D.withTranslation(cx, y + 23) * Mat2D.withScale(sc, sc) * Mat2D.withTranslation(-cx, -(y + 23)))
            crest(self, r, key, cx - nw / 2, y + 13, 20)
            local c = Color.lerp(Color.lerp(MUTED, TEXT, 0.6 * lit), hex(0x000000), on)
            rollTxt(self, r, "S", TEAMS[key].name, cx - nw / 2 + 26, bc(y + 23, 14), 14, 0, c, 0, now - us.rollT)
            r:restore()
            local sdd = sd
            hit(self, sx, y, seg, 46, function() setSide(self, sdd) end, id)
        end
    end

    -- a list row: his photo tile (cut like the notification), the number beside
    -- both lines, name, role, and what happened to him as tags
    local function playerRow(self: Scoreline, r: Renderer, m: Match, side: string, n: number, y: number, role: string, showMatch: boolean, p: number)
        local lu = m.lu[side]
        local team = lu.team
        local pp = person(team, n)
        local cy = y + 32
        local old = self.ga
        local id = "pr" .. team .. tostring(n)
        local pk, lit = pressOf(self, id, 12, y, 366, 64)
        self.ga = old * p
        if lit + pk > 0.01 then rrect(self, r, 12, y + 2, 366, 60, 14, hex(0xFFFFFF, 0.03 * lit + 0.05 * pk)) end
        push(self, r, 0, 10 * (1 - p))
        -- off-screen rows only keep the head box the player page grows from
        if inView(self, y - 4, 72) then
            local fb = photoTile(self, r, pp, team, n, 16, y + 6, 52)
            self.heads[team .. tostring(n)] = { fb[1] + self.ox, fb[2] + self.oy, fb[3], fb[4] }
            local photo = pp ~= nil and hasPhoto(self, pp)
            if photo then txt(self, r, "S", tostring(n), 90, bc(cy + 1.5, 15), 15, 0, MUTED, 1) end
            local nm = if pp then fullName(pp :: Person) else nameOf(team, n)
            local nw = txt(self, r, "S", nm, 100, bc(cy - 8, 15), fit(self, "S", nm, 15, 0, 190), 0, TEXT)
            local fx = 100 + nw + 8
            if isFollowed(self, team, n) then
                gstar(self, r, fx + 5, cy - 8, 5)
                fx += 16
            end
            if showMatch then eventTags(self, r, lu, n, fx, cy - 8, 0, 7) end
            txt(self, r, "R", role, 100, bc(cy + 11, 12), 12, 0, MUTED)
            if showMatch then
                local on = lu.on[n]
                if on then
                    local st = playerStats(m, side, n)
                    local rx = 372
                    if st.rating > 0 then rx -= ratingTag(self, r, st.rating, 372, cy - 9, false, 1) + 8 end
                    local s = tostring(on) .. "'"
                    local w = tw(self, "S", s, 12.5)
                    txt(self, r, "S", s, rx, bc(cy - 9, 12.5), 12.5, 0, LIVE, 1)
                    subTag(self, r, rx - w - 11, cy - 9, 6.5, false)
                    local fo = lu.forr[n]
                    if fo then txt(self, r, "R", "for " .. nameOf(team, fo), 372, bc(cy + 11, 11.5), 11.5, 0, MUTED, 1) end
                elseif m.status ~= "ns" then
                    txt(self, r, "R", "Unused", 372, bc(cy, 12), 12, 0, DIM, 1)
                end
            end
        else
            local f = CROP.face
            self.heads[team .. tostring(n)] = { 16 + self.ox, y + 6 + 52 - (f[4] - 14) * (52 / f[3]) + self.oy, 52, 52 }
        end
        pop(self, r)
        self.ga = old
        hline(self, r, 100, y + 63, 272)
        local tk, nn = team, n
        hit(self, 12, y, 366, 64, function() openPlayer(self, tk, nn, self.heads[tk .. tostring(nn)]) end, id)
    end

    local function coachRow(self: Scoreline, r: Renderer, team: string, y: number): number
        local co = COACH[team]
        if co == nil then return y end
        y = h4(self, r, "Coach", "", y)
        local cy = y + 30
        if hasPhoto(self, co) then
            photoTile(self, r, co, team, 0, 16, y + 4, 52)
        else
            circle(self, r, 42, cy, 21, SURF)
            circle(self, r, 42, cy, 20.5, HAIR, 1)
            local function initial(s: string): string
                if s == "" then return "" end
                local nx = utf8.offset(s, 2)
                return if nx then string.sub(s, 1, nx - 1) else s
            end
            local ini = initial(co.first) .. initial(co.last)
            txt(self, r, "S", ini, 42, bc(cy, 15), 15, 0.02, MUTED, 0.5)
        end
        txt(self, r, "S", co.first .. " " .. co.last, 100, bc(cy - 8, 15), 15, 0, TEXT)
        txt(self, r, "R", "Head coach", 100, bc(cy + 11, 12), 12, 0, MUTED)
        return y + 62
    end

    -- upcoming matches: no line-up yet, just the squad, line by line
    local function squadList(self: Scoreline, r: Renderer, m: Match, y: number, now: number): number
        local side = self.luSide
        local lu = m.lu[side]
        local team = lu.team
        teamSwitch(self, r, m, y, now)
        y += 46 + 22
        -- note
        glass(self, r, 18, y, 354, 52, 16)
        txt(self, r, "M", "Line-ups are not out yet", 36, y + 22, 14, 0, TEXT)
        txt(self, r, "R", "They are confirmed about an hour before kick-off.", 36, y + 40, 12, 0, MUTED)
        y += 52 + 30
        local all: { number } = {}
        for _, n in lu.xi do table.insert(all, n) end
        for _, n in lu.bench do table.insert(all, n) end
        local start = math.max(self.luT, self.tabOpenT)
        local i = 0
        for _, grp in { { "GK", "Goalkeepers" }, { "DF", "Defenders" }, { "MF", "Midfielders" }, { "FW", "Forwards" } } do
            local list: { number } = {}
            for _, n in all do
                local p = person(team, n)
                if p and p.pos == grp[1] then table.insert(list, n) end
            end
            table.sort(list, function(a: number, b: number): boolean return a < b end)
            if #list > 0 then
                y = h4(self, r, grp[2], tostring(#list), y)
                for _, n in list do
                    local p = person(team, n)
                    local role = if p and p.role ~= "" then p.role else ({ GK = "Goalkeeper", DF = "Defender", MF = "Midfielder", FW = "Forward" })[grp[1]]
                    playerRow(self, r, m, side, n, y, role, false, anim(self, "squad", now, start, i))
                    i += 1
                    y += 64
                end
                y += 26
            end
        end
        return coachRow(self, r, team, y)
    end

    local function lineup(self: Scoreline, r: Renderer, m: Match, y: number, now: number): number
        if m.status == "ns" then return squadList(self, r, m, y, now) end
        local side = self.luSide
        local lu = m.lu[side]
        local team = lu.team
        teamSwitch(self, r, m, y, now)
        y += 46 + 22
        lab(self, r, "Formation", 18, y + 10.5, MUTED)
        lab(self, r, lu.form, 372, y + 10.5, TEXT, 1)
        y += 13.7 + 14
        -- pitch: our half, attacking upwards, on glass, lit softly in the team colour
        local px, py, pw, ph = 18, y, 354, PITCH_H
        local rows = formRows(lu.form)
        local R = #rows
        local yTop, yBot = py + 98, py + ph - 34
        local function rowAt(row: number): number return yBot - (row - 1) * (yBot - yTop) / math.max(R - 1, 1) end
        glass(self, r, px, py, pw, ph, 22)
        local lc = hex(0xFFFFFF, 0.09)
        r:save()
        r:transform(Mat2D.withTranslation(px, py))
        r:clipPath(shape(self, pw, ph, 22, 22, 22, 22))
        r:transform(Mat2D.withTranslation(-px, -py))
        softLight(self, r, px, py, pw, ph, px + pw / 2, py, pw * 0.92, ph * 0.78, TEAMS[team].c1, 0.34)
        -- mowing stripes: one band per line of players, each line sits between two edges
        -- (a marker's visual middle is 26 px above its row: photo above, plate on the row)
        local half = (yBot - yTop) / math.max(R - 1, 1) / 2
        for row = R, 1, -1 do
            local vc = rowAt(row) - 26
            local shade = if (R - row) % 2 == 0 then 0.03 else 0.008
            rect(self, r, px, vc - half, pw, half * 2, hex(0xFFFFFF, shade))
        end
        r:transform(Mat2D.withTranslation(px, py))
        circle(self, r, pw / 2, 0, 58, lc, 1)
        rrect(self, r, pw * 0.2, ph - ph * 0.16, pw * 0.6, ph * 0.16 + 2, 0, lc, 1)
        rrect(self, r, pw * 0.37, ph - ph * 0.06, pw * 0.26, ph * 0.06 + 2, 0, lc, 1)
        circle(self, r, pw / 2, ph - ph * 0.115, 1.6, lc)
        r:restore()
        -- players: rows from the forwards (top) down to the keeper; every row evenly spaced
        local best, bestV = 0, -1
        for _, n in lu.xi do
            local v = playerStats(m, side, n).rating
            if v > bestV then best, bestV = n, v end
        end
        local start = math.max(self.luT, self.tabOpenT)
        local s = tmOf(self, "lineup")
        local slot = 1
        for row = 1, R do
            local cnt = rows[row]
            local fromTop = R - row
            local rowY = rowAt(row)
            local spacing = math.min((pw - 16) / cnt, 116)
            local maxW = math.min(spacing - 6, 92)
            for i = 1, cnt do
                local n = lu.xi[slot]
                local cx = px + pw / 2 + (i - (cnt + 1) / 2) * spacing
                -- forwards first, then midfield, defence and the keeper (motion: lineup)
                local p = animAt(self, "lineup", now, start, s.delay + fromTop * s.stagger + (i - 1) * s.stagger * 0.25)
                pitchMarker(self, r, m, side, n, cx, rowY, maxW, n == best, p)
                slot += 1
            end
        end
        y += ph + 34
        -- substitutes: the ones who came on first
        local bench = table.clone(lu.bench)
        table.sort(bench, function(a: number, b: number): boolean
            local oa, ob = lu.on[a], lu.on[b]
            if (oa ~= nil) ~= (ob ~= nil) then return oa ~= nil end
            if oa and ob and oa ~= ob then return oa < ob end
            return a < b
        end)
        local used = 0
        for _, n in bench do
            if lu.on[n] then used += 1 end
        end
        y = h4(self, r, "Substitutes", tostring(used) .. " of 5 used", y)
        for i, n in bench do
            local p = person(team, n)
            local role = if p and p.role ~= "" then p.role else ({ GK = "Goalkeeper", DF = "Defender", MF = "Midfielder", FW = "Forward" })[if p then p.pos else "MF"]
            playerRow(self, r, m, side, n, y, role or "", true, anim(self, "squad", now, start, i - 1))
            y += 64
        end
        y += 30
        return coachRow(self, r, team, y)
    end

    -- -----------------------------------------------------------------
    -- TABLE
    -- -----------------------------------------------------------------
    local function standingsView(self: Scoreline, r: Renderer, m: Match, y: number, now: number): number
        local L = LEAGUES[m.lg]
        if #L.teams == 0 then
            y = h4(self, r, "Standings", L.name, y)
            txt(self, r, "R", "Friendlies have no table.", 18, y + 30, 20, -0.02, MUTED)
            lab(self, r, "Every result still counts for the FIFA ranking", 18, y + 56, DIM)
            return y + 70
        end
        y = h4(self, r, "Standings", L.name, y)
        return leagueRows(self, r, m.lg, m.h, m.a, y, now, self.tabOpenT)
    end

    -- a league's table: header row, then the teams (hiA / hiB stand out); t0 starts the cascade
    leagueRows = function(self: Scoreline, r: Renderer, lg: string, hiA: string, hiB: string, y: number, now: number, t0: number): number
        local L = LEAGUES[lg]
        local rows = standings(lg, self.matches)
        local function th(s: string, x: number, al: number)
            txt(self, r, "M", upper(s), x, y + 10, 10, 0.14, MUTED, al)
        end
        -- the number columns keep 20 px from the glass row's edge
        th("#", 22, 0); th("Team", 58, 0); th("P", 236, 1); th("W-D-L", 288, 1); th("GD", 320, 1); th("Pts", 352, 1)
        y += 23
        hline(self, r, 18, y, 354)
        y += 5
        local qn = L.q or 2
        for i, row in rows do
            local q = i <= qn
            local mine = row.k == hiA or row.k == hiB
            local rowH = 46
            local e = anim(self, "stats", now, t0, i - 1)
            local old = self.ga
            self.ga = old * e
            push(self, r, 0, 8 * (1 - e))
            local cy = y + rowH / 2
            if inView(self, y, rowH) then
                if q then
                    -- qualified: a glass row, the position on our spectrum
                    glass(self, r, 18, y + 2, 354, rowH - 4, 14)
                    rbox(self, r, 30, cy - 11, 22, 22, 7, gradPaint(self, 2, true))
                    txt(self, r, "B", tostring(i), 41, bc(cy, 12), 12, 0, INK, 0.5)
                else
                    txt(self, r, "R", tostring(i), 41, bc(cy, 14), 14, 0, MUTED, 0.5)
                end
                local c = if q or mine then TEXT else MUTED
                local f = if q or mine then "M" else "R"
                crest(self, r, row.k, 62, cy - 9, 18)
                local nw = txt(self, r, f, TEAMS[row.k].name, 88, bc(cy, 15), 15, -0.01, c)
                if row.live then
                    local pulse = 0.4 + 0.6 * (0.5 + 0.5 * math.cos(now * 4))
                    circle(self, r, 88 + nw + 9, cy, 3, Color.opacity(LIVE, pulse))
                end
                txt(self, r, "R", tostring(row.p), 236, bc(cy, 14), 14, 0, c, 1)
                txt(self, r, "R", tostring(row.w) .. "-" .. tostring(row.d) .. "-" .. tostring(row.l), 288, bc(cy, 13), 13, 0, if q then MUTED else DIM, 1)
                txt(self, r, "R", (if row.gd > 0 then "+" else "") .. tostring(row.gd), 320, bc(cy, 14), 14, 0, c, 1)
                txt(self, r, "S", tostring(row.pts), 352, bc(cy, 15), 15, 0, if q then TEXT else hex(0xBDBBB6), 1)

            end
            pop(self, r)
            self.ga = old
            y += rowH
            if i == qn and i < #rows then
                if inView(self, y, 7) then
                    local xx = 18
                    while xx < 372 do
                        rect(self, r, xx, y + 3, math.min(4, 372 - xx), 1, hex(0xFFFFFF, 0.28))
                        xx += 8
                    end
                end
                y += 7
            end
        end
        y += 16
        if qn > 0 then
            rbox(self, r, 18, y + 1, 12, 12, 4, gradPaint(self, 2, true))
            lab(self, r, L.ql or "Qualify · top two", 38, y + 11, TEXT)
        end
        circle(self, r, 250, y + 7, 3, LIVE)
        lab(self, r, "Playing now", 260, y + 11, MUTED)
        return y + 20
    end

    drawDetailScreen = function(self: Scoreline, r: Renderer, m: Match, now: number)
        rect(self, r, 0, 0, W, H, BG)
        hit(self, 0, 0, W, H, function() end)
        r:save()
        clipRect(self, r, 0, DETAIL_TOP, W, H - DETAIL_TOP)
        self.clipTop, self.clipBot = self.oy + DETAIL_TOP, self.oy + H
        local y0 = DETAIL_TOP - self.detailScroll.y
        local y = drawHero(self, r, m, y0, now)
        local oldGa = self.ga
        self.ga = oldGa * blockIn(self, r, now, 3)
        for i, name in TABS do
            local label = if i == 3 and m.status == "ns" then "Squad" else name
            local cx = 18 + (i - 0.5) * 88.5
            local tid = "tab" .. tostring(i)
            local tp, tl, ts = uiFeel(self, tid, 18 + (i - 1) * 88.5, y, 88.5, 38)
            local old = self.ga
            self.ga = old * (1 - 0.35 * tp)
            rollTxt(self, r, "S", upper(label), cx, bc(y + 19, 10.5), 10.5, 0.16, Color.lerp(if i == self.tab then TEXT else DIM, TEXT, 0.5 * tl), 0.5, nowOf(self) - ts.rollT)
            self.ga = old
            local ti = i
            hit(self, 18 + (i - 1) * 88.5, y, 88.5, 38, function() setTab(self, ti) end, tid)
        end
        hline(self, r, 18, y + 38, 354)
        gradRect(self, r, 18 + tv(self.tabIndX, now), y + 37, 48.5, 2, 2, true)
        pop(self, r)
        self.ga = oldGa
        y += 39 + 22
        -- the pane follows the indicator (motion: tabs) and the open cascade (motion: screen)
        local pe = anim(self, "tabs", now, self.paneT, 1) * anim(self, "screen", now, self.screenT, 4)
        self.ga = oldGa * pe
        push(self, r, 24 * (1 - anim(self, "tabs", now, self.paneT, 1)) * self.paneDir, 12 * (1 - anim(self, "screen", now, self.screenT, 4)))
        if self.tab == 1 then
            y = facts(self, r, m, y, now)
        elseif self.tab == 2 then
            y = stats(self, r, m, y, now)
        elseif self.tab == 3 then
            y = lineup(self, r, m, y, now)
        else
            y = standingsView(self, r, m, y, now)
        end
        pop(self, r)
        self.ga = oldGa
        self.clipTop, self.clipBot = self.oy, self.oy + H
        r:restore()
        self.detailScroll.max = math.max(0, (y + 56) - y0 - (H - DETAIL_TOP))

        -- top bar
        rect(self, r, 0, 0, W, DETAIL_TOP, BG)
        statusBar(self, r)
        if not self.desk then
            roundBtn(self, r, "mBack", 14, 50, function() closeMatch(self) end)
            icon(self, r, "back", 14 + 15.5, 50 + 12, 1, TEXT, 1.6)
            btnClose(r)
        end
        local L = LEAGUES[m.lg]
        lab(self, r, L.country .. " · " .. L.name, 195, bc(70, 10.5), MUTED, 0.5)
        local id = m.id
        roundBtn(self, r, "mFav", 336, 50, function() toggleFavMatch(self, id) end)
        followIcon(self, r, 336 + 8, 50 + 8, self.favMatch[m.id] == true)
        btnClose(r)
    end
end


-- =====================================================================
-- PLAYER VIEW — the list's face grows into the whole bust, centred, its
-- giant shirt number behind it; name and numbers sit centred underneath
-- =====================================================================

do
    -- the hero: the bust, centred (every face sits on the cell's middle line), cut
    -- sharp just above its soft edge; it stands on a line of light, and the giant
    -- shirt number stands on the same line behind it
    local HERO = { 55, 90, 280, 350 }       -- the whole cell on the page
    local CUT = 318                         -- design units: the fade starts at 324
    local HERO_SRC = { 0, 0, 288, CUT }
    local LINE_Y = HERO[2] + HERO[4] * CUT / 360
    local NUM_BASE = LINE_Y

    -- the line of light: a hairline, brightest under him and gone at both ends,
    -- its bloom, light rising above it and a fainter spill below
    local function horizon(self: Scoreline, r: Renderer, cx: number, y: number, c1: number, a: number)
        if a <= 0.01 then return end
        local old = self.ga
        self.ga = old * a
        local tint = mix(c1, 0xFFFFFF, 0.45)
        softLight(self, r, 0, y - 90, W, 90, cx, y, 235, 72, tint, 0.42)
        softLight(self, r, 0, y, W, 40, cx, y, 190, 28, tint, 0.2)
        r:save()
        r:transform(Mat2D.withTranslation(cx - 150, y - 1.5))
        r:drawPath(shape(self, 300, 3, 1.5, 1.5, 1.5, 1.5), lookPaint(self, hex(tint, 0.9), nil, 8))
        r:restore()
        box(self, r, cx - 182, y - 0.5, 364, 1, stopsPaint(self, "hz" .. tostring(c1),
            { { 0, tint, 0 }, { 0.16, tint, 0.5 }, { 0.5, 0xFFFFFF, 1 }, { 0.84, tint, 0.5 }, { 1, tint, 0 } }, true))
        self.ga = old
    end

    local function lerpRect(a: { number }, b: { number }, p: number): { number }
        return { lerp(a[1], b[1], p), lerp(a[2], b[2], p), lerp(a[3], b[3], p), lerp(a[4], b[4], p) }
    end

    -- the ink of a light-weight number, left and right (font units), so it centres by
    -- what you see rather than by its advance ("1" is narrow, "0" is wide)
    local INK: { [string]: { number } } = {}
    local function inkX(self: Scoreline, s: string): (number, number)
        local c = INK[s]
        if c == nil then
            local lo, hi, x0 = math.huge, -math.huge, 0
            for _, cp in utf8.codes(s) do
                local g = self.fonts.L[utf8.char(cp)]
                if g then
                    local cm = g.cmds
                    local i = 1
                    while i <= #cm do
                        local op = -cm[i]
                        local n = if op == 1 or op == 2 then 1 elseif op == 3 then 3 elseif op == 5 then 2 else 0
                        for j = 0, n - 1 do
                            local px = cm[i + 1 + j * 2] + x0
                            lo, hi = math.min(lo, px), math.max(hi, px)
                        end
                        i += 1 + n * 2
                    end
                    x0 += g.adv - 50
                end
            end
            c = { lo, hi }
            INK[s] = c
        end
        return c[1], c[2]
    end

    -- the giant number, centred by its ink; feather > 0 draws it frosted
    local function bigNumber(self: Scoreline, r: Renderer, n: number, x: number, base: number, feather: number)
        local s = tostring(n)
        local tp = textPath(self, "L", s, -0.05)
        local k = 300 / 1000
        local lo, hi = inkX(self, s)
        local p = if feather > 0 then lookPaint(self, hex(0xFFFFFF, 0.08), nil, feather / k) else paint(self, hex(0xFFFFFF, 0.08))
        r:save()
        r:transform(Mat2D.withTranslation(x - (lo + hi) / 2 * k, base) * Mat2D.withScale(k, k))
        r:drawPath(tp.path, p)
        r:restore()
    end

    drawPlayerView = function(self: Scoreline, r: Renderer, now: number)
        local pv = self.pv
        local T = tmOf(self, "player")
        local e = bez(T.c, prog(now - pv.t, 0, if pv.open then T.dur else T.dur * 0.7))
        if not pv.open then e = 1 - e end
        if e <= 0.001 then return end
        local m = findMatch(self, pv.mid)
        if m == nil then return end
        local side = if m.h == pv.team then "h" elseif m.a == pv.team then "a" else ""
        if side == "" then return end
        local p = person(pv.team, pv.n)
        local tm = TEAMS[pv.team]
        local st = playerStats(m, side, pv.n)
        local lu = m.lu[side]
        local photo = p ~= nil and hasPhoto(self, p)

        local oldGa = self.ga
        local pageA = math.clamp(e * 1.3, 0, 1)
        self.ga = oldGa * pageA
        local function backdrop()
            rect(self, r, 0, 0, W, H, BG)
            softLight(self, r, 0, 0, W, 640, 195, 250, 330, 340, tm.c1, 0.5)
        end
        backdrop()
        hit(self, 0, 0, W, H, function() end)

        r:save()
        clipRect(self, r, 0, 0, W, H)
        local sy = -self.playerScroll.y
        local sw = ease(GLIDE, now, pv.prevT, 0.5)
        local slide = 36 * (1 - sw) * pv.dir
        local oldB = self.ga
        if photo then
            self.ga = oldB * sw
            bigNumber(self, r, pv.n, 195 + slide * 0.5, sy + NUM_BASE, 0)
        end
        self.ga = oldB
        -- portrait: the list's face grows into the bust, cut sharp on the line
        local hero = { HERO[1] + slide, HERO[2] + sy, HERO[3], HERO[4] }
        if photo then
            local from = pv.from
            local src = HERO_SRC
            local frame = hero
            if #from == 4 and e < 1 then
                local f = CROP.face
                local k0 = from[3] / f[3]
                local start = { from[1] - f[1] * k0, from[2] - f[2] * k0, ATLAS.bw * k0, ATLAS.bh * k0 }
                frame = lerpRect(start, hero, e)
                src = lerpRect(f, HERO_SRC, e)
            elseif #from ~= 4 and e < 1 then
                local s = lerp(0.9, 1, e)
                frame = { 195 - HERO[3] * s / 2 + slide, hero[2] + HERO[4] * (1 - s) * 0.4, HERO[3] * s, HERO[4] * s }
            end
            local kx, ky = frame[3] / ATLAS.bw, frame[4] / ATLAS.bh
            bust(self, r, p :: Person, src, frame[1] + src[1] * kx, frame[2] + src[2] * ky, src[3] * kx, src[4] * ky, math.clamp(e * 2.5, 0, 1) * sw)
        else
            kitDisc(self, r, pv.team, pv.n, 195 + slide, hero[2] + 170, 92)
        end
        horizon(self, r, 195 + slide * 0.5, sy + LINE_Y, tm.c1, math.clamp(e * 2 - 0.8, 0, 1) * sw)
        -- the info, centred under him (motion: player)
        local function block(i: number): number
            local b = anim(self, "player", now, pv.t, i) * (if pv.open then 1 else e)
            self.ga = oldGa * pageA * b * sw
            return 14 * (1 - b)
        end
        local y = sy + 456
        local first = if p then p.first else ""
        local last = if p then p.last else nameOf(pv.team, pv.n)
        local d = block(0)
        txt(self, r, "R", first, 195 + slide * 0.4, y + d, 16, 0, MUTED, 0.5)
        -- his number, small and light, hangs at the surname's top right: the name stays
        -- centred, the giant number behind him stays too
        local num = tostring(pv.n)
        local nfs = 15
        local nw = tw(self, "L", num, nfs, -0.02)
        local ls = fit(self, "M", last, 40, -0.03, 340 - 2 * (nw + 7))
        local lastW = txt(self, r, "M", last, 195 + slide * 0.4, y + 42 + d, ls, -0.03, TEXT, 0.5)
        txt(self, r, "L", num, 195 + slide * 0.4 + lastW / 2 + 7, y + 42 + d - 0.697 * (ls - nfs), nfs, -0.02, MUTED)
        local slot = slotOf(lu, pv.n)
        local LINE_NAME: { [string]: string } = { GK = "Goalkeeper", DF = "Defender", MF = "Midfielder", FW = "Forward" }
        local role: string = "Player"
        if p and p.role ~= "" then role = p.role
        elseif slot > 0 then role = slotRole(lu.form, slot)
        elseif p then role = LINE_NAME[p.pos] or "Player" end
        txt(self, r, "R", role .. " · " .. tm.name, 195 + slide * 0.4, y + 66 + d, 13, 0, MUTED, 0.5)
        y += 92
        -- facts row
        d = block(1)
        hline(self, r, 18, y + d, 354)
        local cells: { { string } }
        if p and age(p) > 0 then
            cells = { { "Club", p.club }, { "Age", tostring(age(p)) }, { "Height", tostring(p.h) .. " cm" }, { "Shirt", "#" .. tostring(pv.n) } }
        else
            local pos = if p then ({ GK = "Keeper", DF = "Defence", MF = "Midfield", FW = "Attack" })[p.pos] or "—" else "—"
            cells = { { "Nation", tm.name }, { "Line", pos }, { "Shirt", "#" .. tostring(pv.n) } }
        end
        local cw = 354 / #cells
        for i, c in cells do
            local cx = 18 + (i - 1) * cw
            lab(self, r, c[1], cx + (if i == 1 then 0 else 10), y + 24 + d, MUTED)
            local vs = fit(self, "M", c[2], 15, 0, cw - 14)
            txt(self, r, "M", c[2], cx + (if i == 1 then 0 else 10), y + 47 + d, vs, 0, TEXT)
            if i > 1 then rect(self, r, cx, y + 12 + d, 1, 44, HAIR) end
        end
        y += 68
        hline(self, r, 18, y + d, 354)
        y += 30
        -- this match
        d = block(2)
        lab(self, r, "This match", 18, y + 10.5 + d, MUTED)
        if not st.played then
            local head, body
            if m.status == "ns" then
                head, body = "Not started", "Kick-off " .. m.time .. ". Line-ups are not out yet."
            elseif m.status == "live" then
                head, body = "On the bench", "He hasn't come on yet. His numbers will appear the moment he does."
            else
                head, body = "Unused substitute", "He didn't get on the pitch in this match."
            end
            lab(self, r, head, 372, y + 10.5 + d, TEXT, 1)
            y += 30
            glass(self, r, 18, y + d, 354, 74, 18)
            local ln = wrap(self, "R", body, 13.5, 0, 318)
            for i, s in ln do txt(self, r, "R", s, 36, y + 32 + d + (i - 1) * 19, 13.5, 0, MUTED) end
            y += 74 + 40
        else
            lab(self, r, tostring(st.mins) .. " min", 372, y + 10.5 + d, TEXT, 1)
            y += 30
            -- the rating stays the focus; what he did sits beside it as tags
            local tx0 = 116
            if st.rating > 0 then
                retarget(pv.rating, now, st.rating, 0.6, GLIDE)
                local rv = tv(pv.rating, now)
                local _, rfg = ratingInk(rv)
                ratingBox(self, r, rv, 18, y + d, 86, 56, 16)
                txt(self, r, "B", string.format("%.1f", rv), 61, bc(y + 24 + d, 24), 24, 0, rfg, 0.5)
                txt(self, r, "M", upper("Rating"), 61, y + 47 + d, 8.5, 0.14, rfg, 0.5)
            else
                tx0 = 18
            end
            local tags: { { any } } = {}
            if st.goals > 0 then table.insert(tags, { "g", st.goals, if st.goals == 1 then "1 goal" else tostring(st.goals) .. " goals" }) end
            if st.assists > 0 then table.insert(tags, { "a", st.assists, if st.assists == 1 then "1 assist" else tostring(st.assists) .. " assists" }) end
            if st.yc > 0 then table.insert(tags, { "y", 1, "Booked " .. minText(lu.yc[pv.n] or 0) }) end
            if lu.rc[pv.n] then table.insert(tags, { "r", 1, "Sent off " .. minText(lu.rc[pv.n] or 0) }) end
            local tx, ty = tx0, y + d + 14
            if #tags == 0 then
                txt(self, r, "R", "No goals or assists yet", tx, bc(y + 28 + d, 13), 13, 0, DIM)
            end
            for _, tg in tags do
                local label = tg[3] :: string
                local w = tw(self, "M", label, 12.5) + 38
                if tx + w > 372 then
                    tx = tx0
                    ty += 34
                end
                glass(self, r, tx, ty - 14, w, 28, 14)
                local kind = tg[1] :: string
                if kind == "g" then ball(self, r, tx + 15, ty, 8)
                elseif kind == "a" then bootTag(self, r, tx + 15, ty, 8)
                else cardTag(self, r, tx + 15, ty, 8, if kind == "y" then CARD else RED) end
                txt(self, r, "M", label, tx + 28, bc(ty, 12.5), 12.5, 0, TEXT)
                tx += w + 6
            end
            y += math.max(76, ty - (y + d) + 30)
            -- stat bars glide to the player's numbers (when they are known)
            d = block(3)
            local fill = hex(pastel(tm.c1))
            if not st.real then
                txt(self, r, "R", "Player numbers will show once the data has them.", 18, y + 12 + d, 13, 0, DIM)
                y += 30
            end
            local bars: { { any } } = if st.real then st.bars else {}
            for i, b in bars do
                local tb = pv.bars[i]
                retarget(tb, now, b[2] :: number, 0.7, GLIDE)
                local v = tv(tb, now)
                local mx = b[3] :: number
                txt(self, r, "R", b[1] :: string, 18, y + 12 + d, 13, 0, MUTED)
                local shown = string.format(b[4] :: string, math.floor(v + 0.5))
                txt(self, r, "M", shown, 372, y + 12 + d, 14, 0, TEXT, 1)
                rrect(self, r, 18, y + 22 + d, 354, 5, 2.5, hex(0xFFFFFF, 0.08))
                rrect(self, r, 18, y + 22 + d, math.max(5, 354 * math.clamp(v / mx, 0, 1)), 5, 2.5, fill)
                y += 46
            end
        end
        -- substituted: a red arrow and the minute, at the top of the page
        self.ga = oldGa * pageA * sw
        local offM, onM = lu.off[pv.n], lu.on[pv.n]
        if offM or onM then
            local s = if offM then "Off " .. tostring(offM) .. "'" else "On " .. tostring(onM) .. "'"
            local w = tw(self, "S", s, 12.5) + 40
            glass(self, r, 18, sy + 104, w, 30, 15, 0.7)
            subTag(self, r, 18 + 16, sy + 119, 8, offM ~= nil)
            txt(self, r, "S", s, 18 + 30, bc(sy + 119, 12.5), 12.5, 0, TEXT)
        end
        r:restore()
        self.playerScroll.max = math.max(0, y - sy + 40 - H)
        self.ga = oldGa * pageA

        -- the top bar turns to glass as he scrolls under it: the picture behind it frosts
        local barA = math.clamp(self.playerScroll.y / 50, 0, 1)
        if barA > 0.003 then
            r:save()
            clipRect(self, r, 0, 0, W, 96)
            self.ga = oldGa * pageA * barA
            backdrop()
            if photo then
                bigNumber(self, r, pv.n, 195 + slide * 0.5, sy + NUM_BASE, 16)
                frosted(self, r, p :: Person, HERO[1] + slide, HERO[2] + sy, HERO[3], HERO[4], sw)
            end
            rect(self, r, 0, 0, W, 96, hex(0x121212, 0.42))
            box(self, r, 0, 0, W, 96, stopsPaint(self, "barSheen", { { 0, 0xFFFFFF, 0.05 }, { 1, 0xFFFFFF, 0 } }, false))
            rect(self, r, 0, 95, W, 1, hex(0xFFFFFF, 0.14))
            r:restore()
            self.ga = oldGa * pageA
        end
        statusBar(self, r)
        if not self.desk then
            roundBtn(self, r, "pvBack", 14, 50, function() closePlayer(self) end)
            icon(self, r, "back", 14 + 15.5, 50 + 12, 1, TEXT, 1.6)
            btnClose(r)
        end
        local tl = upper(tm.name)
        local lw = labW(self, tl)
        crest(self, r, pv.team, 195 - lw / 2 - 12, 62, 16)
        lab(self, r, tl, 195 - lw / 2 + 12, bc(70, 10.5), TEXT)
        local fol = isFollowed(self, pv.team, pv.n)
        local tk, nn = pv.team, pv.n
        roundBtn(self, r, "pvFollow", 336, 50, function()
            if isFollowed(self, tk, nn) then unfollow(self) else followPlayer(self, tk, nn) end
        end)
        followIcon(self, r, 336 + 8, 50 + 8, fol)
        btnClose(r)
        -- previous / next team-mate
        local ay = 250 + sy
        local arrowA = 1 - math.clamp(self.playerScroll.y / 90, 0, 1)
        local oldA = self.ga
        self.ga = oldA * arrowA
        if arrowA > 0.02 then
            for _, dd0 in { -1, 1 } do
                local bx = if dd0 < 0 then 12 else 338
                local dd = dd0
                btnOpen(self, r, if dd0 < 0 then "pvPrev" else "pvNext", bx, ay, 40, 40, 20, function()
                    if arrowA > 0.5 then stepPlayer(self, dd) end
                end, 0.55)
                icon(self, r, if dd0 < 0 then "back" else "fwd", bx + (if dd0 < 0 then 16 else 17), ay + 12, 1, TEXT, 1.6)
                btnClose(r)
            end
        end
        self.ga = oldGa
    end
end


-- =====================================================================
-- OVERLAYS — goal and red card scenes, notifications, sign-in sheet
-- =====================================================================


do
    -- -----------------------------------------------------------------
    -- notification (goal or red card): glass, slim; the flag first, then
    -- the player rises in, then his name takes the team's place
    -- -----------------------------------------------------------------
    toastRect = function(self: Scoreline, now: number): (number, boolean)
        local ts = self.toast
        if ts.ev == nil then return -200, false end
        local t = now - ts.t
        if t < 0 then return -200, false end
        local T = tmOf(self, "toast")
        local y = TOAST.y - 120 * (1 - bez(T.c, prog(t, 0, T.dur))) + ts.dy
        if ts.outT >= 0 then
            local q = bez(IN, prog(now - ts.outT, 0, 0.32))
            y = lerp(ts.outFrom, -TOAST.h - 40, q)
            if q >= 1 then return -200, false end
        end
        return y, true
    end

    drawToast = function(self: Scoreline, r: Renderer, now: number)
        local ts = self.toast
        local ev = ts.ev
        if ev == nil then return end
        local y, vis = toastRect(self, now)
        if not vis then return end
        local m = findMatch(self, ts.m)
        if m == nil then return end
        local t = now - ts.t
        local T = tmOf(self, "toast")
        local team = sideTeam(m, ev.side)
        local tm = TEAMS[team]
        local red = ev.kind == "rc"
        local x0, w0, h0 = TOAST.x, TOAST.w, TOAST.h
        local pPhoto = bez(T.c, prog(t, T.delay, T.dur))
        local pName = bez(T.c, prog(t, T.delay + T.stagger, T.dur))
        local lit, _, tst = uiFeel(self, "toast", x0, y, w0, h0)
        glassPane(self, r, x0, y, w0, h0, 22, 1, lit, nil, tst.hx, tst.hy)
        r:save()
        r:transform(Mat2D.withTranslation(x0, y))
        r:clipPath(shape(self, w0, h0, 22, 22, 22, 22))
        r:transform(Mat2D.withTranslation(-x0, -y))
        softLight(self, r, x0, y, w0, h0, x0 + 30, y + h0, 150, 90, if red then 0xFF2D2D else tm.c1, if red then 0.5 else 0.55)
        -- the player: chest-up, rising from the bottom edge (the edge hides the cut)
        local p = person(team, ev.pn)
        local slotX, slotW = x0 + 12, 54
        if pPhoto > 0.001 then
            local old = self.ga
            self.ga = old * pPhoto
            if p ~= nil and hasPhoto(self, p) then
                local k = slotW / CROP.face[3]
                bust(self, r, p :: Person, { CROP.face[1], CROP.face[2], CROP.face[3], CROP.face[4] + 30 },
                    slotX, y + h0 - (CROP.face[4] - 14) * k + 30 * (1 - pPhoto), slotW, (CROP.face[4] + 30) * k)
            else
                kitDisc(self, r, team, ev.pn, slotX + slotW / 2, y + h0 / 2 + 20 * (1 - pPhoto), 20)
            end
            self.ga = old
        end
        r:restore()
        -- the rim goes over the photo: he stands inside the notification
        glassRim(self, r, x0, y, w0, h0, 22, lit, tst.hx, tst.hy)
        -- the flag (or the red card): big on arrival, then a badge on the photo
        local fs = lerp(36, 18, pPhoto)
        local fx = lerp(slotX + 8, slotX + slotW - 16, pPhoto)
        local fy = lerp(y + (h0 - 36) / 2, y + h0 - 25, pPhoto)
        if red then
            r:save()
            r:transform(Mat2D.withTranslation(fx + fs / 2, fy + fs / 2) * Mat2D.withRotation(0.2))
            rrect(self, r, -fs * 0.32, -fs * 0.46, fs * 0.64, fs * 0.92, fs * 0.1, RED)
            r:restore()
        else
            crest(self, r, team, fx, fy, fs)
        end
        -- text: team name first, then the player's name takes its place
        local tx = lerp(x0 + 60, x0 + 78, pPhoto)
        local kx = tx + lab(self, r, if red then "Red card" else "Goal", tx, y + 25, if red then RED else LIVE) + 8
        lab(self, r, minText(ev.min), kx, y + 25, MUTED)
        local old = self.ga
        self.ga = old * (1 - pName)
        txt(self, r, "S", tm.name, tx, y + 48 - 8 * pName, fit(self, "S", tm.name, 17, -0.01, 150), -0.01, TEXT)
        self.ga = old * pName
        txt(self, r, "S", ev.p, tx, y + 48 + 10 * (1 - pName), fit(self, "S", ev.p, 17, -0.01, 150), -0.01, TEXT)
        if isFollowed(self, team, ev.pn) then
            local nw = tw(self, "S", ev.p, fit(self, "S", ev.p, 17, -0.01, 150), -0.01)
            gstar(self, r, tx + nw + 9, y + 43 + 10 * (1 - pName), 5)
        end
        self.ga = old
        -- score
        local sx = x0 + w0 - 16
        crest(self, r, m.a, sx - 15, y + 17, 15)
        local s = scoreStr(m.hs, m.as)
        local sw = txt(self, r, "B", s, sx - 20, y + 29.5, 15, 0, TEXT, 1)
        crest(self, r, m.h, sx - 20 - sw - 20, y + 17, 15)
        local blockW = 15 + 5 + sw + 5 + 15
        lab(self, r, TEAMS[m.h].short .. " · " .. TEAMS[m.a].short, sx - blockW / 2, y + 51, DIM, 0.5)
        rrect(self, r, x0 + w0 / 2 - 14, y + h0 - 7, 28, 3, 1.5, hex(0xFFFFFF, 0.22))
    end

    -- -----------------------------------------------------------------
    -- goal scene: GOAAAL and the flag in the middle, then they rise to the
    -- top, the scorer comes up, then the commentary
    -- red card scene: the same story, told harder
    -- -----------------------------------------------------------------
    local FLOOR = 604
    local BUST_K = 1.05
    local BUST_SRC = { 14, 8, 260, 268 }

    -- the goal headline: letters a tenth of Dur apart, each lands in 0.72 Dur;
    -- the word holds in the middle for 1.2 Dur before it rises
    local function goalLetters(T: Timing): (number, number)
        return T.dur * 0.1, T.dur * 0.72
    end
    local function beats(self: Scoreline, kind: string?): (number, number, number, number)
        local T = tmOf(self, "goal")
        local up = T.delay + 5 * 0.06 + T.dur + 0.25        -- the headline rises (red card)
        if kind ~= "red" then
            local gap, land = goalLetters(T)
            up = T.delay + 5 * gap + land + T.dur * 1.2      -- the goal holds its moment
        end
        local s2 = up + T.dur * 0.45                        -- the player comes up
        local s3 = s2 + T.stagger                           -- the commentary
        return T.delay, up, s2, s3
    end
    sceneEnd = function(self: Scoreline): number
        local sc = self.scene
        local _, _, _, s3 = beats(self, if sc then sc.kind else "goal")
        return s3 + tmOf(self, "goal").dur + 1.4
    end

    -- GOAAAL: each letter comes in big and out of focus and lands sharp, one after
    -- another, while the whole word settles from a touch larger. When the last
    -- one lands, a soft flare blooms behind it and a glint crosses the letters.
    local LAND = C(0.12, 1, 0.3, 1)
    local GLINT_W = 440 -- the glint's width in font units
    local GLINT = { { 0, 0xFFFFFF, 0 }, { 0.3, 0xFFFFFF, 0.3 }, { 0.5, 0xFFFFFF, 0.75 }, { 0.7, 0xFFFFFF, 0.3 }, { 1, 0xFFFFFF, 0 } }
    local function shoutWord(self: Scoreline, r: Renderer, word: string, cx: number, base: number, size: number, t0: number, t: number, stops: { { number } }, key: string, base0: number, glow: number)
        local T = tmOf(self, "goal")
        local gap, land = goalLetters(T)
        local tp = textPath(self, "B", word, -0.02)
        size = math.min(size, (W - 64) * 1000 / (tp.adv - 20 * (#word - 1)))
        local k = size / 1000
        local wordW = (tp.adv - 20 * (#word - 1)) * k
        local midY = base - size * 0.35
        local landed = t0 + (#word - 1) * gap + land * 0.55
        -- the flare: light swells behind the word as it lands, then rests
        local fl = prog(t, landed - 0.1, 0.25) * (1 - 0.55 * ease(INOUT, t, landed + 0.15, 0.9))
        if fl > 0.01 then
            self.ga = base0
            softLight(self, r, 0, midY - 170, W, 340, cx, midY, 230 * (0.8 + 0.2 * fl), 130 * (0.8 + 0.2 * fl), glow, 0.55 * fl)
        end
        -- the word settles from a touch larger
        local ws = lerp(1.08, 1, bez(LAND, prog(t, t0, land + (#word - 1) * gap + T.dur)))
        r:save()
        r:transform(Mat2D.withTranslation(cx, midY) * Mat2D.withScale(ws, ws) * Mat2D.withTranslation(-cx, -midY))
        local gx = cx - wordW / 2
        local gp = prog(t, landed + 0.05, T.dur * 0.9)
        local adv = 0
        for i = 1, #word do
            local chr = string.sub(word, i, i)
            local g = self.fonts.B[chr]
            if g then
                local pL = bez(LAND, prog(t, t0 + (i - 1) * gap, land))
                if pL > 0.001 then
                    local sl = lerp(1.85, 1, pL)
                    local lx = gx + adv * k
                    local cxL = lx + g.adv * k / 2
                    local alpha = math.clamp(pL * 2.4, 0, 1)
                    local focus = math.clamp((pL - 0.3) / 0.6, 0, 1)
                    r:save()
                    r:transform(Mat2D.withTranslation(cxL, midY) * Mat2D.withScale(sl, sl) * Mat2D.withTranslation(-cxL, -midY))
                    r:transform(Mat2D.withTranslation(lx, base) * Mat2D.withScale(k, k))
                    if focus < 0.999 then
                        -- still arriving: soft, in the team's light (feather in font units)
                        self.ga = base0 * alpha * (1 - focus)
                        local fe = math.max(10, math.floor((1 - focus) * 14 / (k * sl) / 10 + 0.5) * 10)
                        r:drawPath(g.path, lookPaint(self, hex(glow), nil, fe))
                    end
                    if focus > 0.001 then
                        self.ga = base0 * alpha * focus
                        r:save()
                        r:clipPath(g.path)
                        r:save()
                        r:transform(Mat2D.withTranslation(-adv, -760) * Mat2D.withScale(tp.adv, 790))
                        r:drawPath(self.unit, stopsPaint(self, key, stops, true))
                        r:restore()
                        if gp > 0 and gp < 1 then
                            -- the glint, a slanted band of light crossing the whole word
                            self.ga = base0 * focus * math.sin(gp * math.pi)
                            local bx = lerp(-520, tp.adv + 520, gp) - adv
                            r:transform(Mat2D.withTranslation(bx, -380) * Mat2D.withRotation(0.32) * Mat2D.withTranslation(-GLINT_W / 2, -700) * Mat2D.withScale(GLINT_W, 1400))
                            r:drawPath(self.unit, stopsPaint(self, "glint", GLINT, true))
                        end
                        r:restore()
                    end
                    r:restore()
                end
                adv += g.adv - 20
            end
        end
        r:restore()
        self.ga = base0
    end

    -- a word of big letters, each slamming in; fill: stops across the whole word
    local function slamWord(self: Scoreline, r: Renderer, word: string, cx: number, base: number, size: number, t0: number, t: number, stops: { { number } }, key: string, base0: number)
        local T = tmOf(self, "goal")
        local tp = textPath(self, "B", word, -0.02)
        -- never wider than the screen
        size = math.min(size, (W - 44) * 1000 / (tp.adv - 20 * (#word - 1)))
        local k = size / 1000
        local wordW = (tp.adv - 20 * (#word - 1)) * k
        local gx = cx - wordW / 2
        local adv = 0
        for i = 1, #word do
            local chr = string.sub(word, i, i)
            local g = self.fonts.B[chr]
            if g then
                local pL = bez(T.c, prog(t, t0 + (i - 1) * 0.06, T.dur))
                if pL > 0.001 then
                    local sl = lerp(1.4, 1, pL)
                    local lx = gx + adv * k
                    local cxL = lx + g.adv * k / 2
                    self.ga = base0 * math.clamp(pL * 1.8, 0, 1)
                    r:save()
                    r:transform(Mat2D.withTranslation(cxL, base - size * 0.35) * Mat2D.withScale(sl, sl) * Mat2D.withTranslation(-cxL, -(base - size * 0.35)))
                    r:transform(Mat2D.withTranslation(lx, base) * Mat2D.withScale(k, k))
                    r:clipPath(g.path)
                    r:transform(Mat2D.withTranslation(-adv, -760) * Mat2D.withScale(tp.adv, 790))
                    r:drawPath(self.unit, stopsPaint(self, key, stops, true))
                    r:restore()
                end
                adv += g.adv - 20
            end
        end
        self.ga = base0
    end

    -- the player rising behind the floor, his name, the line under it and the commentary
    local function sceneStory(self: Scoreline, r: Renderer, m: Match, ev: Event, team: string, t: number, s2: number, s3: number, base: number, red: boolean)
        local T = tmOf(self, "goal")
        local pB = bez(T.c, prog(t, s2, T.dur))
        local pp = person(team, ev.pn)
        r:save()
        clipRect(self, r, 0, 0, W, FLOOR)
        if pB > 0.001 then
            self.ga = base * math.clamp(pB * 1.6, 0, 1)
            local dw, dh = BUST_SRC[3] * BUST_K, BUST_SRC[4] * BUST_K
            local lift = 60 * (1 - pB)
            if pp ~= nil and hasPhoto(self, pp) then
                bust(self, r, pp :: Person, BUST_SRC, 195 - dw / 2, FLOOR - dh + lift, dw, dh)
            else
                kitDisc(self, r, team, ev.pn, 195, FLOOR - 110 + lift, 84)
            end
            self.ga = base
        end
        r:restore()
        local stops = matchStops(m)
        rect(self, r, 0, FLOOR, W, H - FLOOR, BG)
        local pF = bez(T.c, prog(t, s2, T.dur))
        if red then
            box(self, r, 0, FLOOR, W * pF, 2, stopsPaint(self, "redline", { { 0, 0xFF2D2D }, { 1, 0x8E0A10 } }, true))
        else
            box(self, r, 0, FLOOR, W * pF, 2, stopsPaint(self, "fl" .. tostring(m.id), stops, true))
        end
        local pN = bez(T.c, prog(t, s2 + 0.12, T.dur))
        self.ga = base * pN
        local nameY = 18 * (1 - pN)
        local first = if pp then (pp :: Person).first else ""
        local last = if pp then (pp :: Person).last else ev.p
        if first ~= "" then txt(self, r, "R", first, 18, FLOOR + 36 + nameY, 16, 0, MUTED) end
        local ls = fit(self, "S", last, 40, -0.03, 354)
        txt(self, r, "S", last, 18, FLOOR + 76 + nameY, ls, -0.03, TEXT)
        local mx = 18
        local mb = FLOOR + 100 + nameY
        mx += lab(self, r, minText(ev.min), mx, mb, if red then RED else LIVE) + 8
        if red then
            mx += lab(self, r, "·", mx, mb, MUTED) + 8
            mx += lab(self, r, "Sent off", mx, mb, RED) + 8
        elseif ev.o ~= "" then
            mx += lab(self, r, "·", mx, mb, MUTED) + 8
            mx += lab(self, r, "Assist " .. ev.o, mx, mb, MUTED) + 8
        end
        if isFollowed(self, team, ev.pn) then
            mx += lab(self, r, "·", mx, mb, MUTED) + 8
            gstar(self, r, mx + 5, mb - 4, 5)
            lab(self, r, "Your player", mx + 14, mb, TEXT)
        end
        self.ga = base
        local pC = bez(T.c, prog(t, s3, T.dur))
        if pC > 0.001 then
            self.ga = base * pC
            local cy = FLOOR + 124 + 10 * (1 - pC)
            rect(self, r, 18, cy, 18, 2, if red then RED else TEXT)
            lab(self, r, "Commentary", 46, cy + 4, MUTED)
            local text = if ev.txt ~= "" then ev.txt else commentary(m, ev)
            local lines = wrap(self, "R", text, 15, -0.005, 354)
            local words = 0
            for _, ln in lines do
                for _ in string.gmatch(ln, "%S+") do words += 1 end
            end
            local shown = math.floor(words * prog(t, s3 + 0.1, 1.4) + 0.999)
            local cnt = 0
            for li, ln in lines do
                local parts: { string } = {}
                for wd in string.gmatch(ln, "%S+") do
                    cnt += 1
                    if cnt <= shown then table.insert(parts, wd) end
                end
                if #parts > 0 and li <= 4 then
                    txt(self, r, "R", table.concat(parts, " "), 18, cy + 30 + (li - 1) * 21, 15, -0.005, TEXT)
                end
            end
            self.ga = base
        end
    end

    -- the score strip, top right; on a goal the new digit rolls in
    local function scoreStrip(self: Scoreline, r: Renderer, m: Match, ev: Event, sp: number, rolls: boolean)
        local hs, as = 0, 0
        for _, g in m.events do
            if g.kind == "goal" and (g.min < ev.min or g == ev or (g.min == ev.min and g.id <= ev.id)) then
                if g.side == "h" then hs += 1 else as += 1 end
            end
        end
        if not rolls then hs, as = m.hs, m.as end
        local homeGoal = rolls and ev.side == "h"
        local awayGoal = rolls and ev.side == "a"
        local mid = 72
        local function digit(prev: number, cur: number, roll: boolean, right: number): number
            local ps, ns2 = tostring(prev), tostring(cur)
            local dw = math.max(tw(self, "M", ps, 22), tw(self, "M", ns2, 22))
            local off = if roll then -26 * sp else -26
            r:save()
            clipRect(self, r, right - dw - 2, mid - 15, dw + 4, 30)
            if roll then txt(self, r, "M", ps, right, mid + 7.7 + off, 22, 0, TEXT, 1) end
            txt(self, r, "M", ns2, right, mid + 7.7 + 26 + off, 22, 0, TEXT, 1)
            r:restore()
            return dw
        end
        local x = 318
        crest(self, r, m.a, x - 18, mid - 9, 18)
        x -= 18 + 8
        local aw = digit(if awayGoal then as - 1 else as, as, awayGoal, x)
        x -= aw + 6
        local dw2 = txt(self, r, "L", "–", x, mid + 7, 22, 0, DIM, 1)
        x -= dw2 + 6
        local hw = digit(if homeGoal then hs - 1 else hs, hs, homeGoal, x)
        x -= hw + 8
        crest(self, r, m.h, x - 18, mid - 9, 18)
    end

    local function goalScene(self: Scoreline, r: Renderer, m: Match, ev: Event, t: number, base: number)
        local T = tmOf(self, "goal")
        local team = sideTeam(m, ev.side)
        local tm = TEAMS[team]
        local s1, up, s2, s3 = beats(self, "goal")
        local u = bez(T.c, prog(t, up, T.dur))              -- 0 centre stage, 1 at the top
        -- the stage behind the scorer
        self.ga = base * bez(T.c, prog(t, s1, T.dur))
        softLight(self, r, 0, 120, W, FLOOR - 120, 195, lerp(380, FLOOR - 120, u), 330, 320, tm.c1, 0.6)
        -- the wall behind him: four cards in the match's colours, like tonight's
        -- live cards. They rise one after another (Dur, a stagger of their own)
        -- and land hard, a flash running along their top edge.
        local stops = matchStops(m)
        local CH = { 0.74, 0.94, 1, 0.84 }
        local gapW = 6
        local cw4 = (W - 24 - 3 * gapW) / 4
        for i = 0, 3 do
            local at = s2 - 0.2 + i * T.dur * 0.11
            local q = prog(t, at, T.dur * 0.75)
            if q > 0 then
                local rise = bez(LAND, q)
                local hh = CH[i + 1] * 320
                local x = 12 + i * (cw4 + gapW)
                local top = FLOOR - hh * rise
                self.ga = base * 0.94
                box(self, r, x, top, cw4, hh, stopsPaint(self, "wall" .. tostring(m.id), stops, false))
                box(self, r, x, top, cw4, hh * 0.45, stopsPaint(self, "wallSheen", { { 0, 0xFFFFFF, 0.22 }, { 1, 0xFFFFFF, 0 } }, false))
                -- the landing: a flash along the top edge, gone in a moment
                local lt = t - at - T.dur * 0.75 * 0.22
                local fl = if lt > -0.08 then math.exp(-(lt / 0.16) ^ 2) else 0
                if fl > 0.01 then
                    self.ga = base * fl
                    box(self, r, x, top, cw4, 46, stopsPaint(self, "wallFlash", { { 0, 0xFFFFFF, 0.85 }, { 1, 0xFFFFFF, 0 } }, false))
                end
            end
        end
        self.ga = base
        sceneStory(self, r, m, ev, team, t, s2, s3, base, false)
        -- the headline: flag over GOAAAL in the middle, then both rise to the top
        local pF = bez(T.c, prog(t, s1, T.dur))
        local fsz = lerp(64, 40, u)
        local fcx, fcy = lerp(195, 38, u), lerp(318, 72, u)
        self.ga = base * pF
        r:save()
        r:transform(Mat2D.withTranslation(fcx, fcy) * Mat2D.withScale(lerp(0.6, 1, pF), lerp(0.6, 1, pF)))
        crest(self, r, team, -fsz / 2, -fsz / 2, fsz)
        r:restore()
        local gs = { { 0, pastel(tm.c1) }, { 0.55, pastel(mix(tm.c2, 0xF7F2EA, 0.25)) }, { 1, pastel(tm.c1) } }
        shoutWord(self, r, "GOAAAL", 195, lerp(436, 196, u), lerp(104, 72, u), s1, t, gs, "goal" .. tm.key, base, pastel(tm.c1))
        -- once at the top: who scored, and the score
        local pTop = bez(T.c, prog(t, up + T.dur * 0.3, T.dur))
        self.ga = base * pTop
        txt(self, r, "S", tm.name, 68, 70, 17, -0.01, TEXT)
        lab(self, r, "Scores · " .. minText(ev.min), 68, 88, MUTED)
        scoreStrip(self, r, m, ev, bez(T.c, prog(t, s3, T.dur)), true)
        self.ga = base
        -- team colour flash on arrival
        local fa = 0.85 * (1 - ease(EASE, t, 0, 0.55))
        if fa > 0.001 then rect(self, r, 0, 0, W, H, Color.opacity(hex(tm.c1), fa)) end
    end

    local function redScene(self: Scoreline, r: Renderer, m: Match, ev: Event, t: number, base: number)
        local T = tmOf(self, "goal")
        local team = sideTeam(m, ev.side)
        local tm = TEAMS[team]
        local _, up, s2, s3 = beats(self, "red")
        local u = bez(T.c, prog(t, up, T.dur))
        -- shake: hard on the hit, then gone
        local hitT = 0.3
        local sh = if t > hitT and t < hitT + 0.7 then 11 * math.exp(-(t - hitT) * 7) else 0
        local jx, jy = sh * math.sin(t * 93), sh * math.cos(t * 71)
        push(self, r, jx, jy)
        -- a deep red stage
        softLight(self, r, 0, 0, W, FLOOR, 195, 340, 360, 420, 0xB3141B, 0.75 * (1 - 0.35 * u))
        -- slashes that tear across on the hit
        for i = 0, 2 do
            local q = prog(t, hitT + i * 0.06, 0.38)
            if q > 0 and q < 1 then
                local sx = lerp(-260, W + 40, bez(GLIDE, q))
                self.ga = base * 0.55 * (1 - q)
                r:save()
                r:transform(Mat2D.withTranslation(sx, 160 + i * 120) * Mat2D.withRotation(-0.38))
                rect(self, r, 0, 0, 260, 5 - i, hex(0xFF2D2D))
                r:restore()
            end
        end
        self.ga = base
        sceneStory(self, r, m, ev, team, t, s2, s3, base, true)
        -- the card: slams in huge and spinning, lands, then flies to the top corner
        local pIn = bez(C(0.5, 0, 0.9, 0.6), prog(t, 0.02, hitT))
        if pIn > 0.001 then
            local sc = lerp(lerp(2.8, 1, pIn), 0.22, u)
            local rot = lerp(lerp(-0.9, -0.16, pIn), -0.08, u)
            local ccx, ccy = lerp(195, 30, u), lerp(316, 72, u)
            self.ga = base * math.clamp(pIn * 2, 0, 1)
            r:save()
            r:transform(Mat2D.withTranslation(ccx, ccy) * Mat2D.withRotation(rot) * Mat2D.withScale(sc, sc))
            rrect(self, r, -75 + 6, -107 + 10, 150, 214, 16, hex(0x000000, 0.45))
            rbox(self, r, -75, -107, 150, 214, 16, stopsPaint(self, "redcardBig", { { 0, 0xFF4B3E }, { 0.55, 0xE01A22 }, { 1, 0x9C0C12 } }, false))
            rbox(self, r, -75, -107, 150, 90, 16, stopsPaint(self, "redcardGloss", { { 0, 0xFFFFFF, 0.28 }, { 1, 0xFFFFFF, 0 } }, false))
            rrect(self, r, -74.5, -106.5, 149, 213, 15.5, hex(0xFFFFFF, 0.35), 1)
            r:restore()
        end
        -- RED CARD: letters slam in after the hit, then rise to the top with the card
        slamWord(self, r, "RED CARD", 195, lerp(500, 196, u), lerp(70, 56, u), hitT + 0.12, t,
            { { 0, 0xFF6A5E }, { 0.5, 0xFF2D2D }, { 1, 0xC2101A } }, "redword", base)
        local pTop = bez(T.c, prog(t, up + T.dur * 0.3, T.dur))
        self.ga = base * pTop
        crest(self, r, team, 60, 61, 22)
        txt(self, r, "S", tm.name, 90, 70, 17, -0.01, TEXT)
        lab(self, r, "Down to ten · " .. minText(ev.min), 90, 88, MUTED)
        scoreStrip(self, r, m, ev, 1, false)
        self.ga = base
        pop(self, r)
        -- red strobes: the hit, and twice more
        local fa = 0.9 * math.max(1 - ease(EASE, t, 0, 0.18), 0.85 * (1 - ease(EASE, t, hitT, 0.4)), 0.45 * (1 - ease(EASE, t, hitT + 0.22, 0.25)))
        if t < hitT and t > 0.18 then fa = 0 end
        if fa > 0.001 then rect(self, r, 0, 0, W, H, hex(0xFF1E1E, fa)) end
    end

    drawScene = function(self: Scoreline, r: Renderer, now: number)
        local sc = self.scene
        if sc == nil then return end
        local m = findMatch(self, sc.m)
        if m == nil then return end
        local t = now - sc.t0
        local out = if sc.outT > 0 then now - sc.outT else -1
        local bgA = ease(LINEAR, t, 0, 0.2) * (if out >= 0 then 1 - prog(out, 0, 0.4) else 1)
        if bgA <= 0 then return end
        local oldGa = self.ga
        local base = oldGa * bgA
        self.ga = base
        rect(self, r, 0, 0, W, H, BG)
        hit(self, 0, 0, W, H, function() tapScene(self) end)
        if sc.kind == "red" then redScene(self, r, m, sc.ev, t, base) else goalScene(self, r, m, sc.ev, t, base) end
        self.ga = base
        roundBtn(self, r, "sceneClose", 336, 50, function() closeScene(self) end)
        icon(self, r, "close", 336 + 14, 50 + 14, 1, TEXT, 1.6)
        btnClose(r)
        self.ga = oldGa
    end

    -- -----------------------------------------------------------------
    -- sign-in sheet: the live cards' colours on top, glass buttons below
    -- -----------------------------------------------------------------
    drawSheet = function(self: Scoreline, r: Renderer, now: number)
        local t = now - self.sheetT
        local p: number
        if self.sheetOpen then
            p = ease(GLIDE, t, 0, 0.6)
        else
            p = 1 - ease(EASE, t, 0, 0.45)
        end
        if p <= 0.001 then return end
        push(self, r, 0, H * (1 - p))
        rect(self, r, 0, 0, W, H, BG)
        hit(self, 0, 0, W, H, function() end)
        lab(self, r, "Account", 22, bc(74, 10.5), MUTED)
        roundBtn(self, r, "sheetClose", 328, 54, function() closeSheet(self) end)
        icon(self, r, "close", 328 + 14, 54 + 14, 1, TEXT, 1.6)
        btnClose(r)
        r:save()
        clipRect(self, r, 0, 120, W, 170)
        -- the same pastel bars as tonight's live matches
        local live: { Match } = {}
        for _, m in self.matches do
            if m.status == "live" or m.status == "ft" then table.insert(live, m) end
        end
        if #live == 0 then live = self.matches end
        local hs = { 120, 150, 170, 130, 160, 110, 140 }
        local mt = { 40, 14, 0, 30, 6, 50, 22 }
        local bw = W / 7
        local openT = if self.sheetOpen then self.sheetT else -100
        for i = 1, 7 do
            local rise = 340 * (1 - ease(GLIDE, now, openT + 0.12 + (i - 1) * 0.05, 0.9))
            local m = live[((i - 1) % #live) + 1]
            box(self, r, (i - 1) * bw, 120 + mt[i] + rise, bw + 0.5, hs[i], stopsPaint(self, "m" .. tostring(m.id) .. "h0", matchStops(m), false))
        end
        r:restore()
        local lines = wrap(self, "R", "Sign in to follow your clubs.", 40, -0.05, 346)
        for i, ln in lines do
            txt(self, r, "R", ln, 22, 320 + 33.9 + (i - 1) * 40, 40, -0.05, TEXT)
        end
        local y = 320 + 40 * #lines + 14
        local body = "Save your favourite teams and players, get a goal alert the second it lands, and keep your matchday in sync on every device."
        for i, ln in wrap(self, "R", body, 14, 0, 346) do
            txt(self, r, "R", ln, 22, y + 15.9 + (i - 1) * 21.7, 14, 0, MUTED)
        end
        -- the two buttons as they were: solid white, then an outline. A click dips
        -- them a little and the light follows the cursor; the labels stay still.
        local function plainBtn(id: string, y: number, primary: boolean, label: string)
            local lit, pk, st = uiFeel(self, id, 22, y, 346, 52)
            local sc = 1 - 0.03 * pk
            local l = math.max(lit, pk * 0.7)
            r:save()
            r:transform(Mat2D.withTranslation(195, y + 26) * Mat2D.withScale(sc, sc) * Mat2D.withTranslation(-195, -(y + 26)))
            r:save()
            r:transform(Mat2D.withTranslation(22, y))
            local sh = shape(self, 346, 52, 26, 26, 26, 26)
            if primary then
                r:drawPath(sh, paint(self, TEXT))
                if l > 0.003 then r:drawPath(sh, spotLook(self, st.hx, st.hy, 78, 0.9 * l)) end
            else
                if l > 0.003 then r:drawPath(sh, spotLook(self, st.hx, st.hy, 78, 0.1 * l)) end
                r:transform(Mat2D.withTranslation(0.5, 0.5))
                local rim = shape(self, 345, 51, 25.5, 25.5, 25.5, 25.5)
                r:drawPath(rim, paint(self, hex(0xFFFFFF, 0.22), 1))
                if l > 0.003 then r:drawPath(rim, spotLook(self, st.hx - 0.5, st.hy - 0.5, 90, 0.5 * l, 1)) end
            end
            r:restore()
            txt(self, r, "S", label, 195, bc(y + 26, 15), 15, 0, if primary then BG else TEXT, 0.5)
            r:restore()
            hit(self, 22, y, 346, 52, function() closeSheet(self) end, id)
        end
        plainBtn("signEmail", 627.5, true, "Continue with email")
        plainBtn("signPhone", 689.5, false, "Continue with phone number")
        local np = pressOf(self, "signLater", 140, 755.5, 110, 30)
        local old = self.ga
        self.ga = old * (1 - 0.4 * np)
        txt(self, r, "M", "Not now", 195, bc(770.6, 14), 14, 0, MUTED, 0.5)
        self.ga = old
        hit(self, 140, 755.5, 110, 30, function() closeSheet(self) end, "signLater")
        txt(self, r, "R", "Prototype screen. Nothing is sent or stored.", 195, bc(802.9, 11), 11, 0, DIM, 0.5)
        pop(self, r)
    end
end


-- =====================================================================
-- DESKTOP — three glass panes on one artboard: the matches, the open
-- match, and a third pane for the player, every table, or tonight's
-- leaders. The phone's screens are reused as they are; only this part
-- is the desktop's own.
-- =====================================================================
do
    local DESK_TABS = { "Player", "Tables", "Leaders" }
    local SEG_X, SEG_Y, SEG_W, SEG_H = 45, 12, 300, 36
    local RAD = 30

    local function paneOpen(self: Scoreline, r: Renderer, key: string)
        local o = PANES[key]
        push(self, r, o[1], o[2])
        r:save()
        r:clipPath(shape(self, W, H, RAD, RAD, RAD, RAD))
        self.clipTop, self.clipBot = o[2], o[2] + H
        self.clipL, self.clipR = o[1], o[1] + W
    end
    local function paneClose(self: Scoreline, r: Renderer)
        r:restore()
        glassRim(self, r, 0, 0, W, H, RAD)
        pop(self, r)
        self.clipTop, self.clipBot, self.clipL, self.clipR = 0, self.ah, 0, self.aw
    end

    local function setDeskTab(self: Scoreline, i: number)
        if i == self.deskTab then return end
        local now = nowOf(self)
        self.deskTab, self.deskTabT = i, now
        retargetS(self, self.deskTabK, now, i - 1, "tabs")
        self.insightScroll.y, self.insightScroll.v = 0, 0
    end

    -- the third pane's switch: glass, the chosen one on our spectrum
    local function deskSwitch(self: Scoreline, r: Renderer, now: number)
        local k = tv(self.deskTabK, now)
        local seg = (SEG_W - 8) / 3
        glass(self, r, SEG_X, SEG_Y, SEG_W, SEG_H, SEG_H / 2)
        rbox(self, r, SEG_X + 4 + k * seg, SEG_Y + 4, seg, SEG_H - 8, (SEG_H - 8) / 2, gradPaint(self, 2, true))
        for i, label in DESK_TABS do
            local sx = SEG_X + 4 + (i - 1) * seg
            local id = "desk" .. tostring(i)
            local lit, pk, st = uiFeel(self, id, sx, SEG_Y, seg, SEG_H)
            local on = math.clamp(1 - math.abs(k - (i - 1)), 0, 1)
            if lit * (1 - on) > 0.01 then
                r:save()
                r:transform(Mat2D.withTranslation(sx, SEG_Y + 4))
                r:drawPath(shape(self, seg, SEG_H - 8, 14, 14, 14, 14), spotLook(self, st.hx, st.hy - 4, spotR(seg, SEG_H), 0.1 * lit * (1 - on)))
                r:restore()
            end
            local cx, cy = sx + seg / 2, SEG_Y + SEG_H / 2
            local sc = 1 - 0.04 * pk
            r:save()
            r:transform(Mat2D.withTranslation(cx, cy) * Mat2D.withScale(sc, sc) * Mat2D.withTranslation(-cx, -cy))
            local c = Color.lerp(Color.lerp(MUTED, TEXT, 0.6 * lit), INK, on)
            rollTxt(self, r, "S", label, cx, bc(cy, 13), 13, 0, c, 0.5, now - st.rollT)
            r:restore()
            local ii = i
            hit(self, sx, SEG_Y, seg, SEG_H, function() setDeskTab(self, ii) end, id)
        end
    end

    -- a section heading: left label, right label
    local function head(self: Scoreline, r: Renderer, left: string, right: string, y: number): number
        lab(self, r, left, 18, y + 10.5, MUTED)
        if right ~= "" then lab(self, r, right, 372, y + 10.5, TEXT, 1) end
        return y + 13.7 + 14
    end

    -- the pane's frame for tables and leaders: black, a title, a scrolled body
    local function insightOpen(self: Scoreline, r: Renderer, title: string): number
        rect(self, r, 0, 0, W, H, BG)
        hit(self, 0, 0, W, H, function() end)
        lab(self, r, title, 195, bc(70, 10.5), MUTED, 0.5)
        r:save()
        clipRect(self, r, 0, DETAIL_TOP, W, H - DETAIL_TOP)
        self.clipTop = self.oy + DETAIL_TOP
        return DETAIL_TOP + 10 - self.insightScroll.y
    end
    local function insightClose(self: Scoreline, r: Renderer, y0: number, y: number)
        r:restore()
        self.clipTop = self.oy
        self.insightScroll.max = math.max(0, y - y0 + 40 - (H - DETAIL_TOP))
        -- the body slides under a hairline as it scrolls
        local a = math.clamp(self.insightScroll.y / 30, 0, 1)
        if a > 0.01 then rect(self, r, 18, DETAIL_TOP - 1, 354, 1, hex(0xFFFFFF, 0.1 * a)) end
    end

    -- -----------------------------------------------------------------
    -- TABLES: every league, the open match's first, its two teams lit
    -- -----------------------------------------------------------------
    local function drawTables(self: Scoreline, r: Renderer, now: number)
        local y0 = insightOpen(self, r, "Standings")
        local y = y0
        local m = findMatch(self, self.openId)
        local order: { string } = {}
        if m ~= nil and #LEAGUES[m.lg].teams > 0 then table.insert(order, m.lg) end
        for _, lg in LEAGUE_ORDER do
            local L = LEAGUES[lg]
            if L ~= nil and #L.teams > 0 and table.find(order, lg) == nil then table.insert(order, lg) end
        end
        if #order == 0 then
            txt(self, r, "R", "No tables tonight.", 195, y + 120, 20, -0.02, MUTED, 0.5)
            lab(self, r, "Friendlies don't have one", 195, y + 146, DIM, 0.5)
            y += 200
        end
        for i, lg in order do
            local L = LEAGUES[lg]
            local p = anim(self, "list", now, self.deskTabT, i - 1)
            local old = self.ga
            self.ga = old * p
            push(self, r, 0, 12 * (1 - p))
            y = head(self, r, L.country .. " · " .. L.name, "Matchday " .. tostring(L.md), y)
            y = leagueRows(self, r, lg, if m then m.h else "", if m then m.a else "", y, now, self.deskTabT + 0.06 * (i - 1))
            pop(self, r)
            self.ga = old
            y += 36
        end
        insightClose(self, r, y0, y)
    end

    -- -----------------------------------------------------------------
    -- LEADERS: tonight's best rated players, then every goal tonight
    -- -----------------------------------------------------------------
    type Lead = { m: Match, side: string, n: number, rating: number }
    local LEAD: { list: { Lead }, t: number } = { list = {}, t = -100 }
    local function leaders(self: Scoreline, now: number): { Lead }
        if now - LEAD.t < 1 and #LEAD.list > 0 then return LEAD.list end
        local list: { Lead } = {}
        for _, m in self.matches do
            if m.status ~= "ns" and m.day == 1 then
                for _, side in { "h", "a" } do
                    local lu = m.lu[side]
                    local all: { number } = table.clone(lu.xi)
                    for _, n in lu.bench do table.insert(all, n) end
                    for _, n in all do
                        local st = playerStats(m, side, n)
                        if st.played and st.real and st.rating > 0 then table.insert(list, { m = m, side = side, n = n, rating = st.rating }) end
                    end
                end
            end
        end
        table.sort(list, function(a: Lead, b: Lead): boolean return a.rating > b.rating end)
        LEAD.list, LEAD.t = list, now
        return list
    end

    local function leaderRow(self: Scoreline, r: Renderer, i: number, it: Lead, y: number, p: number)
        local m, side, n = it.m, it.side, it.n
        local lu = m.lu[side]
        local team = lu.team
        local pp = person(team, n)
        local st = playerStats(m, side, n)
        local id = "ld" .. team .. tostring(n)
        local pk, lit = pressOf(self, id, 12, y, 366, 64)
        local old = self.ga
        self.ga = old * p
        if lit + pk > 0.01 then rrect(self, r, 12, y + 2, 366, 60, 14, hex(0xFFFFFF, 0.03 * lit + 0.05 * pk)) end
        push(self, r, 0, 10 * (1 - p))
        if inView(self, y - 2, 68) then
            local cy = y + 32
            txt(self, r, "M", tostring(i), 30, bc(cy, 13), 13, 0, if i <= 3 then TEXT else DIM, 0.5)
            photoTile(self, r, pp, team, n, 46, y + 6, 52)
            local nm = if pp then fullName(pp :: Person) else nameOf(team, n)
            local nw = txt(self, r, "S", nm, 110, bc(cy - 8, 15), fit(self, "S", nm, 15, 0, 150), 0, TEXT)
            local fx = 110 + nw + 8
            if isFollowed(self, team, n) then
                gstar(self, r, fx + 5, cy - 8, 5)
                fx += 16
            end
            eventTags(self, r, lu, n, fx, cy - 8, 0, 7)
            local opp = TEAMS[sideTeam(m, otherSide(side))]
            crest(self, r, team, 110, cy + 4, 13)
            txt(self, r, "R", "vs " .. opp.name .. " · " .. minLabel(m), 129, bc(cy + 11, 12), fit(self, "R", "vs " .. opp.name .. " · " .. minLabel(m), 12, 0, 170), 0, MUTED)
            ratingTag(self, r, st.rating, 372, cy, i == 1, 1, 12)
        end
        pop(self, r)
        self.ga = old
        if inView(self, y + 50, 16) then
            hline(self, r, 110, y + 63, 262)
        end
        local mid, tk, nn = m.id, team, n
        hit(self, 12, y, 366, 64, function()
            openMatch(self, mid)
            openPlayer(self, tk, nn, nil)
        end, id)
    end

    -- a goal tonight: minute, scorer, his side, the score it made (opens the goal again)
    local function goalRow(self: Scoreline, r: Renderer, m: Match, e: Event, y: number, p: number)
        local id = "lg" .. tostring(m.id) .. "|" .. tostring(e.id)
        local pk, lit = pressOf(self, id, 12, y, 366, 52)
        local old = self.ga
        self.ga = old * p
        if lit + pk > 0.01 then rrect(self, r, 12, y + 2, 366, 48, 14, hex(0xFFFFFF, 0.03 * lit + 0.05 * pk)) end
        push(self, r, 0, 8 * (1 - p))
        if inView(self, y - 2, 56) then
            local cy = y + 26
            local team = sideTeam(m, e.side)
            txt(self, r, "M", minText(e.min), 18, bc(cy, 13), 13, 0, TEXT)
            ball(self, r, 70, cy, 8)
            local nw = txt(self, r, "S", e.p, 88, bc(cy - 7, 14), fit(self, "S", e.p, 14, 0, 170), 0, TEXT)
            if isFollowed(self, team, e.pn) then gstar(self, r, 88 + nw + 9, cy - 7, 4.6) end
            crest(self, r, team, 88, cy + 5, 12)
            txt(self, r, "R", TEAMS[m.h].short .. " – " .. TEAMS[m.a].short, 105, bc(cy + 11, 11.5), 11.5, 0, MUTED)
            -- the score it made, in the match colours
            local sw = tw(self, "B", e.s, 12.5) + 20
            rbox(self, r, 372 - sw, cy - 11, sw, 22, 11, stopsPaint(self, "chip" .. tostring(m.id), matchStops(m), true))
            txt(self, r, "B", e.s, 372 - sw / 2, bc(cy, 12.5), 12.5, 0, INK, 0.5)
        end
        pop(self, r)
        self.ga = old
        if inView(self, y + 50, 16) then
            hline(self, r, 88, y + 51, 284)
        end
        local mid, ref = m.id, e
        hit(self, 12, y, 366, 52, function()
            local mm = findMatch(self, mid)
            if mm == nil then return end
            openMatch(self, mid)
            openScene(self, mm, ref, "goal")
        end, id)
    end

    local function drawLeaders(self: Scoreline, r: Renderer, now: number)
        local y0 = insightOpen(self, r, "Tonight")
        local y = y0
        local list = leaders(self, now)
        y = head(self, r, "Top rated", if #list > 0 then "Live ratings" else "", y)
        if #list == 0 then
            txt(self, r, "R", "Nobody has played yet.", 18, y + 26, 17, -0.01, MUTED)
            y += 52
        end
        for i = 1, math.min(#list, 8) do
            leaderRow(self, r, i, list[i], y, anim(self, "squad", now, self.deskTabT, i - 1))
            y += 64
        end
        y += 30
        -- every goal tonight, the latest first
        local goals: { { m: Match, e: Event } } = {}
        for _, m in self.matches do
            if m.day == 1 and m.status ~= "ns" then
                for _, e in goalsOf(m) do table.insert(goals, { m = m, e = e }) end
            end
        end
        table.sort(goals, function(a: { m: Match, e: Event }, b: { m: Match, e: Event }): boolean
            local ea, eb = a.e, b.e
            if ea.t0 ~= eb.t0 then return ea.t0 > eb.t0 end
            return ea.min > eb.min
        end)
        y = head(self, r, "Goals tonight", tostring(#goals), y)
        if #goals == 0 then
            txt(self, r, "R", "No goals yet.", 18, y + 26, 17, -0.01, MUTED)
            y += 52
        end
        for i, g in goals do
            if i > 14 then break end
            goalRow(self, r, g.m, g.e, y, anim(self, "squad", now, self.deskTabT, i + 7))
            y += 52
        end
        insightClose(self, r, y0, y)
    end

    -- the third pane: player, tables or leaders, then the switch over them
    local function drawThird(self: Scoreline, r: Renderer, now: number)
        local fade = anim(self, "tabs", now, self.deskTabT, 0)
        local old = self.ga
        self.ga = old * fade
        local t = self.deskTab
        if t == 1 then
            rect(self, r, 0, 0, W, H, BG)
            if findMatch(self, self.pv.mid) ~= nil then
                drawPlayerView(self, r, now)
            else
                txt(self, r, "R", "Pick a player.", 195, 400, 20, -0.02, MUTED, 0.5)
                lab(self, r, "Tap anyone in a line-up", 195, 426, DIM, 0.5)
            end
        elseif t == 2 then
            drawTables(self, r, now)
        else
            drawLeaders(self, r, now)
        end
        self.ga = old
        deskSwitch(self, r, now)
    end

    drawDesktop = function(self: Scoreline, r: Renderer, now: number)
        rect(self, r, 0, 0, self.aw, self.ah, BG)
        -- the matches, and the sign-in sheet over them
        paneOpen(self, r, "a")
        drawListScreen(self, r, now)
        drawSheet(self, r, now)
        paneClose(self, r)
        -- the open match, and its goal or red card scene
        paneOpen(self, r, "b")
        local m = findMatch(self, self.openId)
        if m ~= nil then
            -- a goal or card scene paints an opaque page over this pane: nothing under it shows
            local covered = false
            local sc = self.scene
            if sc ~= nil and findMatch(self, sc.m) ~= nil then
                local t = now - sc.t0
                local out = if sc.outT > 0 then now - sc.outT else -1
                local bgA = ease(LINEAR, t, 0, 0.2) * (if out >= 0 then 1 - prog(out, 0, 0.4) else 1)
                covered = self.ga * bgA >= 0.999
            end
            if not covered then drawDetailScreen(self, r, m, now) end
        else
            rect(self, r, 0, 0, W, H, BG)
            txt(self, r, "R", "Pick a match.", 195, 400, 20, -0.02, MUTED, 0.5)
        end
        drawScene(self, r, now)
        paneClose(self, r)
        -- the player, the tables or tonight's leaders, and the notifications
        paneOpen(self, r, "c")
        drawThird(self, r, now)
        drawToast(self, r, now)
        paneClose(self, r)
    end
end

end
buildViews()


-- =====================================================================
-- ACTIONS
-- =====================================================================
-- actions, simulation, binding and lifecycle are built in their own frame too
local function buildApp()
findMatch = function(self: Scoreline, id: number): Match?
    for _, m in self.matches do
        if m.id == id then return m end
    end
    return nil
end
do
-- France – Argentina: the match the goal triggers act on
local function featured(self: Scoreline): Match?
    for _, m in self.matches do
        if m.feat then return m end
    end
    return nil
end
-- a team's most relevant match: live, then today, then tomorrow, then yesterday
matchOf = function(self: Scoreline, team: string): (Match?, string)
    local best: Match? = nil
    local bestScore = -1
    for _, m in self.matches do
        if m.h == team or m.a == team then
            local sc = if m.status == "live" then 4 elseif m.day == 1 then 3 elseif m.day == 2 then 2 else 1
            if sc > bestScore then best, bestScore = m, sc end
        end
    end
    if best == nil then return nil, "" end
    local b = best :: Match
    ensureEvents(b)
    return b, if b.h == team then "h" else "a"
end

openMatch = function(self: Scoreline, id: number)
    local m = findMatch(self, id)
    if m == nil then return end
    local now = nowOf(self)
    if self.desk and id == self.openId then return end
    ensureEvents(m)
    self.openId = id
    self.tab = 1
    self.detailScroll.y, self.detailScroll.v = 0, 0
    self.paneT, self.paneDir = -100, 0
    self.tabOpenT = now
    self.screenT = now
    self.tabIndX = tween(20)
    self.evAll, self.evT = false, -100
    self.luSide, self.luK, self.luT = "h", tween(0), now
    if self.desk then
        self.screen = tween(1)
    else
        retargetS(self, self.screen, now, 1, "screen")
    end
end

closePlayer = function(self: Scoreline)
    if not self.pv.open or self.desk then return end
    self.pv.open = false
    self.pv.t = nowOf(self)
end

closeMatch = function(self: Scoreline)
    if self.desk then return end
    closePlayer(self)
    retargetS(self, self.screen, nowOf(self), 0, "screen")
end

setTab = function(self: Scoreline, i: number)
    if i == self.tab then return end
    local now = nowOf(self)
    self.paneDir = if i > self.tab then 1 else -1
    self.tab = i
    self.paneT = now
    self.tabOpenT = now
    retargetS(self, self.tabIndX, now, (i - 1) * 88.5 + 20, "tabs")
end

local setLive: (self: Scoreline, on: boolean) -> ()
local syncIcon: (self: Scoreline) -> ()
do
    syncIcon = function(self: Scoreline)
        local p = self.iconLive
        if p ~= nil and p.value ~= self.liveOnly then p.value = self.liveOnly end
    end

    setDay = function(self: Scoreline, d: number)
        if d == self.day and not self.liveOnly then return end
        local now = nowOf(self)
        local dir = if d > self.day then 1 else -1
        self.day = d
        if self.liveOnly then
            self.liveOnly = false
            self.liveOffT = now
            retargetS(self, self.liveK, now, 0, "live")
            syncIcon(self)
        end
        placeDayInd(self, now, true)
        self.feedT, self.feedDir = now, dir
        self.listScroll.y, self.listScroll.v = 0, 0
    end

    -- Live on / off. The list itself is not faded here, so the cards never blink.
    setLive = function(self: Scoreline, on: boolean): ()
        if on == self.liveOnly then return end
        local now = nowOf(self)
        self.liveOnly = on
        if on then
            self.day = 3
            self.liveOnT = now
            local n = #liveMatches(self)
            local w = if n > 0 then (366 - 4 * (n - 1)) / n else 0
            for _, m in self.matches do m.cw = tween(if m.status == "live" then w else 0) end
        else
            self.liveOffT = now
        end
        retargetS(self, self.liveK, now, if on then 1 else 0, "live")
        placeDayInd(self, now, true)
    end

    toggleLive = function(self: Scoreline)
        setLive(self, not self.liveOnly)
        syncIcon(self)
    end
end

openSheet = function(self: Scoreline)
    self.sheetOpen = true
    self.sheetT = nowOf(self)
end
closeSheet = function(self: Scoreline)
    if not self.sheetOpen then return end
    self.sheetOpen = false
    self.sheetT = nowOf(self)
end

toggleGroup = function(self: Scoreline, key: string)
    local now = nowOf(self)
    local t = self.collapsed[key]
    if t == nil then
        t = tween(1)
        self.collapsed[key] = t
    end
    retarget(t, now, if t.b > 0.5 then 0 else 1, 0.5, GLIDE)
end

toggleFavMatch = function(self: Scoreline, id: number)
    self.favMatch[id] = if self.favMatch[id] then nil else true
end

setSide = function(self: Scoreline, side: string)
    local m = findMatch(self, self.openId)
    if m == nil or side == self.luSide then return end
    local now = nowOf(self)
    self.luSide = side
    self.luT = now
    retargetS(self, self.luK, now, if side == "h" then 0 else 1, "tabs")
end

openPlayer = function(self: Scoreline, team: string, n: number, from: { number }?)
    local now = nowOf(self)
    local pv = self.pv
    pv.open, pv.t, pv.team, pv.n, pv.origin = true, now, team, n, "match"
    pv.mid = self.openId
    -- the phone zooms from his face; on the desktop his page opens in its own pane
    pv.from = if from and not self.desk then table.clone(from) else {}
    if self.desk and self.deskTab ~= 1 then
        self.deskTab, self.deskTabT = 1, now
        retargetS(self, self.deskTabK, now, 0, "tabs")
    end
    pv.prevT, pv.dir = -100, 0
    pv.rating = tween(6)
    for i = 1, 5 do pv.bars[i] = tween(0) end
    self.playerScroll.y, self.playerScroll.v = 0, 0
end

-- the followed player's page, opened from the list: the match screen stays shut,
-- so going back lands on the list again
openFollowed = function(self: Scoreline, m: Match, team: string, n: number)
    ensureEvents(m)
    if self.desk then openMatch(self, m.id) end
    self.openId = m.id
    self.luSide = if m.h == team then "h" else "a"
    self.luK = tween(if m.h == team then 0 else 1)
    openPlayer(self, team, n, nil)
    self.pv.origin = "list"
end

-- previous / next player of the same team (starters, then the bench)
stepPlayer = function(self: Scoreline, dir: number)
    local m = findMatch(self, self.pv.mid)
    local pv = self.pv
    if m == nil then return end
    local side = if m.h == pv.team then "h" else "a"
    local lu = m.lu[side]
    local order: { number } = table.clone(lu.xi)
    for _, n in lu.bench do table.insert(order, n) end
    local at = 1
    for i, n in order do
        if n == pv.n then at = i end
    end
    local nxt = order[((at - 1 + dir) % #order) + 1]
    pv.n = nxt
    pv.prevT, pv.dir = nowOf(self), dir
    local hr = self.heads[pv.team .. tostring(nxt)]
    pv.from = if hr and not self.desk then table.clone(hr) else {}
end

-- the player you follow (one at a time)
isFollowed = function(self: Scoreline, team: string, n: number): boolean
    local f = self.fol
    return f ~= nil and f.team == team and f.n == n
end
local function newFollow(team: string, n: number, now: number): Follow
    return {
        team = team, n = n, t = now, acts = {}, nextT = now + 1.2, goalT = -100, pickT = -1, stats = {}, statT = now,
        ball = false, ballT = -100, open = true, openK = tween(1), hgt = tween(266), redT = -100, phase = "", phT = -100,
    }
end
followPlayer = function(self: Scoreline, team: string, n: number)
    self.fol = newFollow(team, n, nowOf(self))
end
unfollow = function(self: Scoreline)
    local f = self.fol
    if f == nil then return end
    -- keep the picker open so a new player is one tap away
    self.fol = nil
end

openScene = function(self: Scoreline, m: Match, ev: Event, kind: string)
    self.scene = { m = m.id, ev = ev, t0 = nowOf(self), outT = -1, kind = kind }
    self.toast.ev = nil
end
closeScene = function(self: Scoreline)
    local sc = self.scene
    if sc ~= nil and sc.outT < 0 then sc.outT = nowOf(self) end
end
-- first tap shows everything at once, the next one closes
tapScene = function(self: Scoreline)
    local sc = self.scene
    if sc == nil then return end
    local now = nowOf(self)
    local full = sceneEnd(self) - 1.4
    if now - sc.t0 < full then
        sc.t0 = now - full
    else
        closeScene(self)
    end
end

-- =====================================================================
-- SIMULATION — clocks, planned substitutions, goals, the followed player
-- =====================================================================
local function pushAct(self: Scoreline, m: Match, txtS: string, kind: string)
    local f = self.fol
    if f == nil then return end
    table.insert(f.acts, 1, { t = nowOf(self), txt = txtS, kind = kind, clock = pad2(math.min(m.min, 99)) .. ":" .. pad2(m.sec) })
    if #f.acts > 4 then table.remove(f.acts) end
end

-- is this match's page the one in front (where a goal plays as a full scene)?
local function onTop(self: Scoreline, m: Match): boolean
    if self.desk then return self.openId == m.id and self.scene == nil end
    return self.openId == m.id and self.screen.b == 1 and not self.pv.open and self.scene == nil
end

-- the moment a goal lands: the card floods, the new number takes our spectrum,
-- the followed player's card reacts, then the scene (match in front) or a notification
local function celebrate(self: Scoreline, m: Match, ev: Event)
    local now = nowOf(self)
    local side = ev.side
    m.flashT, m.bumpSide, m.bumpT, m.goalT, m.goalSide = now, side, now, now, side
    self.lastGoal = { m = m.id, ev = ev }
    -- the player you follow
    local f = self.fol
    if f ~= nil and f.team == sideTeam(m, side) then
        if f.n == ev.pn then
            f.goalT = now
            pushAct(self, m, "GOAL! " .. TEAMS[m.h].short .. " " .. ev.s .. " " .. TEAMS[m.a].short, "goal")
            f.ball, f.ballT = true, now + 2.5
        elseif f.n == ev.on then
            pushAct(self, m, "Assist for " .. ev.p .. "'s goal", "assist")
            f.ball, f.ballT = true, now + 2.5
        end
    end
    if onTop(self, m) then
        self.heroBumpT, self.heroBumpSide = now, side
        openScene(self, m, ev, "goal")
    elseif self.scene == nil then
        self.toast = { m = m.id, ev = ev, t = now, dy = 0, outT = -1, outFrom = 0, held = false }
    end
end

-- a goal is recorded (the score is already counted), then celebrated
local function landGoal(self: Scoreline, m: Match, ev: Event)
    self.evSeq += 1
    ev.id = self.evSeq
    ev.s = scoreStr(m.hs, m.as)
    ev.t0 = nowOf(self)
    if ev.txt == "" then ev.txt = commentary(m, ev) end
    table.insert(m.events, ev)
    applyEvent(m, ev)
    m.mom[ev.min + 1] = if ev.side == "h" then 1 else -1
    if not m.fstats then refreshStats(m) end
    celebrate(self, m, ev)
end

local function goal(self: Scoreline, m: Match, side: string, forced: number)
    if m.status ~= "live" then return end
    ensureEvents(m)
    local ev = makeGoal(m, side, forced, self.rand)
    if side == "h" then m.hs += 1 else m.as += 1 end
    landGoal(self, m, ev)
end

-- a red card is shown: the followed player's card reacts, then the scene or a notification
local function showRed(self: Scoreline, m: Match, e: Event)
    local now = nowOf(self)
    local f = self.fol
    if f ~= nil and f.team == sideTeam(m, e.side) and f.n == e.pn then f.redT = now end
    if onTop(self, m) then
        openScene(self, m, e, "red")
    elseif self.scene == nil then
        self.toast = { m = m.id, ev = e, t = now, dy = 0, outT = -1, outFrom = 0, held = false }
    end
end

local function landRed(self: Scoreline, m: Match, e: Event)
    self.evSeq += 1
    e.id = self.evSeq
    e.t0 = nowOf(self)
    if e.txt == "" then e.txt = sayLine(m, e, self.rand) end
    table.insert(m.events, e)
    applyEvent(m, e)
    if not m.fstats then refreshStats(m) end
    showRed(self, m, e)
end

-- a straight red: he leaves for good. On the match page the red card scene plays,
-- anywhere else a notification. forced = the player (0 = whoever the referee picks)
local function sendOff(self: Scoreline, m: Match, side: string, forced: number)
    if m.status ~= "live" then return end
    ensureEvents(m)
    local pn = 0
    for _, p in onPitch(m, side) do
        if p[1] == forced then pn = forced end
    end
    if pn == 0 then pn = pickPlayer(m, side, "card", -1, self.rand) end
    landRed(self, m, mkEvent(m, "rc", side, math.min(m.min, 95), pn, pickPlayer(m, otherSide(side), "any", -1, self.rand), ""))
end

-- the final whistle, now
local function endMatch(self: Scoreline, m: Match)
    if m.status ~= "live" then return end
    m.status = "ft"
    m.ftT = nowOf(self)
    m.ver += 1
end

local function applyPlan(self: Scoreline, m: Match, now: number)
    if not m.ready then ensureEvents(m) end
    local keep: { Event } = {}
    for _, e in m.plan do
        if e.min <= m.min then
            local lu = m.lu[e.side]
            -- a planned change only happens if both players are still where the plan expects
            if e.kind ~= "sub" or (lu.off[e.on] == nil and lu.on[e.pn] == nil) then
                e.t0 = now
                self.evSeq += 1
                e.id = self.evSeq
                if e.kind == "yc" then
                    e.on = pickPlayer(m, otherSide(e.side), "any", -1, self.rand)
                    e.o = nameOf(sideTeam(m, otherSide(e.side)), e.on)
                end
                e.txt = sayLine(m, e, self.rand)
                applyEvent(m, e)
                table.insert(m.events, e)
                local f = self.fol
                if f ~= nil and e.kind == "sub" and f.team == sideTeam(m, e.side) then
                    if f.n == e.on then pushAct(self, m, "Substituted. " .. e.p .. " comes on", "sub")
                    elseif f.n == e.pn then pushAct(self, m, "Comes on for " .. e.o, "sub") end
                end
            end
        else
            table.insert(keep, e)
        end
    end
    m.plan = keep
end

-- a new minute of a live match: its corners, shots, fouls, the momentum line
local function stepMinute(self: Scoreline, m: Match, now: number)
    if not m.ready then return end
    for _, e in genMinute(m, m.min, self.rand) do
        self.evSeq += 1
        e.id = self.evSeq
        e.t0 = now
        table.insert(m.events, e)
    end
    stepMomentum(m, m.min, self.rand)
    refreshStats(m)
    m.ver += 1
end

-- what the followed player just did (every few seconds while he is on the pitch)
local BALL_ON: { [string]: boolean } = { touch = true, drib = true, fouled = true, pass = true, long = true, key = true, cross = true, shot = true, miss = true }
local function followAct(self: Scoreline, now: number)
    local f = self.fol
    if f == nil then return end
    -- after a pass or a shot the ball has left him
    if f.ball and f.ballT > 0 and now >= f.ballT then
        f.ball = false
        f.ballT = now
    end
    if self.feedMode then return end
    if now < f.nextT then return end
    f.nextT = now + 2.6 + self.rand() * 2.8
    local m, side = matchOf(self, f.team)
    if m == nil or m.status ~= "live" then return end
    local mm = m :: Match
    local lu = mm.lu[side]
    local onp = (slotOf(lu, f.n) > 0 or lu.on[f.n] ~= nil) and lu.off[f.n] == nil
    if not onp then return end
    local total = 0
    for _, a in DATA.acts do total += a[2] :: number end
    local x = self.rand() * total
    local pick = DATA.acts[1]
    for _, a in DATA.acts do
        x -= a[2] :: number
        if x <= 0 then
            pick = a
            break
        end
    end
    local kind = pick[1] :: string
    local os = otherSide(side)
    local team, oteam = sideTeam(mm, side), sideTeam(mm, os)
    local s = pick[3] :: string
    s = string.gsub(s, "{M}", nameOf(team, pickPlayer(mm, side, "any", f.n, self.rand)))
    s = string.gsub(s, "{Q}", nameOf(oteam, pickPlayer(mm, os, "defend", -1, self.rand)))
    s = string.gsub(s, "{K}", nameOf(oteam, keeperOf(mm, os)))
    -- his numbers move with every action: touches, passes, completed, key passes, dribbles
    local key = side .. tostring(f.n)
    local fx = mm.fx[key]
    if fx == nil then
        fx = { 0, 0, 0, 0, 0 }
        mm.fx[key] = fx
    end
    if kind ~= "run" and kind ~= "press" then fx[1] += 1 end
    if kind == "pass" or kind == "long" or kind == "key" or kind == "cross" then
        fx[2] += 1
        if kind ~= "cross" or self.rand() < 0.4 then fx[3] += 1 end
    end
    if kind == "key" then fx[4] += 1 end
    if kind == "drib" then fx[5] += 1 end
    if kind == "shot" or kind == "miss" then
        -- shots are real: they land in the match feed and the team stats too
        local e = mkEvent(mm, if kind == "shot" then "sot" else "miss", side, mm.min, f.n, if kind == "shot" then keeperOf(mm, os) else 0, "")
        e.xg = if kind == "shot" then 0.06 + self.rand() * 0.12 else 0.03 + self.rand() * 0.08
        e.txt = sayLine(mm, e, self.rand)
        self.evSeq += 1
        e.id = self.evSeq
        e.t0 = now
        table.insert(mm.events, e)
        refreshStats(mm)
    end
    mm.ver += 1
    -- still off the ball, doing the same thing: the card has nothing new to say
    local last = f.acts[1]
    if last ~= nil and last.txt == s and not f.ball and not BALL_ON[kind] then return end
    pushAct(self, mm, s, kind)
    -- on the ball while he has it; a pass or a shot lets it go a moment later
    if BALL_ON[kind] then
        f.ball = true
        local releases = kind ~= "touch" and kind ~= "drib" and kind ~= "fouled"
        f.ballT = if releases then now + 1.3 else -1
    else
        f.ball = false
        f.ballT = now
    end
end

local function resetSim(self: Scoreline)
    local now = nowOf(self)
    self.matches = makeMatches()
    for _, m in self.matches do
        if m.status == "live" and self.liveOnly then
            local n = 5
            m.cw = tween((366 - 4 * (n - 1)) / n)
        end
    end
    self.scene = nil
    self.toast = { m = 0, ev = nil, t = -100, dy = 0, outT = -1, outFrom = 0, held = false }
    self.endedT = -1
    self.liveOnT = now
    local f = featured(self)
    if f then ensureEvents(f) end
    local fol = self.fol
    if fol then fol.acts = {} end
end

local function tick(self: Scoreline)
    local now = nowOf(self)
    if self.feedMode then
        -- live data: clocks run in real time between updates; everything else comes from the feed
        for _, m in self.matches do
            if m.status == "live" then
                m.sec += 1
                if m.sec >= 60 then
                    m.sec -= 60
                    m.min += 1
                    if m.mom[m.min + 1] == nil then m.mom[m.min + 1] = (m.mom[m.min] or 0) * 0.6 end
                    m.ver += 1
                end
            end
        end
        return
    end
    local anyLive = false
    for _, m in self.matches do
        if m.status == "live" then
            anyLive = true
            m.sec += 6
            if m.sec >= 60 then
                m.sec -= 60
                m.min += 1
                if m.feat then applyPlan(self, m, now) end
                stepMinute(self, m, now)
                if m.min >= 90 + 2 + (m.id % 4) then
                    m.status = "ft"
                    m.ftT = now
                end
            end
        end
    end
    if self.auto and self.rand() < 0.03 then
        local live = liveMatches(self)
        if #live > 0 then
            local f = featured(self)
            local m = live[1 + math.floor(self.rand() * #live)]
            if f and f.status == "live" and self.rand() < 0.35 then m = f end
            goal(self, m, if self.rand() < 0.5 then "h" else "a", 0)
        end
    end
    -- everything finished: start the evening again after a pause
    if not anyLive then
        if self.endedT < 0 then self.endedT = now end
        if now - self.endedT > 25 then resetSim(self) end
    end
end

-- =====================================================================
-- LIVE DATA — your API drives the app through two String properties:
--   feed   the whole picture: teams, leagues, squads and every match with its
--          line-ups, events and stats. Send it again whenever anything changes
--          (polling is fine: new goals, cards and final whistles found in a new
--          feed play their moment). The demo simulation stops for good.
--   event  one thing that just happened, played the moment it arrives: a goal,
--          a card, a substitution, the final whistle, a clock sync, or what the
--          followed player is doing. Give every event its own id.
-- The JSON shapes are in DATA-BINDING.md.
-- =====================================================================
local applyFeed: (self: Scoreline, f: any) -> ()
local liveEvent: (self: Scoreline, e: any) -> ()
do
    local function num(v: any, d: number): number
        local n = tonumber(v)
        if n == nil then return d end
        return n :: number
    end
    local function text(v: any, d: string): string
        if type(v) == "string" then return v end
        if type(v) == "number" then return tostring(v) end
        return d
    end
    -- "#0055A4", "0055A4" or a number
    local function colorOf(v: any, d: number): number
        if type(v) == "number" then return v end
        if type(v) == "string" then
            local h = string.gsub(v, "#", "")
            return tonumber(h, 16) or d
        end
        return d
    end
    local function sideOf(v: any): string
        return if v == "away" or v == "a" then "a" else "h"
    end
    local STATUS: { [string]: string } = { live = "live", ns = "ns", scheduled = "ns", ft = "ft", finished = "ft" }
    local KIND: { [string]: string } = {
        goal = "goal", yellow = "yc", red = "rc", sub = "sub", shot = "sot", miss = "miss", blocked = "block",
        bigChance = "big", corner = "corner", foul = "foul", offside = "offside",
    }
    local STAT_KEYS = { { "xg", "xG", "%.2f" }, { "shots", "Shots", "%d" }, { "onTarget", "On target", "%d" }, { "bigChances", "Big chances", "%d" },
        { "corners", "Corners", "%d" }, { "passes", "Passes", "%d" }, { "fouls", "Fouls", "%d" }, { "offsides", "Offsides", "%d" } }
    -- plain lines for events that arrive without commentary: nothing invented
    local SAY: { [string]: string } = {
        sot = "{P} forces a save.", miss = "{P} shoots wide.", block = "{P}'s shot is blocked.", big = "Big chance for {P}.",
        corner = "Corner to {T}.", foul = "Free kick to {T}.", offside = "{P} is caught offside.",
        yc = "{P} is booked.", rc = "{P} is sent off.", sub = "{P} comes on for {Q}.",
    }
    local function plainLine(m: Match, ev: Event): string
        local team = TEAMS[sideTeam(m, ev.side)].name
        if ev.kind == "goal" then
            if ev.o ~= "" then return ev.p .. " scores for " .. team .. ", set up by " .. ev.o .. "." end
            return ev.p .. " scores for " .. team .. "."
        end
        local s = SAY[ev.kind] or ""
        s = string.gsub(s, "{P}", ev.p)
        s = string.gsub(s, "{Q}", ev.o)
        s = string.gsub(s, "{T}", team)
        return s
    end

    local function applyTeams(list: any)
        for _, t in list or {} do
            local id = text(t.id, "")
            if id ~= "" then
                local cols = t.colors or {}
                local c1, c2 = colorOf(cols[1], 0x8A8A8A), colorOf(cols[2], 0xE9E7E1)
                local name = text(t.name, id)
                TEAMS[id] = { key = id, name = name, short = text(t.short, string.upper(string.sub(name, 1, 3))), c1 = c1, c2 = c2 }
                if type(t.flag) == "table" then
                    local ops: { { any } } = {}
                    for _, op in t.flag do
                        local o: { any } = {}
                        for i, x in op do o[i] = if i > 1 and type(x) == "string" then colorOf(x, 0) else x end
                        table.insert(ops, o)
                    end
                    FLAGS[id] = ops
                elseif FLAGS[id] == nil then
                    -- no flag sent: a disc in the first colour, ringed in the second
                    FLAGS[id] = { { "r", 0, 0, 30, 30, c1 }, { "cs", 15, 15, 8.5, 2.6, c2 } }
                end
            end
        end
    end

    local function applyLeagues(list: any)
        if type(list) ~= "table" then return end
        table.clear(LEAGUE_ORDER)
        for _, l in list do
            local id = text(l.id, "")
            if id ~= "" then
                local teams: { string } = {}
                local rows: { Row } = {}
                for i, row in l.table or {} do
                    local k = text(row.team, "")
                    local gf, ga = num(row.gf, 0), num(row.ga, 0)
                    table.insert(teams, k)
                    table.insert(rows, { k = k, p = num(row.p, 0), w = num(row.w, 0), d = num(row.d, 0), l = num(row.l, 0),
                        gf = gf, ga = ga, gd = gf - ga, pts = num(row.pts, 0), live = false, i = i })
                end
                for _, k in l.teams or {} do
                    if table.find(teams, k) == nil then table.insert(teams, k) end
                end
                LEAGUES[id] = { key = id, country = text(l.country, ""), name = text(l.name, id), md = num(l.matchday, 1), teams = teams, prior = {},
                    q = num(l.qualify, 0), ql = text(l.qualifyLabel, "Qualify") }
                if #rows > 0 then FEED_TABLES[id] = rows else FEED_TABLES[id] = nil end
                table.insert(LEAGUE_ORDER, id)
            end
        end
    end

    local function applySquads(sq: any)
        if type(sq) ~= "table" then return end
        for team, s in sq do
            local old = PEOPLE[team] or {}
            local people: { [number]: Person } = {}
            for _, row in s.players or {} do
                local n = num(row.n, -1)
                if n >= 0 then
                    local by, bm, bd = 0, 0, 0
                    if type(row.born) == "string" then
                        local y, mo, d = string.match(row.born, "(%d+)-(%d+)-(%d+)")
                        by, bm, bd = tonumber(y) or 0, tonumber(mo) or 0, tonumber(d) or 0
                    end
                    local last = text(row.last, "#" .. tostring(n))
                    local prev = old[n]
                    people[n] = {
                        team = team, n = n, first = text(row.first, ""), last = last, short = text(row.short, last),
                        pos = text(row.pos, "MF"), role = text(row.role, ""), club = text(row.club, ""),
                        born = { by, bm, bd }, h = num(row.height, 0),
                        -- a photo in the squad atlas stays with the same player
                        cell = if prev and prev.last == last then prev.cell else 0,
                    }
                end
            end
            PEOPLE[team] = people
            if type(s.coach) == "string" then
                local first, last = string.match(s.coach, "^(%S+)%s+(.+)$")
                local ln = last or s.coach
                COACH[team] = { team = team, n = 0, first = first or "", last = ln, short = ln, pos = "CO", role = "Head coach", club = "", born = { 0, 0, 0 }, h = 0, cell = 0 }
            end
        end
    end

    local function lineupOf(team: string, src: any): Lineup
        local lu: Lineup = { team = team, form = "4-3-3", xi = {}, bench = {}, on = {}, off = {}, forr = {}, goals = {}, assists = {}, yc = {}, rc = {} }
        if type(src) == "table" then
            lu.form = text(src.formation, "4-3-3")
            for _, n in src.xi or {} do table.insert(lu.xi, num(n, 0)) end
            for _, n in src.bench or {} do table.insert(lu.bench, num(n, 0)) end
        else
            local d = DATA.lineups[team]
            if d then
                lu.form = d[1] :: string
                for _, n in d[2] :: { number } do table.insert(lu.xi, n) end
                for _, n in d[3] :: { number } do table.insert(lu.bench, n) end
            end
        end
        if #lu.xi < 11 then
            -- no line-up yet: the squad in shirt order, eleven on, the rest on the bench
            local ns: { number } = {}
            local squad: { [number]: Person } = PEOPLE[team] or {}
            for n, _ in squad do table.insert(ns, n) end
            table.sort(ns)
            if #ns < 11 then ns = { 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11 } end
            lu.xi, lu.bench = {}, {}
            for i, n in ns do table.insert(if i <= 11 then lu.xi else lu.bench, n) end
        end
        return lu
    end

    local function eventOf(m: Match, e: any): Event?
        local kind = KIND[text(e.kind, "")]
        if kind == nil then return nil end
        local side = sideOf(e.side)
        local ev = mkEvent(m, kind, side, num(e.minute, m.min), num(e.player, 0), num(e.other, 0), text(e.style, if kind == "goal" then "solo" else ""))
        if type(e.name) == "string" then ev.p = e.name
        elseif ev.pn == 0 then ev.p = TEAMS[sideTeam(m, side)].name end
        if type(e.otherName) == "string" then ev.o = e.otherName end
        ev.xg = num(e.xg, if kind == "goal" then 0.3 else 0)
        ev.txt = text(e.text, "")
        return ev
    end

    -- the momentum line from what happened, minute by minute (no randomness)
    local function deriveMomentum(m: Match)
        m.mom = { 0 }
        local push: { [number]: number } = {}
        for _, e in m.events do
            local w = if e.kind == "goal" then 1.4 elseif e.kind == "big" then 0.9 elseif e.kind == "sot" then 0.6
                elseif e.kind == "miss" or e.kind == "block" then 0.4 elseif e.kind == "corner" then 0.35 else 0
            push[e.min] = (push[e.min] or 0) + (if e.side == "h" then w else -w)
        end
        local v = 0
        for minute = 1, math.min(m.min, 95) do
            v = math.clamp(v * 0.82 + (push[minute] or 0) * 0.45, -1, 1)
            m.mom[minute + 1] = v
        end
    end

    local function matchStats(m: Match, st: any)
        m.fstats = false
        if type(st) ~= "table" then
            refreshStats(m)
            return
        end
        m.poss = num(st.possession, 50)
        local list: { Stat } = {}
        for _, k in STAT_KEYS do
            local v = st[k[1]]
            if type(v) == "table" then table.insert(list, { name = k[2], a = num(v[1], 0), b = num(v[2], 0), fmt = k[3] }) end
        end
        if #list > 0 then
            m.stats = list
            m.fstats = true
        else
            refreshStats(m)
        end
    end

    -- events of a match from the feed; returns the ones not seen before
    local function feedEvents(self: Scoreline, m: Match, list: any, quiet: boolean): { Event }
        for _, side in { "h", "a" } do
            local lu = m.lu[side]
            lu.on, lu.off, lu.forr, lu.goals, lu.assists, lu.yc, lu.rc = {}, {}, {}, {}, {}, {}, {}
        end
        m.events = {}
        local fresh: { Event } = {}
        local hs, as = 0, 0
        local now = nowOf(self)
        for i, e in list or {} do
            local ev = eventOf(m, e)
            if ev then
                local key = tostring(m.id) .. "|" .. text(e.id, tostring(i) .. ev.kind .. ev.side .. tostring(ev.min) .. tostring(ev.pn))
                local id = self.evIds[key]
                if ev.kind == "goal" then
                    if ev.side == "h" then hs += 1 else as += 1 end
                    ev.s = scoreStr(hs, as)
                end
                if ev.txt == "" then ev.txt = plainLine(m, ev) end
                if id == nil then
                    self.evSeq += 1
                    id = self.evSeq
                    self.evIds[key] = id
                    ev.t0 = if quiet then -100 else now
                    if not quiet then table.insert(fresh, ev) end
                else
                    ev.t0 = -100
                end
                ev.id = id :: number
                applyEvent(m, ev)
                table.insert(m.events, ev)
            end
        end
        return fresh
    end

    applyFeed = function(self: Scoreline, f: any)
        if type(f) ~= "table" then return end
        local quiet = not self.feedMode      -- the first feed sets the stage without fanfare
        self.feedMode, self.auto = true, false
        LIVE_DATA.on = true
        local now = nowOf(self)
        if type(f.days) == "table" then
            for i = 1, 5 do
                if type(f.days[i]) == "string" then DAYS[i] = f.days[i] end
            end
        end
        applyTeams(f.teams)
        applyLeagues(f.leagues)
        applySquads(f.squads)
        for team, nx in f.next or {} do
            DATA.next[team] = { opp = text(nx.opponent, ""), at = self.clock0 + now + num(nx["in"], 0), date = text(nx.date, ""), time = text(nx.time, "") }
        end
        local old: { [number]: Match } = {}
        for _, m in self.matches do old[m.id] = m end
        local list: { Match } = {}
        local nLive = 0
        for _, e in f.matches or {} do
            local id = num(e.id, 0)
            local h, a = text(e.home, ""), text(e.away, "")
            if id ~= 0 and TEAMS[h] ~= nil and TEAMS[a] ~= nil then
                local prev: Match? = old[id]
                if prev ~= nil and (prev.h ~= h or prev.a ~= a) then prev = nil end
                local hadScore: { number }? = if prev then { prev.hs, prev.as } else nil
                local wasLive = prev ~= nil and prev.status == "live"
                local m: Match = prev or {
                    id = id, day = 1, lg = "", h = h, a = a, hs = 0, as = 0, status = "ns", min = 0, sec = 0, time = "",
                    feat = false, ready = true, events = {}, plan = {}, mom = {}, poss = 50, stats = {},
                    lu = { h = lineupOf(h, nil), a = lineupOf(a, nil) },
                    flashT = -100, bumpSide = "", bumpT = -100, goalT = -100, goalSide = "",
                    ftT = -100, cw = tween(0), sink = 0, fx = {}, ver = 0, fstats = false, pst = {},
                }
                m.ready, m.plan = true, {}
                m.day = num(e.day, 0) + 1
                m.lg = text(e.league, "fri")
                if LEAGUES[m.lg] == nil then
                    LEAGUES[m.lg] = { key = m.lg, country = "", name = m.lg, md = 1, teams = {}, prior = {} }
                end
                if table.find(LEAGUE_ORDER, m.lg) == nil then table.insert(LEAGUE_ORDER, m.lg) end
                local sc = e.score or {}
                m.hs, m.as = num(sc[1], 0), num(sc[2], 0)
                m.status = STATUS[text(e.status, "ns")] or "ns"
                m.min, m.sec = num(e.minute, 0), num(e.second, 0)
                m.time = text(e.kickoff, "")
                m.feat = e.featured == true
                if prev == nil and e.favourite == true then self.favMatch[id] = true end
                if type(e.venue) == "table" then
                    local v = e.venue
                    DATA.venues[h] = { text(v.name, ""), text(v.city, ""), text(v.referee, ""), text(v.attendance, "") }
                end
                local lus = e.lineups or {}
                m.lu = { h = lineupOf(h, lus.home), a = lineupOf(a, lus.away) }
                local fresh = feedEvents(self, m, e.events, quiet or prev == nil)
                matchStats(m, e.stats)
                if type(e.momentum) == "table" then
                    m.mom = {}
                    for i, v in e.momentum do m.mom[i] = math.clamp(num(v, 0), -1, 1) end
                else
                    deriveMomentum(m)
                end
                m.pst = {}
                local pl = e.players or {}
                for _, sd in { "home", "away" } do
                    for n, v in pl[sd] or {} do
                        local row: { [string]: number } = {}
                        for k, x in v do row[k] = num(x, 0) end
                        m.pst[(if sd == "home" then "h" else "a") .. tostring(n)] = row
                    end
                end
                m.ver += 1
                -- what changed since the last feed plays its moment
                if hadScore ~= nil and not quiet then
                    for _, side in { "h", "a" } do
                        local before = if side == "h" then hadScore[1] else hadScore[2]
                        local after = if side == "h" then m.hs else m.as
                        if after > before then
                            local g: Event? = nil
                            for _, ev in fresh do
                                if ev.kind == "goal" and ev.side == side then g = ev end
                            end
                            if g == nil then
                                -- the score moved without its event: a goal by the team
                                local ng = mkEvent(m, "goal", side, m.min, 0, 0, "solo")
                                ng.p = TEAMS[sideTeam(m, side)].name
                                ng.s = scoreStr(m.hs, m.as)
                                ng.txt = plainLine(m, ng)
                                self.evSeq += 1
                                ng.id = self.evSeq
                                ng.t0 = now
                                table.insert(m.events, ng)
                                g = ng
                            end
                            celebrate(self, m, g :: Event)
                        end
                    end
                    for _, ev in fresh do
                        if ev.kind == "rc" then showRed(self, m, ev) end
                    end
                    if wasLive and m.status == "ft" then m.ftT = now end
                end
                if m.status == "live" then nLive += 1 end
                table.insert(list, m)
            end
        end
        self.matches = list
        -- desktop: the middle pane and the player pane always show something real
        if self.desk then
            if findMatch(self, self.openId) == nil then
                local dm = featured(self) or liveMatches(self)[1] or list[1]
                if dm then openMatch(self, dm.id) end
            end
            local fol = self.fol
            if fol ~= nil and findMatch(self, self.pv.mid) == nil then
                local pm = matchOf(self, fol.team)
                if pm ~= nil then
                    openPlayer(self, fol.team, fol.n, nil)
                    self.pv.mid = pm.id
                end
            end
        end
        if quiet then
            -- the cards are already in place on the first frame of live data
            local w = if nLive > 0 then (366 - 4 * (nLive - 1)) / nLive else 0
            for _, m in list do m.cw = tween(if m.status == "live" then w else 0) end
            placeDayInd(self, now, false)
        end
    end

    liveEvent = function(self: Scoreline, e: any)
        if type(e) ~= "table" then return end
        local m0 = findMatch(self, num(e.match, 0))
        if m0 == nil then return end
        local m = m0 :: Match
        local key = tostring(m.id) .. "|" .. text(e.id, "")
        if text(e.id, "") ~= "" then
            if self.evIds[key] then return end -- already played
            self.evSeq += 1
            self.evIds[key] = self.evSeq
        end
        if not self.feedMode then ensureEvents(m) end
        local kind = text(e.kind, "")
        local now = nowOf(self)
        if e.minute ~= nil then m.min = math.max(m.min, num(e.minute, m.min)) end
        if kind == "minute" then
            m.min, m.sec = num(e.minute, m.min), num(e.second, 0)
            return
        elseif kind == "kickoff" then
            m.status, m.min, m.sec = "live", 0, 0
            m.ver += 1
            return
        elseif kind == "fulltime" then
            endMatch(self, m)
            return
        elseif kind == "action" then
            -- what the followed player is doing right now
            local f = self.fol
            if f ~= nil and f.team == sideTeam(m, sideOf(e.side)) and f.n == num(e.player, -1) then
                pushAct(self, m, text(e.text, ""), text(e.act, "touch"))
                f.ball = e.onBall == true
                f.ballT = if f.ball then -1 else now
            end
            return
        end
        local ev0 = eventOf(m, e)
        if ev0 == nil then return end
        local ev = ev0 :: Event
        if m.status == "ns" then m.status = "live" end
        if ev.txt == "" and self.feedMode then ev.txt = plainLine(m, ev) end
        if ev.kind == "goal" then
            local sc = e.score
            if type(sc) == "table" then
                m.hs, m.as = num(sc[1], m.hs), num(sc[2], m.as)
            elseif ev.side == "h" then
                m.hs += 1
            else
                m.as += 1
            end
            landGoal(self, m, ev)
        elseif ev.kind == "rc" then
            landRed(self, m, ev)
        else
            self.evSeq += 1
            ev.id = self.evSeq
            ev.t0 = now
            if ev.txt == "" then ev.txt = sayLine(m, ev, self.rand) end
            table.insert(m.events, ev)
            applyEvent(m, ev)
            if not m.fstats then refreshStats(m) end
            local f = self.fol
            if f ~= nil and ev.kind == "sub" and f.team == sideTeam(m, ev.side) then
                if f.n == ev.on then pushAct(self, m, "Substituted. " .. ev.p .. " comes on", "sub")
                elseif f.n == ev.pn then pushAct(self, m, "Comes on for " .. ev.o, "sub") end
            end
        end
    end
end

-- two-way properties: the host can set them (to restore a state or deep-link),
-- and the app writes them back whenever the person changes something.
--   day (Number 1-5), liveOnly (Boolean), openMatch (Number, 0 = list),
--   followTeam (String) + followNumber (Number)
local function syncVM(self: Scoreline)
    local v = self.vm
    local out = self.vmOut
    local function read(key: string): any
        local p = v[key]
        if p == nil then return nil end
        local ok, val = pcall(function(): any return p.value end)
        return if ok then val else nil
    end
    local function write(key: string, val: any)
        local p = v[key]
        if p == nil then return end
        out[key] = val
        if read(key) ~= val then pcall(function() p.value = val end) end
    end
    -- string properties that could not take a listener are read here
    for key, last in self.vmPoll do
        local s = read(key)
        if type(s) == "string" and s ~= last then
            self.vmPoll[key] = s
            if key == "feed" then applyFeed(self, jsonDecode(s)) else liveEvent(self, jsonDecode(s)) end
        end
    end
    if self.vmPrimed then
        -- the host changed something
        local d = read("day")
        if type(d) == "number" and d ~= out.day and d >= 1 and d <= 5 then setDay(self, math.floor(d)) end
        local lo = read("liveOnly")
        if type(lo) == "boolean" and lo ~= out.liveOnly then
            setLive(self, lo)
            syncIcon(self)
        end
        local om = read("openMatch")
        if type(om) == "number" and om ~= out.openMatch then
            if om > 0 and findMatch(self, om) ~= nil then openMatch(self, om) elseif om <= 0 then closeMatch(self) end
        end
        local ft, fnum = read("followTeam"), read("followNumber")
        if (type(ft) == "string" and ft ~= out.followTeam) or (type(fnum) == "number" and fnum ~= out.followNumber) then
            local team = if type(ft) == "string" then ft else ""
            if team == "" then unfollow(self)
            elseif TEAMS[team] ~= nil then followPlayer(self, team, math.floor(if type(fnum) == "number" then fnum else 0)) end
        end
    else
        -- at start the host may already point somewhere: a day, a match, a player
        self.vmPrimed = true
        local d = read("day")
        if type(d) == "number" and d >= 1 and d <= 5 and d ~= 3 then setDay(self, math.floor(d)) end
        local om = read("openMatch")
        if type(om) == "number" and om > 0 and findMatch(self, om) ~= nil then openMatch(self, om) end
        local ft, fnum = read("followTeam"), read("followNumber")
        if type(ft) == "string" and ft ~= "" and TEAMS[ft] ~= nil and type(fnum) == "number" and fnum > 0 then
            followPlayer(self, ft, math.floor(fnum))
        end
    end
    -- the app's state, out
    write("day", self.day)
    write("liveOnly", self.liveOnly)
    write("openMatch", if self.screen.b == 1 then self.openId else 0)
    local f = self.fol
    write("followTeam", if f then f.team else "")
    write("followNumber", if f then f.n else 0)
end

-- =====================================================================
-- DATA BINDING — goal / red card / full-time triggers (View Model)
-- =====================================================================
local function bindVM(self: Scoreline, context: Context)
    local okVm, vm = pcall(function(): ViewModel? return context:viewModel() end)
    if not okVm or vm == nil then return end
    local model = vm :: ViewModel
    local function trig(name: string): any
        local ok, p = pcall(function(): any return model:getTrigger(name) end)
        if ok then return p end
        return nil
    end
    local b = self.vm
    -- live data and two-way state (each one optional)
    local function prop(kind: string, name: string): any
        local ok, p = pcall(function(): any
            if kind == "s" then return model:getString(name) end
            if kind == "n" then return model:getNumber(name) end
            return model:getBoolean(name)
        end)
        if ok then return p end
        return nil
    end
    b.feed, b.event, b.followTeam = prop("s", "feed"), prop("s", "event"), prop("s", "followTeam")
    b.day, b.openMatch, b.followNumber = prop("n", "day"), prop("n", "openMatch"), prop("n", "followNumber")
    b.liveOnly = prop("b", "liveOnly")
    local function listen(key: string, fn: (s: string) -> ())
        local p = b[key]
        if p == nil then return end
        local ok = pcall(function() p:addListener(function() fn(p.value) end) end)
        if not ok then self.vmPoll[key] = "" end
        local okV, v = pcall(function(): any return p.value end)
        if okV and type(v) == "string" and v ~= "" then
            fn(v)
            if not ok then self.vmPoll[key] = v end
        end
    end
    listen("feed", function(s: string) applyFeed(self, jsonDecode(s)) end)
    listen("event", function(s: string) liveEvent(self, jsonDecode(s)) end)
    b.goalHome, b.goalAway, b.goalFavorite = trig("goalHome"), trig("goalAway"), trig("goalFavorite")
    b.redHome, b.redAway, b.redFavorite, b.fullTime = trig("redHome"), trig("redAway"), trig("redFavorite"), trig("fullTime")
    -- red cards in France – Argentina, or for the player you follow
    if b.redHome then
        b.redHome:addListener(function()
            local f = featured(self)
            if f then sendOff(self, f, "h", 0) end
        end)
    end
    if b.redAway then
        b.redAway:addListener(function()
            local f = featured(self)
            if f then sendOff(self, f, "a", 0) end
        end)
    end
    if b.redFavorite then
        b.redFavorite:addListener(function()
            local fol = self.fol
            if fol == nil then return end
            local m, side = matchOf(self, fol.team)
            if m == nil or m.status ~= "live" then return end
            local mm = m :: Match
            local lu = mm.lu[side]
            local onp = (slotOf(lu, fol.n) > 0 or lu.on[fol.n] ~= nil) and lu.off[fol.n] == nil and lu.rc[fol.n] == nil
            if onp then sendOff(self, mm, side, fol.n) end
        end)
    end
    -- the final whistle: the followed player's match (or France – Argentina)
    if b.fullTime then
        b.fullTime:addListener(function()
            local fol = self.fol
            local m: Match? = nil
            if fol ~= nil then m = matchOf(self, fol.team) end
            if m == nil or (m :: Match).status ~= "live" then m = featured(self) end
            if m then endMatch(self, m :: Match) end
        end)
    end
    if b.goalHome then
        b.goalHome:addListener(function()
            local f = featured(self)
            if f then goal(self, f, "h", 0) end
        end)
    end
    if b.goalAway then
        b.goalAway:addListener(function()
            local f = featured(self)
            if f then goal(self, f, "a", 0) end
        end)
    end
    if b.goalFavorite then
        b.goalFavorite:addListener(function()
            local fol = self.fol
            if fol == nil then return end
            local m, side = matchOf(self, fol.team)
            if m == nil or m.status ~= "live" then return end
            local mm = m :: Match
            local lu = mm.lu[side]
            local onp = (slotOf(lu, fol.n) > 0 or lu.on[fol.n] ~= nil) and lu.off[fol.n] == nil
            if onp then goal(self, mm, side, fol.n) end
        end)
    end
end

-- =====================================================================
-- MOTION CONTROLS — read the script inputs into self.tm
-- =====================================================================
local function refreshTiming(self: Scoreline)
    local s = self :: any
    local sp = math.max(tonumber(s.speed) or 1, 0.05)
    for _, key in TIMING_KEYS do
        local d = TIMING_DEF[key]
        local function num(suffix: string, i: number): number
            local v = tonumber(s[key .. suffix])
            if v == nil then return d[i] end
            return v
        end
        self.tm[key] = {
            dur = math.max(num("Dur", 1), 0.01) / sp,
            delay = math.max(num("Delay", 2), 0) / sp,
            stagger = math.max(num("Stagger", 3), 0) / sp,
            c = C(math.clamp(num("X1", 4), 0, 1), num("Y1", 5), math.clamp(num("X2", 6), 0, 1), num("Y2", 7)),
        }
    end
    self.tmT = self.t
end

-- ---------------------------------------------------------------------
-- your Live icon: instanced from the liveIcon input, drawn in the header,
-- receives taps, and its "islive" property drives the live filter
-- ---------------------------------------------------------------------
local setupIcon: (self: Scoreline) -> ()
do
    local function findLiveProp(vm: any): any
        if vm == nil then return nil end
        local ok, p = pcall(function(): any return vm:getBoolean("islive") end)
        if ok and p ~= nil then return p end
        return nil
    end

    local function makeVM(name: string): any
        if name == "" then return nil end
        local ok, vm = pcall(function(): any
            local ctor = (Data :: any)[name]
            if ctor == nil then return nil end
            return ctor.new()
        end)
        if ok then return vm end
        return nil
    end

    setupIcon = function(self: Scoreline)
        local src: any = self.liveIcon
        if src == nil then return end
        local inst: any = nil
        local prop: any = nil
        local okInst, a = pcall(function(): any return src:instance() end)
        if okInst and a ~= nil then
            local okD, d = pcall(function(): any return a.data end)
            if okD then prop = findLiveProp(d) end
            if prop ~= nil then inst = a end
        end
        if inst == nil then
            local names = { "ViewModel1", self.iconViewModel, "ViewModel", "View Model 1", "View Model", "LiveIcon", "Live Icon", "Live", "FOTMOB Live Icon" }
            for _, n in names do
                if inst == nil then
                    local vm = makeVM(n or "")
                    local p = findLiveProp(vm)
                    if p ~= nil then
                        local okI, b = pcall(function(): any return src:instance(vm) end)
                        if okI and b ~= nil then
                            inst, prop = b, p
                        end
                    end
                end
            end
        end
        if inst == nil then
            if not okInst or a == nil then return end
            inst = a
        end
        local ia = inst :: Artboard<nil>
        self.icon = ia
        self.iconLive = prop
        local minx, miny, w, h = 174, 181, 264, 137
        if math.abs(ia.width - 500) > 1 or math.abs(ia.height - 500) > 1 then
            local okB, mn, mx = pcall(function(): (Vector, Vector) return ia:bounds() end)
            minx, miny, w, h = 0, 0, ia.width, ia.height
            if okB and mn ~= nil and mx ~= nil then
                minx, miny, w, h = mn.x, mn.y, mx.x - mn.x, mx.y - mn.y
            end
        end
        if w <= 0 or h <= 0 then w, h = 110, 40 end
        local k = 40 / h
        local dw = w * k
        self.iconRect = { 324 - dw, 62, dw, 40, k, minx, miny }
        -- the app opens in Live mode, so the icon starts in its live state too
        syncIcon(self)
    end
end

local function iconLocal(self: Scoreline, p: Vector): Vector
    local ir, o = self.iconRect, self.iconO
    return Vector.xy((p.x - o[1] - ir[1]) / ir[5] + ir[6], (p.y - o[2] - ir[2]) / ir[5] + ir[7])
end
local function inIcon(self: Scoreline, p: Vector): boolean
    local ir, o = self.iconRect, self.iconO
    if self.icon == nil or self.sheetOpen then return false end
    if not self.desk and (self.scene ~= nil or self.screen.b ~= 0 or tv(self.screen, nowOf(self)) > 0.01) then return false end
    local x, y = p.x - o[1], p.y - o[2]
    return x >= ir[1] and x <= ir[1] + ir[3] and y >= ir[2] and y <= ir[2] + ir[4]
end

-- ---------------------------------------------------------------------
-- phone or desktop. Inputs arrive after init, so this also runs when the
-- desktop input changes: the desktop opens the featured match in the
-- middle pane and the followed player beside it.
-- ---------------------------------------------------------------------
local function setLayout(self: Scoreline, desk: boolean)
    self.desk = desk
    self.aw, self.ah = if desk then DESK_W else W, if desk then DESK_H else H
    self.clipTop, self.clipBot, self.clipL, self.clipR = 0, self.ah, 0, self.aw
    self.toastO = if desk then PANES.c else { 0, 0 }
    if not desk then
        -- the phone opens on the list again
        self.screen, self.pv.open = tween(0), false
        return
    end
    local dm = featured(self) or liveMatches(self)[1] or self.matches[1]
    if dm then
        self.openId = 0
        openMatch(self, dm.id)
        self.screenT, self.tabOpenT = -100, -100
    end
    local f = self.fol
    if f ~= nil then
        local pm = matchOf(self, f.team)
        if pm ~= nil then
            openPlayer(self, f.team, f.n, nil)
            self.pv.mid, self.pv.t = pm.id, -100
        end
    end
end

-- =====================================================================
-- LIFECYCLE
-- =====================================================================
function init(self: Scoreline, context: Context): boolean
    self.fonts = {}
    for key, set in GLYPHS do
        local out: GlyphSet = {}
        for ch, g in set do
            local cmds = parseCmds(g[2] :: string)
            local gp = Path.new()
            emit(gp, cmds, 0, 0, 1)
            out[ch] = { adv = g[1] :: number, path = gp, cmds = cmds }
        end
        self.fonts[key] = out
    end
    self.tcache, self.tcount = {}, 0
    self.shapes, self.scount = {}, 0
    self.sfast = {}
    self.unit = Path.new()
    self.unit:moveTo(Vector.xy(0, 0))
    self.unit:lineTo(Vector.xy(1, 0))
    self.unit:lineTo(Vector.xy(1, 1))
    self.unit:lineTo(Vector.xy(0, 1))
    self.unit:close()
    self.circ = Path.new()
    addCircle(self.circ, 0, 0, 1)
    self.icons = buildIcons()
    self.grads, self.gcount = {}, 0
    self.pc, self.px, self.pn = {}, {}, 0
    self.frame, self.retired = 0, {}
    self.ui = {}
    self.hover = { x = -1, y = -1, on = false }
    self.press = { id = "", x = 0, y = 0 }
    self.clock0 = 21 * 3600 + 58 * 60
    self.ga, self.ox, self.oy, self.ostack = 1, 0, 0, {}
    -- phone until the desktop input says otherwise (see setLayout)
    self.desk, self.aw, self.ah = false, W, H
    self.clipTop, self.clipBot, self.clipL, self.clipR = 0, H, 0, W
    self.deskTab, self.deskTabK, self.deskTabT = 1, tween(0), -100
    self.insightScroll = { y = 0, v = 0, max = 0 }
    self.iconO = { 0, 0 }
    self.toastO = { 0, 0 }
    self.hits = {}
    self.tm = {}
    self.t, self.playing = 0, false
    refreshTiming(self)
    -- photos (optional assets)
    self.atlas = {}
    self.sampler = ImageSampler("clamp", "clamp", "bilinear")
    if context ~= nil then
        for _, team in { "fra", "arg" } do
            for _, name in { "squad_" .. team, "squad_" .. team .. ".png", "squad_" .. team .. ".webp" } do
                if self.atlas[team] == nil then
                    local ok, img = pcall(function(): Image? return context:image(name) end)
                    if ok and img ~= nil then self.atlas[team] = img end
                end
            end
        end
    end
    -- app state: it opens on Ongoing, with the live cards
    self.matches = makeMatches()
    self.rand = rng(20260921)
    self.evSeq = 100
    self.day, self.liveOnly, self.openId, self.tab = 3, true, 0, 1
    -- the live cards are already up on the first frame (they rise when Live is switched on)
    self.liveK, self.liveOnT, self.liveOffT = tween(1), -100, -100
    self.screen, self.screenT = tween(0), -100
    self.feedT, self.feedDir, self.paneT, self.paneDir = -100, 1, -100, 0
    self.dayShift, self.dayIndX, self.dayIndW = tween(0), tween(0), tween(0)
    self.tabIndX = tween(20)
    self.listScroll = { y = 0, v = 0, max = 0 }
    self.detailScroll = { y = 0, v = 0, max = 0 }
    self.playerScroll = { y = 0, v = 0, max = 0 }
    self.drag = { active = false, x0 = 0, y0 = 0, lastY = 0, lastT = 0, moved = false, target = "", start = 0, vy = 0 }
    self.collapsed = {}
    self.favMatch = {}
    self.luSide, self.luK, self.luT = "h", tween(0), -100
    self.evAll, self.evT = false, -100
    self.heads = {}
    self.pv = { open = false, t = -100, team = "fra", n = 0, mid = 0, from = {}, prevT = -100, dir = 0, bars = { tween(0), tween(0), tween(0), tween(0), tween(0) }, rating = tween(6), origin = "match" }
    self.sheetOpen, self.sheetT = false, -100
    self.toast = { m = 0, ev = nil, t = -100, dy = 0, outT = -1, outFrom = 0, held = false }
    self.scene = nil
    self.lastGoal = { m = 0, ev = nil }
    self.heroBumpT, self.heroBumpSide = -100, ""
    self.tickAcc, self.endedT, self.tabOpenT = 0, -1, -100
    self.firstLayout = true
    self.auto = true
    local f = featured(self)
    if f then
        ensureEvents(f)
        self.favMatch[f.id] = true
    end
    -- following Messi from the start; his card already says what he is doing, so the
    -- first frame (in the editor and on Play) is the settled page
    local fol0 = newFollow("arg", 10, -100)
    fol0.nextT = 1.5
    local fm = matchOf(self, "arg")
    if fm ~= nil then
        local runTxt = "Off the ball, drifting into space"
        for _, a in DATA.acts do
            if a[1] == "run" then runTxt = a[3] :: string end
        end
        table.insert(fol0.acts, { t = -100, txt = runTxt, kind = "run", clock = pad2(math.min(fm.min, 99)) .. ":" .. pad2(fm.sec) })
    end
    self.fol = fol0
    for _, m in self.matches do
        if m.status == "live" then ensureEvents(m) end
    end
    local n = #liveMatches(self)
    for _, m in self.matches do
        if m.status == "live" then m.cw = tween((366 - 4 * (n - 1)) / n) end
    end
    self.vm, self.vmOut, self.vmPoll, self.vmPrimed, self.evIds = {}, {}, {}, false, {}
    self.feedMode = false
    if context ~= nil then pcall(bindVM, self, context) end
    self.icon, self.iconLive, self.iconRect, self.iconDown = nil, nil, { 0, 0, 0, 0, 1, 0, 0 }, false
    pcall(setupIcon, self)
    setLayout(self, (self :: any).desktop == true)
    self.ready = true
    return true
end

local function ensureReady(self: Scoreline)
    if not self.ready then init(self, nil :: any) end
    if self.icon == nil and (self.liveIcon :: any) ~= nil and self.iconTries < 3 then
        self.iconTries += 1
        pcall(setupIcon, self)
    end
end

function update(self: Scoreline)
    if not self.ready then return end
    refreshTiming(self)
    local desk = (self :: any).desktop == true
    if desk ~= self.desk then setLayout(self, desk) end
    if self.icon == nil and (self.liveIcon :: any) ~= nil then
        self.iconTries = 0
        pcall(setupIcon, self)
    end
end

local function stepScroll(s: Scroll, dt: number, dragging: boolean)
    if dragging then return end
    if math.abs(s.v) > 1 then
        s.y += s.v * dt
        s.v *= math.exp(-dt * 3.2)
    else
        s.v = 0
    end
    if s.y < 0 then
        s.y += (0 - s.y) * math.min(1, dt * 14)
        s.v *= 0.5
        if s.y > -0.3 then s.y = 0 end
    elseif s.y > s.max then
        s.y += (s.max - s.y) * math.min(1, dt * 14)
        s.v *= 0.5
        if s.y < s.max + 0.3 then s.y = s.max end
    end
end

local function dismissToast(self: Scoreline)
    local ts = self.toast
    if ts.ev == nil or ts.outT >= 0 then return end
    local now = nowOf(self)
    local y = toastRect(self, now)
    ts.outFrom = y
    ts.outT = now
    ts.held = false
end

function advance(self: Scoreline, seconds: number): boolean
    ensureReady(self)
    local ic = self.icon
    if ic ~= nil then ic:advance(math.max(seconds, 0)) end
    local lp = self.iconLive
    if lp ~= nil and lp.value ~= self.liveOnly then setLive(self, lp.value == true) end
    if ((self :: any).desktop == true) ~= self.desk then setLayout(self, not self.desk) end
    if seconds <= 0 then return true end
    if not self.playing then
        self.playing = true
        self.t = 0
    end
    local dt = math.min(seconds, 0.1)
    self.t += dt
    if self.t - self.tmT > 0.5 then refreshTiming(self) end
    self.tickAcc += dt
    while self.tickAcc >= 1 do
        self.tickAcc -= 1
        tick(self)
    end
    followAct(self, self.t)
    syncVM(self)
    local dragging = self.drag.active and self.drag.moved
    stepScroll(self.listScroll, dt, dragging and self.drag.target == "list")
    stepScroll(self.detailScroll, dt, dragging and self.drag.target == "detail")
    stepScroll(self.playerScroll, dt, dragging and self.drag.target == "player")
    stepScroll(self.insightScroll, dt, dragging and self.drag.target == "insight")
    -- goal notification: springs back after a short drag, leaves on its own after a while
    local ts = self.toast
    if ts.ev ~= nil and not ts.held then
        if math.abs(ts.dy) > 0.1 then ts.dy *= math.exp(-dt * 16) else ts.dy = 0 end
        local hold = math.max(tonumber((self :: any).toastHold) or 4.5, 0.5)
        if ts.outT < 0 and self.t - ts.t > tmOf(self, "toast").dur + hold then dismissToast(self) end
        if ts.outT >= 0 and self.t - ts.outT > 0.4 then ts.ev = nil end
    end
    local sc = self.scene
    if sc ~= nil then
        local hold = math.max(tonumber((self :: any).goalHold) or 7.5, 1)
        if sc.outT < 0 and self.t - sc.t0 > math.max(hold, sceneEnd(self) - 1.4) then sc.outT = self.t end
        if sc.outT >= 0 and self.t - sc.outT > 0.45 then self.scene = nil end
    end
    return true
end

function draw(self: Scoreline, r: Renderer)
    if not self.ready then init(self, nil :: any) end
    -- caches are trimmed here, between frames. A trimmed cache stays referenced
    -- for a second, and paints not drawn for a second are let go, so nothing a
    -- frame still in flight in the editor's preview uses is ever collected.
    self.frame += 1
    if self.tcount > 3000 then retire(self, self.tcache); self.tcache, self.tcount = {}, 0 end
    if self.scount > 1500 then retire(self, self.shapes); self.shapes, self.scount = {}, 0 end
    if self.gcount > 900 then retire(self, self.grads); self.grads, self.gcount = {}, 0 end
    if self.frame % 30 == 0 then
        local old = self.frame - 60
        if #self.retired > 0 and self.retired[1][1] < old then
            local keep: { { any } } = {}
            for _, e in self.retired do
                if e[1] >= old then table.insert(keep, e) end
            end
            self.retired = keep
        end
        for cc, byCol in self.pc do
            local any = false
            for k, e in byCol do
                if e[2] < old then
                    byCol[k] = nil
                    self.pn -= 1
                else
                    any = true
                end
            end
            if not any then self.pc[cc] = nil end
        end
        for k, e in self.px do
            if e[2] < old then
                self.px[k] = nil
                self.pn -= 1
            end
        end
        -- a control's motion state is kept while it is in play, and let go ten seconds
        -- after it was last drawn (one is made per player, event and match ever shown)
        local gone = self.frame - 600
        for k, st in self.ui do
            if st.seen < gone and not st.pr and not st.hv then self.ui[k] = nil end
        end
    end
    self.hits = {}
    self.ga, self.ox, self.oy, self.ostack = 1, 0, 0, {}
    self.clipTop, self.clipBot, self.clipL, self.clipR = 0, self.ah, 0, self.aw
    local now = nowOf(self)
    if self.firstLayout then
        placeDayInd(self, now, false)
        self.firstLayout = false
    end
    if self.desk then
        r:save()
        clipRect(self, r, 0, 0, self.aw, self.ah)
        drawDesktop(self, r, now)
        r:restore()
        return
    end
    r:save()
    clipRect(self, r, 0, 0, W, H)
    local sp = tv(self.screen, now)
    push(self, r, -0.22 * W * sp, 0)
    drawListScreen(self, r, now)
    pop(self, r)
    if sp > 0.001 then
        rect(self, r, 0, 0, W, H, hex(0x000000, 0.7 * sp))
        local m = findMatch(self, self.openId)
        if m ~= nil then
            push(self, r, W * (1 - sp), 0)
            drawDetailScreen(self, r, m, now)
            pop(self, r)
        end
    end
    drawPlayerView(self, r, now)
    drawToast(self, r, now)
    drawScene(self, r, now)
    drawSheet(self, r, now)
    r:restore()
end

-- =====================================================================
-- TOUCH: tap anything, drag to scroll, swipe the goal notification away
-- =====================================================================
local function onToast(self: Scoreline, p: Vector): boolean
    if not self.desk and (self.sheetOpen or self.scene ~= nil) then return false end
    local ts = self.toast
    if ts.ev == nil or ts.outT >= 0 then return false end
    local y, vis = toastRect(self, nowOf(self))
    if not vis then return false end
    local x, py = p.x - self.toastO[1], p.y - self.toastO[2]
    return x >= TOAST.x and x <= TOAST.x + TOAST.w and py >= y and py <= y + TOAST.h
end

-- what a drag under this point scrolls
local function dragTarget(self: Scoreline, p: Vector): string
    if not self.desk then
        if self.sheetOpen or self.scene ~= nil then return "" end
        if self.pv.open then return if p.y > 96 then "player" else "" end
        if self.screen.b == 1 then return if p.y > DETAIL_TOP then "detail" else "" end
        return if p.y > LIST_TOP then "list" else ""
    end
    local function local_(key: string): (boolean, number)
        local o = PANES[key]
        return p.x >= o[1] and p.x <= o[1] + W and p.y >= o[2] and p.y <= o[2] + H, p.y - o[2]
    end
    local ina, ya = local_("a")
    if ina then return if not self.sheetOpen and ya > LIST_TOP then "list" else "" end
    local inb, yb = local_("b")
    if inb then return if self.scene == nil and yb > DETAIL_TOP then "detail" else "" end
    local inc, yc = local_("c")
    if inc and yc > DETAIL_TOP then return if self.deskTab == 1 then "player" else "insight" end
    return ""
end
local function scrollOf(self: Scoreline, target: string): Scroll
    if target == "detail" then return self.detailScroll end
    if target == "player" then return self.playerScroll end
    if target == "insight" then return self.insightScroll end
    return self.listScroll
end

-- the control under a point (the one drawn last wins), for the press feel
local function hitAt(self: Scoreline, p: Vector): Hit?
    for i = #self.hits, 1, -1 do
        local h = self.hits[i]
        if p.x >= h.x and p.x <= h.x + h.w and p.y >= h.y and p.y <= h.y + h.h then return h end
    end
    return nil
end

function pointerDown(self: Scoreline, event: PointerEvent)
    ensureReady(self)
    local p = event.position
    self.hover = { x = p.x, y = p.y, on = false }
    if onToast(self, p) then
        self.press = { id = "toast", x = p.x, y = p.y }
        self.toast.held = true
        self.drag = { active = true, x0 = p.x, y0 = p.y, lastY = p.y, lastT = self.t, moved = false, target = "toast", start = self.toast.dy, vy = 0 }
        event:hit()
        return
    end
    local ic = self.icon
    if ic ~= nil and inIcon(self, p) then
        ic:pointerDown(PointerEvent.new(event.id, iconLocal(self, p)))
        self.iconDown = true
        self.drag.active = false
        event:hit()
        return
    end
    local target = dragTarget(self, p)
    local s = scrollOf(self, target)
    s.v = 0
    self.drag = { active = true, x0 = p.x, y0 = p.y, lastY = p.y, lastT = self.t, moved = false, target = target, start = s.y, vy = 0 }
    local h = hitAt(self, p)
    self.press = { id = if h then h.id else "", x = p.x, y = p.y }
    event:hit()
end

function pointerMove(self: Scoreline, event: PointerEvent)
    if not self.ready then return end
    local d = self.drag
    local p = event.position
    if not d.active then
        -- a mouse moving over the app: controls under it light up
        self.hover = { x = p.x, y = p.y, on = true }
        return
    end
    if not d.moved and (math.abs(p.y - d.y0) > 6 or math.abs(p.x - d.x0) > 6) then
        d.moved = true
        self.press.id = ""
    end
    local dt = self.t - d.lastT
    if dt > 0.001 then d.vy = d.vy * 0.3 + ((p.y - d.lastY) / dt) * 0.7 end
    if d.target == "toast" then
        local dy = p.y - d.y0
        self.toast.dy = if dy < 0 then dy else dy * 0.25
    elseif d.moved and d.target ~= "" then
        local s = scrollOf(self, d.target)
        local y = d.start - (p.y - d.y0)
        if y < 0 then y *= 0.4 elseif y > s.max then y = s.max + (y - s.max) * 0.4 end
        if dt > 0.001 then
            s.v = s.v * 0.3 + ((d.lastY - p.y) / dt) * 0.7
        end
        s.y = y
    end
    d.lastY, d.lastT = p.y, self.t
    event:hit()
end

function pointerUp(self: Scoreline, event: PointerEvent)
    if not self.ready then return end
    -- a tap shorter than a frame still gets its dip
    local st = self.ui[self.press.id]
    if st ~= nil and not st.pr then
        st.pk, st.rt = 0.8, nowOf(self)
    end
    self.press.id = ""
    local ic = self.icon
    if ic ~= nil and self.iconDown then
        self.iconDown = false
        ic:pointerUp(PointerEvent.new(event.id, iconLocal(self, event.position)))
        if self.iconLive == nil then toggleLive(self) end
        event:hit()
        return
    end
    local d = self.drag
    if not d.active then return end
    d.active = false
    local p = event.position
    if d.target == "toast" then
        local ts = self.toast
        ts.held = false
        if not d.moved then
            -- tap: open the goal
            local m = findMatch(self, ts.m)
            local ev = ts.ev
            if m and ev then
                -- the desktop plays it in the middle pane, with its match
                if self.desk then openMatch(self, m.id) end
                openScene(self, m, ev, if ev.kind == "rc" then "red" else "goal")
            end
        elseif ts.dy < -26 or d.vy < -380 then
            dismissToast(self)
        end
        event:hit()
        return
    end
    if not d.moved then
        for i = #self.hits, 1, -1 do
            local h = self.hits[i]
            if p.x >= h.x and p.x <= h.x + h.w and p.y >= h.y and p.y <= h.y + h.h then
                h.fn()
                break
            end
        end
    else
        local s = scrollOf(self, d.target)
        if self.t - d.lastT > 0.12 then s.v = 0 end
        s.v = math.clamp(s.v, -4000, 4000)
    end
    event:hit()
end

end
end
buildApp()

return function(): Node<Scoreline>
    return {
        init = init,
        update = update,
        advance = advance,
        draw = draw,
        pointerDown = pointerDown,
        pointerMove = pointerMove,
        pointerUp = pointerUp,

        liveIcon = nil :: any,
        iconViewModel = "",
        cardsDur = 0.75, cardsDelay = 0.1, cardsStagger = 0.06, cardsX1 = 0.16, cardsY1 = 1, cardsX2 = 0.3, cardsY2 = 1,
        liveDur = 0.6, liveDelay = 0, liveStagger = 0.04, liveX1 = 0.16, liveY1 = 1, liveX2 = 0.3, liveY2 = 1,
        listDur = 0.5, listDelay = 0.05, listStagger = 0.03, listX1 = 0.2, listY1 = 0.8, listX2 = 0.2, listY2 = 1,
        screenDur = 0.55, screenDelay = 0, screenStagger = 0.05, screenX1 = 0.16, screenY1 = 1, screenX2 = 0.3, screenY2 = 1,
        tabsDur = 0.45, tabsDelay = 0, tabsStagger = 0.06, tabsX1 = 0.2, tabsY1 = 0.8, tabsX2 = 0.2, tabsY2 = 1,
        momentumDur = 0.9, momentumDelay = 0.1, momentumStagger = 0.06, momentumX1 = 0.16, momentumY1 = 1, momentumX2 = 0.3, momentumY2 = 1,
        eventsDur = 0.5, eventsDelay = 0.15, eventsStagger = 0.04, eventsX1 = 0.16, eventsY1 = 1, eventsX2 = 0.3, eventsY2 = 1,
        statsDur = 0.9, statsDelay = 0.15, statsStagger = 0.06, statsX1 = 0.16, statsY1 = 1, statsX2 = 0.3, statsY2 = 1,
        lineupDur = 0.6, lineupDelay = 0.1, lineupStagger = 0.14, lineupX1 = 0.16, lineupY1 = 1, lineupX2 = 0.3, lineupY2 = 1,
        squadDur = 0.5, squadDelay = 0.3, squadStagger = 0.03, squadX1 = 0.16, squadY1 = 1, squadX2 = 0.3, squadY2 = 1,
        playerDur = 0.72, playerDelay = 0.12, playerStagger = 0.05, playerX1 = 0.32, playerY1 = 0, playerX2 = 0.1, playerY2 = 1,
        toastDur = 0.6, toastDelay = 0.45, toastStagger = 0.2, toastX1 = 0.16, toastY1 = 1, toastX2 = 0.3, toastY2 = 1,
        goalDur = 0.7, goalDelay = 0.1, goalStagger = 0.55, goalX1 = 0.16, goalY1 = 1, goalX2 = 0.3, goalY2 = 1,
        followDur = 0.5, followDelay = 0, followStagger = 0.06, followX1 = 0.16, followY1 = 1, followX2 = 0.3, followY2 = 1,
        speed = 1,
        toastHold = 4.5,
        goalHold = 7.5,
        goalFocus = 4,
        goalMark = 8,
        desktop = false,
        icon = nil, iconLive = nil, iconRect = { 0, 0, 0, 0, 1, 0, 0 }, iconDown = false, ready = false, iconTries = 0,
        t = 0, playing = false, tm = late(), tmT = 0,
        fonts = late(), tcache = late(), tcount = 0, shapes = late(), sfast = late(), scount = 0,
        unit = late(), circ = late(), icons = late(), grads = late(), gcount = 0,
        pc = late(), px = late(), pn = 0, ga = 1, ox = 0, oy = 0, ostack = late(),
        clipTop = 0, clipBot = 844, hits = late(), atlas = late(), sampler = late(),
        frame = 0, retired = late(), ui = late(), hover = late(), press = late(), clock0 = 0,
        vm = late(), auto = true, feedMode = false, vmOut = late(), vmPoll = late(), vmPrimed = false, evIds = late(),
        day = 3, liveOnly = true, liveK = late(), liveOnT = 0, liveOffT = -100, openId = 0, tab = 1,
        screen = late(), screenT = -100, feedT = -100, feedDir = 1, paneT = -100, paneDir = 0,
        dayShift = late(), dayIndX = late(), dayIndW = late(), tabIndX = late(),
        listScroll = late(), detailScroll = late(), playerScroll = late(), drag = late(),
        collapsed = late(), favMatch = late(), fol = nil,
        luSide = "h", luK = late(), luT = -100, evAll = false, evT = -100, heads = late(), pv = late(),
        sheetOpen = false, sheetT = -100,
        toast = late(), scene = nil, lastGoal = late(),
        tickAcc = 0, endedT = -1, rand = late(), evSeq = 100, matches = late(),
        tabOpenT = -100, heroBumpT = -100, heroBumpSide = "",
        firstLayout = true,
        desk = false, aw = 390, ah = 844, deskTab = 1, deskTabK = late(), deskTabT = -100, insightScroll = late(),
        clipL = 0, clipR = 390, iconO = late(), toastO = late(),
    }
end
