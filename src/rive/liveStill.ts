/*
 * The Live button's still: the art as it stands with Live on, shown until Rive has drawn it (in the
 * page's first frame, and in the app until the art is ready), so the page never shows another Live
 * design first. Its drawing is index.html's <svg id="live-sprite">: #live-still, the art less the
 * calendar's digit, and #ld0–#ld9, the digits as the art's font draws them. Those and the numbers
 * below come from scripts/live-still.py (the editor's static SVG and the font in the .riv).
 * Coordinates are the export's: the artboard (433 × 152) scaled by 434 / 433, drawn in the canvas's
 * box (LIVE_CANVAS_STYLE).
 */
export const LIVE_DIGITS = {"centre": 331.29, "baseline": 91.4, "spacing": 1.9, "advance": [22.38, 11.16, 18.5, 19.21, 20.46, 19.82, 20.3, 17.19, 20.04, 20.3]};

/** The still's view box: the artboard centred in the canvas's 443 × 152 as Rive draws it, in the export's scale. */
export const LIVE_STILL_VIEWBOX = '-5.01 0 443.89 152.3';

/** Each digit of `count` and where it starts: centred in the calendar, spaced, as Rive's runtime draws it. */
export function liveDigits(count: number): { digit: string; x: number }[] {
  const digits = [...String(Math.max(0, Math.trunc(count)))];
  const step = (d: string) => LIVE_DIGITS.advance[Number(d)]! + LIVE_DIGITS.spacing;
  const width = digits.reduce((w, d) => w + step(d), 0) - LIVE_DIGITS.spacing;
  let x = LIVE_DIGITS.centre - width / 2;
  return digits.map((digit) => {
    const at = { digit, x: Math.round(x * 100) / 100 };
    x += step(digit);
    return at;
  });
}
