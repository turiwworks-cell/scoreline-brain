import type { CSSProperties } from 'react';

/*
 * The exported artboard is 443 × 152. Inside it the button's capsule (its glass rim) spans
 * y 7.25–144.75 and ends at x 410.5; it starts at x 32.5 when Live is on and at 146.5 when off,
 * so it widens as "Live" appears. Measured from the export at 4×.
 *
 * The Lua scales the icon so the capsule, not the artboard, is 40 px tall: the height of the round
 * menu button beside it, on the same top line (setupIcon, luau:8352). Sizing the artboard instead
 * made the capsule 34 px and left it out of line with the menu.
 */
export const LIVE_ART = { width: 443, height: 152 } as const;
export const LIVE_CAPSULE = { top: 7.25, height: 137.5, right: 410.5, leftOn: 32.5, leftOff: 146.5 } as const;
/** The capsule's height on screen: the round button's (roundBtn, luau:3451). */
export const LIVE_CAPSULE_PX = 40;

const k = LIVE_CAPSULE_PX / LIVE_CAPSULE.height;
/** The button is the capsule at its widest; when Live is off the capsule fills its right part. */
export const LIVE_BUTTON_W = (LIVE_CAPSULE.right - LIVE_CAPSULE.leftOn) * k;
export const LIVE_OFF_W = (LIVE_CAPSULE.right - LIVE_CAPSULE.leftOff) * k;
export const livePx = (v: number) => `${Math.round(v * 100) / 100}px`;

/** Where the artboard's canvas sits around the button, so its capsule lands on the button's box. */
export const LIVE_CANVAS_STYLE: CSSProperties = {
  position: 'absolute',
  left: livePx(-LIVE_CAPSULE.leftOn * k),
  top: livePx(-LIVE_CAPSULE.top * k),
  width: livePx(LIVE_ART.width * k),
  height: livePx(LIVE_ART.height * k),
};
