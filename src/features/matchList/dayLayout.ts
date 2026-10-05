// Where the day tabs sit (dayLayout and placeDayInd, luau:3705–3736). A tab is as wide as its word
// plus 13 px each side; the Today tab's word slides from "Today" to "Ongoing" as Live turns on, and
// the strip shifts so the chosen tab is centred. Pure: the caller measures the words.

import { lerp } from './curve';

/** Space each side of a tab's word (luau:3709). */
export const DAY_PAD = 13;

/**
 * The type of a tab's word, as `.tab` sets it in DayTabs.module.css: `font: var(--type-row)` (weight
 * 500, 15 px) with `letter-spacing: var(--track-1)` (−0.01 em). The widths are measured on a canvas
 * with these, so dayLayout.test.ts holds them to the stylesheet and the tokens.
 */
export const DAY_TYPE = { weight: 500, size: 15, track: -0.01 } as const;

export interface DayWidths {
  /** the width of each tab's word, in order */
  readonly words: readonly number[];
  /** the position of the tab whose word changes */
  readonly morph: number;
  /** the width of "Today" and of "Ongoing" */
  readonly today: number;
  readonly ongoing: number;
}

export interface DayBoxes {
  readonly xs: readonly number[];
  readonly ws: readonly number[];
}

/** Each tab's left edge and width with Live at `k` (0 = Today, 1 = Ongoing). */
export function dayLayout(d: DayWidths, k: number): DayBoxes {
  const xs: number[] = [];
  const ws: number[] = [];
  let x = 0;
  d.words.forEach((word, i) => {
    const w = (i === d.morph ? lerp(d.today, d.ongoing, k) : word) + DAY_PAD * 2;
    xs.push(x);
    ws.push(w);
    x += w;
  });
  return { xs, ws };
}

export interface DayPlace {
  /** how far the strip moves so the chosen tab is centred (whole px) */
  readonly shift: number;
  /** the indicator's left edge within the viewport and its width */
  readonly indX: number;
  readonly indW: number;
}

/** The strip's shift and the indicator for tab `i` in a viewport `vw` wide. */
export function dayPlace(b: DayBoxes, i: number, vw: number): DayPlace {
  const x = b.xs[i] ?? 0;
  const w = b.ws[i] ?? 0;
  const shift = Math.floor(vw / 2 - (x + w / 2) + 0.5);
  return { shift, indX: x + shift + DAY_PAD, indW: w - DAY_PAD * 2 };
}
