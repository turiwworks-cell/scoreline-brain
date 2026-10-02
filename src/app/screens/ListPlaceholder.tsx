import { memo } from 'react';
import { demoMode } from '../../data';
import { playerKey, scoreStr } from '../../domain';
import { Shared, sharedMatch, sharedPlayer } from '../../motion';
import { selectDays, selectLeague, selectLiveMatchIds, selectLoaded, selectMatch, selectMatchIdsByDay, selectPlayer, selectTeam, useScoreline } from '../../store';
import { Crest, MatchClock, PhotoTile, Tabs, withFeel } from '../../ui';
import { useNav } from '../nav/useNav';
import { DAY_RANGE, type ListState } from '../nav/url';
import { placeholderBust } from './placeholderBust';
import styles from './placeholder.module.css';

// the followed player until prefs exist (DemoSource follows Argentina's 10 by default)
const FOLLOWED = { team: 'arg', n: 10 };
const FALLBACK_DAYS = ['2 days ago', 'Yesterday', 'Today', 'Tomorrow', 'In 2 days'];

/** Placeholder list (Part 10 builds the real one): day tabs, Live, a followed player, match cards. */
export function ListPlaceholder({ list, openId }: { list: ListState; openId?: number }) {
  const nav = useNav();
  const days = useScoreline(selectDays);
  const loaded = useScoreline(selectLoaded);
  const byDay = useScoreline(selectMatchIdsByDay(list.day));
  const live = useScoreline(selectLiveMatchIds);
  const ids = list.live ? live : byDay;
  const labels = days.length === DAY_RANGE * 2 + 1 ? days : FALLBACK_DAYS;
  const tabs = labels.map((label, i) => ({ id: String(i - DAY_RANGE), label }));

  return (
    <div className={styles.page}>
      <header className={styles.listHead}>
        <h1 className={`${styles.wordmark} ${styles.heading}`} tabIndex={-1} data-screen-heading="">
          Scoreline
        </h1>
        <button type="button" className={`m-glass m-feel m-dip ${styles.liveToggle}`} aria-pressed={list.live} {...withFeel({ onClick: () => nav.setLive(!list.live) })}>
          Live
        </button>
      </header>
      <div className={styles.days}>
        <Tabs variant="day" items={tabs} value={String(list.day)} onChange={(id) => nav.setDay(Number(id))} aria-label="Day" />
      </div>
      {loaded && <FollowCard />}
      {!loaded ? <NoData /> : ids.length === 0 ? <p className={styles.empty}>No matches.</p> : ids.map((id, i) => <MatchCard key={id} id={id} prevId={ids[i - 1]} open={id === openId} />)}
    </div>
  );
}

function NoData() {
  // no ApiSource is wired yet (Part 22): without ?demo nothing will arrive
  if (demoMode(window.location.search)) return <p className={styles.empty}>Loading the demo…</p>;
  return (
    <p className={styles.empty}>
      No matches yet.
      <br />
      <a href="/?demo">Play the demo matchday</a>
    </p>
  );
}

function FollowCard() {
  const nav = useNav();
  const player = useScoreline(selectPlayer(playerKey(FOLLOWED.team, FOLLOWED.n)));
  const team = useScoreline(selectTeam(FOLLOWED.team));
  if (!player || !team) return null;
  return (
    <button
      type="button"
      className={`m-glass m-feel m-fade ${styles.follow}`}
      data-focus-key={`follow-${team.id}-${player.n}`}
      {...withFeel({ onClick: (e: { currentTarget: Element }) => nav.openPlayer(FOLLOWED, { from: e.currentTarget }) })}
    >
      <Shared id={sharedPlayer(team.id, player.n)} end="face">
        <PhotoTile size={52} team={team} n={player.n} src={placeholderBust(team)} alt="" />
      </Shared>
      <span className={styles.followText}>
        <span className={styles.label}>Following</span>
        <span className={styles.name}>
          {player.first} {player.last}
        </span>
      </span>
    </button>
  );
}

const MatchCard = memo(function MatchCard({ id, prevId, open }: { id: number; prevId: number | undefined; open: boolean }) {
  const nav = useNav();
  const m = useScoreline(selectMatch(id));
  const prev = useScoreline(selectMatch(prevId ?? 0));
  const home = useScoreline(selectTeam(m?.home ?? ''));
  const away = useScoreline(selectTeam(m?.away ?? ''));
  const league = useScoreline(selectLeague(m?.league ?? ''));
  if (!m || !home || !away) return null;
  const score = m.status === 'scheduled' ? m.kickoff : scoreStr(m.score[0], m.score[1]);
  return (
    <>
      {prev?.league !== m.league && <h2 className={styles.league}>{league?.name ?? m.league}</h2>}
      <button
        type="button"
        className={`m-glass m-feel m-fade ${styles.card}`}
        data-focus-key={`match-${id}`}
        aria-current={open ? 'true' : undefined}
        aria-label={`${home.name} ${score} ${away.name}`}
        {...withFeel({ onClick: (e: { currentTarget: Element }) => nav.openMatch(id, { from: e.currentTarget }) })}
      >
        <Shared id={sharedMatch(id, 'home')} end="card">
          <Crest team={home} size={30} />
        </Shared>
        <span className={styles.cardName} style={{ textAlign: 'left' }}>
          {home.short}
        </span>
        <Shared id={sharedMatch(id, 'score')} end="card">
          <span className={styles.cardScore}>{score}</span>
        </Shared>
        <span className={styles.cardName} style={{ textAlign: 'right' }}>
          {away.short}
        </span>
        <Shared id={sharedMatch(id, 'away')} end="card">
          <Crest team={away} size={30} />
        </Shared>
        <span className={styles.cardMeta}>{m.status === 'live' ? <MatchClock match={m} /> : m.status === 'finished' ? 'Full time' : 'Kick-off'}</span>
      </button>
    </>
  );
});
