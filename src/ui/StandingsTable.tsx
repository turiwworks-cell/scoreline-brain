import { useMemo } from 'react';
import { m } from 'motion/react';
import type { League, StandingRow, Team } from '../domain';
import { AT_REST, CASCADE, cascade, LANDED, slide, transition } from '../motion';
import { Crest } from './Crest';
import { Glass } from './Glass';
import styles from './StandingsTable.module.css';

/** The shared leagueRows view (luau:5713): features provide the data, never import each other. */
export function StandingsTable({
  rows,
  league,
  teams,
  highlighted = [],
  delay = 0,
}: {
  rows: readonly StandingRow[];
  league: League | undefined;
  teams: Readonly<Record<string, Team>>;
  highlighted?: readonly string[];
  /** Extra section stagger in seconds; match tables keep zero. */
  delay?: number;
}) {
  const name = league?.name ?? 'League';
  const qn = league?.qualify ?? 0;
  const c = useMemo(
    () =>
      delay === 0
        ? cascade('stats', { lift: 8 })
        : {
            hidden: { opacity: 0, transform: slide(0, 8) },
            shown: (index: number) => {
              const t = transition('stats', { index });
              return { opacity: 1, transform: AT_REST, transitionEnd: LANDED, transition: { ...t, delay: (t.delay as number) + delay } };
            },
          },
    [delay],
  );
  return (
    <>
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
            <m.div
              role="row"
              data-team={row.team}
              data-match-team={highlighted.includes(row.team) ? '' : undefined}
              className={styles.row}
              variants={c}
              custom={i}
              {...CASCADE}
            >
              <TableRow row={row} pos={i + 1} q={i < qn} mine={highlighted.includes(row.team)} team={teams[row.team]} />
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
    </>
  );
}

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
