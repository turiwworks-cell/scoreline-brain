import { describe, expect, it } from 'vitest';
import { share } from './share';

describe('share', () => {
  it('returns the previous value when nothing changed', () => {
    const prev = { a: [1, { b: 2 }], c: 'x' };
    expect(share(prev, { a: [1, { b: 2 }], c: 'x' })).toBe(prev);
  });

  it('keeps unchanged branches when one changed', () => {
    const prev = { a: { b: 1 }, c: { d: 2 } };
    const next = share(prev, { a: { b: 1 }, c: { d: 3 } });
    expect(next).not.toBe(prev);
    expect(next.a).toBe(prev.a);
    expect(next.c).toEqual({ d: 3 });
  });

  it('treats an added or removed key as a change', () => {
    const prev: Record<string, number> = { a: 1 };
    expect(share(prev, { a: 1, b: 2 })).not.toBe(prev);
    expect(share({ a: 1, b: 2 }, prev)).toEqual({ a: 1 });
  });
});
