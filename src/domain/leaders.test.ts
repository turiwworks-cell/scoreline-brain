import { describe, expect, it } from 'vitest';
import { applyFeed, emptyState } from './apply';
import { leaders, lineupOf, type Leader } from './leaders';
import { parseFeed } from './schemas';
import { DEMO_T0, demoFeedJson, demoState } from './testing/demo';
import type { Match } from './types';

const inMatch1 = (list: readonly Leader[]) => list.filter((l) => l.match.id === 1);
const who = (list: readonly Leader[]) => list.map((l) => `${l.side === 'home' ? l.match.home : l.match.away}${l.n} ${l.rating}`);

type Json = ReturnType<typeof demoFeedJson>;
function withMatch(id: number, patch: Record<string, unknown>) {
  const json: Json = demoFeedJson();
  json.matches = json.matches.map((m) => (m.id === id ? { ...m, ...patch } : m));
  return applyFeed(emptyState(), parseFeed(json), DEMO_T0).state;
}

describe('leaders (luau:6891)', () => {
  it("ranks tonight's rated players, best first", () => {
    expect(who(leaders(demoState(), DEMO_T0))).toEqual([
      'fra10 8.4',
      'bra9 8.1',
      'fra11 7.9',
      'arg10 7.6',
      'fra7 7.3', // level with arg9: the earlier one in match, side and line-up order stays first
      'arg9 7.3',
      'eng1 7.1',
      'arg21 6.9', // came off the bench at 46'
      'fra16 6.8',
      'arg22 6.6', // went off at 46'
      'arg24 5.9',
    ]);
  });

  it('leaves out players who are rated but unused, rated 0, or outside the line-up', () => {
    const list = who(leaders(demoState(), DEMO_T0));
    expect(list.some((s) => s.startsWith('fra9 '))).toBe(false); // on the bench, never came on
    expect(list.some((s) => s.startsWith('arg23 '))).toBe(false); // rating 0
    expect(list.some((s) => s.startsWith('bra30 '))).toBe(false); // not in the line-up or on the bench
  });

  it("counts a bench player as played when the provider's minutes say so", () => {
    const s = withMatch(1, { players: { home: { '9': { rating: 6.5, minutes: 5 } }, away: {} } });
    expect(who(leaders(s, DEMO_T0))).toContain('fra9 6.5');
    const zero = withMatch(1, { players: { home: { '9': { rating: 6.5, minutes: 0 } }, away: {} } });
    expect(who(leaders(zero, DEMO_T0))).not.toContain('fra9 6.5');
  });

  it("counts a starter even when the provider's minutes say 0", () => {
    const s = withMatch(1, { players: { home: { '10': { rating: 8.4, minutes: 0 } }, away: {} } });
    expect(who(leaders(s, DEMO_T0))).toContain('fra10 8.4');
  });

  it('counts a bench player who came on', () => {
    const s = withMatch(1, {
      events: [{ id: 's', seq: 1, kind: 'sub', side: 'home', minute: 50, player: 9, other: 10 }],
      players: { home: { '9': { rating: 6.5 } }, away: {} },
    });
    expect(who(inMatch1(leaders(s, DEMO_T0)))).toEqual(['fra9 6.5']);
  });

  it("counts a bench player who came on at kick-off as played, though he hasn't a minute yet", () => {
    const s = withMatch(1, {
      minute: 0,
      events: [{ id: 's', seq: 1, kind: 'sub', side: 'home', minute: 0, player: 9, other: 10 }],
      players: { home: { '9': { rating: 6.1 } }, away: {} },
    });
    expect(who(inMatch1(leaders(s, DEMO_T0)))).toEqual(['fra9 6.1']);
  });

  it("only looks at today's started matches", () => {
    const ratings = { home: { '1': { rating: 9.5 } }, away: {} };
    expect(who(leaders(withMatch(8, { players: ratings }), DEMO_T0))[0]).toBe('fra10 8.4'); // yesterday
    expect(who(leaders(withMatch(6, { players: ratings }), DEMO_T0))[0]).toBe('fra10 8.4'); // not started
    expect(who(leaders(withMatch(6, { players: ratings, status: 'finished' }), DEMO_T0))[0]).toBe('nga1 9.5');
  });

  it('is empty before anyone has played', () => {
    expect(leaders(emptyState(), DEMO_T0)).toEqual([]);
  });
});

describe('lineupOf (luau:7790)', () => {
  it('uses the line-up sent', () => {
    const s = demoState();
    expect(lineupOf(s, s.matches[1] as Match, 'away').xi).toEqual([23, 3, 6, 13, 26, 20, 24, 7, 9, 22, 10]);
  });

  it('without eleven, puts the squad out in shirt order', () => {
    const s = withMatch(1, { lineups: { home: { formation: '4-4-2', xi: [10], bench: [9] } } });
    const lu = lineupOf(s, s.matches[1] as Match, 'home');
    expect(lu.formation).toBe('4-4-2');
    expect(lu.xi).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
    expect(lu.bench).toEqual([12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26]);
  });

  it('falls back to shirts 1–11 without a squad', () => {
    const s = demoState();
    expect(lineupOf(s, s.matches[2] as Match, 'home')).toEqual({ formation: '4-3-3', xi: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], bench: [] });
  });
});
