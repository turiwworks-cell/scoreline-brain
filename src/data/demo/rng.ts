// Seeded randomness for the demo: the Lua's Park-Miller generator (`rng`, `luau:1120–1128`).
//
// The Lua seeds one stream for the evening (`rng(20260921)`, `luau:8471`) and one per match,
// per player and per match history from fixed numbers (`id * 7919`, `id * 977`, …). Here every
// one of those fixed numbers is shifted by the demo's seed, so a different seed changes every
// stream, and the Lua's own seed leaves them exactly as the Lua had them.

export type Rand = () => number;

/** The Lua demo's seed (`luau:8471`). The default: the demo plays as the Lua's did. */
export const LUA_SEED = 20260921;

const M = 2147483647;

const mod = (x: number, m: number) => ((x % m) + m) % m;

/** In [0, 1). Same numbers as the Lua's `rng(seed)` for the same seed. */
export function rng(seed: number): Rand {
  let s = mod(Math.floor(seed) * 16807 + 12345, M - 1) + 1;
  for (let i = 0; i < 4; i++) s = (s * 48271) % M;
  return () => {
    s = (s * 48271) % M;
    return (s - 1) / (M - 1);
  };
}

/** The seed for one of the Lua's fixed streams (`base`) under the demo seed `seed`. */
export function streamSeed(seed: number, base: number): number {
  const shift = mod(Math.floor(seed) - LUA_SEED, M - 1);
  return shift === 0 ? base : mod(base + ((shift * 48271) % (M - 1)), M - 1);
}
