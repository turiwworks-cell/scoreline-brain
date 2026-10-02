// Structural sharing: keep the previous object wherever the next one is equal to it, so an
// unchanged match (or team, or event) keeps its identity across polls and selectors don't fire.

function isPlain(v: unknown): v is Record<string, unknown> {
  if (v === null || typeof v !== 'object') return false;
  const proto = Object.getPrototypeOf(v) as unknown;
  return proto === Object.prototype || proto === null;
}

/** Returns `next`, with every subtree that deep-equals the one in `prev` replaced by `prev`'s. */
export function share<T>(prev: unknown, next: T): T {
  if (Object.is(prev, next)) return next;
  if (Array.isArray(prev) && Array.isArray(next)) {
    let same = prev.length === next.length;
    const out = next.map((v, i) => {
      const s = share(prev[i], v);
      if (!Object.is(s, prev[i])) same = false;
      return s;
    });
    return (same ? prev : out) as T;
  }
  if (isPlain(prev) && isPlain(next)) {
    const pk = Object.keys(prev);
    const nk = Object.keys(next);
    let same = pk.length === nk.length;
    const out: Record<string, unknown> = {};
    for (const k of nk) {
      const s = share(prev[k], next[k]);
      out[k] = s;
      if (!Object.hasOwn(prev, k) || !Object.is(s, prev[k])) same = false;
    }
    return (same ? prev : out) as T;
  }
  return next;
}
