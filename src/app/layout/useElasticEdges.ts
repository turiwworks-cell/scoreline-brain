import { useEffect, type RefObject } from 'react';

/*
 * The Lua's scroll edges (pointerMove, luau:8803; stepScroll, luau:8559): a page dragged past its
 * top or bottom follows the finger at 0.4 of the way, and when it is let go it springs back,
 * closing 14 × dt of the gap each frame. That holds for a page shorter than the screen too, so any
 * page can be pulled down a little and let go. Native scrolling gives no such pull on desktop or
 * Android (review of 2026-10-04, video 04), so touch drags do it here.
 *
 * It takes over only a gesture that starts at an edge and pulls outward (its first move is still
 * cancelable); anything else is the browser's own scroll. The pull is written as --pull (and
 * data-pull while there is one) on the scroller; Shell.module.css moves the content by it and
 * sticky bars stay put.
 */

/** How much of the finger's travel past an edge the page follows. */
export const PULL_FOLLOW = 0.4;
/** The spring back: the share of the gap closed per second (per frame: min(1, dt × 14)). */
export const PULL_RETURN = 14;
/** A pull smaller than this has landed. */
const REST = 0.3;
/** Finger travel before a gesture counts as a drag, as in the Lua (luau:8791). */
const SLOP = 6;

export function useElasticEdges(ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let pull = 0;
    let raf = 0;
    let gesture: { x: number; y: number; from: number; edge: 'top' | 'bottom' | null; decided: boolean } | null = null;

    const write = (v: number) => {
      pull = v;
      if (v === 0) {
        el.style.removeProperty('--pull');
        delete el.dataset.pull;
      } else {
        el.style.setProperty('--pull', `${v}px`);
        el.dataset.pull = '';
      }
    };
    const springBack = () => {
      cancelAnimationFrame(raf);
      let last = performance.now();
      const step = (now: number) => {
        const dt = Math.min((now - last) / 1000, 0.05);
        last = now;
        const v = pull + (0 - pull) * Math.min(1, dt * PULL_RETURN);
        if (Math.abs(v) < REST) {
          write(0);
          return;
        }
        write(v);
        raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
    };

    const start = (e: TouchEvent) => {
      const t = e.touches[0];
      if (e.touches.length !== 1 || !t) {
        gesture = null;
        return;
      }
      cancelAnimationFrame(raf);
      // a finger landing on a page still springing back catches it where it is
      gesture = { x: t.clientX, y: t.clientY, from: pull / PULL_FOLLOW, edge: null, decided: false };
    };
    const move = (e: TouchEvent) => {
      const t = e.touches[0];
      if (!gesture || !t) return;
      const dx = t.clientX - gesture.x;
      const dy = t.clientY - gesture.y;
      if (!gesture.decided) {
        if (Math.abs(dx) < SLOP && Math.abs(dy) < SLOP) return;
        gesture.decided = true;
        const max = el.scrollHeight - el.clientHeight;
        const top = el.scrollTop <= 0 && dy > 0;
        const bottom = el.scrollTop >= max - 1 && dy < 0;
        // sideways (a toast's swipe, the day tabs) or into the page: the browser's own scroll
        if (Math.abs(dx) > Math.abs(dy) || !(top || bottom) || !e.cancelable) {
          gesture = null;
          if (pull !== 0) springBack();
          return;
        }
        gesture.edge = top ? 'top' : 'bottom';
      }
      if (!gesture.edge) return;
      const over = gesture.from + dy;
      // pulled back past the edge it started at: the page is at rest there, the gesture is spent
      if ((gesture.edge === 'top' && over <= 0) || (gesture.edge === 'bottom' && over >= 0)) {
        write(0);
        gesture = null;
        return;
      }
      if (e.cancelable) e.preventDefault();
      write(over * PULL_FOLLOW);
    };
    const end = () => {
      gesture = null;
      if (pull !== 0) springBack();
    };

    el.addEventListener('touchstart', start, { passive: true });
    el.addEventListener('touchmove', move, { passive: false });
    el.addEventListener('touchend', end, { passive: true });
    el.addEventListener('touchcancel', end, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      el.removeEventListener('touchstart', start);
      el.removeEventListener('touchmove', move);
      el.removeEventListener('touchend', end);
      el.removeEventListener('touchcancel', end);
      el.style.removeProperty('--pull');
      delete el.dataset.pull;
    };
  }, [ref]);
}
