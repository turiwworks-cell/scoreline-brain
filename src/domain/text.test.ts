import { describe, expect, it } from 'vitest';
import { DEMO_T0, demoState } from './testing/demo';
import { minLabel, minText, nameOf, plainLine, scoreStr } from './text';
import type { Match, MatchEvent } from './types';

const state = demoState();
const fraArg = state.matches[1] as Match;
const engBra = state.matches[2] as Match;

describe('minText (luau:2467)', () => {
  it.each([
    [0, "0'"],
    [1, "1'"],
    [45, "45'"],
    [47, "47'"], // first-half added time isn't split out
    [90, "90'"],
    [91, "90+1'"],
    [93, "90+3'"],
    [120, "90+30'"],
  ])('%i → %s', (min, out) => {
    expect(minText(min)).toBe(out);
  });
});

describe('minLabel (luau:2471)', () => {
  it('shows the running minute of a live match', () => {
    expect(minLabel(fraArg, DEMO_T0)).toBe("58'");
    expect(minLabel(fraArg, DEMO_T0 + 35 * 60_000)).toBe("90+3'");
  });

  it('shows FT once finished, and the kick-off time before', () => {
    expect(minLabel(state.matches[8] as Match, DEMO_T0)).toBe('FT');
    expect(minLabel(state.matches[6] as Match, DEMO_T0)).toBe('21:00');
    expect(minLabel(state.matches[11] as Match, DEMO_T0)).toBe('20:45');
  });
});

describe('scoreStr (luau:2431)', () => {
  it('joins with an en dash', () => {
    expect(scoreStr(2, 1)).toBe('2–1');
    expect(scoreStr(0, 0)).toBe('0–0');
    expect(scoreStr(...fraArg.score)).toBe('2–1');
    expect(scoreStr(...(state.matches[10] as Match).score)).toBe('0–3');
  });
});

describe('nameOf (luau:2314)', () => {
  it('uses the shirt name, or #n without a squad entry', () => {
    expect(nameOf(state, 'arg', 6)).toBe('Li. Martínez');
    expect(nameOf(state, 'fra', 99)).toBe('#99');
    expect(nameOf(state, 'eng', 9)).toBe('#9');
  });
});

describe('plainLine (luau:7691)', () => {
  it("gives the Lua's line for each demo event", () => {
    expect(fraArg.events.map((e) => plainLine(state, fraArg, e))).toEqual([
      'Mbappé scores for France, set up by Dembélé.',
      'E. Fernández is booked.',
      'Messi scores for Argentina.',
      'Corner to France.',
      'López comes on for Lautaro.',
      'Olise scores for France.',
      'Álvarez forces a save.',
    ]);
  });

  const ev = (e: Partial<MatchEvent> & Pick<MatchEvent, 'kind' | 'side'>): MatchEvent => ({ id: 'x', seq: 0, minute: 60, ...e });

  it('covers every kind with a line', () => {
    const lines = (['shot', 'miss', 'blocked', 'bigChance', 'corner', 'foul', 'offside', 'yellow', 'red'] as const).map((kind) =>
      plainLine(state, fraArg, ev({ kind, side: 'away', player: 10 })),
    );
    expect(lines).toEqual([
      'Messi forces a save.',
      'Messi shoots wide.',
      "Messi's shot is blocked.",
      'Big chance for Messi.',
      'Corner to Argentina.',
      'Free kick to Argentina.',
      'Messi is caught offside.',
      'Messi is booked.',
      'Messi is sent off.',
    ]);
  });

  it('has no line for a VAR cancel (the Lua has no such kind)', () => {
    expect(plainLine(state, fraArg, ev({ kind: 'goalCancelled', side: 'home', ref: 'e6' }))).toBe('');
  });

  it("names the team when there's no player, so a bare goal reads '<team> scores for <team>.'", () => {
    expect(plainLine(state, fraArg, ev({ kind: 'goal', side: 'home' }))).toBe('France scores for France.');
    expect(plainLine(state, fraArg, ev({ kind: 'offside', side: 'away', player: 0 }))).toBe('Argentina is caught offside.');
  });

  it('falls back to #n for a player outside the squad', () => {
    expect(plainLine(state, engBra, ev({ kind: 'shot', side: 'home', player: 9 }))).toBe('#9 forces a save.');
    expect(plainLine(state, engBra, ev({ kind: 'goal', side: 'away', player: 10, other: 7 }))).toBe('#10 scores for Brazil, set up by #7.');
  });

  it('takes the other player from the same team for goals and subs only', () => {
    // Assist and player off are home players; for a foul `other` would be an away player, but no line shows it.
    expect(plainLine(state, fraArg, ev({ kind: 'goal', side: 'home', player: 9, other: 10 }))).toBe('Thuram scores for France, set up by Mbappé.');
    expect(plainLine(state, fraArg, ev({ kind: 'sub', side: 'home', player: 12, other: 7 }))).toBe('Barcola comes on for Dembélé.');
    expect(plainLine(state, fraArg, ev({ kind: 'sub', side: 'away', player: 21, other: 7 }))).toBe('López comes on for De Paul.');
  });

  it('prefers the names sent with the event', () => {
    expect(plainLine(state, fraArg, ev({ kind: 'goal', side: 'home', player: 10, name: 'K. Mbappé', otherName: 'O. Dembélé' }))).toBe(
      'K. Mbappé scores for France, set up by O. Dembélé.',
    );
    // An empty otherName wins too, so the assist drops.
    expect(plainLine(state, fraArg, ev({ kind: 'goal', side: 'home', player: 10, other: 7, otherName: '' }))).toBe('Mbappé scores for France.');
    expect(plainLine(state, fraArg, ev({ kind: 'sub', side: 'home', player: 12 }))).toBe('Barcola comes on for .');
  });

  it('inserts names literally', () => {
    expect(plainLine(state, fraArg, ev({ kind: 'yellow', side: 'home', name: "$& O'Neil $1" }))).toBe("$& O'Neil $1 is booked.");
  });
});
