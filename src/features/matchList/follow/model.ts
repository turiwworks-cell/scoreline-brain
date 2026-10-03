// What the followed player's card knows about his evening (followInfo, followPhase, playerStats,
// onPitch and pushAct, luau:4045–4527, 2840–2919, 7344). Pure: the card gives it the match, the
// squads and the time.

import { liveMinute, lineupOf, minText, nameOf, scoreStr, type DomainState, type Match, type MatchEvent, type NextFixture, type Side } from '../../../domain';

export interface Followed {
  readonly team: string;
  readonly n: number;
}

export const sameFollowed = (a: Followed | null, b: Followed | null) => (a === null || b === null ? a === b : a.team === b.team && a.n === b.n);

/** The side of `match` that `team` plays on. */
export function sideOf(match: Pick<Match, 'home' | 'away'>, team: string): Side {
  return match.home === team ? 'home' : 'away';
}

export const otherSide = (side: Side): Side => (side === 'home' ? 'away' : 'home');

// ── his evening so far ───────────────────────────────────────────────────────

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

// ── the card's phase ─────────────────────────────────────────────────────────

export type Phase = 'none' | 'pre' | 'live' | 'red' | 'post';

/** How long the card shows its red flood before settling into `post` (luau:4123). */
export const RED_SECONDS = 3.2;

/** The state of his evening: live, red (just sent off), post (his match is over), pre, none (luau:4120). */
export function followPhase(match: Match | undefined, flags: Flags | undefined, sinceRed: number): Phase {
  if (!match || !flags) return 'none';
  if (flags.redAt !== undefined) return sinceRed < RED_SECONDS ? 'red' : 'post';
  if (match.status === 'finished') return 'post';
  if (match.status === 'scheduled') return 'pre';
  return 'live';
}

/** The card's full height: header 136 + stats band 64, plus 100 after his match, 66 while he plays (luau:4266). */
export const FOLLOW_H = { top: 136, band: 64, closed: 64, post: 100, acts: 66 } as const;
export function followHeight(phase: Phase, onP: boolean): number {
  return FOLLOW_H.top + FOLLOW_H.band + (phase === 'post' || phase === 'red' ? FOLLOW_H.post : onP ? FOLLOW_H.acts : 0);
}

// ── his acts ─────────────────────────────────────────────────────────────────

export interface Act {
  /** seconds on the list's clock, which times the row's entrance */
  readonly t: number;
  readonly txt: string;
  readonly kind: string;
  /** "58:14": the match clock when it happened */
  readonly clock: string;
}

const pad2 = (n: number) => String(Math.floor(n)).padStart(2, '0');

/** "58:14" (luau:7347). */
export const clockText = (minute: number, second: number) => `${pad2(Math.min(minute, 99))}:${pad2(second)}`;

/** The newest act in front, four at most (luau:7344). */
export function pushAct(acts: readonly Act[], act: Act): readonly Act[] {
  return [act, ...acts].slice(0, 4);
}

/** "Hat-trick tonight" or "Second goal of the match" (luau:4313). */
export function goalLine(goals: number): string {
  if (goals === 3) return 'Hat-trick tonight';
  const words = ['First', 'Second', 'Third'];
  const nth = goals >= 1 && goals <= 3 ? words[goals - 1]! : `${goals}th`;
  return `${nth} goal of the match`;
}

/** "GOAL! FRA 2–1 ARG" (luau:7370). */
export const goalAct = (home: string, away: string, score: readonly [number, number]) => `GOAL! ${home} ${scoreStr(score[0], score[1])} ${away}`;

/** The followed player's goals, by minute (goalsOf filtered to him, luau:2536). */
export function goalsBy(match: Match, side: Side, n: number): MatchEvent[] {
  return match.events.filter((e) => e.kind === 'goal' && !e.cancelled && e.side === side && e.player === n).sort((a, b) => a.minute - b.minute);
}

/** The sub act text when he is involved (luau:8094). */
export function subAct(state: Pick<DomainState, 'players'>, match: Match, ev: MatchEvent, n: number): string | undefined {
  const team = ev.side === 'home' ? match.home : match.away;
  const on = ev.player ?? 0;
  const off = ev.other ?? 0;
  const nameOn = ev.name ?? nameOf(state, team, on);
  const nameOff = ev.otherName ?? nameOf(state, team, off);
  if (n === off) return `Substituted. ${nameOn} comes on`;
  if (n === on) return `Comes on for ${nameOff}`;
  return undefined;
}

// ── his next match ───────────────────────────────────────────────────────────

const UNITS = [86400, 3600, 60] as const;
const MODS = [100, 24, 60] as const;

/** Days, hours and minutes until `at` (epoch ms), as the countdown shows them (luau:4202). */
export function countdown(at: number, nowMs: number): readonly [number, number, number] {
  const left = Math.max(0, (at - nowMs) / 1000);
  return [0, 1, 2].map((i) => Math.floor(left / UNITS[i]!) % MODS[i]!) as unknown as readonly [number, number, number];
}

export interface NextView {
  /** the opponent's team id; empty = a friendly still to be fixed */
  readonly opponent: string;
  readonly day: string;
  readonly clock: string;
  readonly at: number | undefined;
}

export function nextView(next: NextFixture | undefined): NextView {
  if (!next) return { opponent: '', day: 'Date to be confirmed', clock: '', at: undefined };
  return { opponent: next.opponent, day: next.date, clock: next.time, at: next.at };
}

export { minText };
