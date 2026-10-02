import { m as motion } from 'motion/react';
import { playerKey } from '../../domain';
import { CASCADE, cascade, Shared, sharedPlayer } from '../../motion';
import { selectLoaded, selectPlayer, selectTeam, useScoreline } from '../../store';
import { Glass, Icon, RoundButton } from '../../ui';
import { useNav } from '../nav/useNav';
import type { PlayerRef } from '../nav/url';
import { Missing } from './Missing';
import { placeholderBust } from './placeholderBust';
import styles from './placeholder.module.css';

/**
 * Placeholder player view (Part 14 builds the real one): the bust that a face grows into
 * (face → bust), the giant number behind it, and sheet blocks cascading in (motion: player).
 */
export function PlayerPlaceholder({ player, chrome }: { player: PlayerRef; chrome: 'back' | 'close' | 'none' }) {
  const nav = useNav();
  const loaded = useScoreline(selectLoaded);
  const p = useScoreline(selectPlayer(playerKey(player.team, player.n)));
  const team = useScoreline(selectTeam(player.team));
  if (!team) return <Missing back={chrome !== 'none'} loaded={loaded} what="This player" />;

  const c = cascade('player', { lift: 14 });
  const facts = p ? [p.role || p.pos, p.club, p.born, p.height ? `${p.height} cm` : ''].filter(Boolean) : [];
  return (
    <div className={styles.page}>
      <div className={styles.bar}>
        {chrome !== 'none' && (
          <RoundButton aria-label={chrome === 'close' ? 'Close' : 'Back'} onClick={nav.back}>
            <Icon name={chrome === 'close' ? 'close' : 'back'} />
          </RoundButton>
        )}
      </div>
      <div className={styles.bustStage}>
        <span className={styles.bigNumber} aria-hidden="true">
          {player.n}
        </span>
        <Shared id={sharedPlayer(team.id, player.n)} end="bust" className={styles.bust}>
          <img className={styles.bustImg} src={placeholderBust(team)} width={230} height={288} alt="" draggable={false} />
        </Shared>
      </div>
      <h1 className={`${styles.playerName} ${styles.heading}`} tabIndex={-1} data-screen-heading="">
        {p ? `${p.first} ${p.last}` : `${team.name} #${player.n}`}
      </h1>
      <p className={styles.playerMeta}>
        {team.name} · {player.n}
      </p>
      {(facts.length ? facts : ['Profile', 'Season', 'This match']).concat(['placeholder', 'placeholder', 'placeholder']).map((f, i) => (
        <motion.div key={i} variants={c} custom={i} {...CASCADE}>
          <Glass className={styles.block}>{f}</Glass>
        </motion.div>
      ))}
    </div>
  );
}
