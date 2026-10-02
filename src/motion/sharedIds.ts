/*
 * Shared-element names. Each shared element is one visual (a crest, a score, a player's photo)
 * shown at two ends: on the card or face that opens a screen, and on that screen.
 *
 *   match:<id>:home | away | score    the card in the list  ↔  the match hero
 *   player:<team>:<n>:photo           a face (line-up, list, follow card)  ↔  the player bust
 *
 * A flight moves every element of a group (`match:<id>`, `player:<team>:<n>`) from one end to
 * the other.
 */

export type SharedEnd = 'card' | 'hero' | 'face' | 'bust';
export type MatchPart = 'home' | 'away' | 'score';

export const sharedMatchGroup = (id: number) => `match:${id}`;
export const sharedMatch = (id: number, part: MatchPart) => `${sharedMatchGroup(id)}:${part}`;

export const sharedPlayerGroup = (team: string, n: number) => `player:${team}:${n}`;
export const sharedPlayer = (team: string, n: number) => `${sharedPlayerGroup(team, n)}:photo`;
