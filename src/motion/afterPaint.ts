import { useContext, useEffect, useState } from 'react';
import { PresenceContext } from 'motion/react';

/**
 * `value`, a frame later: what a screen shows below its shell (Part 21, #3). Navigation renders in
 * the tap (flushSync, app/nav/actions.ts), so a screen's first frame used to hold everything (a
 * match's hero, tabs and the whole Facts tab, or 22 line-up markers) and the tap waited 300–500 ms
 * for its paint on a phone. With this the tap's frame holds the shell and what the push moves; the
 * body renders in a task after that frame's paint, under the push that hides it.
 *
 * On a screen's first render that is `null` (nothing yet), then `value`; when `value` changes
 * later, the previous one stays until the new one renders (a tab's old body keeps its place, so the
 * page doesn't collapse for a frame). Not useDeferredValue: its render may run before the paint,
 * and every store update (the clock, each second) restarts it, so a body came 900 ms late.
 * What the app's first render shows (a direct link, AnimatePresence initial={false}) and anything
 * outside a presence has no push to hide behind and no tap to answer: it renders at once.
 */
export function useAfterPaint<T>(value: T): T | null {
  const presence = useContext(PresenceContext);
  const [shown, setShown] = useState<T | null>(!presence || presence.initial === false ? value : null);
  const later = !!presence && !Object.is(shown, value);
  useEffect(() => {
    if (!later) return;
    let task = 0;
    // the frame's callbacks run before its paint; a task queued from one runs after it
    const frame = requestAnimationFrame(() => {
      task = window.setTimeout(() => setShown(value), 0);
    });
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(task);
    };
  }, [later, value]);
  return presence ? shown : value;
}
