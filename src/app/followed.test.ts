import { describe, expect, it, vi } from 'vitest';
import { createFollowPref } from '../features/matchList/follow/pref';
import { bridgeFollow, DEMO_FOLLOWED } from './followed';

describe('bridgeFollow', () => {
  it("starts the simulation on the player followed already, then on each one chosen after", () => {
    const pref = createFollowPref(DEMO_FOLLOWED);
    const follow = vi.fn();
    const off = bridgeFollow({ follow }, pref);
    expect(follow).toHaveBeenLastCalledWith({ team: 'arg', n: 10 });

    pref.set({ team: 'fra', n: 16 });
    expect(follow).toHaveBeenLastCalledWith({ team: 'fra', n: 16 });
    pref.set({ team: 'arg', n: 10 });
    expect(follow).toHaveBeenLastCalledWith({ team: 'arg', n: 10 });
    // Unfollow is a choice too: nobody is told
    pref.set(null);
    expect(follow).toHaveBeenLastCalledWith(null);
    expect(follow).toHaveBeenCalledTimes(4);

    off();
    pref.set({ team: 'eng', n: 9 });
    expect(follow).toHaveBeenCalledTimes(4);
  });

  it('a player chosen on an earlier visit is followed from the start, not Argentina\'s 10', () => {
    const store = new Map([['scoreline:follow', JSON.stringify({ team: 'fra', n: 16 })]]);
    const pref = createFollowPref(DEMO_FOLLOWED, { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => void store.set(k, v) });
    const follow = vi.fn();
    bridgeFollow({ follow }, pref);
    expect(follow).toHaveBeenCalledTimes(1);
    expect(follow).toHaveBeenCalledWith({ team: 'fra', n: 16 });
  });
});
