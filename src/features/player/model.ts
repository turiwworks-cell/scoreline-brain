// What the player view shows about a player, from the squad, the match and the events
// (drawPlayerView, luau:5845–6179). Pure: no React, no DOM.

import { lineupOf, minText, type DomainState, type Match, type MatchEvent, type Player, type PStats, type Side, type Team } from '../../domain';

/** The player's side of `match`, or undefined when his team isn't playing in it. */
export function sideIn(match: Pick<Match, 'home' | 'away'> | undefined, team: string): Side | undefined {
  if (!match) return undefined;
  return match.home === team ? 'home' : match.away === team ? 'away' : undefined;
}

/**
 * His age (age, luau:2307): the Lua counts the tournament's calendar, so a birthday after
 * 21 September has not come yet. 0 when the squad has no birth date.
 */
export function ageOf(born: string, now: Date): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(born);
  if (!m) return 0;
  const y = Number(m[1]);
  if (y <= 0) return 0;
  const month = Number(m[2]);
  const day = Number(m[3]);
  let a = now.getFullYear() - y;
  if (month > now.getMonth() + 1 || (month === now.getMonth() + 1 && day > now.getDate())) a -= 1;
  return a;
}

const LINE_NAME: Readonly<Record<string, string>> = { GK: 'Goalkeeper', DF: 'Defender', MF: 'Midfielder', FW: 'Forward' };
const LINE_SHORT: Readonly<Record<string, string>> = { GK: 'Keeper', DF: 'Defence', MF: 'Midfield', FW: 'Attack' };

/** His role: the squad's own, else the one his line gives, else "Player" (luau:6003). */
export function roleLabel(p: Player | undefined): string {
  if (p && p.role !== '') return p.role;
  return (p && LINE_NAME[p.pos]) || 'Player';
}

export interface Fact {
  readonly label: string;
  readonly value: string;
}

/** The facts row: club, age, height and shirt; with no birth date, nation, line and shirt (luau:6040). */
export function factsOf(p: Player | undefined, team: Team, n: number, now: Date): readonly Fact[] {
  const age = p ? ageOf(p.born, now) : 0;
  if (p && age > 0) {
    return [
      { label: 'Club', value: p.club === '' ? '—' : p.club },
      { label: 'Age', value: String(age) },
      { label: 'Height', value: p.height > 0 ? `${p.height} cm` : '—' },
      { label: 'Shirt', value: `#${n}` },
    ];
  }
  return [
    { label: 'Nation', value: team.name },
    { label: 'Line', value: (p && LINE_SHORT[p.pos]) || '—' },
    { label: 'Shirt', value: `#${n}` },
  ];
}

export type TagKind = 'goal' | 'assist' | 'yellow' | 'red';
export interface MatchTag {
  readonly kind: TagKind;
  readonly label: string;
}

export interface Substitution {
  readonly off: boolean;
  readonly minute: number;
}

/** When he went off or came on, from the events (the red arrow, luau:6120). Off wins. */
export function substitutionOf(events: readonly MatchEvent[], side: Side, n: number): Substitution | undefined {
  let on: number | undefined;
  let off: number | undefined;
  for (const e of events) {
    if (e.side !== side || e.kind !== 'sub') continue;
    if (e.player === n) on = e.minute;
    if (e.other === n) off = e.minute;
  }
  if (off !== undefined) return { off: true, minute: off };
  if (on !== undefined) return { off: false, minute: on };
  return undefined;
}

/** What he did, as the tags beside his rating (luau:6092): goals, assists, booked, sent off. */
export function tagsOf(events: readonly MatchEvent[], side: Side, n: number, stats: Pick<PStats, 'goals' | 'assists'>): MatchTag[] {
  let yellow: number | undefined;
  let red: number | undefined;
  for (const e of events) {
    if (e.side !== side || e.player !== n) continue;
    if (e.kind === 'yellow') yellow = e.minute;
    else if (e.kind === 'red') red = e.minute;
  }
  const tags: MatchTag[] = [];
  if (stats.goals > 0) tags.push({ kind: 'goal', label: stats.goals === 1 ? '1 goal' : `${stats.goals} goals` });
  if (stats.assists > 0) tags.push({ kind: 'assist', label: stats.assists === 1 ? '1 assist' : `${stats.assists} assists` });
  if (yellow !== undefined) tags.push({ kind: 'yellow', label: `Booked ${minText(yellow)}` });
  if (red !== undefined) tags.push({ kind: 'red', label: `Sent off ${minText(red)}` });
  return tags;
}

/** The note that stands in for the numbers of a player who has not played (luau:6064). */
export function notPlayed(status: Match['status'], kickoff: string): { head: string; body: string } {
  if (status === 'scheduled') return { head: 'Not started', body: `Kick-off ${kickoff}. Line-ups are not out yet.` };
  if (status === 'live') return { head: 'On the bench', body: "He hasn't come on yet. His numbers will appear the moment he does." };
  return { head: 'Unused substitute', body: "He didn't get on the pitch in this match." };
}

export interface Bar {
  readonly label: string;
  readonly value: number;
  /** the value the bar's full width stands for */
  readonly max: number;
  readonly percent: boolean;
}

/**
 * His bars (luau:2887): the numbers the provider's line carries. The Lua also draws duels, chances
 * created, saves and goals conceded; the v2 line has none of those, so they are not invented.
 */
export function barsOf(stats: Pick<PStats, 'touches' | 'passes' | 'passOk' | 'shots'>, keeper: boolean): Bar[] {
  const accuracy = stats.passes > 0 ? Math.floor((stats.passOk / stats.passes) * 100 + 0.5) : 0;
  const bars: Bar[] = [
    { label: 'Touches', value: stats.touches, max: keeper ? 60 : 110, percent: false },
    { label: 'Pass accuracy', value: accuracy, max: 100, percent: true },
  ];
  if (!keeper) bars.push({ label: 'Shots', value: stats.shots, max: 8, percent: false });
  return bars;
}

/** The shirt order stepPlayer walks: the eleven, then the bench, wrapping (luau:7280). */
export function squadOrder(state: Pick<DomainState, 'players'>, match: Pick<Match, 'home' | 'away' | 'lineups'>, side: Side): number[] {
  const lu = lineupOf(state, match, side);
  return [...lu.xi, ...lu.bench];
}

export function stepOf(order: readonly number[], n: number, dir: number): number | undefined {
  if (order.length === 0) return undefined;
  const at = Math.max(0, order.indexOf(n));
  return order[(((at + dir) % order.length) + order.length) % order.length];
}

/** The surname's size: 40, shrunk to fit `room` px (fit, luau:1634). */
export function fitSize(size: number, width: number, room: number): number {
  return width <= room || width <= 0 ? size : (size * room) / width;
}
