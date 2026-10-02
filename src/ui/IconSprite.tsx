import { memo } from 'react';
import { ICONS, ICON_NAMES, iconId, tagId, UNIT_PATHS, ICON_SRC } from './icons';

/*
 * The one icon sprite: every UI icon and every round tag as a <symbol>, mounted once at the
 * app root. <Icon> and the tags draw them with <use>, so a list of 300 rows carries 300 small
 * <use> elements, not 300 copies of the ball.
 */

const BALL_INK = '#161616'; // luau:3465
const ROUND = { strokeLinecap: 'round', strokeLinejoin: 'round' } as const;

/** The ball, line-drawn: a solid centre panel, five rim panels cut by the rim, seams, outline (luau:3468). */
function BallGlyph() {
  const rim = [0, 1, 2, 3, 4].map((i) => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
    const deg = ((a - Math.PI / 2) * 180) / Math.PI;
    return (
      <path
        key={i}
        d={UNIT_PATHS.pent}
        transform={`translate(${Math.cos(a) * 1.02} ${Math.sin(a) * 1.02}) rotate(${deg}) scale(0.32)`}
      />
    );
  });
  return (
    <g transform="scale(0.76)" fill={BALL_INK}>
      <path d={UNIT_PATHS.pent} transform="scale(0.36)" />
      <g clipPath="url(#sl-unit-disc)">{rim}</g>
      <path d={UNIT_PATHS.seams} fill="none" stroke={BALL_INK} strokeWidth={0.1} {...ROUND} />
      <circle r={1} fill="none" stroke={BALL_INK} strokeWidth={0.12} />
    </g>
  );
}

const disc = (fill: string) => <circle r={1} style={{ fill }} />;

/** A card, slightly tilted, on a white tag (luau:3507). */
const card = (fill: string) => (
  <>
    {disc('var(--c-text)')}
    <rect x={-0.41} y={-0.59} width={0.82} height={1.18} rx={0.16} transform={`rotate(${(0.2 * 180) / Math.PI})`} style={{ fill }} />
  </>
);

/** Substitution: red with an arrow out, green with an arrow in (luau:3517). */
const sub = (out: boolean) => (
  <>
    {disc(out ? 'var(--c-red)' : 'var(--c-live)')}
    <path
      d={out ? ICON_SRC.arrowL : ICON_SRC.arrowR}
      transform="scale(1.12)"
      fill="none"
      strokeWidth={0.17}
      style={{ stroke: out ? 'var(--c-text)' : 'var(--c-ink-dark)' }}
      {...ROUND}
    />
  </>
);

export const IconSprite = memo(function IconSprite() {
  return (
    <svg aria-hidden="true" focusable="false" width="0" height="0" style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden' }} data-testid="icon-sprite">
      <defs>
        <clipPath id="sl-unit-disc" clipPathUnits="userSpaceOnUse">
          <circle r={1} />
        </clipPath>
        {/* STOPS[3] across the follow star's box (gradPaint(2, true), luau:3134) */}
        <linearGradient id="sl-spectrum-follow" gradientUnits="userSpaceOnUse" x1={3} y1={0} x2={21} y2={0}>
          <stop offset="0" stopColor="#6B58F5" />
          <stop offset="0.40" stopColor="#A58FE6" />
          <stop offset="0.76" stopColor="#E7C1D6" />
          <stop offset="1" stopColor="#FFF0E6" />
        </linearGradient>
      </defs>

      {ICON_NAMES.map((name) => {
        const { d, box, stroke } = ICONS[name];
        return (
          <symbol key={name} id={iconId(name)} viewBox={box.join(' ')} overflow="visible">
            {stroke === undefined ? (
              <path d={d} fill="currentColor" />
            ) : (
              <path d={d} fill="none" stroke="currentColor" style={{ strokeWidth: `var(--icon-sw, ${stroke})` }} {...ROUND} />
            )}
          </symbol>
        );
      })}
      {/* the follow star when on: filled with the spectrum (followIcon, luau:3129) */}
      <symbol id="sl-i-follow-on" viewBox="0 0 24 24" overflow="visible">
        <path d={ICONS.follow.d} fill="url(#sl-spectrum-follow)" />
      </symbol>

      {/* round tags: unit glyphs centred on 0, 0, the disc included (luau:3462-3527) */}
      <symbol id={tagId('goal')} viewBox="-1 -1 2 2">
        {disc('var(--c-text)')}
        <BallGlyph />
      </symbol>
      <symbol id={tagId('assist')} viewBox="-1 -1 2 2">
        {disc('var(--c-text)')}
        <g transform="translate(0 -0.06) scale(1.166)">
          <path d={ICON_SRC.bootUp} fill="none" stroke={BALL_INK} strokeWidth={0.085} {...ROUND} />
          <path d={ICON_SRC.bootSole} fill={BALL_INK} />
          <path d={ICON_SRC.bootLace} fill="none" stroke={BALL_INK} strokeWidth={0.085} {...ROUND} />
        </g>
      </symbol>
      <symbol id={tagId('yellow')} viewBox="-1 -1 2 2">
        {card('var(--c-card)')}
      </symbol>
      <symbol id={tagId('red')} viewBox="-1 -1 2 2">
        {card('var(--c-red)')}
      </symbol>
      <symbol id={tagId('subOut')} viewBox="-1 -1 2 2">
        {sub(true)}
      </symbol>
      <symbol id={tagId('subIn')} viewBox="-1 -1 2 2">
        {sub(false)}
      </symbol>
    </svg>
  );
});
