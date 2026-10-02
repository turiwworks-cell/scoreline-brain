import type { CSSProperties } from 'react';
import { onRollEnd } from './feel';
import styles from './RollLabel.module.css';

/*
 * A label whose letters roll up and come back in from below, one after another
 * (rollTxt, luau:3397-3438). It rolls when its control is pressed (feel.ts sets
 * data-rolling) or when a caller calls roll() on it, never on hover.
 * Screen readers get the plain text; the letters are decoration.
 */
export function RollLabel({ text, className }: { text: string; className?: string }) {
  const chars = Array.from(text);
  return (
    <span className={className ? `${styles.label} ${className}` : styles.label}>
      <span className={styles.sr}>{text}</span>
      <span className={styles.letters} data-roll="" aria-hidden="true" onAnimationEnd={onRollEnd}>
        {chars.map((ch, i) => (
          <span key={i} className={styles.ch} data-ch={ch} style={{ '--i': i } as CSSProperties}>
            {ch}
          </span>
        ))}
      </span>
    </span>
  );
}
