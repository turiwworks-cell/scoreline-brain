import { useCallback, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from 'react';
import { m } from 'motion/react';
import { CASCADE, cascade, transition, useAfterPaint } from '../../motion';
import type { Side } from '../../domain';
import { selectLeague, selectMatch, selectTeam, useScoreline } from '../../store';
import { Icon, RoundButton, Tabs } from '../../ui';
import { Facts } from './Facts';
import { DETAIL_TABS, type DetailTab } from './tabs';
import { Hero } from './Hero';
import { Lineup } from './lineup';
import { Stats } from './Stats';
import { Table } from './Table';
import styles from './MatchDetail.module.css';

/*
 * The match screen (drawDetailScreen, luau:5781): a bar that stays (back, the league, the
 * favourite), then the hero, the tab bar and the open tab, all scrolling under the bar. The hero,
 * the tab bar and the pane come in one after another (blockIn, motion: screen); switching tabs
 * slides the new pane in from the side the tab lies on (motion: tabs). The tab bar answers in the
 * tap's frame; the pane's body renders after that paint (useAfterPaint, Part 21 #3).
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
  /** the player the user follows: a star by his name in the line-up */
  followed?: { readonly team: string; readonly n: number } | null;
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

/**
 * The width the screen lays out at: the Lua's 390 until the first measure. `mounted` is whether the
 * element is in the tree: before the feed has the match the screen renders `missing` instead, and
 * the element must be measured when it appears (a deep link on a pane wider than 390).
 */
function useWidth(ref: RefObject<HTMLElement | null>, mounted: boolean): number {
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
  }, [ref, mounted]);
  return w;
}

export function MatchDetail({ id, tab, chrome, onBack, onTab, onOpenPlayer, onFavourite, onReplayGoal, followed, missing }: MatchDetailProps) {
  const ref = useRef<HTMLDivElement>(null);
  const match = useScoreline(selectMatch(id));
  const home = useScoreline(selectTeam(match?.home ?? ''));
  const away = useScoreline(selectTeam(match?.away ?? ''));
  const width = useWidth(ref, !!match && !!home && !!away);
  const league = useScoreline(selectLeague(match?.league ?? ''));

  // the open tab's body, a render after the tap (null on the screen's first frame)
  const shown = useAfterPaint(tab);
  // the pane slides in from the side of the tab it came from (paneDir, luau:7162); the first body
  // comes in with the screen's cascade
  const [pane, setPane] = useState({ tab: shown, dir: 0, first: true });
  if (pane.tab !== shown && shown) setPane({ tab: shown, dir: pane.tab && DETAIL_TABS.indexOf(shown) > DETAIL_TABS.indexOf(pane.tab) ? 1 : -1, first: !pane.tab });

  // the side the Lineup tab shows lasts while the match is open, whichever tab is (luSide, luau:7139)
  const [lineupSide, setLineupSide] = useState<{ id: number; side: Side }>({ id, side: 'home' });
  if (lineupSide.id !== id) setLineupSide({ id, side: 'home' });
  const onSide = useCallback((side: Side) => setLineupSide({ id, side }), [id]);

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
        {shown && (
          <m.div
            key={shown}
            initial={first ? false : { opacity: 0, x: 24 * dir }}
            animate={{ opacity: 1, x: 0, transition: transition('tabs', { index: 1 }) }}
          >
            {shown === 'facts' ? (
              <Facts match={match} home={home} away={away} league={league} width={width} onReplayGoal={onReplayGoal} />
            ) : shown === 'stats' ? (
              <Stats match={match} home={home} away={away} />
            ) : shown === 'lineup' ? (
              <Lineup match={match} home={home} away={away} width={width} side={lineupSide.side} onSide={onSide} followed={followed} onOpenPlayer={onOpenPlayer} />
            ) : (
              <Table match={match} league={league} />
            )}
          </m.div>
        )}
      </m.div>
    </div>
  );
}
