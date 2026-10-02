import { describe, expect, it, vi } from 'vitest';
import { parseEvent, parseFeed, type LiveEvent } from '../domain';
import { createScorelineStore, MAX_MOMENTS } from './store';
import {
  selectActions,
  selectFeaturedMatchId,
  selectLiveMatchIds,
  selectMatch,
  selectMatchIdOfTeam,
  selectMatchIdsByDay,
  selectScore,
  selectSync,
  selectTeam,
} from './selectors';

const T0 = 1_760_000_000_000;

function feed(scores: Record<number, [number, number]> = {}, extra: { status?: string } = {}) {
  return parseFeed({
    version: 2,
    teams: [
      { id: 'ars', name: 'Arsenal', colors: ['#EF0107', '#FFFFFF'] },
      { id: 'che', name: 'Chelsea', colors: ['#034694', '#FFFFFF'] },
      { id: 'liv', name: 'Liverpool', colors: ['#C8102E', '#FFFFFF'] },
      { id: 'mci', name: 'Manchester City', colors: ['#6CABDD', '#FFFFFF'] },
    ],
    leagues: [{ id: 'epl', name: 'Premier League' }],
    matches: [
      { id: 501, seq: 1, day: 0, league: 'epl', home: 'ars', away: 'che', status: extra.status ?? 'live', minute: 60, score: scores[501] ?? [0, 0] },
      { id: 502, seq: 1, day: 1, league: 'epl', home: 'liv', away: 'mci', status: 'scheduled', minute: 0, score: scores[502] ?? [0, 0] },
    ],
  });
}

function event(e: Record<string, unknown>): LiveEvent {
  const ev = parseEvent(e);
  if (!ev) throw new Error('bad event');
  return ev;
}

describe('store', () => {
  it('a feed that changes nothing causes no store update', () => {
    const store = createScorelineStore();
    store.getState().actions.applyFeed(feed(), T0);
    const listener = vi.fn();
    store.subscribe(listener);
    const before = store.getState();
    store.getState().actions.applyFeed(feed(), T0 + 15_000);
    store.getState().actions.applyFeed(feed(), T0 + 30_000);
    expect(listener).not.toHaveBeenCalled();
    expect(store.getState()).toBe(before);
  });

  it('a change keeps the identity of everything else', () => {
    const store = createScorelineStore();
    const { actions } = store.getState();
    actions.applyFeed(feed(), T0);
    const before = store.getState();
    actions.applyFeed(feed({ 501: [1, 0] }), T0 + 15_000);
    const after = store.getState();
    expect(after.domain).not.toBe(before.domain);
    expect(after.domain.matches[501]).not.toBe(before.domain.matches[501]);
    expect(after.domain.matches[502]).toBe(before.domain.matches[502]);
    expect(after.domain.teams).toBe(before.domain.teams);
    expect(after.sync).toBe(before.sync);
    expect(after.actions).toBe(before.actions);
  });

  it('queues moments and hands them over once', () => {
    const store = createScorelineStore();
    const { actions } = store.getState();
    actions.applyFeed(feed(), T0);
    expect(store.getState().moments).toEqual([]);
    actions.applyEvent(event({ id: 'g1', seq: 2, match: 501, kind: 'goal', side: 'home', minute: 61, score: [1, 0] }), T0 + 1000);
    expect(store.getState().moments.map((m) => m.kind)).toEqual(['goal']);
    const listener = vi.fn();
    store.subscribe(listener);
    expect(actions.takeMoments().map((m) => m.id)).toEqual(['501:goal:g1']);
    expect(store.getState().moments).toEqual([]);
    expect(listener).toHaveBeenCalledTimes(1);
    // Empty queue: no update.
    expect(actions.takeMoments()).toEqual([]);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('caps the moment queue', () => {
    const store = createScorelineStore();
    const { actions } = store.getState();
    actions.applyFeed(feed(), T0);
    for (let i = 1; i <= MAX_MOMENTS + 5; i++) {
      actions.applyEvent(event({ id: `g${i}`, seq: i + 1, match: 501, kind: 'goal', side: 'home', minute: 61, score: [i, 0] }), T0 + i);
    }
    const q = store.getState().moments;
    expect(q).toHaveLength(MAX_MOMENTS);
    expect(q[0]?.id).toBe('501:goal:g6');
  });

  it('a duplicate event causes no store update', () => {
    const store = createScorelineStore();
    const { actions } = store.getState();
    actions.applyFeed(feed(), T0);
    const ev = event({ id: 'y1', seq: 2, match: 501, kind: 'yellow', side: 'away', minute: 62, score: [0, 0] });
    actions.applyEvent(ev, T0 + 1000);
    const listener = vi.fn();
    store.subscribe(listener);
    actions.applyEvent(ev, T0 + 2000);
    expect(listener).not.toHaveBeenCalled();
  });

  it('sync status lives apart from match data and only updates on a change', () => {
    const store = createScorelineStore();
    const { actions } = store.getState();
    actions.applyFeed(feed(), T0);
    const domain = store.getState().domain;
    const listener = vi.fn();
    store.subscribe(listener);
    actions.setSync({ phase: 'live', feedError: false });
    expect(listener).toHaveBeenCalledTimes(1);
    actions.setSync({ phase: 'live', feedError: false });
    expect(listener).toHaveBeenCalledTimes(1);
    expect(store.getState().domain).toBe(domain);
    expect(selectSync(store.getState())).toEqual({ phase: 'live', feedError: false });
  });
});

describe('selectors', () => {
  it('factories return the same selector per argument', () => {
    expect(selectMatch(501)).toBe(selectMatch(501));
    expect(selectMatch(501)).not.toBe(selectMatch(502));
    expect(selectTeam('ars')).toBe(selectTeam('ars'));
    expect(selectMatchIdsByDay(0)).toBe(selectMatchIdsByDay(0));
  });

  it('narrow selectors keep their result when other matches change', () => {
    const store = createScorelineStore();
    const { actions } = store.getState();
    actions.applyFeed(feed(), T0);
    const s1 = store.getState();
    const m502 = selectMatch(502)(s1);
    const score502 = selectScore(502)(s1);
    const today = selectMatchIdsByDay(0)(s1);
    const liveIds = selectLiveMatchIds(s1);
    actions.applyFeed(feed({ 501: [1, 0] }), T0 + 15_000);
    const s2 = store.getState();
    expect(s2).not.toBe(s1);
    expect(selectMatch(502)(s2)).toBe(m502);
    expect(selectScore(502)(s2)).toBe(score502);
    // Derived lists: recomputed, but the same array while the ids are the same.
    expect(selectMatchIdsByDay(0)(s2)).toBe(today);
    expect(today).toEqual([501]);
    expect(selectLiveMatchIds(s2)).toBe(liveIds);
    expect(selectActions(s2)).toBe(selectActions(s1));
  });

  it('derived lists change when their contents do', () => {
    const store = createScorelineStore();
    const { actions } = store.getState();
    actions.applyFeed(feed(), T0);
    const liveIds = selectLiveMatchIds(store.getState());
    expect(liveIds).toEqual([501]);
    actions.applyFeed(feed({}, { status: 'finished' }), T0 + 15_000);
    expect(selectLiveMatchIds(store.getState())).toEqual([]);
  });

  it('the featured match: flagged, else live, else today, else the first', () => {
    const store = createScorelineStore();
    expect(selectFeaturedMatchId(store.getState())).toBeUndefined();
    store.getState().actions.applyFeed(feed(), T0);
    expect(selectFeaturedMatchId(store.getState())).toBe(501);
    store.getState().actions.applyFeed(feed({}, { status: 'scheduled' }), T0 + 15_000);
    // nothing live: today's match
    expect(selectFeaturedMatchId(store.getState())).toBe(501);
  });

  it('a match the team plays in, for a player opened cold', () => {
    const store = createScorelineStore();
    store.getState().actions.applyFeed(feed(), T0);
    const s = store.getState();
    expect(selectMatchIdOfTeam('che')(s)).toBe(501);
    expect(selectMatchIdOfTeam('mci')(s)).toBe(502);
    expect(selectMatchIdOfTeam('xyz')(s)).toBeUndefined();
    expect(selectMatchIdOfTeam('che')).toBe(selectMatchIdOfTeam('che'));
  });
});
