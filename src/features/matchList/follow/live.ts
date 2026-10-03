// What happens to the followed player while the card is on screen (pushAct and the action, goal,
// red-card and substitution handlers, luau:7344–7420, 8040–8095). The store gives events; this
// folds them into the card's live state. The reducer is pure; `useFollowLive` feeds it.

import { useEffect, useReducer, useRef } from 'react';
import { liveMinute, type Match, type MatchEvent, type Moment, type PlayerAction } from '../../../domain';
import { scorelineStore } from '../../../store';
import { goalFeed, watchMoments } from '../goalFeed';
import { clockText, goalAct, pushAct, subAct, type Act, type Followed } from './model';

export interface FollowLive {
  /** his last four acts, newest first */
  readonly acts: readonly Act[];
  /** he has the ball (green) or not (grey) */
  readonly ball: boolean;
  /** when the ball state last changed, which times the "off the ball" line's entrance */
  readonly ballAt: number;
  /** when he last scored, and when he was last sent off (seconds on the list's clock) */
  readonly goalAt: number;
  readonly redAt: number;
}

export const FRESH: FollowLive = { acts: [], ball: false, ballAt: -100, goalAt: -100, redAt: -100 };

/** After a goal or an assist he is shown with the ball for this long (luau:7366). */
export const BALL_HOLD = 2.5;

export type FollowEvent =
  | { type: 'reset' }
  | { type: 'act'; at: number; text: string; kind: string; onBall: boolean; clock: string }
  | { type: 'goal'; at: number; text: string; clock: string }
  | { type: 'assist'; at: number; text: string; clock: string }
  | { type: 'sub'; at: number; text: string; clock: string }
  | { type: 'red'; at: number }
  | { type: 'release'; at: number };

export function followReduce(s: FollowLive, e: FollowEvent): FollowLive {
  switch (e.type) {
    case 'reset':
      return FRESH;
    case 'act':
      return { ...s, acts: pushAct(s.acts, { t: e.at, txt: e.text, kind: e.kind, clock: e.clock }), ball: e.onBall, ballAt: e.at };
    case 'goal':
      return { ...s, acts: pushAct(s.acts, { t: e.at, txt: e.text, kind: 'goal', clock: e.clock }), goalAt: e.at, ball: true, ballAt: e.at };
    case 'assist':
      return { ...s, acts: pushAct(s.acts, { t: e.at, txt: e.text, kind: 'assist', clock: e.clock }), ball: true, ballAt: e.at };
    case 'sub':
      return { ...s, acts: pushAct(s.acts, { t: e.at, txt: e.text, kind: 'sub', clock: e.clock }) };
    case 'red':
      return { ...s, redAt: e.at };
    case 'release':
      return s.ball ? { ...s, ball: false, ballAt: e.at } : s;
  }
}

/** The events a goal moment means for the followed player, if any (celebrate, luau:7360). */
export function goalEvents(mo: Moment, match: Match, f: Followed, names: { short: (team: string) => string; name: (team: string, n: number) => string }, at: number, clock: string): FollowEvent[] {
  if (mo.kind !== 'goal' || !mo.side) return [];
  const team = mo.side === 'home' ? match.home : match.away;
  if (team !== f.team) return [];
  const ev = mo.event;
  if (ev?.player === f.n) return [{ type: 'goal', at, text: goalAct(names.short(match.home), names.short(match.away), mo.score), clock }];
  if (ev?.other === f.n) return [{ type: 'assist', at, text: `Assist for ${ev.name ?? names.name(team, ev.player ?? 0)}'s goal`, clock }];
  return [];
}

type Slice = { matches: Readonly<Record<number, Match>>; players: Readonly<Record<string, { short: string }>>; teams: Readonly<Record<string, { short: string }>> };

const clockOf = (match: Match, nowMs: number) => {
  const t = liveMinute(match, nowMs);
  return clockText(t.minute, t.second);
};

/**
 * The followed player's live state: his actions, goals and cards in `matchId`, from the moment the
 * card mounted. The card is keyed by the player, so a new player starts clean.
 */
export function useFollowLive(f: Followed | null, matchId: number | undefined, now: () => number = goalFeed.clock.now): FollowLive {
  const [live, dispatch] = useReducer(followReduce, FRESH);
  const release = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    if (!f || matchId === undefined) return;
    const at = () => now();
    const state = () => scorelineStore.getState().domain as unknown as Slice;
    const nameOf = (team: string, n: number) => (state().players[`${team}:${n}`]?.short ?? `#${n}`);
    const names = { short: (t: string) => state().teams[t]?.short ?? t.toUpperCase(), name: nameOf };
    const send = (e: FollowEvent) => {
      dispatch(e);
      // the ball lets go a moment after a goal or an assist
      if (e.type === 'goal' || e.type === 'assist') {
        clearTimeout(release.current);
        release.current = setTimeout(() => dispatch({ type: 'release', at: now() }), BALL_HOLD * 1000);
      }
    };

    let last = scorelineStore.getState().domain.matches[matchId];
    let seenEvents = new Set((last?.events ?? []).map((e) => e.id));
    let lastAction: PlayerAction | undefined = last?.action;
    const off = scorelineStore.subscribe((s) => {
      const m = s.domain.matches[matchId];
      if (!m || m === last) return;
      last = m;
      const action = m.action;
      if (action && action !== lastAction) {
        lastAction = action;
        if (action.player === f.n && (action.side === 'home' ? m.home : m.away) === f.team) {
          send({ type: 'act', at: at(), text: action.text, kind: action.act, onBall: action.onBall, clock: clockOf(m, Date.now()) });
        }
      }
      for (const e of m.events as readonly MatchEvent[]) {
        if (seenEvents.has(e.id)) continue;
        seenEvents.add(e.id);
        if (e.kind !== 'sub') continue;
        const team = e.side === 'home' ? m.home : m.away;
        if (team !== f.team) continue;
        const text = subAct(s.domain, m, e, f.n);
        if (text) send({ type: 'sub', at: at(), text, clock: clockOf(m, Date.now()) });
      }
      // a match that was reloaded (a new snapshot) shouldn't replay old events
      if (seenEvents.size > 400) seenEvents = new Set(m.events.map((e) => e.id));
    });
    const stopMoments = watchMoments(
      scorelineStore,
      (mo) => {
        const m = scorelineStore.getState().domain.matches[mo.matchId];
        if (!m || mo.matchId !== matchId) return;
        if (mo.kind === 'red' && mo.event?.player === f.n && (mo.side === 'home' ? m.home : m.away) === f.team) send({ type: 'red', at: at() });
        for (const e of goalEvents(mo, m, f, names, at(), clockOf(m, Date.now()))) send(e);
      },
      () => {
        clearTimeout(release.current);
        last = scorelineStore.getState().domain.matches[matchId];
        seenEvents = new Set((last?.events ?? []).map((e) => e.id));
        lastAction = last?.action;
        dispatch({ type: 'reset' });
      },
    );
    return () => {
      off();
      stopMoments();
      clearTimeout(release.current);
    };
  }, [f?.team, f?.n, matchId]); // eslint-disable-line react-hooks/exhaustive-deps

  return live;
}
