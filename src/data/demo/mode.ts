// Whether the URL asks for the demo: `?demo` plays it in real time, `?demo=fast` at 10×.
// `&seed=<n>` picks another evening; without it the demo plays the Lua's. Kept apart from the
// source so the app can read the URL without loading the demo.

/** `?demo=fast`: match time runs 10× real time. */
export const FAST_SPEED = 10;

export interface DemoMode {
  readonly speed: number;
  readonly seed?: number;
}

/** The demo the query string asks for, or null for none. */
export function demoMode(search: string): DemoMode | null {
  const q = new URLSearchParams(search);
  const demo = q.get('demo');
  if (demo === null || demo === '0' || demo === 'false' || demo === 'off') return null;
  const seed = Number(q.get('seed') ?? '');
  const hasSeed = q.get('seed') !== null && q.get('seed') !== '' && Number.isFinite(seed);
  return { speed: demo === 'fast' ? FAST_SPEED : 1, ...(hasSeed ? { seed: Math.floor(seed) } : {}) };
}
