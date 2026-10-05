import { memo, useState } from 'react';
import { m, useTransform, type MotionValue } from 'motion/react';
import { inkCentre, KitDisc, mix, SoftLight, useFontVersion, type PhotoSources } from '../../ui';
import type { CrestTeam } from '../../ui';
import { CUT_H, HERO, LINE_Y, NUMBER } from './layout';
import type { Opening } from './motion';
import styles from './PlayerView.module.css';

/*
 * The hero (luau:5851–5995): the bust centred on the page, standing on a line of light with the
 * giant shirt number behind him, cut at the line.
 *
 * The cut is a window that stays on the line while the picture inside it grows from 0.9 (the
 * entrance, motion.ts). The picture is drawn 6 % larger than the Lua's cell (--bust-zoom), so
 * even at 0.9 its opaque part reaches below the line: the edge of the file never shows above it
 * (review of 2026-10-04: "we see the cut-off part under the player").
 */

/** Pixels the bust slides when he is reached by an arrow (36 × direction, luau:5948). */
const SLIDE = 36;

/** The giant shirt number, centred by its ink (bigNumber, luau:5895): light, white at 8 %, on the line. */
export const GiantNumber = memo(function GiantNumber({ n, blur, slide }: { n: number; blur?: boolean; slide: MotionValue<number> }) {
  useFontVersion();
  const centre = inkCentre(NUMBER.weight, NUMBER.size, NUMBER.track, String(n));
  return (
    <m.span className={blur ? `${styles.number} ${styles.numberBlur}` : styles.number} style={{ x: slide, left: `calc(50% - ${centre}px)` }} aria-hidden="true" data-pv="number">
      {n}
    </m.span>
  );
});

/** The bust's picture: AVIF ahead of the WebP, 1× and 2× in `w`, the size it is drawn at. */
function Picture({ photo, className, priority, onError }: { photo: PhotoSources; className?: string; priority?: boolean; onError?: () => void }) {
  const sizes = `${HERO.w}px`;
  return (
    <picture>
      {photo.sources.map((s) => (
        <source key={s.type} type={s.type} srcSet={s.srcSet} sizes={sizes} />
      ))}
      <img
        className={className}
        src={photo.src}
        srcSet={photo.srcSet}
        sizes={sizes}
        width={HERO.w}
        height={HERO.h}
        alt=""
        loading="eager"
        decoding="async"
        fetchPriority={priority ? 'high' : undefined}
        draggable={false}
        onError={onError}
      />
    </picture>
  );
}

export type HeroProps = {
  team: CrestTeam;
  n: number;
  /** his bust files; undefined = no photo (the kit disc stands in) */
  photo: PhotoSources | undefined;
  opening: Opening;
  /** direction he was reached in (1, -1) or 0 */
  dir: number;
};

/**
 * The bust (HERO cell, cut at CUT) or, without a photo, a 92 px kit disc at the cell's middle
 * (kitDisc at hero y + 170, luau:5985). A photo that fails to load falls back to the disc.
 */
export const Hero = memo(function Hero({ team, n, photo, opening, dir }: HeroProps) {
  const [failed, setFailed] = useState<string | null>(null);
  const slide = useTransform(opening.step, (v) => SLIDE * dir * (1 - v));
  const alpha = useTransform([opening.heroOpacity, opening.step], ([o, s]: number[]) => (o ?? 0) * (s ?? 1));
  const numberSlide = useTransform(opening.step, (v) => SLIDE * dir * (1 - v) * 0.5);
  const shown = photo && failed !== photo.src ? photo : undefined;
  return (
    <>
      {shown && <GiantNumber n={n} slide={numberSlide} />}
      <div className={styles.hero} data-pv="hero">
        <m.div className={styles.heroArt} style={{ x: slide, opacity: alpha, scale: opening.heroScale }}>
          <span className={shown ? styles.bust : styles.kit} data-pv="bust">
            {shown ? <Picture photo={shown} className={styles.bustImg} priority onError={() => setFailed(shown.src)} /> : <KitDisc team={team} n={n} size={92} />}
          </span>
        </m.div>
      </div>
    </>
  );
});

/** The line of light (horizon, luau:5861): hairline, bloom, light above it and a fainter spill below. */
export const Horizon = memo(function Horizon({ colour, e, step, dir }: { colour: string; e: MotionValue<number>; step: MotionValue<number>; dir: number }) {
  const tint = mix(colour, '#FFFFFF', 0.45);
  const alpha = useTransform([e, step], ([v, s]: number[]) => Math.min(Math.max((v ?? 0) * 2 - 0.8, 0), 1) * (s ?? 1));
  const x = useTransform(step, (v) => SLIDE * dir * (1 - v) * 0.5);
  const hair = `linear-gradient(90deg, ${rgba(tint, 0)} 0%, ${rgba(tint, 0.5)} 16%, #fff 50%, ${rgba(tint, 0.5)} 84%, ${rgba(tint, 0)} 100%)`;
  return (
    <m.div className={styles.horizon} style={{ opacity: alpha, x, top: LINE_Y }} aria-hidden="true" data-pv="horizon">
      {/* softLight(…, 235, 72) above the line and (…, 190, 28) below it: their stops end at half the radius */}
      <span className={styles.lightUp}>
        <SoftLight color={tint} alpha={0.42} cx="50%" cy={90} rx={117.5} ry={36} />
      </span>
      <span className={styles.lightDown}>
        <SoftLight color={tint} alpha={0.2} cx="50%" cy={0} rx={95} ry={14} />
      </span>
      <span className={styles.bloom} style={{ background: rgba(tint, 0.9) }} />
      <span className={styles.hair} style={{ background: hair }} />
    </m.div>
  );
});

function rgba(hex: string, a: number): string {
  const v = parseInt(hex.slice(1), 16);
  return `rgb(${(v >> 16) & 255} ${(v >> 8) & 255} ${v & 255} / ${a})`;
}

export { CUT_H };
