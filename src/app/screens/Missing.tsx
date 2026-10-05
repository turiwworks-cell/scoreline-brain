import type { Ref } from 'react';
import { Icon, RoundButton } from '../../ui';
import { useNav } from '../nav/useNav';
import styles from './placeholder.module.css';

/** A screen whose match or player isn't in the feed (yet). */
export function Missing({ back, loaded, what, ref }: { back: boolean; loaded: boolean; what: string; ref?: Ref<HTMLDivElement> }) {
  const nav = useNav();
  return (
    <div ref={ref} className={styles.page}>
      <div className={styles.bar}>
        {back && (
          <RoundButton aria-label="Back" onClick={nav.back}>
            <Icon name="back" />
          </RoundButton>
        )}
        <h1 className={`${styles.title} ${styles.heading}`} tabIndex={-1} data-screen-heading="">
          {loaded ? 'Not found' : 'Loading…'}
        </h1>
      </div>
      {loaded && <p className={styles.empty}>{what} isn’t in the feed.</p>}
    </div>
  );
}

/** The match pane with nothing to show (drawDesktop, luau:7073). */
export function PickAMatch() {
  return (
    <div className={styles.page}>
      <h1 className={`${styles.empty} ${styles.heading}`} tabIndex={-1} data-screen-heading="">
        Pick a match.
      </h1>
    </div>
  );
}
