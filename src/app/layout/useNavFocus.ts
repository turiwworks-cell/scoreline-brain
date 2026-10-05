import { useEffect, useLayoutEffect, useRef, type RefObject } from 'react';
import type { NavigationType } from 'react-router';
import { canFocus, triggerFor } from '../nav/focusMemory';
import { stackDepth, type Resolved } from './resolve';

/**
 * Focus on navigation:
 * 1. A screen stacks on top (phone layer, tablet sheet): focus goes to its heading, the screens
 *    under it are inert.
 * 2. Back or forward to an entry: focus returns to what was pressed to leave it, when it can.
 * 3. Focus was inside a screen that just went away: it goes to the heading of the screen that
 *    took its place (else the top one).
 * 4. Otherwise it stays where it is: picking a match in the list on tablet or desktop keeps you in
 *    the list, and the change is announced instead.
 * Returns nothing; calls `announce` when focus didn't move to a heading.
 */
export function useNavFocus(r: Resolved, locationKey: string, navType: NavigationType, root: RefObject<HTMLElement | null>, announce: () => void) {
  const prev = useRef<{ r: Resolved; key: string } | null>(null);
  const last = useRef<{ el: Element; screen: string | null } | null>(null);

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const onFocus = (e: FocusEvent) => {
      const t = e.target as Element;
      last.current = { el: t, screen: t.closest('[data-screen]')?.getAttribute('data-screen') ?? null };
    };
    el.addEventListener('focusin', onFocus);
    return () => el.removeEventListener('focusin', onFocus);
  }, [root]);

  useLayoutEffect(() => {
    const p = prev.current;
    prev.current = { r, key: locationKey };
    const el = root.current;
    if (!p || p.key === locationKey || p.r.layout !== r.layout || !el) return;

    const screens = Array.from(el.querySelectorAll<HTMLElement>('[data-screen][data-present="true"]:not([inert])'));
    const heading = (s: Element | undefined) => s?.querySelector<HTMLElement>('[data-screen-heading]') ?? null;
    let target: HTMLElement | null = null;
    if (stackDepth(r) > stackDepth(p.r)) {
      target = heading(screens.at(-1));
    } else {
      const opener = navType === 'POP' ? triggerFor(locationKey) : null;
      const active = document.activeElement;
      const lost = last.current && (!active || active === document.body || !canFocus(active)) && !canFocus(last.current.el);
      if (canFocus(opener)) target = opener;
      else if (lost) target = heading(screens.findLast((s) => s.dataset.screen === last.current?.screen) ?? screens.at(-1));
    }
    if (target) target.focus({ preventScroll: true });
    if (!target || !target.hasAttribute('data-screen-heading')) announce();
  }, [r, locationKey, navType, root, announce]);
}
