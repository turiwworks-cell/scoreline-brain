/*
 * The icon paths (ICON_SRC and buildIcons, luau:3031-3105), as SVG path data.
 * The strings are the Lua's, verbatim; the star, pentagon, pentagram and ball seams are
 * generated the way buildIcons builds them.
 */

export const ICON_SRC = {
  sub: 'M 7 4 L 7 17 M 3 13 L 7 17 L 11 13 M 17 20 L 17 7 M 13 11 L 17 7 L 21 11',
  back: 'M 7.5 1.5 L 1.5 8 L 7.5 14.5',
  fwd: 'M 1.5 1.5 L 7.5 8 L 1.5 14.5',
  follow: 'M 12 3 L 14.6 8.6 L 20.7 9.4 L 16.2 13.6 L 17.3 19.7 L 12 16.8 L 6.6 19.7 L 7.7 13.6 L 3.2 9.4 L 9.3 8.6 Z',
  close: 'M 1 1 L 11 11 M 11 1 L 1 11',
  chev: 'M 1 1 L 5 5 L 9 1',
  chevR: 'M 1 1 L 5 5 L 1 9',
  up: 'M 4 9 L 4 1 M 1 4 L 4 1 L 7 4',
  down: 'M 4 1 L 4 9 M 1 6 L 4 9 L 7 6',
  play: 'M 0 0 L 7 4.5 L 0 9 Z',
  plus: 'M 5 0 L 5 10 M 0 5 L 10 5',
  diamond: 'M 15 4.3 L 27 15 L 15 25.7 L 3 15 Z',
  mexArc: 'M 12.4 16.6 C 14.13 17.8 15.87 17.8 17.6 16.6',
  // unit-sized glyphs for the round tags (centred on 0, 0)
  // the football boot: an outlined upper, a solid sole with four studs, two laces (toe to the right)
  bootUp:
    'M -0.60 -0.27 C -0.50 -0.31 -0.36 -0.29 -0.27 -0.22 C -0.19 -0.17 -0.11 -0.19 -0.05 -0.27 ' +
    'C 0.08 -0.12 0.28 -0.01 0.50 0.04 C 0.63 0.07 0.67 0.15 0.62 0.18 L -0.60 0.18 C -0.64 0.05 -0.65 -0.16 -0.60 -0.27 Z',
  bootSole:
    'M -0.62 0.14 L 0.63 0.14 C 0.66 0.19 0.63 0.25 0.57 0.25 L -0.59 0.25 C -0.63 0.24 -0.64 0.19 -0.62 0.14 Z ' +
    'M -0.545 0.25 L -0.415 0.25 L -0.438 0.36 L -0.522 0.36 Z M -0.275 0.25 L -0.165 0.25 L -0.185 0.36 L -0.255 0.36 Z ' +
    'M 0.105 0.25 L 0.215 0.25 L 0.195 0.36 L 0.125 0.36 Z M 0.355 0.25 L 0.485 0.25 L 0.462 0.36 L 0.378 0.36 Z',
  bootLace: 'M -0.01 -0.17 L 0.06 -0.09 M 0.12 -0.09 L 0.19 -0.01',
  arrowL: 'M 0.42 0 L -0.4 0 M -0.04 -0.36 L -0.42 0 L -0.04 0.36',
  arrowR: 'M -0.42 0 L 0.4 0 M 0.04 -0.36 L 0.42 0 L 0.04 0.36',
  chevUp: 'M 1 5 L 5 1 L 9 5',
} as const;

const f = (n: number) => String(Math.round(n * 10000) / 10000);
const pt = (a: number, r: number) => `${f(Math.cos(a) * r)} ${f(Math.sin(a) * r)}`;

function build() {
  // five-point star (inner radius 0.42) and pentagon, radius 1 around the origin
  const st: string[] = [];
  const pg: string[] = [];
  const v5: number[] = [];
  for (let i = 0; i <= 9; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    st.push(`${i === 0 ? 'M' : 'L'} ${pt(a, i % 2 === 1 ? 0.42 : 1)}`);
    if (i % 2 === 0) {
      v5.push(a);
      pg.push(`${i === 0 ? 'M' : 'L'} ${pt(a, 1)}`);
    }
  }
  // pentagram (Morocco): every second vertex
  const p5: string[] = [];
  for (let i = 0; i <= 5; i++) p5.push(`${i === 0 ? 'M' : 'L'} ${pt(v5[(i * 2) % 5]!, 1)}`);
  // ball seams: from the centre panel's corners to the rim panels
  const sm: string[] = [];
  for (let i = 0; i <= 4; i++) {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
    sm.push(`M ${pt(a, 0.36)} L ${pt(a, 0.72)}`);
  }
  return { star: `${st.join(' ')} Z`, pent: `${pg.join(' ')} Z`, p5: p5.join(' '), seams: sm.join(' ') };
}

/** Star, pentagon, pentagram and ball seams, radius 1 around the origin. */
export const UNIT_PATHS = build();

/** The UI icons the sprite carries, each in the box its Lua coordinates live in. */
export type IconName = 'sub' | 'back' | 'fwd' | 'follow' | 'close' | 'chev' | 'chevR' | 'chevUp' | 'up' | 'down' | 'play' | 'plus' | 'star';

type IconDef = {
  d: string;
  /** viewBox: the box the Lua's coordinates sit in, drawn at 1:1 by default */
  box: readonly [number, number, number, number];
  /** stroke width the Lua draws it with; absent = filled */
  stroke?: number;
};

// Strokes are the ones the Lua's icon() calls pass (luau:3138, 4009, 4519, 5048-5050, 5199, 5832, 6673).
export const ICONS: Record<IconName, IconDef> = {
  sub: { d: ICON_SRC.sub, box: [0, 0, 24, 24], stroke: 1.6 },
  back: { d: ICON_SRC.back, box: [0, 0, 9, 16], stroke: 1.6 },
  fwd: { d: ICON_SRC.fwd, box: [0, 0, 9, 16], stroke: 1.6 },
  follow: { d: ICON_SRC.follow, box: [0, 0, 24, 24], stroke: 1.5 },
  close: { d: ICON_SRC.close, box: [0, 0, 12, 12], stroke: 1.6 },
  chev: { d: ICON_SRC.chev, box: [0, 0, 10, 6], stroke: 1.4 },
  chevR: { d: ICON_SRC.chevR, box: [0, 0, 6, 10], stroke: 1.5 },
  chevUp: { d: ICON_SRC.chevUp, box: [0, 0, 10, 6], stroke: 1.6 },
  up: { d: ICON_SRC.up, box: [0, 0, 8, 10], stroke: 1.5 },
  down: { d: ICON_SRC.down, box: [0, 0, 8, 10], stroke: 1.5 },
  play: { d: ICON_SRC.play, box: [0, 0, 7, 9] },
  plus: { d: ICON_SRC.plus, box: [0, 0, 10, 10], stroke: 1.5 },
  star: { d: UNIT_PATHS.star, box: [-1, -1, 2, 2] },
};

export const ICON_NAMES = Object.keys(ICONS) as IconName[];

/** Sprite ids for the round tags (unit glyphs, viewBox -1 -1 2 2, disc included). */
export type TagKind = 'goal' | 'assist' | 'yellow' | 'red' | 'subOut' | 'subIn';
export const TAG_KINDS: readonly TagKind[] = ['goal', 'assist', 'yellow', 'red', 'subOut', 'subIn'];

export const iconId = (name: IconName) => `sl-i-${name}`;
export const tagId = (kind: TagKind) => `sl-t-${kind}`;
