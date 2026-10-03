import { memo } from 'react';
import { playerKey, type Match, type Team } from '../../domain';
import { Shared, sharedPlayer } from '../../motion';
import { selectMatch, selectPlayer, selectTeam, useScoreline } from '../../store';
import { PhotoTile, withFeel } from '../../ui';
import { useNav } from '../nav/useNav';
import { placeholderBust } from './placeholderBust';
import styles from './placeholder.module.css';

const XI = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];

/**
 * The Lineup tab until Part 13 builds the pitch: each side's eleven as faces that open the
 * player (face → bust), as the Part 9 placeholder had them.
 */
export function LineupPlaceholder({ id }: { id: number }) {
  const m = useScoreline(selectMatch(id));
  const home = useScoreline(selectTeam(m?.home ?? ''));
  const away = useScoreline(selectTeam(m?.away ?? ''));
  if (!m || !home || !away) return null;
  return (
    <div className={styles.lineup} data-part="13">
      <LineupSide match={m} team={home} xi={m.lineups?.home?.xi ?? XI} />
      <LineupSide match={m} team={away} xi={m.lineups?.away?.xi ?? XI} />
    </div>
  );
}

function LineupSide({ match, team, xi }: { match: Match; team: Team; xi: readonly number[] }) {
  return (
    <div>
      <h2 className={styles.label}>{team.short}</h2>
      <ul className={styles.chips}>
        {xi.map((n) => (
          <li key={n}>
            <LineupChip matchId={match.id} team={team} n={n} />
          </li>
        ))}
      </ul>
    </div>
  );
}

const LineupChip = memo(function LineupChip({ matchId, team, n }: { matchId: number; team: Team; n: number }) {
  const nav = useNav();
  const p = useScoreline(selectPlayer(playerKey(team.id, n)));
  return (
    <button
      type="button"
      className={`m-feel m-fade ${styles.chip}`}
      data-focus-key={`chip-${team.id}-${n}`}
      {...withFeel({ onClick: (e: { currentTarget: Element }) => nav.openPlayer({ team: team.id, n }, { under: { id: matchId, tab: 'lineup' }, from: e.currentTarget }) })}
    >
      <Shared id={sharedPlayer(team.id, n)} end="face">
        <PhotoTile size={40} team={team} n={n} src={placeholderBust(team)} alt="" />
      </Shared>
      <span className={styles.chipName}>
        {n} {p?.short ?? ''}
      </span>
    </button>
  );
});
