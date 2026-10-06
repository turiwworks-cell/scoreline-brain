import { memo } from 'react';
import { m, useReducedMotion } from 'motion/react';
import type { Player, Team } from '../../../domain';
import { snapPx, transition } from '../../../motion';
import { EventTags, Glass, KitDisc, PlayerPhoto, RatingBadge, Star, SubOffTag, textWidth, useFontVersion, withFeel, type PhotoSources } from '../../../ui';
import { PITCH, type Slot } from './formation';
import type { Marks } from './model';
import styles from './Lineup.module.css';

/*
 * One player on the pitch (pitchMarker, luau:5384): his photo stands behind a small glass name
 * plate. Tags sit on the photo like stickers: rating top right, the off capsule top left, goals
 * and assists bottom right, cards bottom left. Without a photo the shirt number on a kit disc
 * stands in, and the plate leaves the number out. A sent-off player is drawn at half strength.
 */

const nameWidth = (size: number, s: string) => textWidth(600, size, 0, s);
const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi);

/** The size ≤ `size` at which `s` fits in `maxW` (fit, luau:1634). */
function fit(s: string, size: number, maxW: number): number {
  const w = nameWidth(size, s);
  return w <= maxW || w <= 0 ? size : (size * maxW) / w;
}

export type MarkerProps = {
  team: Team;
  slot: Slot;
  player: Player | undefined;
  /** the squad's shirt name, or "#7" */
  name: string;
  marks: Marks | undefined;
  rating: number;
  best: boolean;
  followed: boolean;
  /** his photo files; absent = the kit disc */
  photo: PhotoSources | undefined;
  /** the entrance waits until the photo files are known (they are not for the first screen to ask) */
  hold: boolean;
  onOpen: (n: number, from: Element) => void;
};

export const Marker = memo(function Marker({ team, slot, name, marks, rating, best, followed, photo, hold, onOpen, player }: MarkerProps) {
  useFontVersion();
  const reduce = useReducedMotion() === true;
  const { n, maxW } = slot;
  const sentOff = marks?.red === true;
  const num = String(n);
  // the plate: [star] [number] name, as wide as it needs, between FACE + 8 and the row's room
  const numW = photo ? nameWidth(10.5, num) : -5;
  const size = fit(name, 11.5, maxW - numW - 22 - (followed ? 13 : 0));
  const inner = numW + 5 + nameWidth(size, name) + (followed ? 13 : 0);
  const w = clamp(inner + 18, PITCH.face + 8, maxW);

  // forwards first, then midfield, defence and the keeper (motion: lineup)
  const enter = { opacity: 1, y: 0, transition: transition('lineup', { index: slot.fromTop + (slot.index - 1) * 0.25 }) };
  const label = `${num} ${player?.short ?? name}`;

  return (
    <m.div
      className={styles.slot}
      style={{ left: slot.x - 38, top: slot.y - 65 }}
      initial={reduce ? false : { opacity: 0, y: 26 }}
      animate={hold && !reduce ? { opacity: 0, y: 26 } : enter}
      transformTemplate={snapPx}
      data-row={slot.row}
    >
      <button
        type="button"
        className={`m-feel ${styles.marker}`}
        data-focus-key={`chip-${team.id}-${n}`}
        data-player={`${team.id}:${n}`}
        aria-label={label}
        {...withFeel({ onClick: (e: { currentTarget: Element }) => onOpen(n, e.currentTarget) })}
      >
        <span className={styles.markerBody} data-sent-off={sentOff ? '' : undefined}>
          {photo ? (
            <span className={styles.face}>
              <PlayerPhoto team={team} n={n} width={PITCH.face} src={photo.src} srcSet={photo.srcSet} sources={photo.sources} alt="" loading="eager" />
            </span>
          ) : (
            <span className={styles.kit}>
              <KitDisc team={team} n={n} size={38} />
            </span>
          )}
          <Glass radius={PITCH.plate / 2} className={styles.plate} style={{ left: 38 - w / 2, width: w, ['--plate-x' as string]: `${38 - w / 2}px` }}>
            {followed && <Star className={styles.pstar} />}
            {photo && <span className={styles.pnum}>{num}</span>}
            <span className={styles.pname} style={{ fontSize: size }}>
              {name}
            </span>
          </Glass>
          {rating > 0 && <RatingBadge value={rating} best={best} className={styles.rating} />}
          {marks?.off !== undefined && <SubOffTag minute={marks.off} className={styles.off} />}
          {marks && (marks.goals > 0 || marks.assists > 0) && <EventTags goals={marks.goals} assists={marks.assists} className={styles.goals} />}
          {marks && (marks.yellow || marks.red) && <EventTags yellow={marks.yellow} red={marks.red} className={styles.cards} />}
        </span>
      </button>
    </m.div>
  );
});
