import { AnimatePresence, m } from 'motion/react';
import { LAYER, playerPage, pushLayer, scrim } from '../../motion';
import { playerKeyOf } from '../nav/url';
import { MatchScreen } from '../screens/MatchScreen';
import { PlayerPlaceholder } from '../screens/PlayerPlaceholder';
import type { Resolved } from './resolve';
import { Screen } from './Screen';
import styles from './Shell.module.css';

/**
 * Phone, < 768 px (ARCHITECTURE §6): the list at the base (ListPane); the match pushes in over it
 * from the right, the player fades in on top while his face grows into the bust. One layer of
 * each kind at most: a repeated or reversed navigation retargets the same layer, it never stacks
 * a second one. Back and swipe-back are browser history.
 */
export function PhoneStack({ r }: { r: Resolved }) {
  return (
    <>
      <m.div className={styles.scrim} variants={scrim} initial={false} animate={r.match ? 'covered' : 'rest'} aria-hidden="true" />
      <AnimatePresence initial={false}>
        {r.match && (
          <Screen key="match" pane="match" contentKey={String(r.match.id)} label="Match" covered={!!r.player} className={styles.layerMatch} variants={pushLayer} {...LAYER}>
            <MatchScreen key={r.match.id} match={r.match} chrome="back" />
          </Screen>
        )}
        {r.player && (
          <Screen key="player" pane="player" contentKey={playerKeyOf(r.player)} label="Player" className={styles.layerPlayer} variants={playerPage} {...LAYER}>
            <PlayerPlaceholder key={playerKeyOf(r.player)} player={r.player} chrome="back" />
          </Screen>
        )}
      </AnimatePresence>
    </>
  );
}
