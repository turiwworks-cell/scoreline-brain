import type { FaceFrame } from './photos';

/*
 * Where a small face is cut from a bust (riseFace, luau:3654). The Lua cut every face at one fixed
 * rectangle, CROP.face (luau:1471); here the crop follows his head (`face`, measured per bust by
 * scripts/slice-atlas.ts). The Argentina busts were framed about a fifth larger and higher than
 * France's, so with one rectangle Messi came out bigger than Mbappé. Every head is scaled to REF.w units wide (within ±15 %, so a raised arm or
 * big hair is not over-corrected) and its top put REF.top units into the crop: a head of median
 * size and place gets the Lua's own CROP.face.
 */

const FACE = { x: 60, y: 8, w: 168 } as const;
/** A head of the published busts' median width (units) and its top's depth in CROP.face. */
const REF = { w: 64, top: 21 } as const;
const FIX = 0.15;

/** The face crop of a bust, in design units, and the scale it is drawn at relative to CROP.face. */
export function faceCrop(face: FaceFrame | undefined): { x: number; y: number; w: number; s: number } {
  if (!face) return { x: FACE.x, y: FACE.y, w: FACE.w, s: 1 };
  const s = Math.min(Math.max(REF.w / face.w, 1 - FIX), 1 + FIX);
  const w = FACE.w / s;
  return { x: face.cx - w / 2, y: face.top - REF.top / s, w, s };
}
