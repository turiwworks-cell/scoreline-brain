import { afterPaint } from './afterPaint';
import { riveLoader, riveSlots } from './loader';
import type { CanvasBinding, RiveInstance } from './types';

export type CanvasOptions = {
  source: string;
  bind(instance: RiveInstance): CanvasBinding | void;
  ready(): void;
  error(error: unknown): void;
};

/** Owns the instance, observers and binding. No async continuation may outlive dispose(). */
export function mountCanvas(canvas: HTMLCanvasElement, options: CanvasOptions) {
  let disposed = false;
  let failed = false;
  let visible = true;
  let loaded = false;
  let bound = false;
  let announced = false;
  let instance: RiveInstance | undefined;
  let binding: CanvasBinding | undefined;
  let release: (() => void) | undefined;
  let cancelLoad: (() => void) | undefined;
  let starting = false;
  let paused = true;
  let dirtySize = true;
  let machine: string | undefined;

  const active = () => !disposed && !failed && visible && !document.hidden;
  const releaseInstance = () => {
    const current = instance;
    instance = undefined;
    loaded = false;
    try { binding?.cleanup?.(); } finally {
      binding = undefined;
      try { current?.cleanup(); } finally { release?.(); release = undefined; }
    }
  };
  const fail = (error: unknown) => {
    if (disposed || failed) return;
    failed = true;
    cancelLoad?.();
    releaseInstance();
    options.error(error);
  };
  const sync = () => {
    if (!instance || !loaded) return;
    if (!active()) {
      if (bound) instance.pause();
      instance.stopRendering();
      paused = true;
      return;
    }
    if (!bound) {
      try {
        machine = instance.stateMachineNames[0];
        if (!machine) throw new Error('Rive asset has no state machine');
        instance.play(machine);
        instance.pause();
        instance.stopRendering();
        binding = options.bind(instance) ?? undefined;
        bound = true;
      } catch (error) { fail(error); return; }
    }
    if (dirtySize) {
      instance.resizeDrawingSurfaceToCanvas();
      dirtySize = false;
    }
    if (paused) {
      binding?.resume?.();
      if (binding?.shouldPlay?.() !== false) {
        instance.play(machine);
        instance.startRendering();
        paused = false;
      }
    }
    if (!announced && !failed) { announced = true; options.ready(); }
  };
  const start = () => {
    if (!active() || starting || instance) return;
    starting = true;
    cancelLoad = afterPaint(() => {
      cancelLoad = undefined;
      if (!active()) { starting = false; return; }
      release = riveSlots.take() ?? undefined;
      if (!release) { fail(new Error('Rive instance limit reached')); return; }
      void Promise.all([riveLoader.runtime(), riveLoader.file(options.source)]).then(([runtime, buffer]) => {
        starting = false;
        if (!active()) { release?.(); release = undefined; return; }
        instance = new runtime.Rive({
          canvas,
          buffer,
          autoplay: false,
          autoBind: true,
          useOffscreenRenderer: true,
          enableRiveAssetCDN: false,
          onLoad: () => {
            if (disposed || failed || !instance) return;
            try {
              loaded = true;
              paused = true;
              sync();
            } catch (error) { fail(error); }
          },
          onLoadError: fail,
        });
        // Also prevents a load which completes in a hidden tab from starting its frame loop.
        instance.stopRendering();
      }).catch(fail);
    });
  };
  const visibility = () => {
    if (!active()) {
      cancelLoad?.();
      cancelLoad = undefined;
      // A started shared fetch is allowed to finish; it has no ownership of this mount.
      if (!release && !instance) starting = false;
    }
    if (instance) sync();
    else start();
  };
  const io = typeof IntersectionObserver === 'undefined' ? null : new IntersectionObserver((entries) => {
    const entry = entries.find((e) => e.target === canvas);
    if (!entry) return;
    visible = entry.isIntersecting;
    visibility();
  });
  io?.observe(canvas);
  const resize = () => { dirtySize = true; sync(); };
  const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(resize);
  ro?.observe(canvas);
  window.addEventListener('resize', resize);
  document.addEventListener('visibilitychange', visibility);
  start();
  return {
    sync,
    dispose() {
      if (disposed) return;
      disposed = true;
      cancelLoad?.();
      cancelLoad = undefined;
      io?.disconnect();
      ro?.disconnect();
      window.removeEventListener('resize', resize);
      document.removeEventListener('visibilitychange', visibility);
      releaseInstance();
    },
  };
}
