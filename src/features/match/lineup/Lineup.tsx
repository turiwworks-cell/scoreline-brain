import { memo, useCallback, useMemo } from 'react';
import { lineupOf, nameOf, type Match, type Side, type Team } from '../../../domain';
import { useScoreline } from '../../../store';
import { Glass, coachPhoto, playerPhoto, usePhotoManifest } from '../../../ui';
import { H4 } from '../H4';
import { selectPlayers } from '../selectors';
import { Coach } from './Coach';
import { benchOrder, bestOf, lineOf, sideMarks, squadGroups } from './model';
import { Pitch } from './Pitch';
import { PlayerRow } from './PlayerRow';
import { TeamSwitch } from './TeamSwitch';
import styles from './Lineup.module.css';

/*
 * The Lineup tab (lineup and squadList, luau:5384-5697): a home / away switch, then for a match
 * that has started the formation, the pitch with the eleven, the substitutes and the coach; before
 * kick-off a note that the line-ups are not out, the squad by line and the coach. Every player is
 * a button that opens his page. Switching side shows the other team and plays its entrance again.
 */

export type LineupProps = {
  match: Match;
  home: Team;
  away: Team;
  /** the pane's width: the pitch is this less 2 × 18 */
  width: number;
  side: Side;
  onSide: (side: Side) => void;
  /** the player the user follows: a star by his name */
  followed?: { readonly team: string; readonly n: number } | null;
  /** a player opens his page; `from` is the pressed button, the shared element starts there */
  onOpenPlayer: (player: { team: string; n: number }, from: Element) => void;
};

export const Lineup = memo(function Lineup({ match, home, away, width, side, onSide, followed = null, onOpenPlayer }: LineupProps) {
  const team = side === 'home' ? home : away;
  const players = useScoreline(selectPlayers);
  const manifest = usePhotoManifest();
  const hold = manifest.status === 'idle' || manifest.status === 'loading';
  const lineup = useMemo(
    () => lineupOf({ players }, match, side),
    // lineupOf reads only these
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [players, match.lineups, match.home, match.away, side],
  );
  const marks = useMemo(() => sideMarks(match.events, side), [match.events, side]);
  const scheduled = match.status === 'scheduled';
  const mine = followed?.team === team.id ? followed.n : null;

  const photoOf = useCallback((n: number) => playerPhoto(manifest.manifest, team.id, n), [manifest.manifest, team.id]);
  const nameFor = useCallback((n: number) => nameOf({ players }, team.id, n), [players, team.id]);
  const open = useCallback((n: number, from: Element) => onOpenPlayer({ team: team.id, n }, from), [onOpenPlayer, team.id]);

  return (
    <div className={styles.lineup} data-lineup={side} data-scheduled={scheduled ? '' : undefined}>
      <TeamSwitch home={home} away={away} side={side} onChange={onSide} />
      {/* the other team's entrance starts again (luT, luau:7246) */}
      <div key={team.id}>
        {scheduled ? (
          <Squad team={team} players={players} lineup={lineup} mine={mine} photoOf={photoOf} nameFor={nameFor} hold={hold} open={open} coach={coachPhoto(manifest.manifest, team.id)} />
        ) : (
          <Played
            match={match}
            side={side}
            team={team}
            players={players}
            lineup={lineup}
            marks={marks}
            width={width}
            mine={mine}
            photoOf={photoOf}
            nameFor={nameFor}
            hold={hold}
            open={open}
            coach={coachPhoto(manifest.manifest, team.id)}
          />
        )}
      </div>
    </div>
  );
});

type Common = {
  team: Team;
  players: ReturnType<typeof selectPlayers>;
  lineup: ReturnType<typeof lineupOf>;
  mine: number | null;
  photoOf: (n: number) => ReturnType<typeof playerPhoto>;
  nameFor: (n: number) => string;
  hold: boolean;
  open: (n: number, from: Element) => void;
  coach: ReturnType<typeof coachPhoto>;
};

function Played({ match, side, team, players, lineup, marks, width, mine, photoOf, nameFor, hold, open, coach }: Common & { match: Match; side: Side; marks: ReturnType<typeof sideMarks>; width: number }) {
  const xi = lineup.xi.slice(0, 11);
  // the ratings of those who took part, and the best of the eleven (luau:5435, 5576)
  const ratings = useMemo(() => {
    const out = new Map<number, number>();
    for (const n of [...xi, ...lineup.bench]) {
      const l = lineOf(match, side, n, xi.includes(n), marks.get(n));
      if (l.played && l.rating > 0) out.set(n, l.rating);
    }
    return out;
    // the events and the provider's lines are all it reads
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [match.players, match.status, side, lineup, marks]);
  const best = bestOf(match, side, xi);
  const bench = useMemo(() => benchOrder(lineup.bench, marks), [lineup.bench, marks]);
  const used = bench.filter((n) => marks.get(n)?.on !== undefined).length;
  return (
    <>
      <H4 left="Formation" right={lineup.formation} />
      <Pitch
        team={team}
        form={lineup.formation}
        xi={xi}
        width={Math.max(width - 36, 0)}
        players={players}
        marks={marks}
        ratings={ratings}
        best={best}
        followed={mine}
        photoOf={photoOf}
        nameOf={nameFor}
        hold={hold}
        onOpen={open}
      />
      <H4 left="Substitutes" right={`${used} of 5 used`} />
      <div role="list" aria-label="Substitutes">
        {bench.map((n, i) => {
          const m = marks.get(n);
          return (
            <div role="listitem" key={n}>
              <PlayerRow
                team={team}
                n={n}
                player={players[`${team.id}:${n}`]}
                name={nameFor(n)}
                replaced={m?.replaced !== undefined ? nameFor(m.replaced) : undefined}
                marks={m}
                rating={ratings.get(n) ?? 0}
                followed={mine === n}
                photo={photoOf(n)}
                showMatch
                started
                index={i}
                hold={hold}
                onOpen={open}
              />
            </div>
          );
        })}
      </div>
      <div className={styles.afterRows} />
      <Coach team={team} photo={coach} />
    </>
  );
}

function Squad({ team, players, lineup, mine, photoOf, nameFor, hold, open, coach }: Common) {
  const groups = useMemo(() => squadGroups(players, team.id, lineup), [players, team.id, lineup]);
  let i = 0;
  return (
    <>
      <Glass radius={16} className={styles.note}>
        <p className={styles.noteTitle}>Line-ups are not out yet</p>
        <p className={styles.noteBody}>They are confirmed about an hour before kick-off.</p>
      </Glass>
      {groups.map((g) => (
        <section key={g.pos} aria-label={g.label}>
          <H4 left={g.label} right={String(g.ns.length)} />
          {g.ns.map((n) => {
            const p = players[`${team.id}:${n}`];
            return (
              <PlayerRow
                key={n}
                team={team}
                n={n}
                player={p}
                name={nameFor(n)}
                replaced={undefined}
                marks={undefined}
                rating={0}
                followed={mine === n}
                photo={photoOf(n)}
                showMatch={false}
                started={false}
                index={i++}
                hold={hold}
                onOpen={open}
              />
            );
          })}
          <div className={styles.afterGroup} />
        </section>
      ))}
      <Coach team={team} photo={coach} />
    </>
  );
}

