import { memo, useEffect, type CSSProperties } from 'react';
import { animate, m, useMotionValue, useReducedMotion, useTransform, type MotionValue } from 'motion/react';
import type { Match, Team } from '../../domain';
import { transition } from '../../motion';
import { Crest, MatchClock } from '../../ui';
import { sideColors } from './colors';
import { Form } from './Facts';
import { H4 } from './H4';
import { fmtNum, homeShare, possessionOf, statLines, type StatLine } from './statLines';
import styles from './Stats.module.css';

/*
 * Stats (stats, luau:5327): possession as two big numbers that count out from 50 and a split bar
 * in the sides' colours, then the top stats, each bar opening from the middle a step after the
 * one above. Before kick-off it shows the form instead.
 */

/**
 * 0 → 1 from when the tab opens (anim(self, "stats", now, self.tabOpenT, index)). With reduced
 * motion the numbers and bars start where they end.
 */
function useOpen(index: number): MotionValue<number> {
  const reduce = useReducedMotion() === true;
  const p = useMotionValue(reduce ? 1 : 0);
  useEffect(() => {
    if (reduce) {
      p.set(1);
      return;
    }
    const a = animate(p, 1, transition('stats', { index }));
    return () => a.stop();
  }, [p, index, reduce]);
  return p;
}

export type StatsProps = { match: Match; home: Team; away: Team };

export const Stats = memo(function Stats({ match, home, away }: StatsProps) {
  if (match.status === 'scheduled') return <Form match={match} home={home} away={away} />;
  return <Played match={match} home={home} away={away} />;
});

function Played({ match, home, away }: StatsProps) {
  const [ch, ca] = sideColors(home, away);
  const t = possessionOf(match);
  const lead = t === 50 ? '' : t > 50 ? 'home' : 'away';
  const p = useOpen(0);
  const v = useTransform(p, (x) => 50 + (t - 50) * x);
  const hv = useTransform(v, (x) => String(Math.floor(x + 0.5)));
  const av = useTransform(v, (x) => String(Math.floor(100 - x + 0.5)));
  const note = lead === '' ? 'Possession shared evenly' : `${(lead === 'home' ? home : away).name} keep more of the ball`;
  const lines = statLines(match);
  const final = Math.floor(t + 0.5);
  return (
    <div className={styles.stats} style={{ '--ch': ch, '--ca': ca } as CSSProperties}>
      <section aria-label="Possession">
        <H4 left="Possession" right={<MatchClock match={match} />} />
        <div className={styles.teams}>
          <Crest team={home} size={20} className={styles.crestHome} />
          <span className={styles.nameHome}>{home.name}</span>
          <span className={styles.nameAway}>{away.name}</span>
          <Crest team={away} size={20} className={styles.crestAway} />
        </div>
        <div className={styles.possNums} role="img" aria-label={`${home.name} ${final}%, ${away.name} ${100 - final}%`}>
          <span className={styles.possSide} data-dim={lead === 'away' ? '' : undefined} aria-hidden="true">
            <m.span className={styles.possNum}>{hv}</m.span>
            <span className={styles.pct}>%</span>
          </span>
          <span className={styles.possSide} data-dim={lead === 'home' ? '' : undefined} aria-hidden="true">
            <m.span className={styles.possNum}>{av}</m.span>
            <span className={styles.pct}>%</span>
          </span>
        </div>
        <m.div className={styles.possBars} style={{ opacity: p, '--v': v } as unknown as CSSProperties} aria-hidden="true" data-bars="">
          <span className={styles.possHome} />
          <span className={styles.possAway} />
        </m.div>
        <p className={styles.note}>{note}</p>
      </section>
      <section aria-label="Top stats">
        <H4 left="Top stats" right={`${home.short} · ${away.short}`} />
        {lines.map((s, i) => (
          <StatRow key={s.key} line={s} index={i + 1} />
        ))}
      </section>
    </div>
  );
}

/** One stat (luau:5364): both values, its name between them, the split bar under them, a rule. */
function StatRow({ line, index }: { line: StatLine; index: number }) {
  const p = useOpen(index);
  const share = homeShare(line.home, line.away);
  const f = useTransform(p, (x) => 0.5 + (share - 0.5) * x);
  return (
    <div className={styles.statRow}>
      <span className={styles.statValue} data-side="home">
        {fmtNum(line.home, line.fmt)}
      </span>
      <span className={styles.statName}>{line.name}</span>
      <span className={styles.statValue} data-side="away">
        {fmtNum(line.away, line.fmt)}
      </span>
      <m.div className={styles.statBars} style={{ '--f': f } as unknown as CSSProperties} aria-hidden="true">
        <span className={styles.statHome} data-less={line.home < line.away ? '' : undefined} />
        <span className={styles.statAway} data-less={line.away < line.home ? '' : undefined} />
      </m.div>
    </div>
  );
}
