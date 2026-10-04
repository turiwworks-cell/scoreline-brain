import { memo, useMemo, type CSSProperties } from 'react';
import { playerKey, type Team } from '../../domain';
import { selectTeam, useScoreline } from '../../store';
import { feel, Icon, KitDisc, photoProps, PlayerPhoto, RollLabel, textWidth, useFontVersion } from '../../ui';
import type { PhotoOf } from './FollowCard';
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
  photoOf?: PhotoOf;
  /**
   * With nobody followed the picker folds like the follow card does: to 64 px, its title and line
   * only, behind the same round button (review of 2026-10-04). Absent: always open (Change).
   */
  fold?: { open: boolean; onToggle: () => void };
};

export function FollowPicker({ followed, staged, onPick, onUnfollow, photoOf, fold }: FollowPickerProps) {
  const players = useScoreline(selectPlayers);
  const picks = useMemo(() => knownPicks(players), [players]);
  const open = fold?.open ?? true;
  return (
    <div className={`m-glass ${styles.picker}`} data-open={open}>
      <h3 className={styles.pickTitle}>Follow a player</h3>
      <p className={styles.pickSub}>Live touches, stats and every goal, right here.</p>
      {followed && (
        <button type="button" className={`m-feel ${styles.unfollow}`} onClick={onUnfollow} {...feel}>
          <span className={styles.label}>Unfollow</span>
        </button>
      )}
      {fold && (
        <button type="button" className={`m-glass m-feel m-dip ${styles.toggle}`} aria-label={open ? 'Show less' : 'Choose a player'} aria-expanded={open} onClick={fold.onToggle} {...feel}>
          <Icon name="chevUp" />
        </button>
      )}
      <div className={styles.chips} inert={!open}>
        {picks.map((p, i) => (
          <Chip key={`${p.team}:${p.n}`} pick={p} index={i} on={sameFollowed(p, followed)} staged={staged} onPick={onPick} photoOf={photoOf} />
        ))}
      </div>
    </div>
  );
}

const Chip = memo(function Chip({ pick, index, on, staged, onPick, photoOf }: { pick: Followed; index: number; on: boolean; staged: boolean; onPick: (f: Followed) => void; photoOf?: PhotoOf }) {
  const team = useScoreline(selectTeam(pick.team)) as Team | undefined;
  const players = useScoreline(selectPlayers);
  useFontVersion();
  const player = players[playerKey(pick.team, pick.n)];
  if (!team || !player) return null;
  const files = photoOf?.(team, pick.n);
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
      {/* his head inside the rim, so the rim reads the same over a shirt as over the glass; his
          shoulders run on to the chip's round end. Without a photo, his number on a disc centred
          where his head would be (review of 2026-10-04: photos and discs line up). */}
      <span className={styles.faceClip}>
        {files ? (
          <PlayerPhoto team={team} n={pick.n} width={28} shoulders={24} className={styles.face} {...photoProps(files)} alt="" />
        ) : (
          <KitDisc team={team} n={pick.n} size={20} className={styles.disc} />
        )}
      </span>
      <span className={styles.chipName}>
        <RollLabel text={name} />
      </span>
    </button>
  );
});
