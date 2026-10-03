import { memo } from 'react';
import type { MotionValue } from 'motion/react';
import { Crest, Icon, RoundButton, SoftLight, type CrestTeam, type PhotoSources } from '../../ui';
import { BACKDROP, BAR_H, HERO } from './layout';
import { GiantNumber } from './Scene';
import styles from './PlayerView.module.css';

/*
 * The top bar (luau:6101–6150). Transparent while he is at the top; as he scrolls under it the
 * picture behind it frosts: the backdrop again, the number blurred, the bust's frosted copy, a
 * dark pane, a sheen and a rule. The frosted layer is the same scene, moved up by the scroll
 * (--sy, written by useScrollVars), so nothing here renders while scrolling.
 */

export type BarProps = {
  team: CrestTeam & { name: string };
  n: number;
  frost: PhotoSources | undefined;
  /** 'back' and 'close' show the round button on the left; 'none' (a pane) does not */
  chrome: 'back' | 'close' | 'none';
  onBack: () => void;
  following: boolean;
  onFollow: (on: boolean) => void;
  colour: string;
  numberSlide: MotionValue<number>;
};

export const Bar = memo(function Bar({ team, n, frost, chrome, onBack, following, onFollow, colour, numberSlide }: BarProps) {
  const label = team.name.toUpperCase();
  return (
    <div className={styles.bar} data-pv="bar">
      <div className={styles.barGlass} aria-hidden="true" data-pv="bar-glass">
        <SoftLight color={colour} alpha={0.5} cx="50%" cy={BACKDROP.cy} rx={BACKDROP.rx / 2} ry={BACKDROP.ry / 2} />
        {frost && (
          <div className={styles.glassScene}>
            <GiantNumber n={n} blur slide={numberSlide} />
            <picture>
              {frost.sources.map((s) => (
                <source key={s.type} type={s.type} srcSet={s.srcSet} sizes={`${HERO.w}px`} />
              ))}
              <img className={styles.frost} src={frost.src} srcSet={frost.srcSet} sizes={`${HERO.w}px`} width={HERO.w} height={HERO.h} alt="" loading="lazy" decoding="async" draggable={false} />
            </picture>
          </div>
        )}
        <span className={styles.glassTint} />
        <span className={styles.glassSheen} />
        <span className={styles.glassRule} />
      </div>
      {chrome !== 'none' && (
        <RoundButton aria-label={chrome === 'close' ? 'Close' : 'Back'} className={styles.back} onClick={onBack}>
          <Icon name={chrome === 'close' ? 'close' : 'back'} />
        </RoundButton>
      )}
      <p className={styles.team} data-pv="team">
        <Crest team={team} size={16} />
        <span>{label}</span>
      </p>
      <RoundButton aria-label={following ? 'Unfollow' : 'Follow'} aria-pressed={following} className={styles.follow} onClick={() => onFollow(!following)}>
        <Icon name="follow" on={following} />
      </RoundButton>
    </div>
  );
});

export { BAR_H };
