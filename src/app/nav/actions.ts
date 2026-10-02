import type { DataRouter } from 'react-router';
import { rememberTrigger } from './focusMemory';
import { DEFAULT_TAB, hrefOf, matchPath, parseNav, type MatchRef, type MatchTab, type NavHistoryState, type PlayerRef } from './url';

/*
 * Every navigation in the app goes through these. Screens push (a new history entry: back
 * returns), view state replaces (day, Live, tab: back doesn't step through them).
 * A navigation to where you already are does nothing, so a double tap can't stack entries.
 */
export interface NavActions {
  /** Opens a match (push). `from`: the pressed element, for focus return and the shared element. */
  openMatch(id: number, opts?: { tab?: MatchTab; from?: Element | null }): void;
  /** Switches the tab of the match on screen (replace). */
  setTab(id: number, tab: MatchTab): void;
  /** Opens a player (push). `under`: the match it was opened from. */
  openPlayer(player: PlayerRef, opts?: { under?: MatchRef; from?: Element | null }): void;
  /** The list's day tab, as an offset from today (replace). */
  setDay(day: number): void;
  /** The Live filter (replace). */
  setLive(on: boolean): void;
  /** Back one screen: browser back when the app has history, else up to the parent screen. */
  back(): void;
}

export function createNavActions(router: DataRouter): NavActions {
  const here = () => {
    const loc = router.state.location;
    return { loc, href: loc.pathname + loc.search, nav: parseNav(loc.pathname, loc.search, loc.state) };
  };
  const pressed = (from: Element | null | undefined) => {
    if (from !== undefined) return from;
    const a = typeof document === 'undefined' ? null : document.activeElement;
    return a && a !== document.body ? a : null;
  };

  return {
    openMatch(id, opts = {}) {
      const { loc, href, nav } = here();
      const to = hrefOf({ list: nav.list, match: { id, tab: opts.tab ?? DEFAULT_TAB } }, loc.search);
      if (to === href) return;
      rememberTrigger(loc.key, pressed(opts.from));
      void router.navigate(to);
    },
    setTab(id, tab) {
      const { loc, href, nav } = here();
      if (nav.player) {
        // the match pane beside a player: its tab is part of the player's history state
        if (nav.under?.id === id && nav.under.tab === tab) return;
        const state: NavHistoryState = { under: { id, tab } };
        void router.navigate(href, { replace: true, state });
        return;
      }
      const to = matchPath({ id, tab }) + href.slice(loc.pathname.length);
      if (to !== href) void router.navigate(to, { replace: true });
    },
    openPlayer(player, opts = {}) {
      const { loc, href, nav } = here();
      const to = hrefOf({ list: nav.list, player }, loc.search);
      if (to === href) return;
      rememberTrigger(loc.key, pressed(opts.from));
      const state: NavHistoryState = opts.under ? { under: opts.under } : {};
      void router.navigate(to, { state });
    },
    setDay(day) {
      const { loc, href, nav } = here();
      const to = hrefOf({ ...nav, list: { day, live: false } }, loc.search);
      if (to !== href) void router.navigate(to, { replace: true, state: loc.state });
    },
    setLive(on) {
      const { loc, href, nav } = here();
      const to = hrefOf({ ...nav, list: { day: 0, live: on } }, loc.search);
      if (to !== href) void router.navigate(to, { replace: true, state: loc.state });
    },
    back() {
      const { loc, nav } = here();
      const idx = typeof window === 'undefined' ? null : (window.history.state as { idx?: unknown } | null)?.idx;
      if (typeof idx === 'number' && idx > 0) {
        void router.navigate(-1);
        return;
      }
      // opened cold: go up instead (player → the match it came from, or the list; match → list)
      const up = nav.player && nav.under ? { list: nav.list, match: nav.under } : { list: nav.list };
      void router.navigate(hrefOf(up, loc.search), { replace: true });
    },
  };
}
