// The domain reducer: a feed snapshot or a live event in, the next state and its moments out.
//
// Rules (docs/DATA-CONTRACT.md §4):
// - Every match carries a monotonic `seq`. A snapshot whose `seq` is older than what this match
//   has already applied keeps none of its match-level fields: a cached feed can't roll a live
//   goal back.
// - Events are deduped by id per match.
// - A goal moment comes from the score going up, whether that shows first in a snapshot or in an
//   event, and is played once: when the goal's own event turns up later the score has already
//   moved, so nothing plays twice. A score that goes down is a goal taken back (VAR).
// - The first feed, and a match's first appearance, set the stage without moments.
// - Structural sharing: whatever didn't change keeps its identity, down to the state itself.

import { liveMinute, syncClock } from './clock';
import { share } from './share';
import type {
  Applied,
  DomainState,
  Feed,
  FeedMatch,
  League,
  LiveEvent,
  Match,
  MatchEvent,
  Moment,
  NextFixture,
  Player,
  Score,
  Side,
  StoredKind,
  Team,
  WireEvent,
} from './types';
import { STORED_KINDS } from './schemas';

/** Events held for a match that has no snapshot yet. Beyond this, the oldest are dropped. */
const PENDING_MAX = 100;
/** A kick-off countdown that moved less than this keeps its identity. */
const NEXT_DRIFT_MS = 5000;

export function emptyState(): DomainState {
  return { loaded: false, days: [], teams: {}, leagues: {}, players: {}, matches: {}, matchOrder: [], next: {}, pending: {} };
}

export const playerKey = (team: string, n: number): string => `${team}:${n}`;

const sideIndex = (side: Side): 0 | 1 => (side === 'home' ? 0 : 1);
const SIDES: readonly Side[] = ['home', 'away'];

function isStored(kind: string): kind is StoredKind {
  return (STORED_KINDS as readonly string[]).includes(kind);
}

// ── Events ───────────────────────────────────────────────────────────────────

function toMatchEvent(e: WireEvent | LiveEvent, id: string, seq: number, minute: number): MatchEvent {
  const out: Record<string, unknown> = {
    id,
    seq,
    kind: e.kind,
    side: e.side,
    minute: e.minute ?? minute,
  };
  for (const k of ['player', 'other', 'name', 'otherName', 'style', 'xg', 'text', 'score', 'ref'] as const) {
    if (e[k] !== undefined) out[k] = e[k];
  }
  return out as unknown as MatchEvent;
}

/** Stable sort by `seq`; equal `seq` keeps arrival order. */
function bySeq(events: MatchEvent[]): MatchEvent[] {
  return events.map((e, i) => [e, i] as const).sort((a, b) => a[0].seq - b[0].seq || a[1] - b[1]).map(([e]) => e);
}

/** Flags each goal a later goalCancelled took back: by `ref`, else the side's latest standing goal. */
function markCancelled(events: readonly MatchEvent[]): MatchEvent[] {
  const cancelled = new Set<string>();
  const standing: MatchEvent[] = [];
  for (const e of events) {
    if (e.kind === 'goal') standing.push(e);
    else if (e.kind === 'goalCancelled') {
      const i = e.ref !== undefined ? standing.findIndex((g) => g.id === e.ref) : standing.findLastIndex((g) => g.side === e.side);
      const g = i >= 0 ? standing[i] : undefined;
      if (g) {
        cancelled.add(g.id);
        standing.splice(i, 1);
      }
    }
  }
  return events.map((e) => {
    if (e.kind !== 'goal') return e;
    const c = cancelled.has(e.id);
    if (c === (e.cancelled === true)) return e;
    if (c) return { ...e, cancelled: true };
    const rest: { -readonly [K in keyof MatchEvent]: MatchEvent[K] } = { ...e };
    delete rest.cancelled;
    return rest;
  });
}

// ── Moments ──────────────────────────────────────────────────────────────────

interface Diff {
  readonly moments: Moment[];
  readonly cancels: number;
}

/**
 * Moments for a score change. A rise plays one goal per goal scored, each matched to its event
 * when one came with it; a drop plays one goalCancelled per goal taken back.
 */
function scoreMoments(m: Match, before: Score, after: Score, fresh: readonly MatchEvent[], now: number): Diff {
  const moments: Moment[] = [];
  let cancels = m.cancels;
  const minuteNow = liveMinute(m, now).minute;
  for (const side of SIDES) {
    const i = sideIndex(side);
    const from = before[i];
    const to = after[i];
    if (to < from) {
      const calls = fresh.filter((e) => e.kind === 'goalCancelled' && e.side === side);
      for (let k = 0; k < from - to; k++) {
        cancels += 1;
        const ev = calls[k];
        moments.push({
          id: ev ? `${m.id}:goalCancelled:${ev.id}` : `${m.id}:goalCancelled:${side}:${from - k}:${cancels}`,
          kind: 'goalCancelled',
          matchId: m.id,
          side,
          ...(ev ? { event: ev } : {}),
          score: after,
          minute: ev?.minute ?? minuteNow,
        });
      }
    }
    if (to > from) {
      const goals = fresh.filter((e) => e.kind === 'goal' && e.side === side && e.cancelled !== true);
      const used = new Set<string>();
      for (let n = from + 1; n <= to; n++) {
        // The goal that made it n, else the next unused goal without a score.
        const ev = goals.find((g) => !used.has(g.id) && g.score?.[i] === n) ?? goals.find((g) => !used.has(g.id) && g.score === undefined);
        if (ev) used.add(ev.id);
        moments.push({
          id: ev ? `${m.id}:goal:${ev.id}` : `${m.id}:goal:${side}:${n}:${cancels}`,
          kind: 'goal',
          matchId: m.id,
          side,
          ...(ev ? { event: ev } : {}),
          score: after,
          minute: ev?.minute ?? minuteNow,
        });
      }
    }
  }
  return { moments, cancels };
}

function simpleMoment(m: Match, kind: 'kickoff' | 'fulltime' | 'red', now: number, ev?: MatchEvent): Moment {
  return {
    id: ev ? `${m.id}:${kind}:${ev.id}` : `${m.id}:${kind}`,
    kind,
    matchId: m.id,
    ...(ev ? { side: ev.side, event: ev } : {}),
    score: m.score,
    minute: ev?.minute ?? liveMinute(m, now).minute,
  };
}

/** Drops moments this match already played and records the rest. */
function play(m: Match, moments: readonly Moment[]): { match: Match; moments: Moment[] } {
  const seen = new Set(m.played);
  const out = moments.filter((x) => !seen.has(x.id) && (seen.add(x.id), true));
  if (out.length === 0) return { match: m, moments: [] };
  return { match: { ...m, played: [...m.played, ...out.map((x) => x.id)] }, moments: out };
}

// ── Snapshot ─────────────────────────────────────────────────────────────────

function fromSnapshot(prev: Match | undefined, fm: FeedMatch, quiet: boolean, now: number): { match: Match; moments: Moment[] } {
  const snapshot = fm.events.map((e) => toMatchEvent(e, e.id, e.seq ?? 0, fm.minute));

  if (prev && fm.seq < prev.seq) {
    // Stale: keep everything we have, only learn events we hadn't seen. No moments.
    const known = new Set(prev.events.map((e) => e.id));
    const unseen = snapshot.filter((e) => !known.has(e.id));
    if (unseen.length === 0) return { match: prev, moments: [] };
    return { match: share(prev, { ...prev, events: markCancelled(bySeq([...prev.events, ...unseen])) }), moments: [] };
  }

  // The snapshot is the truth up to its seq; live events past it stay.
  const ids = new Set(snapshot.map((e) => e.id));
  const later = prev ? prev.events.filter((e) => e.seq > fm.seq && !ids.has(e.id)) : [];
  const events = markCancelled(bySeq([...snapshot, ...later]));

  const built: Match = {
    id: fm.id,
    seq: Math.max(fm.seq, prev?.seq ?? 0),
    day: fm.day,
    league: fm.league,
    home: fm.home,
    away: fm.away,
    score: fm.score,
    status: fm.status,
    clock: syncClock(prev?.clock, prev?.status, fm.status, fm.minute, fm.second, now),
    kickoff: fm.kickoff,
    featured: fm.featured,
    favourite: fm.favourite,
    events,
    cancels: prev?.cancels ?? 0,
    played: prev?.played ?? [],
    ...(fm.venue ? { venue: fm.venue } : {}),
    ...(fm.lineups ? { lineups: fm.lineups } : {}),
    ...(fm.stats ? { stats: fm.stats } : {}),
    ...(fm.momentum ? { momentum: fm.momentum } : {}),
    ...(fm.players ? { players: fm.players } : {}),
    ...(prev?.action ? { action: prev.action } : {}),
  };

  if (quiet || !prev) return { match: share(prev, built), moments: [] };

  const known = new Set(prev.events.map((e) => e.id));
  const fresh = events.filter((e) => !known.has(e.id) && (e.seq > prev.seq || e.seq === 0));
  const diff = scoreMoments(built, prev.score, built.score, fresh, now);
  const moments = [...diff.moments];
  for (const e of fresh) if (e.kind === 'red') moments.push(simpleMoment(built, 'red', now, e));
  if (prev.status === 'scheduled' && built.status === 'live') moments.push(simpleMoment(built, 'kickoff', now));
  if (prev.status === 'live' && built.status === 'finished') moments.push(simpleMoment(built, 'fulltime', now));
  const r = play({ ...built, cancels: diff.cancels }, moments);
  return { match: share(prev, r.match), moments: r.moments };
}

// ── Live event ───────────────────────────────────────────────────────────────

function onEvent(m: Match, ev: LiveEvent, quiet: boolean, now: number): { match: Match; moments: Moment[] } {
  const none = { match: m, moments: [] };
  if (ev.id !== undefined && m.events.some((e) => e.id === ev.id)) return none;
  const stale = ev.seq !== undefined && ev.seq <= m.seq;
  const seq = ev.seq ?? m.seq;

  switch (ev.kind) {
    case 'minute':
      if (stale) return none;
      return { match: share(m, { ...m, seq, clock: syncClock(m.clock, m.status, m.status, ev.minute ?? 0, ev.second ?? 0, now) }), moments: [] };
    case 'action':
      return {
        match: {
          ...m,
          action: { side: ev.side, player: ev.player ?? 0, text: ev.text ?? '', act: ev.act ?? 'touch', onBall: ev.onBall === true, at: now },
        },
        moments: [],
      };
    case 'kickoff': {
      if (stale || m.status !== 'scheduled') return stale ? none : { match: share(m, { ...m, seq }), moments: [] };
      const next: Match = { ...m, seq, status: 'live', clock: { minute: 0, second: 0, at: now } };
      return quiet ? { match: next, moments: [] } : play(next, [simpleMoment(next, 'kickoff', now)]);
    }
    case 'fulltime': {
      if (stale || m.status === 'finished') return stale ? none : { match: share(m, { ...m, seq }), moments: [] };
      const t = liveMinute(m, now);
      const next: Match = { ...m, seq, status: 'finished', clock: { minute: t.minute, second: t.second, at: now } };
      return quiet || m.status !== 'live' ? { match: next, moments: [] } : play(next, [simpleMoment(next, 'fulltime', now)]);
    }
  }
  if (!isStored(ev.kind)) return none;

  const minuteNow = liveMinute(m, now).minute;
  const id = ev.id ?? `~live-${ev.kind}-${ev.side}-${ev.minute ?? minuteNow}-${ev.player ?? ''}-${m.events.length}`;
  const event = toMatchEvent(ev, id, seq, minuteNow);
  const events = markCancelled(bySeq([...m.events, event]));
  if (stale) return { match: { ...m, events }, moments: [] };

  const i = sideIndex(ev.side);
  let score: Score = m.score;
  if (ev.score) score = ev.score;
  else if (ev.kind === 'goal') score = i === 0 ? [m.score[0] + 1, m.score[1]] : [m.score[0], m.score[1] + 1];
  else if (ev.kind === 'goalCancelled') score = i === 0 ? [Math.max(0, m.score[0] - 1), m.score[1]] : [m.score[0], Math.max(0, m.score[1] - 1)];

  const stored = events.find((e) => e.id === id) ?? event;
  const clock = ev.minute !== undefined && ev.minute > minuteNow ? { minute: ev.minute, second: 0, at: now } : m.clock;
  const next: Match = {
    ...m,
    seq,
    events,
    score: share(m.score, score),
    clock,
    // Something happening on the pitch means the match is on.
    status: m.status === 'scheduled' ? 'live' : m.status,
  };
  if (quiet) return { match: next, moments: [] };

  const diff = scoreMoments(next, m.score, next.score, [stored], now);
  const moments = [...diff.moments];
  if (ev.kind === 'red') moments.push(simpleMoment(next, 'red', now, stored));
  return play({ ...next, cancels: diff.cancels }, moments);
}

// ── Public API ───────────────────────────────────────────────────────────────

/** Applies a `feed` snapshot. `now` is epoch ms. */
export function applyFeed(state: DomainState, feed: Feed, now: number): Applied {
  const quiet = !state.loaded;
  const moments: Moment[] = [];

  // Teams merge: a team sent once stays known. A squad's coach rides on its team.
  const teams: Record<string, Team> = { ...state.teams };
  for (const t of feed.teams) {
    const coach = state.teams[t.id]?.coach;
    teams[t.id] = coach !== undefined ? { ...t, coach } : t;
  }
  const players: Record<string, Player> = { ...state.players };
  for (const [team, sq] of Object.entries(feed.squads)) {
    for (const k of Object.keys(players)) if (players[k]?.team === team) delete players[k];
    for (const p of sq.players) players[playerKey(team, p.n)] = { ...p, id: playerKey(team, p.n), team };
    const t = teams[team];
    if (t && sq.coach !== undefined) teams[team] = { ...t, coach: sq.coach };
  }

  // Leagues sent replace the set; a match in an unknown league gets a placeholder.
  const leagues: Record<string, League> = feed.leagues.length > 0 ? {} : { ...state.leagues };
  for (const l of feed.leagues) leagues[l.id] = l;

  const next: Record<string, NextFixture> = { ...state.next };
  for (const [team, nx] of Object.entries(feed.next)) {
    const at = now + nx.in * 1000;
    const prev = state.next[team];
    next[team] = { opponent: nx.opponent, date: nx.date, time: nx.time, at: prev && Math.abs(prev.at - at) < NEXT_DRIFT_MS ? prev.at : at };
  }

  // Matches: only those in the feed remain, in feed order.
  const matches: Record<number, Match> = {};
  const matchOrder: number[] = [];
  const pending: Record<number, readonly LiveEvent[]> = { ...state.pending };
  for (const fm of feed.matches) {
    if (!teams[fm.home] || !teams[fm.away] || matches[fm.id]) continue;
    let prev = state.matches[fm.id];
    if (prev && (prev.home !== fm.home || prev.away !== fm.away)) prev = undefined;
    let r = fromSnapshot(prev, fm, quiet, now);
    moments.push(...r.moments);
    // Events that beat this match's snapshot here.
    for (const ev of bySeqLive(pending[fm.id] ?? [])) {
      r = onEvent(r.match, ev, quiet, now);
      moments.push(...r.moments);
    }
    delete pending[fm.id];
    if (!leagues[fm.league]) leagues[fm.league] = { id: fm.league, country: '', name: fm.league, matchday: 1, qualify: 0, qualifyLabel: 'Qualify' };
    matches[fm.id] = r.match;
    matchOrder.push(fm.id);
  }

  const built: DomainState = {
    loaded: true,
    days: feed.days ?? state.days,
    teams,
    leagues,
    players,
    matches,
    matchOrder,
    next,
    pending,
  };
  return { state: share(state, built), moments };
}

function bySeqLive(events: readonly LiveEvent[]): LiveEvent[] {
  return events.map((e, i) => [e, i] as const).sort((a, b) => (a[0].seq ?? 0) - (b[0].seq ?? 0) || a[1] - b[1]).map(([e]) => e);
}

/** Applies one live `event`. `now` is epoch ms. */
export function applyEvent(state: DomainState, ev: LiveEvent, now: number): Applied {
  const m = state.matches[ev.match];
  if (!state.loaded || !m) {
    // No snapshot for this match yet: hold the event until one arrives.
    const held = state.pending[ev.match] ?? [];
    if (ev.id !== undefined && held.some((e) => e.id === ev.id)) return { state, moments: [] };
    return { state: { ...state, pending: { ...state.pending, [ev.match]: [...held, ev].slice(-PENDING_MAX) } }, moments: [] };
  }
  const r = onEvent(m, ev, false, now);
  if (r.match === m) return { state, moments: r.moments };
  return { state: { ...state, matches: { ...state.matches, [m.id]: r.match } }, moments: r.moments };
}
