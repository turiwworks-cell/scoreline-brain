import { memo, useSyncExternalStore, type HTMLAttributes } from 'react';
import { minLabel, type Match } from '../domain';
import styles from './MatchClock.module.css';
import { subscribeSecond } from './ticker';

/*
 * The match clock as text: the running minute ("58'", "90+3'") when live, "FT" when
 * finished, else the kick-off time (minLabel, luau:2470).
 *
 * A leaf subscriber (ARCHITECTURE §4.6): only this component listens to the 1 Hz ticker, so
 * the clock turning never re-renders its parent. It reads the time in its snapshot, and React
 * re-renders it only when the label itself changes, about once a minute. A clock that isn't
 * live doesn't listen at all.
 */

export type ClockMatch = Pick<Match, 'status' | 'clock' | 'kickoff'>;

export type MatchClockProps = Omit<HTMLAttributes<HTMLSpanElement>, 'children'> & {
  match: ClockMatch;
};

const idle = () => () => {};

export const MatchClock = memo(function MatchClock({ match, className, ...rest }: MatchClockProps) {
  const live = match.status === 'live';
  const label = useSyncExternalStore(live ? subscribeSecond : idle, () => minLabel(match, Date.now()));
  return (
    <span className={className ? `${styles.clock} ${className}` : styles.clock} {...rest}>
      {label}
    </span>
  );
});
