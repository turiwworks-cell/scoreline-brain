// A frame loop for the effects that are a function of time rather than a transition: the goal
// choreography and the red card. It runs only while something wants frames.

/** Calls `apply(now)` every frame until it returns false or the returned function is called. */
export function startFrames(apply: (now: number) => boolean, now: () => number): () => void {
  let raf = 0;
  let stopped = false;
  const tick = () => {
    raf = 0;
    if (stopped) return;
    if (apply(now())) raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
  return () => {
    stopped = true;
    if (raf) cancelAnimationFrame(raf);
  };
}
