import { useCallback, useEffect, useMemo, useState } from 'react';
import { demoMode } from '../../data';
import type { PhotoOf } from './FollowCard';
import { selectDays, selectLiveMatchIds, selectLoaded, useScoreline } from '../../store';
import { DayTabs, type DayTab } from './DayTabs';
import { FeedContext, type Feed } from './feedContext';
import { BLOCK_CAP } from './cascade';
import { FollowSection } from './FollowSection';
import { followPref, type FollowPref } from './follow/pref';
import type { Followed } from './follow/model';
import { watchAppGoals } from './goalFeed';
import { Header } from './Header';
import { GroupShell, LeagueGroup } from './LeagueGroup';
import { LiveSection } from './LiveSection';
import { blocksIn, blockStarts, firstBlocks, mountedIn, useProgressiveBlocks } from './progressive';
import type { Group } from './groups';
import { groupsKey, selectGroups } from './selectors';
import { timing } from '../../motion';
import styles from './MatchList.module.css';

/*
 * The match list (drawListScreen, luau:4590): the header with the Live toggle and the day tabs, the
 * Live section when Live is on, the player you follow (on Today and Ongoing), then the day's
 * matches in groups: Favourites first, then one group per league. The screen it sits on owns
 * the scroll; this owns what is in it. It navigates only through the callbacks it is given.
 */

/** Two days back to two days ahead (DAYS, luau:1812). */
const SPAN = 2;
const FALLBACK_DAYS = ['2 days ago', 'Yesterday', 'Today', 'Tomorrow', 'In 2 days'];

export type MatchListProps = {
  /** the day tab as an offset from today (-2 … 2), and Ongoing */
  list: { readonly day: number; readonly live: boolean };
  /** the match open beside the list, if any */
  openId?: number;
  onDay: (day: number) => void;
  onLive: (on: boolean) => void;
  onOpenMatch: (id: number, from: Element) => void;
  onOpenPlayer: (p: Followed, from: Element) => void;
  /** opens the account sheet; absent until the sheet exists */
  onMenu?: () => void;
  /** a stand-in image for a team's followed player until the image pipeline is wired */
  photoOf?: PhotoOf;
  /** who is followed until someone else is chosen (the demo follows Argentina's 10) */
  defaultFollowed?: Followed | null;
  /** the follow preference; the app's own unless a test brings one */
  pref?: FollowPref;
};

export function MatchList({ list, openId, onDay, onLive, onOpenMatch, onOpenPlayer, onMenu, photoOf, defaultFollowed = null, pref }: MatchListProps) {
  const days = useScoreline(selectDays);
  const loaded = useScoreline(selectLoaded);
  const liveCount = useScoreline(selectLiveMatchIds).length;
  const groups = useScoreline(selectGroups(groupsKey(list)));
  const followRef = useMemo(() => pref ?? followPref(defaultFollowed), [pref, defaultFollowed]);

  useEffect(() => watchAppGoals(), []);

  // the cascade: a day change moves the epoch; blocks that mount while it plays start hidden
  const [feed, setFeed] = useState<Feed>({ epoch: 0, dir: 1, fresh: false });
  useEffect(() => {
    if (!feed.fresh) return;
    const t = timing('list');
    const ms = (t.duration + t.delay + t.stagger * BLOCK_CAP) * 1000 + 100;
    const id = setTimeout(() => setFeed((f) => ({ ...f, fresh: false })), ms);
    return () => clearTimeout(id);
  }, [feed.epoch, feed.fresh]);

  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(() => new Set());
  const toggle = useCallback((key: string) => {
    setCollapsed((s) => {
      const next = new Set(s);
      if (!next.delete(key)) next.add(key);
      return next;
    });
  }, []);

  const labels = days.length === SPAN * 2 + 1 ? days : FALLBACK_DAYS;
  const tabs: DayTab[] = labels.map((label, i) => ({ id: String(i - SPAN), label }));
  const changeDay = (id: string) => {
    const day = Number(id);
    // a day tab always plays the cascade, toward the side the day lies on (setDay, luau:7175)
    setFeed((f) => ({ epoch: f.epoch + 1, dir: day > list.day ? 1 : -1, fresh: true }));
    onDay(day);
  };

  const showFollow = loaded && (list.live || list.day === 0);

  return (
    <FeedContext.Provider value={feed}>
      <div className={styles.page} data-live={list.live ? '' : undefined}>
        <div className={styles.top}>
          <Header on={list.live} count={liveCount} onToggle={() => onLive(!list.live)} onMenu={onMenu} />
          <div className={styles.tabs}>
            <DayTabs items={tabs} value={String(list.day)} morph="0" live={list.live} onChange={changeDay} />
          </div>
        </div>
        <div className={styles.body}>
          <LiveSection open={list.live} openId={openId} onOpen={onOpenMatch} />
          {loaded && <FollowSection pref={followRef} index={0} shown={showFollow} onOpenPlayer={onOpenPlayer} photoOf={photoOf} />}
          {!loaded ? (
            <NoData />
          ) : groups.length === 0 ? (
            <div className={styles.empty}>
              <p className={styles.emptyTitle}>{list.live ? 'Nothing in play.' : 'Nothing scheduled.'}</p>
              <p className={styles.emptyHint}>{list.live ? 'Check back soon' : 'Pick another date'}</p>
            </div>
          ) : (
            <Groups groups={groups} start={showFollow ? 1 : 0} listKey={groupsKey(list)} collapsed={collapsed} onToggle={toggle} openId={openId} onOpen={onOpenMatch} />
          )}
        </div>
      </div>
    </FeedContext.Provider>
  );
}

type GroupsProps = {
  groups: readonly Group[];
  /** the cascade index of the first group's header: the follow card, when shown, is block 0 */
  start: number;
  /** the day, or Live: a different one mounts the whole new list at once (progressive.ts) */
  listKey: string;
  collapsed: ReadonlySet<string>;
  onToggle: (key: string) => void;
  openId?: number;
  onOpen: (id: number, from: Element) => void;
};

/** The league groups. Owns the slicing (progressive.ts), so a slice renders these and nothing around them. */
function Groups({ groups, start, listKey, collapsed, onToggle, openId, onOpen }: GroupsProps) {
  const first = useMemo(() => firstBlocks(groups, typeof window === 'undefined' ? 800 : window.innerHeight), [groups]);
  const budget = useProgressiveBlocks(blocksIn(groups), first, listKey);
  const mounted = mountedIn(groups, budget);
  const starts = blockStarts(groups, start);
  return groups.map((g, i) => {
    const blocks = mounted[i]!;
    if (blocks === 0) return <GroupShell key={g.key} groupKey={g.key} count={g.ids.length} />;
    return <LeagueGroup key={g.key} groupKey={g.key} ids={g.ids} index={starts[i]!} collapsed={collapsed.has(g.key)} onToggle={onToggle} openId={openId} onOpen={onOpen} rows={blocks - 1 < g.ids.length ? blocks - 1 : undefined} />;
  });
}

function NoData() {
  // no ApiSource is wired yet (Part 22): without ?demo nothing will arrive
  if (typeof window !== 'undefined' && demoMode(window.location.search)) return <p className={styles.nodata}>Loading the demo…</p>;
  return (
    <p className={styles.nodata}>
      No matches yet.
      <br />
      <a href="/?demo">Play the demo matchday</a>
    </p>
  );
}
