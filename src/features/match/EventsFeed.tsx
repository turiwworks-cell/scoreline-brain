import { memo, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { cubicBezier, m, useReducedMotion, type Variants } from 'motion/react';
import { minText, type Match, type Team } from '../../domain';
import { AT_REST, HAIR, LANDED, slide, timing, transition } from '../../motion';
import { useScoreline } from '../../store';
import { Button, Crest, Icon, matchStops, PhotoTile, Pill, withFeel } from '../../ui';
import { useMatchMinute } from './clock';
import { sideColors } from './colors';
import { feedItems, feedRows, KIND_LABEL, LIMIT, markerLabel, type FeedItem, type FeedRow } from './events';
import { feedFrame, growth, OLD, startsOf, type FeedTiming, type FrameRow } from './feedMotion';
import { selectPlayers, selectTeams } from './selectors';
import styles from './Panels.module.css';

/*
 * The commentary (eventsFeed, luau:5052): newest first, a half-time marker, kick-off at the end,
 * the first ten rows and a "Show all" button. Rows that were there when the tab opened come in
 * one after another from above; an event that arrives live opens its row at the top and the
 * rows under it slide down a frame behind each other (feedMotion.ts). Everything under the feed
 * (`children`) moves with its end.
 *
 * The motion writes transforms and opacity straight to the rows while it runs; React renders the
 * rows and decides which show.
 */

const clock = () => performance.now() / 1000;

function feedTiming(): FeedTiming {
  const t = timing('events');
  return { duration: t.duration, delay: t.delay, curve: cubicBezier(...t.ease) };
}

// the tab's opening cascade (open, luau:5165): from 12 px above, row i after i × stagger, at most
// twelve apart; rows shown by "Show all" fade in one after another (luau:5172)
const rowIn: Variants = {
  hidden: { opacity: 0, transform: slide(0, -12) },
  shown: (i: number) => ({ opacity: 1, transform: AT_REST, transitionEnd: LANDED, transition: transition('events', { index: i }) }),
  faded: { opacity: 0 },
  all: (i: number) => ({ opacity: 1, transition: transition('events', { index: Math.min(i, 12) }) }),
};

export type EventsFeedProps = {
  match: Match;
  home: Team;
  away: Team;
  onReplayGoal?: (eventId: string) => void;
  children?: ReactNode;
};

export const EventsFeed = memo(function EventsFeed({ match, home, away, onReplayGoal, children }: EventsFeedProps) {
  const teams = useScoreline(selectTeams);
  const players = useScoreline(selectPlayers);
  const { home: hid, away: aid, events } = match;
  // the clock turning changes the match, not its events: the rows stay the same objects
  const items = useMemo(() => feedItems({ teams, players }, { home: hid, away: aid, events }), [teams, players, hid, aid, events]);
  const minute = useMatchMinute(match);
  const [evAll, setEvAll] = useState(false);
  // with reduced motion a new row is simply there (transforms jump, ARCHITECTURE §5)
  const still = useReducedMotion() === true;

  // when this feed first saw each event (the Lua's e.t0): those there when it opened count as old.
  // Stamped while rendering, the moment a new list of events comes in.
  const [seen, setSeen] = useState(() => ({ items, born: new Map(items.map((e) => [e.id, OLD])) as ReadonlyMap<string, number> }));
  // the moment the rows were last chosen for; moved on when an event arrives or a motion ends.
  // It starts at the clock's origin, long after the rows that were already there (OLD) settled.
  const [at, setAt] = useState(0);
  let born = seen.born;
  if (seen.items !== items) {
    const fresh = items.filter((e) => !born.has(e.id));
    if (fresh.length > 0) {
      const now = clock();
      const next = new Map(born);
      for (const e of fresh) next.set(e.id, now);
      born = next;
      setAt(now);
    }
    setSeen({ items, born });
  }

  const t = feedTiming();
  const starts = startsOf(items.map((e) => born.get(e.id) ?? OLD));
  const g = growth(starts, at, t, LIMIT);
  const shown = evAll ? items.length : Math.min(items.length, LIMIT + g.growing);
  const rows = feedRows(items, shown, minute);
  const startOf = new Map(items.map((e, i) => [e.id, starts[i]!]));

  // ---- the live motion: written straight to the rows while it runs -------------------------
  const feedRef = useRef<HTMLDivElement>(null);
  const railRef = useRef<HTMLDivElement>(null);
  const afterRef = useRef<HTMLDivElement>(null);
  const rowsKey = rows.map((r) => r.key).join('|');
  useLayoutEffect(() => {
    const feed = feedRef.current;
    if (!feed) return;
    const slots = Array.from(feed.querySelectorAll<HTMLElement>(':scope > [data-row]'));
    const rail = railRef.current;
    const after = afterRef.current;
    // at rest the rows and what follows them keep the hair they slide with (variants.ts), so they
    // stand on the pixels they moved on
    const rest = () => {
      for (const s of slots) {
        s.style.transform = HAIR;
        s.style.opacity = '';
      }
      if (rail) rail.style.transform = '';
      if (after) after.style.transform = HAIR;
      feed.style.clipPath = '';
    };
    const left = g.until - clock();
    if (still || !(left > 0) || typeof feed.animate !== 'function') {
      rest();
      // the rows were chosen while one was still opening: choose them again once it has (at once
      // when that passed unseen, in a hidden tab or a re-render at the motion's end)
      if (g.until === -Infinity) return;
      const timer = setTimeout(() => setAt(clock()), Math.max(0, left) * 1000);
      return () => clearTimeout(timer);
    }
    const frameRows: FrameRow[] = rows.map((r, j) => ({
      h: slots[j]?.offsetHeight ?? 0,
      start: r.kind === 'e' ? (startOf.get(r.key) ?? OLD) : OLD,
      index: r.kind === 'e' ? r.index : 0,
    }));
    const full = frameRows.reduce((s, r) => s + r.h, 0);
    // The motion from now to its end, baked into keyframes a frame apart and run by the compositor: the
    // rows slide with a hair of rotation (slide, variants.ts), drawn between pixels rather than a pixel at
    // a time, and the main thread's work can't stall them. When it ends they rest on the hair (rest).
    const now = clock();
    const steps = Math.max(1, Math.ceil(left * 60));
    const kf = { slots: slots.map((): Keyframe[] => []), rail: [] as Keyframe[], after: [] as Keyframe[], clip: [] as Keyframe[] };
    let ends = false;
    for (let k = 0; k <= steps; k++) {
      const offset = k / steps;
      const f = feedFrame(frameRows, { now: now + offset * left, evAll, growing: g.growing, foldT: g.foldT, limit: LIMIT, t });
      slots.forEach((_, j) => kf.slots[j]!.push({ offset, transform: slide(0, -(f.lift[j] ?? 0)), opacity: f.alpha[j] ?? 1 }));
      kf.rail.push({ offset, transform: `scaleY(${full > 36 ? Math.max(0, full - f.end - 36) / (full - 36) : 0})` });
      kf.after.push({ offset, transform: slide(0, -f.end) });
      kf.clip.push({ offset, clipPath: `inset(0 0 ${f.end - 1}px 0)` });
      ends ||= f.end !== 0;
    }
    const run = { duration: left * 1000, easing: 'linear', fill: 'both' } as const;
    // a row that stays put all the while gets no animation (nor a layer)
    const stays = (frames: Keyframe[]) => frames.every((f) => f.transform === AT_REST && f.opacity === 1);
    const anims = [
      ...slots.map((s, j) => (stays(kf.slots[j]!) ? undefined : s.animate(kf.slots[j]!, run))),
      rail?.animate(kf.rail, run),
      ends ? after?.animate(kf.after, run) : undefined,
      feed.animate(kf.clip, run),
    ];
    const done = anims.at(-1)!;
    let live = true;
    done.finished.then(
      () => {
        if (!live) return;
        for (const a of anims) a?.cancel();
        rest();
        // the rows that folded away go now
        setAt(clock());
      },
      () => {},
    );
    return () => {
      live = false;
      for (const a of anims) a?.cancel();
    };
    // rowsKey and the starts stand for `rows` and `startOf`, which are new objects every render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rowsKey, starts.join('|'), evAll, g.until, g.growing, g.foldT, still]);

  if (items.length === 0) {
    return (
      <>
        <p className={styles.kickoffSoon}>Kick-off soon</p>
        {children}
      </>
    );
  }

  const [hc, ac] = sideColors(home, away);
  const stops = matchStops(home, away);
  return (
    <>
      <div ref={feedRef} className={styles.feed}>
        <div ref={railRef} className={styles.rail} aria-hidden="true" />
        {rows.map((row, ri) => (
          <div key={row.key} className={styles.slot} data-row={row.kind}>
            {row.kind === 'e' ? (
              <m.div
                variants={rowIn}
                custom={row.index > LIMIT && evAll ? row.index - LIMIT - 1 : Math.min(ri, 12)}
                // a row that arrived while the feed was open has its own motion (written below); the rest
                // cascade in when the tab opens, or fade in after "Show all". Its birth, not its start:
                // startsOf staggers rows born together, so only the first old row's start is OLD.
                initial={(born.get(row.key) ?? OLD) !== OLD ? false : row.index > LIMIT && evAll ? 'faded' : 'hidden'}
                animate={row.index > LIMIT && evAll ? 'all' : 'shown'}
              >
                <EventRow
                  item={row.item}
                  team={row.item.side === 'home' ? home : away}
                  color={row.item.side === 'home' ? hc : ac}
                  stops={stops}
                  onReplay={onReplayGoal}
                />
              </m.div>
            ) : (
              <Marker row={row} items={items} />
            )}
          </div>
        ))}
      </div>
      <div ref={afterRef}>
        {items.length > LIMIT && (
          <div className={styles.showAll}>
            <Button height={36} label={evAll ? 'Show less' : `Show all ${items.length} events`} onClick={() => setEvAll((v) => !v)} />
          </div>
        )}
        {children}
      </div>
    </>
  );
});

function Marker({ row, items }: { row: FeedRow & { kind: 'ht' | 'ko' }; items: readonly FeedItem[] }) {
  return (
    <div className={styles.marker}>
      <Pill size="label">{markerLabel(row.kind, items)}</Pill>
    </div>
  );
}

type RowProps = {
  item: FeedItem;
  team: Team;
  /** the side's colour (sideColors) */
  color: string;
  stops: readonly [string, string, string, string];
  onReplay?: (eventId: string) => void;
};

const EventRow = memo(function EventRow(p: RowProps) {
  if (p.item.kind === 'goal') return <GoalRow {...p} />;
  if (p.item.kind === 'sub') return <SubRow {...p} />;
  return <PlainRow {...p} />;
});

const minClass = (min: number) => (min > 90 ? `${styles.min} ${styles.minLong}` : styles.min);

/** A goal (luau:5182): the scorer's face, GOAL, his name and the assist, the score in the match's colours. */
function GoalRow({ item, team, color, stops, onReplay }: RowProps) {
  const body = (
    <>
      <span className={minClass(item.minute)} data-tone="text">
        {minText(item.minute)}
      </span>
      <span className={styles.goalNode} style={{ '--c': color } as CSSProperties} aria-hidden="true" />
      <span className={styles.goalPhoto}>
        <PhotoTile size={42} team={team} n={item.player} alt="" />
      </span>
      <span className={styles.goalKind}>{item.cancelled ? KIND_LABEL.goalCancelled : KIND_LABEL.goal}</span>
      <span className={styles.goalWho}>
        <span className={styles.goalName}>{item.name}</span>
        {item.other !== '' && <span className={styles.goalAssist}>Assist {item.other}</span>}
      </span>
      <span className={styles.chip} style={{ background: `linear-gradient(90deg, ${stops[0]} 0%, ${stops[1]} 42%, ${stops[2]} 62%, ${stops[3]} 100%)` }}>
        {item.score}
      </span>
      <Icon name="chevR" className={styles.chev} />
      <span className={styles.goalText}>{item.text}</span>
    </>
  );
  const cls = `${styles.row} ${styles.goal}`;
  // a goal VAR took back has no replay
  if (!onReplay || item.cancelled) {
    return (
      <div className={cls} data-cancelled={item.cancelled ? '' : undefined}>
        {body}
      </div>
    );
  }
  return (
    <button type="button" className={`m-feel ${cls} ${styles.goalButton}`} {...withFeel({ onClick: () => onReplay(item.id) })}>
      {body}
    </button>
  );
}

/** A substitution (subRow, luau:5023): centred and a touch larger, the minute beside it. */
function SubRow({ item, team }: RowProps) {
  return (
    <div className={`${styles.row} ${styles.sub}`}>
      <span className={styles.subNode} aria-hidden="true" />
      <div className={styles.subBox}>
        <span className={styles.subMin}>{minText(item.minute)}</span>
        <span className={styles.subBody}>
          <span className={styles.subHead}>
            <Crest team={team} size={13} />
            <span className={styles.label}>{KIND_LABEL.sub}</span>
          </span>
          <span className={styles.subWho}>
            <Icon name="up" className={styles.subUp} label="On" />
            <span className={styles.subOn}>{item.name}</span>
            <Icon name="down" className={styles.subDown} label="Off" />
            <span className={styles.subOff}>{item.other}</span>
          </span>
        </span>
      </div>
    </div>
  );
}

/** Any other event (luau:5210): a card or a quiet dot on the rail, the crest, what it was, the line. */
function PlainRow({ item, team, color }: RowProps) {
  const card = item.kind === 'yellow' || item.kind === 'red';
  return (
    <div className={`${styles.row} ${styles.plain}`}>
      <span className={minClass(item.minute)}>{minText(item.minute)}</span>
      {card ? (
        <span className={styles.cardNode} data-kind={item.kind} aria-hidden="true" />
      ) : (
        <span className={styles.dotNode} style={{ '--c': color } as CSSProperties} aria-hidden="true" />
      )}
      <Crest team={team} size={13} className={styles.plainCrest} />
      <span className={styles.plainKind} data-kind={item.kind}>
        {KIND_LABEL[item.kind]}
      </span>
      {item.text !== '' && <span className={styles.plainText}>{item.text}</span>}
    </div>
  );
}
