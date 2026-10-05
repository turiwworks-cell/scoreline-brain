import { describe, expect, it } from 'vitest';
import { demoState } from '../../domain/testing/demo';
import { createScorelineStore } from '../../store';
import { selectInsightGoals, selectInsightLeaders, selectInsightTables } from './selectors';

describe('insight selector identity', () => {
  it('keeps lists and rows stable for a clock or action-only update', () => {
    const store = createScorelineStore(demoState());
    const d = store.getState().domain;
    const before = store.getState();
    const a = selectInsightLeaders(before);
    const b = selectInsightGoals(before);
    const c = selectInsightTables(1)(before);
    store.setState({ domain: { ...d, matches: { ...d.matches, 1: { ...d.matches[1]!, clock: { ...d.matches[1]!.clock, second: 1 } } } } });
    expect(selectInsightLeaders(store.getState())).toBe(a);
    expect(selectInsightGoals(store.getState())).toBe(b);
    expect(selectInsightTables(1)(store.getState())).toBe(c);
  });
  it('updates the ranking when a provider changes a rating', () => {
    const store = createScorelineStore(demoState());
    const a = selectInsightLeaders(store.getState());
    const d = store.getState().domain;
    const m = d.matches[1]!;
    store.setState({
      domain: {
        ...d,
        matches: { ...d.matches, 1: { ...m, players: { ...m.players!, home: { ...m.players!.home, '10': { rating: 6, minutes: 58 } } } } },
      },
    });
    const b = selectInsightLeaders(store.getState());
    expect(b).not.toBe(a);
    expect(b[0]).toMatchObject({ team: 'bra', n: 9, rating: 8.1 });
  });
});
