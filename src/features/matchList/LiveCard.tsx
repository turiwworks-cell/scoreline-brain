import { memo, useLayoutEffect, useRef, useState, useSyncExternalStore, type CSSProperties } from 'react';
import { liveMinute, minLabel, scoreStr, type Match, type Team } from '../../domain';
import { AT_REST, play, slide, stop } from '../../motion';
import { Crest, feel, subscribeSecond, textWidth, useFontVersion } from '../../ui';
import { cardMetrics, minuteSize, nameFit, type CardMetrics } from './cardLayout';
import { cardColors } from './cardColors';
import styles from './Live.module.css';

/*
 * One live card (drawCard, luau:3743–3880): the home team's colour above, the away team's below,
 * both teams' crests, names and the score on top, the minute in light type at the foot with its
 * progress, and a height that grows with the match. The card is as wide as its share of the strip,
 * and everything in it follows that width.
 */

export type LiveCardProps = {
  match: Match;
  home: Team;
  away: Team;
  /** its place in the strip: cards rise one after another (motion: cards) */
  index: number;
  /** the section is open: cards rise in; closed, they settle and fade (motion: live) */
  open: boolean;
  /** the match has ended and the card is folding away */
  leaving: boolean;
  /** it arrived while Live was open: it grows in from nothing and does not rise */
  grow: boolean;
  /** the match is open beside the list */
  current: boolean;
  onOpen: (el: Element) => void;
};

// the cards rise from below the strip (AREA_H + 40, luau:3907), and on leaving settle 28 px and fade
const RISE = 244 + 40;
const SETTLE = 28;

/*
 * Entrance and exit are the Lua's, a function of the time since Live was switched (drawCards,
 * luau:3906–3913): on, every card drops to RISE below the strip at full opacity and rises in turn
 * (motion: cards); off, every card settles 28 px and fades in turn (motion: live) while its rise
 * carries on. Each switch replays from the start, so toggling Live quickly looks the same every
 * time and answers at once. Two wrappers keep the two motions apart: `.rise` and `.settle`.
 */
function useEntrance(open: boolean, index: number, grow: boolean) {
  const rise = useRef<HTMLDivElement>(null);
  const settle = useRef<HTMLDivElement>(null);
  const latest = useRef({ index, grow, first: true });
  useLayoutEffect(() => {
    latest.current.index = index;
    latest.current.grow = grow;
  });
  useLayoutEffect(() => {
    const { index: i, grow: late, first } = latest.current;
    latest.current.first = false;
    if (open) {
      stop(settle.current);
      // a match that kicks off while Live is open grows in where it stands (its width, luau:3906)
      if (first && late) return;
      play(rise.current, 'cards', [{ transform: slide(0, RISE) }, { transform: AT_REST }], { index: i });
    } else if (first) {
      // arrives while the section is closing: nothing to show
      play(settle.current, 'live', [{ opacity: 0 }, { opacity: 0 }], { index: 0, withDelay: false });
    } else {
      play(settle.current, 'live', [{ transform: AT_REST, opacity: 1 }, { transform: slide(0, SETTLE), opacity: 0 }], { index: i });
    }
  }, [open]);
  return { rise, settle };
}

export const LiveCard = memo(function LiveCard({ match, home, away, index, open, leaving, grow, current, onOpen }: LiveCardProps) {
  const colors = cardColors(home, away);
  // grow from nothing for a card that arrives late: mount at 0, and one frame later let it settle
  const [entering, setEntering] = useState(grow);
  useLayoutEffect(() => {
    if (!grow) return;
    const raf = requestAnimationFrame(() => setEntering(false));
    return () => cancelAnimationFrame(raf);
  }, [grow]);
  const { rise, settle } = useEntrance(open, index, grow);

  // The card's own layout width. Never the drawn box: the press dip, the goal's step and the
  // entrance all scale or move it, and reading those back would re-lay the card every frame.
  const ref = useRef<HTMLButtonElement>(null);
  const [w, setW] = useState(70);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const read = () => setW(el.offsetWidth || 70);
    read();
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(read);
    ro?.observe(el);
    return () => ro?.disconnect();
  }, []);

  // the minute and the height are written once a second, not rendered (ARCHITECTURE §4.6)
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const write = () => {
      const t = liveMinute(match, Date.now());
      el.style.setProperty('--mm', String(Math.min(t.minute + t.second / 60, 90)));
    };
    write();
    return match.status === 'live' ? subscribeSecond(write) : undefined;
  }, [match]);

  const fonts = useFontVersion();
  const mt = cardMetrics(w);
  const score = match.score;
  const names = [
    { team: home, v: score[0], trails: score[0] < score[1] },
    { team: away, v: score[1], trails: score[1] < score[0] },
  ];
  const style = {
    '--g0': colors.stops[0],
    '--g1': colors.stops[1],
    '--g2': colors.stops[2],
    '--g3': colors.stops[3],
    '--hot-h': colors.hot[0],
    '--hot-a': colors.hot[1],
    '--halo-h': colors.halo[0],
    '--halo-a': colors.halo[1],
  } as CSSProperties;
  const label = `${home.name} ${scoreStr(score[0], score[1])} ${away.name}, ${match.status === 'live' ? 'live' : 'full time'}`;

  return (
    <div className={styles.slot} data-leaving={leaving ? '' : undefined} data-grow={entering ? '0' : undefined}>
      <div ref={rise} className={styles.rise}>
      <div ref={settle} className={styles.settle}>
      <button
        ref={ref}
        type="button"
        className={`m-feel ${styles.card}`}
        style={style}
        data-card={match.id}
        data-focus-key={`live-${match.id}`}
        data-ended={match.status === 'finished' ? '' : undefined}
        aria-label={label}
        aria-current={current ? 'true' : undefined}
        onClick={(e) => onOpen(e.currentTarget)}
        {...feel}
      >
        <span className={styles.halo} aria-hidden="true" />
        <span className={styles.surface}>
          <span className={styles.sweep} aria-hidden="true" />
          {names.map(({ team, v, trails }, i) => (
            <TeamLine key={i} team={team} v={v} trails={trails} m={mt} w={w} y={mt.pad + i * (mt.crest + mt.rowGap)} fonts={fonts} />
          ))}
          <Scores values={[score[0], score[1]]} trails={[score[0] < score[1], score[1] < score[0]]} m={mt} />
          <Foot match={match} m={mt} w={w} fonts={fonts} />
        </span>
        {current && <span className={styles.marker} aria-hidden="true" />}
      </button>
      </div>
      </div>
    </div>
  );
});

function TeamLine({ team, v, trails, m: mt, w, y, fonts }: { team: Team; v: number; trails: boolean; m: CardMetrics; w: number; y: number; fonts: number }) {
  void fonts;
  const scoreW = textWidth(700, mt.score, 0, String(v));
  const fit = nameFit(w, mt, {
    score: scoreW,
    name: textWidth(600, mt.name, 0, team.name),
    nameDrawn: textWidth(600, mt.name, 0.02, team.name),
    short: textWidth(600, mt.name, 0.02, team.short),
  });
  const text = fit.choice === 'name' ? team.name : team.short;
  return (
    <span className={styles.row} style={{ top: y, height: mt.crest, paddingLeft: mt.pad, paddingRight: mt.pad + scoreW + 6 }} data-trails={trails ? '' : undefined}>
      <span className={styles.crestEnd}>
        <Crest team={team} size={mt.crest} />
      </span>
      <span className={styles.name} style={{ marginLeft: mt.nameGap, fontSize: fit.size }} data-hidden={fit.choice === 'none' ? '' : undefined} aria-hidden="true">
        {text}
      </span>
    </span>
  );
}

function Scores({ values, trails, m: mt }: { values: [number, number]; trails: [boolean, boolean]; m: CardMetrics }) {
  return (
    <span className={styles.scores} style={{ top: mt.pad, right: mt.pad, gap: mt.rowGap, fontSize: mt.score }}>
      {values.map((v, i) => (
        <span key={i} className={styles.score} style={{ height: mt.crest, ['--bump' as string]: `var(--bump-${i === 0 ? 'h' : 'a'}, 1)`, ['--mk' as string]: `var(--mk-${i === 0 ? 'h' : 'a'}, 0)` }} data-trails={trails[i] ? '' : undefined}>
          <span className={styles.num}>
            <span className={styles.ink}>{v}</span>
            <span className={styles.spectrum} aria-hidden="true">
              {v}
            </span>
          </span>
        </span>
      ))}
    </span>
  );
}

/** The minute, the track and its progress (luau:3860–3870). */
function Foot({ match, m: mt, w, fonts }: { match: Match; m: CardMetrics; w: number; fonts: number }) {
  void fonts;
  const live = match.status === 'live';
  const label = useSyncExternalStore(
    live ? subscribeSecond : idle,
    () => (match.status === 'finished' ? 'FT' : minLabel(match, Date.now())),
    () => minLabel(match, 0),
  );
  const size = minuteSize(mt, w, textWidth(300, mt.minute, -0.03, label));
  return (
    <>
      <span className={styles.clock} style={{ left: mt.pad - size * 0.03, bottom: mt.pad + 9 - 0.3 * size, fontSize: size }}>
        {label}
      </span>
      <span className={styles.track} style={{ left: mt.pad, right: mt.pad, bottom: mt.pad }}>
        <span className={styles.fill} />
        <span className={styles.dot} />
      </span>
    </>
  );
}

const idle = () => () => {};

