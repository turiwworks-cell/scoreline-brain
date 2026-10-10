import { memo, useEffect, useRef, type MouseEvent } from 'react';
import { m } from 'motion/react';
import { minText, nameOf, playerKey, scoreStr, type MatchEvent, type StandingRow, type League } from '../../domain';
import type { InsightGoal, InsightLeader } from '../../domain/insights';
import { CASCADE, cascade, timing } from '../../motion';
import { selectMatch, selectPlayer, selectPlayers, selectTeam, useScoreline, type ScorelineState } from '../../store';
import {
  Crest,
  EventTags,
  MatchClock,
  matchStops,
  PhotoTile,
  playerPhoto,
  photoProps,
  RatingBadge,
  Star,
  Tag,
  usePhotoManifest,
} from '../../ui';
import { withFeel } from '../../ui/feel';
import { StandingsTable } from '../../ui/StandingsTable';
import { selectInsightGoals, selectInsightLeaders, selectInsightTables } from './selectors';
import styles from './Insights.module.css';

export interface InsightsProps {
  tab: 'tables' | 'leaders';
  matchId?: number;
  followed: { readonly team: string; readonly n: number } | null;
  onOpenPlayer: (player: { team: string; n: number }, matchId: number, from: Element) => void;
  onOpenGoal: (matchId: number, event: MatchEvent, from: Element) => void;
}

export default function Insights(props: InsightsProps) {
  const ref = useRef<HTMLDivElement>(null);
  // Header hairline follows native scroll without React updates.
  useEffect(() => {
    const el = ref.current;
    const screen = el?.closest<HTMLElement>('[data-scroller]');
    if (!screen || !el) return;
    const write = () => el.style.setProperty('--rule-alpha', String(Math.min(screen.scrollTop / 30, 1)));
    write();
    screen.addEventListener('scroll', write, { passive: true });
    return () => screen.removeEventListener('scroll', write);
  }, []);
  return (
    <div ref={ref} className={styles.page} data-insights={props.tab}>
      <header className={styles.header}>
        <h1 tabIndex={-1} data-screen-heading="" className={styles.title}>
          {props.tab === 'tables' ? 'Standings' : 'Tonight'}
        </h1>
      </header>
      <div className={styles.body}>{props.tab === 'tables' ? <Tables matchId={props.matchId} /> : <Leaders {...props} />}</div>
    </div>
  );
}

function Heading({ left, right }: { left: string; right?: string }) {
  return (
    <div className={styles.heading}>
      <h2>{left}</h2>
      {right && <span>{right}</span>}
    </div>
  );
}

function Tables({ matchId }: { matchId?: number }) {
  const tables = useScoreline(selectInsightTables(matchId));
  const match = useScoreline(selectMatch(matchId ?? -1));
  return tables.length === 0 ? (
    <div className={styles.noTables}>
      <p>No tables tonight.</p>
      <span>Friendlies don’t have one</span>
    </div>
  ) : (
    tables.map(({ league, rows }, i) => (
      <m.section key={league.id} data-league={league.id} className={styles.league} variants={cascade('list')} custom={i} {...CASCADE}>
        <Heading left={`${league.country} · ${league.name}`} right={`Matchday ${league.matchday}`} />
        <LeagueTable league={league} rows={rows} highlighted={match ? [match.home, match.away] : []} delay={timing('list').stagger * i} />
      </m.section>
    ))
  );
}

const selectTeams = (s: ScorelineState) => s.domain.teams;
function LeagueTable({
  league,
  rows,
  highlighted,
  delay,
}: {
  league: League;
  rows: readonly StandingRow[];
  highlighted: readonly string[];
  delay: number;
}) {
  const teams = useScoreline(selectTeams);
  return <StandingsTable rows={rows} league={league} teams={teams} highlighted={highlighted} delay={delay} />;
}

function Leaders(props: InsightsProps) {
  const list = useScoreline(selectInsightLeaders);
  const goals = useScoreline(selectInsightGoals);
  return (
    <>
      <Heading left="Top rated" right={list.length ? 'Live ratings' : ''} />
      {list.length === 0 && <p className={styles.empty}>Nobody has played yet.</p>}
      {list.map((it, i) => (
        <LeaderRow key={`${it.matchId}:${it.team}:${it.n}`} it={it} index={i} followed={props.followed} onOpen={props.onOpenPlayer} />
      ))}
      <div className={styles.goalHeading}>
        <Heading left="Goals tonight" right={String(goals.length)} />
      </div>
      {goals.length === 0 && <p className={styles.empty}>No goals yet.</p>}
      {goals.slice(0, 14).map((it, i) => (
        <GoalRow key={`${it.matchId}:${it.event.id}`} it={it} index={i} followed={props.followed} onOpen={props.onOpenGoal} />
      ))}
    </>
  );
}

const LeaderRow = memo(function LeaderRow({
  it,
  index,
  followed,
  onOpen,
}: {
  it: InsightLeader;
  index: number;
  followed: InsightsProps['followed'];
  onOpen: InsightsProps['onOpenPlayer'];
}) {
  const team = useScoreline(selectTeam(it.team));
  const opp = useScoreline(selectTeam(it.opponent));
  const player = useScoreline(selectPlayer(playerKey(it.team, it.n)));
  const photos = usePhotoManifest();
  const name = player ? `${player.first} ${player.last}` : `${team?.name ?? it.team} #${it.n}`;
  const following = followed?.team === it.team && followed.n === it.n;
  return (
    <m.button
      type="button"
      className={`${styles.leader} m-feel m-fade`}
      data-insight-leader={`${it.team}:${it.n}`}
      data-focus-key={`leader-${it.matchId}-${it.team}-${it.n}`}
      aria-label={`Open ${name}, rating ${it.rating.toFixed(1)}`}
      variants={cascade('squad', { lift: 10, withDelay: false })}
      custom={index}
      {...CASCADE}
      {...withFeel({ onClick: (e: MouseEvent<HTMLButtonElement>) => onOpen({ team: it.team, n: it.n }, it.matchId, e.currentTarget) })}
    >
      <span className={styles.rank} data-top={index < 3 ? '' : undefined}>
        {index + 1}
      </span>
      {team && (
        <span className={styles.photo}>
          <PhotoTile team={team} n={it.n} size={52} alt="" loading="lazy" {...photoProps(playerPhoto(photos.manifest, it.team, it.n))} />
        </span>
      )}
      <span className={styles.leaderName}>
        <span>{name}</span>
        {following && <Star className={styles.star} />}
        <EventTags goals={it.flags.goals} assists={it.flags.assists} yellow={it.flags.yellow} red={it.flags.redAt !== undefined} />
      </span>
      <span className={styles.opponent}>
        {team && <Crest team={team} size={13} />}
        <span>
          vs {opp?.name ?? it.opponent} · <LeaderClock matchId={it.matchId} />
        </span>
      </span>
      <RatingBadge
        className={styles.rating}
        value={it.rating}
        best={index === 0}
        size={12}
        aria-label={`Rating ${it.rating.toFixed(1)}${index === 0 ? ', best tonight' : ''}`}
      />
    </m.button>
  );
});

function LeaderClock({ matchId }: { matchId: number }) {
  const match = useScoreline(selectMatch(matchId));
  return match ? <MatchClock match={match} /> : null;
}

const GoalRow = memo(function GoalRow({
  it,
  index,
  followed,
  onOpen,
}: {
  it: InsightGoal;
  index: number;
  followed: InsightsProps['followed'];
  onOpen: InsightsProps['onOpenGoal'];
}) {
  const match = useScoreline(selectMatch(it.matchId));
  const teamId = match ? (it.event.side === 'home' ? match.home : match.away) : '';
  const team = useScoreline(selectTeam(teamId));
  const home = useScoreline(selectTeam(match?.home ?? ''));
  const away = useScoreline(selectTeam(match?.away ?? ''));
  const players = useScoreline(selectPlayers);
  if (!match) return null;
  const e = it.event;
  const name = e.name ?? (e.player !== undefined ? nameOf({ players }, teamId, e.player) : 'Unknown scorer');
  const following = followed?.team === teamId && followed.n === e.player;
  // Never substitute the current match score for an unavailable historical event score.
  const score = e.score ? scoreStr(e.score[0], e.score[1]) : '—';
  const stops = home && away ? matchStops(home, away) : undefined;
  const background = stops ? `linear-gradient(90deg, ${stops[0]}, ${stops[1]} 42%, ${stops[2]} 62%, ${stops[3]})` : undefined;
  return (
    <m.button
      type="button"
      className={`${styles.goal} m-feel m-fade`}
      data-insight-goal={`${it.matchId}:${e.id}`}
      data-focus-key={`insight-goal-${it.matchId}-${e.id}`}
      aria-label={`Open ${home?.name ?? match.home} versus ${away?.name ?? match.away}, ${name}, ${minText(e.minute)}, ${score}`}
      variants={cascade('squad', { lift: 8, withDelay: false })}
      custom={index}
      {...CASCADE}
      {...withFeel({ onClick: (ev: MouseEvent<HTMLButtonElement>) => onOpen(it.matchId, e, ev.currentTarget) })}
    >
      <span className={styles.minute}>{minText(e.minute)}</span>
      <Tag kind="goal" size={16} className={styles.ball} />
      <span className={styles.goalName}>
        <span>{name}</span>
        {following && <Star className={styles.star} />}
      </span>
      <span className={styles.fixture}>
        {team && <Crest team={team} size={12} />}
        <span>
          {home?.short ?? match.home} – {away?.short ?? match.away}
        </span>
      </span>
      <span className={styles.score} style={{ background }}>
        {score}
      </span>
    </m.button>
  );
});
