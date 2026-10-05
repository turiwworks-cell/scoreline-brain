import { useSyncExternalStore } from 'react';

/*
 * Layout is a function of route and width (ARCHITECTURE §6):
 *   < 768 px      phone: one column, the list at the base, match and player push on top
 *   768–1199 px   two panes: list · match; the player opens as a sheet over the match pane
 *   ≥ 1200 px     three panes: list · match · insights (today's desktop)
 * Shell.module.css uses the same breakpoints.
 */

export type LayoutMode = 'phone' | 'two' | 'three';

export const TWO_PANES = 768;
export const THREE_PANES = 1200;

export function layoutFor(width: number): LayoutMode {
  return width >= THREE_PANES ? 'three' : width >= TWO_PANES ? 'two' : 'phone';
}

let queries: [MediaQueryList, MediaQueryList] | null | undefined;
const media = () => {
  if (queries === undefined) {
    queries = typeof matchMedia === 'function' ? [matchMedia(`(min-width: ${TWO_PANES}px)`), matchMedia(`(min-width: ${THREE_PANES}px)`)] : null;
  }
  return queries;
};

function subscribe(onChange: () => void) {
  const qs = media();
  qs?.forEach((q) => q.addEventListener('change', onChange));
  return () => qs?.forEach((q) => q.removeEventListener('change', onChange));
}

function snapshot(): LayoutMode {
  const qs = media();
  if (!qs) return 'phone';
  return qs[1].matches ? 'three' : qs[0].matches ? 'two' : 'phone';
}

export function useLayoutMode(): LayoutMode {
  return useSyncExternalStore(subscribe, snapshot, () => 'phone');
}
