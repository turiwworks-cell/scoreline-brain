import { useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { m, PresenceContext, useIsPresent, type Variants } from 'motion/react';
import type { ScrollPane } from '../nav/scrollMemory';
import { useScrollMemory } from '../nav/useScrollMemory';
import { useElasticEdges } from './useElasticEdges';
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
  useElasticEdges(ref);
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
      <LaterMountsAnimate>{children}</LaterMountsAnimate>
    </m.section>
  );
}

/**
 * What is on a screen at the app's first render shows at once (AnimatePresence initial={false}:
 * the Lua opens with screenT at -100, nothing cascading). Motion keeps that `initial: false` in the
 * presence context for as long as the screen stays, though, so everything that mounted inside it
 * later skipped its entrance too: on a direct link, and for the whole session in the desktop's
 * match pane, a tab's content, the line-up's rise and the rest never played. Once the first render
 * is on screen this hands the screen's content the same context without it.
 */
function LaterMountsAnimate({ children }: { children: ReactNode }) {
  const ctx = useContext(PresenceContext);
  const blocked = ctx?.initial === false;
  const [lifted, setLifted] = useState(false);
  useEffect(() => {
    if (!blocked) return;
    const id = requestAnimationFrame(() => setLifted(true));
    return () => cancelAnimationFrame(id);
  }, [blocked]);
  const value = useMemo(() => (ctx && blocked && lifted ? { ...ctx, initial: undefined } : ctx), [ctx, blocked, lifted]);
  return <PresenceContext.Provider value={value}>{children}</PresenceContext.Provider>;
}
