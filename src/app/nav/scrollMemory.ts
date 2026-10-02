/*
 * Scroll restoration per pane (ARCHITECTURE §6: each pane is its own native scroll container).
 *
 * Positions are kept per history entry and pane, so back and forward return each pane to where
 * it was, a reload in the same tab too (sessionStorage). The rule when a location changes:
 *   back / forward (POP) with a saved position  → restore it
 *   the pane shows something new (another match, another day)  → top (the Lua resets its
 *     scroll on openMatch, setDay and openPlayer: luau:7135, 7184, 7262)
 *   otherwise (a tab switch, a filter elsewhere)  → leave it where it is
 */

export type ScrollPane = 'list' | 'match' | 'player' | 'insights';

export type ScrollPlan = { readonly kind: 'restore'; readonly y: number } | { readonly kind: 'top' } | { readonly kind: 'keep' };

export function scrollPlan(o: { pop: boolean; saved: number | undefined; contentChanged: boolean }): ScrollPlan {
  if (o.pop && o.saved !== undefined) return { kind: 'restore', y: o.saved };
  if (o.contentChanged) return { kind: 'top' };
  return { kind: 'keep' };
}

export interface ScrollMemory {
  get(locationKey: string, pane: ScrollPane): number | undefined;
  set(locationKey: string, pane: ScrollPane, y: number): void;
  /** Writes to storage now (also done shortly after each change). */
  flush(): void;
}

type Store = Pick<Storage, 'getItem' | 'setItem'>;

const STORAGE_KEY = 'scoreline:scroll';
/** History entries kept; the oldest go first. */
export const SCROLL_ENTRIES = 100;

export function createScrollMemory(storage: Store | null): ScrollMemory {
  // a Map keeps insertion order for every key (an object would put digit-only keys first)
  let map = new Map<string, Partial<Record<ScrollPane, number>>>();
  try {
    const raw = storage?.getItem(STORAGE_KEY);
    const entries: unknown = raw ? JSON.parse(raw) : [];
    if (Array.isArray(entries)) map = new Map(entries as [string, Partial<Record<ScrollPane, number>>][]);
  } catch {
    map = new Map();
  }
  let timer: ReturnType<typeof setTimeout> | undefined;
  const flush = () => {
    clearTimeout(timer);
    timer = undefined;
    try {
      storage?.setItem(STORAGE_KEY, JSON.stringify([...map]));
    } catch {
      // storage full or blocked: positions still work for this page's life
    }
  };
  return {
    get: (key, pane) => map.get(key)?.[pane],
    set(key, pane, y) {
      const entry = { ...map.get(key), [pane]: Math.max(0, Math.round(y)) };
      map.delete(key);
      map.set(key, entry);
      for (const old of map.keys()) {
        if (map.size <= SCROLL_ENTRIES) break;
        map.delete(old);
      }
      if (storage && timer === undefined) timer = setTimeout(flush, 250);
    },
    flush,
  };
}

function sessionStore(): Store | null {
  try {
    return typeof sessionStorage === 'undefined' ? null : sessionStorage;
  } catch {
    return null;
  }
}

/** The app's one memory. */
export const scrollMemory = createScrollMemory(sessionStore());

if (typeof window !== 'undefined') window.addEventListener('pagehide', () => scrollMemory.flush());
