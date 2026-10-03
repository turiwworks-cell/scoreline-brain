import { useRef, useState, useSyncExternalStore } from 'react';
import { useLocation } from 'react-router';
import { AnimatePresence, m } from 'motion/react';
import { paneSwap } from '../../motion';
import { cascade, CASCADE } from '../../motion';
import { Icon, RoundButton, Tabs } from '../../ui';
import { useNav } from '../nav/useNav';
import { scrollMemory } from '../nav/scrollMemory';
import { playerRevealVersion, subscribePlayerReveal } from '../nav/playerReveal';
import { playerKeyOf } from '../nav/url';
import { InsightsScreen } from '../screens/InsightsScreen';
import { PlayerScreen } from '../screens/PlayerScreen';
import { MatchPane } from './MatchPane';
import type { Resolved } from './resolve';
import { Screen } from './Screen';
import styles from './Shell.module.css';
import third from './ThirdPane.module.css';

const ITEMS = [
  { id: 'player', label: 'Player' },
  { id: 'tables', label: 'Tables' },
  { id: 'leaders', label: 'Leaders' },
] as const;
type DeskTab = (typeof ITEMS)[number]['id'];

/**
 * Desktop, ≥ 1200 px (ARCHITECTURE §6): list · match · third pane. The third pane shows the open
 * player or the local Tables/Leaders tab. Player is the default, including its empty prompt.
 */
export function ThreePane({ r }: { r: Resolved }) {
  const nav = useNav();
  const location = useLocation();
  const paneRef = useRef<HTMLDivElement>(null);
  const reveal = useSyncExternalStore(subscribePlayerReveal, playerRevealVersion, playerRevealVersion);
  const playerKey = r.player ? playerKeyOf(r.player) : null;
  const [view, setView] = useState<{ playerKey: string | null; tab: DeskTab; returnTab: DeskTab; reveal: number }>({
    playerKey,
    tab: 'player',
    returnTab: 'player',
    reveal,
  });
  // Adjust before child layout effects: a newly routed player's bust must be visible when
  // Shell measures its flight. A passive effect would reveal it one frame too late.
  const changedTab = r.player ? 'player' : view.tab === 'player' ? view.returnTab : view.tab;
  const revealChanged = reveal !== view.reveal && !!r.player;
  if (view.playerKey !== playerKey || reveal !== view.reveal) setView({ ...view, playerKey, reveal, tab: revealChanged ? 'player' : changedTab });
  const tab = revealChanged ? 'player' : view.playerKey !== playerKey ? changedTab : view.tab;
  const select = (next: string) => {
    if (!ITEMS.some((it) => it.id === next)) return;
    if (next !== tab && next !== 'player') {
      // Local tabs don't navigate. In particular, the initial route still reports POP:
      // clear this pane's saved position before Screen reads it for the new content.
      const scroller = paneRef.current?.querySelector<HTMLElement>('[data-screen="insights"][data-present="true"]');
      if (scroller) scroller.scrollTop = 0;
      scrollMemory.set(location.key, 'insights', 0);
    }
    setView({ ...view, playerKey, tab: next as DeskTab });
  };
  return (
    <>
      <MatchPane r={r} sheet={false} />
      <div ref={paneRef} className={styles.pane} data-pane="insights">
        <div className={third.switch}>
          <Tabs variant="segment" items={ITEMS} value={tab} onChange={select} aria-label="Insights" idBase="insights" />
        </div>
        {r.player && tab === 'player' && (
          <RoundButton className={third.close} aria-label="Close player" onClick={nav.back}>
            <Icon name="close" />
          </RoundButton>
        )}
        <div
          role="tabpanel"
          id="insights-panel-player"
          aria-labelledby="insights-tab-player"
          className={tab !== 'player' ? third.hidden : undefined}
          inert={tab !== 'player'}
          aria-hidden={tab !== 'player' ? true : undefined}
        >
          <AnimatePresence initial={false}>
            {r.player ? (
              <Screen
                key={`player-${playerKeyOf(r.player)}`}
                pane="player"
                contentKey={playerKeyOf(r.player)}
                label="Player"
                covered={tab !== 'player'}
                className={styles.paneScreen}
                variants={paneSwap}
                initial={false}
                animate="in"
                exit="out"
              >
                <PlayerScreen player={r.player} match={r.match} step={r.step} chrome="none" />
              </Screen>
            ) : tab === 'player' ? (
              <Screen
                key="insights"
                pane="insights"
                contentKey="insights"
                label="Insights"
                className={styles.paneScreen}
                variants={paneSwap}
                initial={false}
                animate="in"
                exit="out"
              >
                <div className={third.empty}>
                  <h1 tabIndex={-1} data-screen-heading="">
                    Pick a player.
                  </h1>
                  <p>Tap anyone in a line-up</p>
                </div>
              </Screen>
            ) : null}
          </AnimatePresence>
        </div>
        <AnimatePresence initial={false}>
          {tab !== 'player' && (
            <Screen
              key="insight-content"
              pane="insights"
              contentKey={tab}
              label={tab === 'tables' ? 'Standings' : 'Tonight'}
              className={styles.paneScreen}
              variants={paneSwap}
              initial={false}
              animate="in"
              exit="out"
            >
              <m.div
                key={tab}
                role="tabpanel"
                id={`insights-panel-${tab}`}
                aria-labelledby={`insights-tab-${tab}`}
                variants={cascade('tabs', { lift: 0 })}
                {...CASCADE}
              >
                <InsightsScreen
                  tab={tab}
                  match={r.match}
                  // Keep the pressed row until navigation arrives, so the flight measures its
                  // face rather than falling back to a different copy in the line-up.
                  onShowPlayer={() => setView({ playerKey, tab, returnTab: tab, reveal })}
                />
              </m.div>
            </Screen>
          )}
        </AnimatePresence>
      </div>
    </>
  );
}
