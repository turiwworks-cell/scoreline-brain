// What the toast and the scenes show for one moment, from the store's names. Pure: no React.
// Nothing is invented: a goal seen only as a score change has no scorer and no commentary.

import { nameOf, playerKey, plainLine, type DomainState, type Match, type Moment, type Score, type Side, type Team } from '../../domain';
import { summarize } from '../../motion';

export type Names = Pick<DomainState, 'teams' | 'players' | 'matches'>;

export interface MomentInfo {
  readonly match: Match;
  readonly home: Team;
  readonly away: Team;
  readonly side: Side;
  /** the team the moment belongs to (the scorer's, the sent-off player's) */
  readonly team: Team;
  /** shirt number, 0 when the event names no player */
  readonly n: number;
  /** the short name the toast shows (ev.p, luau:6247): the event's name, the squad's, else the team's */
  readonly name: string;
  /** the scene's two lines (luau:6451): first name, and the last name (or the short name) */
  readonly first: string;
  readonly last: string;
  /** goal: who set it up, '' when nobody */
  readonly assist: string;
  readonly minute: number;
  /** the score after the moment, and just before it (the scene's score strip rolls between them) */
  readonly score: Score;
  readonly before: Score;
  /** the event's commentary, else its plain line ('' without an event) */
  readonly commentary: string;
}

const fallbackTeam = (id: string): Team => ({ id, name: id.toUpperCase(), short: id.toUpperCase().slice(0, 3), colors: ['#85847F', '#F3F2EF'] });

/** The moment's people, names and scores, or null when its match is unknown. */
export function momentInfo(s: Names, m: Moment): MomentInfo | null {
  const match = s.matches[m.matchId];
  if (!match) return null;
  const home = s.teams[match.home] ?? fallbackTeam(match.home);
  const away = s.teams[match.away] ?? fallbackTeam(match.away);
  const ev = m.event;
  const side: Side = m.side ?? ev?.side ?? 'home';
  const team = side === 'home' ? home : away;
  const n = ev?.player ?? 0;
  const p = n > 0 ? s.players[playerKey(team.id, n)] : undefined;
  const name = ev?.name ?? (n > 0 ? nameOf(s, team.id, n) : team.name);
  const assist = m.kind === 'goal' && ev ? (ev.otherName ?? (ev.other !== undefined && ev.other > 0 ? nameOf(s, team.id, ev.other) : '')) : '';
  const score = ev?.score ?? m.score;
  const i = side === 'home' ? 0 : 1;
  const before: Score = m.kind === 'goal' ? (i === 0 ? [Math.max(score[0] - 1, 0), score[1]] : [score[0], Math.max(score[1] - 1, 0)]) : score;
  return {
    match,
    home,
    away,
    side,
    team,
    n,
    name,
    first: p?.first ?? '',
    last: p?.last ?? name,
    assist,
    minute: m.minute,
    score,
    before,
    commentary: ev ? ev.text || plainLine(s, match, ev) : '',
  };
}

/** The toast's headline word (luau:6243), and the scene's line under the team name (luau:6593, 6638). */
export function kindLabel(kind: Moment['kind']): string {
  if (kind === 'red') return 'Red card';
  if (kind === 'goalCancelled') return 'Goal disallowed';
  return 'Goal';
}

const count = (n: number, one: string, many: string) => (n === 0 ? '' : `${n} ${n === 1 ? one : many}`);

/** A summary's one line: "3 goals · 1 red card". */
export function summaryLine(moments: readonly Moment[]): string {
  const { goals, reds, cancelled } = summarize(moments);
  return [count(goals, 'goal', 'goals'), count(reds, 'red card', 'red cards'), count(cancelled, 'disallowed', 'disallowed')].filter(Boolean).join(' · ');
}
