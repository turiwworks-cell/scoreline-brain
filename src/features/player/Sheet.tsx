import { memo, useEffect, useLayoutEffect, useRef, type CSSProperties } from 'react';
import { animate, m, useTransform, type MotionValue } from 'motion/react';
import { CASCADE, cascade, CURVES } from '../../motion';
import type { Match, Player, PStats, Team } from '../../domain';
import { Glass, pastel, ratingTone, Tag, textWidth, useFontVersion } from '../../ui';
import { barsOf, factsOf, fitSize, notPlayed, roleLabel, type Bar, type MatchTag, type Substitution } from './model';
import styles from './PlayerView.module.css';

/*
 * What is under him (luau:6009–6100): his name, his facts, and how his evening went. Each block
 * rises in on the player timing (motion: player), one after another; a block's hair-lines and
 * labels are the Lua's own numbers, measured from the top of the block.
 */

const lift = (i: number) => i;

/** The Lua's baseline y for a line: the top of a line box 1.2 high puts its baseline 0.9485em below it (bc, luau:1630). */
const baseline = (y: number): CSSProperties => ({ top: `calc(${y}px - 0.9485em)` });

export type InfoProps = {
  player: Player | undefined;
  team: Team;
  n: number;
  fallbackName: string;
  slide: MotionValue<number>;
  stepped: boolean;
};

/** first name, surname with his shirt number hanging at its top right, role and team (luau:6000). */
export const Info = memo(function Info({ player, team, n, fallbackName, slide, stepped }: InfoProps) {
  useFontVersion();
  const c = cascade('player', { lift: 14 });
  const first = player?.first ?? '';
  const last = player ? player.last : fallbackName;
  const full = first === '' ? last : `${first} ${last}`;
  const num = String(n);
  const nfs = 15;
  const nw = textWidth(300, nfs, -0.02, num);
  const ls = fitSize(40, textWidth(500, 40, -0.03, last), 340 - 2 * (nw + 7));
  const lastW = textWidth(500, ls, -0.03, last);
  const x = useTransform(slide, (v) => v * 0.4);
  return (
    <m.div className={styles.info} variants={c} custom={lift(0)} initial={stepped ? false : CASCADE.initial} animate={CASCADE.animate} transformTemplate={CASCADE.transformTemplate} data-pv="info">
      <m.div className={styles.infoSlide} style={{ x }}>
      <span className={`${styles.line} ${styles.first}`} style={baseline(0)}>
        {first}
      </span>
      <h1 className={`${styles.line} ${styles.last}`} style={{ ...baseline(42), fontSize: ls }} tabIndex={-1} aria-label={full} data-screen-heading="" data-pv="name">
        {last}
      </h1>
      <span className={styles.shirt} style={{ ...baseline(42 - 0.697 * (ls - nfs)), left: `calc(50% + ${lastW / 2 + 7}px)` }} aria-hidden="true">
        {num}
      </span>
      <span className={`${styles.line} ${styles.role}`} style={baseline(66)}>
        {roleLabel(player)} · {team.name}
      </span>
      </m.div>
    </m.div>
  );
});

/** Club, age, height and shirt in a row between two hair-lines (luau:6030). */
export const Facts = memo(function Facts({ player, team, n, now, stepped }: { player: Player | undefined; team: Team; n: number; now: Date; stepped: boolean }) {
  useFontVersion();
  const c = cascade('player', { lift: 14 });
  const cells = factsOf(player, team, n, now);
  const cw = 354 / cells.length;
  return (
    <m.div className={styles.facts} variants={c} custom={lift(1)} initial={stepped ? false : CASCADE.initial} animate={CASCADE.animate} transformTemplate={CASCADE.transformTemplate} data-pv="facts">
      {cells.map((cell, i) => (
        <div key={cell.label} className={styles.cell} style={{ width: cw }} data-pv="fact">
          {i > 0 && <span className={styles.divider} aria-hidden="true" />}
          <span className={styles.label} style={{ ...baseline(24), left: i === 0 ? 0 : 10 }}>
            {cell.label}
          </span>
          <span className={styles.value} style={{ ...baseline(47), left: i === 0 ? 0 : 10, fontSize: fitSize(15, textWidth(500, 15, 0, cell.value), cw - 14) }}>
            {cell.value}
          </span>
        </div>
      ))}
    </m.div>
  );
});

/** A number that glides to its target in 0.7 s on GLIDE (retarget, luau:6086), written to the DOM. */
function useGlideText(target: number, from: number, seconds: number, write: (v: number) => void) {
  const current = useRef(from);
  const put = useRef(write);
  useLayoutEffect(() => {
    put.current = write;
  });
  useEffect(() => {
    const controls = animate(current.current, target, {
      duration: seconds,
      ease: CURVES.glide,
      onUpdate: (v) => {
        current.current = v;
        put.current(v);
      },
    });
    return () => controls.stop();
  }, [target, seconds]);
  useEffect(() => put.current(current.current), []);
}

/** His rating in its coloured box: it glides from 6.0 to his rating and takes the colour of each value on the way. */
const RatingBox = memo(function RatingBox({ value }: { value: number }) {
  const box = useRef<HTMLSpanElement>(null);
  const num = useRef<HTMLSpanElement>(null);
  useGlideText(value, 6, 0.6, (v) => {
    const tone = ratingTone(v);
    box.current?.style.setProperty('--bg', tone.bg ?? 'var(--spectrum-3)');
    if (box.current) box.current.style.color = tone.fg;
    if (num.current) num.current.textContent = v.toFixed(1);
  });
  return (
    <span ref={box} className={styles.rating} role="img" aria-label={`Rating ${value.toFixed(1)}`} data-pv="rating">
      <span ref={num} className={styles.ratingNum} aria-hidden="true">
        6.0
      </span>
      <span className={styles.ratingLabel} aria-hidden="true">
        RATING
      </span>
    </span>
  );
});

const TAG_ICON = { goal: 'goal', assist: 'assist', yellow: 'yellow', red: 'red' } as const;

function BarRow({ bar, fill }: { bar: Bar; fill: string }) {
  const value = useRef<HTMLSpanElement>(null);
  const track = useRef<HTMLSpanElement>(null);
  useGlideText(bar.value, 0, 0.7, (v) => {
    if (value.current) value.current.textContent = `${Math.floor(v + 0.5)}${bar.percent ? '%' : ''}`;
    if (track.current) track.current.style.width = `${Math.max(5, 354 * Math.min(Math.max(v / bar.max, 0), 1))}px`;
  });
  return (
    <div className={styles.barRow} data-pv="stat">
      <span className={styles.barLabel}>{bar.label}</span>
      <span ref={value} className={styles.barValue} />
      <span className={styles.barTrack} aria-hidden="true">
        <span ref={track} className={styles.barFill} style={{ background: fill }} />
      </span>
    </div>
  );
}

export type MatchBlockProps = {
  match: Match;
  stats: PStats;
  tags: readonly MatchTag[];
  team: Team;
  keeper: boolean;
  /** the clock: his minutes tick while he is on */
  stepped: boolean;
};

/** This match (luau:6055): how long he played, his rating, what he did, and his numbers as bars. */
export const MatchBlock = memo(function MatchBlock({ match, stats, tags, team, keeper, stepped }: MatchBlockProps) {
  useFontVersion();
  const c = cascade('player', { lift: 14 });
  const initial = stepped ? false : CASCADE.initial;
  if (!stats.played) {
    const note = notPlayed(match.status, match.kickoff);
    return (
      <m.div className={styles.match} variants={c} custom={lift(2)} initial={initial} animate={CASCADE.animate} transformTemplate={CASCADE.transformTemplate} data-pv="match" data-played="no">
        <div className={styles.matchHead}>
          <span className={styles.label}>This match</span>
          <span className={`${styles.label} ${styles.ink}`}>{note.head}</span>
        </div>
        <Glass radius={18} className={styles.note}>
          {note.body}
        </Glass>
      </m.div>
    );
  }
  const hasRating = stats.rating > 0;
  const bars = stats.real ? barsOf(stats, keeper) : [];
  const fill = pastel(team.colors[0]);
  return (
    <>
      <m.div className={styles.match} variants={c} custom={lift(2)} initial={initial} animate={CASCADE.animate} transformTemplate={CASCADE.transformTemplate} data-pv="match" data-played="yes">
        <div className={styles.matchHead}>
          <span className={styles.label}>This match</span>
          <span className={`${styles.label} ${styles.ink}`}>{stats.mins} min</span>
        </div>
        <div className={styles.did}>
          {hasRating && <RatingBox value={stats.rating} />}
          <div className={styles.tags} data-with-rating={hasRating ? '' : undefined}>
            {tags.length === 0 && <span className={styles.none}>No goals or assists yet</span>}
            {tags.map((t) => (
              <Glass key={t.kind} radius={14} className={styles.tag} data-pv="tag" data-kind={t.kind}>
                <Tag kind={TAG_ICON[t.kind]} size={16} />
                <span>{t.label}</span>
              </Glass>
            ))}
          </div>
        </div>
      </m.div>
      <m.div className={styles.numbers} variants={c} custom={lift(3)} initial={initial} animate={CASCADE.animate} transformTemplate={CASCADE.transformTemplate} data-pv="numbers">
        {!stats.real && <p className={styles.pending}>
            <span>Player numbers will show once the data has them.</span>
          </p>}
        {bars.map((b) => (
          <BarRow key={b.label} bar={b} fill={fill} />
        ))}
      </m.div>
    </>
  );
});

/** Off or on at the top of the page, a red or green arrow and the minute (luau:6118). */
export const SubTag = memo(function SubTag({ sub }: { sub: Substitution }) {
  return (
    <Glass thin radius={15} className={styles.sub} data-pv="sub" data-off={sub.off ? '' : undefined}>
      <Tag kind={sub.off ? 'subOut' : 'subIn'} size={16} />
      <span>
        {sub.off ? 'Off' : 'On'} {sub.minute}&apos;
      </span>
    </Glass>
  );
});
