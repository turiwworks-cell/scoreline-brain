import { memo, useRef, type CSSProperties } from 'react';
import { scoreStr, type Match, type Team } from '../../domain';
import { Crest, feel, MatchClock } from '../../ui';
import type { GoalFeed } from './goalFeed';
import { useRowFrames } from './rowFrames';
import styles from './Groups.module.css';

/*
 * One match in the list (drawRow, luau:3925–3966): its minute (green with a dot while live, the
 * kick-off time otherwise), both teams' crests and names, and the score on the right once it has
 * started. The side that is behind steps back to grey. A fresh goal flashes the row and the new
 * number takes the spectrum for a while.
 */

export type MatchRowProps = {
  match: Match;
  home: Team;
  away: Team;
  /** the match is open beside the list */
  current: boolean;
  onOpen: (el: Element) => void;
  feed?: GoalFeed;
};

export const MatchRow = memo(function MatchRow({ match, home, away, current, onOpen, feed }: MatchRowProps) {
  const ref = useRef<HTMLButtonElement>(null);
  useRowFrames(ref, match.id, feed);
  const started = match.status !== 'scheduled';
  const [h, a] = match.score;
  const live = match.status === 'live';
  const label = `${home.name} ${started ? scoreStr(h, a) : 'v'} ${away.name}`;
  const trails = [started && h < a, started && a < h];
  return (
    <button
      ref={ref}
      type="button"
      className={`m-feel ${styles.row}`}
      data-focus-key={`match-${match.id}`}
      aria-label={label}
      aria-current={current ? 'true' : undefined}
      onClick={(e) => onOpen(e.currentTarget)}
      {...feel}
    >
      {live && <span className={styles.dot} aria-hidden="true" />}
      <span className={styles.time} data-live={live ? '' : undefined} aria-hidden="true">
        <MatchClock match={match} />
      </span>
      {[home, away].map((team, i) => (
        <span key={i} className={styles.team} style={{ top: 15 + i * 29 }} data-trails={trails[i] ? '' : undefined} aria-hidden="true">
          <span className={styles.crestEnd}>
            <Crest team={team} size={16} />
          </span>
          <span className={styles.teamName}>{team.name}</span>
        </span>
      ))}
      {started && (
        <span className={styles.scores}>
          {[h, a].map((v, i) => (
            <span key={i} className={styles.score} data-trails={trails[i] ? '' : undefined} style={{ ['--bump' as string]: `var(--bump-${i === 0 ? 'h' : 'a'}, 1)`, ['--mk' as string]: `var(--mk-${i === 0 ? 'h' : 'a'}, 0)` } as CSSProperties}>
              <span className={styles.pop}>
                <span className={styles.ink}>{v}</span>
                <span className={styles.spectrum} aria-hidden="true">
                  {v}
                </span>
              </span>
            </span>
          ))}
        </span>
      )}
    </button>
  );
});
