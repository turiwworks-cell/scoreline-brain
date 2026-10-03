import { m } from 'motion/react';
import { MatchList } from '../../features/matchList';
import { pushBase } from '../../motion';
import { demoFollowed } from '../followed';
import { useNav } from '../nav/useNav';
import type { ListState } from '../nav/url';
import type { LayoutMode } from './layoutMode';
import { Screen } from './Screen';
import styles from './Shell.module.css';

/**
 * The match list. The shell renders it first, with the same key, in every layout, so it never
 * unmounts: not on navigation, not on a resize across breakpoints (ARCHITECTURE §5). It keeps its
 * scroll position for free. On the phone it is the base; on tablet and desktop the first pane.
 */
export function ListPane({ layout, shifted, covered, list, openId }: { layout: LayoutMode; shifted: boolean; covered: boolean; list: ListState; openId?: number }) {
  const nav = useNav();
  return (
    <m.div className={layout === 'phone' ? styles.base : styles.pane} data-pane="list" variants={pushBase} initial={false} animate={shifted ? 'covered' : 'rest'}>
      <Screen pane="list" contentKey={`${list.day}|${list.live ? 'live' : ''}`} label="Matches" covered={covered}>
        <MatchList
          list={list}
          openId={openId}
          onDay={nav.setDay}
          onLive={nav.setLive}
          onOpenMatch={(id, from) => nav.openMatch(id, { from })}
          onOpenPlayer={(player, from) => nav.openPlayer(player, { from })}
          defaultFollowed={demoFollowed()}
        />
      </Screen>
    </m.div>
  );
}
