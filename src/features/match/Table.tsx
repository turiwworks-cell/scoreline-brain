import { memo } from 'react';
import type { League, Match } from '../../domain';
import { useScoreline } from '../../store';
import { StandingsTable } from '../../ui/StandingsTable';
import { H4 } from './H4';
import { selectTable, selectTeams } from './selectors';
import styles from './Table.module.css';

/*
 * Table (standingsView and leagueRows, luau:5700): the league's standings with the qualifying
 * places on glass and numbered on the spectrum, both sides of the match in white, a pulsing dot
 * by a side that is playing now. Rows come in one after another (motion: stats, 8 px).
 */

export type TableProps = { match: Match; league: League | undefined };

export const Table = memo(function Table({ match, league }: TableProps) {
  const rows = useScoreline(selectTable(match.league));
  const teams = useScoreline(selectTeams);
  const name = league?.name ?? match.league;
  if (rows.length === 0) {
    return (
      <div className={styles.table}>
        <H4 left="Standings" right={name} />
        <div className={styles.none}>
          <p className={styles.noneTitle}>Friendlies have no table.</p>
          <p className={styles.noneNote}>Every result still counts for the FIFA ranking</p>
        </div>
      </div>
    );
  }
  return (
    <div className={styles.table}>
      <H4 left="Standings" right={name} />
      <StandingsTable rows={rows} league={league} teams={teams} highlighted={[match.home, match.away]} />
    </div>
  );
});
