import { useEffect, useLayoutEffect, useRef, type RefObject } from 'react';
import { useLocation, useNavigationType } from 'react-router';
import { scrollMemory, scrollPlan, type ScrollMemory, type ScrollPane } from './scrollMemory';

/** Frames a restore keeps trying while the content grows tall enough (content that loads late). */
const RESTORE_FRAMES = 30;

/**
 * Saves and restores one scroll container's position per history entry (scrollMemory.ts has the
 * rule). `contentKey` names what the pane shows (a match id, a day); a new one starts at the top.
 * A screen on its way out (`present` false) neither saves nor restores.
 */
export function useScrollMemory(ref: RefObject<HTMLElement | null>, pane: ScrollPane, contentKey: string, present: boolean, memory: ScrollMemory = scrollMemory) {
  const location = useLocation();
  const navType = useNavigationType();
  const live = useRef({ key: location.key, present });
  const shown = useRef<string | null>(null);
  // where the pane is, as its scroll events last said: reading scrollTop in the commit forced a
  // style and layout of the whole page inside the tap that opened a screen (Part 21, #3)
  const y = useRef(0);

  useLayoutEffect(() => {
    live.current = { key: location.key, present };
  });

  useLayoutEffect(() => {
    const el = ref.current;
    if (!present || !el) return;
    const plan = scrollPlan({ pop: navType === 'POP', saved: memory.get(location.key, pane), contentChanged: shown.current !== contentKey });
    const mounted = shown.current === null;
    shown.current = contentKey;
    // a screen that just mounted is at the top already
    if (plan.kind === 'top' && !mounted && y.current !== 0) el.scrollTop = y.current = 0;
    if (plan.kind !== 'restore') {
      // the new entry starts where the pane is now: a tab switch or a day change replaces the
      // entry (a new key), and back/forward to it must find this position, not nothing
      memory.set(location.key, pane, plan.kind === 'top' ? 0 : y.current);
      return;
    }
    // content may still be growing: keep at it for a few frames, until the user scrolls
    let frames = 0;
    let raf = 0;
    const stop = () => cancelAnimationFrame(raf);
    const step = () => {
      el.scrollTop = plan.y;
      if (Math.abs(el.scrollTop - plan.y) > 1 && ++frames < RESTORE_FRAMES) raf = requestAnimationFrame(step);
    };
    step();
    el.addEventListener('wheel', stop, { passive: true, once: true });
    el.addEventListener('touchstart', stop, { passive: true, once: true });
    return () => {
      stop();
      el.removeEventListener('wheel', stop);
      el.removeEventListener('touchstart', stop);
    };
  }, [location.key, contentKey, present, navType, pane, memory, ref]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onScroll = () => {
      y.current = el.scrollTop;
      if (live.current.present) memory.set(live.current.key, pane, y.current);
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [pane, memory, ref]);
}
