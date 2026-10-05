// What the followed player's card knows about his evening (followInfo, followPhase, playerStats,
// onPitch and pushAct, luau:4045–4527, 2840–2919, 7344). Pure: the card gives it the match, the
// squads and the time.

import { minText, nameOf, scoreStr, type DomainState, type Match, type MatchEvent, type NextFixture, type Side } from '../../../domain';

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

// ── his evening so far (moved to domain/playerStats.ts, shared with the player view) ──

export { onPitch, playerFlags, playerStats, type Flags, type PStats } from '../../../domain';
import type { Flags } from '../../../domain';

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
