import { LIVE_CANVAS_STYLE } from './liveGeometry';
import { GLYPHS, SUPPLIED_ZERO } from './liveOffArt';
import { LIVE_DIGITS, LIVE_STILL_VIEWBOX, liveDigits } from './liveStill';

/*
 * The Live button with Live off: the artwork the owner supplied (Preset-1, "OFF"), drawn as it
 * came, in its own 434 × 152 artboard, which is the artboard Rive's canvas and the ON still use
 * (liveGeometry.ts, liveStill.ts), so it sits in the canvas's box and the capsule lands on the
 * button's. Its paths, transforms and colours are the supplied SVG's. Two things differ:
 *  - its two gradients carry a prefix: the page's sprite (index.html) already has a #grad0 and a
 *    #grad1 for the ON still, and two ids the same are one id too many;
 *  - the calendar's digit was drawn as a fixed "0". The count is the number of matches in play,
 *    so the digits are the art's own glyphs (the same ones as index.html's #ld0–#ld9, held here so
 *    this art stands alone), centred where that 0 stood. For a count of 0 it is the supplied 0.
 * Both the Rive host and the reduced-motion button share this lazy chunk; it is not in the first script.
 */

const CAPSULE = 'M-262.5 0.75C-262.5 -36.67 -232.2 -67 -194.8 -67L-68.25 -67C-30.83 -67 -0.5 -36.67 -0.5 0.75C-0.5 38.17 -30.83 68.5 -68.25 68.5L-194.8 68.5C-232.2 68.5 -262.5 38.17 -262.5 0.75Z';
const at = (x: number, y: number) => `matrix(1.002 0 0 1.002 ${x} ${y})`;
export function LiveOff({ count }: { count: number }) {
  return (
    <svg viewBox={LIVE_STILL_VIEWBOX} style={{ ...LIVE_CANVAS_STYLE, pointerEvents: 'none' }} aria-hidden="true" focusable="false" data-live-off="">
      <defs>
        <linearGradient id="sl-live-off-grad0" x1="-91.09" y1="68.5" x2="-119.2" y2="0.75" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="rgb(218,218,218)" stopOpacity="0.2" />
          <stop offset="1" stopColor="rgb(0,0,0)" stopOpacity="0.2" />
        </linearGradient>
        <linearGradient id="sl-live-off-grad1" x1="118.6" y1="0.75" x2="86.52" y2="-67" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="rgb(0,0,0)" stopOpacity="0.2" />
          <stop offset="1" stopColor="rgb(255,255,255)" stopOpacity="0.2" />
        </linearGradient>
      </defs>
      <path transform={at(405.9, 75.25)} fill="#121212" d={CAPSULE} />
      <path transform={at(405.9, 75.25)} fill="none" stroke="url(#sl-live-off-grad0)" strokeWidth="2" strokeLinecap="round" d={CAPSULE} />
      <path transform={at(405.9, 75.25)} fill="none" stroke="url(#sl-live-off-grad1)" strokeWidth="2" d={CAPSULE} />
      <path transform={at(256.6, 76)} fill="#2a2a2a" d="M-76 0C-76 -20.99 -58.99 -38 -38 -38C-17.01 -38 0 -20.99 0 0C0 20.99 -17.01 38 -38 38C-58.99 38 -76 20.99 -76 0Z" />
      <path transform={at(220.5, 76.25)} fill="#ffffff" d="M-0.25 -14C7.344 -14 13.5 -7.844 13.5 -0.25C13.5 7.344 7.344 13.5 -0.25 13.5C-7.844 13.5 -14 7.344 -14 -0.25C-14 -7.844 -7.844 -14 -0.25 -14Z" />
      <path transform={at(220.5, 76.25)} fill="#83dc7b" fillOpacity="0.3098" d="M-0.25 -0.25Z" />
      <path transform={at(332.3, 75.75)} fill="#ffffff" d="M-35 -21C-35 -27.08 -30.08 -32 -24 -32L24 -32C30.08 -32 35 -27.08 35 -21L35 21.5C35 27.58 30.08 32.5 24 32.5L-24 32.5C-30.08 32.5 -35 27.58 -35 21.5L-35 -21Z" />
      <path transform={at(332.3, 80.26)} fill="#121212" d="M-28 -17C-28 -19.21 -26.21 -21 -24 -21L24 -21C26.21 -21 28 -19.21 28 -17L28 17C28 19.21 26.21 21 24 21L-24 21C-26.21 21 -28 19.21 -28 17L-28 -17Z" />
      {count === 0 ? (
        <path transform={at(320.1, 59.59)} fill="#ffffff" d={SUPPLIED_ZERO} />
      ) : (
        liveDigits(count).map(({ digit, x }, i) => (
          <path key={i} data-digit={digit} transform={`translate(${x} ${LIVE_DIGITS.baseline})`} fill="#ffffff" d={GLYPHS[Number(digit)]} />
        ))
      )}
    </svg>
  );
}

export default LiveOff;
