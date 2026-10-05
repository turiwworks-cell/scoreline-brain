import { createContext, useContext, useEffect, useState } from 'react';
import { afterPaint } from './afterPaint';

/*
 * When Rive may start. Its runtime is 2.3 MB of WASM to fetch and compile (a long task), and the
 * artwork and the word's chunk come with it. Nothing on the first screen needs them: the DOM
 * Live button is complete, and a goal scene waits for a goal. Started with the page, that work ran
 * in the same seconds as the bundle's own evaluation and the first feed's render (Part 21 review,
 * issue #4).
 *
 * So the shell opens the gate when the first data has been drawn and the browser has painted it
 * and has nothing better to do (afterPaint, with its idle slot). A feed that is slow, or never
 * comes, must not keep the artwork away for good: after MAX_WAIT_MS the gate opens without it.
 * Once open it stays open.
 */

/** How long to wait for the first data before starting Rive without it, in ms. */
export const RIVE_MAX_WAIT_MS = 4000;

/** Whether the artwork may start. Outside the shell (a harness, a test) there is nothing to wait for. */
export const RiveStartContext = createContext(true);

export const useRiveStart = (): boolean => useContext(RiveStartContext);

/**
 * True once `data` is on screen and painted and the browser is idle, or once `maxWaitMs` has passed
 * and the same has been true of the page without it.
 */
export function useRiveStartAfter(data: boolean, maxWaitMs: number = RIVE_MAX_WAIT_MS): boolean {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (open) return;
    let cancel = () => {};
    const go = () => {
      cancel = afterPaint(() => setOpen(true));
    };
    // The effect of the render that drew the data runs before the next paint, so two frames and an
    // idle slot from here are after that paint.
    if (data) {
      go();
      return () => cancel();
    }
    const timer = setTimeout(go, maxWaitMs);
    return () => {
      clearTimeout(timer);
      cancel();
    };
  }, [data, open, maxWaitMs]);
  return open;
}
