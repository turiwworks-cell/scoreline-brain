import { afterEach, describe, expect, it, vi } from 'vitest';
import { createScrollMemory, SCROLL_ENTRIES, scrollPlan } from './scrollMemory';

function fakeStorage(initial?: string) {
  const data = new Map<string, string>(initial ? [['scoreline:scroll', initial]] : []);
  return { getItem: vi.fn((k: string) => data.get(k) ?? null), setItem: vi.fn((k: string, v: string) => void data.set(k, v)), data };
}

afterEach(() => vi.useRealTimers());

describe('scrollPlan', () => {
  it('back/forward restores, new content goes to the top, anything else stays', () => {
    expect(scrollPlan({ pop: true, saved: 420, contentChanged: true })).toEqual({ kind: 'restore', y: 420 });
    expect(scrollPlan({ pop: true, saved: undefined, contentChanged: true })).toEqual({ kind: 'top' });
    expect(scrollPlan({ pop: false, saved: 420, contentChanged: true })).toEqual({ kind: 'top' });
    expect(scrollPlan({ pop: false, saved: 420, contentChanged: false })).toEqual({ kind: 'keep' });
    expect(scrollPlan({ pop: true, saved: undefined, contentChanged: false })).toEqual({ kind: 'keep' });
  });
});

describe('scroll memory', () => {
  it('keeps a position per history entry and pane', () => {
    const m = createScrollMemory(null);
    m.set('a', 'list', 120.6);
    m.set('a', 'match', 40);
    m.set('b', 'list', -5);
    expect(m.get('a', 'list')).toBe(121);
    expect(m.get('a', 'match')).toBe(40);
    expect(m.get('b', 'list')).toBe(0);
    expect(m.get('b', 'match')).toBeUndefined();
  });

  it('forgets the oldest entries past the limit, digit-only keys included', () => {
    const m = createScrollMemory(null);
    m.set('12345', 'list', 1);
    for (let i = 0; i < SCROLL_ENTRIES; i++) m.set(`k${i}`, 'list', i);
    expect(m.get('12345', 'list')).toBeUndefined();
    expect(m.get('k0', 'list')).toBe(0);
    // touching an entry makes it the newest
    m.set('k0', 'match', 5);
    m.set('new', 'list', 1);
    expect(m.get('k0', 'list')).toBe(0);
    expect(m.get('k1', 'list')).toBeUndefined();
  });

  it('writes to storage shortly after a change and reads it back after a reload', () => {
    vi.useFakeTimers();
    const s = fakeStorage();
    const m = createScrollMemory(s);
    m.set('a', 'list', 300);
    m.set('a', 'match', 80);
    expect(s.setItem).not.toHaveBeenCalled();
    vi.advanceTimersByTime(300);
    expect(s.setItem).toHaveBeenCalledTimes(1);
    const again = createScrollMemory(s);
    expect(again.get('a', 'list')).toBe(300);
    expect(again.get('a', 'match')).toBe(80);
  });

  it('survives broken or blocked storage', () => {
    expect(createScrollMemory(fakeStorage('{not json')).get('a', 'list')).toBeUndefined();
    expect(createScrollMemory(fakeStorage('{"a":{"list":3}}')).get('a', 'list')).toBeUndefined();
    const blocked = { getItem: () => null, setItem: () => { throw new Error('quota'); } };
    const m = createScrollMemory(blocked);
    m.set('a', 'list', 10);
    expect(() => m.flush()).not.toThrow();
    expect(m.get('a', 'list')).toBe(10);
  });
});
