// Which round tags a player gets, and where they sit (eventTags, luau:3570-3632).

import type { TagKind } from './icons';

export type TagCounts = {
  goals?: number;
  assists?: number;
  /** a yellow card (any count > 0 shows one) */
  yellow?: number | boolean;
  /** a red card */
  red?: number | boolean;
};

/** The order and repeats eventTags draws: up to 3 balls, up to 3 boots, a yellow, a red (luau:3577). */
export function tagList({ goals = 0, assists = 0, yellow, red }: TagCounts): TagKind[] {
  const out: TagKind[] = [];
  for (let i = 0; i < Math.min(goals, 3); i++) out.push('goal');
  for (let i = 0; i < Math.min(assists, 3); i++) out.push('assist');
  if (yellow) out.push('yellow');
  if (red) out.push('red');
  return out;
}

/** Where each tag's centre sits: repeats stack like coins (R × 1.15 apart), kinds sit 3 px apart. */
export function tagLayout(list: readonly TagKind[], r: number): { xs: number[]; width: number } {
  const xs: number[] = [];
  let at = 0;
  list.forEach((k, i) => {
    if (i > 0) at += list[i - 1] === k ? r * 1.15 : r * 2 + 3;
    xs.push(at + r);
  });
  return { xs, width: list.length ? at + r * 2 : 0 };
}
