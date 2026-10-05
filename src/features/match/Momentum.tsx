import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { animate, m, useMotionValue, useReducedMotion, useTransform } from 'motion/react';
import type { MatchEvent, MatchStatus, Team } from '../../domain';
import { timing } from '../../motion/tokens';
import { transition } from '../../motion/variants';
import { Crest } from '../../ui/Crest';
import { Glass } from '../../ui/Glass';
import { tagId } from '../../ui/icons';
import { useSvgId } from '../../ui/svgId';
import { derivedMomentum, minuteX, MOMENTUM_WIDTH, momentumColors, momentumGoals, momentumPaths, pressure } from './momentumGeometry';
import styles from './Momentum.module.css';

export interface MomentumProps {
  readonly matchId: number;
  /** Synchronized data minute, not the ticking MatchClock / liveMinute value. */
  readonly minute: number;
  readonly status: MatchStatus;
  readonly momentum?: readonly number[];
  readonly events: readonly MatchEvent[];
  readonly home: Team;
  readonly away: Team;
  readonly className?: string;
}

/** Facts' momentum section (luau:4828–4989). Mount on entering Facts; key by match id. */
export const Momentum = memo(function Momentum(props: MomentumProps) {
  return <MomentumContent key={props.matchId} {...props} />;
});

function MomentumContent({ matchId, minute, status, momentum, events, home, away, className }: MomentumProps) {
  const values = momentum ?? derivedMomentum(events, minute);
  const wave = useMemo(() => momentumPaths(values), [values]);
  const goals = useMemo(() => momentumGoals(events), [events]);
  const colors = momentumColors(home, away);
  const { share, lead } = pressure(values, minute);
  const leader = lead === 'home' ? home : lead === 'away' ? away : null;
  const leaderShare = lead === 'away' ? 100 - share : share;
  const id = useSvgId('sl-momentum');
  const reduced = useReducedMotion();
  const reveal = useMotionValue(reduced ? 1 : 0);
  const endX = minuteX(minute);
  const clipX = useTransform(reveal, (p) => -323 + p * endX);
  const markerOpacity = useTransform(reveal, (p) => p > 0.98 ? 1 : 0);
  const nowY = wave.ys[Math.min(Math.max(0, Math.floor(minute)), wave.ys.length - 1)]!;
  // The chart is drawn at its real width. The wave is computed on the Lua's 322 units and only it
  // is stretched to fit (its lines keep their width); crests, labels, balls and the live dot stand
  // at their own size. A 322 × 156 viewBox squeezed into a wider desktop pane stretched them all
  // sideways (review of 2026-10-04: "on desktop it looks crushed").
  const svg = useRef<SVGSVGElement>(null);
  const [w, setW] = useState(MOMENTUM_WIDTH);
  useLayoutEffect(() => {
    const el = svg.current;
    if (!el) return;
    const read = () => setW(el.clientWidth || MOMENTUM_WIDTH);
    read();
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(read);
    ro?.observe(el);
    return () => ro?.disconnect();
  }, []);
  const sx = w / MOMENTUM_WIDTH;

  useEffect(() => {
    if (reduced) { reveal.set(1); return; }
    // Only mount / entering Facts starts the reveal. Polls and goals do not replay it.
    const t = timing('momentum');
    const controls = animate(reveal, 1, { duration: t.duration, delay: t.delay, ease: [...t.ease] });
    return () => controls.stop();
  }, [reduced, reveal]);

  const description = `${home.name} above the midline; ${away.name} below. ${Math.min(Math.max(minute, 0), 90)} minutes played. ${goals.length} ${goals.length === 1 ? 'goal' : 'goals'}.`;
  return (
    <section className={[styles.momentum, className].filter(Boolean).join(' ')} aria-labelledby={`${id}-heading`} data-momentum={matchId}>
      <header className={styles.heading}>
        {leader && <Crest team={leader} size={26} className={styles.leader} />}
        <div className={leader ? styles.withLeader : undefined}>
          <h3 id={`${id}-heading`}>{leader ? `${leader.name} on top` : 'Evenly matched'}</h3>
          <p>{leader ? `${leaderShare}% of the pressure in the last 10 minutes` : 'Neither side has pulled ahead in the last 10 minutes'}</p>
        </div>
      </header>
      <Glass radius={20} className={styles.glass}>
        <svg ref={svg} className={styles.chart} viewBox={`0 0 ${w} 156`} role="img" aria-labelledby={`${id}-title ${id}-description`}>
          <title id={`${id}-title`}>Match momentum</title>
          <desc id={`${id}-description`}>{description}</desc>
          <defs>
            <linearGradient id={`${id}-home`} gradientUnits="userSpaceOnUse" x1="0" x2="0" y1={156 * 0.06} y2="78">
              <stop stopColor={colors[0]} stopOpacity={0.62} /><stop offset="1" stopColor={colors[0]} stopOpacity={0.1} />
            </linearGradient>
            <linearGradient id={`${id}-away`} gradientUnits="userSpaceOnUse" x1="0" x2="0" y1="78" y2={156 * 0.94}>
              <stop stopColor={colors[1]} stopOpacity={0.1} /><stop offset="1" stopColor={colors[1]} stopOpacity={0.62} />
            </linearGradient>
            <clipPath id={`${id}-reveal`}><m.rect width="324" height="156" style={{ x: clipX }} data-wave-reveal="" /></clipPath>
            <clipPath id={`${id}-top`}><rect y="-4" width="322" height="82" /></clipPath>
            <clipPath id={`${id}-bottom`}><rect y="78" width="322" height="82" /></clipPath>
            <filter id={`${id}-glow`} x="-10%" y="-20%" width="120%" height="140%"><feGaussianBlur stdDeviation="3" /></filter>
          </defs>
          <g aria-hidden="true">
            <Crest team={home} size={13} x={0} y={2} /><text x="18" y="12" className={styles.teamLabel}>{home.short}</text>
            <Crest team={away} size={13} x={0} y={141} /><text x="18" y="151" className={styles.teamLabel}>{away.short}</text>
            <path d={`M ${161 * sx} 22 V 134`} stroke="white" strokeOpacity="0.14" strokeWidth="1" strokeDasharray="3 4" />
            {status !== 'finished' && endX + 6 < 322 && <path d={`M ${endX * sx + 6} 78 H ${w}`} stroke="white" strokeOpacity="0.22" strokeWidth="1" strokeDasharray="3 4" data-future-minutes="" />}
            <g transform={`scale(${sx} 1)`}>
              <g clipPath={`url(#${id}-reveal)`}>
                <path d={`M 0 78 H ${endX}`} stroke="white" strokeOpacity="0.3" strokeWidth="1" vectorEffect="non-scaling-stroke" />
                <path d={wave.home} fill={`url(#${id}-home)`} data-wave="home" />
                <path d={wave.away} fill={`url(#${id}-away)`} data-wave="away" />
                {colors.map((color, i) => <g key={i} clipPath={`url(#${id}-${i === 0 ? 'top' : 'bottom'})`} fill="none" stroke={color}>
                  <path d={wave.line} strokeWidth="3" strokeOpacity="0.45" filter={`url(#${id}-glow)`} vectorEffect="non-scaling-stroke" />
                  <path d={wave.line} strokeWidth="1.4" strokeOpacity="0.95" vectorEffect="non-scaling-stroke" data-wave="line" />
                </g>)}
              </g>
            </g>
            {goals.map((goal, i) => {
              const x = minuteX(goal.minute) * sx, homeGoal = goal.side === 'home', y = homeGoal ? 10 : 146;
              return <g key={goal.id} data-momentum-goal={goal.id}>
                <title>{`${homeGoal ? home.name : away.name} goal, ${goal.minute}'${goal.name ? `, ${goal.name}` : ''}`}</title>
                <m.g initial={reduced ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={transition('momentum', { index: i + 1 })}>
                  <path d={`M ${x} 78 V ${y}`} stroke="white" strokeOpacity="0.35" strokeWidth="1" />
                  <m.g initial={reduced ? false : { y: homeGoal ? 6 : -6 }} animate={{ y: 0 }} transition={transition('momentum', { index: i + 1 })}>
                    <use href={`#${tagId('goal')}`} x={x - 7.5} y={y - 7.5} width="15" height="15" />
                  </m.g>
                </m.g>
              </g>;
            })}
            {status === 'live' && <m.g style={{ opacity: markerOpacity }}><LiveMarker x={endX * sx} y={nowY} reduced={!!reduced} /></m.g>}
          </g>
        </svg>
      </Glass>
      <div className={styles.axis} aria-hidden="true"><span>0'</span><span>HT</span><span>90'</span></div>
    </section>
  );
}

/** Imperative leaf: no React clock subscription and no path / tree renders for the live pulse. */
function LiveMarker({ x, y, reduced }: { x: number; y: number; reduced: boolean }) {
  const ring = useRef<SVGCircleElement>(null);
  useEffect(() => {
    const el = ring.current;
    if (!el || reduced) return;
    let frame = 0, visible = true;
    const stop = () => { if (frame) cancelAnimationFrame(frame); frame = 0; };
    const tick = (now: number) => {
      const pulse = 0.5 + 0.5 * Math.cos(now / 1000 * 4); // Lua's intrinsic pulse, not an entrance duration.
      el.style.transform = `scale(${(4 + 5 * pulse) / 4})`;
      el.style.opacity = `${0.22 * (1 - pulse)}`;
      frame = requestAnimationFrame(tick);
    };
    const sync = () => { stop(); if (visible && !document.hidden) frame = requestAnimationFrame(tick); };
    const observer = typeof IntersectionObserver === 'undefined' ? null : new IntersectionObserver(([entry]) => {
      visible = entry?.isIntersecting ?? false;
      sync();
    });
    observer?.observe(el);
    document.addEventListener('visibilitychange', sync);
    sync();
    return () => { stop(); observer?.disconnect(); document.removeEventListener('visibilitychange', sync); };
  }, [reduced]);
  return <g transform={`translate(${x} ${y})`} data-momentum-now="">
    <circle ref={ring} r="4" className={styles.pulse} fill="var(--c-live)" opacity={reduced ? 0 : 0.11} />
    <circle r="4" fill="var(--c-live)" /><circle r="4.6" fill="none" stroke="var(--c-bg)" strokeWidth="1.2" />
  </g>;
}
