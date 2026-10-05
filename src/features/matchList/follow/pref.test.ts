import { describe, expect, it, vi } from 'vitest';
import { createFollowPref, FOLLOW_KEY, followPref } from './pref';

const store = (initial: Record<string, string> = {}) => {
  const data = { ...initial };
  return { data, getItem: (k: string) => data[k] ?? null, setItem: (k: string, v: string) => void (data[k] = v) };
};

describe('the follow preference', () => {
  it('starts as the fallback, and keeps the same object between reads', () => {
    const fallback = { team: 'arg', n: 10 };
    const pref = createFollowPref(fallback, store());
    expect(pref.get()).toBe(fallback);
    expect(pref.get()).toBe(pref.get());
  });

  it('remembers a choice, tells listeners and stores it', () => {
    const s = store();
    const pref = createFollowPref({ team: 'arg', n: 10 }, s);
    const heard = vi.fn();
    pref.subscribe(heard);
    pref.set({ team: 'fra', n: 10 });
    expect(pref.get()).toEqual({ team: 'fra', n: 10 });
    expect(JSON.parse(s.data[FOLLOW_KEY]!)).toEqual({ team: 'fra', n: 10 });
    expect(heard).toHaveBeenCalledTimes(1);
    expect(createFollowPref(null, s).get()).toEqual({ team: 'fra', n: 10 });
  });

  it('not following anyone is a choice: the default does not come back', () => {
    const s = store();
    const pref = createFollowPref({ team: 'arg', n: 10 }, s);
    pref.set(null);
    expect(s.data[FOLLOW_KEY]).toBe('none');
    expect(pref.get()).toBeNull();
    expect(createFollowPref({ team: 'arg', n: 10 }, s).get()).toBeNull();
  });

  it('an unusable stored value falls back', () => {
    for (const raw of ['{', '{"team":1,"n":"x"}', '[]', 'null']) {
      expect(createFollowPref({ team: 'arg', n: 10 }, store({ [FOLLOW_KEY]: raw })).get()).toEqual({ team: 'arg', n: 10 });
    }
  });

  it('works without storage, or with storage that throws (a private window)', () => {
    const pref = createFollowPref(null);
    pref.set({ team: 'eng', n: 9 });
    expect(pref.get()).toEqual({ team: 'eng', n: 9 });
    const broken = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    };
    const p2 = createFollowPref(null, broken);
    p2.set({ team: 'bra', n: 7 });
    expect(p2.get()).toEqual({ team: 'bra', n: 7 });
  });

  it('stops telling a listener that unsubscribed', () => {
    const pref = createFollowPref(null, store());
    const heard = vi.fn();
    pref.subscribe(heard)();
    pref.set({ team: 'arg', n: 10 });
    expect(heard).not.toHaveBeenCalled();
  });

  it('the app’s preference is one object per fallback value', () => {
    expect(followPref({ team: 'arg', n: 10 })).toBe(followPref({ team: 'arg', n: 10 }));
    expect(followPref(null)).not.toBe(followPref({ team: 'arg', n: 10 }));
  });
});
