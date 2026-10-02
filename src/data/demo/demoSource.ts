// DemoSource: a matchday that plays itself, with no backend (ARCHITECTURE §4.7). The match model
// and the evening are the Lua's simulation (./model, ./sim); how it talks is the JS demo's
// (`Scoreline_Fixed.html:9967–10053`): a full feed on start, live events in between, and a fresh
// snapshot now and then, as polling would bring.
//
// The clock: the simulation keeps its own match time and moves in ticks of 6 match seconds (the
// Lua's tick). At speed 1 that is real time, one tick every 6 s, so the app's own clock (minute
// plus time since the last sync) runs in step with it. `?demo=fast` is speed 10: a tick every
// 600 ms. Time only passes while the source is started; stop() pauses the evening and start()
// carries on from where it stopped, beginning with a full feed.
//
// One timer at a time: the next tick or the followed player's next action, whichever is due
// first. Everything goes through `parseFeed` / `parseEvent`, exactly like ApiSource's output.

import { parseEvent, parseFeed } from '../../domain';
import { realScheduler, type Scheduler, type TimerHandle } from '../environment';
import { IDLE_STATUS, type EventHandler, type FeedHandler, type Source, type StatusHandler } from '../source';
import { DemoSim, TICK_SECONDS, type DemoSimOptions, type DemoTrigger, type Followed, type Outgoing } from './sim';
import { feedJson, messageJson } from './wire';

/** Real ms per tick at speed 1: 6 match seconds take 6 s. */
export const TICK_MS = TICK_SECONDS * 1000;
/** The first action of a newly followed player comes this long after (`newFollow`, `luau:7307`). */
const FIRST_ACT_MS = 1200;

export interface DemoSourceOptions extends DemoSimOptions {
  /** Match time per real time. 1 is real time; `FAST_SPEED` (10) is `?demo=fast`. */
  readonly speed?: number;
  readonly scheduler?: Scheduler;
}

export interface DemoSource extends Source {
  readonly speed: number;
  readonly running: boolean;
  /** Fires one of the dev panel's triggers. False when it had nothing to act on. */
  trigger(name: DemoTrigger): boolean;
  /** Follows a player (their actions arrive as `action` events), or nobody. */
  follow(player: Followed | null): void;
}

interface Handlers {
  readonly onFeed: FeedHandler;
  readonly onEvent: EventHandler;
  readonly onStatus: StatusHandler | undefined;
}

export function createDemoSource(options: DemoSourceOptions = {}): DemoSource {
  const sched = options.scheduler ?? realScheduler;
  const speed = options.speed !== undefined && options.speed > 0 ? options.speed : 1;
  const sim = new DemoSim(options);

  // Match time (ms) the simulation has reached, and when its next tick and action are due.
  let simMs = 0;
  let tickDue = TICK_MS;
  let actDue = sim.followed ? FIRST_ACT_MS : Infinity;

  // `session` bumps on every start and stop; a timer from an older session does nothing.
  let session = 0;
  let handlers: Handlers | null = null;
  let timer: TimerHandle | null = null;

  function clearTimer(): void {
    if (timer !== null) sched.clearTimeout(timer);
    timer = null;
  }

  function schedule(): void {
    clearTimer();
    if (!handlers) return;
    const s = session;
    const due = Math.min(tickDue, actDue);
    timer = sched.setTimeout(() => wake(s, due), Math.max(0, (due - simMs) / speed));
  }

  function wake(s: number, due: number): void {
    if (s !== session) return;
    timer = null;
    simMs = due;
    const out: Outgoing[] = [];
    if (tickDue <= simMs) {
      out.push(...sim.tick());
      tickDue += TICK_MS;
    }
    if (actDue <= simMs) actDue = sim.followed ? simMs + sim.followStep(out) * 1000 : Infinity;
    deliver(s, out);
    if (s === session) schedule();
  }

  /** Hands the messages on in order; a snapshot, if any was asked for, goes last. */
  function deliver(s: number, out: readonly Outgoing[]): void {
    let snapshot = false;
    for (const o of out) {
      if (s !== session || !handlers) return;
      if (o.type === 'snapshot') {
        snapshot = true;
        continue;
      }
      const ev = parseEvent(messageJson(o));
      if (ev) handlers.onEvent(ev);
    }
    if (snapshot) sendFeed(s);
  }

  function sendFeed(s: number): void {
    if (s !== session || !handlers) return;
    handlers.onFeed(parseFeed(feedJson(sim)));
  }

  return {
    speed,
    get running() {
      return handlers !== null;
    },
    start(onFeed, onEvent, onStatus) {
      if (handlers) return;
      session += 1;
      const s = session;
      handlers = { onFeed, onEvent, onStatus };
      onStatus?.({ phase: 'live', feedError: false });
      sendFeed(s);
      if (s === session) schedule();
    },
    stop() {
      if (!handlers) return;
      session += 1;
      clearTimer();
      const h = handlers;
      handlers = null;
      h.onStatus?.(IDLE_STATUS);
    },
    ensureMatchDetails() {
      // Every snapshot already carries every match's line-ups, stats and ratings.
    },
    trigger(name) {
      const out: Outgoing[] = [];
      const done = sim.trigger(name, out);
      deliver(session, out);
      return done;
    },
    follow(player) {
      sim.followed = player;
      actDue = player ? simMs + FIRST_ACT_MS : Infinity;
      if (handlers) schedule();
    },
  };
}
