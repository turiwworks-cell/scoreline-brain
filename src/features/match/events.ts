// The Facts tab's commentary (eventsFeed, luau:5052): what each row says, and which rows show.
// Pure: no React, no DOM.

import { nameOf, plainLine, scoreStr, type DomainState, type Match, type MatchEvent, type Side, type StoredKind } from '../../domain';

/** Rows shown before "Show all" (LIMIT, luau:5066). */
export const LIMIT = 10;

// KIND_LABEL (luau:4991), in the contract's kinds. A VAR call is new in v2 and has no Lua label.
export const KIND_LABEL: Readonly<Record<StoredKind, string>> = {
  corner: 'Corner',
  shot: 'Shot on target',
  miss: 'Shot off target',
  blocked: 'Blocked shot',
  bigChance: 'Big chance',
  foul: 'Free kick',
  offside: 'Offside',
  yellow: 'Yellow card',
  red: 'Red card',
  sub: 'Substitution',
  goal: 'Goal',
  goalCancelled: 'Goal cancelled',
};

/** One commentary row as the screen draws it (the Lua's Event: p, o, s, txt). */
export interface FeedItem {
  readonly id: string;
  readonly kind: StoredKind;
  readonly side: Side;
  readonly minute: number;
  /** the side's team id */
  readonly team: string;
  /** shirt number, 0 when the event names no player */
  readonly player: number;
  /** the player (scorer, booked, the one coming on): `p` */
  readonly name: string;
  /** the assist, or the player going off: `o` */
  readonly other: string;
  readonly text: string;
  /** a goal: the score after it, "2–1" (`s`) */
  readonly score: string;
  /** a goal VAR took back */
  readonly cancelled: boolean;
}

type Names = Pick<DomainState, 'teams' | 'players'>;

/**
 * Every event of the match, newest first: by minute, and within a minute the one that came later
 * first (luau:5057). Names resolve as the Lua's mkEvent does, with `name` / `otherName` winning.
 */
export function feedItems(state: Names, match: Pick<Match, 'home' | 'away' | 'events'>): FeedItem[] {
  let home = 0;
  let away = 0;
  const items = match.events.map((ev, idx) => {
    if (ev.kind === 'goal' && !ev.cancelled) {
      if (ev.side === 'home') home += 1;
      else away += 1;
    }
    return { idx, item: itemOf(state, match, ev, ev.score ? scoreStr(ev.score[0], ev.score[1]) : scoreStr(home, away)) };
  });
  items.sort((a, b) => (a.item.minute !== b.item.minute ? b.item.minute - a.item.minute : b.idx - a.idx));
  return items.map((x) => x.item);
}

function itemOf(state: Names, match: Pick<Match, 'home' | 'away'>, ev: MatchEvent, score: string): FeedItem {
  const team = ev.side === 'home' ? match.home : match.away;
  const opp = ev.side === 'home' ? match.away : match.home;
  const pn = ev.player ?? 0;
  const on = ev.other ?? 0;
  const own = ev.kind === 'goal' || ev.kind === 'sub';
  const name = ev.name ?? (pn === 0 ? (state.teams[team]?.name ?? team) : nameOf(state, team, pn));
  const other = ev.otherName ?? (on > 0 ? nameOf(state, own ? team : opp, on) : '');
  return {
    id: ev.id,
    kind: ev.kind,
    side: ev.side,
    minute: ev.minute,
    team,
    player: pn,
    name,
    other,
    text: ev.text ?? plainLine(state, match, ev),
    score: ev.kind === 'goal' ? score : '',
    cancelled: ev.cancelled === true,
  };
}

/** The score at a minute, from the goals that stand (scoreAt, luau:5013). */
export function scoreAt(items: readonly FeedItem[], minute: number): string {
  let a = 0;
  let b = 0;
  for (const e of items) {
    if (e.kind !== 'goal' || e.cancelled || e.minute > minute) continue;
    if (e.side === 'home') a += 1;
    else b += 1;
  }
  return scoreStr(a, b);
}

export type FeedRow =
  | { readonly kind: 'ht' | 'ko'; readonly key: string }
  /** `index`: 1-based place in the feed, which decides what folds away past LIMIT */
  | { readonly kind: 'e'; readonly key: string; readonly item: FeedItem; readonly index: number };

/**
 * The rows for the first `shown` items: a half-time marker before the first first-half event once
 * the match is past 45 minutes, and kick-off at the very end when everything shows (luau:5089).
 */
export function feedRows(items: readonly FeedItem[], shown: number, matchMinute: number): FeedRow[] {
  const rows: FeedRow[] = [];
  let ht = false;
  for (let i = 0; i < shown && i < items.length; i++) {
    const e = items[i]!;
    if (!ht && e.minute <= 45 && matchMinute > 45) {
      rows.push({ kind: 'ht', key: 'ht' });
      ht = true;
    }
    rows.push({ kind: 'e', key: e.id, item: e, index: i + 1 });
  }
  if (shown >= items.length) {
    if (!ht && matchMinute > 45) rows.push({ kind: 'ht', key: 'ht' });
    rows.push({ kind: 'ko', key: 'ko' });
  }
  return rows;
}

/** The marker's words: "Half-time · 1–0" or "Kick-off" (luau:5160). */
export const markerLabel = (kind: 'ht' | 'ko', items: readonly FeedItem[]) => (kind === 'ht' ? `Half-time · ${scoreAt(items, 45)}` : 'Kick-off');
