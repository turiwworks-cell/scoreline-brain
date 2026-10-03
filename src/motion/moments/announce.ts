// What a moment says to a screen reader (the aria-live region), and the summary after the tab was
// hidden. Plain sentences built from the store's names; nothing is invented.

import { minText, nameOf, scoreStr, type DomainState, type Moment } from '../../domain';

export type Names = Pick<DomainState, 'teams' | 'players' | 'matches'>;

const teamName = (s: Names, id: string) => s.teams[id]?.name ?? id.toUpperCase();

function scoreLine(s: Names, m: Moment): string {
  const match = s.matches[m.matchId];
  if (!match) return '';
  const [h, a] = m.event?.score ?? m.score;
  return `${teamName(s, match.home)} ${scoreStr(h, a)} ${teamName(s, match.away)}`;
}

function who(s: Names, m: Moment): string | undefined {
  const match = s.matches[m.matchId];
  const ev = m.event;
  if (!match || !ev) return undefined;
  if (ev.name) return ev.name;
  if (ev.player === undefined) return undefined;
  return nameOf(s, ev.side === 'home' ? match.home : match.away, ev.player);
}

/** One moment as a sentence, or '' when its match is unknown. */
export function momentText(s: Names, m: Moment): string {
  const match = s.matches[m.matchId];
  if (!match) return '';
  const score = scoreLine(s, m);
  const team = m.side ? teamName(s, m.side === 'home' ? match.home : match.away) : '';
  const p = who(s, m);
  switch (m.kind) {
    case 'goal':
      return `Goal for ${team}${p ? `, ${p}` : ''}, ${minText(m.minute)}. ${score}.`;
    case 'goalCancelled':
      return `Goal for ${team} disallowed. ${score}.`;
    case 'red':
      return `Red card${p ? ` for ${p}` : ''}, ${team}, ${minText(m.minute)}.`;
    case 'kickoff':
      return `Kick-off: ${teamName(s, match.home)} against ${teamName(s, match.away)}.`;
    case 'fulltime':
      return `Full time: ${score}.`;
  }
}

/** Several moments as one announcement. */
export function batchText(s: Names, moments: readonly Moment[]): string {
  return moments
    .map((m) => momentText(s, m))
    .filter(Boolean)
    .join(' ');
}

export interface Summary {
  readonly goals: number;
  readonly reds: number;
  readonly cancelled: number;
  /** each match touched, oldest first, with the score of its latest moment */
  readonly matches: readonly { readonly matchId: number; readonly score: readonly [number, number] }[];
}

/** Counts a run of moments and the matches they touched (for a summary toast or announcement). */
export function summarize(moments: readonly Moment[]): Summary {
  let goals = 0;
  let reds = 0;
  let cancelled = 0;
  const scores = new Map<number, readonly [number, number]>();
  for (const m of moments) {
    if (m.kind === 'goal') goals += 1;
    else if (m.kind === 'red') reds += 1;
    else if (m.kind === 'goalCancelled') cancelled += 1;
    scores.delete(m.matchId);
    scores.set(m.matchId, m.score);
  }
  return { goals, reds, cancelled, matches: [...scores].map(([matchId, score]) => ({ matchId, score })) };
}

const count = (n: number, one: string, many: string) => (n === 0 ? '' : `${n} ${n === 1 ? one : many}`);

/** "While you were away: 3 goals and 1 red card. Argentina 2–1 France. …" */
export function summaryText(s: Names, moments: readonly Moment[], lead = 'While you were away'): string {
  const sum = summarize(moments);
  const parts = [count(sum.goals, 'goal', 'goals'), count(sum.reds, 'red card', 'red cards'), count(sum.cancelled, 'goal disallowed', 'goals disallowed')].filter(Boolean);
  if (parts.length === 0) return '';
  const what = parts.length > 1 ? `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}` : parts[0];
  const lines = sum.matches
    .map(({ matchId, score }) => {
      const match = s.matches[matchId];
      return match ? `${teamName(s, match.home)} ${scoreStr(score[0], score[1])} ${teamName(s, match.away)}.` : '';
    })
    .filter(Boolean);
  return [`${lead}: ${what}.`, ...lines].join(' ');
}
