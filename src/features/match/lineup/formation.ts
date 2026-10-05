// Where a side's eleven stand (formRows and slotRow, luau:2320-2345, and the pitch in lineup,
// luau:5557-5602). Pure: no React, no DOM.

/** The pitch's measures (PITCH_H, FACE and PLATE_H, luau:5380-5382). */
export const PITCH = {
  /** the pitch's height; its width is the screen's less 2 × 18 */
  height: 540,
  /** a photo token's width on the pitch */
  face: 56,
  /** the name plate's height */
  plate: 20,
  /** a marker's visual middle sits this far above its row (photo above, plate on the row) */
  lift: 26,
} as const;

const FALLBACK = '4-3-3';

/** "4-2-3-1" → [1, 4, 2, 3, 1]: the keeper first, then each line from the defence up (luau:2325). */
export function formRows(form: string): number[] {
  const rows = [1];
  for (const d of form.match(/\d+/g) ?? []) rows.push(Number(d) || 1);
  return rows;
}

/** Row (1 = the keeper), place in the row (1 = left) and the row's players, for a slot of the eleven (slotRow, luau:2336). */
export function slotRow(form: string, slot: number): { row: number; index: number; count: number } {
  const rows = formRows(form);
  let k = slot;
  for (let i = 0; i < rows.length; i++) {
    const n = rows[i]!;
    if (k <= n) return { row: i + 1, index: k, count: n };
    k -= n;
  }
  return { row: rows.length, index: 1, count: 1 };
}

/** GK, DF, MF or FW from a slot (slotLine, luau:2347): the line a player without a position stands in. */
export function slotLine(form: string, slot: number): 'GK' | 'DF' | 'MF' | 'FW' {
  const { row } = slotRow(form, slot);
  const last = formRows(form).length;
  if (row === 1) return 'GK';
  if (row === 2) return 'DF';
  return row === last ? 'FW' : 'MF';
}

/** A formation that doesn't hold eleven players can't be laid out; the Lua's default stands in. */
export function usableFormation(form: string, players = 11): string {
  return formRows(form).reduce((a, b) => a + b, 0) === players ? form : FALLBACK;
}

/*
 * The pitch is cut into one mowing stripe per line of players, all the same height and edge to
 * edge, and each line stands in the middle of its stripe: a marker's visual middle (PITCH.lift
 * above its row) on the stripe's centre. The Lua spaced the rows from 98 under the top to 34 above
 * the bottom and centred a stripe on each, which left a sliver of bare pitch above the forwards
 * and below the keeper (review of 2026-10-04: "five sections, and even").
 */

/** A stripe's height when `rows` lines share the pitch. */
export const bandHeight = (rows: number, h: number = PITCH.height) => h / Math.max(rows, 1);

/** The y of row `row` (1 = the keeper) on a pitch of height `h`: the middle of its stripe, plus the lift. */
export function rowY(rows: number, row: number, h: number = PITCH.height): number {
  const bh = bandHeight(rows, h);
  return (rows - row + 0.5) * bh + PITCH.lift;
}

export interface Slot {
  /** shirt number */
  readonly n: number;
  /** 1 = the keeper */
  readonly row: number;
  /** 1 = left */
  readonly index: number;
  readonly count: number;
  /** the marker's centre, from the pitch's left edge */
  readonly x: number;
  /** the name plate's centre line, from the pitch's top edge */
  readonly y: number;
  /** how wide the name plate may grow */
  readonly maxW: number;
  /** rows between this one and the forwards: 0 for the forwards, who rise first (luau:5597) */
  readonly fromTop: number;
}

export interface PitchLayout {
  /** the formation actually laid out */
  readonly form: string;
  readonly rows: readonly number[];
  readonly slots: readonly Slot[];
  /** the mowing stripes: one band per line of players, [top, height] (luau:5568) */
  readonly bands: readonly { readonly y: number; readonly h: number; readonly shade: number }[];
}

/** Every marker's place on a pitch `pw` wide, from the formation and the eleven in slot order (luau:5584-5601). */
export function pitchLayout(form: string, xi: readonly number[], pw: number): PitchLayout {
  const eleven = xi.slice(0, 11);
  const f = usableFormation(form, eleven.length);
  const rows = formRows(f);
  const R = rows.length;
  const slots: Slot[] = [];
  let slot = 0;
  for (let row = 1; row <= R; row++) {
    const count = rows[row - 1]!;
    const spacing = Math.min((pw - 16) / count, 116);
    const maxW = Math.min(spacing - 6, 92);
    for (let i = 1; i <= count; i++) {
      const n = eleven[slot++];
      if (n === undefined) continue;
      slots.push({ n, row, index: i, count, x: pw / 2 + (i - (count + 1) / 2) * spacing, y: rowY(R, row), maxW, fromTop: R - row });
    }
  }
  const bh = bandHeight(R);
  const bands = [];
  for (let row = R; row >= 1; row--) {
    bands.push({ y: (R - row) * bh, h: bh, shade: (R - row) % 2 === 0 ? 0.03 : 0.008 });
  }
  return { form: f, rows, slots, bands };
}
