// Diagnostic entry only; never imported by the application or its initial bundle.
// Stage the demo's wire JSON before timing. Replay it through the real ApiSource, domain/store
// and UI so feedJson's demo-only generation cost is not mistaken for a real poll's cost.
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { App } from '../../src/app/App';
import { createApiSource, connectSource, type Scheduler } from '../../src/data';
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

declare global {
  interface Window {
    __pollReplay: {
      prepare(samples: number, matches: number): void;
      mount(): Promise<void>;
      poll(i: number): Promise<Sample>;
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
  async mount() {
    createRoot(document.getElementById('root')!).render(<App />);
    await new Promise<void>((resolve) => {
      sourceReady = resolve;
      const actions = scorelineStore.getState().actions;
      connectSource(source, {
        // Include the whole synchronous render, conservatively. Production's external-store
        // updates are synchronous too; this removes any ambiguity about a scheduled commit.
        applyFeed: (feed, now) => flushSync(() => actions.applyFeed(feed, now)),
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
