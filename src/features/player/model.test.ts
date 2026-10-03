import { describe, expect, it } from 'vitest';
import type { MatchEvent, Player, Team } from '../../domain';
import { ageOf, barsOf, factsOf, fitSize, notPlayed, roleLabel, sideIn, stepOf, substitutionOf, tagsOf } from './model';

const ev = (e: Partial<MatchEvent>): MatchEvent => ({ id: String(Math.random()), seq: 0, kind: 'goal', side: 'home', minute: 1, ...e }) as MatchEvent;
const team = { id: 'fra', name: 'France', short: 'FRA', colors: ['#0055A4', '#EF4135'] } as Team;
const mbappe = { id: 'fra:10', team: 'fra', n: 10, first: 'Kylian', last: 'Mbappé', short: 'Mbappé', pos: 'FW', role: '', club: 'Real Madrid', born: '1998-12-20', height: 178 } as Player;

describe('player model', () => {
  it('finds his side and ignores matches he is not in', () => {
    expect(sideIn({ home: 'fra', away: 'arg' }, 'arg')).toBe('away');
    expect(sideIn({ home: 'fra', away: 'arg' }, 'ita')).toBeUndefined();
    expect(sideIn(undefined, 'fra')).toBeUndefined();
  });
  it('counts a birthday that has not come yet', () => {
    expect(ageOf('1998-12-20', new Date(2026, 9, 3))).toBe(27);
    expect(ageOf('1998-09-05', new Date(2026, 9, 3))).toBe(28);
    expect(ageOf('', new Date(2026, 9, 3))).toBe(0);
  });
  it('facts: club, age, height, shirt; without a birth date nation, line, shirt', () => {
    expect(factsOf(mbappe, team, 10, new Date(2026, 9, 3)).map((f) => f.label)).toEqual(['Club', 'Age', 'Height', 'Shirt']);
    const bare = factsOf({ ...mbappe, born: '' }, team, 10, new Date());
    expect(bare).toEqual([
      { label: 'Nation', value: 'France' },
      { label: 'Line', value: 'Attack' },
      { label: 'Shirt', value: '#10' },
    ]);
  });
  it('role falls back to his line, then Player', () => {
    expect(roleLabel({ ...mbappe, role: 'Centre-forward' })).toBe('Centre-forward');
    expect(roleLabel(mbappe)).toBe('Forward');
    expect(roleLabel(undefined)).toBe('Player');
  });
  it('tags: goals, assists, booked, sent off', () => {
    const events = [ev({ kind: 'yellow', player: 10, minute: 30 }), ev({ kind: 'red', player: 10, minute: 80 }), ev({ kind: 'yellow', player: 9, minute: 5 })];
    expect(tagsOf(events, 'home', 10, { goals: 2, assists: 1 }).map((t) => t.label)).toEqual(['2 goals', '1 assist', "Booked 30'", "Sent off 80'"]);
    expect(tagsOf([], 'home', 10, { goals: 0, assists: 0 })).toEqual([]);
  });
  it('substitution: off wins over on', () => {
    const events = [ev({ kind: 'sub', player: 14, other: 10, minute: 63 }), ev({ kind: 'sub', player: 10, other: 9, minute: 20 })];
    expect(substitutionOf(events, 'home', 10)).toEqual({ off: true, minute: 63 });
    expect(substitutionOf(events, 'home', 14)).toEqual({ off: false, minute: 63 });
    expect(substitutionOf(events, 'away', 14)).toBeUndefined();
  });
  it('the note for a player who has not played', () => {
    expect(notPlayed('scheduled', '20:00').body).toContain('20:00');
    expect(notPlayed('live', '').head).toBe('On the bench');
    expect(notPlayed('finished', '').head).toBe('Unused substitute');
  });
  it('bars carry only what the provider sends', () => {
    expect(barsOf({ touches: 30, passes: 20, passOk: 15, shots: 2 }, false).map((b) => [b.label, b.value])).toEqual([['Touches', 30], ['Pass accuracy', 75], ['Shots', 2]]);
    expect(barsOf({ touches: 30, passes: 0, passOk: 0, shots: 0 }, true).map((b) => b.label)).toEqual(['Touches', 'Pass accuracy']);
  });
  it('steps through the squad and wraps', () => {
    expect(stepOf([1, 2, 3], 3, 1)).toBe(1);
    expect(stepOf([1, 2, 3], 1, -1)).toBe(3);
    expect(stepOf([], 1, 1)).toBeUndefined();
  });
  it('fits the surname', () => {
    expect(fitSize(40, 100, 200)).toBe(40);
    expect(fitSize(40, 400, 200)).toBe(20);
  });
});
