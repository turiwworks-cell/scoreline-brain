// The MomentDirector (ARCHITECTURE §4 diagram, §7 "several moments at once"). The one consumer of
// the store's moment queue: it takes moments as they arrive and decides what each becomes.
//
// - Delivery. Every new moment is delivered once: recorded as a goal cue (goal-mark, goal-focus,
//   card-flood), as the hero's cue when its match is open, announced through aria-live, and
//   appended to the `delivered` log that the list's goal feed and the followed player's card read.
// - Presentation (celebrate / showRed, luau:7358-7429). Goals and red cards go on one stage, one
//   at a time: a scene when the match is in front (open, nothing over it) or is the followed
//   player's, a toast for every other match. A scene takes over from a toast (openScene clears
//   the toast, luau:7313). What arrives while the stage is busy waits in a queue; more than two
//   waiting fold into one summary. Kick-off and full time are announced only (endMatch,
//   luau:7443, has no scene).
// - Hidden tab. Moments are held, not delivered: nothing plays, marks don't start, nothing is
//   announced. On return they are delivered together and, when there are two or more to show,
//   one summary takes the stage in place of the waiting queue.
// - Restart. A new store `session` (an explicit demo restart) cancels the stage and every timer,
//   empties the queue, the held moments, the cues and the dedupe memory, and starts the delivered
//   log over: the same event id may legitimately play again in the new evening. Ordinary taking
//   keeps the dedupe memory.
//
// Timings follow advance (luau:8608-8622): a toast leaves after its entrance + toastHold over
// 0.4 s; a scene closes after max(goalHold, its landed beat) over 0.45 s. See ./beats.

import type { DomainState, Moment, Side } from '../../domain';
import { batchText, summaryText } from './announce';
import { SCENE_OUT, sceneBeats, sceneCloseAfter, TOAST_OUT, toastCloseAfter, type SceneBeats, type SceneKind } from './beats';

// ── Contract ─────────────────────────────────────────────────────────────────

/** Seconds on a steady scale (the list's clock: performance.now() / 1000). */
export interface DirectorClock {
  now(): number;
}

export interface DirectorTimers {
  set(fn: () => void, ms: number): unknown;
  clear(handle: unknown): void;
}

export interface Visibility {
  hidden(): boolean;
  subscribe(listener: () => void): () => void;
}

/** What is on screen, from the route (the app's Shell sets it). */
export interface MomentView {
  /** the match whose screen is up (phone layer, desktop pane) */
  readonly openId?: number;
  /** nothing covers that match's screen (no player layer or sheet over it) */
  readonly front: boolean;
  /** the followed player's match */
  readonly followedMatchId?: number;
}

/** The store as the director needs it. `scorelineStore` fits. */
export interface MomentStore {
  getState(): {
    readonly moments: readonly Moment[];
    readonly session: number;
    readonly domain: Pick<DomainState, 'teams' | 'players' | 'matches'>;
    readonly actions: { takeMoments(): readonly Moment[] };
  };
  subscribe(listener: (state: ReturnType<MomentStore['getState']>, prev: ReturnType<MomentStore['getState']>) => void): () => void;
}

/** A fresh goal: when it was delivered (director clock) and for whom. Same shape as the list's GoalMark. */
export interface GoalCue {
  readonly t: number;
  readonly side: Side;
  /** counts every goal delivered, so a second goal in a match restarts its choreography */
  readonly n: number;
}

/** The open match's latest goal or red card, for the hero's bump (heroBumpT, luau:7375). */
export interface HeroCue {
  readonly matchId: number;
  readonly kind: 'goal' | 'red';
  readonly side: Side;
  readonly t: number;
  readonly n: number;
}

export type StageKind = 'scene' | 'toast' | 'summary';

/**
 * One thing on the stage. Part 18 renders it, keyed by `key`, and calls back `tap`, `dismiss`
 * and `hold`. `kind`:
 * - `scene`: a goal or red card in the match in front; `variant` says which (`SceneKind`).
 * - `toast`: one moment from another match (a goal, red card, or disallowed goal).
 * - `summary`: several moments at once; `reason` says whether the queue overflowed or the tab was
 *   hidden. `moments` lists them, oldest first.
 */
export interface Presentation {
  readonly key: string;
  readonly kind: StageKind;
  readonly variant: 'goal' | 'red' | 'goalCancelled' | 'summary';
  /** the moment it is about (for a summary, the latest) */
  readonly moment: Moment;
  readonly moments: readonly Moment[];
  readonly reason?: 'overflow' | 'away';
  /** a scene's beats, as the tokens stood when it started */
  readonly beats?: SceneBeats;
  /** director clock seconds. A first tap on a scene moves this back so everything shows at once. */
  readonly startedAt: number;
  /** seconds after startedAt that it leaves on its own */
  readonly closeAfter: number;
  readonly phase: 'in' | 'out';
  /** director clock seconds at which it started leaving */
  readonly outAt?: number;
  /** a finger is on the toast: it doesn't leave on its own */
  readonly held: boolean;
}

/** Waiting for the stage. */
export type Pending = { readonly type: 'moment'; readonly moment: Moment } | { readonly type: 'summary'; readonly moments: readonly Moment[]; readonly reason: 'overflow' | 'away' };

export interface Announcement {
  /** bumps for every announcement, so the same words twice still read twice */
  readonly n: number;
  readonly text: string;
}

export interface DirectorSnapshot {
  /** the store session this belongs to */
  readonly session: number;
  readonly stage: Presentation | null;
  readonly queue: readonly Pending[];
  readonly hidden: boolean;
  /** moments held while the tab is hidden */
  readonly held: number;
  /** every match's latest goal (goal-mark and card-flood read this) */
  readonly goals: ReadonlyMap<number, GoalCue>;
  /** the match whose goal landed last: while it is fresh the other cards go grey (goal-focus) */
  readonly focus?: number;
  readonly hero: HeroCue | null;
  readonly announcement: Announcement | null;
}

/** A store-shaped log of delivered moments, for the list's goal feed and the follow card. */
export interface DeliveredLog {
  getState(): { readonly moments: readonly Moment[]; readonly session: number };
  subscribe(listener: (state: { readonly moments: readonly Moment[]; readonly session: number }, prev: { readonly moments: readonly Moment[]; readonly session: number }) => void): () => void;
}

export interface MomentDirector {
  /** Starts taking the store's moments. Moments already queued are old news and are dropped. */
  start(): void;
  /** Stops taking moments and clears the stage, the queue and every timer. */
  stop(): void;
  readonly running: boolean;
  setView(view: MomentView): void;
  getSnapshot(): DirectorSnapshot;
  subscribe(listener: () => void): () => void;
  readonly delivered: DeliveredLog;
  /** A first tap on a scene shows everything at once; the next closes it (tapScene, luau:7322). */
  tap(key?: string): void;
  /** Starts the stage leaving now (a swipe, Escape, a close button). */
  dismiss(key?: string): void;
  /** A finger on the toast: it stays while held, then leaves if its time is up (luau:8603). */
  hold(on: boolean, key?: string): void;
  readonly clock: DirectorClock;
}

export interface DirectorOptions {
  clock?: DirectorClock;
  timers?: DirectorTimers;
  visibility?: Visibility;
  /** with reduced motion a would-be scene becomes a toast (ARCHITECTURE §5) */
  reducedMotion?: () => boolean;
}

/** More than this many waiting and the queue folds into one summary (ARCHITECTURE §7). */
export const MAX_QUEUED = 2;
/** Dedupe memory and held moments are bounded like the list's goal feed. */
const SEEN_CAP = 400;
const HELD_CAP = 100;
const LOG_CAP = 100;

// ── Defaults ─────────────────────────────────────────────────────────────────

export const steadyClock: DirectorClock = { now: () => (typeof performance === 'undefined' ? Date.now() : performance.now()) / 1000 };

const browserTimers: DirectorTimers = {
  set: (fn, ms) => setTimeout(fn, ms),
  clear: (h) => clearTimeout(h as ReturnType<typeof setTimeout>),
};

export const documentVisibility: Visibility = {
  hidden: () => typeof document !== 'undefined' && document.visibilityState === 'hidden',
  subscribe(l) {
    if (typeof document === 'undefined') return () => {};
    document.addEventListener('visibilitychange', l);
    return () => document.removeEventListener('visibilitychange', l);
  },
};

export const prefersReducedMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

const PRESENTED = new Set<Moment['kind']>(['goal', 'red', 'goalCancelled']);
const NO_GOALS: ReadonlyMap<number, GoalCue> = new Map();

// ── The director ─────────────────────────────────────────────────────────────

export function createMomentDirector(store: MomentStore, options: DirectorOptions = {}): MomentDirector {
  const clock = options.clock ?? steadyClock;
  const timers = options.timers ?? browserTimers;
  const visibility = options.visibility ?? documentVisibility;
  const reduced = options.reducedMotion ?? prefersReducedMotion;

  const listeners = new Set<() => void>();
  const logListeners = new Set<Parameters<DeliveredLog['subscribe']>[0]>();

  let running = false;
  let offStore: (() => void) | undefined;
  let offVisible: (() => void) | undefined;
  let view: MomentView = { front: false };
  let session = store.getState().session;
  let seen = new Set<string>();
  let held: Moment[] = [];
  let timer: unknown;
  let shown = 0;
  let goalN = 0;
  let heroN = 0;
  let sayN = 0;
  let log: { moments: readonly Moment[]; session: number } = { moments: [], session: 0 };

  let snap: DirectorSnapshot = { session, stage: null, queue: [], hidden: false, held: 0, goals: NO_GOALS, hero: null, announcement: null };

  const emit = () => {
    for (const l of [...listeners]) l();
  };
  const update = (patch: Partial<DirectorSnapshot>) => {
    snap = { ...snap, ...patch };
    emit();
  };
  const appendLog = (moments: readonly Moment[]) => {
    if (moments.length === 0) return;
    const prev = log;
    log = { moments: [...log.moments, ...moments].slice(-LOG_CAP), session: log.session };
    for (const l of [...logListeners]) l(log, prev);
  };
  const restartLog = () => {
    const prev = log;
    log = { moments: [], session: log.session + 1 };
    for (const l of [...logListeners]) l(log, prev);
  };

  const cancelTimer = () => {
    if (timer !== undefined) timers.clear(timer);
    timer = undefined;
  };
  const after = (seconds: number, fn: () => void) => {
    cancelTimer();
    timer = timers.set(
      () => {
        timer = undefined;
        fn();
      },
      Math.max(seconds, 0) * 1000,
    );
  };

  const remember = (id: string): boolean => {
    if (seen.has(id)) return false;
    seen.add(id);
    if (seen.size > SEEN_CAP) seen.delete(seen.values().next().value as string);
    return true;
  };

  const sceneWorthy = (m: Moment): boolean => {
    if (m.kind !== 'goal' && m.kind !== 'red') return false;
    if (reduced()) return false;
    return (view.front && view.openId === m.matchId) || view.followedMatchId === m.matchId;
  };

  // ── the stage ──

  const scheduleClose = (p: Presentation) => {
    if (p.held) return cancelTimer();
    after(p.startedAt + p.closeAfter - clock.now(), () => leave(p.key));
  };

  const begin = (item: Pending) => {
    const now = clock.now();
    const key = `${session}:${++shown}`;
    let p: Presentation;
    if (item.type === 'summary') {
      const moment = item.moments[item.moments.length - 1]!;
      p = { key, kind: 'summary', variant: 'summary', moment, moments: item.moments, reason: item.reason, startedAt: now, closeAfter: toastCloseAfter(), phase: 'in', held: false };
    } else if (sceneWorthy(item.moment)) {
      const kind = item.moment.kind as SceneKind;
      p = { key, kind: 'scene', variant: kind, moment: item.moment, moments: [item.moment], beats: sceneBeats(kind), startedAt: now, closeAfter: sceneCloseAfter(kind), phase: 'in', held: false };
    } else {
      const variant = item.moment.kind as 'goal' | 'red' | 'goalCancelled';
      p = { key, kind: 'toast', variant, moment: item.moment, moments: [item.moment], startedAt: now, closeAfter: toastCloseAfter(), phase: 'in', held: false };
    }
    return p;
  };

  /** Folds the queue when more than MAX_QUEUED wait: the first scene keeps its place, the rest become one summary. */
  const collapse = (queue: readonly Pending[]): readonly Pending[] => {
    if (queue.length <= MAX_QUEUED) return queue;
    const keep = queue.findIndex((q) => q.type === 'moment' && sceneWorthy(q.moment));
    const folded: Moment[] = [];
    let reason: 'overflow' | 'away' = 'overflow';
    queue.forEach((q, i) => {
      if (i === keep) return;
      if (q.type === 'summary') {
        folded.push(...q.moments);
        if (q.reason === 'away') reason = 'away';
      } else folded.push(q.moment);
    });
    const summary: Pending = { type: 'summary', moments: folded, reason };
    return keep >= 0 ? [queue[keep]!, summary] : [summary];
  };

  /** Puts the next waiting item on a free stage. */
  const pump = () => {
    if (snap.hidden || snap.stage) {
      const q = collapse(snap.queue);
      if (q !== snap.queue) update({ queue: q });
      return;
    }
    let queue = snap.queue;
    if (queue.length === 0) return;
    // a scene goes first; otherwise first come, first shown
    const i = Math.max(
      queue.findIndex((q) => q.type === 'moment' && sceneWorthy(q.moment)),
      0,
    );
    const item = queue[i]!;
    queue = collapse([...queue.slice(0, i), ...queue.slice(i + 1)]);
    const stage = begin(item);
    update({ stage, queue });
    scheduleClose(stage);
  };

  const leave = (key?: string) => {
    const p = snap.stage;
    if (!p || p.phase === 'out' || (key !== undefined && p.key !== key)) return;
    const out = { ...p, phase: 'out' as const, outAt: clock.now(), held: false };
    update({ stage: out });
    after(p.kind === 'scene' ? SCENE_OUT : TOAST_OUT, () => {
      if (snap.stage?.key !== out.key) return;
      update({ stage: null });
      pump();
    });
  };

  const clearStage = () => {
    cancelTimer();
    if (snap.stage) update({ stage: null });
  };

  // ── delivery ──

  /** Moments reach the app: cues, the log, the announcement, and the stage's queue. */
  const deliver = (moments: readonly Moment[], announce: string) => {
    if (moments.length === 0) return;
    const now = clock.now();
    let goals = snap.goals;
    let focus = snap.focus;
    let hero = snap.hero;
    for (const m of moments) {
      if (m.kind === 'goal' && m.side) {
        if (goals === snap.goals) goals = new Map(goals);
        (goals as Map<number, GoalCue>).set(m.matchId, { t: now, side: m.side, n: ++goalN });
        focus = m.matchId;
      } else if (m.kind === 'goalCancelled' && goals.has(m.matchId)) {
        if (goals === snap.goals) goals = new Map(goals);
        (goals as Map<number, GoalCue>).delete(m.matchId);
        if (focus === m.matchId) focus = latestOf(goals);
      }
      if ((m.kind === 'goal' || m.kind === 'red') && m.side && m.matchId === view.openId) {
        hero = { matchId: m.matchId, kind: m.kind, side: m.side, t: now, n: ++heroN };
      } else if (m.kind === 'goalCancelled' && hero?.matchId === m.matchId && hero.kind === 'goal') {
        hero = null;
      }
    }
    const announcement = announce ? { n: ++sayN, text: announce } : snap.announcement;
    update({ goals, focus, hero, announcement });
    appendLog(moments);
  };

  /** A disallowed goal takes back the goal it cancels if that one hasn't been shown yet. */
  const withdraw = (queue: readonly Pending[], m: Moment): readonly Pending[] => {
    const ref = m.event?.ref;
    if (m.kind !== 'goalCancelled' || !ref) return queue;
    const isIt = (x: Moment) => x.kind === 'goal' && x.matchId === m.matchId && x.event?.id === ref;
    if (snap.stage && snap.stage.kind !== 'summary' && isIt(snap.stage.moment)) leave(snap.stage.key);
    return queue.filter((q) => q.type !== 'moment' || !isIt(q.moment));
  };

  const enqueue = (moments: readonly Moment[]) => {
    let queue = snap.queue;
    for (const m of moments) {
      if (!PRESENTED.has(m.kind)) continue;
      queue = withdraw(queue, m);
      queue = [...queue, { type: 'moment', moment: m }];
    }
    if (queue === snap.queue) return;
    // a scene takes over from a toast (openScene clears the toast, luau:7313)
    const st = snap.stage;
    if (st && st.kind === 'toast' && st.phase === 'in' && queue.some((q) => q.type === 'moment' && sceneWorthy(q.moment))) {
      cancelTimer();
      snap = { ...snap, stage: null };
    }
    update({ queue });
    pump();
  };

  const take = (batch: readonly Moment[]) => {
    const fresh = batch.filter((m) => remember(m.id));
    if (fresh.length === 0) return;
    if (snap.hidden) {
      held = [...held, ...fresh].slice(-HELD_CAP);
      update({ held: held.length });
      return;
    }
    deliver(fresh, batchText(store.getState().domain, fresh));
    enqueue(fresh);
  };

  const returnFromHidden = () => {
    const back = held;
    held = [];
    snap = { ...snap, hidden: false, held: 0 };
    if (back.length === 0) {
      emit();
      pump();
      return;
    }
    const domain = store.getState().domain;
    const waiting = snap.queue.flatMap((q) => (q.type === 'summary' ? q.moments : [q.moment]));
    const toShow = [...waiting, ...back.filter((m) => PRESENTED.has(m.kind))];
    const presentedBack = back.filter((m) => PRESENTED.has(m.kind));
    deliver(back, presentedBack.length > 1 ? summaryText(domain, presentedBack) : batchText(domain, back));
    if (toShow.length > 1) {
      // what happened while away replaces whatever was waiting or still on the stage
      clearStage();
      update({ queue: [{ type: 'summary', moments: toShow, reason: 'away' }] });
      pump();
    } else {
      update({ queue: [] });
      enqueue(toShow);
      pump();
    }
  };

  const onVisibility = () => {
    const hidden = visibility.hidden();
    if (hidden === snap.hidden) return;
    if (hidden) update({ hidden: true });
    else returnFromHidden();
  };

  /** A new store session: everything from the old evening goes. */
  const reset = (next: number) => {
    session = next;
    cancelTimer();
    seen = new Set();
    held = [];
    snap = { session, stage: null, queue: [], hidden: snap.hidden, held: 0, goals: NO_GOALS, hero: null, announcement: null };
    restartLog();
    emit();
  };

  const onStore = (s: ReturnType<MomentStore['getState']>) => {
    if (s.session !== session) reset(s.session);
    if (s.moments.length > 0) take(s.actions.takeMoments());
  };

  const director: MomentDirector = {
    clock,
    delivered: {
      getState: () => log,
      subscribe(l) {
        logListeners.add(l);
        return () => {
          logListeners.delete(l);
        };
      },
    },
    get running() {
      return running;
    },
    start() {
      if (running) return;
      running = true;
      const s = store.getState();
      if (s.session !== session) reset(s.session);
      // moments queued before the director ran are old news
      if (s.moments.length > 0) for (const m of s.actions.takeMoments()) remember(m.id);
      snap = { ...snap, hidden: visibility.hidden() };
      offStore = store.subscribe(onStore);
      offVisible = visibility.subscribe(onVisibility);
      emit();
    },
    stop() {
      if (!running) return;
      running = false;
      offStore?.();
      offVisible?.();
      offStore = offVisible = undefined;
      cancelTimer();
      held = [];
      update({ stage: null, queue: [], held: 0 });
    },
    setView(next) {
      if (next.openId === view.openId && next.front === view.front && next.followedMatchId === view.followedMatchId) return;
      view = next;
    },
    getSnapshot: () => snap,
    subscribe(l) {
      listeners.add(l);
      return () => {
        listeners.delete(l);
      };
    },
    tap(key) {
      const p = snap.stage;
      if (!p || p.phase === 'out' || (key !== undefined && p.key !== key)) return;
      if (p.kind !== 'scene') return leave(p.key);
      const now = clock.now();
      const full = p.beats?.full ?? 0;
      if (now - p.startedAt < full - 1e-6) {
        const next = { ...p, startedAt: now - full };
        update({ stage: next });
        scheduleClose(next);
      } else leave(p.key);
    },
    dismiss: (key) => leave(key),
    hold(on, key) {
      const p = snap.stage;
      if (!p || p.kind === 'scene' || p.phase === 'out' || p.held === on || (key !== undefined && p.key !== key)) return;
      const next = { ...p, held: on };
      update({ stage: next });
      if (on) cancelTimer();
      else if (clock.now() - next.startedAt > next.closeAfter) leave(next.key);
      else scheduleClose(next);
    },
  };
  return director;
}

function latestOf(goals: ReadonlyMap<number, GoalCue>): number | undefined {
  let best: number | undefined;
  let n = -1;
  for (const [id, cue] of goals) if (cue.n > n) [best, n] = [id, cue.n];
  return best;
}
