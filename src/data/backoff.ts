// Reconnect delays: exponential, capped, with jitter so a server restart doesn't bring every
// client back in the same instant.

export interface BackoffOptions {
  /** First retry's ceiling, ms. */
  readonly baseMs: number;
  /** Largest ceiling, ms. */
  readonly maxMs: number;
}

export const DEFAULT_BACKOFF: BackoffOptions = { baseMs: 1000, maxMs: 30_000 };

/**
 * The delay before retry number `attempt` (0 for the first). "Equal jitter": half the ceiling is
 * fixed, half is random, so retries never bunch at 0 ms yet still spread out.
 * `random` returns a number in [0, 1).
 */
export function backoffDelay(attempt: number, random: () => number, { baseMs, maxMs }: BackoffOptions = DEFAULT_BACKOFF): number {
  const ceiling = Math.min(maxMs, baseMs * 2 ** Math.min(attempt, 30));
  return Math.round(ceiling / 2 + random() * (ceiling / 2));
}
