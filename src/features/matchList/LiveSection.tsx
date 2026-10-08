import { useEffect, useMemo, useRef, useState } from 'react';
import { useReducedMotionPreference } from '../../motion/useReducedMotionPreference';
import type { Match, Team } from '../../domain';
import { timing } from '../../motion';
import { selectCardIds, selectMatchOrder } from './selectors';
import { selectMatch, selectTeam, useScoreline } from '../../store';
import { cardOrder } from './groups';
import { cardFeel, greyOf, stepScale, type GoalMark } from './goalFeel';
import { goalFeed, type GoalFeed } from './goalFeed';
import { startFrames } from './frames';
import { LiveCard } from './LiveCard';
import styles from './Live.module.css';

/*
 * The Live section (luau:4533–4550, drawCards luau:3766–3924): a header, then every live match as
 * a tall card, favourites first. It opens to 300 px with the page's Live tween and pushes the list
 * down; the cards rise in turn when it opens and settle and fade in turn when it closes. A match
 * that ends stays a moment, fades and folds away; a match that kicks off grows in.
 */

/** How long a finished match's card stays on stage: it fades over 0.45 s and folds over 0.7 s (luau:3780). */
export const STAY_MS = 900;

export type LiveSectionProps = {
  open: boolean;
  /** the match open beside the list, if any */
  openId?: number;
  onOpen: (id: number, from: Element) => void;
  feed?: GoalFeed;
};

export function LiveSection({ open, openId, onOpen, feed = goalFeed }: LiveSectionProps) {
  const live = useScoreline(selectCardIds);
  const order = useScoreline(selectMatchOrder);
  const stage = useStage(live, order);
  // The section's state as of the last switch, in one value so its parts never disagree (several
  // separate states adjusted during a render did, and the first close lost its cards at once):
  // - risers: the cards on stage when Live was switched on rise; a match that kicks off after
  //   that, while the section is open, grows in where it stands instead;
  // - settled: closed, and every card has finished settling, so none is drawn.
  const [phase, setPhase] = useState(() => ({ open, risers: new Set(live) as ReadonlySet<number>, settled: !open }));
  if (phase.open !== open) setPhase({ open, risers: open ? new Set(stage.ids) : phase.risers, settled: false });
  useEffect(() => {
    if (open) return;
    const t = timing('live');
    const ms = (t.duration + t.delay + t.stagger * Math.max(stage.ids.length - 1, 0)) * 1000 + 100;
    const id = setTimeout(() => setPhase((p) => (p.open ? p : { ...p, settled: true })), ms);
    return () => clearTimeout(id);
  }, [open, stage.ids.length]);

  const root = useRef<HTMLDivElement>(null);
  useGoalFrames(root, stage.ids, feed);

  return (
    <section className={styles.section} aria-label="Live now" aria-hidden={open ? undefined : true} data-open={open ? '' : undefined}>
      <div className={styles.inner}>
        <div className={styles.head}>
          <span className={`${styles.label} ${styles.title}`}>Live now</span>
          <span className={`${styles.label} ${styles.count}`}>{live.length} in play</span>
        </div>
        <div ref={root} className={styles.strip}>
          {(open || !phase.settled) &&
            stage.ids.map((id, i) => <Card key={id} id={id} index={i} open={open} leaving={stage.leaving.has(id)} grow={!phase.risers.has(id)} current={id === openId} onOpen={onOpen} />)}
        </div>
      </div>
    </section>
  );
}

function Card({ id, index, open, leaving, grow, current, onOpen }: { id: number; index: number; open: boolean; leaving: boolean; grow: boolean; current: boolean; onOpen: (id: number, from: Element) => void }) {
  const match = useScoreline(selectMatch(id)) as Match | undefined;
  const home = useScoreline(selectTeam(match?.home ?? '')) as Team | undefined;
  const away = useScoreline(selectTeam(match?.away ?? '')) as Team | undefined;
  const open1 = useMemo(() => (el: Element) => onOpen(id, el), [id, onOpen]);
  if (!match || !home || !away) return null;
  return <LiveCard match={match} home={home} away={away} index={index} open={open} leaving={leaving} grow={grow} current={current} onOpen={open1} />;
}

/**
 * The cards on stage: the live matches in card order, plus the ones that ended less than STAY_MS
 * ago, which fold away.
 */
function useStage(live: readonly number[], order: readonly number[]) {
  const [prev, setPrev] = useState(live);
  const [gone, setGone] = useState<readonly number[]>([]);
  // a match that was live and is still in the feed has just ended: its card stays a moment
  if (prev !== live) {
    setPrev(live);
    const ended = prev.filter((id) => !live.includes(id) && order.includes(id));
    if (ended.length > 0) setGone([...new Set([...gone, ...ended])]);
  }
  useEffect(() => {
    if (gone.length === 0) return;
    const t = setTimeout(() => setGone((g) => g.filter((id) => !gone.includes(id))), STAY_MS);
    return () => clearTimeout(t);
  }, [gone]);
  return useMemo(() => {
    const ids = [...new Set([...live, ...gone.filter((id) => !live.includes(id))])];
    return { ids: cardOrderOf(ids, live), leaving: new Set(gone.filter((id) => !live.includes(id))) };
  }, [live, gone]);
}

// favourites first and by id, as drawCards sorts its set; the favourites come from the live order
function cardOrderOf(ids: readonly number[], live: readonly number[]): readonly number[] {
  // `live` is already in card order (favourites first); an ended match keeps its place by id
  const inLive = live.filter((id) => ids.includes(id));
  const rest = ids.filter((id) => !live.includes(id));
  return [...cardOrder(inLive.map((id) => ({ id, favourite: false }))), ...rest].sort((a, b) => ids.indexOf(a) - ids.indexOf(b));
}

/**
 * Plays the goal choreography on the cards (luau:3746–3898): the scorer dips, floods with its
 * colour and is crossed by a band of light; every card steps (the scorer swells, the rest shrink);
 * the cards that did not score go grey; the score pops and takes the spectrum. The numbers are
 * computed from the time since the goal, once a frame, and written as custom properties.
 */
function useGoalFrames(root: React.RefObject<HTMLDivElement | null>, ids: readonly number[], feed: GoalFeed) {
  const still = useReducedMotionPreference();
  useEffect(() => {
    let stop: (() => void) | undefined;
    const cards = () => Array.from(root.current?.querySelectorAll<HTMLElement>('[data-card]') ?? []);
    if (still) {
      const rest = () => cards().forEach((el) => write(el, undefined, cardFeel(0, undefined), 1, 0));
      rest();
      return feed.subscribe(rest);
    }
    const apply = (now: number): boolean => {
      const els = cards();
      const marks = new Map<number, GoalMark | undefined>(els.map((el) => [Number(el.dataset.card), feed.mark(Number(el.dataset.card))]));
      // the card that scored last (drawCards, luau:3881)
      let gm: number | undefined;
      let gt = Infinity;
      for (const [id, mk] of marks) if (mk && now - mk.t >= 0 && now - mk.t < gt) [gm, gt] = [id, now - mk.t];
      const latest = gm === undefined ? undefined : marks.get(gm);
      const all = [...marks.values()];
      for (const el of els) {
        const id = Number(el.dataset.card);
        const mk = marks.get(id);
        const f = cardFeel(now, mk);
        const sc = stepScale(now, latest, id === gm);
        const grey = greyOf(now, mk, all);
        write(el, mk, f, sc, grey);
      }
      return feed.active(now);
    };
    const kick = () => {
      stop?.();
      stop = startFrames((now) => {
        const more = apply(now);
        if (!more) stop = undefined;
        return more;
      }, () => feed.clock.now());
    };
    kick();
    const off = feed.subscribe(kick);
    return () => {
      off();
      stop?.();
    };
    // the cards present change the marks the loop looks at
  }, [root, feed, ids, still]);
}

function write(el: HTMLElement, mk: GoalMark | undefined, f: ReturnType<typeof cardFeel>, sc: number, grey: number) {
  const set = (k: string, v: string | null) => {
    if (v === null) el.style.removeProperty(k);
    else el.style.setProperty(k, v);
  };
  const flooding = f.halo > 0.001;
  set('--gdy', f.dip ? String(f.dip) : null);
  set('--gsc', sc !== 1 ? String(sc) : null);
  set('--halo', flooding ? String(f.halo) : null);
  set('--q', flooding ? String(f.flood) : null);
  if (flooding && mk) el.dataset.flood = mk.side;
  else delete el.dataset.flood;
  if (f.sweep >= 0 && mk) {
    const h = el.offsetHeight;
    // the band starts above the card and ends below it, from the side that scored
    const y = mk.side === 'home' ? -110 + (h + 110) * f.sweep : h - (h + 110) * f.sweep;
    set('--sweep-y', String(y));
    el.dataset.sweep = '';
  } else {
    set('--sweep-y', null);
    delete el.dataset.sweep;
  }
  set('--bump-h', f.bump[0] !== 1 ? String(f.bump[0]) : null);
  set('--bump-a', f.bump[1] !== 1 ? String(f.bump[1]) : null);
  set('--mk-h', f.mark[0] > 0.001 ? String(f.mark[0]) : null);
  set('--mk-a', f.mark[1] > 0.001 ? String(f.mark[1]) : null);
  if (grey > 0.004) {
    set('--grey', String(grey));
    el.dataset.grey = '';
  } else {
    set('--grey', null);
    delete el.dataset.grey;
  }
}
