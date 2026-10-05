import { afterEach, describe, expect, it } from 'vitest';
import { parseEvent, parseFeed, type Moment } from '../../domain';
import { demoFeedJson } from '../../domain/testing/demo';
import { createScorelineStore } from '../../store';
import { resetMotion, tuneMotion } from '../tokens';
import { sceneBeats, sceneCloseAfter, toastCloseAfter } from './beats';
import { createMomentDirector, MAX_QUEUED, type DirectorOptions, type MomentView } from './director';

afterEach(resetMotion);

/** A store on the demo evening, a director over it, and a hand-driven clock, timers and tab. */
function setup(view: MomentView = { front: false }, extra: Partial<DirectorOptions> = {}) {
  let t = 100;
  type Timer = { at: number; fn: () => void };
  let timers: Timer[] = [];
  let hidden = false;
  const vis = new Set<() => void>();
  const store = createScorelineStore();
  store.getState().actions.applyFeed(parseFeed(demoFeedJson()), Date.now());
  const d = createMomentDirector(store, {
    clock: { now: () => t },
    timers: {
      set(fn, ms) {
        const h = { at: t + ms / 1000, fn };
        timers.push(h);
        return h;
      },
      clear(h) {
        timers = timers.filter((x) => x !== h);
      },
    },
    visibility: {
      hidden: () => hidden,
      subscribe(l) {
        vis.add(l);
        return () => vis.delete(l);
      },
    },
    reducedMotion: () => false,
    ...extra,
  });
  d.setView(view);
  d.start();
  let seq = 100;
  const api = {
    store,
    d,
    snap: () => d.getSnapshot(),
    now: () => t,
    timerCount: () => timers.length,
    /** runs every timer due in the next `s` seconds, in order */
    advance(s: number) {
      const end = t + s;
      for (;;) {
        timers.sort((a, b) => a.at - b.at);
        const next = timers[0];
        if (!next || next.at > end) break;
        timers.shift();
        t = next.at;
        next.fn();
      }
      t = end;
    },
    hide(h: boolean) {
      hidden = h;
      vis.forEach((l) => l());
    },
    event(raw: Record<string, unknown>) {
      const e = parseEvent({ seq: ++seq, minute: 60, ...raw });
      if (!e) throw new Error('bad event');
      store.getState().actions.applyEvent(e, Date.now());
    },
    goal(match: number, id: string, side: 'home' | 'away' = 'home') {
      const m = store.getState().domain.matches[match]!;
      const score = side === 'home' ? [m.score[0] + 1, m.score[1]] : [m.score[0], m.score[1] + 1];
      api.event({ match, id, kind: 'goal', side, player: 9, score });
    },
    restart() {
      store.getState().actions.resetFeed(parseFeed(demoFeedJson()), Date.now());
    },
  };
  return api;
}

const ids = (ms: readonly Moment[]) => ms.map((m) => m.matchId);

describe('MomentDirector', () => {
  it('takes the store queue and delivers each moment once', () => {
    const s = setup();
    s.goal(2, 'g1');
    expect(s.store.getState().moments).toEqual([]);
    expect(s.d.delivered.getState().moments.map((m) => m.id)).toEqual(['2:goal:g1']);
    // the same moment queued again (a replayed stream) is not delivered or shown twice
    const again = s.d.delivered.getState().moments[0]!;
    s.store.setState({ moments: [again] });
    expect(s.d.delivered.getState().moments).toHaveLength(1);
    expect(s.snap().queue).toEqual([]);
  });

  it('four goals in one poll: the open match plays a scene, the other three fold into one summary', () => {
    const s = setup({ openId: 3, front: true });
    const feed = demoFeedJson() as { matches: { id: number; seq: number; score: number[] }[] };
    for (const m of feed.matches) {
      if (m.id >= 2 && m.id <= 5) {
        m.seq = 2;
        m.score = [m.score[0]! + 1, m.score[1]!];
      }
    }
    s.store.getState().actions.applyFeed(parseFeed(feed), Date.now());

    const snap = s.snap();
    expect(snap.stage).toMatchObject({ kind: 'scene', variant: 'goal' });
    expect(snap.stage!.moment.matchId).toBe(3);
    expect(snap.queue).toHaveLength(1);
    expect(snap.queue[0]).toMatchObject({ type: 'summary', reason: 'overflow' });
    expect(snap.queue[0]!.type === 'summary' && ids(snap.queue[0]!.moments)).toEqual([2, 4, 5]);
    // every goal was delivered at once: marks for all four cards, the latest has focus, one announcement
    expect([...snap.goals.keys()].sort()).toEqual([2, 3, 4, 5]);
    expect(snap.focus).toBe(5);
    expect(snap.announcement!.text.match(/Goal for/g)).toHaveLength(4);
    expect(snap.hero).toMatchObject({ matchId: 3, kind: 'goal', side: 'home' });

    // the scene closes after goalHold and leaves over 0.45 s, then the summary takes the stage
    s.advance(sceneCloseAfter('goal') - 0.01);
    expect(s.snap().stage!.phase).toBe('in');
    s.advance(0.02);
    expect(s.snap().stage!.phase).toBe('out');
    s.advance(0.45);
    expect(s.snap().stage).toMatchObject({ kind: 'summary', reason: 'overflow' });
    expect(ids(s.snap().stage!.moments)).toEqual([2, 4, 5]);
    s.advance(toastCloseAfter() + 0.4 + 0.01);
    expect(s.snap().stage).toBeNull();
    expect(s.timerCount()).toBe(0);
  });

  it('four goals in one poll with no match in front: one toast, then a summary of the rest', () => {
    const s = setup();
    const feed = demoFeedJson() as { matches: { id: number; seq: number; score: number[] }[] };
    for (const m of feed.matches) if (m.id >= 2 && m.id <= 5) Object.assign(m, { seq: 2, score: [m.score[0]! + 1, m.score[1]!] });
    s.store.getState().actions.applyFeed(parseFeed(feed), Date.now());
    expect(s.snap().stage).toMatchObject({ kind: 'toast', variant: 'goal' });
    expect(s.snap().stage!.moment.matchId).toBe(2);
    expect(s.snap().queue).toEqual([{ type: 'summary', reason: 'overflow', moments: expect.any(Array) }]);
  });

  it('a goal while a scene plays waits its turn; a scene for the open match plays again after', () => {
    const s = setup({ openId: 1, front: true });
    s.goal(1, 'a');
    const first = s.snap().stage!;
    expect(first).toMatchObject({ kind: 'scene', variant: 'goal' });
    s.advance(2);
    s.goal(1, 'b', 'away');
    s.goal(2, 'c');
    expect(s.snap().stage!.key).toBe(first.key);
    expect(s.snap().queue.map((q) => q.type === 'moment' && q.moment.id)).toEqual(['1:goal:b', '2:goal:c']);
    // the hero follows the open match's latest goal
    expect(s.snap().hero).toMatchObject({ matchId: 1, side: 'away' });

    s.advance(sceneCloseAfter('goal') - 2 + 0.45 + 0.01);
    expect(s.snap().stage).toMatchObject({ kind: 'scene' });
    expect(s.snap().stage!.moment.id).toBe('1:goal:b');
    s.advance(sceneCloseAfter('goal') + 0.45 + 0.01);
    expect(s.snap().stage).toMatchObject({ kind: 'toast' });
    expect(s.snap().stage!.moment.id).toBe('2:goal:c');
  });

  it('the followed player’s match gets a scene; a red card in front gets the red scene', () => {
    const s = setup({ openId: 1, front: true, followedMatchId: 4 });
    s.goal(4, 'f');
    expect(s.snap().stage).toMatchObject({ kind: 'scene', variant: 'goal' });
    s.d.dismiss();
    s.advance(0.5);
    s.event({ match: 1, id: 'r', kind: 'red', side: 'home', player: 4 });
    expect(s.snap().stage).toMatchObject({ kind: 'scene', variant: 'red' });
    expect(s.snap().stage!.beats).toEqual(sceneBeats('red'));
  });

  it('a covered match (a player over it) or reduced motion gets a toast, not a scene', () => {
    const s = setup({ openId: 1, front: false });
    s.goal(1, 'a');
    expect(s.snap().stage).toMatchObject({ kind: 'toast' });
    const r = setup({ openId: 1, front: true }, { reducedMotion: () => true });
    r.goal(1, 'a');
    expect(r.snap().stage).toMatchObject({ kind: 'toast' });
  });

  it('a scene takes over from a toast at once (openScene clears the toast)', () => {
    const s = setup({ openId: 1, front: true });
    s.goal(2, 'x');
    expect(s.snap().stage).toMatchObject({ kind: 'toast' });
    s.goal(1, 'y');
    expect(s.snap().stage).toMatchObject({ kind: 'scene' });
    expect(s.snap().queue).toEqual([]);
    expect(s.timerCount()).toBe(1);
  });

  it('collapses an overflowing queue to at most two waiting', () => {
    const s = setup();
    s.goal(2, 'a');
    s.goal(3, 'b');
    s.goal(4, 'c');
    expect(s.snap().queue).toHaveLength(2);
    s.goal(5, 'd');
    expect(s.snap().queue).toEqual([{ type: 'summary', reason: 'overflow', moments: expect.any(Array) }]);
    s.goal(1, 'e');
    s.event({ match: 3, id: 'r', kind: 'red', side: 'away', player: 5 });
    const q = s.snap().queue;
    expect(q.length).toBeLessThanOrEqual(MAX_QUEUED);
    expect(q[0]!.type === 'summary' && q[0]!.moments.map((m) => m.id)).toEqual(['3:goal:b', '4:goal:c', '5:goal:d', '1:goal:e', '3:red:r']);
    expect(s.snap().stage!.moment.id).toBe('2:goal:a');
  });

  it('holds moments while the tab is hidden and delivers one on return', () => {
    const s = setup();
    s.hide(true);
    s.advance(30);
    s.goal(2, 'h');
    let snap = s.snap();
    expect(snap).toMatchObject({ hidden: true, held: 1, stage: null, announcement: null });
    expect(snap.goals.size).toBe(0);
    expect(s.d.delivered.getState().moments).toEqual([]);
    expect(s.store.getState().moments).toEqual([]);

    s.advance(10);
    s.hide(false);
    snap = s.snap();
    expect(snap).toMatchObject({ hidden: false, held: 0 });
    expect(snap.stage).toMatchObject({ kind: 'toast', variant: 'goal' });
    // the mark starts on return, so a goal you missed is still there to see
    expect(snap.goals.get(2)!.t).toBe(s.now());
    expect(snap.announcement!.text).toMatch(/^Goal for/);
    expect(s.d.delivered.getState().moments.map((m) => m.id)).toEqual(['2:goal:h']);
  });

  it('several moments while hidden become one summary on return, in place of what was waiting', () => {
    const s = setup({ openId: 1, front: true });
    s.goal(2, 'w1');
    s.goal(3, 'w2');
    s.hide(true);
    s.goal(1, 'h1');
    s.event({ match: 4, id: 'h2', kind: 'red', side: 'home', player: 3 });
    s.event({ match: 4, kind: 'fulltime' });
    // the stage finishes while hidden but nothing new starts
    s.advance(toastCloseAfter() + 1);
    expect(s.snap().stage).toBeNull();
    expect(s.snap().held).toBe(3);
    s.hide(false);
    const snap = s.snap();
    expect(snap.stage).toMatchObject({ kind: 'summary', reason: 'away' });
    expect(snap.stage!.moments.map((m) => m.id)).toEqual(['3:goal:w2', '1:goal:h1', '4:red:h2']);
    expect(snap.queue).toEqual([]);
    expect(snap.announcement!.text).toMatch(/^While you were away: 1 goal and 1 red card\./);
  });

  it('a restart during a scene cancels it, its timers, the queue, the cues and the dedupe memory', () => {
    const s = setup({ openId: 1, front: true });
    s.goal(1, 'same');
    s.goal(2, 'q1');
    s.hide(true);
    s.goal(3, 'held');
    s.hide(false);
    s.goal(4, 'q2');
    expect(s.snap().stage).not.toBeNull();
    const logSession = s.d.delivered.getState().session;

    s.restart();
    const snap = s.snap();
    expect(snap).toMatchObject({ session: 1, stage: null, queue: [], held: 0, hero: null, announcement: null });
    expect(snap.goals.size).toBe(0);
    expect(s.timerCount()).toBe(0);
    expect(s.d.delivered.getState()).toEqual({ moments: [], session: logSession + 1 });
    // nothing from the old evening comes back on its old timers
    s.advance(60);
    expect(s.snap().stage).toBeNull();

    // the same event id plays again in the new evening
    s.goal(1, 'same');
    expect(s.snap().stage).toMatchObject({ kind: 'scene' });
    expect(s.snap().stage!.moment.id).toBe('1:goal:same');
    expect(s.snap().stage!.key.startsWith('1:')).toBe(true);
    expect(s.d.delivered.getState().moments.map((m) => m.id)).toEqual(['1:goal:same']);
  });

  it('a first tap on a scene shows everything, the next closes it', () => {
    const s = setup({ openId: 1, front: true });
    s.goal(1, 'a');
    const p = s.snap().stage!;
    s.advance(0.5);
    s.d.tap(p.key);
    const full = sceneBeats('goal').full;
    expect(s.snap().stage!.startedAt).toBeCloseTo(s.now() - full);
    s.d.tap(p.key);
    expect(s.snap().stage!.phase).toBe('out');
    s.advance(0.46);
    expect(s.snap().stage).toBeNull();
  });

  it('a held toast stays until let go, then leaves if its time is up', () => {
    const s = setup();
    s.goal(2, 'a');
    s.d.hold(true);
    s.advance(toastCloseAfter() + 3);
    expect(s.snap().stage).toMatchObject({ phase: 'in', held: true });
    s.d.hold(false);
    expect(s.snap().stage!.phase).toBe('out');
  });

  it('a disallowed goal takes back its goal if it is still waiting, and is shown itself', () => {
    const s = setup();
    s.goal(2, 'first');
    s.goal(3, 'var');
    s.event({ match: 3, id: 'c', kind: 'goalCancelled', side: 'home', ref: 'var', score: [1, 1] });
    expect(s.snap().queue.map((q) => q.type === 'moment' && q.moment.kind)).toEqual(['goalCancelled']);
    expect(s.snap().goals.has(3)).toBe(false);
    expect(s.snap().announcement!.text).toMatch(/disallowed/);
  });

  it('reads the hold tokens when a presentation starts', () => {
    tuneMotion({ goalHold: 20 });
    const s = setup({ openId: 1, front: true });
    s.goal(1, 'a');
    expect(s.snap().stage!.closeAfter).toBe(20);
  });

  it('stop clears the stage and every timer; start drops moments queued meanwhile', () => {
    const s = setup();
    s.goal(2, 'a');
    s.d.stop();
    expect(s.snap().stage).toBeNull();
    expect(s.timerCount()).toBe(0);
    s.goal(3, 'b');
    s.d.start();
    expect(s.store.getState().moments).toEqual([]);
    expect(s.snap().stage).toBeNull();
  });
});
