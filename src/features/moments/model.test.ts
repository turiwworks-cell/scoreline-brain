import { describe, expect, it } from 'vitest';
import type { Moment } from '../../domain';
import { demoState } from '../../domain/testing/demo';
import { kindLabel, momentInfo, summaryLine } from './model';

const s = demoState();
const fraArg = s.matches[1]!;

const goal = (patch: Partial<Moment> = {}, ev: Record<string, unknown> = {}): Moment => ({
  id: 'g1',
  kind: 'goal',
  matchId: 1,
  side: 'home',
  score: [3, 1],
  minute: 61,
  event: { id: 'e1', seq: 9, kind: 'goal', side: 'home', minute: 61, player: 20, other: 10, score: [3, 1], ...ev },
  ...patch,
});

describe('momentInfo', () => {
  it('names the scorer, the assist and the score either side of the goal', () => {
    const i = momentInfo(s, goal())!;
    expect(i.match).toBe(fraArg);
    expect(i.team.id).toBe('fra');
    expect([i.home.id, i.away.id]).toEqual(['fra', 'arg']);
    expect(i.n).toBe(20);
    expect(i.name).toBe('Doué');
    expect(i.first).toBe('Désiré');
    expect(i.last).toBe('Doué');
    expect(i.assist).toBe('Mbappé');
    expect(i.score).toEqual([3, 1]);
    expect(i.before).toEqual([2, 1]);
    expect(i.commentary).toBe('Doué scores for France, set up by Mbappé.');
  });

  it('an away goal rolls the away digit; the event text is the commentary when sent', () => {
    const i = momentInfo(s, goal({ side: 'away', score: [2, 2] }, { side: 'away', player: 10, other: undefined, score: [2, 2], text: 'Messi curls it in.' }))!;
    expect(i.team.id).toBe('arg');
    expect(i.before).toEqual([2, 1]);
    expect(i.assist).toBe('');
    expect(i.commentary).toBe('Messi curls it in.');
  });

  it('a goal seen only as a score change has no scorer and no commentary', () => {
    const i = momentInfo(s, goal({ event: undefined }))!;
    expect(i.n).toBe(0);
    expect(i.name).toBe('France');
    expect(i.last).toBe('France');
    expect(i.first).toBe('');
    expect(i.commentary).toBe('');
  });

  it('a red card keeps the score; an unknown match gives nothing', () => {
    const red = momentInfo(s, goal({ kind: 'red', score: [3, 1] }, { kind: 'red', player: 4, other: undefined }))!;
    expect(red.before).toEqual([3, 1]);
    expect(red.last).toBe('Upamecano');
    expect(red.assist).toBe('');
    expect(momentInfo(s, goal({ matchId: 999 }))).toBeNull();
  });
});

describe('labels', () => {
  it('says what kind of moment it is', () => {
    expect(kindLabel('goal')).toBe('Goal');
    expect(kindLabel('red')).toBe('Red card');
    expect(kindLabel('goalCancelled')).toBe('Goal disallowed');
  });

  it('counts a summary', () => {
    const ms = [goal(), goal({ id: 'g2' }), goal({ id: 'r', kind: 'red' }), goal({ id: 'c', kind: 'goalCancelled' })];
    expect(summaryLine(ms)).toBe('2 goals · 1 red card · 1 disallowed');
    expect(summaryLine([goal()])).toBe('1 goal');
  });
});
