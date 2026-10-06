import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { animate, m, useMotionValue, useTransform, type MotionValue } from 'motion/react';
import { minText, scoreStr } from '../../domain';
import { bez, CURVES, drawn, lerp, prog, timing, TOAST_OUT, type MomentDirector, type Presentation } from '../../motion';
import { Crest, Glass, KitDisc, PlayerPhoto, photoProps, SoftLight, Star, textWidth, useFontVersion, type PhotoSources } from '../../ui';
import { DRAG_SLOP, PULL_DOWN, SPRING_BACK, SWIPE_DY, SWIPE_VY, TOAST, TOAST_LEAVE_SHARE, TOAST_RISE } from './choreo';
import { kindLabel, summaryLine, type MomentInfo } from './model';
import { useStageTime } from './useStageTime';
import styles from './Moments.module.css';

/*
 * The notification (drawToast, luau:6205-6283): a slim glass pane. The flag (or the red card)
 * arrives big, then the player rises in from the bottom edge and the flag shrinks to a badge on
 * his photo; the team's name gives way to his. The score sits on the right. A tap opens the match;
 * a swipe up sends it away; a finger on it keeps it (luau:8750-8846).
 * A summary (several moments at once, or the ones missed while away) uses the same pane.
 */

const fit = (size: number, width: number, max: number) => (width <= max || width <= 0 ? size : (size * max) / width);
const NAME_W = 150;

export type ToastProps = {
  p: Presentation;
  /** the moment's names and scores; null for a summary whose match is unknown */
  info: MomentInfo | null;
  d: MomentDirector;
  /** reduced motion: a static toast (ARCHITECTURE §5) */
  reduced: boolean;
  /** the player's bust files, or undefined (the kit disc stands in) */
  photo: PhotoSources | undefined;
  followed: boolean;
  /** a tap on a single moment opens its match */
  onOpen: (matchId: number) => void;
};

export function Toast({ p, info, d, reduced, photo, followed, onOpen }: ToastProps) {
  useFontVersion();
  const { t } = useStageTime(p, d.clock);
  const [T] = useState(() => timing('toast'));
  const still = reduced;
  const enter = useTransform(t, (v) => (still ? 0 : -TOAST_RISE * (1 - bez(T.ease, prog(v, 0, T.duration)))));
  const drag = useMotionValue(0);
  const y = useTransform(() => enter.get() + drag.get());
  const pPhoto = useTransform(t, (v) => (still ? 1 : bez(T.ease, prog(v, T.delay, T.duration))));
  const pName = useTransform(t, (v) => (still ? 1 : bez(T.ease, prog(v, T.delay + T.stagger, T.duration))));
  const fade = useMotionValue(1);

  // leaving: from wherever it is, up past the top edge (toastRect, luau:6198)
  const leaving = p.phase === 'out';
  useEffect(() => {
    if (!leaving) return;
    const opts = { duration: TOAST_OUT * TOAST_LEAVE_SHARE, ease: CURVES.in };
    const a = still ? animate(fade, 0, opts) : animate(drag, -(TOAST.y + TOAST.h + 40) - enter.get(), opts);
    return () => a.stop();
  }, [leaving, still, drag, enter, fade]);

  // the swipe: up follows the finger, down a quarter of it; let go, it leaves or springs back
  const press = useRef<{ id: number; x0: number; y0: number; lastY: number; lastT: number; vy: number; moved: boolean } | null>(null);
  const dragged = useRef(false);
  const settle = () => void animate(drag, 0, SPRING_BACK);
  // a toast that goes while a finger is on it (a layout change moves the stage) lets go of it
  const hold = useRef({ d, key: p.key });
  useEffect(() => {
    hold.current = { d, key: p.key };
  });
  useEffect(
    () => () => {
      if (press.current) hold.current.d.hold(false, hold.current.key);
    },
    [],
  );
  const down = (e: PointerEvent<HTMLButtonElement>) => {
    if (leaving || e.button !== 0) return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    drag.stop();
    press.current = { id: e.pointerId, x0: e.clientX, y0: e.clientY, lastY: e.clientY, lastT: e.timeStamp, vy: 0, moved: false };
    dragged.current = false;
    d.hold(true, p.key);
  };
  const move = (e: PointerEvent<HTMLButtonElement>) => {
    const s = press.current;
    if (!s || s.id !== e.pointerId) return;
    if (!s.moved && (Math.abs(e.clientY - s.y0) > DRAG_SLOP || Math.abs(e.clientX - s.x0) > DRAG_SLOP)) s.moved = true;
    const dt = (e.timeStamp - s.lastT) / 1000;
    if (dt > 0.001) s.vy = s.vy * 0.3 + ((e.clientY - s.lastY) / dt) * 0.7;
    s.lastY = e.clientY;
    s.lastT = e.timeStamp;
    const dy = e.clientY - s.y0;
    drag.set(dy < 0 ? dy : dy * PULL_DOWN);
  };
  const up = (e: PointerEvent<HTMLButtonElement>, cancelled: boolean) => {
    const s = press.current;
    if (!s || s.id !== e.pointerId) return;
    press.current = null;
    dragged.current = s.moved;
    d.hold(false, p.key);
    if (!s.moved && !cancelled) return; // a tap: the click opens the match
    if (!cancelled && (drag.get() < SWIPE_DY || s.vy < SWIPE_VY)) d.dismiss(p.key);
    else settle();
  };
  const click = () => {
    if (dragged.current) {
      dragged.current = false;
      return;
    }
    if (p.kind === 'toast' && info) {
      onOpen(info.match.id);
      d.dismiss(p.key);
    } else d.tap(p.key);
  };
  const key = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      d.dismiss(p.key);
    }
  };

  const summary = p.kind === 'summary';
  const red = p.variant === 'red';
  const tint = !info ? '#85847F' : red ? 'var(--c-red-glow)' : info.team.colors[0];
  const who = info ? (named(info) ? `, ${info.name}, ${info.team.name}` : `, ${info.team.name}`) : '';
  const label = summary ? summaryLabel(p) : `${kindLabel(p.moment.kind)}, ${minText(p.moment.minute)}${who}`;
  const scoreLine = info ? `${info.home.name} ${scoreStr(info.score[0], info.score[1])} ${info.away.name}` : '';
  const aria = `${label}. ${scoreLine}${scoreLine ? '. ' : ''}${summary ? 'Dismiss' : 'Open match'}`;

  return (
    <m.div
      className={styles.toastSlot}
      transformTemplate={drawn}
      style={{ y, opacity: fade }}
      data-testid="moment-toast"
      data-kind={p.kind}
      data-variant={p.variant}
      data-phase={p.phase}
      data-held={p.held || undefined}
    >
      <Glass lit radius={TOAST.radius} className={styles.toast}>
        {/* softLight(…, 150, 90) at the photo's foot (luau:6228); its stops end halfway along the radius */}
        <SoftLight color={red ? '#FF2D2D' : tint} alpha={red ? 0.5 : 0.55} cx={30} cy={TOAST.h} rx={75} ry={45} />
        {summary ? <SummaryBody p={p} info={info} /> : info && <MomentBody p={p} info={info} photo={photo} followed={followed} pPhoto={pPhoto} pName={pName} />}
        <span className={styles.grip} aria-hidden="true" />
        <button
          type="button"
          className={styles.toastHit}
          aria-label={aria}
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={(e) => up(e, false)}
          onPointerCancel={(e) => up(e, true)}
          onClick={click}
          onKeyDown={key}
        />
      </Glass>
    </m.div>
  );
}

/** The event names someone other than the team (the team's name then gives way to his). */
const named = (info: MomentInfo) => info.n > 0 || info.name !== info.team.name;

function summaryLabel(p: Presentation): string {
  return `${p.reason === 'away' ? 'While you were away' : 'Meanwhile'}: ${summaryLine(p.moments)}`;
}

function MomentBody({ p, info, photo, followed, pPhoto, pName }: { p: Presentation; info: MomentInfo; photo: PhotoSources | undefined; followed: boolean; pPhoto: MotionValue<number>; pName: MotionValue<number> }) {
  const red = p.variant === 'red';
  const cancelled = p.variant === 'goalCancelled';
  // the player: chest-up, rising from the bottom edge; without a photo, the kit disc
  const photoY = useTransform(pPhoto, (v) => 30 * (1 - v));
  const discY = useTransform(pPhoto, (v) => 20 * (1 - v));
  // the flag: 36 px in the middle of the photo slot on arrival, then an 18 px badge on its corner
  const badgeX = useTransform(pPhoto, (v) => lerp(0, 30, v));
  const badgeY = useTransform(pPhoto, (v) => lerp(0, 26, v));
  const badgeS = useTransform(pPhoto, (v) => lerp(1, 0.5, v));
  const textX = useTransform(pPhoto, (v) => lerp(0, 18, v));
  const teamY = useTransform(pName, (v) => -8 * v);
  const teamO = useTransform(pName, (v) => 1 - v);
  const nameY = useTransform(pName, (v) => 10 * (1 - v));
  const swap = named(info);
  const nameSize = fit(17, textWidth(600, 17, -0.01, info.name), NAME_W);
  const teamSize = fit(17, textWidth(600, 17, -0.01, info.team.name), NAME_W);
  return (
    <span className={styles.toastBody} aria-hidden="true">
      <span className={styles.photoSlot}>
        {photo ? (
          <m.span className={styles.photoRise} transformTemplate={drawn} style={{ y: photoY, opacity: pPhoto }}>
            <PlayerPhoto team={info.team} n={info.n} width={54} {...photoProps(photo)} alt="" />
          </m.span>
        ) : (
          info.n > 0 && (
            <m.span className={styles.discRise} transformTemplate={drawn} style={{ y: discY, opacity: pPhoto }}>
              <KitDisc team={info.team} n={info.n} size={40} />
            </m.span>
          )
        )}
      </span>
      <m.span className={styles.badge} style={{ x: badgeX, y: badgeY, scale: badgeS }}>
        {red ? <span className={styles.redCard} /> : <Crest team={info.team} size={36} />}
      </m.span>
      <m.span className={styles.toastText} transformTemplate={drawn} style={{ x: textX }}>
        <span className={styles.toastLabel}>
          <span className={red ? styles.red : cancelled ? styles.muted : styles.live}>{kindLabel(p.moment.kind)}</span>
          <span className={styles.muted}>{minText(p.moment.minute)}</span>
        </span>
        <m.span className={styles.toastName} transformTemplate={drawn} style={{ y: swap ? teamY : 0, opacity: swap ? teamO : 1, fontSize: teamSize }}>
          {info.team.name}
        </m.span>
        {swap && (
          <m.span className={styles.toastName} transformTemplate={drawn} style={{ y: nameY, opacity: pName, fontSize: nameSize }}>
            {info.name}
            {followed && <Star className={styles.star} />}
          </m.span>
        )}
      </m.span>
      <ScoreBlock info={info} />
    </span>
  );
}

function ScoreBlock({ info }: { info: MomentInfo }) {
  return (
    <span className={styles.toastScore}>
      <span className={styles.toastScoreRow}>
        <Crest team={info.home} size={15} />
        <span className={styles.toastScoreNum}>{scoreStr(info.score[0], info.score[1])}</span>
        <Crest team={info.away} size={15} />
      </span>
      <span className={styles.toastShorts}>
        {info.home.short} · {info.away.short}
      </span>
    </span>
  );
}

/** Several at once: how many of what, and the latest match's score. */
function SummaryBody({ p, info }: { p: Presentation; info: MomentInfo | null }) {
  return (
    <span className={styles.toastBody} aria-hidden="true">
      <span className={styles.summaryCount}>{p.moments.length}</span>
      <span className={styles.toastText} style={{ left: 60 }}>
        <span className={styles.toastLabel}>
          <span className={styles.muted}>{p.reason === 'away' ? 'While you were away' : 'Meanwhile'}</span>
        </span>
        <span className={styles.toastName} style={{ fontSize: 17 }}>
          {summaryLine(p.moments)}
        </span>
      </span>
      {info && <ScoreBlock info={info} />}
    </span>
  );
}
