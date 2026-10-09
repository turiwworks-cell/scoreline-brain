/*
 * Two touch gestures (SL-10), kept out of the first script: loaded after the first paint, on a
 * device that has a touchscreen (layout/Shell → screens/screenChunks).
 *
 *   on the match screen (phone)   a swipe to the right goes back, as the Back button does
 *   on the day list               a swipe to the left shows the next day, to the right the day before
 *
 * Both are the app's own actions, not new ones: a click on the match screen's own Back button (which
 * is `nav.back`, and is there on the phone's stack only) and on the neighbouring day tab (so the back
 * and the day cascade, the URL and the tab all move exactly as a tap on that control moves them).
 * Nothing is dragged: a gesture is judged when the finger lifts, and the browser's scrolling is never
 * prevented, so a scroll is a scroll. A finger that is not clearly horizontal, not far enough, too slow,
 * or a second finger, does nothing.
 */

/** How the finger must have moved for a swipe: far enough, and clearly more across than down. */
export const SWIPE = {
  /** px across */
  min: 64,
  /** across must be at least this many times the way down (or up) */
  ratio: 2,
  /** ms from touch to lift: a slower drag is a drag, not a swipe */
  maxMs: 800,
  /** px from either edge of the screen where the browser's own back gesture starts: the app's never does */
  edge: 28,
} as const;

export type SwipeDirection = 'left' | 'right';

export interface Touch1 {
  readonly x: number;
  readonly y: number;
  readonly t: number;
}

/** The swipe a finger made, or none. `width` is the screen's, for the edge guard. */
export function swipeOf(from: Touch1, to: Touch1, width: number): SwipeDirection | null {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (from.x < SWIPE.edge || from.x > width - SWIPE.edge) return null;
  if (Math.abs(dx) < SWIPE.min || Math.abs(dx) < SWIPE.ratio * Math.abs(dy)) return null;
  if (to.t - from.t > SWIPE.maxMs) return null;
  return dx > 0 ? 'right' : 'left';
}

/** Where a gesture may start: not on a control that takes horizontal movement itself, nor on a scroller that scrolls across. */
const OWN_MOVEMENT = 'input,textarea,select,[contenteditable],[role="slider"],[data-no-swipe]';

function scrollsAcross(el: Element | null, stop: Element): boolean {
  for (let e = el; e && e !== stop.parentElement; e = e.parentElement) {
    if (e.scrollWidth > e.clientWidth + 1) {
      const o = getComputedStyle(e).overflowX;
      if (o === 'auto' || o === 'scroll') return true;
    }
  }
  return false;
}

/** The day tab beside the chosen one, in the direction the content moves: left shows the next day. */
function neighbourDay(dir: SwipeDirection): HTMLElement | null {
  const chosen = document.querySelector('[role="tablist"][aria-label="Day"] [role="tab"][aria-selected="true"]');
  const next = dir === 'left' ? chosen?.nextElementSibling : chosen?.previousElementSibling;
  return next instanceof HTMLElement && next.getAttribute('role') === 'tab' ? next : null;
}

/** What a swipe does on `screen`; nothing where it has no control to press. */
function act(screen: HTMLElement, dir: SwipeDirection): void {
  if (screen.dataset.screen === 'match') {
    // the phone's match is a layer over the list, with a Back button; a wider layout's pane has none
    if (dir === 'right') screen.querySelector<HTMLElement>('[aria-label="Back"]')?.click();
  } else if (screen.dataset.screen === 'list') {
    neighbourDay(dir)?.click();
  }
}

let armed: (() => void) | null = null;

/**
 * Starts listening (once: a second call replaces the first). Returns the call that stops it, which
 * the app never needs (the shell lives as long as the page) and the tests do.
 * Listeners are passive and on the document, so they cost a scroll nothing.
 */
export function attachSwipes(root: Document = document): () => void {
  armed?.();
  let start: (Touch1 & { screen: HTMLElement }) | null = null;
  const point = (t: { clientX: number; clientY: number }, now: number): Touch1 => ({ x: t.clientX, y: t.clientY, t: now });
  const onStart = (e: TouchEvent) => {
    start = null;
    const t = e.touches[0];
    // one finger, on a screen that is in front (not on its way out), and not where the finger itself moves across
    if (e.touches.length !== 1 || !t || !(e.target instanceof Element)) return;
    const screen = e.target.closest<HTMLElement>('[data-screen]');
    if (!screen || screen.dataset.present !== 'true' || screen.hasAttribute('inert')) return;
    if (e.target.closest(OWN_MOVEMENT) || scrollsAcross(e.target, screen)) return;
    start = { ...point(t, e.timeStamp), screen };
  };
  const onMove = (e: TouchEvent) => {
    // a second finger (a pinch) or a clearly vertical move ends it: the page is scrolling
    const t = e.touches[0];
    if (!start || !t) return;
    if (e.touches.length > 1 || (Math.abs(t.clientY - start.y) > SWIPE.min && Math.abs(t.clientY - start.y) > Math.abs(t.clientX - start.x))) start = null;
  };
  const onEnd = (e: TouchEvent) => {
    const from = start;
    start = null;
    const t = e.changedTouches[0];
    if (!from || !t || e.touches.length > 0) return;
    const dir = swipeOf(from, point(t, e.timeStamp), window.innerWidth);
    if (dir) act(from.screen, dir);
  };
  const onCancel = () => {
    start = null;
  };
  const opts = { passive: true } as const;
  root.addEventListener('touchstart', onStart, opts);
  root.addEventListener('touchmove', onMove, opts);
  root.addEventListener('touchend', onEnd, opts);
  root.addEventListener('touchcancel', onCancel, opts);
  const off = () => {
    root.removeEventListener('touchstart', onStart);
    root.removeEventListener('touchmove', onMove);
    root.removeEventListener('touchend', onEnd);
    root.removeEventListener('touchcancel', onCancel);
    if (armed === off) armed = null;
  };
  armed = off;
  return off;
}
