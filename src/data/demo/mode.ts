// Which source the URL asks for. `?demo` plays the demo in real time, `?demo=fast` at 10×;
// `&seed=<n>` picks another evening, without it the demo plays the Lua's. A URL that names no
// source plays the demo too: the site opens on the matchday, never on an empty list. `?api` is the
// HTTP source (ApiSource, against the mock: scripts/mock-api.mjs); `?demo=off` is the page with no
// source at all. Kept apart from the sources so the app can read the URL without loading them.

/** `?demo=fast`: match time runs 10× real time. */
export const FAST_SPEED = 10;

export interface DemoMode {
  readonly speed: number;
  readonly seed?: number;
}

/** The demo the query string asks for, or null for none (`?api`, or `?demo=off`). */
export function demoMode(search: string): DemoMode | null {
  const q = new URLSearchParams(search);
  const demo = q.get('demo');
  if (demo === null ? q.has('api') : demo === '0' || demo === 'false' || demo === 'off') return null;
  const seed = Number(q.get('seed') ?? '');
  const hasSeed = q.get('seed') !== null && q.get('seed') !== '' && Number.isFinite(seed);
  return { speed: demo === 'fast' ? FAST_SPEED : 1, ...(hasSeed ? { seed: Math.floor(seed) } : {}) };
}

/** Where the API is, when the query string asks for it (`?api`): the build's VITE_API_BASE, else `/api`. */
export function apiMode(search: string): string | null {
  if (!new URLSearchParams(search).has('api')) return null;
  const base: string = import.meta.env.VITE_API_BASE ?? `${import.meta.env.BASE_URL}api`;
  return base.replace(/\/$/, '');
}

/** Whether any data is on its way: a source is named, or the demo plays by default. */
export const sourceExpected = (search: string) => demoMode(search) !== null || apiMode(search) !== null;
