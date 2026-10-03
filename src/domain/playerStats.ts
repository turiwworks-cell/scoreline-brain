// What the events and the provider's line say about one player's evening (playerStats, onPitch,
// luau:2840–2919). Pure: used by the followed player's card and the player view.

import { liveMinute } from './clock';
import { lineupOf } from './leaders';
import type { DomainState, Match, MatchEvent, Side } from './types';

/** What the events say about one player. A player in the first eleven is on from minute 0. */
export interface Flags {
  readonly starter: boolean;
  readonly onAt?: number;
  readonly offAt?: number;
  readonly redAt?: number;
  readonly yellow: boolean;
  readonly goals: number;
  readonly assists: number;
  readonly shots: number;
}

const SHOTS = new Set<MatchEvent['kind']>(['goal', 'shot', 'miss', 'blocked', 'bigChance']);

export function playerFlags(state: Pick<DomainState, 'players'>, match: Match, side: Side, n: number): Flags {
  const starter = lineupOf(state, match, side).xi.includes(n);
  let onAt: number | undefined;
  let offAt: number | undefined;
  let redAt: number | undefined;
  let yellow = false;
  let goals = 0;
  let assists = 0;
  let shots = 0;
  for (const e of match.events) {
    if (e.side !== side) continue;
    if (e.kind === 'sub') {
      // the player on is `player`, the player off is `other`
      if (e.player === n) onAt = e.minute;
      if (e.other === n) offAt = e.minute;
    } else if (e.kind === 'red' && e.player === n) redAt = e.minute;
    else if (e.kind === 'yellow' && e.player === n) yellow = true;
    else if (e.kind === 'goal' && !e.cancelled) {
      if (e.player === n) goals += 1;
      if (e.other === n) assists += 1;
    }
    if (e.player === n && SHOTS.has(e.kind) && !(e.kind === 'goal' && e.cancelled)) shots += 1;
  }
  return { starter, onAt, offAt, redAt, yellow, goals, assists, shots };
}

/** On the pitch right now: in the eleven or came on, and not taken off (luau:4263). */
export const onPitch = (f: Flags) => (f.starter || f.onAt !== undefined) && f.offAt === undefined;

export interface PStats {
  readonly rating: number;
  readonly mins: number;
  readonly goals: number;
  readonly assists: number;
  readonly shots: number;
  readonly touches: number;
  readonly passes: number;
  readonly passOk: number;
  readonly played: boolean;
  /** the provider sent his numbers; false = only what the events tell */
  readonly real: boolean;
}

/** His numbers: minutes from the events, the rest from the provider's line when there is one. */
export function playerStats(state: Pick<DomainState, 'players'>, match: Match, side: Side, n: number, nowMs: number): PStats {
  const f = playerFlags(state, match, side, n);
  const ns = match.status === 'scheduled';
  const now = ns ? 0 : Math.min(liveMinute(match, nowMs).minute, 90);
  const start = f.starter ? 0 : (f.onAt ?? -1);
  const stop = f.offAt ?? f.redAt ?? now;
  let mins = start < 0 || ns ? 0 : Math.max(0, Math.min(stop, now) - start);
  let played = mins > 0 || (start >= 0 && !ns);
  const line = match.players?.[side]?.[String(n)];
  if (line?.minutes !== undefined) {
    mins = line.minutes;
    played = line.minutes > 0 || played;
  }
  return {
    rating: line?.rating ?? 0,
    mins,
    goals: f.goals,
    assists: f.assists,
    shots: line?.shots ?? f.shots,
    touches: line?.touches ?? 0,
    passes: Math.max(line?.passes ?? 0, line?.passesOk ?? 0),
    passOk: line?.passesOk ?? 0,
    played,
    real: line !== undefined,
  };
}

