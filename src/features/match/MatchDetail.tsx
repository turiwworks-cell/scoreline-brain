import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from 'react';
import { m } from 'motion/react';
import { CASCADE, cascade, transition } from '../../motion';
import { selectLeague, selectMatch, selectTeam, useScoreline } from '../../store';
import { Icon, RoundButton, Tabs } from '../../ui';
import { Facts } from './Facts';
import { DETAIL_TABS, type DetailTab } from './tabs';
import { Hero } from './Hero';
import { Stats } from './Stats';
import { Table } from './Table';
import styles from './MatchDetail.module.css';

/*
 * The match screen (drawDetailScreen, luau:5781): a bar that stays (back, the league, the
 * favourite), then the hero, the tab bar and the open tab, all scrolling under the bar. The hero,
 * the tab bar and the pane come in one after another (blockIn, motion: screen); switching tabs
 * slides the new pane in from the side the tab lies on (motion: tabs).
 *
 * Laid out at the pane's own width: every x of the Lua's 390 px screen is kept from the nearer
 * edge, so at 390 the numbers are the Lua's.
 */

export type MatchDetailProps = {
  id: number;
  tab: DetailTab;
  /** the phone's back button; panes beside the list have none (luau:5830) */
  chrome: 'back' | 'none';
  onBack?: () => void;
  onTab: (tab: DetailTab) => void;
  /** a scorer in the hero opens the player (luau:4801) */
  onOpenPlayer: (player: { team: string; n: number }, from: Element) => void;
  /** toggles the favourite; absent until favourites are kept as a preference */
  onFavourite?: () => void;
  /** a goal row replays the goal scene; absent until the scenes exist */
  onReplayGoal?: (eventId: string) => void;
  /** the Lineup tab's content until Part 13 builds it */
  lineup: ReactNode;
  /** shown when the match isn't in the feed */
  missing: ReactNode;
};

// TABS, luau:1814; the third reads Squad before kick-off (luau:5793)
const tabItems = (scheduled: boolean) => [
  { id: 'facts', label: 'Facts' },
  { id: 'stats', label: 'Stats' },
  { id: 'lineup', label: scheduled ? 'Squad' : 'Lineup' },
  { id: 'table', label: 'Table' },
];

const isTab = (v: string): v is DetailTab => (DETAIL_TABS as readonly string[]).includes(v);

/** The width the screen lays out at: the Lua's 390 until the first measure. */
function useWidth(ref: RefObject<HTMLElement | null>): number {
  const [w, setW] = useState(390);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const read = () => setW(el.clientWidth || 390);
    read();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return w;
}

export function MatchDetail({ id, tab, chrome, onBack, onTab, onOpenPlayer, onFavourite, onReplayGoal, lineup, missing }: MatchDetailProps) {
  const ref = useRef<HTMLDivElement>(null);
  const width = useWidth(ref);
  const match = useScoreline(selectMatch(id));
  const home = useScoreline(selectTeam(match?.home ?? ''));
  const away = useScoreline(selectTeam(match?.away ?? ''));
  const league = useScoreline(selectLeague(match?.league ?? ''));

  // the pane slides in from the side of the tab it came from (paneDir, luau:7162)
  const [pane, setPane] = useState({ tab, dir: 0, first: true });
  if (pane.tab !== tab) setPane({ tab, dir: DETAIL_TABS.indexOf(tab) > DETAIL_TABS.indexOf(pane.tab) ? 1 : -1, first: false });

  if (!match || !home || !away) return <>{missing}</>;
  const scheduled = match.status === 'scheduled';
  const c = cascade('screen');
  const idBase = `match-${match.id}`;
  const { dir, first } = pane;

  return (
    <div ref={ref} className={styles.page} style={{ '--w': `${width}px` } as CSSProperties}>
      <div className={styles.bar}>
        {chrome === 'back' && (
          <RoundButton aria-label="Back" className={styles.back} onClick={onBack}>
            <Icon name="back" />
          </RoundButton>
        )}
        <h1 className={styles.title} tabIndex={-1} data-screen-heading="">
          {home.name} – {away.name}
        </h1>
        <p className={styles.league}>{league ? `${league.country} · ${league.name}` : match.league}</p>
        <RoundButton
          aria-label="Favourite"
          aria-pressed={match.favourite}
          aria-disabled={onFavourite ? undefined : true}
          className={styles.fav}
          onClick={onFavourite}
        >
          <Icon name="follow" on={match.favourite} />
        </RoundButton>
      </div>

      <Hero match={match} home={home} away={away} matchday={league?.matchday ?? 1} width={width} onOpenPlayer={onOpenPlayer} />

      <m.div className={styles.tabs} variants={c} custom={3} {...CASCADE}>
        <Tabs items={tabItems(scheduled)} value={tab} onChange={(t) => isTab(t) && onTab(t)} aria-label="Match" idBase={idBase} />
      </m.div>

      <m.div className={styles.panel} variants={c} custom={4} {...CASCADE} role="tabpanel" id={`${idBase}-panel-${tab}`} aria-labelledby={`${idBase}-tab-${tab}`}>
        <m.div
          key={tab}
          initial={first ? false : { opacity: 0, x: 24 * dir }}
          animate={{ opacity: 1, x: 0, transition: transition('tabs', { index: 1 }) }}
        >
          {tab === 'facts' ? (
            <Facts match={match} home={home} away={away} league={league} width={width} onReplayGoal={onReplayGoal} />
          ) : tab === 'stats' ? (
            <Stats match={match} home={home} away={away} />
          ) : tab === 'lineup' ? (
            lineup
          ) : (
            <Table match={match} league={league} />
          )}
        </m.div>
      </m.div>
    </div>
  );
}
