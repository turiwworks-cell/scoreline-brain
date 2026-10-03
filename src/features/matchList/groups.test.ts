import { describe, expect, it } from 'vitest';
import { demoState } from '../../domain/testing/demo';
import { createScorelineStore } from '../../store';
import { cardOrder, FAV, listGroups, sameGroups } from './groups';
import { groupsKey, selectCardIds, selectFollowMatchId, selectGroups } from './selectors';

const state = demoState();

describe('listGroups', () => {
  it('Favourites first, then one group per league in the feed’s order', () => {
    const g = listGroups(state, { day: 0, live: false });
    expect(g.map((x) => x.key)).toEqual([FAV, 'wns', 'nla', 'nlb', 'afq']);
    expect(g[0]!.ids).toEqual([1]);
    // the favourite match is not in its league's group as well
    expect(g[1]!.ids).toEqual([2]);
    expect(g.find((x) => x.key === 'nla')!.ids).toEqual([3, 4]);
  });

  it('a day tab shows that day’s matches', () => {
    expect(listGroups(state, { day: -1, live: false }).map((g) => g.key)).toEqual(['nlb', 'fri']);
    expect(listGroups(state, { day: 1, live: false }).every((g) => g.ids.every((id) => state.matches[id]!.day === 1))).toBe(true);
    expect(listGroups(state, { day: 2, live: false })).toEqual([]);
  });

  it('Ongoing shows only the matches in play, whatever the day', () => {
    const g = listGroups(state, { day: 0, live: true });
    const ids = g.flatMap((x) => x.ids);
    expect(ids).toHaveLength(5);
    expect(ids.every((id) => state.matches[id]!.status === 'live')).toBe(true);
    expect(g.map((x) => x.key)).toEqual([FAV, 'wns', 'nla', 'nlb']);
  });

  it('sameGroups compares keys and ids', () => {
    const a = listGroups(state, { day: 0, live: false });
    expect(sameGroups(a, listGroups(state, { day: 0, live: false }))).toBe(true);
    expect(sameGroups(a, a.slice(1))).toBe(false);
    expect(sameGroups(a, a.map((g, i) => (i === 1 ? { ...g, ids: [99] } : g)))).toBe(false);
  });
});

describe('cardOrder', () => {
  it('favourites first, then by id', () => {
    expect(
      cardOrder([
        { id: 5, favourite: false },
        { id: 3, favourite: false },
        { id: 9, favourite: true },
      ]),
    ).toEqual([9, 3, 5]);
  });
});

describe('selectors', () => {
  it('keys the list by day or live', () => {
    expect(groupsKey({ day: 1, live: false })).toBe('1');
    expect(groupsKey({ day: 0, live: true })).toBe('live');
  });

  it('a selector is the same function every time and returns the same array while nothing changes', () => {
    expect(selectGroups('0')).toBe(selectGroups('0'));
    const store = createScorelineStore(state);
    const a = selectGroups('0')(store.getState());
    const b = selectGroups('0')(store.getState());
    expect(a).toBe(b);
    expect(selectCardIds(store.getState())).toEqual(selectCardIds(store.getState()));
  });

  it('the live cards are the live matches, favourites first', () => {
    const store = createScorelineStore(state);
    const ids = selectCardIds(store.getState());
    expect(ids).toHaveLength(5);
    expect(ids[0]).toBe(1);
  });

  it('a team’s match is its live one, then today’s, then tomorrow’s', () => {
    const store = createScorelineStore(state);
    expect(selectFollowMatchId('arg')(store.getState())).toBe(1);
    expect(selectFollowMatchId('nga')(store.getState())).toBeDefined();
    expect(selectFollowMatchId('nobody')(store.getState())).toBeUndefined();
  });
});
