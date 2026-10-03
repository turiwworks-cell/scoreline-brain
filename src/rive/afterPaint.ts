/** After two paints and an idle slot; hidden tabs wait. Every scheduled callback is cancellable. */
export function afterPaint(run: () => void): () => void {
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
        if (typeof window.requestIdleCallback === 'function') idle = window.requestIdleCallback(finish);
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
