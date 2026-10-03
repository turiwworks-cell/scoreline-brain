import { memo, useEffect, useState } from 'react';
import { animate, m, useMotionValue, useMotionValueEvent, useReducedMotion, useTransform } from 'motion/react';
import type { Side, Team } from '../../../domain';
import { transition } from '../../../motion';
import { Crest, feel, Glass, mix, pastel, RollLabel } from '../../../ui';
import styles from './Lineup.module.css';

/*
 * Home / away (teamSwitch, luau:5455): a glass pill whose chosen side wears its team's colours.
 * The thumb slides across (motion: tabs) and takes the colours of the side it is nearer to, so
 * they change at the middle of the slide, as in the Lua. Pressing a side rolls its letters.
 */

const thumbFill = (t: Team) => `linear-gradient(90deg, ${pastel(t.colors[0])} 0%, ${pastel(mix(t.colors[1], '#F7F2EA', 0.3))} 100%)`;

export type TeamSwitchProps = {
  home: Team;
  away: Team;
  side: Side;
  onChange: (side: Side) => void;
};

export const TeamSwitch = memo(function TeamSwitch({ home, away, side, onChange }: TeamSwitchProps) {
  const reduce = useReducedMotion() === true;
  const k = useMotionValue(side === 'home' ? 0 : 1);
  const [near, setNear] = useState<Side>(side);
  useMotionValueEvent(k, 'change', (v) => setNear(v < 0.5 ? 'home' : 'away'));
  useEffect(() => {
    const to = side === 'home' ? 0 : 1;
    if (reduce) {
      k.set(to);
      return;
    }
    const a = animate(k, to, transition('tabs', { withDelay: false }));
    return () => a.stop();
  }, [k, side, reduce]);
  // the thumb is one segment wide: its own width is the distance between the two places
  const x = useTransform(k, (v) => `${v * 100}%`);
  const teams = { home, away };

  return (
    <Glass radius={23} className={styles.switch} role="radiogroup" aria-label="Team">
      <m.span className={styles.thumb} style={{ x, background: thumbFill(teams[near]) }} aria-hidden="true" data-thumb={near} />
      <div className={styles.segs}>
        {(['home', 'away'] as const).map((s) => {
          const t = teams[s];
          return (
            <button key={s} type="button" role="radio" aria-checked={side === s} data-side={s} className={`m-feel ${styles.seg}`} onClick={() => onChange(s)} {...feel}>
              <span className={styles.segLabel}>
                <Crest team={t} size={20} />
                <RollLabel text={t.name} className={styles.segName} />
              </span>
            </button>
          );
        })}
      </div>
    </Glass>
  );
});
