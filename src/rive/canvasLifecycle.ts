import { afterPaint } from './afterPaint';
import { riveLoader, riveSlots } from './loader';
import type { CanvasBinding, RiveInstance } from './types';

/** An instance lent by an owner that keeps it between mounts (the warm goal word, wordStage.ts). */
export type Borrowed = {
  readonly instance: RiveInstance;
  /** the canvas the instance draws into; it stands in for the mount's own while lent */
  readonly canvas: HTMLCanvasElement;
  /** hands it back, paused and not rendering */
  give(): void;
};

export type CanvasOptions = {
  source: string;
  artboard?: string;
  /** start without waiting for an idle slot (the goal word, which a scene is waiting for) */
  eager?: boolean;
  advance?(): void;
  bind(instance: RiveInstance, requestSync: () => void): CanvasBinding | void;
  ready(): void;
  error(error: unknown): void;
  /**
   * A loaded instance to borrow instead of creating one (no `new Rive`, no parse in this mount);
   * null: create one as usual.
   */
  borrow?(): Promise<Borrowed> | null;
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
  // the borrowed instance, while this mount holds it, and the canvas it draws into
  let lent: Borrowed | undefined;
  let target = canvas;
  const lending = options.borrow?.() ?? null;

  const active = () => !disposed && !failed && visible && !document.hidden;
  const releaseInstance = () => {
    const current = instance;
    instance = undefined;
    loaded = false;
    try { binding?.cleanup?.(); } finally {
      binding = undefined;
      try { if (!lent) current?.cleanup(); } finally {
        if (lent) unlend();
        release?.();
        release = undefined;
      }
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
        // Bind the selected machine before any playback. The v2 default may be a linear timeline.
        instance.reset({ artboard: options.artboard, stateMachine: machine, autoplay: false, autoBind: true });
        instance.stopRendering();
        binding = options.bind(instance, sync) ?? undefined;
        bound = true;
      } catch (error) { fail(error); return; }
    }
    if (dirtySize) {
      instance.resizeDrawingSurfaceToCanvas();
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
  const watch = (el: HTMLCanvasElement) => {
    io?.unobserve(target);
    ro?.unobserve(target);
    target = el;
    io?.observe(el);
    ro?.observe(el);
  };
  // the lent canvas takes the place of this mount's own, with its styles as they change (the
  // owner's opacity, its size)
  let mirror: MutationObserver | undefined;
  const lend = (b: Borrowed) => {
    lent = b;
    const copy = () => {
      b.canvas.className = canvas.className;
      b.canvas.style.cssText = canvas.style.cssText;
      b.canvas.style.removeProperty('display');
    };
    copy();
    canvas.style.display = 'none';
    mirror = new MutationObserver(copy);
    mirror.observe(canvas, { attributes: true, attributeFilter: ['class', 'style'] });
    canvas.after(b.canvas);
    watch(b.canvas);
    release = b.give;
    instance = b.instance;
    loaded = true;
    paused = true;
    dirtySize = true;
    sync();
  };
  function unlend() {
    lent = undefined;
    mirror?.disconnect();
    mirror = undefined;
    canvas.style.display = '';
    watch(canvas);
  }
  let borrowing = false;
  const start = () => {
    if (lending) {
      // borrowed once, when it is ready: not after an idle slot, not again after a hide
      if (borrowing || instance || failed) return;
      borrowing = true;
      lending.then((b) => {
        if (disposed || failed) { b.give(); return; }
        try { lend(b); } catch (error) { fail(error); }
      }, fail);
      return;
    }
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
    const entry = entries.find((e) => e.target === target);
    if (!entry) return;
    visible = entry.isIntersecting;
    visibility();
  });
  io?.observe(canvas);
  const resize = () => { dirtySize = true; sync(); };
  const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(resize);
  ro?.observe(canvas);
  window.addEventListener('resize', resize);
  // A change of device pixel ratio alone (browser zoom, a device toolbar, a second screen) leaves
  // the canvas's CSS size as it was, so neither observer above fires and the drawing surface stays
  // at the old resolution: the artwork turns soft. Re-arm the query for each new ratio.
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
