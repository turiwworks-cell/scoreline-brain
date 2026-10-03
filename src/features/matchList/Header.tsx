import { LiveDot, RoundButton } from '../../ui';
import styles from './Header.module.css';

/*
 * The list header (luau:4602–4654): the spectrum mark, the wordmark, the Live toggle on a glass
 * pill and the round menu button. The toggle is the script's own pill, the one it draws when no
 * Live icon is assigned; the Rive icon (ARCHITECTURE §3) replaces `LiveToggle` and nothing else.
 */

export function Logo() {
  return (
    <span className={styles.mark} aria-hidden="true">
      <span className={styles.bar1} />
      <span className={styles.bar2} />
      <span className={styles.bar3} />
    </span>
  );
}

export type LiveToggleProps = {
  on: boolean;
  /** how many matches are in play: the number on the calendar badge */
  count: number;
  onToggle: () => void;
};

/** Live on / off. A toggle button: the green capsule is its pressed state. */
export function LiveToggle({ on, count, onToggle }: LiveToggleProps) {
  return (
    <button type="button" className={`m-glass ${styles.live}`} aria-pressed={on} aria-label={`Live, ${count} in play`} onClick={onToggle}>
      <span className={styles.capsule} aria-hidden="true">
        {/* off: a ring pulses out from the dot every 1.8 s; on: the dot is ink on the green */}
        <LiveDot pulse={!on} ink={on} />
        <span>Live</span>
      </span>
      <span className={styles.count} aria-hidden="true">
        {count}
      </span>
    </button>
  );
}

export type HeaderProps = LiveToggleProps & {
  /** opens the account sheet; absent until the sheet exists */
  onMenu?: () => void;
};

export function Header({ on, count, onToggle, onMenu }: HeaderProps) {
  return (
    <div className={styles.row}>
      <Logo />
      <h1 className={styles.wordmark} tabIndex={-1} data-screen-heading="">
        scoreline
      </h1>
      <LiveToggle on={on} count={count} onToggle={onToggle} />
      <RoundButton aria-label="Menu" onClick={onMenu} aria-disabled={onMenu ? undefined : true}>
        <span className={styles.menu} aria-hidden="true">
          <span />
          <span />
        </span>
      </RoundButton>
    </div>
  );
}

