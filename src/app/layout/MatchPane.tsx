import { AnimatePresence, m } from 'motion/react';
import { LAYER, paneSwap, scrim, sheetRise } from '../../motion';
import { playerKeyOf } from '../nav/url';
import { PickAMatch } from '../screens/Missing';
import { LazyMatchScreen as MatchScreen } from '../screens/LazyScreens';
import { LazyPlayerScreen as PlayerScreen } from '../screens/LazyScreens';
import type { Resolved } from './resolve';
import { Screen } from './Screen';
import { Stage } from './Stage';
import styles from './Shell.module.css';

/**
 * The match pane of TwoPane and ThreePane. A new match swaps in at once (the Lua desktop does)
 * while its blocks cascade; nothing flies from the card. With `sheet` (tablet) the player rises
 * over it as a sheet. Goal and red card scenes play over it (`stage`, Part 18); on the
 * tablet its toasts too.
 */
export function MatchPane({ r, sheet, stage }: { r: Resolved; sheet: boolean; stage: 'all' | 'scene' }) {
  const player = sheet ? r.player : null;
  return (
    <div className={styles.pane} data-pane="match">
      <AnimatePresence initial={false}>
        <Screen
          key={r.match ? `match-${r.match.id}` : 'none'}
          pane="match"
          contentKey={r.match ? String(r.match.id) : ''}
          label="Match"
          covered={!!player}
          className={styles.paneScreen}
          variants={paneSwap}
          initial={false}
          animate="in"
          exit="out"
        >
          {r.match ? <MatchScreen match={r.match} chrome="none" /> : <PickAMatch />}
        </Screen>
      </AnimatePresence>
      {sheet && (
        <>
          <m.div className={styles.paneScrim} variants={scrim} initial={false} animate={player ? 'covered' : 'rest'} aria-hidden="true" />
          <AnimatePresence initial={false}>
            {player && (
              <Screen key="sheet" pane="player" contentKey={playerKeyOf(player)} label="Player" className={styles.sheet} variants={sheetRise} {...LAYER}>
                <PlayerScreen key={playerKeyOf(player)} player={player} match={r.match} step={r.step} chrome="close" />
              </Screen>
            )}
          </AnimatePresence>
        </>
      )}
      <Stage slot={stage} />
    </div>
  );
}
