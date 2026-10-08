import { describe, expect, it } from 'vitest';
import { demoState, DEMO_T0 } from './testing/demo';
import { isKeeper, playerStats } from './playerStats';
import { parseFeed } from './schemas';
import type { Match, Player } from './types';

const state = demoState();
const live = state.matches[1] as Match;
const withLine = (line: Record<string, number>): Match => ({ ...live, players: { home: { ...live.players?.home, '16': line }, away: live.players?.away ?? {} } });

describe('a goalkeeper\'s saves', () => {
  const line = { rating: 7, minutes: 58, touches: 20, passes: 12, passesOk: 9, shots: 0 };

  it('are passed on when the provider sent them, a genuine 0 included', () => {
    expect(playerStats(state, withLine({ ...line, saves: 3 }), 'home', 16, DEMO_T0).saves).toBe(3);
    expect(playerStats(state, withLine({ ...line, saves: 0 }), 'home', 16, DEMO_T0).saves).toBe(0);
  });

  it('are not known when the provider did not send them: not 0', () => {
    const st = playerStats(state, withLine(line), 'home', 16, DEMO_T0);
    expect(st.saves).toBeUndefined();
    expect(st).not.toHaveProperty('saves');
    // no line at all: nothing to say either
    expect(playerStats(state, live, 'home', 16, DEMO_T0).saves).toBeUndefined();
  });

  it('are read from the feed as sent: a count the provider could not give is left out, not read as 0', () => {
    const feed = parseFeed({
      teams: [{ id: 'a' }, { id: 'b' }],
      matches: [{ id: 1, home: 'a', away: 'b', status: 'live', players: { home: { '1': { touches: 5, saves: 2 }, '2': { touches: 5, saves: 0 }, '3': { touches: 5, saves: null }, '4': { touches: 5, saves: 'n/a' }, '5': { touches: 5 } }, away: {} } }],
    });
    const home = feed.matches[0]?.players?.home;
    expect(home?.['1']?.saves).toBe(2);
    expect(home?.['2']?.saves).toBe(0);
    expect(home?.['3']).not.toHaveProperty('saves');
    expect(home?.['4']).not.toHaveProperty('saves');
    expect(home?.['5']).not.toHaveProperty('saves');
    // the other numbers keep reading as before
    expect(home?.['3']?.touches).toBe(5);
  });
});

describe('isKeeper', () => {
  it('is the squad\'s own goalkeeper position', () => {
    expect(isKeeper({ pos: 'GK' } as Player)).toBe(true);
    expect(isKeeper({ pos: 'FW' } as Player)).toBe(false);
    expect(isKeeper(undefined)).toBe(false);
  });
});
