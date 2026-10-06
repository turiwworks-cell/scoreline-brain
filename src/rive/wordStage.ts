import { afterPaint } from './afterPaint';
import type { DrawOptimizationOptions } from '@rive-app/webgl2';
import type { Borrowed } from './canvasLifecycle';
import { riveLoader, riveSlots } from './loader';
import type { RiveInstance } from './types';

/*
 * The goal word's one Rive instance (Part 21, #6). Creating it (a `new Rive`: the file parsed,
 * the artboard and the view model built) was one 250–450 ms frame inside every scene, in the
 * middle of the flash and the shake, and on a cold phone the first goal could miss its window
 * (WORD_GRACE). While a match is live it is made once, at idle, on a canvas parked off-screen, and
 * every scene borrows it: its canvas moves into the scene's word box (a moved canvas keeps its
 * context), the scene's mount rebinds it (`reset`: a fresh state machine and view model, no
 * parse), and on unmount it comes back paused and not rendering (ARCHITECTURE §3).
 *
 * It holds the word's slot (riveSlots: the icon and the word) while it lives.
 */

type Stage = {
  readonly source: string;
  readonly canvas: HTMLCanvasElement;
  /** the instance once loaded; rejects when it can't be made */
  readonly ready: Promise<RiveInstance>;
  instance?: RiveInstance;
  release?: () => void;
  cancel?: () => void;
  /** starts making it now, if the idle slot hasn't come yet */
  begin?: () => void;
  lent: boolean;
  /** freed while lent: cleaned up when given back */
  freed: boolean;
  /** the latest mount to ask for it; it is lent to that one when ready */
  claim?: object;
};

let stage: Stage | null = null;

function parking(): HTMLElement {
  let el = document.getElementById('rive-word-parking');
  if (!el) {
    el = document.createElement('div');
    el.id = 'rive-word-parking';
    el.setAttribute('aria-hidden', 'true');
    el.style.cssText = 'position:fixed;left:-10000px;top:0;width:390px;height:340px;overflow:hidden;pointer-events:none;contain:strict';
    document.body.append(el);
  }
  return el;
}

function park(canvas: HTMLCanvasElement) {
  canvas.removeAttribute('class');
  canvas.style.cssText = 'width:390px;height:340px';
  parking().append(canvas);
}

function destroy(s: Stage) {
  s.cancel?.();
  try { s.instance?.cleanup(); } finally {
    s.instance = undefined;
    s.release?.();
    s.release = undefined;
    s.canvas.remove();
  }
}

/** Makes the shared word for `source` at idle, if it isn't made yet. */
export function warmWord(source: string): void {
  if (stage && stage.source === source && !stage.freed) return;
  if (stage && !stage.lent) destroy(stage);
  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  canvas.tabIndex = -1;
  park(canvas);
  let resolve!: (i: RiveInstance) => void;
  let reject!: (e: unknown) => void;
  const ready = new Promise<RiveInstance>((y, n) => { resolve = y; reject = n; });
  // a scene that finds it failing falls back to the DOM word, as for any Rive failure
  ready.catch(() => {});
  const s: Stage = { source, canvas, ready, lent: false, freed: false };
  stage = s;
  const fail = (error: unknown) => {
    if (stage === s) stage = null;
    destroy(s);
    reject(error);
  };
  const make = () => {
    s.cancel?.();
    s.cancel = s.begin = undefined;
    const release = riveSlots.take();
    if (!release) { fail(new Error('Rive instance limit reached')); return; }
    s.release = release;
    void Promise.all([riveLoader.runtime(), riveLoader.file(source)]).then(([runtime, buffer]) => {
      if (stage !== s) return;
      const instance: RiveInstance = new runtime.Rive({
        canvas,
        buffer,
        tabIndex: -1,
        focusOptions: { allowFocusInterrupt: false },
        shouldDisableRiveListeners: true,
        autoplay: false,
        autoBind: true,
        // The borrowed word's rise changes layout after its own timeline has stopped.
        drawingOptions: 'alwaysDraw' as DrawOptimizationOptions.AlwaysDraw,
        useOffscreenRenderer: true,
        enableRiveAssetCDN: false,
        onLoad: () => {
          if (stage !== s) return;
          instance.stopRendering();
          s.instance = instance;
          resolve(instance);
        },
        onLoadError: fail,
      });
      s.instance = instance;
      instance.stopRendering();
    }).catch(fail);
  };
  s.begin = make;
  s.cancel = afterPaint(make);
}

/** Frees the shared word (no match is live any more); one that is lent goes when given back. */
export function freeWord(): void {
  const s = stage;
  if (!s) return;
  stage = null;
  if (s.lent) s.freed = true;
  else destroy(s);
}

/**
 * Lends the shared word for `source` to one mount: null when there is none (or it is lent), so
 * the mount makes its own as before.
 */
export function borrowWord(source: string): Promise<Borrowed> | null {
  const s = stage;
  if (!s || s.source !== source || s.lent || s.freed) return null;
  // a goal before the idle slot came (a scene leaves none): make it now, as a scene's own would be
  s.begin?.();
  // lent when it is ready, to the latest mount that asked: one that went before then
  // (StrictMode's first mount, a scene closed at once) must not keep it from the next
  const claim = {};
  s.claim = claim;
  return s.ready.then((instance) => {
    if (s.claim !== claim || s.lent || s.freed) throw new Error('The goal word went to a later mount');
    s.lent = true;
    let given = false;
    return {
      instance,
      canvas: s.canvas,
      give() {
        if (given) return;
        given = true;
        s.lent = false;
        instance.pause();
        instance.stopRendering();
        park(s.canvas);
        if (s.freed || stage !== s) destroy(s);
      },
    };
  });
}

/** Tests: forget the stage without touching the DOM or the slot. */
export function resetWordStage(): void {
  stage = null;
}
