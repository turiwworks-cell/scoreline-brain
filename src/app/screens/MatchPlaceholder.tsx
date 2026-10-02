import { memo } from 'react';
import { m as motion } from 'motion/react';
import { playerKey, scoreStr, type Match, type Team } from '../../domain';
import { CASCADE, cascade, Shared, sharedMatch, sharedPlayer } from '../../motion';
import { selectLoaded, selectMatch, selectPlayer, selectTeam, useScoreline } from '../../store';
import { Crest, Glass, Icon, MatchClock, PhotoTile, RoundButton, Tabs, withFeel } from '../../ui';
import { useNav } from '../nav/useNav';
import { isMatchTab, type MatchRef } from '../nav/url';
import { Missing } from './Missing';
import { placeholderBust } from './placeholderBust';
import styles from './placeholder.module.css';

// TABS, luau:1814
const TAB_ITEMS = [
  { id: 'facts', label: 'Facts' },
  { id: 'stats', label: 'Stats' },
  { id: 'lineup', label: 'Lineup' },
  { id: 'table', label: 'Table' },
] as const;
const XI = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];

/**
 * Placeholder match screen (Part 11 builds the real one): the hero with the card → hero shared
 * elements, the tab bar on the URL, and a line-up of faces that open the player (face → bust).
 */
export function MatchPlaceholder({ match, chrome }: { match: MatchRef; chrome: 'back' | 'none' }) {
  const nav = useNav();
  const loaded = useScoreline(selectLoaded);
  const m = useScoreline(selectMatch(match.id));
  const home = useScoreline(selectTeam(m?.home ?? ''));
  const away = useScoreline(selectTeam(m?.away ?? ''));
  if (!m || !home || !away) return <Missing back={chrome === 'back'} loaded={loaded} what="This match" />;

  const c = cascade('screen');
  const idBase = `match-${m.id}`;
  const score = m.status === 'scheduled' ? m.kickoff : scoreStr(m.score[0], m.score[1]);
  return (
    <div className={styles.page}>
      <div className={styles.bar}>
        {chrome === 'back' && (
          <RoundButton aria-label="Back" onClick={nav.back}>
            <Icon name="back" />
          </RoundButton>
        )}
        <h1 className={`${styles.title} ${styles.heading}`} tabIndex={-1} data-screen-heading="">
          {home.name} – {away.name}
        </h1>
      </div>
      <motion.div className={styles.hero} variants={c} custom={0} {...CASCADE}>
        <Shared id={sharedMatch(m.id, 'home')} end="hero">
          <Crest team={home} size={64} />
        </Shared>
        <Shared id={sharedMatch(m.id, 'score')} end="hero">
          <span className={styles.heroScore}>{score}</span>
        </Shared>
        <Shared id={sharedMatch(m.id, 'away')} end="hero">
          <Crest team={away} size={64} />
        </Shared>
        <span className={styles.heroName}>{home.short}</span>
        <span className={styles.heroMeta}>{m.status === 'live' ? <MatchClock match={m} /> : m.status === 'finished' ? 'Full time' : 'Kick-off'}</span>
        <span className={styles.heroName}>{away.short}</span>
      </motion.div>
      <motion.div className={styles.tabs} variants={c} custom={1} {...CASCADE}>
        <Tabs items={TAB_ITEMS} value={match.tab} onChange={(t) => isMatchTab(t) && nav.setTab(m.id, t)} aria-label="Match" idBase={idBase} />
      </motion.div>
      <motion.div variants={c} custom={2} {...CASCADE} role="tabpanel" id={`${idBase}-panel-${match.tab}`} aria-labelledby={`${idBase}-tab-${match.tab}`}>
        {match.tab === 'lineup' ? (
          <div className={styles.lineup}>
            <LineupSide match={m} team={home} xi={m.lineups?.home?.xi ?? XI} />
            <LineupSide match={m} team={away} xi={m.lineups?.away?.xi ?? XI} />
          </div>
        ) : (
          Array.from({ length: 12 }, (_, i) => (
            <Glass key={i} className={styles.block}>
              {TAB_ITEMS.find((t) => t.id === match.tab)?.label} · placeholder {i + 1}
            </Glass>
          ))
        )}
      </motion.div>
    </div>
  );
}

function LineupSide({ match, team, xi }: { match: Match; team: Team; xi: readonly number[] }) {
  return (
    <div>
      <h2 className={styles.label}>{team.short}</h2>
      <ul className={styles.chips}>
        {xi.map((n) => (
          <li key={n}>
            <LineupChip matchId={match.id} team={team} n={n} />
          </li>
        ))}
      </ul>
    </div>
  );
}

const LineupChip = memo(function LineupChip({ matchId, team, n }: { matchId: number; team: Team; n: number }) {
  const nav = useNav();
  const p = useScoreline(selectPlayer(playerKey(team.id, n)));
  return (
    <button
      type="button"
      className={`m-feel m-fade ${styles.chip}`}
      data-focus-key={`chip-${team.id}-${n}`}
      {...withFeel({ onClick: (e: { currentTarget: Element }) => nav.openPlayer({ team: team.id, n }, { under: { id: matchId, tab: 'lineup' }, from: e.currentTarget }) })}
    >
      <Shared id={sharedPlayer(team.id, n)} end="face">
        <PhotoTile size={40} team={team} n={n} src={placeholderBust(team)} alt="" />
      </Shared>
      <span className={styles.chipName}>
        {n} {p?.short ?? ''}
      </span>
    </button>
  );
});
