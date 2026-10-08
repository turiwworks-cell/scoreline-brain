import { useMemo, useRef, useSyncExternalStore, type CSSProperties, type ReactNode } from 'react';
import { m, useTransform } from 'motion/react';
import { isKeeper, nameOf, playerKey, playerStats, type Team } from '../../domain';
import { selectMatch, selectPlayer, selectPlayers, selectTeam, useScoreline } from '../../store';
import { frostPhoto, Icon, playerPhoto, RoundButton, SoftLight, subscribeSecond, usePhotoManifest } from '../../ui';
import { Bar } from './Bar';
import { BACKDROP } from './layout';
import { sideIn, squadOrder, stepOf, substitutionOf, tagsOf } from './model';
import { useOpening, useScrollVars } from './motion';
import { Hero, Horizon } from './Scene';
import { Facts, Info, MatchBlock, SubTag } from './Sheet';
import styles from './PlayerView.module.css';

/*
 * The player view (drawPlayerView, luau:5845–6179): the list's face grows into the whole bust,
 * centred, its giant shirt number behind it; name and numbers sit centred underneath. The route
 * is not known here: the app gives the player, the match his numbers come from, and callbacks.
 */

export type PlayerViewProps = {
  team: string;
  n: number;
  /** the match his numbers come from; his team's must be one of its sides */
  matchId?: number;
  /** the player the user follows is this one */
  following: boolean;
  onFollow: (on: boolean) => void;
  chrome: 'back' | 'close' | 'none';
  onBack: () => void;
  /** reached by an arrow: the way he slid in (1 next, -1 previous), 0 when opened */
  enter?: -1 | 0 | 1;
  /** the arrows: the next or previous player of his side's squad */
  onStep: (to: { team: string; n: number }, dir: 1 | -1) => void;
  /** shown while his team isn't in the feed */
  missing: ReactNode;
};

const idle = () => () => {};
/** The clock's second, while `on`; the minutes under "This match" move with it. */
function useSecond(on: boolean): number {
  return useSyncExternalStore(on ? subscribeSecond : idle, () => (on ? Math.floor(Date.now() / 1000) : 0), () => 0);
}

export function PlayerView(props: PlayerViewProps) {
  const team = useScoreline(selectTeam(props.team));
  if (!team) return <>{props.missing}</>;
  return <Page {...props} team={team} />;
}

function Page({ team, n, matchId, following, onFollow, chrome, onBack, enter = 0, onStep }: Omit<PlayerViewProps, 'team' | 'missing'> & { team: Team }) {
  const ref = useRef<HTMLDivElement>(null);
  const player = useScoreline(selectPlayer(playerKey(team.id, n)));
  const players = useScoreline(selectPlayers);
  const found = useScoreline(selectMatch(matchId ?? -1));
  const manifest = usePhotoManifest();
  const stepped = enter !== 0;
  const opening = useOpening(team.id, n, stepped);
  useScrollVars(ref);

  // his photo waits for the manifest the first time, so a kit disc never swaps to a bust mid-entrance
  const hold = manifest.status === 'idle' || manifest.status === 'loading';
  const photos = manifest.manifest;
  const photo = useMemo(() => playerPhoto(photos, team.id, n), [photos, team.id, n]);
  const frost = useMemo(() => frostPhoto(photos, team.id, n), [photos, team.id, n]);

  const side = sideIn(found, team.id);
  const match = side ? found : undefined;
  const now = useMemo(() => new Date(), []);
  const live = match?.status === 'live';
  const second = useSecond(live);
  const stats = useMemo(
    () => (match && side ? playerStats({ players }, match, side, n, live ? second * 1000 : match.clock.at) : undefined),
    // the numbers move with the events, the provider's line and (while he plays) the second
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [players, match?.events, match?.players, match?.status, match?.clock, match?.lineups, side, n, second],
  );
  const tags = useMemo(() => (match && side && stats ? tagsOf(match.events, side, n, stats) : []), [match, side, n, stats]);
  const sub = useMemo(() => (match && side ? substitutionOf(match.events, side, n) : undefined), [match, side, n]);
  const order = useMemo(() => (match && side ? squadOrder({ players }, match, side) : []), [players, match, side]);

  const dir = enter;
  const step = (d: 1 | -1) => {
    const to = stepOf(order, n, d);
    if (to !== undefined) onStep({ team: team.id, n: to }, d);
  };
  const slide = useTransform(opening.step, (v) => 36 * dir * (1 - v));
  const numberSlide = useTransform(opening.step, (v) => 36 * dir * (1 - v) * 0.5);
  const keeper = isKeeper(player);

  return (
    <div ref={ref} className={styles.page} style={{ '--c1': team.colors[0] } as CSSProperties} data-pv="page" data-player={`${team.id}:${n}`} data-photo={photo && !hold ? 'bust' : 'kit'}>
      <Bar team={team} n={n} frost={frost} chrome={chrome} onBack={onBack} following={following} onFollow={onFollow} colour={team.colors[0]} numberSlide={numberSlide} />
      <div className={styles.backdrop} aria-hidden="true">
        <SoftLight color={team.colors[0]} alpha={0.5} cx="50%" cy={BACKDROP.cy} rx={BACKDROP.rx / 2} ry={BACKDROP.ry / 2} />
      </div>
      <div className={styles.scene}>
        {!hold && <Hero team={team} n={n} photo={photo} opening={opening} dir={dir} />}
        <Horizon colour={team.colors[0]} e={opening.e} step={opening.step} dir={dir} />
        {sub && <SubTag sub={sub} />}
        {order.length > 1 && (
          <>
            <RoundButton aria-label="Previous player" className={`${styles.arrow} ${styles.prev}`} onClick={() => step(-1)} data-pv="prev">
              <Icon name="back" />
            </RoundButton>
            <RoundButton aria-label="Next player" className={`${styles.arrow} ${styles.next}`} onClick={() => step(1)} data-pv="next">
              <Icon name="fwd" />
            </RoundButton>
          </>
        )}
      </div>
      <m.div className={styles.sheet} style={{ opacity: opening.step }}>
        <Info player={player} team={team} n={n} fallbackName={nameOf({ players }, team.id, n)} slide={slide} stepped={stepped} />
        <Facts player={player} team={team} n={n} now={now} stepped={stepped} />
        {match && stats && <MatchBlock match={match} stats={stats} tags={tags} team={team} keeper={keeper} stepped={stepped} />}
      </m.div>
    </div>
  );
}
