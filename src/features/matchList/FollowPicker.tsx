import { memo, useMemo, type CSSProperties } from 'react';
import { playerKey, type Team } from '../../domain';
import { selectTeam, useScoreline } from '../../store';
import { feel, PlayerPhoto, RollLabel, textWidth, useFontVersion } from '../../ui';
import { fitSize } from './cardLayout';
import { knownPicks } from './follow/cells';
import { sameFollowed, type Followed } from './follow/model';
import { selectPlayers } from './selectors';
import styles from './Follow.module.css';

/*
 * The picker (followPicker, luau:4086): a glass panel with a title, a line under it, and six
 * quick picks as glass chips with the player's head cut out on the left. The chosen one wears a
 * ring. Following someone shows "Unfollow" at the top right.
 */

export type FollowPickerProps = {
  followed: Followed | null;
  /** opened with Change: the chips come in one after another */
  staged: boolean;
  onPick: (f: Followed) => void;
  onUnfollow: () => void;
  photoOf?: (team: Team) => string | undefined;
};

export function FollowPicker({ followed, staged, onPick, onUnfollow, photoOf }: FollowPickerProps) {
  const players = useScoreline(selectPlayers);
  const picks = useMemo(() => knownPicks(players), [players]);
  return (
    <div className={`m-glass ${styles.picker}`}>
      <h3 className={styles.pickTitle}>Follow a player</h3>
      <p className={styles.pickSub}>Live touches, stats and every goal, right here.</p>
      {followed && (
        <button type="button" className={`m-feel ${styles.unfollow}`} onClick={onUnfollow} {...feel}>
          <span className={styles.label}>Unfollow</span>
        </button>
      )}
      <div className={styles.chips}>
        {picks.map((p, i) => (
          <Chip key={`${p.team}:${p.n}`} pick={p} index={i} on={sameFollowed(p, followed)} staged={staged} onPick={onPick} photoOf={photoOf} />
        ))}
      </div>
    </div>
  );
}

const Chip = memo(function Chip({ pick, index, on, staged, onPick, photoOf }: { pick: Followed; index: number; on: boolean; staged: boolean; onPick: (f: Followed) => void; photoOf?: (team: Team) => string | undefined }) {
  const team = useScoreline(selectTeam(pick.team)) as Team | undefined;
  const players = useScoreline(selectPlayers);
  useFontVersion();
  const player = players[playerKey(pick.team, pick.n)];
  if (!team || !player) return null;
  const name = player.short;
  // the name shrinks to fit beside the face (fit, luau:4113)
  const size = fitSize(12.5, textWidth(600, 12.5, 0, name), 66);
  return (
    <button
      type="button"
      className={`m-glass m-feel m-dip ${styles.chip}`}
      aria-pressed={on}
      data-staged={staged ? '' : undefined}
      style={{ '--i': index, '--fit': size } as CSSProperties}
      onClick={() => onPick(pick)}
      {...feel}
    >
      <span className={styles.face}>
        <PlayerPhoto team={team} n={pick.n} width={28} src={photoOf?.(team)} alt="" />
      </span>
      <span className={styles.chipName}>
        <RollLabel text={name} />
      </span>
    </button>
  );
});
