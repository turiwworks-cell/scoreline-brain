// Text the app shows for matches and events: minutes, scores and plain event lines.
// Ported from the Lua (`luau:2431`, `luau:2466–2478`, `luau:7685–7701`); outputs match it exactly.

import { playerKey } from './apply';
import { liveMinute } from './clock';
import type { DomainState, Match, MatchEvent, StoredKind } from './types';

/** `"2–1"`, with an en dash (`scoreStr`, `luau:2431`). */
export function scoreStr(home: number, away: number): string {
  return `${home}–${away}`;
}

/** `58` → `"58'"`, `93` → `"90+3'"`. Only the second half's added time is split out (`luau:2467`). */
export function minText(min: number): string {
  if (min > 90) return `90+${min - 90}'`;
  return `${min}'`;
}

/** The running minute when live, `"FT"` when finished, else the kick-off time (`luau:2471`). */
export function minLabel(match: Pick<Match, 'status' | 'clock' | 'kickoff'>, now: number): string {
  if (match.status === 'live') return minText(liveMinute(match, now).minute);
  if (match.status === 'finished') return 'FT';
  return match.kickoff;
}

/** A player's shirt name, or `"#7"` when the squad doesn't have them (`nameOf`, `luau:2314`). */
export function nameOf(state: Pick<DomainState, 'players'>, team: string, n: number): string {
  return state.players[playerKey(team, n)]?.short ?? `#${n}`;
}

// Lines for events that arrive without commentary: nothing invented (`luau:7685`).
const SAY: Partial<Record<StoredKind, string>> = {
  shot: '{P} forces a save.',
  miss: '{P} shoots wide.',
  blocked: "{P}'s shot is blocked.",
  bigChance: 'Big chance for {P}.',
  corner: 'Corner to {T}.',
  foul: 'Free kick to {T}.',
  offside: '{P} is caught offside.',
  yellow: '{P} is booked.',
  red: '{P} is sent off.',
  sub: '{P} comes on for {Q}.',
};

/** Replaces every `{X}` with `value`, taking `value` literally (no `$&` patterns). */
const fill = (s: string, token: string, value: string) => s.split(token).join(value);

/**
 * The plain line for an event that came without `text` (`plainLine`, `luau:7691`).
 *
 * Names resolve the way the Lua's `eventOf` / `mkEvent` do: `name` wins; with no `name` and no
 * `player`, the player is the team's name; otherwise the squad's shirt name or `#n`. The other
 * player belongs to the same team for a goal (assist) or a sub (player off), to the opponent
 * otherwise, and `otherName` wins over it.
 */
export function plainLine(state: Pick<DomainState, 'teams' | 'players'>, match: Pick<Match, 'home' | 'away'>, ev: MatchEvent): string {
  const teamId = ev.side === 'home' ? match.home : match.away;
  const otherId = ev.side === 'home' ? match.away : match.home;
  const team = state.teams[teamId]?.name ?? teamId;
  const pn = ev.player ?? 0;
  const on = ev.other ?? 0;
  const p = ev.name !== undefined ? ev.name : pn === 0 ? team : nameOf(state, teamId, pn);
  const own = ev.kind === 'goal' || ev.kind === 'sub';
  const o = ev.otherName !== undefined ? ev.otherName : on > 0 ? nameOf(state, own ? teamId : otherId, on) : '';
  if (ev.kind === 'goal') {
    if (o !== '') return `${p} scores for ${team}, set up by ${o}.`;
    return `${p} scores for ${team}.`;
  }
  let s = SAY[ev.kind] ?? '';
  s = fill(s, '{P}', p);
  s = fill(s, '{Q}', o);
  s = fill(s, '{T}', team);
  return s;
}
