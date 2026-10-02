/*
 * What opened each screen, per history entry: navigation actions record the pressed element under
 * the location they leave; going back to that location returns focus there, and the shared
 * element flies back into it. If the element itself is gone (re-rendered), its `data-focus-key`
 * finds the new one.
 */

interface Trigger {
  readonly el: Element;
  readonly focusKey: string | null;
}

const MAX = 60;
const byLocation = new Map<string, Trigger>();
let pending: Element | null = null;

/** Records `el` as what was pressed to leave `locationKey`. */
export function rememberTrigger(locationKey: string, el: Element | null): void {
  pending = el;
  if (!el) return;
  byLocation.delete(locationKey);
  byLocation.set(locationKey, { el, focusKey: el.closest('[data-focus-key]')?.getAttribute('data-focus-key') ?? null });
  while (byLocation.size > MAX) byLocation.delete(byLocation.keys().next().value as string);
}

/** The element that was pressed to leave `locationKey`, if it (or its replacement) is in the page. */
export function triggerFor(locationKey: string): HTMLElement | null {
  const t = byLocation.get(locationKey);
  if (!t) return null;
  if (t.el.isConnected) return t.el as HTMLElement;
  if (!t.focusKey) return null;
  return document.querySelector<HTMLElement>(`[data-focus-key="${CSS.escape(t.focusKey)}"]`);
}

/** The element pressed for the navigation now being shown, once. */
export function takePendingTrigger(): Element | null {
  const el = pending;
  pending = null;
  return el;
}

/** Whether focus can go to `el` and the user can see it. */
export function canFocus(el: Element | null | undefined): el is HTMLElement {
  if (!el || !el.isConnected || !(el instanceof HTMLElement)) return false;
  if (el.closest('[inert], [data-present="false"]')) return false;
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0;
}
