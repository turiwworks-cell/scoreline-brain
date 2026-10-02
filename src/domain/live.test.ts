import { describe, expect, it } from 'vitest';
import { applyFeed, emptyState } from './apply';
import { liveMatches } from './live';
import { parseFeed } from './schemas';
import { DEMO_T0, demoFeedJson, demoState } from './testing/demo';

const ids = (ms: readonly { id: number }[]) => ms.map((m) => m.id);

describe('liveMatches (luau:3694)', () => {
  it('lists the live demo matches with the favourite (France v Argentina) first', () => {
    expect(ids(liveMatches(demoState()))).toEqual([1, 2, 3, 4, 5]);
  });

  it('moves every favourite ahead, each group keeping feed order', () => {
    const json = demoFeedJson();
    json.matches = json.matches.map((m) => ({ ...m, favourite: m.id === 3 || m.id === 5 }));
    const s = applyFeed(emptyState(), parseFeed(json), DEMO_T0).state;
    expect(ids(liveMatches(s))).toEqual([3, 5, 1, 2, 4]);
  });

  it("takes the user's own favourites when given", () => {
    const fav = new Set([4, 2, 8]);
    expect(ids(liveMatches(demoState(), (m) => fav.has(m.id)))).toEqual([2, 4, 1, 3, 5]);
  });

  it('leaves out finished and scheduled matches, even favourites', () => {
    const json = demoFeedJson();
    json.matches = json.matches.map((m) => ({ ...m, favourite: m.id === 6 || m.id === 8 }));
    const s = applyFeed(emptyState(), parseFeed(json), DEMO_T0).state;
    expect(ids(liveMatches(s))).toEqual([1, 2, 3, 4, 5]);
    expect(liveMatches(emptyState())).toEqual([]);
  });

  it('returns the store’s match objects, not copies', () => {
    const s = demoState();
    expect(liveMatches(s)[0]).toBe(s.matches[1]);
  });
});
