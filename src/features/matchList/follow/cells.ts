// What the followed card says in words and numbers (followBand, luau:4130–4176, and the notes of
// the card's one-line evening, luau:4345–4372). Pure: the card gives it the facts.

import { playerKey, type DomainState, type Match } from '../../../domain';
import type { Followed, Phase, PStats } from './model';

/** The quick picks the picker offers (`DATA.stars`, luau:2256). */
export const QUICK_PICKS: readonly Followed[] = [
  { team: 'arg', n: 10 },
  { team: 'fra', n: 10 },
  { team: 'eng', n: 9 },
  { team: 'bra', n: 7 },
  { team: 'ger', n: 17 },
  { team: 'ned', n: 4 },
];

/** The quick picks whose player the feed has sent: a chip without a name would say nothing. */
export function knownPicks(players: Pick<DomainState, 'players'>['players']): Followed[] {
  return QUICK_PICKS.filter((p) => players[playerKey(p.team, p.n)] !== undefined);
}

export interface Cell {
  readonly label: string;
  readonly value: string | number;
  /** n: a number, r: a rating tag, s: a short text */
  readonly kind: 'n' | 'r' | 's';
}

/**
 * The cells of the stats band for his evening so far. A keeper's fourth cell is his saves, shown
 * only when the provider sent a count; shots are for the others.
 */
export function bandCells(st: PStats | undefined, phase: Phase, match: Match | undefined, opponent: string, n: number, keeper = false): Cell[] {
  if (st?.played && !st.real) {
    // live data without player numbers: what the events tell
    return [
      { label: 'Minutes', value: st.mins, kind: 'n' },
      { label: 'Goals', value: st.goals, kind: 'n' },
      { label: 'Assists', value: st.assists, kind: 'n' },
      ...(keeper ? [] : [{ label: 'Shots', value: st.shots, kind: 'n' } satisfies Cell]),
    ];
  }
  if (st?.played) {
    const last: Cell[] = keeper ? (st.saves !== undefined ? [{ label: 'Saves', value: st.saves, kind: 'n' }] : []) : [{ label: 'Shots', value: st.shots, kind: 'n' }];
    return [
      phase === 'post' ? { label: 'Minutes', value: st.mins, kind: 'n' } : { label: 'Rating', value: st.rating, kind: 'r' },
      { label: 'Touches', value: st.touches, kind: 'n' },
      { label: 'Passes', value: `${st.passOk}/${st.passes}`, kind: 's' },
      ...last,
    ];
  }
  if (match?.status === 'scheduled') {
    return [
      { label: 'Kick-off', value: match.kickoff, kind: 's' },
      { label: 'Opponent', value: opponent, kind: 's' },
    ];
  }
  return [
    { label: 'This match', value: match ? "Didn't play" : '—', kind: 's' },
    { label: 'Shirt', value: `#${n}`, kind: 's' },
  ];
}

/**
 * What the card's evening line says when he has no goal to show (luau:4360). Before his match it
 * says only the day: the band under it already shows the kick-off (the Lua's "Tomorrow · kick-off
 * 20:45" said it twice; review of 2026-10-04).
 */
export function eveningNote(match: Match | undefined, st: PStats | undefined, onPitch: boolean, keeper = false): string {
  if (!match) return 'No match scheduled';
  if (match.status === 'scheduled') return match.day === 1 ? 'Tomorrow' : 'Today';
  if (!onPitch) return st?.played ? 'Substituted' : 'On the bench';
  // a keeper is told his saves, not that he has not scored
  if (keeper) return st?.saves === undefined ? 'In goal tonight' : st.saves === 0 ? 'No saves yet' : st.saves === 1 ? '1 save tonight' : `${st.saves} saves tonight`;
  return 'No goals yet tonight';
}
