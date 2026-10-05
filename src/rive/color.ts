/** Rive Color properties are unsigned ARGB; domain colors are six-digit hex RGB. */
export function argb(hex: string): number {
  if (!/^#[\da-f]{6}$/i.test(hex)) throw new Error('Rive color must be six-digit hex RGB');
  return (0xff000000 | Number.parseInt(hex.slice(1), 16)) >>> 0;
}
