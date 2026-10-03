import { RoundButton } from '../../ui';
import { LiveIcon } from '../../rive/LiveIcon';
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
    <LiveIcon live={on} count={count} onChange={onToggle} className={`m-glass ${styles.live}`} fallback={
      <span className={styles.capsule} aria-hidden="true">
        <svg width="9" height="9" viewBox="0 0 9 9" fill="none"><circle cx="4.5" cy="4.5" r="4.5" fill={on ? 'currentColor' : 'var(--c-live)'} /></svg>
        <span>Live</span>
      </span>
    }>
      <span className={styles.count} aria-hidden="true">
        {count}
      </span>
    </LiveIcon>
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

