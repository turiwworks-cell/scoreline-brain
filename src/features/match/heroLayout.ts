// The hero's geometry (drawHero, luau:4721): the matchday line, then one row per side whose height
// follows the scorers listed under the team's name. Pure; the widths come from a measure function.

import { minText } from '../../domain';
import type { FeedItem } from './events';

/** The matchday line and the air under it, down to the first rule (14 + 16.9 + 18, luau:4752). */
export const META_H = 48.9;
/** Centre line of the matchday line (luau:4724). */
export const META_CY = 22.45;
/** Air under the hero, above the tab bar (luau:4825). */
export const HERO_AFTER = 22;
/** The team name's line, and the scorers' line pitch and the gap between them (luau:4790). */
export const NAME_H = 27.3;
export const SCORER_GAP = 6;
export const SCORER_LINE = 16.1;
/** Scorers wrap inside the space left of the score: name at 72, 14 px of air, the score's 70 (luau:4764). */
export const SCORERS_X = 72;
const SCORE_ROOM = 70;
const AIR = 14;

export interface Scorer {
  readonly key: string;
  readonly player: number;
  readonly name: string;
  /** "23' 52'" */
  readonly minutes: string;
}

/**
 * A side's scorers in the order they first scored, each with every minute they scored in
 * (luau:4743). Goals VAR took back are not on the board.
 */
export function scorersOf(items: readonly FeedItem[], side: 'home' | 'away'): Scorer[] {
  // items are newest first; goalsOf sorts the goals by minute (luau:2512)
  const goals = items.filter((e) => e.kind === 'goal' && !e.cancelled && e.side === side).reverse();
  const by = new Map<string, { player: number; name: string; mins: string[] }>();
  for (const g of goals) {
    const key = g.player > 0 ? `n${g.player}` : `t${g.name}`;
    let s = by.get(key);
    if (!s) {
      s = { player: g.player, name: g.name, mins: [] };
      by.set(key, s);
    }
    s.mins.push(minText(g.minute));
  }
  return [...by].map(([key, s]) => ({ key, player: s.player, name: s.name, minutes: s.mins.join(' ') }));
}

/** Width of `s` at the scorers' face (R 11.5). */
export type Measure = (s: string) => number;

/** Lays the scorers into lines no wider than the room beside the score, as the Lua packs them. */
export function scorerLines(scorers: readonly Scorer[], measure: Measure, width: number, scheduled: boolean): Scorer[][] {
  const avail = width - 18 - SCORERS_X - AIR - (scheduled ? 0 : SCORE_ROOM);
  const sep = measure(' · ');
  const lines: Scorer[][] = [];
  let cur: Scorer[] = [];
  let lx = 0;
  for (const s of scorers) {
    const w = measure(s.name) + 4 + measure(s.minutes);
    const gap = cur.length > 0 ? sep : 0;
    if (cur.length > 0 && lx + gap + w > avail) {
      lines.push(cur);
      cur = [];
      lx = w;
    } else lx += gap + w;
    cur.push(s);
  }
  if (cur.length > 0) lines.push(cur);
  return lines;
}

/** The name and its scorer lines, as one block centred in the row (blockH, luau:4776). */
export const blockHeight = (lines: number) => NAME_H + (lines > 0 ? SCORER_GAP + SCORER_LINE * lines : 0);

/** A side's row: room for the crest, the block and the score, plus 12 px above and below. */
export const rowHeight = (lines: number, scheduled: boolean) => Math.max(38, blockHeight(lines), scheduled ? 0 : 74) + 24;

/** The number pops 16 % and settles over 0.7 s (GLIDE) when its side scores (luau:4810). */
export const HERO_BUMP = { amp: 0.16, dur: 0.7 } as const;
