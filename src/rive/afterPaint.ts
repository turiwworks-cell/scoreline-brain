/**
 * After two paints and an idle slot; hidden tabs wait. Every scheduled callback is cancellable.
 * `idle: false` skips the idle slot, for work that is needed now: while a scene animates there
 * may be no idle slot for a second.
 */
export function afterPaint(run: () => void, { idle: waitIdle = true }: { idle?: boolean } = {}): () => void {
  let disposed = false;
  let frame = 0;
  let idle = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const cancel = () => {
    if (frame) cancelAnimationFrame(frame);
    if (idle) window.cancelIdleCallback(idle);
    if (timer !== undefined) clearTimeout(timer);
    frame = idle = 0;
    timer = undefined;
  };
  const finish = () => {
    idle = 0;
    timer = undefined;
    if (disposed || document.hidden) return;
    disposed = true;
    document.removeEventListener('visibilitychange', visible);
    run();
  };
  const visible = () => {
    cancel();
    if (disposed || document.hidden) return;
    frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => {
        frame = 0;
        if (!waitIdle) finish();
        else if (typeof window.requestIdleCallback === 'function') idle = window.requestIdleCallback(finish);
        else timer = setTimeout(finish, 0);
      });
    });
  };
  document.addEventListener('visibilitychange', visible);
  visible();
  return () => {
    disposed = true;
    cancel();
    document.removeEventListener('visibilitychange', visible);
  };
}
