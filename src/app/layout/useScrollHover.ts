import { useEffect, type RefObject } from 'react';

/*
 * A page wheeled under a resting mouse passes one control after another under the cursor, and
 * each one lit and faded its hover light (280 ms in, 550 ms out) while the page moved: the line-up's
 * markers, the substitutes' rows, the cards. Each repaint had the browser draw part of the page
 * again in the middle of the scroll (194 tiles in one flick over the line-up, in Chromium), and on
 * fast flicks a one-pixel row of wrong pixels flashed across the pitch for a frame or two (review
 * of 2026-10-06). While the wheel moves a page, hover lights stay off and controls remain
 * clickable: data-scrolling on the scroller, read by Shell.module.css. The control that was lit
 * goes out at once; the hover comes back once the page has been still for SCROLL_SETTLE_MS.
 *
 * Only a wheel (a mouse or a trackpad) raises it; a scroll still running keeps it raised. A touch
 * scroll has no hover, and a scroll made by the app (scroll memory, focus) is left alone.
 */

/** How long a page must be still before what is under the cursor lights again. */
export const SCROLL_SETTLE_MS = 150;

export function useScrollHover(ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const lower = () => {
      timer = undefined;
      delete el.dataset.scrolling;
    };
    const hold = () => {
      clearTimeout(timer);
      timer = setTimeout(lower, SCROLL_SETTLE_MS);
    };
    const wheel = () => {
      el.dataset.scrolling = '';
      hold();
    };
    const scroll = () => {
      if (timer !== undefined) hold();
    };

    el.addEventListener('wheel', wheel, { passive: true });
    el.addEventListener('scroll', scroll, { passive: true });
    return () => {
      clearTimeout(timer);
      el.removeEventListener('wheel', wheel);
      el.removeEventListener('scroll', scroll);
      delete el.dataset.scrolling;
    };
  }, [ref]);
}
