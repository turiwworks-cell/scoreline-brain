/**
 * How long a scene waits, at most, for its Rive word before the DOM word plays it instead.
 * Seconds of real time from the scene's first frame.
 */
export const WORD_GRACE = 0.3;

/**
 * The scene's story time. It is real time from the scene's first frame (begin: a scene that gets
 * on screen late, behind a heavy render, still starts at its beginning), with two waits taken out,
 * so nothing on the stage ever jumps:
 * - At the start, while it is not yet known which word plays (the Rive word is still binding, at
 *   most `grace`), the story stays at 0. The headline then starts with that word, and the other
 *   never takes over in mid-flight: the Rive word restarting the letters the DOM word had begun
 *   was the shake of the review of 2026-10-04.
 * - At `up`, while a Rive word has yet to land, the rise waits for it. A word that lands early does
 *   not bring the rise forward: the headline keeps its hold, as in the Lua (beats, luau:6297).
 * A first tap (`skipped`) is real time, so it shows everything at once. `full` is the deadline for
 * the landing: after it the story goes on without the word.
 */
export function createWordClock({ up, full, rive, grace = WORD_GRACE }: { up: number; full: number; rive: boolean; grace?: number }) {
  let state: 'pending' | 'rive' | 'dom' = rive ? 'pending' : 'dom';
  let landed = false;
  /** the scene's first frame, in real seconds (begin) */
  let origin: number | undefined;
  /** real seconds the story started (it stays at 0 before) */
  let startedAt = 0;
  /** real seconds the rise has waited at `up` */
  let held = 0;
  const deadline = () => (origin ?? Infinity) + grace;
  const story = (e: number) => e - startedAt - held;
  const stopWaiting = (e: number) => {
    held += Math.max(0, story(e) - up);
  };
  const clock = {
    /** The scene's first frame is on screen (its mount, before paint): the story can start. */
    begin(e: number) {
      if (origin !== undefined) return;
      origin = e;
      startedAt = e;
    },
    /** The Rive word is bound and plays the headline: the story starts now. */
    bound(e: number) {
      clock.begin(e);
      if (state !== 'pending') return;
      state = 'rive';
      startedAt = Math.max(origin!, e);
    },
    /** The Rive word reports a phase: 1 has landed, 2 is done. */
    phase(n: number, e: number) {
      if (state !== 'rive' || landed || (n !== 1 && n !== 2)) return;
      stopWaiting(e);
      landed = true;
    },
    /** The DOM word plays: from the start if no word had begun, else the rise stops waiting. */
    fallback(e: number) {
      if (state === 'pending') startedAt = origin === undefined ? e : Math.min(Math.max(origin, e), deadline());
      else if (state === 'rive' && !landed) stopWaiting(e);
      state = 'dom';
    },
    /** The headline is the DOM word's: a Rive word bound now would take over in mid-flight. */
    late(e: number): boolean {
      return state === 'dom' || (state === 'pending' && e >= deadline());
    },
    time(e: number, skipped: boolean): number {
      if (skipped) return e;
      if (origin === undefined) return 0;
      if (state === 'pending') {
        if (e < deadline()) return 0;
        clock.fallback(deadline());
      }
      if (state === 'rive' && !landed) {
        if (e < full) return Math.min(story(e), up);
        clock.fallback(full);
      }
      return story(e);
    },
  };
  return clock;
}
