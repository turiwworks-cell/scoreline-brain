import { memo, useId, useMemo, type CSSProperties } from 'react';
import type { Match, Team } from '../../domain';
import { Icon, Star } from '../../ui';
import { selectLeague, selectMatch, selectTeam, useScoreline } from '../../store';
import { Block } from './cascade';
import { FAV } from './groups';
import type { GoalFeed } from './goalFeed';
import { MatchRow } from './MatchRow';
import styles from './Groups.module.css';

/*
 * A collapsible group of matches (drawGroup, luau:3987–4044): "Favourites" with the spectrum star,
 * or a league (its country in grey, its name in white), the number of matches, a chevron, and under
 * a rule the matches. Each header and each row is a block of the day-change cascade.
 */

export type LeagueGroupProps = {
  groupKey: string;
  ids: readonly number[];
  /** the index of the group's header among the list's blocks; its rows follow it */
  index: number;
  collapsed: boolean;
  onToggle: (key: string) => void;
  openId?: number;
  onOpen: (id: number, from: Element) => void;
  feed?: GoalFeed;
};

export const LeagueGroup = memo(function LeagueGroup({ groupKey, ids, index, collapsed, onToggle, openId, onOpen, feed }: LeagueGroupProps) {
  const league = useScoreline(selectLeague(groupKey));
  const fav = groupKey === FAV;
  const rows = useId();
  const style = { '--full': ids.length * 76 } as CSSProperties;
  return (
    <div className={styles.group} data-collapsed={collapsed ? '' : undefined} data-group={groupKey} style={style}>
      <Block index={index} className={styles.head}>
        <button type="button" className={`m-feel ${styles.toggle}`} aria-expanded={!collapsed} aria-controls={rows} onClick={() => onToggle(groupKey)}>
          {fav ? (
            <>
              <Star className={styles.star} />
              <span className={`${styles.label} ${styles.name} ${styles.favTitle}`}>Favourites</span>
            </>
          ) : (
            <Titles country={league?.country ?? ''} name={league?.name ?? groupKey} />
          )}
          <span className={`${styles.label} ${styles.num}`}>{ids.length}</span>
          <Icon name="chev" className={styles.chev} style={{ color: 'var(--c-muted)' }} />
        </button>
        <span className={styles.rule} aria-hidden="true" />
      </Block>
      <div id={rows} className={styles.rows} role="list" inert={collapsed}>
        {ids.map((id, i) => (
          <Block key={id} index={index + 1 + i} className={styles.place} style={{ '--top': i * 76 } as CSSProperties}>
            <div className={styles.slot} role="listitem">
              <Row id={id} current={id === openId} onOpen={onOpen} feed={feed} />
            </div>
          </Block>
        ))}
      </div>
    </div>
  );
});

function Titles({ country, name }: { country: string; name: string }) {
  return (
    <span className={styles.titles}>
      <span className={`${styles.label} ${styles.country}`}>{country}</span>
      <span className={`${styles.label} ${styles.name}`}>{name}</span>
    </span>
  );
}

const Row = memo(function Row({ id, current, onOpen, feed }: { id: number; current: boolean; onOpen: (id: number, from: Element) => void; feed?: GoalFeed }) {
  const match = useScoreline(selectMatch(id)) as Match | undefined;
  const home = useScoreline(selectTeam(match?.home ?? '')) as Team | undefined;
  const away = useScoreline(selectTeam(match?.away ?? '')) as Team | undefined;
  const open = useMemo(() => (el: Element) => onOpen(id, el), [id, onOpen]);
  if (!match || !home || !away) return null;
  return <MatchRow match={match} home={home} away={away} current={current} onOpen={open} feed={feed} />;
});
