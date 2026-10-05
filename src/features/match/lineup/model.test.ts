import { describe, expect, it } from 'vitest';
import type { Match, MatchEvent, Player } from '../../../domain';
import { benchOrder, bestOf, fullName, initials, lineOf, roleOf, sideMarks, squadGroups } from './model';

const ev = (e: Partial<MatchEvent> & Pick<MatchEvent, 'kind' | 'side'>, i = 0): MatchEvent => ({ id: `e${i}`, seq: i, minute: 10, ...e });

describe('sideMarks', () => {
  const events: MatchEvent[] = [
    ev({ kind: 'goal', side: 'home', player: 10, other: 7, minute: 23 }, 1),
    ev({ kind: 'goal', side: 'home', player: 10, minute: 52 }, 2),
    ev({ kind: 'goal', side: 'home', player: 9, other: 7, minute: 60, cancelled: true }, 3),
    ev({ kind: 'goal', side: 'away', player: 10, minute: 39 }, 4),
    ev({ kind: 'yellow', side: 'home', player: 8, minute: 30 }, 5),
    ev({ kind: 'red', side: 'home', player: 4, minute: 70 }, 6),
    ev({ kind: 'sub', side: 'home', player: 15, other: 8, minute: 65 }, 7),
    ev({ kind: 'shot', side: 'home', player: 11 }, 8),
  ];
  const home = sideMarks(events, 'home');

  it('counts goals and assists for his side only, leaving out a goal VAR took back', () => {
    expect(home.get(10)).toMatchObject({ goals: 2, assists: 0 });
    expect(home.get(7)).toMatchObject({ goals: 0, assists: 1 });
    expect(home.get(9)).toBeUndefined();
    expect(sideMarks(events, 'away').get(10)).toMatchObject({ goals: 1 });
  });

  it('records cards', () => {
    expect(home.get(8)).toMatchObject({ yellow: true, red: false });
    expect(home.get(4)).toMatchObject({ yellow: false, red: true });
  });

  it('records who came on, who went off and whom he replaced', () => {
    expect(home.get(15)).toMatchObject({ on: 65, replaced: 8 });
    expect(home.get(8)).toMatchObject({ off: 65, yellow: true });
  });

  it('says nothing about a player the events do not mention', () => {
    expect(home.get(11)).toBeUndefined();
  });
});

describe('benchOrder', () => {
  it('lists those who came on first, by the minute, then the rest by shirt', () => {
    const marks = sideMarks([ev({ kind: 'sub', side: 'home', player: 22, other: 3, minute: 80 }, 1), ev({ kind: 'sub', side: 'home', player: 13, other: 4, minute: 60 }, 2)], 'home');
    expect(benchOrder([1, 22, 12, 13], marks)).toEqual([13, 22, 1, 12]);
  });
});

describe('ratings', () => {
  const match = {
    status: 'live',
    players: { home: { '10': { rating: 9.1 }, '7': { rating: 6.9 }, '15': { rating: 6.4 }, '3': { rating: 7.7 } }, away: {} },
  } as unknown as Match;

  it('picks the first of the eleven with the highest rating, and nobody when none has one', () => {
    expect(bestOf(match, 'home', [3, 7, 10, 11])).toBe(10);
    expect(bestOf(match, 'away', [3, 7, 10, 11])).toBe(0);
  });

  it('counts a rating for a starter or a substitute who came on, not for one who did not', () => {
    expect(lineOf(match, 'home', 10, true, undefined)).toEqual({ rating: 9.1, played: true });
    expect(lineOf(match, 'home', 15, false, { goals: 0, assists: 0, yellow: false, red: false, on: 65 })).toEqual({ rating: 6.4, played: true });
    expect(lineOf(match, 'home', 3, false, undefined)).toEqual({ rating: 7.7, played: false });
  });

  it('shows none before kick-off', () => {
    expect(lineOf({ ...match, status: 'scheduled' } as Match, 'home', 10, true, undefined).played).toBe(false);
  });
});

describe('the squad', () => {
  const p = (n: number, pos: string, role = ''): Player => ({ id: `ita:${n}`, team: 'ita', n, first: 'A', last: `P${n}`, short: `P${n}`, pos, role, club: '', born: '', height: 0 });
  const players = Object.fromEntries([p(1, 'GK'), p(23, 'GK'), p(4, 'DF'), p(2, 'DF'), p(8, 'MF'), p(9, 'FW', 'Centre-forward')].map((x) => [x.id, x]));

  it('groups the eleven and the bench by line, each by shirt, leaving out empty lines and unknown players', () => {
    const groups = squadGroups(players, 'ita', { xi: [23, 4, 8, 9, 99], bench: [1, 2] });
    expect(groups.map((g) => [g.label, g.ns])).toEqual([
      ['Goalkeepers', [1, 23]],
      ['Defenders', [2, 4]],
      ['Midfielders', [8]],
      ['Forwards', [9]],
    ]);
  });

  it('gives a role: the squad’s own, else one from his line', () => {
    expect(roleOf(players['ita:9'])).toBe('Centre-forward');
    expect(roleOf(players['ita:4'])).toBe('Defender');
    expect(roleOf(undefined)).toBe('Midfielder');
  });

  it('prints first and last name, or the last alone', () => {
    expect(fullName(players['ita:4'], '#4')).toBe('A P4');
    expect(fullName({ ...players['ita:4']!, first: '' }, '#4')).toBe('P4');
    expect(fullName(undefined, '#4')).toBe('#4');
  });
});

describe('initials', () => {
  it('takes the first letter of the first and the last word', () => {
    expect(initials('Didier Deschamps')).toBe('DD');
    expect(initials('Roberto De Zerbi')).toBe('RZ');
    expect(initials('Zidane')).toBe('Z');
    expect(initials('')).toBe('');
  });
});
