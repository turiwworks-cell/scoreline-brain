import { memo, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { cubicBezier, m, type Variants } from 'motion/react';
import { minText, type Match, type Team } from '../../domain';
import { timing, transition } from '../../motion';
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
  hidden: { opacity: 0, y: -12 },
  shown: (i: number) => ({ opacity: 1, y: 0, transition: transition('events', { index: i }) }),
  faded: { opacity: 0 },
  all: (i: number) => ({ opacity: 1, transition: transition('events', { index: i }) }),
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
    const rest = () => {
      for (const s of slots) {
        s.style.transform = '';
        s.style.opacity = '';
      }
      if (rail) rail.style.transform = '';
      if (after) after.style.transform = '';
      feed.style.clipPath = '';
    };
    let raf = 0;
    if (!(g.until > clock())) {
      rest();
      // rows chosen while one was still opening, and the motion ended unseen (a hidden tab, a
      // re-render at its end): choose them again
      if (g.until > -Infinity) raf = requestAnimationFrame(() => setAt(clock()));
      return () => cancelAnimationFrame(raf);
    }
    const frameRows: FrameRow[] = rows.map((r, j) => ({
      h: slots[j]?.offsetHeight ?? 0,
      start: r.kind === 'e' ? (startOf.get(r.key) ?? OLD) : OLD,
      index: r.kind === 'e' ? r.index : 0,
    }));
    const full = frameRows.reduce((s, r) => s + r.h, 0);
    const frame = () => {
      const now = clock();
      const f = feedFrame(frameRows, { now, evAll, growing: g.growing, foldT: g.foldT, limit: LIMIT, t });
      slots.forEach((s, j) => {
        s.style.transform = f.lift[j] ? `translateY(${-f.lift[j]!}px)` : '';
        s.style.opacity = f.alpha[j] === 1 ? '' : String(f.alpha[j]);
      });
      if (rail) rail.style.transform = `scaleY(${full > 36 ? Math.max(0, full - f.end - 36) / (full - 36) : 0})`;
      if (after) after.style.transform = f.end ? `translateY(${-f.end}px)` : '';
      feed.style.clipPath = `inset(0 0 ${f.end - 1}px 0)`;
      if (now < g.until) raf = requestAnimationFrame(frame);
      else {
        rest();
        // the rows that folded away go now
        setAt(now);
      }
    };
    frame();
    return () => cancelAnimationFrame(raf);
    // rowsKey and the starts stand for `rows` and `startOf`, which are new objects every render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rowsKey, starts.join('|'), evAll, g.until, g.growing, g.foldT]);

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
                initial={(startOf.get(row.key) ?? OLD) !== OLD ? false : row.index > LIMIT && evAll ? 'faded' : 'hidden'}
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
