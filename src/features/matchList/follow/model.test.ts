import { describe, expect, it } from 'vitest';
import { scoreStr } from '../../../domain';
import { demoState, DEMO_T0 } from '../../../domain/testing/demo';
import {
  clockText,
  countdown,
  followHeight,
  followPhase,
  goalAct,
  goalLine,
  goalsBy,
  nextView,
  onPitch,
  playerFlags,
  playerStats,
  pushAct,
  RED_SECONDS,
  sameFollowed,
  sideOf,
  subAct,
  type Act,
  type Flags,
} from './model';

const state = demoState();
const match = state.matches[1]!; // France 2–1 Argentina, 58'

describe('his evening', () => {
  it('finds his side and whether he started', () => {
    expect(sideOf(match, 'arg')).toBe('away');
    expect(sideOf(match, 'fra')).toBe('home');
    const messi = playerFlags(state, match, 'away', 10);
    expect(messi.starter).toBe(true);
    expect(messi.goals).toBe(1);
    expect(messi.assists).toBe(0);
    expect(messi.shots).toBe(1);
    expect(messi.yellow).toBe(false);
    expect(onPitch(messi)).toBe(true);
  });

  it('reads substitutions, cards and assists off the events', () => {
    // 21 came on for 22 at 46'
    expect(playerFlags(state, match, 'away', 21)).toMatchObject({ starter: false, onAt: 46 });
    expect(onPitch(playerFlags(state, match, 'away', 21))).toBe(true);
    const off = playerFlags(state, match, 'away', 22);
    expect(off).toMatchObject({ starter: true, offAt: 46 });
    expect(onPitch(off)).toBe(false);
    expect(playerFlags(state, match, 'away', 24).yellow).toBe(true);
    expect(playerFlags(state, match, 'home', 7).assists).toBe(1);
    expect(playerFlags(state, match, 'away', 2)).toMatchObject({ starter: false, goals: 0 });
    expect(onPitch(playerFlags(state, match, 'away', 2))).toBe(false);
  });

  it('his numbers: the provider’s line when there is one, minutes from the events', () => {
    const st = playerStats(state, match, 'away', 10, DEMO_T0);
    expect(st).toMatchObject({ rating: 7.6, mins: 58, goals: 1, real: true, played: true });
    const sub = playerStats(state, match, 'away', 21, DEMO_T0);
    expect(sub.mins).toBe(12);
    const bench = playerStats(state, match, 'away', 2, DEMO_T0);
    expect(bench).toMatchObject({ played: false, real: false, mins: 0 });
  });

  it('a match that has not started has no minutes', () => {
    const ns = state.matches[6]!;
    expect(playerStats(state, ns, 'home', 1, DEMO_T0).played).toBe(false);
  });
});

describe('the card’s phase', () => {
  const flags: Flags = { starter: true, yellow: false, goals: 0, assists: 0, shots: 0 };
  it('is none without a match or a squad place', () => {
    expect(followPhase(undefined, flags, Infinity)).toBe('none');
    expect(followPhase(match, undefined, Infinity)).toBe('none');
  });
  it('follows the match: pre, live, post', () => {
    expect(followPhase(match, flags, Infinity)).toBe('live');
    expect(followPhase(state.matches[6]!, flags, Infinity)).toBe('pre');
    expect(followPhase(state.matches[8]!, flags, Infinity)).toBe('post');
  });
  it('a red card shows its flood for 3.2 s and then settles into post', () => {
    const red = { ...flags, redAt: 55 };
    expect(followPhase(match, red, 0)).toBe('red');
    expect(followPhase(match, red, RED_SECONDS - 0.01)).toBe('red');
    expect(followPhase(match, red, RED_SECONDS)).toBe('post');
  });
  it('its full height: 200 closed of the extras, 266 on the pitch, 300 after', () => {
    expect(followHeight('pre', false)).toBe(200);
    expect(followHeight('live', false)).toBe(200);
    expect(followHeight('live', true)).toBe(266);
    expect(followHeight('post', false)).toBe(300);
    expect(followHeight('red', true)).toBe(300);
  });
});

describe('his acts', () => {
  const act = (t: number): Act => ({ t, txt: `act ${t}`, kind: 'touch', clock: '10:00' });
  it('keeps the newest four, newest first', () => {
    let acts: readonly Act[] = [];
    for (let i = 1; i <= 6; i++) acts = pushAct(acts, act(i));
    expect(acts.map((a) => a.t)).toEqual([6, 5, 4, 3]);
  });
  it('writes the clock and the goal lines', () => {
    expect(clockText(58, 14)).toBe('58:14');
    expect(clockText(5, 3)).toBe('05:03');
    expect(clockText(120, 0)).toBe('99:00');
    expect(goalAct('FRA', 'ARG', [2, 1])).toBe(`GOAL! FRA ${scoreStr(2, 1)} ARG`);
    expect(goalLine(1)).toBe('First goal of the match');
    expect(goalLine(2)).toBe('Second goal of the match');
    expect(goalLine(3)).toBe('Hat-trick tonight');
    expect(goalLine(4)).toBe('4th goal of the match');
  });
  it('his goals by minute, only his and only counted ones', () => {
    expect(goalsBy(match, 'away', 10).map((e) => e.minute)).toEqual([33]);
    expect(goalsBy(match, 'home', 10).map((e) => e.minute)).toEqual([12]);
    expect(goalsBy(match, 'home', 99)).toEqual([]);
  });
  it('says what a substitution means for him', () => {
    const ev = match.events.find((e) => e.kind === 'sub')!;
    expect(subAct(state, match, ev, 22)).toBe('Substituted. López comes on');
    expect(subAct(state, match, ev, 21)).toBe('Comes on for Lautaro');
    expect(subAct(state, match, ev, 10)).toBeUndefined();
  });
});

describe('his next match', () => {
  it('counts days, hours and minutes', () => {
    const now = 1_000_000;
    const at = now + ((3 * 24 + 4) * 60 + 5) * 60_000;
    expect(countdown(at, now)).toEqual([3, 4, 5]);
    expect(countdown(now - 5, now)).toEqual([0, 0, 0]);
    expect(countdown(now + 59_999, now)).toEqual([0, 0, 0]);
  });
  it('has no invented fixture when the feed sends none', () => {
    expect(nextView(undefined)).toEqual({ opponent: '', day: 'Date to be confirmed', clock: '', at: undefined });
    expect(nextView({ opponent: 'esp', date: 'Sat 26 Sep', time: '20:45', at: 5 })).toEqual({ opponent: 'esp', day: 'Sat 26 Sep', clock: '20:45', at: 5 });
  });
  it('compares followed players by value', () => {
    expect(sameFollowed({ team: 'arg', n: 10 }, { team: 'arg', n: 10 })).toBe(true);
    expect(sameFollowed({ team: 'arg', n: 10 }, { team: 'fra', n: 10 })).toBe(false);
    expect(sameFollowed(null, null)).toBe(true);
    expect(sameFollowed(null, { team: 'arg', n: 10 })).toBe(false);
  });
});
