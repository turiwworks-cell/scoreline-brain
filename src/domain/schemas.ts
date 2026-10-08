// Zod schemas for the wire contract (docs/DATA-CONTRACT.md).
//
// Lenient, like the Lua's `num(v, d)` / `text(v, d)`: a wrong or missing field falls back to its
// default instead of throwing, and a list item that can't be used at all (no id, unknown kind) is
// dropped on its own without taking the rest of the feed with it.

import { z } from 'zod/mini';
import { equalWire, share } from './share';
import { STORED_KINDS } from './kinds';
import { colorOf } from './colorOf';
export { colorOf } from './colorOf';
export { STORED_KINDS } from './kinds';
import type {
  EventKind,
  Feed,
  FeedMatch,
  FeedSquad,
  FlagCommand,
  GoalStyle,
  League,
  LiveEvent,
  Lineup,
  MatchStats,
  MatchStatus,
  Score,
  Side,
  StoredKind,
  TableRow,
  Team,
  Venue,
  WireEvent,
} from './types';

// ── Primitives ───────────────────────────────────────────────────────────────

function toNum(v: unknown): number | undefined {
  if (typeof v === 'number') return Number.isFinite(v) ? v : undefined;
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}

function toText(v: unknown): string | undefined {
  if (typeof v === 'string') return v;
  if (typeof v === 'number' && Number.isFinite(v)) return String(v);
  return undefined;
}

const num = (d: number) => z.transform((v) => toNum(v) ?? d);
const optNum = z.transform((v) => toNum(v));
const text = (d: string) => z.transform((v) => toText(v) ?? d);
const optText = z.transform((v) => toText(v));
const record = z.transform((v): Record<string, unknown> => (v !== null && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {}));
const list = z.transform((v): unknown[] => (Array.isArray(v) ? v : []));

/**
 * Like `z.object`, but every field is read even when its key is missing, so a field's own
 * fallback applies (Zod 4 rejects a missing key unless the schema is `.optional()`).
 */
function fields<S extends Record<string, z.ZodMiniType>>(shape: S) {
  const entries = Object.entries(shape);
  return z.pipe(record, z.transform((r, ctx) => {
    const out: Record<string, unknown> = {};
    for (const [k, schema] of entries) {
      const p = schema.safeParse(r[k]);
      if (!p.success) {
        ctx.issues.push({ input: ctx.value, code: 'custom', message: `${k}: ${p.error.issues[0]?.message ?? 'invalid'}`, path: [k] });
        return z.NEVER;
      }
      out[k] = p.data;
    }
    return out as { [K in keyof S]: z.output<S[K]> };
  }));
}

/** Parses each item on its own and keeps the ones that pass. */
function lenientList<T>(item: z.ZodMiniType<T>) {
  return z.pipe(list, z.transform((items) =>
    items.flatMap((x) => {
      const r = item.safeParse(x);
      return r.success ? [r.data] : [];
    }),
  ));
}

/** A record whose values are parsed on their own; failing values are dropped. */
function lenientRecord<T>(value: z.ZodMiniType<T>) {
  return z.pipe(record, z.transform((r) => {
    const out: Record<string, T> = {};
    for (const [k, v] of Object.entries(r)) {
      const p = value.safeParse(v);
      if (p.success) out[k] = p.data;
    }
    return out;
  }));
}


const side = z.transform((v): Side => (v === 'away' || v === 'a' ? 'away' : 'home'));

const score = z.transform((v): Score => {
  const a = Array.isArray(v) ? v : [];
  return [toNum(a[0]) ?? 0, toNum(a[1]) ?? 0];
});
const optScore = z.transform((v): Score | undefined => (Array.isArray(v) ? score.parse(v) : undefined));

const pair = z.transform((v): readonly [number, number] | undefined => (Array.isArray(v) ? score.parse(v) : undefined));

const STATUS: Record<string, MatchStatus> = { live: 'live', ns: 'scheduled', scheduled: 'scheduled', ft: 'finished', finished: 'finished' };
const status = z.transform((v): MatchStatus => STATUS[toText(v) ?? ''] ?? 'scheduled');

const STYLES: readonly GoalStyle[] = ['through', 'cutback', 'header', 'solo'];
const style = z.transform((v): GoalStyle | undefined => (STYLES as readonly unknown[]).includes(v) ? (v as GoalStyle) : undefined);

const EVENT_KINDS: readonly EventKind[] = [...STORED_KINDS, 'kickoff', 'fulltime', 'minute', 'action'];

const storedKind = z.custom<StoredKind>((v) => (STORED_KINDS as readonly unknown[]).includes(v));
const eventKind = z.custom<EventKind>((v) => (EVENT_KINDS as readonly unknown[]).includes(v));

// ── Feed parts ───────────────────────────────────────────────────────────────

const flagCommand = z.transform((v, ctx): FlagCommand => {
  if (!Array.isArray(v) || typeof v[0] !== 'string') {
    ctx.issues.push({ input: ctx.value, code: 'custom', message: 'flag command' });
    return z.NEVER;
  }
  // Colours are normalized to "#RRGGBB"; numbers stay numbers.
  return v.map((x, i) => (i > 0 && typeof x === 'string' ? colorOf(x, '#000000') : typeof x === 'number' ? x : String(x)));
});

export const teamSchema: z.ZodMiniType<Omit<Team, 'coach'>> = z.pipe(record, z.transform((t, ctx) => {
  const id = toText(t.id) ?? '';
  if (id === '') {
    ctx.issues.push({ input: ctx.value, code: 'custom', message: 'team without id' });
    return z.NEVER;
  }
  const cols = Array.isArray(t.colors) ? t.colors : [];
  const name = toText(t.name) ?? id;
  const flag = Array.isArray(t.flag) ? lenientList(flagCommand).parse(t.flag) : undefined;
  return {
    id,
    name,
    short: toText(t.short) ?? name.slice(0, 3).toUpperCase(),
    colors: [colorOf(cols[0], '#8A8A8A'), colorOf(cols[1], '#E9E7E1')] as const,
    ...(flag ? { flag } : {}),
  };
}));

const tableRow: z.ZodMiniType<TableRow> = fields({
  team: text(''),
  p: num(0),
  w: num(0),
  d: num(0),
  l: num(0),
  gf: num(0),
  ga: num(0),
  pts: num(0),
});

export const leagueSchema: z.ZodMiniType<League> = z.pipe(record, z.transform((l, ctx) => {
  const id = toText(l.id) ?? '';
  if (id === '') {
    ctx.issues.push({ input: ctx.value, code: 'custom', message: 'league without id' });
    return z.NEVER;
  }
  const table = Array.isArray(l.table) ? lenientList(tableRow).parse(l.table) : [];
  return {
    id,
    country: toText(l.country) ?? '',
    name: toText(l.name) ?? id,
    matchday: toNum(l.matchday) ?? 1,
    qualify: toNum(l.qualify) ?? 0,
    qualifyLabel: toText(l.qualifyLabel) ?? 'Qualify',
    ...(table.length > 0 ? { table } : {}),
  };
}));

const squadPlayer = z.pipe(record, z.transform((p, ctx) => {
  const n = toNum(p.n) ?? -1;
  if (n < 0) {
    ctx.issues.push({ input: ctx.value, code: 'custom', message: 'player without number' });
    return z.NEVER;
  }
  const last = toText(p.last) ?? `#${n}`;
  return {
    n,
    first: toText(p.first) ?? '',
    last,
    short: toText(p.short) ?? last,
    pos: toText(p.pos) ?? 'MF',
    role: toText(p.role) ?? '',
    club: toText(p.club) ?? '',
    born: toText(p.born) ?? '',
    height: toNum(p.height) ?? 0,
  };
}));

const squad: z.ZodMiniType<FeedSquad> = z.pipe(record, z.transform((s) => {
  const coach = toText(s.coach);
  return { ...(coach !== undefined ? { coach } : {}), players: lenientList(squadPlayer).parse(s.players) };
}));

const venue: z.ZodMiniType<Venue> = fields({ name: text(''), city: text(''), referee: text(''), attendance: text('') });

const lineup: z.ZodMiniType<Lineup> = fields({
  formation: text(''),
  xi: lenientList(z.transform((v, ctx) => toNum(v) ?? (ctx.issues.push({ input: ctx.value, code: 'custom', message: 'shirt' }), z.NEVER))),
  bench: lenientList(z.transform((v, ctx) => toNum(v) ?? (ctx.issues.push({ input: ctx.value, code: 'custom', message: 'shirt' }), z.NEVER))),
});

const STAT_KEYS = ['xg', 'shots', 'onTarget', 'bigChances', 'corners', 'passes', 'fouls', 'offsides'] as const;

const stats = z.transform((v): MatchStats | undefined => {
  if (v === null || typeof v !== 'object' || Array.isArray(v)) return undefined;
  const st = v as Record<string, unknown>;
  const pairs: Record<string, readonly [number, number]> = {};
  for (const k of STAT_KEYS) {
    const p = pair.parse(st[k]);
    if (p) pairs[k] = p;
  }
  // Without any pairs the app counts the stats from the events.
  if (Object.keys(pairs).length === 0) return undefined;
  return { possession: toNum(st.possession) ?? 50, pairs };
});

const playerLines = lenientRecord(
  z.pipe(record, z.transform((row) => {
    const out: Record<string, number> = {};
    for (const [k, x] of Object.entries(row)) {
      const v = toNum(x);
      // a count the provider could not give stays unknown: it is not a save-less evening
      if (v === undefined && k === 'saves') continue;
      out[k] = v ?? 0;
    }
    return out;
  })),
);

/** Fields shared by a feed event and an `event` message. */
const eventFields = {
  side,
  minute: optNum,
  player: optNum,
  other: optNum,
  name: optText,
  otherName: optText,
  style,
  xg: optNum,
  text: optText,
  score: optScore,
  ref: optText,
};

/** A feed event before it has an id (see `withIds`). */
const feedEvent = fields({ id: optText, seq: optNum, kind: storedKind, ...eventFields });

type FeedEventNoId = Omit<WireEvent, 'id'> & { id?: string };

/** Events without an id get one made from what they say, so a re-sent feed matches itself. */
function withIds(events: readonly FeedEventNoId[]): WireEvent[] {
  const seen = new Map<string, number>();
  return events.map((e) => {
    if (e.id !== undefined && e.id !== '') return e as WireEvent;
    const base = `~${e.kind}-${e.side}-${e.minute ?? ''}-${e.player ?? ''}`;
    const k = (seen.get(base) ?? 0) + 1;
    seen.set(base, k);
    return { ...e, id: `${base}-${k}` };
  });
}

function strip<T extends object>(o: T): T {
  // Drop keys whose value is undefined, so structural sharing compares like with like.
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as T;
}

export const feedMatchSchema: z.ZodMiniType<FeedMatch> = z.pipe(record, z.transform((e, ctx) => {
  const id = toNum(e.id) ?? 0;
  const home = toText(e.home) ?? '';
  const away = toText(e.away) ?? '';
  if (id === 0 || home === '' || away === '') {
    ctx.issues.push({ input: ctx.value, code: 'custom', message: 'match needs id, home and away' });
    return z.NEVER;
  }
  const lus = record.parse(e.lineups);
  const lh = lus.home !== undefined ? lineup.safeParse(record.parse(lus.home)) : undefined;
  const la = lus.away !== undefined ? lineup.safeParse(record.parse(lus.away)) : undefined;
  const lineups = lh?.success || la?.success ? strip({ home: lh?.success ? lh.data : undefined, away: la?.success ? la.data : undefined }) : undefined;
  const pl = record.parse(e.players);
  const players = e.players !== undefined ? { home: playerLines.parse(pl.home), away: playerLines.parse(pl.away) } : undefined;
  const v = e.venue !== null && typeof e.venue === 'object' ? venue.parse(e.venue) : undefined;
  return strip({
    id,
    seq: toNum(e.seq) ?? 0,
    day: toNum(e.day) ?? 0,
    league: toText(e.league) ?? 'fri',
    home,
    away,
    score: score.parse(e.score),
    status: status.parse(e.status),
    minute: toNum(e.minute) ?? 0,
    second: toNum(e.second) ?? 0,
    kickoff: toText(e.kickoff) ?? '',
    featured: e.featured === true,
    favourite: e.favourite === true,
    venue: v,
    lineups,
    events: withIds(lenientList(feedEvent).parse(e.events).map(strip)),
    stats: stats.parse(e.stats),
    momentum: Array.isArray(e.momentum) ? e.momentum.map((x) => Math.min(1, Math.max(-1, toNum(x) ?? 0))) : undefined,
    players,
  });
}));

const nextFixture = fields({ opponent: text(''), date: text(''), time: text(''), in: num(0) });

export const feedSchema: z.ZodMiniType<Feed> = z.pipe(record, z.transform((f) => {
  const days = Array.isArray(f.days) ? f.days.filter((d): d is string => typeof d === 'string') : undefined;
  return strip({
    version: toNum(f.version) ?? 1,
    days,
    teams: lenientList(teamSchema).parse(f.teams),
    leagues: lenientList(leagueSchema).parse(f.leagues),
    squads: lenientRecord(squad).parse(f.squads),
    matches: lenientList(feedMatchSchema).parse(f.matches),
    next: lenientRecord(nextFixture).parse(f.next),
  });
}));

export const liveEventSchema: z.ZodMiniType<LiveEvent> = z.pipe(fields({
    id: optText,
    seq: optNum,
    match: z.transform((v, ctx) => {
      const n = toNum(v) ?? 0;
      if (n === 0) {
        ctx.issues.push({ input: ctx.value, code: 'custom', message: 'event without match' });
        return z.NEVER;
      }
      return n;
    }),
    kind: eventKind,
    ...eventFields,
    second: optNum,
    act: optText,
    onBall: z.transform((v) => (v === true ? true : undefined)),
  }), z.transform((e) => strip({ ...e, id: e.id === '' ? undefined : e.id })));

/** Never throws. Anything unusable becomes an empty feed. */
export function parseFeed(raw: unknown): Feed {
  return feedSchema.parse(raw);
}

type ParsedCache<T> = { input: unknown; value: T };

function cachedParse<T>(schema: z.ZodMiniType<T>, raw: unknown, prev?: ParsedCache<T>): ParsedCache<T> {
  if (prev && equalWire(prev.input, raw)) return prev;
  const value = share(prev?.value, schema.parse(raw));
  // Own the cached wire tree: transports and callers may reuse/mutate their input objects.
  // Non-JSON inputs remain lenient, but cannot be cached if structuredClone rejects them.
  try {
    return { input: structuredClone(raw), value };
  } catch {
    return { input: Symbol('uncacheable'), value };
  }
}

function memoParser<T>(schema: z.ZodMiniType<T>): (raw: unknown) => T {
  let prev: ParsedCache<T> | undefined;
  return (raw) => {
    prev = cachedParse(schema, raw, prev);
    return prev.value;
  };
}

/** A clock-only update still reads the new time, without revalidating its unchanged events. */
function clockOnly(prev: ParsedCache<FeedMatch>, raw: Record<string, unknown>): ParsedCache<FeedMatch> | undefined {
  if (prev.input === null || typeof prev.input !== 'object' || Array.isArray(prev.input)) return;
  const old = prev.input as Record<string, unknown>;
  const dataKeys = (r: Record<string, unknown>) => Object.keys(r).filter((k) => k !== 'minute' && k !== 'second');
  const keys = dataKeys(raw);
  if (keys.length !== dataKeys(old).length || !keys.every((k) => Object.hasOwn(old, k) && equalWire(old[k], raw[k]))) return;
  const minute = toNum(raw.minute) ?? 0;
  const second = toNum(raw.second) ?? 0;
  const value = minute === prev.value.minute && second === prev.value.second ? prev.value : { ...prev.value, minute, second };
  // The non-clock tree is already owned and equal. Only the two new wire fields need copying.
  const input = { ...old };
  try {
    for (const k of ['minute', 'second']) {
      if (Object.hasOwn(raw, k)) input[k] = structuredClone(raw[k]);
      else delete input[k];
    }
    return { input, value };
  } catch {
    return { input: Symbol('uncacheable'), value };
  }
}

/**
 * One parser per Source session. A v2 match with an unchanged seq AND unchanged wire data reuses
 * its validated snapshot. Equal seq alone is insufficient: clocks, late details and late events
 * can arrive without a new numbered event. v1 matches are always validated in full (§6).
 * Static metadata is memoized too; cache entries for matches absent from the next feed are dropped.
 */
export function createFeedParser(): (raw: unknown) => Feed {
  const teams = memoParser(lenientList(teamSchema));
  const leagues = memoParser(lenientList(leagueSchema));
  const squads = memoParser(lenientRecord(squad));
  const next = memoParser(lenientRecord(nextFixture));
  const days = memoParser(z.transform((v): string[] | undefined => Array.isArray(v) ? v.filter((d): d is string => typeof d === 'string') : undefined));
  let matches = new Map<number, ParsedCache<FeedMatch>>();
  return (raw) => {
    const f = record.parse(raw);
    const version = toNum(f.version) ?? 1;
    const keep = new Map<number, ParsedCache<FeedMatch>>();
    const parsed: FeedMatch[] = [];
    for (const item of list.parse(f.matches)) {
      const r = record.parse(item);
      const id = toNum(r.id) ?? 0;
      const seq = toNum(r.seq);
      const prev = matches.get(id);
      const cacheable = version === 2 && seq !== undefined && Number.isInteger(seq) && seq >= 0;
      if (cacheable && prev && prev.value.seq === seq) {
        const reused = equalWire(prev.input, item) ? prev : clockOnly(prev, r);
        if (reused) {
          parsed.push(reused.value);
          keep.set(id, reused);
          continue;
        }
      }
      const result = feedMatchSchema.safeParse(item);
      if (!result.success) continue;
      const value = share(prev?.value, result.data);
      parsed.push(value);
      if (cacheable) {
        try { keep.set(id, { input: structuredClone(item), value }); } catch { /* uncacheable input */ }
      }
    }
    matches = keep;
    return strip({ version, days: days(f.days), teams: teams(f.teams), leagues: leagues(f.leagues), squads: squads(f.squads), matches: parsed, next: next(f.next) });
  };
}

/** Returns undefined for an event that can't be used (no match, unknown kind). */
export function parseEvent(raw: unknown): LiveEvent | undefined {
  const r = liveEventSchema.safeParse(raw);
  return r.success ? r.data : undefined;
}
