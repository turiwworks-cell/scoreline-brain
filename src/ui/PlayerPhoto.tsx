import { memo, useState, type CSSProperties, type HTMLAttributes, type SVGAttributes } from 'react';
import { pastel, mix } from './color';
import { Crest } from './Crest';
import type { CrestTeam } from './flags';
import { Glass } from './Glass';
import { SoftLight } from './SoftLight';
import styles from './PlayerPhoto.module.css';

/*
 * Player photos and the kit-disc fallback (luau:3632-3686).
 *
 * A photo is the player's bust (288 × 360 design units, CROP in luau:1470) cut like the
 * notification's face: head and shoulders standing on the box's bottom edge. Whatever holds
 * it (a tile, a card, a chip) clips the shoulders; nothing is faded. Without a photo, or when
 * it fails to load, the shirt number on a kit disc stands in; with no player known, the crest.
 * The image files and their URLs come from the image pipeline (Part 8, `photoSources`); here
 * they are given. With `sources` the image is a <picture>, AVIF ahead of the WebP `src`.
 */

const FACE = { x: 60, y: 8, w: 168, h: 168 }; // CROP.face, luau:1471
const BUST = { w: 288, h: 360 };

export type KitDiscProps = Omit<SVGAttributes<SVGSVGElement>, 'children'> & {
  team: CrestTeam;
  /** shirt number; 0 or less draws the crest instead (a goal credited to the team) */
  n: number;
  /** diameter in px */
  size: number;
};

/** The shirt-number token: a dark disc tinted toward the team colour, ringed in its pastel (kitDisc, luau:3638). */
export const KitDisc = memo(function KitDisc({ team, n, size, ...rest }: KitDiscProps) {
  if (n <= 0) return <Crest team={team} size={size} {...rest} />;
  const rad = size / 2;
  const c = team.colors[0];
  const s = String(n);
  const fs = rad * (s.length > 1 ? 0.86 : 0.98);
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true" focusable="false" data-kit-disc={team.id} {...rest}>
      <circle cx={rad} cy={rad} r={rad} fill={mix('#151515', c, 0.2)} />
      <circle cx={rad} cy={rad} r={rad - 0.9} fill="none" stroke={pastel(c)} strokeWidth={Math.min(Math.max(rad * 0.075, 1.4), 3)} />
      {/* the Lua's baseline for text centred on cy: cy + 0.3485 × size (bc, luau:1630) */}
      <text
        x={rad}
        y={rad + 0.3485 * fs}
        textAnchor="middle"
        fontWeight={700}
        fontSize={fs}
        letterSpacing="-0.02em"
        style={{ fill: 'var(--c-text)', fontFamily: 'var(--font-sans)' }}
      >
        {s}
      </text>
    </svg>
  );
});

export type PlayerPhotoProps = Omit<HTMLAttributes<HTMLSpanElement>, 'children'> & {
  team: CrestTeam;
  /** shirt number (0 = no player known) */
  n: number;
  /** the player's bust image, 288 × 360 (or a multiple); absent = no photo */
  src?: string;
  srcSet?: string;
  /** <source> sets ahead of the <img>, e.g. AVIF (photoSources) */
  sources?: readonly { readonly type: string; readonly srcSet: string }[];
  /** width of the box in px; the face fills it and stands on its bottom edge */
  width: number;
  /** the player's name, for the image's alt text */
  alt?: string;
  /** `lazy` for photos below the fold; the pitch's stay `eager` so they are ready for their entrance */
  loading?: 'eager' | 'lazy';
  /** a coach has no shirt number: n is 0 and the photo still shows when `src` is given */
  coach?: boolean;
  /** the photo failed to load (a coach then draws his own fallback) */
  onFail?: () => void;
};

/**
 * A face rising from the bottom of a `width` × `width` box (riseFace, luau:3654). The bust runs
 * on below the box; the holder clips it there.
 */
export const PlayerPhoto = memo(function PlayerPhoto({ team, n, src, srcSet, sources, width: w, alt = '', loading, coach, onFail, className, style, ...rest }: PlayerPhotoProps) {
  const [failed, setFailed] = useState<string | null>(null);
  const k = w / FACE.w;
  const photo = !!src && (n > 0 || coach === true) && failed !== src;
  const cls = className ? `${styles.photo} ${className}` : styles.photo;
  const st = { ...style, width: w, height: w } as CSSProperties;
  return (
    <span className={cls} style={st} data-photo={photo ? 'bust' : n > 0 ? 'kit' : 'crest'} {...rest}>
      {photo ? (
        // the face crop and 30 units below it (luau:3662), standing (FACE.h - 14) units above the bottom
        <span className={styles.crop} style={{ top: w - (FACE.h - 14) * k, height: (FACE.h + 30) * k }}>
          <BustImg
            src={src}
            srcSet={srcSet}
            sources={sources}
            alt={alt}
            k={k}
            loading={loading}
            onError={() => {
              setFailed(src);
              onFail?.();
            }}
          />
        </span>
      ) : (
        <KitDisc team={team} n={n} size={w * 0.68} className={styles.disc} style={{ left: w * 0.16, top: w * 0.24 }} />
      )}
    </span>
  );
});

/** The whole bust at k px per design unit, offset so the face crop starts at the box's corner. */
function BustImg({ src, srcSet, sources, alt, k, loading, onError }: Pick<PlayerPhotoProps, 'srcSet' | 'sources' | 'loading'> & { src: string; alt: string; k: number; onError: () => void }) {
  const w = BUST.w * k;
  // `sizes` lets a `w`-described set pick the smallest file that covers the drawn width
  const img = (
    <img
      src={src}
      srcSet={srcSet}
      sizes={srcSet ? `${w}px` : undefined}
      alt={alt}
      width={w}
      height={BUST.h * k}
      style={{ left: -FACE.x * k, top: -FACE.y * k }}
      loading={loading}
      decoding="async"
      draggable={false}
      onError={onError}
    />
  );
  if (!sources?.length) return img;
  return (
    <picture>
      {sources.map((s) => (
        <source key={s.type} type={s.type} srcSet={s.srcSet} sizes={`${w}px`} />
      ))}
      {img}
    </picture>
  );
}

export type PhotoTileProps = Omit<PlayerPhotoProps, 'width'> & {
  /** the tile's side in px */
  size: number;
};

/**
 * A list avatar (photoTile, luau:3672): a small glass tile lit softly in the team colour from
 * below, the player rising from its bottom edge, and its rim drawn over him.
 */
export const PhotoTile = memo(function PhotoTile({ size: s, team, className, ...rest }: PhotoTileProps) {
  return (
    <Glass radius={s * 0.3} className={className ? `${styles.tile} ${className}` : styles.tile} style={{ width: s, height: s }}>
      <SoftLight color={team.colors[0]} alpha={0.5} cx={s / 2} cy={s} rx={s * 0.95} ry={s * 0.8} />
      <PlayerPhoto team={team} width={s} className={styles.inTile} {...rest} />
    </Glass>
  );
});
