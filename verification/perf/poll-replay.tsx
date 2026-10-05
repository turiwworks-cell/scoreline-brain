// Diagnostic entry only; never imported by the application or its initial bundle.
// Stage the demo's wire JSON before timing. Replay it through the real ApiSource, domain/store
// and UI so feedJson's demo-only generation cost is not mistaken for a real poll's cost.
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { App } from '../../src/app/App';
import { createApiSource, connectSource, type Scheduler } from '../../src/data';
import { createFeedParser } from '../../src/domain';
import { DemoSim } from '../../src/data/demo/sim';
import { feedJson } from '../../src/data/demo/wire';
import { scorelineStore } from '../../src/store';
import '../../src/styles/tokens.css';
import '../../src/styles/materials.css';
import '../../src/styles/global.css';

type Sample = { start: number; callback: number; untilPaint: number };
let payloads: string[] = [];
let index = 0;
let timer: (() => void) | undefined;
let ended = 0;
let sourceReady: (() => void) | undefined;
const scheduler: Scheduler = {
  now: Date.now,
  setTimeout(fn) { timer = fn; ended = performance.now(); sourceReady?.(); return fn; },
  clearTimeout(fn) { if (timer === fn) timer = undefined; },
};
const source = createApiSource({
  scheduler,
  environment: { isHidden: () => false, isOnline: () => true, subscribe: () => () => {} },
  transport: {
    fetchFeed: () => Promise.resolve({ status: 'ok', body: JSON.parse(payloads[index]!) as unknown }),
    openStream: () => ({ close() {} }),
  },
});
const paint = () => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
/** The main thread is idle: React's passive effects (the stores' subscriptions) from the render before have run. */
const idle = () => new Promise<void>((resolve) => requestIdleCallback(() => resolve(), { timeout: 2000 }));

declare global {
  interface Window {
    __pollReplay: {
      prepare(samples: number, matches: number): void;
      /** `separate`: let the app's own first render (no data) paint before the first feed, as in production. */
      mount(separate?: boolean): Promise<void>;
      poll(i: number): Promise<Sample>;
      /** The first feed's synchronous apply and render (JSON already decoded), in performance.now() time. */
      firstData?: { start: number; callback: number };
      /** The cold cost of decoding and validating the first feed, apart from the app (call on a page that has not mounted). */
      parseCost(): { bytes: number; json: number; validate: number };
    };
  }
}
window.__pollReplay = {
  prepare(samples, count) {
    const sim = new DemoSim({ seed: 11, loop: false });
    payloads = [];
    for (let i = 0; i <= samples; i++) {
      const raw = feedJson(sim);
      if (count > 0) {
        const originals = raw.matches as Record<string, unknown>[];
        raw.matches = Array.from({ length: count }, (_, n) => ({ ...originals[n % originals.length], id: n + 1 }));
      }
      payloads.push(JSON.stringify(raw));
      sim.tick();
    }
  },
  parseCost() {
    const wire = payloads[0]!;
    let t = performance.now();
    const raw: unknown = JSON.parse(wire);
    const json = performance.now() - t;
    t = performance.now();
    createFeedParser()(raw);
    return { bytes: wire.length, json, validate: performance.now() - t };
  },
  async mount(separate = false) {
    createRoot(document.getElementById('root')!).render(<App />);
    // Without this the first render and the first feed share one flushSync. The app's own first
    // render has no data, and the demo's feed arrives after it, in a task of its own.
    // The effects of that render subscribe the components to the store. In the app the feed arrives
    // long after them; without waiting here the feed can land first and be rendered by the
    // subscriptions' own catch-up instead of by this flushSync, outside the measured callback.
    if (separate) {
      await paint();
      await idle();
    }
    await new Promise<void>((resolve) => {
      sourceReady = resolve;
      const actions = scorelineStore.getState().actions;
      connectSource(source, {
        // Include the whole synchronous render, conservatively. Production's external-store
        // updates are synchronous too; this removes any ambiguity about a scheduled commit.
        applyFeed: (feed, now) => {
          const start = performance.now();
          flushSync(() => actions.applyFeed(feed, now));
          window.__pollReplay.firstData ??= { start, callback: performance.now() - start };
        },
        applyEvent: actions.applyEvent,
        setSync: actions.setSync,
      });
    });
    sourceReady = undefined;
    await paint();
  },
  async poll(i) {
    index = i;
    const start = performance.now();
    await new Promise<void>((resolve) => {
      sourceReady = resolve;
      const next = timer;
      timer = undefined;
      if (!next) throw new Error('No poll scheduled');
      next();
    });
    sourceReady = undefined;
    const callback = ended - start;
    await paint();
    return { start, callback, untilPaint: performance.now() - start };
  },
};
