import { AnimatePresence } from 'motion/react';
import { paneSwap } from '../../motion';
import { playerKeyOf } from '../nav/url';
import { InsightsPlaceholder } from '../screens/InsightsPlaceholder';
import { PlayerPlaceholder } from '../screens/PlayerPlaceholder';
import { MatchPane } from './MatchPane';
import type { Resolved } from './resolve';
import { Screen } from './Screen';
import styles from './Shell.module.css';

/**
 * Desktop, ≥ 1200 px (ARCHITECTURE §6): list · match · third pane. The third pane shows the open
 * player (his face in the match pane flies across into the bust), else the insights.
 */
export function ThreePane({ r }: { r: Resolved }) {
  return (
    <>
      <MatchPane r={r} sheet={false} />
      <div className={styles.pane} data-pane="insights">
        <AnimatePresence initial={false}>
          {r.player ? (
            <Screen key={`player-${playerKeyOf(r.player)}`} pane="player" contentKey={playerKeyOf(r.player)} label="Player" className={styles.paneScreen} variants={paneSwap} initial={false} animate="in" exit="out">
              <PlayerPlaceholder player={r.player} chrome="none" />
            </Screen>
          ) : (
            <Screen key="insights" pane="insights" contentKey="insights" label="Insights" className={styles.paneScreen} variants={paneSwap} initial={false} animate="in" exit="out">
              <InsightsPlaceholder />
            </Screen>
          )}
        </AnimatePresence>
      </div>
    </>
  );
}
