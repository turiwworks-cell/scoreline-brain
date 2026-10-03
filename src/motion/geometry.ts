// Pure geometry for shared-element flights (flight.ts). Boxes are viewport px.

export interface Box {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

export interface Size {
  readonly w: number;
  readonly h: number;
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export function lerpBox(a: Box, b: Box, t: number): Box {
  return { x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t), w: lerp(a.w, b.w, t), h: lerp(a.h, b.h, t) };
}

export function intersect(a: Box, b: Box): Box {
  const x = Math.max(a.x, b.x);
  const y = Math.max(a.y, b.y);
  const w = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - x);
  const h = Math.max(0, Math.min(a.y + a.h, b.y + b.h) - y);
  return { x, y, w, h };
}

/** How much of `a` lies inside `b`, 0..1. An empty `a` counts as outside. */
export function overlapRatio(a: Box, b: Box): number {
  const area = a.w * a.h;
  if (area <= 0) return 0;
  const i = intersect(a, b);
  return (i.w * i.h) / area;
}

/**
 * Where to draw something of natural `size` so it fills `box`: one uniform scale (text and crests
 * never stretch), matched on height, centred across. `x`, `y` are the top-left after scaling.
 */
export function fitInto(size: Size, box: Box): { x: number; y: number; s: number } {
  const s = size.h > 0 ? box.h / size.h : size.w > 0 ? box.w / size.w : 1;
  return { x: box.x + (box.w - size.w * s) / 2, y: box.y + (box.h - size.h * s) / 2, s };
}

/**
 * Opacities of the two copies during a flight at progress p (0..1). The arriving copy is drawn
 * on top and is fully in by the middle; the leaving copy under it holds, then goes. So the pair
 * never dips below full cover, and a copy that looks the same at both ends (a crest) never shows
 * the swap.
 */
export function crossfade(p: number): { from: number; to: number } {
  const to = Math.min(Math.max(p / 0.5, 0), 1);
  const from = p <= 0.6 ? 1 : Math.max(0, 1 - (p - 0.6) / 0.3);
  return { from, to };
}

/**
 * The inset() that cuts an image drawn at `image` (a viewport box) down to `clip`, in the image's
 * own un-scaled px (`nat` is its layout size), so `clip-path: inset(...)` can sit on the element
 * that is moved with translate and scale.
 */
export function insetOf(image: Box, clip: Box, nat: Size): { top: number; right: number; bottom: number; left: number } {
  const s = image.w > 0 ? image.w / nat.w : 1;
  const at = (v: number) => Math.max(0, v);
  return {
    top: at((clip.y - image.y) / s),
    left: at((clip.x - image.x) / s),
    right: at(nat.w - (clip.x + clip.w - image.x) / s),
    bottom: at(nat.h - (clip.y + clip.h - image.y) / s),
  };
}

/**
 * Opacities during a window flight (the face's picture growing into the bust, luau:5976): the bust
 * is fully in by 40 % of the way (clamp(e × 2.5)), the face it grows from stands still under it
 * and goes late. `e` is the opening progress: it runs 0 → 1 opening and 1 → 0 closing, so the
 * close is the same picture run backwards.
 */
export function windowFade(p: number, opening: boolean): { still: number; moving: number } {
  const e = Math.min(Math.max(opening ? p : 1 - p, 0), 1);
  return { still: crossfade(e).from, moving: Math.min(e * 2.5, 1) };
}
