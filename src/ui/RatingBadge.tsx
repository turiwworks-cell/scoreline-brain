import type { CSSProperties, HTMLAttributes } from 'react';
import { UNIT_PATHS } from './icons';
import { ratingTone } from './rating';
import styles from './RatingBadge.module.css';

/*
 * A player's rating as a small filled tag (ratingTag, luau:3553-3569): the spectrum for the
 * great games (8+), then green, yellow, orange and red. `best` adds the star for the man
 * of the match.
 */

export type RatingBadgeProps = HTMLAttributes<HTMLSpanElement> & {
  value: number;
  /** the best rating in the match: a star before the number */
  best?: boolean;
  /** font size in px (the Lua's size, 10 by default); everything else scales with it */
  size?: number;
};

export function RatingBadge({ value, best, size = 10, className, style, ...rest }: RatingBadgeProps) {
  const { bg, fg } = ratingTone(value);
  const label = value.toFixed(1);
  const st = {
    ...style,
    '--fs': `${size}px`,
    '--h': `${Math.floor(size * 1.6 + 0.5)}px`,
    '--bg': bg ?? 'var(--spectrum-3)',
    color: fg,
  } as CSSProperties;
  const cls = [styles.badge, best && styles.best, className].filter(Boolean).join(' ');
  return (
    <span className={cls} style={st} aria-label={`Rating ${label}${best ? ', best in the match' : ''}`} {...rest}>
      {best && (
        <svg className={styles.star} viewBox="-1 -1 2 2" aria-hidden="true" focusable="false">
          <path d={UNIT_PATHS.star} fill="currentColor" />
        </svg>
      )}
      <span aria-hidden="true">{label}</span>
    </span>
  );
}
