import { describe, expect, it } from 'vitest';
import { applyEvent, applyFeed, emptyState } from './apply';
import { parseEvent, parseFeed } from './schemas';
import type { DomainState, Moment } from './types';

const T0 = 1_760_000_000_000;

interface MatchOpts {
  seq?: number;
  score?: [number, number];
  status?: string;
  minute?: number;
  events?: Record<string, unknown>[];
}

function feed(...matches: MatchOpts[]) {
  return parseFeed({
    version: 2,
    teams: [
      { id: 'ars', name: 'Arsenal', colors: ['#EF0107', '#FFFFFF'] },
      { id: 'che', name: 'Chelsea', colors: ['#034694', '#FFFFFF'] },
    ],
    leagues: [{ id: 'epl', name: 'Premier League' }],
    matches: matches.map((m) => ({
      id: 501,
      league: 'epl',
      home: 'ars',
      away: 'che',
      status: m.status ?? 'live',
      minute: m.minute ?? 60,
      seq: m.seq ?? 0,
      score: m.score ?? [0, 0],
      events: m.events ?? [],
    })),
  });
}

function event(e: Record<string, unknown>) {
  const ev = parseEvent({ match: 501, ...e });
  if (!ev) throw new Error('bad event');
  return ev;
}

/** A state that has seen one feed (so the next ones can play moments). */
function loaded(m: MatchOpts = {}): DomainState {
  return applyFeed(emptyState(), feed(m), T0).state;
}

const kinds = (ms: readonly Moment[]) => ms.map((m) => `${m.kind}:${m.side ?? ''}`);
const goal1 = { id: 'g1', seq: 5, kind: 'goal', side: 'home', minute: 61, player: 7, score: [1, 0] };

describe('applyFeed', () => {
  it('sets the stage quietly on the first feed', () => {
    const r = applyFeed(emptyState(), feed({ seq: 5, score: [2, 1], events: [goal1] }), T0);
    expect(r.moments).toEqual([]);
    expect(r.state.loaded).toBe(true);
    expect(r.state.matches[501]?.score).toEqual([2, 1]);
  });

  it('keeps object identity when a poll changes nothing', () => {
    const s1 = applyFeed(emptyState(), feed({ seq: 5, score: [1, 0], events: [goal1] }), T0).state;
    const r = applyFeed(s1, feed({ seq: 5, score: [1, 0], events: [goal1] }), T0 + 15_000);
    expect(r.moments).toEqual([]);
    expect(r.state).toBe(s1);
    expect(r.state.matches[501]).toBe(s1.matches[501]);
  });

  it('keeps the identity of what did not change when something else did', () => {
    const s1 = applyFeed(emptyState(), feed({ seq: 5, score: [1, 0], events: [goal1] }), T0).state;
    const s2 = applyFeed(s1, feed({ seq: 6, score: [1, 0], events: [goal1, { id: 'c1', seq: 6, kind: 'corner', side: 'away' }] }), T0).state;
    expect(s2).not.toBe(s1);
    expect(s2.matches[501]).not.toBe(s1.matches[501]);
    expect(s2.teams).toBe(s1.teams);
    expect(s2.matches[501]?.events[0]).toBe(s1.matches[501]?.events[0]);
    expect(s2.matches[501]?.clock).toBe(s1.matches[501]?.clock);
  });

  it('plays each goal when one poll reveals two', () => {
    const s = loaded({ seq: 4 });
    const r = applyFeed(
      s,
      feed({
        seq: 7,
        score: [1, 1],
        events: [goal1, { id: 'g2', seq: 7, kind: 'goal', side: 'away', minute: 63, score: [1, 1] }],
      }),
      T0,
    );
    expect(kinds(r.moments)).toEqual(['goal:home', 'goal:away']);
    expect(r.moments.map((m) => m.event?.id)).toEqual(['g1', 'g2']);
  });

  it('plays two goals by the same side in one poll, even with only one event', () => {
    const s = loaded({ seq: 4 });
    const r = applyFeed(s, feed({ seq: 7, score: [2, 0], events: [{ ...goal1, id: 'g2', seq: 7, score: [2, 0] }] }), T0);
    expect(kinds(r.moments)).toEqual(['goal:home', 'goal:home']);
    // The event belongs to the goal that made it 2; the first is known only from the score.
    expect(r.moments.map((m) => m.event?.id)).toEqual([undefined, 'g2']);
  });

  it('plays a score-diff goal once when its event arrives late', () => {
    const s = loaded({ seq: 4 });
    const a = applyFeed(s, feed({ seq: 5, score: [1, 0] }), T0);
    expect(kinds(a.moments)).toEqual(['goal:home']);
    expect(a.moments[0]?.event).toBeUndefined();

    const b = applyEvent(a.state, event(goal1), T0 + 2000);
    expect(b.moments).toEqual([]);
    expect(b.state.matches[501]?.score).toEqual([1, 0]);

    // The goal's event, sent again inside the next snapshot, doesn't play either.
    const c = applyFeed(b.state, feed({ seq: 5, score: [1, 0], events: [goal1] }), T0 + 15_000);
    expect(c.moments).toEqual([]);
    expect(c.state.matches[501]?.events.map((e) => e.id)).toEqual(['g1']);
  });

  it('ignores a stale snapshot that arrives after a live event', () => {
    const s = loaded({ seq: 4 });
    const a = applyEvent(s, event(goal1), T0 + 1000);
    expect(kinds(a.moments)).toEqual(['goal:home']);

    // A cached feed from before the goal.
    const b = applyFeed(a.state, feed({ seq: 4, score: [0, 0], minute: 59 }), T0 + 2000);
    expect(b.moments).toEqual([]);
    expect(b.state.matches[501]?.score).toEqual([1, 0]);
    expect(b.state.matches[501]?.seq).toBe(5);
    expect(b.state.matches[501]).toBe(a.state.matches[501]);

    // The next fresh feed has the goal: no second celebration (the legacy luau:7944 bug).
    const c = applyFeed(b.state, feed({ seq: 5, score: [1, 0], events: [goal1] }), T0 + 15_000);
    expect(c.moments).toEqual([]);
    expect(c.state.matches[501]?.score).toEqual([1, 0]);
  });

  it('learns unseen events from a stale snapshot without moving the score', () => {
    const s = loaded({ seq: 4 });
    const a = applyEvent(s, event({ ...goal1, seq: 6, score: [1, 0] }), T0);
    const b = applyFeed(a.state, feed({ seq: 5, score: [0, 0], events: [{ id: 'y1', seq: 5, kind: 'yellow', side: 'away' }] }), T0);
    expect(b.moments).toEqual([]);
    expect(b.state.matches[501]?.score).toEqual([1, 0]);
    expect(b.state.matches[501]?.events.map((e) => e.id)).toEqual(['y1', 'g1']);
  });

  it('plays kick-off and full time from status changes', () => {
    const s = loaded({ seq: 0, status: 'scheduled', minute: 0 });
    const a = applyFeed(s, feed({ seq: 1, status: 'live', minute: 1 }), T0);
    expect(kinds(a.moments)).toEqual(['kickoff:']);
    const b = applyFeed(a.state, feed({ seq: 2, status: 'finished', minute: 90 }), T0);
    expect(kinds(b.moments)).toEqual(['fulltime:']);
  });

  it('plays a red card found in a new feed once', () => {
    const s = loaded({ seq: 4 });
    const red = { id: 'r1', seq: 5, kind: 'red', side: 'away', minute: 70, player: 4 };
    const a = applyFeed(s, feed({ seq: 5, events: [red] }), T0);
    expect(kinds(a.moments)).toEqual(['red:away']);
    const b = applyFeed(a.state, feed({ seq: 5, events: [red] }), T0);
    expect(b.moments).toEqual([]);
  });

  it('does not celebrate a match the first time it appears', () => {
    const s = loaded({ seq: 4 });
    const f = parseFeed({
      teams: [
        { id: 'ars', name: 'Arsenal' },
        { id: 'che', name: 'Chelsea' },
      ],
      matches: [
        { id: 501, home: 'ars', away: 'che', status: 'live', seq: 4, score: [0, 0] },
        { id: 502, home: 'che', away: 'ars', status: 'live', seq: 3, score: [2, 0] },
      ],
    });
    expect(applyFeed(s, f, T0).moments).toEqual([]);
  });
});

describe('applyEvent', () => {
  it('plays a live goal and takes the score it carries', () => {
    const r = applyEvent(loaded({ seq: 4 }), event(goal1), T0);
    expect(kinds(r.moments)).toEqual(['goal:home']);
    expect(r.moments[0]?.event?.player).toBe(7);
    expect(r.state.matches[501]?.score).toEqual([1, 0]);
    expect(r.state.matches[501]?.seq).toBe(5);
  });

  it('ignores a duplicate event', () => {
    const a = applyEvent(loaded({ seq: 4 }), event(goal1), T0);
    const b = applyEvent(a.state, event(goal1), T0 + 500);
    expect(b.moments).toEqual([]);
    expect(b.state).toBe(a.state);
    expect(b.state.matches[501]?.events).toHaveLength(1);
  });

  it('holds an event that arrives before its snapshot, then applies it', () => {
    // Boot: the stream connects before /feed returns.
    const a = applyEvent(emptyState(), event(goal1), T0);
    expect(a.moments).toEqual([]);
    expect(a.state.pending[501]).toHaveLength(1);

    // The snapshot is older than the event: the event still lands, quietly (first feed).
    const b = applyFeed(a.state, feed({ seq: 4, score: [0, 0] }), T0 + 1000);
    expect(b.moments).toEqual([]);
    expect(b.state.pending[501]).toBeUndefined();
    expect(b.state.matches[501]?.score).toEqual([1, 0]);
    expect(b.state.matches[501]?.events.map((e) => e.id)).toEqual(['g1']);
  });

  it('drops a held event that its snapshot already covers', () => {
    const a = applyEvent(emptyState(), event(goal1), T0);
    const b = applyFeed(a.state, feed({ seq: 5, score: [1, 0], events: [goal1] }), T0);
    expect(b.state.matches[501]?.events).toHaveLength(1);
    expect(b.state.matches[501]?.score).toEqual([1, 0]);
  });

  it('plays a held event once the app is running', () => {
    // A match that joins mid-session, its first event racing its first snapshot.
    const s = loaded({ seq: 4 });
    const a = applyEvent(s, event({ ...goal1, match: 777 }), T0);
    expect(a.state.pending[777]).toHaveLength(1);
    const f = parseFeed({
      teams: [
        { id: 'ars', name: 'Arsenal' },
        { id: 'che', name: 'Chelsea' },
      ],
      matches: [
        { id: 501, home: 'ars', away: 'che', status: 'live', seq: 4 },
        { id: 777, home: 'che', away: 'ars', status: 'live', seq: 4, score: [0, 0] },
      ],
    });
    const b = applyFeed(a.state, f, T0);
    expect(kinds(b.moments)).toEqual(['goal:home']);
    expect(b.state.matches[777]?.score).toEqual([1, 0]);
  });

  it('stores an older event quietly without touching the score', () => {
    const s = loaded({ seq: 9, score: [1, 0] });
    const r = applyEvent(s, event({ ...goal1, seq: 3 }), T0);
    expect(r.moments).toEqual([]);
    expect(r.state.matches[501]?.score).toEqual([1, 0]);
    expect(r.state.matches[501]?.seq).toBe(9);
    expect(r.state.matches[501]?.events.map((e) => e.id)).toEqual(['g1']);
  });

  it('takes a goal back on a VAR cancel, and plays the next goal again', () => {
    const a = applyEvent(loaded({ seq: 4 }), event(goal1), T0);
    const b = applyEvent(a.state, event({ id: 'v1', seq: 6, kind: 'goalCancelled', side: 'home', ref: 'g1', score: [0, 0] }), T0 + 60_000);
    expect(kinds(b.moments)).toEqual(['goalCancelled:home']);
    const m = b.state.matches[501];
    expect(m?.score).toEqual([0, 0]);
    expect(m?.events.find((e) => e.id === 'g1')?.cancelled).toBe(true);

    // A stale snapshot from before the cancel can't put the goal back.
    const c = applyFeed(b.state, feed({ seq: 5, score: [1, 0], events: [goal1] }), T0 + 61_000);
    expect(c.moments).toEqual([]);
    expect(c.state.matches[501]?.score).toEqual([0, 0]);

    // A new goal for 1–0 plays, though the score reads as it did before.
    const d = applyEvent(c.state, event({ ...goal1, id: 'g3', seq: 7, minute: 70 }), T0 + 120_000);
    expect(kinds(d.moments)).toEqual(['goal:home']);
    expect(d.state.matches[501]?.score).toEqual([1, 0]);
  });

  it('plays a cancel seen only as the score going down in a feed', () => {
    const a = applyFeed(loaded({ seq: 4 }), feed({ seq: 5, score: [1, 0], events: [goal1] }), T0);
    const b = applyFeed(a.state, feed({ seq: 6, score: [0, 0], events: [goal1] }), T0);
    expect(kinds(b.moments)).toEqual(['goalCancelled:home']);
    expect(b.moments[0]?.event).toBeUndefined();
    expect(b.state.matches[501]?.score).toEqual([0, 0]);
  });

  it('plays nothing for a goal and its cancel inside one poll', () => {
    const r = applyFeed(
      loaded({ seq: 4 }),
      feed({ seq: 6, score: [0, 0], events: [goal1, { id: 'v1', seq: 6, kind: 'goalCancelled', side: 'home', ref: 'g1', score: [0, 0] }] }),
      T0,
    );
    expect(r.moments).toEqual([]);
    expect(r.state.matches[501]?.events.find((e) => e.id === 'g1')?.cancelled).toBe(true);
  });

  it('runs kick-off and full time once each', () => {
    const s = loaded({ seq: 0, status: 'scheduled', minute: 0 });
    const a = applyEvent(s, event({ kind: 'kickoff', seq: 1 }), T0);
    expect(kinds(a.moments)).toEqual(['kickoff:']);
    expect(a.state.matches[501]?.status).toBe('live');
    expect(applyEvent(a.state, event({ kind: 'kickoff', seq: 2 }), T0).moments).toEqual([]);

    const b = applyEvent(a.state, event({ kind: 'fulltime', seq: 3 }), T0 + 95 * 60_000);
    expect(kinds(b.moments)).toEqual(['fulltime:']);
    expect(b.state.matches[501]?.status).toBe('finished');
    expect(b.state.matches[501]?.clock.minute).toBe(95);
    expect(applyFeed(b.state, feed({ seq: 3, status: 'finished', minute: 95 }), T0).moments).toEqual([]);
  });

  it('syncs the clock from a minute event', () => {
    const a = applyEvent(loaded({ seq: 4 }), event({ kind: 'minute', minute: 70, second: 12 }), T0);
    expect(a.state.matches[501]?.clock).toEqual({ minute: 70, second: 12, at: T0 });
    expect(a.moments).toEqual([]);
  });
});
