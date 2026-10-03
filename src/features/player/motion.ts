import { useEffect, useLayoutEffect, type RefObject } from 'react';
import { animate, useMotionValue, useReducedMotion, type MotionValue } from 'motion/react';
import { CURVES, isFlying, sharedPlayerGroup, timing } from '../../motion';

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
  /** the bust's own entrance when no flight brings it (a direct link): fade in, grow from 0.9 */
  readonly heroOpacity: MotionValue<number>;
  readonly heroScale: MotionValue<number>;
  /** glides 0 → 1 over half a second when he was reached by an arrow, and is 1 otherwise */
  readonly step: MotionValue<number>;
}

/**
 * The page's own progress (drawPlayerView, luau:5925): `e` runs the player timing from the moment
 * he opens. The bust is placed hidden and untransformed so a flight can measure it; once the
 * flights have started (a passive effect runs after the shell's layout effect) it either takes
 * the flight's place or, with none, plays its own entrance.
 */
export function useOpening(team: string, n: number, stepped: boolean): Opening {
  const reduce = useReducedMotion() === true;
  const e = useMotionValue(0);
  const heroOpacity = useMotionValue(0);
  const heroScale = useMotionValue(1);
  const step = useMotionValue(stepped && !reduce ? 0 : 1);

  useEffect(() => {
    const t = timing('player');
    if (reduce) {
      e.set(1);
      heroOpacity.set(1);
      return;
    }
    const stops: { stop(): void }[] = [];
    if (stepped) {
      e.set(1);
      heroOpacity.set(1);
      stops.push(animate(step, 1, { duration: 0.5, ease: CURVES.glide }));
    } else if (isFlying(sharedPlayerGroup(team, n))) {
      heroOpacity.set(1);
      stops.push(animate(e, 1, { duration: t.duration, ease: t.ease }));
    } else {
      heroScale.set(0.9);
      stops.push(
        animate(0, 1, {
          duration: t.duration,
          ease: t.ease,
          onUpdate: (v) => {
            e.set(v);
            heroOpacity.set(Math.min(v * 2.5, 1));
            heroScale.set(0.9 + 0.1 * v);
          },
        }),
      );
    }
    return () => stops.forEach((s) => s.stop());
  }, [team, n, stepped, reduce, e, heroOpacity, heroScale, step]);

  return { e, heroOpacity, heroScale, step };
}
