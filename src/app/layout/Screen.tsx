import { useRef, type ReactNode } from 'react';
import { m, useIsPresent, type Variants } from 'motion/react';
import type { ScrollPane } from '../nav/scrollMemory';
import { useScrollMemory } from '../nav/useScrollMemory';
import styles from './Shell.module.css';

export type ScreenProps = {
  /** which pane's scroll memory this screen uses, and its `data-screen` name */
  pane: ScrollPane;
  /** what it shows (a match id, a day): something new starts at the top */
  contentKey: string;
  /** its accessible name */
  label: string;
  /** another screen covers it: it can't be reached by keyboard or screen reader */
  covered?: boolean;
  className?: string;
  variants?: Variants;
  initial?: string | false;
  animate?: string;
  exit?: string;
  children: ReactNode;
};

/**
 * One screen: a native scroll container (ARCHITECTURE §6) with its own scroll memory. While
 * another screen covers it, or while it leaves, it is inert. `data-present="false"` marks one on
 * its way out, so focus and shared elements look past it.
 */
export function Screen({ pane, contentKey, label, covered = false, className, variants, initial, animate, exit, children }: ScreenProps) {
  const ref = useRef<HTMLElement>(null);
  const present = useIsPresent();
  useScrollMemory(ref, pane, contentKey, present);
  return (
    <m.section
      ref={ref}
      className={className ? `${styles.screen} ${className}` : styles.screen}
      data-screen={pane}
      data-scroller=""
      data-present={present ? 'true' : 'false'}
      aria-label={label}
      inert={covered || !present}
      variants={variants}
      initial={initial}
      animate={animate}
      exit={exit}
    >
      {children}
    </m.section>
  );
}
