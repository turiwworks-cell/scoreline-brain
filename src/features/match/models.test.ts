import { describe, expect, it } from 'vitest';
import type { Match, MatchEvent } from '../../domain';
import { demoState } from '../../domain/testing/demo';
import { NEUTRAL, sideColors } from './colors';
import { feedItems, feedRows, LIMIT, markerLabel, scoreAt } from './events';
import { feedFrame, growth, OLD, PAIR, startsOf, type FeedTiming } from './feedMotion';
import { formOf } from './form';
import { blockHeight, rowHeight, scorerLines, scorersOf } from './heroLayout';
import { fmtNum, homeShare, possessionOf, statLines } from './statLines';

const state = demoState();
const fraArg = state.matches[1]!;

const ev = (e: Partial<MatchEvent> & Pick<MatchEvent, 'kind' | 'side' | 'minute'>, i: number): MatchEvent => ({ id: `t${i}`, seq: i, ...e }) as MatchEvent;
const withEvents = (events: Partial<MatchEvent>[]): Match => ({ ...fraArg, events: events.map((e, i) => ev(e as MatchEvent, i + 1)) });

describe('stats', () => {
  it('writes whole numbers floored and xG to two places without trailing zeros (fmtNum, luau:4697)', () => {
    expect(fmtNum(7.9, 'int')).toBe('7');
    expect(fmtNum(1.5, 'xg')).toBe('1.5');
    expect(fmtNum(2, 'xg')).toBe('2');
    expect(fmtNum(0.456, 'xg')).toBe('0.46');
  });

  it('uses the feed’s pairs in the Lua’s order when it sends them', () => {
    const m = { ...fraArg, stats: { possession: 58, pairs: { corners: [3, 1], xg: [1.2, 0.4] } } } as unknown as Match;
    expect(statLines(m).map((s) => [s.name, s.home, s.away])).toEqual([
      ['xG', 1.2, 0.4],
      ['Corners', 3, 1],
    ]);
    expect(possessionOf(m)).toBe(58);
  });

  it('counts from the events like refreshStats: a free kick is the other side’s foul, a goal VAR took back counts for nothing', () => {
    const m = withEvents([
      { kind: 'goal', side: 'home', minute: 10, xg: 0.5 },
      { kind: 'goal', side: 'home', minute: 20, xg: 0.6, cancelled: true },
      { kind: 'shot', side: 'away', minute: 30, xg: 0.1 },
      { kind: 'bigChance', side: 'away', minute: 31, xg: 0.3 },
      { kind: 'foul', side: 'home', minute: 40 },
      { kind: 'corner', side: 'away', minute: 41 },
      { kind: 'offside', side: 'home', minute: 50 },
    ]);
    const lines = Object.fromEntries(statLines({ ...m, stats: undefined }).map((s) => [s.key, [s.home, s.away]]));
    expect(lines).toEqual({
      xg: [0.5, 0.4],
      shots: [1, 2],
      onTarget: [1, 2],
      bigChances: [1, 1],
      corners: [0, 1],
      fouls: [0, 1],
      offsides: [1, 0],
    });
    expect(possessionOf({ stats: undefined })).toBe(50);
  });

  it('keeps a sliver for a side with nothing, so two zeros split evenly (luau:5369)', () => {
    expect(homeShare(0, 0)).toBe(0.5);
    expect(homeShare(3, 1)).toBe(0.75);
    expect(homeShare(0, 5)).toBeCloseTo(0.002, 3);
  });
});

describe('form', () => {
  it('draws the Lua’s five letters from the same seed (rng(#k * 13 + m.id + byte(k)))', () => {
    expect(formOf('ita', 11).join('')).toBe('WLDDL');
    expect(formOf('jpn', 11).join('')).toBe('DWLLW');
    expect(formOf('ita', 11)).toEqual(formOf('ita', 11));
  });
});

describe('side colours', () => {
  it('keeps each side’s first colour when they read apart', () => {
    expect(sideColors({ colors: ['#1E3A8A', '#FFFFFF'] }, { colors: ['#75AADB', '#FFFFFF'] })).toEqual(['#1E3A8A', '#75AADB']);
  });
  it('gives the away side its second colour when the firsts are alike, the neutral when both are', () => {
    expect(sideColors({ colors: ['#FFFFFF', '#000000'] }, { colors: ['#FAFAFA', '#C8102E'] })).toEqual(['#FFFFFF', '#C8102E']);
    expect(sideColors({ colors: ['#FFFFFF', '#000000'] }, { colors: ['#FAFAFA', '#F0F0F0'] })).toEqual(['#FFFFFF', NEUTRAL]);
  });
});

describe('the commentary', () => {
  const items = feedItems(state, fraArg);

  it('lists newest first, and a later event first within a minute', () => {
    const m = withEvents([
      { kind: 'corner', side: 'home', minute: 5 },
      { kind: 'shot', side: 'home', minute: 5 },
      { kind: 'goal', side: 'away', minute: 9, player: 10 },
    ]);
    expect(feedItems(state, m).map((e) => e.kind)).toEqual(['goal', 'shot', 'corner']);
  });

  it('names the scorer and the assist, and keeps the score each goal made', () => {
    const goals = items.filter((e) => e.kind === 'goal');
    expect(goals.map((g) => [g.minute, g.name, g.other, g.score])).toEqual(
      expect.arrayContaining([
        [12, 'Mbappé', expect.any(String), '1–0'],
        [33, 'Messi', '', '1–1'],
      ]),
    );
  });

  it('puts half-time before the first first-half event once past 45, and kick-off last when all show', () => {
    const rows = feedRows(items, items.length, 58);
    const kinds = rows.map((r) => r.kind);
    expect(kinds[kinds.length - 1]).toBe('ko');
    const ht = kinds.indexOf('ht');
    expect(ht).toBeGreaterThan(-1);
    const next = rows[ht + 1];
    expect(next?.kind === 'e' && next.item.minute <= 45).toBe(true);
    expect(markerLabel('ht', items)).toBe(`Half-time · ${scoreAt(items, 45)}`);
    // before half-time there is no marker; with rows still hidden there is no kick-off
    expect(feedRows(items, items.length, 40).some((r) => r.kind === 'ht')).toBe(false);
    expect(feedRows(items, 2, 58).some((r) => r.kind === 'ko')).toBe(false);
  });

  it('shows ten rows before “Show all”', () => {
    expect(LIMIT).toBe(10);
  });
});

describe('the commentary’s motion', () => {
  const t: FeedTiming = { duration: 0.5, delay: 0.15, curve: (x) => x };

  it('starts rows that came in together two frames apart (PAIR)', () => {
    expect(startsOf([10, 10, 10, 4])).toEqual([10, 10 + PAIR, 10 + 2 * PAIR, 4]);
  });

  it('counts the new rows within the first ten as growing, and folds from the newest one’s start', () => {
    const starts = startsOf([10, 10, OLD, OLD]);
    const g = growth(starts, 10.1, t, 10);
    expect(g.growing).toBe(2);
    expect(g.newest).toBe(0);
    expect(g.foldT).toBe(10);
    expect(g.until).toBeCloseTo(10 + PAIR + 0.5 + 0.3 + 0.2);
    expect(growth(starts, 20, t, 10)).toMatchObject({ growing: 0, foldT: OLD, until: -Infinity });
  });

  it('lifts the rows under a new one by what is still closed, the end without lag, the lower rows a frame behind', () => {
    const rows = [
      { h: 70, start: 10, index: 1 },
      { h: 44, start: OLD, index: 2 },
      { h: 44, start: OLD, index: 3 },
    ];
    const at = (now: number) => feedFrame(rows, { now, evAll: false, growing: 1, foldT: 10, limit: 10, t });
    const opening = at(10);
    // nothing has opened yet: everything under the new row sits its full height higher
    expect(opening.end).toBe(70);
    expect(opening.lift[1]).toBe(70);
    // halfway: the end has come down 35 px; the row right under lags a frame behind it
    const mid = at(10.25);
    expect(mid.end).toBeCloseTo(35);
    expect(mid.lift[1]).toBeCloseTo(70 * (1 - (0.25 - 1 / 60) / 0.5));
    expect(mid.lift[2]).toBeGreaterThan(mid.lift[1]!);
    // the new row's words arrive 0.04 s late from 14 px above
    expect(mid.alpha[0]).toBeCloseTo((0.25 - 0.04) / 0.5);
    const done = at(11.5);
    expect(done.end).toBe(0);
    expect(done.lift).toEqual([0, 0, 0]);
    expect(done.alpha).toEqual([1, 1, 1]);
  });

  it('folds a row pushed past the first ten away while the new one opens', () => {
    const rows = [
      { h: 44, start: 10, index: 1 },
      { h: 44, start: OLD, index: 11 },
    ];
    const at = (now: number) => feedFrame(rows, { now, evAll: false, growing: 1, foldT: 10, limit: 10, t });
    const f = at(10.4);
    // its space closes as fast as the new one opens, so the end (both rows in the flow, 88 px)
    // stays 44 px up the whole time
    expect(at(10).end).toBeCloseTo(44);
    expect(f.end).toBeCloseTo(44);
    // pushed down past that end, it is gone before the edge reaches its words (keep, 10 px)
    expect(at(10.05).alpha[1]).toBeGreaterThan(0.5);
    expect(f.alpha[1]).toBe(0);
  });
});

describe('the hero', () => {
  it('lists a side’s scorers in the order they first scored, every minute together, VAR’s goals left out', () => {
    const items = feedItems(
      state,
      withEvents([
        { kind: 'goal', side: 'home', minute: 12, player: 10 },
        { kind: 'goal', side: 'home', minute: 30, player: 7 },
        { kind: 'goal', side: 'home', minute: 64, player: 10 },
        { kind: 'goal', side: 'home', minute: 70, player: 9, cancelled: true },
        { kind: 'goal', side: 'away', minute: 33, player: 10 },
      ]),
    );
    expect(scorersOf(items, 'home').map((s) => [s.name, s.minutes])).toEqual([
      ['Mbappé', "12' 64'"],
      ['Dembélé', "30'"],
    ]);
    expect(scorersOf(items, 'away').map((s) => s.name)).toEqual(['Messi']);
  });

  it('packs scorers into lines beside the score and grows the row to hold them', () => {
    const s = (name: string) => ({ key: name, player: 1, name, minutes: "1'" });
    // 10 px a letter: at 390 there is 390 - 18 - 72 - 14 - 70 = 216 px
    const measure = (x: string) => x.length * 10;
    const lines = scorerLines([s('Aaaaaaaaa'), s('Bbbbbbbbb'), s('Ccccccccc')], measure, 390, false);
    expect(lines.map((l) => l.map((x) => x.name))).toEqual([['Aaaaaaaaa'], ['Bbbbbbbbb'], ['Ccccccccc']]);
    expect(scorerLines([s('Aa'), s('Bb')], measure, 390, false)).toHaveLength(1);
    expect(blockHeight(0)).toBe(27.3);
    expect(blockHeight(2)).toBeCloseTo(27.3 + 6 + 32.2);
    // a played match keeps room for the 86 px numbers; one before kick-off doesn't
    expect(rowHeight(0, false)).toBe(98);
    expect(rowHeight(0, true)).toBe(62);
  });
});
