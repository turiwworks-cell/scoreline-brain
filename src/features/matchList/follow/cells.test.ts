import { describe, expect, it } from 'vitest';
import { demoState, DEMO_T0 } from '../../../domain/testing/demo';
import { bandCells, eveningNote, knownPicks, QUICK_PICKS } from './cells';
import { playerStats } from './model';

const state = demoState();
const live = state.matches[1]!;
const upcoming = state.matches[6]!;

describe('the stats band', () => {
  it('rating, touches, passes and shots while he plays', () => {
    const st = playerStats(state, live, 'away', 10, DEMO_T0);
    const cells = bandCells(st, 'live', live, 'France', 10);
    expect(cells.map((c) => c.label)).toEqual(['Rating', 'Touches', 'Passes', 'Shots']);
    expect(cells[0]).toMatchObject({ kind: 'r', value: 7.6 });
    expect(cells[2]).toMatchObject({ kind: 's', value: '0/0' });
  });

  it('minutes replace the rating once his match is over', () => {
    const st = playerStats(state, live, 'away', 10, DEMO_T0);
    expect(bandCells(st, 'post', live, 'France', 10)[0]).toMatchObject({ label: 'Minutes', value: 58 });
  });

  it('with no numbers from the provider it tells what the events tell', () => {
    const st = { ...playerStats(state, live, 'away', 10, DEMO_T0), real: false };
    expect(bandCells(st, 'live', live, 'France', 10).map((c) => c.label)).toEqual(['Minutes', 'Goals', 'Assists', 'Shots']);
  });

  it('before kick-off: when, and against whom', () => {
    const st = playerStats(state, upcoming, 'home', 1, DEMO_T0);
    expect(bandCells(st, 'pre', upcoming, 'Senegal', 1)).toEqual([
      { label: 'Kick-off', value: '21:00', kind: 's' },
      { label: 'Opponent', value: 'Senegal', kind: 's' },
    ]);
  });

  it('without a match, or a place in it, only his shirt', () => {
    expect(bandCells(undefined, 'none', undefined, '', 9)).toEqual([
      { label: 'This match', value: '—', kind: 's' },
      { label: 'Shirt', value: '#9', kind: 's' },
    ]);
    const bench = playerStats(state, live, 'away', 2, DEMO_T0);
    expect(bandCells(bench, 'live', live, 'France', 2)[0]).toMatchObject({ value: "Didn't play" });
  });
});

describe('the evening line', () => {
  it('says why there is no goal to show', () => {
    const st = playerStats(state, live, 'away', 2, DEMO_T0);
    expect(eveningNote(undefined, undefined, false)).toBe('No match scheduled');
    expect(eveningNote(upcoming, undefined, false)).toBe('Today · kick-off 21:00');
    expect(eveningNote({ ...upcoming, day: 1 }, undefined, false)).toBe('Tomorrow · kick-off 21:00');
    expect(eveningNote(live, st, false)).toBe('On the bench');
    expect(eveningNote(live, playerStats(state, live, 'away', 22, DEMO_T0), false)).toBe('Substituted');
    expect(eveningNote(live, st, true)).toBe('No goals yet tonight');
  });
});

describe('the quick picks', () => {
  it('are the Lua’s six, and only those the feed has sent', () => {
    expect(QUICK_PICKS).toHaveLength(6);
    expect(knownPicks(state.players)).toEqual([
      { team: 'arg', n: 10 },
      { team: 'fra', n: 10 },
    ]);
  });
});
