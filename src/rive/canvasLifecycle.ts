import { afterPaint } from './afterPaint';
import { riveLoader, riveSlots } from './loader';
import type { CanvasBinding, RiveInstance } from './types';

export type CanvasOptions = {
  source: string;
  artboard?: string;
  /** start without waiting for an idle slot (the goal word, which a scene is waiting for) */
  eager?: boolean;
  advance?(): void;
  bind(instance: RiveInstance, requestSync: () => void): CanvasBinding | void;
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
  /** the canvas's width in real device pixels, when the browser reports it (the ResizeObserver below) */
  let deviceWidth: number | undefined;
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
  /**
   * Device pixels per CSS pixel for the drawing surface: window.devicePixelRatio, or more where the
   * canvas's own device-pixel box says the page is drawn finer than that. Rive multiplies the
   * canvas's client rect by it.
   */
  const pixelRatio = () => {
    const ratio = window.devicePixelRatio || 1;
    const width = canvas.getBoundingClientRect().width;
    // a hair over, so the whole-pixel surface Rive truncates to is never a pixel short
    return deviceWidth && width > 0 ? Math.max(ratio, (deviceWidth + 0.01) / width) : ratio;
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
        // Bind the selected machine before any playback. The v2 default may be a linear timeline.
        instance.reset({ artboard: options.artboard, stateMachine: machine, autoplay: false, autoBind: true });
        instance.stopRendering();
        binding = options.bind(instance, sync) ?? undefined;
        bound = true;
      } catch (error) { fail(error); return; }
    }
    if (dirtySize) {
      instance.resizeDrawingSurfaceToCanvas(pixelRatio());
      dirtySize = false;
    }
    binding?.resume?.();
    if (binding?.shouldPlay?.() === false) {
      if (!paused) { instance.pause(); instance.stopRendering(); }
      paused = true;
    } else if (paused) {
      instance.play(machine);
      instance.startRendering();
      paused = false;
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
          artboard: options.artboard,
          tabIndex: -1,
          focusOptions: { allowFocusInterrupt: false },
          shouldDisableRiveListeners: true,
          onAdvance: options.advance,
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
    }, { idle: !options.eager });
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
  // The drawing surface is at least the canvas's device pixels where the browser reports them
  // (device-pixel-content-box). window.devicePixelRatio alone is not always the ratio the page is
  // drawn at: a phone emulated on a desktop (Firefox's responsive design mode) reports the phone's
  // ratio while the page is drawn at the desktop's, zoom included, so a surface sized by it was
  // stretched and the artwork came out soft. Chrome's device mode errs the other way (its
  // device-pixel box ignores the emulated ratio), hence the larger of the two. The device-pixel box
  // also changes with zoom and with the ratio.
  const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver((entries) => {
    const box = entries.find((e) => e.target === canvas)?.devicePixelContentBoxSize?.[0];
    if (box) deviceWidth = box.inlineSize > 0 ? box.inlineSize : undefined;
    resize();
  });
  try {
    ro?.observe(canvas, { box: 'device-pixel-content-box' });
  } catch {
    // a browser without the device-pixel box sizes by window.devicePixelRatio
    ro?.observe(canvas);
  }
  window.addEventListener('resize', resize);
  // Without the device-pixel box, a change of device pixel ratio alone (browser zoom, a device
  // toolbar, a second screen) leaves the canvas's CSS size as it was, so the observer above does not
  // fire and the drawing surface stays at the old resolution: the artwork turns soft. Re-arm the
  // query for each new ratio.
  let dpr: MediaQueryList | null = null;
  const watchRatio = () => {
    dpr?.removeEventListener('change', onRatio);
    dpr = typeof matchMedia === 'function' ? matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`) : null;
    dpr?.addEventListener('change', onRatio);
  };
  function onRatio() { watchRatio(); resize(); }
  watchRatio();
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
      dpr?.removeEventListener('change', onRatio);
      document.removeEventListener('visibilitychange', visibility);
      releaseInstance();
    },
  };
}
