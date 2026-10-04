import { useEffect, useLayoutEffect, type RefObject } from 'react';
import { animate, useIsPresent, useMotionValue, useReducedMotion, type MotionValue } from 'motion/react';
import { CURVES, timing } from '../../motion';

/**
 * Writes the scroll position of the nearest scroller (the screen) into `--sy` on `el`, and
 * which stage the two arrows are in into `data-arrows`: the bar's frost, the arrows' fade and
 * the frosted copy under the bar follow it in CSS, so a scroll never renders React.
 */
export function useScrollVars(ref: RefObject<HTMLElement | null>) {
  useLayoutEffect(() => {
    const el = ref.current;
    const scroller = el?.closest<HTMLElement>('[data-scroller]');
    if (!el || !scroller) return;
    let frame = 0;
    const write = () => {
      frame = 0;
      const y = scroller.scrollTop;
      el.style.setProperty('--sy', String(y));
      // the arrows fade over 90 px and press only while more than half there (luau:6152)
      el.dataset.arrows = y < 45 ? 'on' : y < 88 ? 'fading' : 'off';
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(write);
    };
    write();
    scroller.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      scroller.removeEventListener('scroll', onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [ref]);
}

export interface Opening {
  /** 0 → 1 as the page opens, on the player timing: the line of light fades in over its middle */
  readonly e: MotionValue<number>;
  /** the bust's entrance: it fades in fast and grows from 0.9 about its middle */
  readonly heroOpacity: MotionValue<number>;
  readonly heroScale: MotionValue<number>;
  /** glides 0 → 1 over half a second when he was reached by an arrow, and is 1 otherwise */
  readonly step: MotionValue<number>;
}

/** The bust's size at the start of the entrance and the end of the exit (luau:5965). */
export const HERO_FROM = 0.9;

/**
 * The page's own progress (drawPlayerView, luau:5925–5967). `e` runs the player timing from the
 * moment he opens and runs back down, in 0.7 of the time, as he closes. The bust follows it:
 * opacity min(2.5 e, 1) and scale 0.9 + 0.1 e, about its middle.
 *
 * Every way in is the same, wherever he was opened from (a line-up, the list, the follow card,
 * the insights pane): nothing flies from the face that was tapped. This was the Lua's own
 * entrance for a page with no face to grow from; the product owner chose it for all of them
 * (review of 2026-10-04, video 02). The goal and red-card scenes keep their own rise.
 */
export function useOpening(team: string, n: number, stepped: boolean): Opening {
  const reduce = useReducedMotion() === true;
  const present = useIsPresent();
  const e = useMotionValue(0);
  const heroOpacity = useMotionValue(0);
  const heroScale = useMotionValue(HERO_FROM);
  const step = useMotionValue(stepped && !reduce ? 0 : 1);

  useEffect(() => {
    const show = (v: number) => {
      e.set(v);
      heroOpacity.set(Math.min(v * 2.5, 1));
      heroScale.set(HERO_FROM + (1 - HERO_FROM) * v);
    };
    if (reduce) {
      show(present ? 1 : 0);
      return;
    }
    const t = timing('player');
    const stops: { stop(): void }[] = [];
    if (!present) {
      stops.push(animate(e.get(), 0, { duration: t.duration * 0.7, ease: t.ease, onUpdate: show }));
    } else if (stepped) {
      show(1);
      stops.push(animate(step, 1, { duration: 0.5, ease: CURVES.glide }));
    } else {
      show(0);
      stops.push(animate(0, 1, { duration: t.duration, ease: t.ease, onUpdate: show }));
    }
    return () => stops.forEach((s) => s.stop());
    // he is the same player while the page stays: a re-render never restarts the entrance
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [team, n, stepped, reduce, present]);

  return { e, heroOpacity, heroScale, step };
}
