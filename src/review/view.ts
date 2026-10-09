import { appRoute } from './protocol';

/* How the review page lays out its phone, and where it starts: the parts that are plain calculation. */

export const PHONE = { w: 390, h: 844 } as const;
/** the bezel round the screen, and the room the controls and margins take above and beside it */
export const BEZEL = 10;
const ROOM = { x: 32, y: 188 };
export const FEATURED_HELP = 'Goal and red card happen in the featured match, France – Argentina, and show on the phone as they would in the app.';

/** Where the viewer was: the route in the link, else the page that linked here. */
export function startRoute(search: string, referrer: string, origin: string): string {
  const to = new URLSearchParams(search).get('to');
  if (to) return appRoute(to, origin);
  return referrer.startsWith(origin) ? appRoute(referrer, origin) : '/';
}

/** How far to shrink the phone so it fits the window whole (never beyond its true size). */
export function fitScale(width: number, height: number): number {
  return Math.max(0.3, Math.min(1, (width - ROOM.x) / (PHONE.w + 2 * BEZEL), (height - ROOM.y) / (PHONE.h + 2 * BEZEL)));
}

