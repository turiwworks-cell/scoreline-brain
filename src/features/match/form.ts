// A team's last five results for the Form block (formBlock, luau:5269). The data contract has no
// form, and neither had the Lua: it drew five letters from a random stream seeded by the team and
// the match, so they stay the same every time the match opens. This keeps that stand-in, with the
// same seed, so the demo shows what the Lua showed. Pure.

import { rng } from '../../data/demo/rng';

export type FormResult = 'W' | 'D' | 'L';

/** Five results, oldest first (as the Lua draws them left to right). */
export function formOf(team: string, matchId: number): readonly FormResult[] {
  // rng(#k * 13 + m.id + string.byte(k, 1)): the byte length and the first byte of the id
  const bytes = new TextEncoder().encode(team);
  const r = rng(bytes.length * 13 + matchId + (bytes[0] ?? 0));
  return Array.from({ length: 5 }, () => {
    const x = r();
    return x < 0.45 ? 'W' : x < 0.7 ? 'D' : 'L';
  });
}
