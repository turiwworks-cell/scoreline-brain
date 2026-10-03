// The player page's geometry (drawPlayerView, luau:5851–5858). The Lua draws on a 390-wide
// artboard centred at x 195; here the same numbers hang from the page's centre.

/** the whole bust cell, on the page */
export const HERO = { x: 55, y: 90, w: 280, h: 350 } as const;
/** the bust is cut sharp here, in the bust's 360 design units: its soft edge starts at 324 */
export const CUT = 318;
/** the bust's design size */
export const BUST_H = 360;
/** the line of light: where the bust is cut, and where the giant number stands */
export const LINE_Y = HERO.y + (HERO.h * CUT) / BUST_H;
/** the visible part of the bust cell */
export const CUT_H = LINE_Y - HERO.y;
/** the first baseline of the info under him */
export const NAME_Y = 456;
/** the giant number: L 300 */
export const NUMBER = { size: 300, track: -0.05, weight: 300 } as const;
/** the soft light behind everything, in the screen's own coordinates */
export const BACKDROP = { cy: 250, height: 640, rx: 330, ry: 340 } as const;
/** the bar that frosts as he scrolls under it */
export const BAR_H = 96;
