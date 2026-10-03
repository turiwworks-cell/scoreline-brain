import type { ReactNode } from 'react';
import styles from './Panels.module.css';

/**
 * A section's heading line (h4, luau:4704): a muted label on the left, a white one on the right,
 * 13.7 px tall with 14 px of air under it.
 */
export function H4({ left, right }: { left: string; right?: ReactNode }) {
  return (
    <div className={styles.h4}>
      <h2 className={styles.h4Left}>{left}</h2>
      {right != null && right !== '' && <span className={styles.h4Right}>{right}</span>}
    </div>
  );
}
