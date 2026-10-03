/** Only the DOM handoff waits for phase=1. Director exits, first-tap jumps and fallbacks remain authoritative. */
export function createWordClock(up: number, full: number) {
  let waiting = false;
  let landedAt: number | undefined;
  return {
    waiting() { if (landedAt === undefined) waiting = true; },
    phase(phase: number, elapsed: number) {
      if ((phase === 1 || phase === 2) && landedAt === undefined) landedAt = elapsed;
    },
    fallback() { waiting = false; },
    time(elapsed: number, skipped: boolean) {
      if (skipped || elapsed >= full && landedAt === undefined) return elapsed;
      if (landedAt !== undefined) return elapsed < landedAt ? elapsed : elapsed - landedAt + up;
      return waiting ? Math.min(elapsed, up) : elapsed;
    },
  };
}
