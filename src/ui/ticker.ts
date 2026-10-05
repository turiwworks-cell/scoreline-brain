/*
 * One shared 1 Hz ticker for every clock on screen (ARCHITECTURE §4.6). It runs only while
 * something listens, and fires just after each whole second so all clocks turn together.
 */

type Listener = () => void;

const listeners = new Set<Listener>();
let timer: ReturnType<typeof setTimeout> | undefined;

function schedule() {
  timer = setTimeout(() => {
    timer = undefined;
    for (const l of [...listeners]) l();
    // a listener may have subscribed (and so scheduled) already
    if (listeners.size > 0 && timer === undefined) schedule();
  }, 1000 - (Date.now() % 1000) + 5);
}

/** Calls `listener` once a second until the returned function is called. */
export function subscribeSecond(listener: Listener): () => void {
  listeners.add(listener);
  if (timer === undefined) schedule();
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && timer !== undefined) {
      clearTimeout(timer);
      timer = undefined;
    }
  };
}

/** How many listeners the ticker has (for tests). */
export const tickerListeners = () => listeners.size;
