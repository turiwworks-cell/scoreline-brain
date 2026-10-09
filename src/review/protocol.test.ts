import { describe, expect, it } from 'vitest';
import { appRoute } from './protocol';

const origin = 'https://scoreline.test';

describe('the route the review page may show', () => {
  it('keeps an app path, its query and its hash', () => {
    expect(appRoute('/match/1/facts?demo=fast&day=1#x', origin)).toBe('/match/1/facts?demo=fast&day=1#x');
    expect(appRoute(`${origin}/?live=0`, origin)).toBe('/?live=0');
  });
  it('falls back to the list for nothing, another site, or the review page itself', () => {
    expect(appRoute(null, origin)).toBe('/');
    expect(appRoute('', origin)).toBe('/');
    expect(appRoute('https://example.com/match/1', origin)).toBe('/');
    expect(appRoute('//example.com/x', origin)).toBe('/');
    expect(appRoute('javascript:alert(1)', origin)).toBe('/');
    expect(appRoute('/review.html', origin)).toBe('/');
    expect(appRoute(`${origin}/review.html?to=%2F`, origin)).toBe('/');
    expect(appRoute('/review', origin)).toBe('/');
  });
});
