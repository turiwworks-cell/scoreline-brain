/*
 * Navigation state lives in the URL (ARCHITECTURE §4.5):
 *
 *   /?day=<n> | ?live=0  the list: the day tab as an offset from today (-2 … 2), or today. With
 *                        neither it is the Live filter, which the app opens on (luau setupIcon);
 *                        live=1 still reads as Live
 *   /match/:id/:tab      a match; tab is facts | stats | lineup | table (TABS, luau:1814)
 *   /player/:team/:n     a player
 *
 * The list is always mounted and, on tablet and desktop, always on screen, so `day` and `live`
 * ride along on every path: they are the list's state wherever you are. Query params this file
 * doesn't own (`demo`, `seed`) ride along untouched.
 *
 * Which match a player was opened from is history state (`under`), not URL: on the phone, back
 * from the player lands on that match; on tablet and desktop it stays in the match pane. A player
 * URL opened cold shows the player over the list (phone) or beside the team's match (panes).
 *
 * Pure functions, no React.
 */

export const MATCH_TABS = ['facts', 'stats', 'lineup', 'table'] as const;
export type MatchTab = (typeof MATCH_TABS)[number];
export const DEFAULT_TAB: MatchTab = 'facts';

/** Day tabs run from two days back to two days ahead (DAYS, luau:1812). */
export const DAY_RANGE = 2;

export interface ListState {
  readonly day: number;
  readonly live: boolean;
}

export interface MatchRef {
  readonly id: number;
  readonly tab: MatchTab;
}

export interface PlayerRef {
  readonly team: string;
  readonly n: number;
}

export interface Nav {
  readonly list: ListState;
  readonly match?: MatchRef;
  readonly player?: PlayerRef;
  /** the match the player was opened from (history state) */
  readonly under?: MatchRef;
  /** the player was reached by an arrow, the way he slid in: 1 next, -1 previous (history state) */
  readonly step?: PlayerStep;
}

export type PlayerStep = 1 | -1;

/** What the app keeps in history state next to a URL. */
export interface NavHistoryState {
  readonly under?: MatchRef;
  readonly step?: PlayerStep;
}

export const isMatchTab = (v: unknown): v is MatchTab => typeof v === 'string' && (MATCH_TABS as readonly string[]).includes(v);

const parseId = (s: string | undefined) => (s && /^[1-9]\d{0,8}$/.test(s) ? Number(s) : undefined);
const parseShirt = (s: string | undefined) => (s && /^[1-9]\d?$/.test(s) ? Number(s) : undefined);
const parseTeam = (s: string | undefined) => (s && /^[a-z0-9][a-z0-9_-]{0,31}$/i.test(s) ? s : undefined);

/** The app opens on Live, as the Lua does (setupIcon: "the app opens in Live mode"); `live=0` or a day opens that day. */
export function parseList(search: string): ListState {
  const q = new URLSearchParams(search);
  const live = q.get('live');
  const raw = q.get('day');
  if (live === '1' || (live === null && raw === null)) return { day: 0, live: true };
  const d = raw === null || raw === '' ? 0 : Number(raw);
  return { day: Number.isInteger(d) && Math.abs(d) <= DAY_RANGE ? d : 0, live: false };
}

function underOf(state: unknown): MatchRef | undefined {
  const u = (state as NavHistoryState | null | undefined)?.under;
  if (!u || typeof u !== 'object') return undefined;
  const id = typeof u.id === 'number' && Number.isInteger(u.id) && u.id > 0 ? u.id : undefined;
  return id !== undefined ? { id, tab: isMatchTab(u.tab) ? u.tab : DEFAULT_TAB } : undefined;
}

function stepOf(state: unknown): PlayerStep | undefined {
  const s = (state as NavHistoryState | null | undefined)?.step;
  return s === 1 || s === -1 ? s : undefined;
}

/** Reads a location. Tolerant: anything it doesn't understand reads as the list. */
export function parseNav(pathname: string, search: string, state?: unknown): Nav {
  const list = parseList(search);
  const [head, a, b] = pathname.split('/').filter(Boolean);
  if (head === 'match') {
    const id = parseId(a);
    if (id !== undefined) return { list, match: { id, tab: isMatchTab(b) ? b : DEFAULT_TAB } };
  } else if (head === 'player') {
    const team = parseTeam(a);
    const n = parseShirt(b);
    if (team !== undefined && n !== undefined) {
      const under = underOf(state);
      const step = stepOf(state);
      return { list, player: { team, n }, ...(under ? { under } : {}), ...(step ? { step } : {}) };
    }
  }
  return { list };
}

export const matchPath = (ref: MatchRef) => `/match/${ref.id}/${ref.tab}`;
export const playerPath = (p: PlayerRef) => `/player/${encodeURIComponent(p.team)}/${p.n}`;

/** The canonical path for `pathname`, or null when it already is one. */
export function canonicalPath(pathname: string): string | null {
  const nav = parseNav(pathname, '');
  const want = nav.match ? matchPath(nav.match) : nav.player ? playerPath(nav.player) : '/';
  return want === pathname ? null : want;
}

/** `current` with the list's params set to `list`; everything else in it kept, in order. */
export function listSearch(list: ListState, current: string): string {
  const q = new URLSearchParams(current);
  q.delete('day');
  q.delete('live');
  // Live is the default (parseList); today is `live=0`
  if (!list.live) {
    if (list.day !== 0) q.set('day', String(list.day));
    else q.set('live', '0');
  }
  const parts: string[] = [];
  q.forEach((v, k) => parts.push(v === '' ? encodeURIComponent(k) : `${encodeURIComponent(k)}=${encodeURIComponent(v)}`));
  return parts.length ? `?${parts.join('&')}` : '';
}

/** The URL for a navigation state, carrying over the other params of `current`. */
export function hrefOf(nav: Pick<Nav, 'list' | 'match' | 'player'>, current: string): string {
  const path = nav.player ? playerPath(nav.player) : nav.match ? matchPath(nav.match) : '/';
  return path + listSearch(nav.list, current);
}

export const sameMatch = (a: MatchRef | undefined, b: MatchRef | undefined) => a?.id === b?.id;
export const samePlayer = (a: PlayerRef | undefined, b: PlayerRef | undefined) => a?.team === b?.team && a?.n === b?.n;
export const playerKeyOf = (p: PlayerRef | undefined) => (p ? `${p.team}:${p.n}` : '');
