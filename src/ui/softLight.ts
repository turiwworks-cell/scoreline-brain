/*
 * The soft light (softLight, luau:3310-3336): a smooth bump fall-off, (1 - t^2)^3, that
 * reaches zero with no visible edge, and a core a touch whiter than its rim. Each stop
 * mixes the colour toward white by a different amount, so the three channels step at
 * different rates and their 8-bit steps interleave: the light reads smooth, not in rings.
 * 25 stops, as in the Lua.
 */
export const SOFT_LIGHT_STOPS = 25;

export type SoftLightSpec = {
  /** the light's colour, #rrggbb */
  color: string;
  /** peak opacity, 0..1 */
  alpha: number;
  /** centre, in px from the box's top-left (or any CSS length) */
  cx: number | string;
  cy: number | string;
  /** radii in px */
  rx: number;
  ry: number;
};

function parseHex(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.replace(/./g, (c) => c + c) : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

// mix(a, b, p) on 0..255 channels, rounded (luau:1131)
function mix(a: [number, number, number], b: [number, number, number], p: number): [number, number, number] {
  return [0, 1, 2].map((i) => Math.round(a[i]! + (b[i]! - a[i]!) * p)) as [number, number, number];
}

const len = (v: number | string) => (typeof v === 'number' ? `${v}px` : v);
const fmt = (n: number) => String(Math.round(n * 10000) / 10000);

/** The stops of a soft light, as CSS colour-stop strings (position 0..100 % of the radius). */
export function softLightStops(color: string, alpha: number): string[] {
  const c = parseHex(color);
  const white: [number, number, number] = [255, 255, 255];
  const a = Math.min(Math.max(alpha, 0), 1);
  const out: string[] = [];
  for (let i = 0; i < SOFT_LIGHT_STOPS; i++) {
    const t = i / (SOFT_LIGHT_STOPS - 1);
    const v = (1 - t * t) ** 3;
    const [r, g, b] = mix(c, white, 0.35 * (1 - t) ** 2);
    out.push(`rgb(${r} ${g} ${b} / ${fmt(v * a)}) ${fmt(t * 100)}%`);
  }
  return out;
}

/** The soft light as a CSS background-image. */
export function softLightGradient({ color, alpha, cx, cy, rx, ry }: SoftLightSpec): string {
  return `radial-gradient(${rx}px ${ry}px at ${len(cx)} ${len(cy)}, ${softLightStops(color, alpha).join(', ')})`;
}
