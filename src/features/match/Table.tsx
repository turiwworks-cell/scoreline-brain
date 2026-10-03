import { memo } from 'react';
import { m } from 'motion/react';
import type { League, Match, StandingRow, Team } from '../../domain';
import { CASCADE, cascade } from '../../motion';
import { useScoreline } from '../../store';
import { Crest, Glass } from '../../ui';
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
  const qn = league?.qualify ?? 0;
  const c = cascade('stats', { lift: 8 });
  return (
    <div className={styles.table}>
      <H4 left="Standings" right={name} />
      <div role="table" aria-label={`${name} standings`}>
        <div role="row" className={styles.head}>
          <span role="columnheader" className={styles.thPos}>
            #
          </span>
          <span role="columnheader" className={styles.thTeam}>
            Team
          </span>
          <span role="columnheader" className={styles.thP} aria-label="Played">
            P
          </span>
          <span role="columnheader" className={styles.thWdl} aria-label="Won, drawn, lost">
            W-D-L
          </span>
          <span role="columnheader" className={styles.thGd} aria-label="Goal difference">
            GD
          </span>
          <span role="columnheader" className={styles.thPts} aria-label="Points">
            Pts
          </span>
        </div>
        {rows.map((row, i) => (
          <div key={row.team} role="rowgroup">
            <m.div role="row" className={styles.row} variants={c} custom={i} {...CASCADE}>
              <TableRow row={row} pos={i + 1} q={i < qn} mine={row.team === match.home || row.team === match.away} team={teams[row.team]} />
            </m.div>
            {i + 1 === qn && i + 1 < rows.length && <div className={styles.cut} aria-hidden="true" />}
          </div>
        ))}
      </div>
      <div className={styles.legend}>
        {qn > 0 && (
          <>
            <span className={styles.legendBox} aria-hidden="true" />
            <span className={styles.legendLabel}>{league?.qualifyLabel}</span>
          </>
        )}
        <span className={styles.legendDot} aria-hidden="true" />
        <span className={styles.legendLive}>Playing now</span>
      </div>
    </div>
  );
});

function TableRow({ row, pos, q, mine, team }: { row: StandingRow; pos: number; q: boolean; mine: boolean; team: Team | undefined }) {
  const strong = q || mine;
  return (
    <>
      {q && <Glass radius={14} className={styles.glass} aria-hidden="true" />}
      <span role="cell" className={q ? styles.posQ : styles.pos}>
        {pos}
      </span>
      <span role="cell" className={styles.teamCell}>
        {team && <Crest team={team} size={18} className={styles.crest} />}
        <span className={styles.name} data-strong={strong ? '' : undefined}>
          {team?.name ?? row.team}
        </span>
        {row.live && <span className={styles.live} aria-label="Playing now" role="img" />}
      </span>
      <span role="cell" className={styles.p} data-strong={strong ? '' : undefined}>
        {row.p}
      </span>
      <span role="cell" className={styles.wdl} data-q={q ? '' : undefined}>
        {`${row.w}-${row.d}-${row.l}`}
      </span>
      <span role="cell" className={styles.gd} data-strong={strong ? '' : undefined}>
        {(row.gd > 0 ? '+' : '') + String(row.gd)}
      </span>
      <span role="cell" className={styles.pts} data-q={q ? '' : undefined}>
        {row.pts}
      </span>
    </>
  );
}
