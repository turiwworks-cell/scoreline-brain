import { describe, expect, it } from 'vitest';
import { colorOf, createFeedParser, parseEvent, parseFeed } from './schemas';

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

describe('a Source session feed parser', () => {
  const match = (id = 1, seq = 4) => ({ id, seq, home: 'a', away: 'b', status: 'live', minute: 60, second: 10, score: [0, 0], events: [] as Record<string, unknown>[] });
  const wire = () => ({ version: 2, teams: [{ id: 'a' }, { id: 'b' }], squads: { a: { players: [{ n: 7, last: 'Seven' }] } }, matches: [match(), match(2)] });

  it('reuses validated, unchanged matches and metadata while a changed seq still updates', () => {
    const parse = createFeedParser();
    const a = parse(wire());
    const raw = wire();
    raw.matches[1]!.seq++;
    raw.matches[1]!.score = [1, 0];
    const b = parse(raw);
    expect(b).toEqual(parseFeed(raw));
    expect(b.matches[0]).toBe(a.matches[0]);
    expect(b.matches[1]).not.toBe(a.matches[1]);
    expect(b.teams).toBe(a.teams);
    expect(b.squads).toBe(a.squads);
  });

  it('reads late events and details even when seq is unchanged', () => {
    const parse = createFeedParser();
    const a = parse(wire());
    const raw = wire();
    raw.matches[0]!.events.push({ id: 'late', seq: 4, kind: 'yellow', side: 'away' });
    const b = parse({ ...raw, matches: [{ ...raw.matches[0], venue: { name: 'New detail' } }, raw.matches[1]] });
    expect(b.matches[0]).not.toBe(a.matches[0]);
    expect(b.matches[0]?.events[0]?.id).toBe('late');
    expect(b.matches[0]?.venue?.name).toBe('New detail');
  });

  it('owns its cached input, so mutations of a reused wire object are not missed', () => {
    const parse = createFeedParser();
    const raw = wire();
    const a = parse(raw);
    raw.matches[0]!.second = 30;
    raw.squads.a.players[0]!.last = 'Renamed';
    const b = parse(raw);
    expect(b).toEqual(parseFeed(raw));
    expect(b.matches[0]?.second).toBe(30);
    expect(a.matches[0]?.second).toBe(10);
    expect(b.squads.a?.players[0]?.last).toBe('Renamed');
  });

  it('reads clock-only corrections with the same defaults while retaining validated details', () => {
    const parse = createFeedParser();
    const raw = { ...wire(), matches: [{ ...match(), events: [{ id: 'y', kind: 'yellow' }], venue: { name: 'Ground' } }] };
    const a = parse(raw).matches[0]!;
    const corrected = { ...raw, matches: [{ ...raw.matches[0], minute: '61', second: 'bad' }] };
    const b = parse(corrected).matches[0]!;
    expect(b).toEqual(parseFeed(corrected).matches[0]);
    expect(b.minute).toBe(61);
    expect(b.second).toBe(0);
    expect(b.events).toBe(a.events);
    expect(b.venue).toBe(a.venue);
    const removed = { ...corrected, matches: [{ id: 1, seq: 4, home: 'a', away: 'b', status: 'live', score: [0, 0], events: [{ id: 'y', kind: 'yellow' }], venue: { name: 'Ground' } }] };
    expect(parse(removed)).toEqual(parseFeed(removed));
  });

  it('validates v1 and missing-seq matches in full, and isolates source sessions', () => {
    const parse = createFeedParser();
    const raw = { ...wire(), version: 1 };
    const a = parse(raw);
    const b = parse(structuredClone(raw));
    expect(b).toEqual(a);
    expect(b.matches[0]).not.toBe(a.matches[0]);
    expect(createFeedParser()(wire()).matches[0]).not.toBe(parse(wire()).matches[0]);
    const missing = { version: 2, matches: [{ id: 1, home: 'a', away: 'b' }] };
    expect(parse(missing).matches[0]).not.toBe(parse(missing).matches[0]);
  });

  it('drops removed matches and validates a reused id or pairing afresh', () => {
    const parse = createFeedParser();
    const a = parse(wire());
    parse({ version: 2, matches: [] });
    const b = parse(wire());
    expect(b.matches[0]).not.toBe(a.matches[0]);
    const changed = parse({ ...wire(), matches: [{ ...match(), home: 'c' }] });
    expect(changed.matches[0]?.home).toBe('c');
  });

  it('keeps lenient fallbacks and does not reuse a valid match for an invalid same-id entry', () => {
    const parse = createFeedParser();
    parse(wire());
    for (const raw of [null, [], { version: 2, matches: [{ id: 1, seq: 4, home: 'a' }] }, { teams: [() => 1] }]) {
      expect(parse(raw)).toEqual(parseFeed(raw));
    }
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
