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
    let out: unknown[] | undefined = prev.length === next.length ? undefined : [];
    for (let i = 0; i < next.length; i++) {
      const s = share(prev[i], next[i]);
      if (!out && !Object.is(s, prev[i])) out = prev.slice(0, i);
      if (out) out.push(s);
    }
    return (out ?? prev) as T;
  }
  if (isPlain(prev) && isPlain(next)) {
    const pk = Object.keys(prev);
    const nk = Object.keys(next);
    let out: Record<string, unknown> | undefined = pk.length === nk.length ? undefined : {};
    for (const k of nk) {
      const s = share(prev[k], next[k]);
      if (!out && (!Object.hasOwn(prev, k) || !Object.is(s, prev[k]))) out = { ...prev };
      if (out) out[k] = s;
    }
    // Equal key counts can still hide a removed key and a newly added one.
    if (out && pk.length === nk.length) for (const k of pk) if (!Object.hasOwn(next, k)) delete out[k];
    return (out ?? prev) as T;
  }
  return next;
}

/** Equality for JSON-like wire data, without building a second tree on an unchanged poll. */
export function equalWire(prev: unknown, next: unknown): boolean {
  if (Object.is(prev, next)) return true;
  if (Array.isArray(prev) && Array.isArray(next)) {
    return prev.length === next.length && prev.every((v, i) => equalWire(v, next[i]));
  }
  if (!isPlain(prev) || !isPlain(next)) return false;
  const keys = Object.keys(next);
  return Object.keys(prev).length === keys.length && keys.every((k) => Object.hasOwn(prev, k) && equalWire(prev[k], next[k]));
}
