import { describe, expect, it, vi } from 'vitest';
import { parseEvent, parseFeed, type Moment } from '../../domain';
import { demoFeedJson } from '../../domain/testing/demo';
import { appMoments } from '../../motion';
import { scorelineStore } from '../../store';
import { createGoalFeed, watchAppGoals, watchMoments, type MomentSource } from './goalFeed';
import { markLife } from './goalFeel';

function source(initial: Moment[] = []) {
  let state = { moments: initial as readonly Moment[], session: 0 };
  const ls = new Set<(s: typeof state, p: typeof state) => void>();
  const src: MomentSource = {
    getState: () => state,
    subscribe: (l) => {
      ls.add(l);
      return () => ls.delete(l);
    },
  };
  return {
    src,
    push(...m: Moment[]) {
      const prev = state;
      state = { ...state, moments: [...state.moments, ...m] };
      ls.forEach((l) => l(state, prev));
    },
    replace(m: Moment[]) {
      const prev = state;
      state = { ...state, moments: m };
      ls.forEach((l) => l(state, prev));
    },
    restart() {
      const prev = state;
      state = { moments: [], session: state.session + 1 };
      ls.forEach((l) => l(state, prev));
    },
  };
}

const goal = (id: string, matchId: number, side: 'home' | 'away' = 'home'): Moment => ({ id, kind: 'goal', matchId, side, score: [1, 0], minute: 1 }) as Moment;

describe('watchMoments', () => {
  it('handles each moment once and ignores those already queued', () => {
    const s = source([goal('old', 1)]);
    const seen = vi.fn();
    watchMoments(s.src, seen);
    s.push(goal('a', 1));
    s.push(goal('b', 1));
    s.replace([goal('a', 1), goal('b', 1), goal('c', 2)]);
    expect(seen.mock.calls.map((c) => (c[0] as Moment).id)).toEqual(['a', 'b', 'c']);
  });

  it('stops when told to', () => {
    const s = source();
    const seen = vi.fn();
    const stop = watchMoments(s.src, seen);
    stop();
    s.push(goal('a', 1));
    expect(seen).not.toHaveBeenCalled();
  });
});

describe('goal feed', () => {
  it('clears old marks on demo restart and accepts a repeated event id in the new evening', () => {
    const feed = createGoalFeed({ now: () => 1 });
    const s = source();
    feed.watch(s.src);
    s.push(goal('again', 1));
    expect(feed.mark(1)).toBeDefined();
    s.restart();
    expect(feed.marks().size).toBe(0);
    expect(feed.latest()).toBeUndefined();
    s.push(goal('again', 1, 'away'));
    expect(feed.mark(1)?.side).toBe('away');
  });

  it('remembers the latest goal of each match and who scored', () => {
    let now = 5;
    const feed = createGoalFeed({ now: () => now });
    feed.record(7, 'home');
    now = 9;
    feed.record(8, 'away');
    expect(feed.mark(7)).toMatchObject({ t: 5, side: 'home' });
    expect(feed.mark(8)).toMatchObject({ t: 9, side: 'away' });
    expect(feed.latest()?.id).toBe(8);
    expect(feed.mark(7)!.n).not.toBe(feed.mark(8)!.n);
  });

  it('two goals in one match restart the choreography', () => {
    const feed = createGoalFeed({ now: () => 1 });
    feed.record(7, 'home');
    const first = feed.mark(7)!;
    feed.record(7, 'home', 3);
    expect(feed.mark(7)!.n).toBeGreaterThan(first.n);
    expect(feed.mark(7)!.t).toBe(3);
  });

  it('a goal taken back removes its mark and falls back to the next latest', () => {
    const feed = createGoalFeed({ now: () => 1 });
    feed.record(7, 'home', 2);
    feed.record(8, 'away', 4);
    feed.clear(8);
    expect(feed.mark(8)).toBeUndefined();
    expect(feed.latest()?.id).toBe(7);
    feed.clear(7);
    expect(feed.latest()).toBeUndefined();
  });

  it('says whether anything is still playing', () => {
    const feed = createGoalFeed({ now: () => 0 });
    expect(feed.active(0)).toBe(false);
    feed.record(1, 'home', 10);
    expect(feed.active(10 + markLife() - 0.1)).toBe(true);
    expect(feed.active(10 + markLife() + 0.1)).toBe(false);
  });

  it('tells subscribers, and reads goals and cancelled goals off a store’s queue', () => {
    const feed = createGoalFeed({ now: () => 1 });
    const s = source();
    const heard = vi.fn();
    feed.subscribe(heard);
    feed.watch(s.src);
    s.push(goal('a', 3, 'away'));
    expect(feed.mark(3)?.side).toBe('away');
    s.push({ id: 'b', kind: 'goalCancelled', matchId: 3, score: [0, 0], minute: 2 } as Moment);
    expect(feed.mark(3)).toBeUndefined();
    s.push({ id: 'c', kind: 'red', matchId: 3, side: 'home', score: [0, 0], minute: 3 } as Moment);
    expect(heard).toHaveBeenCalledTimes(2);
  });
});

describe('the app’s goals arrive through the MomentDirector', () => {
  it('marks a goal when delivered, holds it while the tab is hidden, and starts over on restart', () => {
    scorelineStore.getState().actions.resetFeed(parseFeed(demoFeedJson()), Date.now());
    let now = 1;
    const feed = createGoalFeed({ now: () => now });
    const stop = watchAppGoals(feed);
    const goal = (id: string, seq: number) => scorelineStore.getState().actions.applyEvent(parseEvent({ match: 2, id, seq, kind: 'goal', side: 'away', minute: 70, score: [0, 2] })!, Date.now());
    const vis = Object.getOwnPropertyDescriptor(Document.prototype, 'visibilityState')!;
    const setHidden = (hidden: boolean) => {
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => (hidden ? 'hidden' : 'visible') });
      document.dispatchEvent(new Event('visibilitychange'));
    };
    try {
      setHidden(true);
      goal('feed-a', 500);
      expect(feed.mark(2)).toBeUndefined();
      expect(scorelineStore.getState().moments).toEqual([]);
      now = 9;
      setHidden(false);
      expect(feed.mark(2)).toMatchObject({ t: 9, side: 'away' });

      scorelineStore.getState().actions.resetFeed(parseFeed(demoFeedJson()), Date.now());
      expect(feed.marks().size).toBe(0);
      expect(appMoments().getSnapshot().stage).toBeNull();
      goal('feed-a', 500);
      expect(feed.mark(2)).toBeDefined();
    } finally {
      stop();
      delete (document as { visibilityState?: unknown }).visibilityState;
      Object.defineProperty(Document.prototype, 'visibilityState', vis);
      scorelineStore.getState().actions.resetFeed(parseFeed(demoFeedJson()), Date.now());
    }
    expect(appMoments().running).toBe(false);
  });
});
