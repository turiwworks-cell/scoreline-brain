// The size of everything on a live card as a function of the card's width (drawCard, luau:3743–3880).
// Cards share 366 px between them, so with five on stage each is about 70 px wide: the crests, the
// type and the padding grow with the width and the team names give way to short names, then to
// nothing. Pure: the caller measures the text.

import { clamp, lerp } from './curve';

/** Every live card's height runs from 128 (kick-off) to 244 (90 minutes); luau:3746. */
export const CARD_H = { min: 128, max: 244 } as const;
/** The cards' strip: 244 px tall, 366 wide, 4 px between cards; luau:3724, 3779. */
export const CARDS = { height: 244, width: 366, gap: 4 } as const;
/** The live section: label row 26 + cards 244 + 30 below; luau:3706. */
export const LIVE_SECTION_H = 26 + CARDS.height + 30;

export const cardHeight = (mm: number) => CARD_H.min + (CARD_H.max - CARD_H.min) * (Math.min(mm, 90) / 90);

export interface CardMetrics {
  /** 0 on the narrowest card, 1 from 172 px up */
  readonly s: number;
  readonly pad: number;
  /** crest diameter */
  readonly crest: number;
  /** team name size */
  readonly name: number;
  /** score size */
  readonly score: number;
  /** from the crest to the name, and between the two rows */
  readonly nameGap: number;
  readonly rowGap: number;
  /** the minute's size before it is fitted to the card */
  readonly minute: number;
}

export function cardMetrics(w: number): CardMetrics {
  const s = clamp((w - 62) / 110, 0, 1);
  return {
    s,
    pad: lerp(8, 14, s),
    crest: clamp(w * 0.19, 14, 24),
    name: clamp(w * 0.13, 10.5, 15),
    score: clamp(w * 0.18, 13, 24),
    nameGap: lerp(4, 8, s),
    rowGap: lerp(5, 8, s),
    minute: clamp(w * 0.46, 34, 58),
  };
}

/** The gap between cards closes as a card folds away (luau:3917). */
export const cardGap = (w: number) => CARDS.gap * clamp(w / 24, 0, 1);

/** The width each live card aims for when `n` share the strip (luau:3787). */
export const targetWidth = (n: number) => (n > 0 ? (CARDS.width - CARDS.gap * (n - 1)) / n : 0);

/** The largest size ≤ `size` at which text of `width` (measured at `size`) fits in `maxW` (fit, luau:1634). */
export function fitSize(size: number, width: number, maxW: number): number {
  return width <= maxW || width <= 0 ? size : (size * maxW) / width;
}

export type NameChoice = 'name' | 'short' | 'none';

export interface NameWidths {
  /** the score's width at the score size */
  readonly score: number;
  /** the full name, measured with no tracking (luau:3834) */
  readonly name: number;
  /** the short name, measured as drawn (tracking 0.02) */
  readonly short: number;
  /** the full name as drawn, if the name is chosen */
  readonly nameDrawn: number;
}

/** Which of a team's names the card has room for on one row (luau:3828–3836). */
export function nameChoice(w: number, m: CardMetrics, t: NameWidths): NameChoice {
  const room = w - 2 * m.pad - m.crest - m.nameGap - t.score - 6;
  if (m.s > 0.35 && t.name <= room) return t.nameDrawn <= room + 2 ? 'name' : 'none';
  return t.short <= room + 2 ? 'short' : 'none';
}

/** The minute label's size: fitted into the card's width less its padding (luau:3861). */
export const minuteSize = (m: CardMetrics, w: number, textW: number) => fitSize(m.minute, textW, w - 2 * m.pad - 8);
