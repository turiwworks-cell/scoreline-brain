import { Fragment, memo, useEffect, useMemo, useRef } from 'react';
import { animate, m, useReducedMotion } from 'motion/react';
import type { Match, Side, Team } from '../../domain';
import { CASCADE, cascade, CURVES } from '../../motion';
import { useScoreline } from '../../store';
import { Crest, feel, textWidth, useFontVersion } from '../../ui';
import { useHeroClock } from './clock';
import { feedItems } from './events';
import { blockHeight, HERO_AFTER, HERO_BUMP, META_H, rowHeight, scorerLines, scorersOf, type Scorer } from './heroLayout';
import { selectPlayers, selectTeams } from './selectors';
import styles from './Hero.module.css';

/*
 * The hero (drawHero, luau:4721): the matchday and the clock, then a row per side with its crest,
 * its name, its scorers (each opens the player) and its score in big light numerals, the side
 * that trails in DIM. A goal for the open match pops the scorer's number (luau:4810).
 *
 * The crests and the score are the card → hero shared elements. Both numbers sit in one column
 * so the score lands as one piece, whatever the rows' heights.
 */

const measureScorer = (s: string) => textWidth(400, 11.5, 0, s);

export type HeroProps = {
  match: Match;
  home: Team;
  away: Team;
  matchday: number;
  width: number;
  onOpenPlayer: (player: { team: string; n: number }, from: Element) => void;
};

export const Hero = memo(function Hero({ match, home, away, matchday, width, onOpenPlayer }: HeroProps) {
  const teams = useScoreline(selectTeams);
  const players = useScoreline(selectPlayers);
  const fonts = useFontVersion();
  const scheduled = match.status === 'scheduled';

  const sides = useMemo(() => {
    const items = feedItems({ teams, players }, match);
    return (['home', 'away'] as const).map((side) => {
      const lines = scorerLines(scorersOf(items, side), measureScorer, width, scheduled);
      return { side, lines, rowH: Math.round(rowHeight(lines.length, scheduled)), blockH: blockHeight(lines.length) };
    });
    // fonts: a measure taken before the face loaded is taken again
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [match.events, match.home, match.away, teams, players, width, scheduled, fonts]);

  const [h, a] = sides as [(typeof sides)[0], (typeof sides)[0]];
  // The rows and the hero's height on whole pixels (the Lua's 48.9 rule, a row of 105.6 under three
  // scorer lines): its rows, and the tab bar and the pane under it, fade and rise in, and a block
  // resting between two pixels is drawn one way while it moves and another when it lands.
  const rule = Math.round(META_H);
  const homeTop = rule + 1;
  const awayTop = homeTop + h.rowH + 1;
  const height = awayTop + a.rowH + 1 + HERO_AFTER;
  const c = cascade('screen');
  // the side behind on the scoreboard (trails, luau:2478)
  const trails = (side: Side) => !scheduled && match.score[0] !== match.score[1] && (side === 'home') !== (match.score[0] > match.score[1]);

  return (
    <div className={styles.hero} style={{ height }}>
      <m.div className={styles.meta} variants={c} custom={0} {...CASCADE}>
        <span className={styles.matchday}>Matchday {matchday}</span>
        {match.status === 'live' ? <HeroClock match={match} /> : <span className={styles.state}>{match.status === 'finished' ? 'Full time' : `Kick-off ${match.kickoff}`}</span>}
      </m.div>
      <span className={styles.rule} style={{ top: rule }} />
      {sides.map(({ side, lines, rowH, blockH }, i) => {
        const team = side === 'home' ? home : away;
        return (
          <m.div key={side} className={styles.side} style={{ top: i === 0 ? homeTop : awayTop, height: rowH }} variants={c} custom={i + 1} {...CASCADE}>
            <span className={styles.crest}>
              <Crest team={team} size={38} />
            </span>
            <div className={styles.block} style={{ top: (rowH - blockH) / 2 }}>
              <p className={styles.name}>{team.name}</p>
              {lines.map((line, li) => (
                <div key={li} className={styles.scorers}>
                  {line.map((s, si) => (
                    <Fragment key={s.key}>
                      {si > 0 && <span className={styles.sep}> · </span>}
                      <ScorerLink scorer={s} team={team.id} onOpenPlayer={onOpenPlayer} />
                    </Fragment>
                  ))}
                </div>
              ))}
            </div>
          </m.div>
        );
      })}
      <span className={styles.rule} style={{ top: awayTop - 1 }} />
      <span className={styles.rule} style={{ top: awayTop + a.rowH }} />
      {!scheduled && (
        <m.div className={styles.scoreBlock} style={{ top: homeTop, height: awayTop + a.rowH - homeTop }} variants={c} custom={1} {...CASCADE}>
          <span className={styles.scoreCol}>
            <span className={styles.scoreCell} style={{ height: h.rowH }}>
              <BigNumber value={match.score[0]} dim={trails('home')} />
            </span>
            <span className={styles.scoreCell} style={{ height: a.rowH }}>
              <BigNumber value={match.score[1]} dim={trails('away')} />
            </span>
          </span>
        </m.div>
      )}
    </div>
  );
});

/** "58:26" in the live green after a dot, the added time apart in an outlined badge (luau:4726). */
function HeroClock({ match }: { match: Pick<Match, 'status' | 'clock'> }) {
  const [main, plus] = useHeroClock(match).split('|');
  return (
    <span className={styles.clock}>
      <span className={styles.clockDot} aria-hidden="true" />
      <span className={styles.clockMain}>{main}</span>
      {plus && <span className={styles.clockPlus}>{plus}</span>}
    </span>
  );
}

/** One side's score: L 86, DIM when that side trails; it pops when the number goes up. */
function BigNumber({ value, dim }: { value: number; dim: boolean }) {
  const ref = useRef<HTMLSpanElement>(null);
  const prev = useRef(value);
  const still = useReducedMotion() === true;
  useEffect(() => {
    const el = ref.current;
    const up = value > prev.current;
    prev.current = value;
    if (!el || !up || still) return;
    const a = animate(el, { scale: [1 + HERO_BUMP.amp, 1] }, { duration: HERO_BUMP.dur, ease: CURVES.glide });
    return () => a.stop();
  }, [value, still]);
  return (
    <span ref={ref} className={styles.score} data-dim={dim ? '' : undefined}>
      {value}
    </span>
  );
}

/** A scorer under the team's name: his name, then his minutes; it opens his page (luau:4793). */
function ScorerLink({ scorer, team, onOpenPlayer }: { scorer: Scorer; team: string; onOpenPlayer: HeroProps['onOpenPlayer'] }) {
  if (scorer.player <= 0) {
    return (
      <span className={styles.scorer}>
        <span className={styles.scorerName}>{scorer.name}</span>
        <span className={styles.scorerMins}>{scorer.minutes}</span>
      </span>
    );
  }
  return (
    <button
      type="button"
      className={`m-feel ${styles.scorer} ${styles.scorerLink}`}
      onClick={(e) => onOpenPlayer({ team, n: scorer.player }, e.currentTarget)}
      {...feel}
    >
      <span className={styles.scorerName}>{scorer.name}</span>
      <span className={styles.scorerMins}>{scorer.minutes}</span>
    </button>
  );
}
