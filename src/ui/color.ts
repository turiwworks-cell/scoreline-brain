/*
 * Colour maths on "#rrggbb" strings, ported from the Lua (luau:1131-1155).
 * Results are "#RRGGBB", the form the domain stores team colours in.
 */

type RGB = [number, number, number];

function rgb(hex: string): RGB {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.replace(/./g, (c) => c + c) : h, 16) || 0;
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

const toHex = (c: RGB) => `#${c.map((x) => x.toString(16).padStart(2, '0')).join('').toUpperCase()}`;

/** mix(a, b, p): each channel lerped and rounded (luau:1131). */
export function mix(a: string, b: string, p: number): string {
  const x = rgb(a);
  const y = rgb(b);
  return toHex([0, 1, 2].map((i) => Math.floor(x[i]! + (y[i]! - x[i]!) * p + 0.5)) as RGB);
}

/** Relative luminance (WCAG), luau:1138. */
export function luma(hex: string): number {
  const lin = (c: number) => {
    const v = c / 255;
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  const [r, g, b] = rgb(hex);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/** A team colour lightened until black text on it passes WCAG AA comfortably (pastel, luau:1146). */
export function pastel(hex: string): string {
  let p = 0.22;
  let c = mix(hex, '#F7F2EA', p);
  while (luma(c) < 0.36 && p < 0.95) {
    p += 0.06;
    c = mix(hex, '#F7F2EA', p);
  }
  return c;
}
