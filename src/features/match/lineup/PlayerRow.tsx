import { memo } from 'react';
import { m, useReducedMotion } from 'motion/react';
import type { Player, Team } from '../../../domain';
import { AT_REST, LANDED, slide, transition } from '../../../motion';
import { EventTags, PhotoTile, RatingBadge, Star, Tag, textWidth, useFontVersion, withFeel, type PhotoSources } from '../../../ui';
import { fullName, roleOf, type Marks } from './model';
import styles from './Lineup.module.css';

/*
 * A list row (playerRow, luau:5504), 64 tall: his photo tile, the number beside it, his name
 * and role, and what happened to him as tags. Substitutes who came on show the minute, the
 * rating and who they replaced; the others "Unused". Before kick-off it is just the squad.
 */

const measure = (size: number, s: string) => textWidth(600, size, 0, s);

export type PlayerRowProps = {
  team: Team;
  n: number;
  player: Player | undefined;
  /** a short name for the player the squad doesn't know */
  name: string;
  /** the name of the shirt he replaced, when he came on */
  replaced: string | undefined;
  marks: Marks | undefined;
  rating: number;
  followed: boolean;
  photo: PhotoSources | undefined;
  /** what happened to him in the match: false before kick-off */
  showMatch: boolean;
  /** the match has started (an unused substitute is "Unused") */
  started: boolean;
  /** place in the section: starts the entrance this many steps after the first (motion: squad) */
  index: number;
  hold: boolean;
  onOpen: (n: number, from: Element) => void;
};

export const PlayerRow = memo(function PlayerRow({ team, n, player, name, replaced, marks, rating, followed, photo, showMatch, started, index, hold, onOpen }: PlayerRowProps) {
  useFontVersion();
  const reduce = useReducedMotion() === true;
  const full = fullName(player, name);
  // S 15, shrunk to fit 190 px (fit, luau:1634)
  const w = measure(15, full);
  const size = w <= 190 || w <= 0 ? 15 : (15 * 190) / w;
  const enter = { opacity: 1, transform: AT_REST, transitionEnd: LANDED, transition: transition('squad', { index }) };
  const on = marks?.on;

  return (
    <m.div initial={reduce ? false : { opacity: 0, transform: slide(0, 10) }} animate={hold && !reduce ? { opacity: 0, transform: slide(0, 10) } : enter}>
      <button
        type="button"
        className={`m-feel ${styles.row}`}
        data-focus-key={`chip-${team.id}-${n}`}
        data-player={`${team.id}:${n}`}
        {...withFeel({ onClick: (e: { currentTarget: Element }) => onOpen(n, e.currentTarget) })}
      >
        <span className={styles.rowShared}>
          <PhotoTile size={52} team={team} n={n} src={photo?.src} srcSet={photo?.srcSet} sources={photo?.sources} alt="" loading="lazy" />
        </span>
        {photo && <span className={styles.rowNum}>{n}</span>}
        <span className={styles.rowName}>
          <span className={styles.rowFull} style={{ fontSize: size }}>
            {full}
          </span>
          {followed && <Star className={styles.rowStar} />}
          {showMatch && marks && (marks.goals > 0 || marks.assists > 0 || marks.yellow || marks.red) && (
            <EventTags className={styles.rowTags} goals={marks.goals} assists={marks.assists} yellow={marks.yellow} red={marks.red} />
          )}
        </span>
        <span className={styles.rowRole}>{roleOf(player)}</span>
        {showMatch && on !== undefined && (
          <>
            <span className={styles.rowOn}>
              <Tag kind="subIn" size={13} />
              <span className={styles.rowMin}>{on}'</span>
              {rating > 0 && <RatingBadge value={rating} className={styles.rowRating} />}
            </span>
            {replaced && <span className={styles.rowFor}>for {replaced}</span>}
          </>
        )}
        {showMatch && on === undefined && started && <span className={styles.rowUnused}>Unused</span>}
        <span className={styles.rowRule} aria-hidden="true" />
      </button>
    </m.div>
  );
});
