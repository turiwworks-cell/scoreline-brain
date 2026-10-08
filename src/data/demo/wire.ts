// The demo's state as the v2 wire contract (docs/DATA-CONTRACT.md §2–3): what an adapter server
// would send. DemoSource parses these with the same schemas as ApiSource before handing them on.

import { applyFeed, emptyState, parseFeed, standings, type LeagueBase } from '../../domain';
import { DAYS, LEAGUES, NEXT, SQUADS, TEAMS, VENUES } from './data';
import { coachOf, playerStats, squadOf, type LSide, type SimEvent, type SimKind, type SimMatch } from './model';
import type { DemoSim, Outgoing } from './sim';

type Json = Record<string, unknown>;

const KIND: Record<Exclude<SimKind, 'foulx'>, string> = {
  goal: 'goal',
  yc: 'yellow',
  rc: 'red',
  sub: 'sub',
  sot: 'shot',
  miss: 'miss',
  block: 'blocked',
  big: 'bigChance',
  corner: 'corner',
  foul: 'foul',
  offside: 'offside',
};

const STATUS = { live: 'live', ns: 'scheduled', ft: 'finished' } as const;
const SIDE = { h: 'home', a: 'away' } as const;

const hex = (c: number) => `#${c.toString(16).padStart(6, '0').toUpperCase()}`;
const round = (x: number, places: number) => Math.round(x * 10 ** places) / 10 ** places;

/** A league's team list and earlier results (`luau:1799–1810`): what its table is counted from. */
export const LEAGUE_BASES: Readonly<Record<string, LeagueBase>> = Object.fromEntries(
  LEAGUES.map((l) => [l.id, { teams: l.teams, prior: l.prior.map(([home, away, h, a]) => ({ home, away, score: [h, a] as const })) }]),
);

// ── Events ───────────────────────────────────────────────────────────────────

/** An event as it sits in a feed's `matches[].events` (no `match`). Undefined for `foulx`. */
export function eventJson(e: SimEvent): Json | undefined {
  if (e.kind === 'foulx') return undefined;
  return {
    id: e.id,
    seq: e.seq,
    kind: KIND[e.kind],
    side: SIDE[e.side],
    minute: e.min,
    ...(e.pn > 0 ? { player: e.pn } : {}),
    ...(e.on > 0 ? { other: e.on } : {}),
    ...(e.kind === 'goal' && e.gt !== '' ? { style: e.gt } : {}),
    ...(e.xg > 0 ? { xg: round(e.xg, 2) } : {}),
    score: [...e.score],
    ...(e.txt !== '' ? { text: e.txt } : {}),
  };
}

/** One `/events` message for something the simulation sent. Undefined for a snapshot. */
export function messageJson(o: Outgoing): Json | undefined {
  switch (o.type) {
    case 'event': {
      const e = eventJson(o.event);
      return e ? { ...e, match: o.match.id } : undefined;
    }
    case 'fulltime':
      return { id: o.id, seq: o.seq, match: o.match.id, kind: 'fulltime', minute: o.match.min, score: [...o.score] };
    case 'minute':
      return { match: o.match.id, kind: 'minute', minute: o.match.min, second: o.match.sec };
    case 'action':
      return { match: o.match.id, kind: 'action', side: SIDE[o.side], player: o.player, text: o.text, act: o.act, ...(o.onBall ? { onBall: true } : {}) };
    case 'snapshot':
      return undefined;
  }
}

// ── Feed ─────────────────────────────────────────────────────────────────────

function playersJson(m: SimMatch, side: LSide): Json {
  const lu = m.lu[side];
  const out: Json = {};
  for (const n of [...lu.xi, ...lu.bench]) {
    const p = playerStats(m, side, n);
    if (!p.played) continue;
    out[String(n)] = { rating: p.rating, minutes: p.minutes, touches: p.touches, passes: p.passes, passesOk: p.passesOk, shots: p.shots, ...(p.saves !== undefined ? { saves: p.saves } : {}) };
  }
  return out;
}

function matchJson(m: SimMatch): Json {
  const started = m.status !== 'ns';
  const venue = VENUES[m.h];
  return {
    id: m.id,
    seq: m.seq,
    // Lua days 0 / 1 / 2 are the contract's -1 / 0 / 1.
    day: m.day - 1,
    league: m.lg,
    home: m.h,
    away: m.a,
    score: [m.hs, m.as],
    status: STATUS[m.status],
    minute: m.min,
    second: m.status === 'live' ? m.sec : 0,
    kickoff: m.time,
    // France – Argentina is featured and the one favourite (`luau:2410`, `8501`).
    featured: m.feat,
    favourite: m.feat,
    ...(venue ? { venue: { name: venue[0], city: venue[1], referee: venue[2], attendance: venue[3] } } : {}),
    lineups: {
      home: { formation: m.lu.h.form, xi: [...m.lu.h.xi], bench: [...m.lu.h.bench] },
      away: { formation: m.lu.a.form, xi: [...m.lu.a.xi], bench: [...m.lu.a.bench] },
    },
    events: m.events.flatMap((e) => eventJson(e) ?? []),
    ...(started
      ? {
          stats: { possession: m.poss, ...Object.fromEntries(Object.entries(m.stats).map(([k, v]) => [k, [...v]])) },
          momentum: m.mom.slice(0, m.min + 1).map((v) => round(v ?? 0, 3)),
          players: { home: playersJson(m, 'h'), away: playersJson(m, 'a') },
        }
      : {}),
  };
}

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
/** The demo clock starts at 21:58 on Monday 21 September (`luau:2258`). */
const START_S = 21 * 3600 + 58 * 60;

function nextJson(elapsed: number): Json {
  const out: Json = {};
  for (const [team, [opponent, days, time]] of Object.entries(NEXT)) {
    const [hh = 0, mm = 0] = time.split(':').map(Number);
    out[team] = {
      opponent,
      date: `${WEEKDAYS[days % 7]} ${21 + days} Sep`,
      time,
      in: Math.max(0, days * 86400 + hh * 3600 + mm * 60 - START_S - elapsed),
    };
  }
  return out;
}

function squadsJson(): Json {
  const out: Json = {};
  for (const team of Object.keys(SQUADS)) {
    const coach = coachOf(team);
    out[team] = {
      ...(coach !== undefined ? { coach } : {}),
      players: squadOf(team).map((p) => ({
        n: p.n,
        first: p.first,
        last: p.last,
        short: p.short,
        pos: p.pos,
        ...(p.role !== '' ? { role: p.role } : {}),
        ...(p.club !== '' ? { club: p.club } : {}),
        ...(p.born[0] > 0 ? { born: p.born.map((x, i) => String(x).padStart(i === 0 ? 4 : 2, '0')).join('-') } : {}),
        ...(p.h > 0 ? { height: p.h } : {}),
      })),
    };
  }
  return out;
}

/**
 * The whole picture as a v2 feed. Every league with a team list gets its `table`, counted by the
 * domain's `standings` from the league's earlier results plus every started match, exactly as
 * the Lua counted it (`luau:2923–2976`). The client then shows the table as sent: the team lists
 * and earlier results stay demo data and never need a place in the contract.
 */
export function feedJson(sim: DemoSim): Json {
  // the Lua's demo leagues set no `q`, so their tables marked the top two (`L.q or 2`, luau:5724)
  const leagues: Json[] = LEAGUES.map((l) => ({ id: l.id, country: l.country, name: l.name, matchday: l.matchday, qualify: 2, qualifyLabel: 'Qualify · top two' }));
  const feed: Json = {
    version: 2,
    days: [...DAYS],
    teams: TEAMS.map((t) => ({ id: t.id, name: t.name, short: t.short, colors: [hex(t.c1), hex(t.c2)] })),
    leagues,
    squads: squadsJson(),
    matches: sim.matches.map(matchJson),
    next: nextJson(sim.elapsed),
  };
  const counted = applyFeed(emptyState(), parseFeed(feed), 0).state;
  return {
    ...feed,
    leagues: leagues.map((l) => {
      const base = LEAGUE_BASES[l.id as string];
      if (!base || base.teams.length === 0) return l;
      const table = standings(counted, l.id as string, base).map(({ team, p, w, d, l: lost, gf, ga, pts }) => ({ team, p, w, d, l: lost, gf, ga, pts }));
      return { ...l, table };
    }),
  };
}
