import { useCallback, useEffect, useState } from 'react';
import { m } from 'motion/react';
import { AccountSheet, CHEST_SIZES, followPref, MatchList, useFollowed } from '../../features/matchList';
import type { Team } from '../../domain';
import { pushBase } from '../../motion';
import { playerPhoto, usePhotoManifest, warmPhoto } from '../../ui';
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
  // the follow card shows the followed player's bust when the manifest has one (Part 8's files)
  const manifest = usePhotoManifest().manifest;
  const photoOf = useCallback((team: Team, n: number) => playerPhoto(manifest, team.id, n), [manifest]);
  // That bust is the largest thing the first screen draws, and the card waits for the first data;
  // its file starts with the manifest instead, so it is there when the card is (Part 21, #4).
  const followed = useFollowed(followPref(demoFollowed()));
  const chest = followed ? playerPhoto(manifest, followed.team, followed.n) : undefined;
  useEffect(() => {
    if (chest) warmPhoto(chest, CHEST_SIZES);
  }, [chest]);
  // the account sheet rises over the list: the whole phone screen, the list pane on desktop (luau:7055)
  const [sheet, setSheet] = useState(false);
  const openSheet = useCallback(() => setSheet(true), []);
  const closeSheet = useCallback(() => setSheet(false), []);
  return (
    <m.div className={layout === 'phone' ? styles.base : styles.pane} data-pane="list" variants={pushBase} initial={false} animate={shifted ? 'covered' : 'rest'}>
      <Screen pane="list" contentKey={`${list.day}|${list.live ? 'live' : ''}`} label="Matches" covered={covered || sheet}>
        <MatchList
          list={list}
          openId={openId}
          onDay={nav.setDay}
          onLive={nav.setLive}
          onOpenMatch={(id, from) => nav.openMatch(id, { from })}
          onOpenPlayer={(player, from) => nav.openPlayer(player, { from })}
          onMenu={openSheet}
          defaultFollowed={demoFollowed()}
          photoOf={photoOf}
        />
      </Screen>
      <AccountSheet open={sheet} onClose={closeSheet} />
    </m.div>
  );
}
