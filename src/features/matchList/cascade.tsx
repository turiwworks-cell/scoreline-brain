import { useContext, type CSSProperties, type ReactNode } from 'react';
import { m, type Variants } from 'motion/react';
import { snapPx, transition } from '../../motion';
import { FeedContext } from './feedContext';

/*
 * Blocks of the list come in one after another after a day change (blockIn, luau:3984, motion:
 * list): each fades in while it slides 18 px from the side the new day lies on and 6 px up,
 * block i starting i × stagger after the first. Only a day change plays it (the Lua's feedT):
 * the first render, and anything that arrives later, shows at once.
 *
 * A block that was already there replays when the epoch moves: its animate label flips between
 * two variants with the same keyframes, which Motion treats as a new animation. A block that
 * mounts while the change is still playing starts hidden.
 */

/** A long matchday must not hold its last rows back for seconds: the cascade stops counting here. */
export const BLOCK_CAP = 24;

interface Custom {
  i: number;
  dir: number;
}

const enter = (c: Custom) => ({
  opacity: [0, 1],
  x: [18 * c.dir, 0],
  y: [6, 0],
  transition: transition('list', { index: Math.min(c.i, BLOCK_CAP) }),
});

const listBlock: Variants = {
  hidden: (c: Custom) => ({ opacity: 0, x: 18 * c.dir, y: 6 }),
  odd: enter,
  even: enter,
};

export function Block({ index, className, style, hidden, children }: { index: number; className?: string; style?: CSSProperties; hidden?: boolean; children: ReactNode }) {
  const { epoch, dir, fresh } = useContext(FeedContext);
  return (
    <m.div className={className} style={style} hidden={hidden} variants={listBlock} custom={{ i: index, dir }} initial={fresh ? 'hidden' : false} animate={epoch % 2 ? 'odd' : 'even'} transformTemplate={snapPx}>
      {children}
    </m.div>
  );
}
