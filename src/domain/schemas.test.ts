import { describe, expect, it } from 'vitest';
import { colorOf, parseEvent, parseFeed } from './schemas';

describe('parseFeed', () => {
  it('never throws, and gives an empty feed for junk', () => {
    for (const raw of [null, 42, 'feed', [], { matches: 'nope' }]) {
      expect(parseFeed(raw)).toMatchObject({ teams: [], leagues: [], matches: [] });
    }
  });

  it('falls back to defaults instead of failing', () => {
    const f = parseFeed({
      teams: [{ id: 'mci', name: 'Manchester City', colors: ['6CABDD', 0x1c2c5b] }],
      matches: [{ id: '9', home: 'mci', away: 'ars', score: ['2', null], status: 'ft', minute: 'x' }],
    });
    expect(f.teams[0]).toEqual({ id: 'mci', name: 'Manchester City', short: 'MAN', colors: ['#6CABDD', '#1C2C5B'] });
    expect(f.matches[0]).toMatchObject({ id: 9, seq: 0, score: [2, 0], status: 'finished', minute: 0, league: 'fri' });
  });

  it('drops only the items it cannot use', () => {
    const f = parseFeed({
      teams: [{ name: 'no id' }, { id: 'ars' }],
      matches: [
        { id: 1, home: 'ars' },
        {
          id: 2,
          home: 'ars',
          away: 'che',
          events: [{ id: 'a', kind: 'goal', side: 'a' }, { id: 'b', kind: 'dance' }],
        },
      ],
    });
    expect(f.teams.map((t) => t.id)).toEqual(['ars']);
    expect(f.matches.map((m) => m.id)).toEqual([2]);
    expect(f.matches[0]?.events).toEqual([{ id: 'a', kind: 'goal', side: 'away' }]);
  });

  it('gives events without an id one that is the same on every poll', () => {
    const raw = {
      matches: [
        {
          id: 1,
          home: 'a',
          away: 'b',
          events: [
            { kind: 'corner', side: 'home', minute: 3 },
            { kind: 'corner', side: 'home', minute: 3 },
          ],
        },
      ],
    };
    const ids = parseFeed(raw).matches[0]?.events.map((e) => e.id);
    expect(ids).toEqual(['~corner-home-3--1', '~corner-home-3--2']);
    expect(parseFeed(raw).matches[0]?.events.map((e) => e.id)).toEqual(ids);
  });

  it('clamps momentum to -1…1', () => {
    const f = parseFeed({ matches: [{ id: 1, home: 'a', away: 'b', momentum: [2, -3, '0.5'] }] });
    expect(f.matches[0]?.momentum).toEqual([1, -1, 0.5]);
  });
});

describe('parseEvent', () => {
  it('reads the v2 fields', () => {
    expect(parseEvent({ id: '9f3', seq: 12, match: 501, kind: 'goal', side: 'home', minute: 66, player: 14, other: 7, style: 'header', score: [2, 1] })).toEqual({
      id: '9f3',
      seq: 12,
      match: 501,
      kind: 'goal',
      side: 'home',
      minute: 66,
      player: 14,
      other: 7,
      style: 'header',
      score: [2, 1],
    });
  });

  it('reads a VAR cancel', () => {
    expect(parseEvent({ id: 'v', seq: 13, match: 501, kind: 'goalCancelled', side: 'home', ref: '9f3', score: [1, 1] })).toMatchObject({ kind: 'goalCancelled', ref: '9f3', score: [1, 1] });
  });

  it('rejects an event it cannot place', () => {
    expect(parseEvent({ kind: 'goal' })).toBeUndefined();
    expect(parseEvent({ match: 1, kind: 'dance' })).toBeUndefined();
    expect(parseEvent(null)).toBeUndefined();
  });
});

describe('colorOf', () => {
  it('reads the three colour forms', () => {
    expect(colorOf('#0055a4', '#000000')).toBe('#0055A4');
    expect(colorOf('0055A4', '#000000')).toBe('#0055A4');
    expect(colorOf(0x0055a4, '#000000')).toBe('#0055A4');
    expect(colorOf('blue', '#8A8A8A')).toBe('#8A8A8A');
  });
});
