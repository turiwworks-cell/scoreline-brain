import { memo, type ReactNode, type SVGAttributes } from 'react';
import type { FlagCommand } from '../domain';
import { colorOf } from '../domain';
import { flagOf, type CrestTeam } from './flags';
import { ICON_SRC, UNIT_PATHS } from './icons';
import { useSvgId } from './svgId';

/*
 * A team's round crest (crest(), luau:3143-3186): its flag drawn in a 30 x 30 box and cut
 * to a circle. The flag is the team's own `flag` when the feed sends one, else the built-in
 * flag for that id, else a disc in the first colour ringed in the second.
 */

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
const col = (v: unknown) => colorOf(v, '#000000');
const ROUND = { strokeLinecap: 'round', strokeLinejoin: 'round' } as const;

/** One flag command as SVG, in the 30 x 30 box. Unknown commands draw nothing. */
function shape(op: FlagCommand, key: number): ReactNode {
  const kind = op[0];
  switch (kind) {
    case 'h':
    case 'v': {
      const cs = op.slice(1);
      const n = cs.length;
      // each stripe overlaps the next by 0.4 so no seam shows
      return (
        <g key={key}>
          {cs.map((c, i) => {
            const a = (i * 30) / n;
            const b = 30 / n + 0.4;
            return kind === 'h' ? <rect key={i} x={0} y={a} width={30} height={b} fill={col(c)} /> : <rect key={i} x={a} y={0} width={b} height={30} fill={col(c)} />;
          })}
        </g>
      );
    }
    case 'r':
      return <rect key={key} x={num(op[1])} y={num(op[2])} width={Math.max(0, num(op[3]))} height={Math.max(0, num(op[4]))} fill={col(op[5])} />;
    case 'c':
      return num(op[3]) > 0 ? <circle key={key} cx={num(op[1])} cy={num(op[2])} r={num(op[3])} fill={col(op[4])} /> : null;
    case 'cs':
      return num(op[3]) > 0 ? <circle key={key} cx={num(op[1])} cy={num(op[2])} r={num(op[3])} fill="none" stroke={col(op[5])} strokeWidth={num(op[4])} /> : null;
    case 's':
      return <path key={key} d={UNIT_PATHS.star} transform={`translate(${num(op[1])} ${num(op[2])}) scale(${num(op[3])})`} fill={col(op[4])} />;
    case 'p5': {
      const rad = num(op[3]) || 1;
      return (
        <path
          key={key}
          d={UNIT_PATHS.p5}
          transform={`translate(${num(op[1])} ${num(op[2])}) scale(${rad})`}
          fill="none"
          stroke={col(op[4])}
          strokeWidth={num(op[5]) / rad}
          strokeLinecap="round"
          strokeLinejoin="miter"
        />
      );
    }
    case 'd':
      return <path key={key} d={ICON_SRC.diamond} fill={col(op[1])} />;
    case 'a':
      return <path key={key} d={ICON_SRC.mexArc} fill="none" stroke={col(op[1])} strokeWidth={0.9} {...ROUND} />;
    case 'rr': {
      const [x, y, w, h, rad] = [num(op[1]), num(op[2]), num(op[3]), num(op[4]), num(op[5])];
      return (
        <g key={key}>
          <rect x={x} y={y} width={w} height={h} rx={rad} fill={col(op[6])} />
          <rect x={x} y={y} width={w} height={h} rx={rad} fill="none" stroke={col(op[7])} strokeWidth={0.6} {...ROUND} />
        </g>
      );
    }
    default:
      return null;
  }
}

export type CrestProps = Omit<SVGAttributes<SVGSVGElement>, 'children'> & {
  team: CrestTeam;
  /** diameter in px; the Lua's size (30 is the flag's own box) */
  size?: number;
  /** an accessible name (the team's name); without it the crest is decorative */
  label?: string;
};

export const Crest = memo(function Crest({ team, size = 30, label, ...rest }: CrestProps) {
  const clip = useSvgId('sl-crest');
  const ops = flagOf(team);
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 30 30"
      {...(label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true })}
      focusable="false"
      data-crest={team.id}
      {...rest}
    >
      <clipPath id={clip}>
        <circle cx={15} cy={15} r={15} />
      </clipPath>
      <g clipPath={`url(#${clip})`}>{ops.map(shape)}</g>
    </svg>
  );
});
