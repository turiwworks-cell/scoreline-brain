import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { parseEvent, parseFeed } from '../../../domain';
import { demoFeedJson } from '../../../domain/testing/demo';
import { scorelineStore } from '../../../store';
import { BALL_HOLD, FRESH, followReduce, goalEvents, useFollowLive } from './live';

afterEach(cleanup);

describe('followReduce', () => {
  it('an act becomes the newest, with the ball state it came with', () => {
    const s = followReduce(FRESH, { type: 'act', at: 5, text: 'Dribbles past X', kind: 'dribble', onBall: true, clock: '58:14' });
    expect(s.acts).toEqual([{ t: 5, txt: 'Dribbles past X', kind: 'dribble', clock: '58:14' }]);
    expect(s).toMatchObject({ ball: true, ballAt: 5 });
    const off = followReduce(s, { type: 'act', at: 9, text: 'Moves into space', kind: 'move', onBall: false, clock: '58:20' });
    expect(off.acts.map((a) => a.t)).toEqual([9, 5]);
    expect(off.ball).toBe(false);
  });

  it('a goal puts him on the ball and marks when it came', () => {
    const s = followReduce(FRESH, { type: 'goal', at: 7, text: 'GOAL! FRA 2–1 ARG', clock: '60:00' });
    expect(s).toMatchObject({ goalAt: 7, ball: true, ballAt: 7 });
    expect(s.acts[0]).toMatchObject({ kind: 'goal' });
  });

  it('an assist and a substitution add an act; a red card marks its time', () => {
    expect(followReduce(FRESH, { type: 'assist', at: 3, text: 'Assist', clock: '1:00' }).acts[0]!.kind).toBe('assist');
    expect(followReduce(FRESH, { type: 'sub', at: 3, text: 'Comes on', clock: '1:00' }).acts[0]!.kind).toBe('sub');
    expect(followReduce(FRESH, { type: 'red', at: 4 }).redAt).toBe(4);
  });

  it('the ball lets go on release, once', () => {
    const on = followReduce(FRESH, { type: 'goal', at: 7, text: 'g', clock: '1:00' });
    const off = followReduce(on, { type: 'release', at: 9.5 });
    expect(off).toMatchObject({ ball: false, ballAt: 9.5 });
    expect(followReduce(off, { type: 'release', at: 12 })).toBe(off);
  });
});

describe('goalEvents', () => {
  const state = () => scorelineStore.getState().domain;
  const names = { short: (t: string) => t.toUpperCase(), name: (_t: string, n: number) => `#${n}` };
  const moment = (player: number, other?: number, side: 'home' | 'away' = 'away') =>
    ({ id: 'm', kind: 'goal', matchId: 1, side, score: [2, 2], minute: 60, event: { id: 'e', kind: 'goal', side, minute: 60, player, other, score: [2, 2] } }) as never;

  beforeEach(() => {
    scorelineStore.getState().actions.applyFeed(parseFeed(demoFeedJson()), Date.now());
  });

  it('his goal, his assist, or nothing', () => {
    const m = state().matches[1]!;
    expect(goalEvents(moment(10), m, { team: 'arg', n: 10 }, names, 1, '60:00')).toEqual([{ type: 'goal', at: 1, text: expect.stringContaining('FRA'), clock: '60:00' }]);
    expect(goalEvents(moment(9, 10), m, { team: 'arg', n: 10 }, names, 1, '60:00')[0]).toMatchObject({ type: 'assist' });
    expect(goalEvents(moment(9, 7), m, { team: 'arg', n: 10 }, names, 1, '60:00')).toEqual([]);
    // the other team's goal is not his
    expect(goalEvents(moment(10, undefined, 'home'), m, { team: 'arg', n: 10 }, names, 1, '60:00')).toEqual([]);
  });
});

describe('useFollowLive', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    scorelineStore.getState().actions.applyFeed(parseFeed(demoFeedJson()), Date.now());
  });
  afterEach(() => vi.useRealTimers());

  const ev = (e: Record<string, unknown>) => {
    const parsed = parseEvent({ match: 1, ...e });
    if (!parsed) throw new Error('bad event');
    act(() => scorelineStore.getState().actions.applyEvent(parsed, Date.now()));
  };

  it('collects his actions, ignores everyone else’s, and lets go of the ball after a goal', () => {
    let clock = 100;
    const { result } = renderHook(() => useFollowLive({ team: 'arg', n: 10 }, 1, () => clock));
    expect(result.current.acts).toEqual([]);

    ev({ kind: 'action', side: 'away', player: 9, text: 'Runs the channel', act: 'run', onBall: true });
    expect(result.current.acts).toEqual([]);

    clock = 101;
    ev({ kind: 'action', side: 'away', player: 10, text: 'Dribbles past Upamecano', act: 'dribble', onBall: true });
    expect(result.current.acts[0]).toMatchObject({ t: 101, txt: 'Dribbles past Upamecano', kind: 'dribble' });
    expect(result.current.ball).toBe(true);

    clock = 102;
    ev({ kind: 'goal', side: 'away', minute: 59, player: 10, score: [2, 2] });
    expect(result.current.goalAt).toBe(102);
    expect(result.current.acts[0]!.kind).toBe('goal');
    expect(result.current.ball).toBe(true);

    clock = 105;
    act(() => vi.advanceTimersByTime(BALL_HOLD * 1000 + 10));
    expect(result.current.ball).toBe(false);
    expect(result.current.ballAt).toBe(105);
  });

  it('a red card for him marks its time', () => {
    let clock = 50;
    const { result } = renderHook(() => useFollowLive({ team: 'arg', n: 10 }, 1, () => clock));
    clock = 51;
    ev({ kind: 'red', side: 'away', minute: 60, player: 10 });
    expect(result.current.redAt).toBe(51);
  });

  it('does nothing without a player or a match', () => {
    const { result } = renderHook(() => useFollowLive(null, undefined));
    expect(result.current).toBe(FRESH);
  });
});
