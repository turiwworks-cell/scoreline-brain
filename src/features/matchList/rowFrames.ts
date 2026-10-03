import { useEffect, type RefObject } from 'react';
import { rowFeel } from './goalFeel';
import { goalFeed, type GoalFeed } from './goalFeed';
import { startFrames } from './frames';

/**
 * Plays a fresh goal on a row (luau:3925–3966): its glow flashes for 1.6 s, the new number pops and
 * takes the spectrum. Written as custom properties on the row, once a frame, while the goal is fresh.
 */
export function useRowFrames(ref: RefObject<HTMLElement | null>, matchId: number, feed: GoalFeed = goalFeed) {
  useEffect(() => {
    let stop: (() => void) | undefined;
    const apply = (now: number): boolean => {
      const el = ref.current;
      if (!el) return false;
      const mk = feed.mark(matchId);
      const f = rowFeel(now, mk);
      const set = (k: string, v: number, rest: number) => {
        if (v === rest) el.style.removeProperty(k);
        else el.style.setProperty(k, String(v));
      };
      set('--flash', f.flash, 0);
      set('--bump-h', f.bump[0], 1);
      set('--bump-a', f.bump[1], 1);
      set('--mk-h', f.mark[0] > 0.001 ? f.mark[0] : 0, 0);
      set('--mk-a', f.mark[1] > 0.001 ? f.mark[1] : 0, 0);
      return mk !== undefined && feed.active(now) && now - mk.t < 60;
    };
    const kick = () => {
      stop?.();
      stop = startFrames((now) => {
        const more = apply(now);
        if (!more) stop = undefined;
        return more;
      }, () => feed.clock.now());
    };
    const mine = () => {
      if (feed.mark(matchId)) kick();
    };
    mine();
    const off = feed.subscribe(mine);
    return () => {
      off();
      stop?.();
    };
  }, [ref, matchId, feed]);
}
