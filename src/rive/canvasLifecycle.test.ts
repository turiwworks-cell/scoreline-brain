import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mountCanvas } from './canvasLifecycle';
import { createSlots } from './loader';
import type { RiveInstance, RiveLayout, RiveOptions, RiveRuntime } from './types';

const mock = vi.hoisted(() => ({ paints: [] as (() => void)[], runtime: vi.fn<() => Promise<RiveRuntime>>(), file: vi.fn<(source: string) => Promise<ArrayBuffer>>(), slots: null as ReturnType<typeof createSlots> | null }));
vi.mock('./afterPaint', () => ({ afterPaint: (fn: () => void) => { mock.paints.push(fn); return () => { mock.paints = mock.paints.filter((x) => x !== fn); }; } }));
vi.mock('./loader', async (original) => { const actual = await original<typeof import('./loader')>(); return { ...actual, riveLoader: { runtime: mock.runtime, file: mock.file }, riveSlots: { take: () => mock.slots!.take() } }; });

let hidden = false;
let intersect: IntersectionObserverCallback;
let resize: ResizeObserverCallback;
let observeBox: ResizeObserverOptions['box'] | undefined;
const disconnectIO = vi.fn();
const disconnectRO = vi.fn();
const instances: Fake[] = [];
const layoutOf = (b: { minX: number; minY: number; maxX: number; maxY: number }): RiveLayout => ({ ...b, copyWith: layoutOf });
class Fake implements RiveInstance {
  stateMachineNames = ['Moments'];
  viewModelInstance = null;
  layout = layoutOf({ minX: 0, minY: 0, maxX: 0, maxY: 0 });
  reset = vi.fn(); play = vi.fn(); pause = vi.fn(); stopRendering = vi.fn(); startRendering = vi.fn(); resizeDrawingSurfaceToCanvas = vi.fn(); cleanup = vi.fn();
  constructor(public options: RiveOptions) { instances.push(this); }
}
const mounted: ReturnType<typeof mountCanvas>[] = [];
const entry = (canvas: HTMLCanvasElement, isIntersecting: boolean): IntersectionObserverEntry => ({
  target: canvas, isIntersecting, boundingClientRect: canvas.getBoundingClientRect(),
  intersectionRect: new DOMRect(), rootBounds: null, time: 0, intersectionRatio: isIntersecting ? 1 : 0,
});
const paint = async () => { const all = mock.paints.splice(0); all.forEach((fn) => fn()); await Promise.resolve(); await Promise.resolve(); };
const setup = () => {
  const canvas = document.createElement('canvas');
  const binding = { cleanup: vi.fn(), resume: vi.fn() };
  const options = { source: '/rive/moments.riv', bind: vi.fn<(instance: RiveInstance, sync: () => void) => typeof binding>(() => binding), ready: vi.fn(), error: vi.fn() };
  const life = mountCanvas(canvas, options); mounted.push(life);
  return { canvas, binding, options, life };
};
const load = async () => { await paint(); const inst = instances.at(-1)!; inst.options.onLoad(); return inst; };
beforeEach(() => {
  hidden = false; instances.length = 0; mock.paints = []; mock.slots = createSlots(); vi.clearAllMocks();
  vi.spyOn(document, 'hidden', 'get').mockImplementation(() => hidden);
  mock.runtime.mockResolvedValue({ Rive: Fake });
  mock.file.mockResolvedValue(new Uint8Array([82, 73, 86, 69]).buffer);
  vi.stubGlobal('IntersectionObserver', class { constructor(fn: IntersectionObserverCallback) { intersect = fn; } observe() {} disconnect = disconnectIO; });
  observeBox = undefined;
  vi.stubGlobal('ResizeObserver', class { constructor(fn: ResizeObserverCallback) { resize = fn; } observe(_target: Element, options?: ResizeObserverOptions) { observeBox = options?.box; } disconnect = disconnectRO; });
});
afterEach(() => { mounted.splice(0).forEach((life) => life.dispose()); vi.unstubAllGlobals(); vi.restoreAllMocks(); });
describe('Rive canvas ownership', () => {
  it('shares the offscreen renderer and configures before playback', async () => {
    const s = setup(); const inst = await load();
    expect(inst.options.useOffscreenRenderer).toBe(true);
    expect(inst.options.autoplay).toBe(false);
    expect(inst.options.autoBind).toBe(true);
    expect(inst.options.enableRiveAssetCDN).toBe(false);
    expect(inst.reset).toHaveBeenCalledWith({ artboard: undefined, stateMachine: 'Moments', autoplay: false, autoBind: true });
    expect(inst.reset.mock.invocationCallOrder[0]).toBeLessThan(s.options.bind.mock.invocationCallOrder[0]!);
    expect(inst.options.tabIndex).toBe(-1);
    expect(inst.options.shouldDisableRiveListeners).toBe(true);
    expect(s.options.bind).toHaveBeenCalledWith(inst, expect.any(Function));
    expect(s.binding.resume).toHaveBeenCalled(); expect(s.options.ready).toHaveBeenCalledTimes(1);
    expect(mock.slots!.count).toBe(1);
  });
  it('pauses offscreen and while hidden; hidden resizes never draw', async () => {
    const s = setup(); const inst = await load(); vi.clearAllMocks();
    intersect([entry(s.canvas, false)], {} as IntersectionObserver);
    expect(inst.pause).toHaveBeenCalled(); expect(inst.stopRendering).toHaveBeenCalled();
    hidden = true; document.dispatchEvent(new Event('visibilitychange'));
    resize([], {} as ResizeObserver);
    expect(inst.startRendering).not.toHaveBeenCalled(); expect(inst.resizeDrawingSurfaceToCanvas).not.toHaveBeenCalled();
    intersect([entry(s.canvas, true)], {} as IntersectionObserver);
    expect(inst.startRendering).not.toHaveBeenCalled();
    hidden = false; document.dispatchEvent(new Event('visibilitychange'));
    expect(inst.startRendering).toHaveBeenCalledTimes(1); expect(inst.resizeDrawingSurfaceToCanvas).toHaveBeenCalledTimes(1);
  });
  it('sizes the drawing surface to the canvas\'s device pixels, not to window.devicePixelRatio', async () => {
    const s = setup(); const inst = await load();
    expect(observeBox).toBe('device-pixel-content-box');
    // a phone emulated on a desktop: the page reports ratio 1 while the canvas is drawn at 5
    vi.spyOn(window, 'devicePixelRatio', 'get').mockReturnValue(1);
    vi.spyOn(s.canvas, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 128.8, 44));
    const size = { inlineSize: 644, blockSize: 220 };
    resize([{ target: s.canvas, devicePixelContentBoxSize: [size] } as unknown as ResizeObserverEntry], {} as ResizeObserver);
    const ratio = inst.resizeDrawingSurfaceToCanvas.mock.calls.at(-1)![0] as number;
    // Rive sets the surface to ratio × the client rect and truncates it
    expect(Math.trunc(ratio * 128.8)).toBe(644);
    // Chrome's device mode: the device-pixel box ignores the emulated ratio 3, which the page is drawn at
    vi.spyOn(window, 'devicePixelRatio', 'get').mockReturnValue(3);
    resize([{ target: s.canvas, devicePixelContentBoxSize: [{ inlineSize: 129, blockSize: 44 }] } as unknown as ResizeObserverEntry], {} as ResizeObserver);
    expect(inst.resizeDrawingSurfaceToCanvas).toHaveBeenLastCalledWith(3);
  });
  it('sizes the surface for the canvas\'s own box, not as an ancestor\'s transform shows it', async () => {
    const s = setup(); const inst = await load();
    vi.spyOn(window, 'devicePixelRatio', 'get').mockReturnValue(2);
    // the word's box still scaled 1.08 when it binds: 427 px on screen for its own 395.5
    vi.spyOn(s.canvas, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 395.5 * 1.08, 344));
    resize([{ target: s.canvas, devicePixelContentBoxSize: [{ inlineSize: 791, blockSize: 688 }], contentBoxSize: [{ inlineSize: 395.5, blockSize: 344 }] } as unknown as ResizeObserverEntry], {} as ResizeObserver);
    const ratio = inst.resizeDrawingSurfaceToCanvas.mock.calls.at(-1)![0] as number;
    expect(Math.trunc(ratio * 395.5 * 1.08)).toBe(791);
  });
  it('tells the binding of each resize, after it, and asks Rive to draw every frame only when told to', async () => {
    const s = setup(); const resized = vi.fn(); s.options.bind.mockImplementation(() => ({ ...s.binding, resized }));
    const inst = await load();
    expect(inst.options.drawingOptions).toBeUndefined();
    s.canvas.width = 640; s.canvas.height = 480;
    resize([], {} as ResizeObserver);
    expect(resized).toHaveBeenLastCalledWith(640, 480);
    expect(resized.mock.invocationCallOrder.at(-1)!).toBeGreaterThan(inst.resizeDrawingSurfaceToCanvas.mock.invocationCallOrder.at(-1)!);
    const canvas = document.createElement('canvas');
    mounted.push(mountCanvas(canvas, { source: '/rive/moments.riv', alwaysDraw: true, bind: () => undefined, ready: vi.fn(), error: vi.fn() }));
    expect((await load()).options.drawingOptions).toBe('alwaysDraw');
  });
  it('draws an oversampled canvas finer than the screen, up to MAX_RATIO', async () => {
    const canvas = document.createElement('canvas');
    mounted.push(mountCanvas(canvas, { source: '/rive/live-icon.riv', oversample: 2, bind: () => undefined, ready: vi.fn(), error: vi.fn() }));
    const inst = await load();
    vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 128.8, 44));
    for (const [screen, drawn] of [[1, 2], [3, 6], [5, 8]] as const) {
      vi.spyOn(window, 'devicePixelRatio', 'get').mockReturnValue(screen);
      resize([], {} as ResizeObserver);
      expect(inst.resizeDrawingSurfaceToCanvas).toHaveBeenLastCalledWith(drawn);
    }
  });
  it('falls back to the content box where the device-pixel box is not supported', async () => {
    vi.stubGlobal('ResizeObserver', class {
      constructor(fn: ResizeObserverCallback) { resize = fn; }
      observe(_target: Element, options?: ResizeObserverOptions) { if (options?.box === 'device-pixel-content-box') throw new TypeError('box'); observeBox = options?.box ?? 'content-box'; }
      disconnect = disconnectRO;
    });
    setup(); const inst = await load();
    expect(observeBox).toBe('content-box');
    resize([], {} as ResizeObserver);
    expect(inst.resizeDrawingSurfaceToCanvas).toHaveBeenLastCalledWith(window.devicePixelRatio);
  });
  it('a word-clock request cannot restart an offscreen canvas', async () => {
    const s = setup();
    let requestSync!: () => void;
    let playing = false;
    s.options.bind.mockImplementation((_instance, sync) => { requestSync = sync; return { ...s.binding, shouldPlay: () => playing }; });
    const inst = await load();
    vi.clearAllMocks();
    intersect([entry(s.canvas, false)], {} as IntersectionObserver);
    playing = true;
    requestSync();
    expect(inst.play).not.toHaveBeenCalled();
    expect(inst.startRendering).not.toHaveBeenCalled();
    intersect([entry(s.canvas, true)], {} as IntersectionObserver);
    expect(inst.play).toHaveBeenCalledTimes(1);
    expect(inst.startRendering).toHaveBeenCalledTimes(1);
  });
  it('cleans binding, instance and observers exactly once', async () => {
    const s = setup(); const inst = await load(); s.life.dispose(); s.life.dispose();
    expect(s.binding.cleanup).toHaveBeenCalledTimes(1); expect(inst.cleanup).toHaveBeenCalledTimes(1);
    expect(disconnectIO).toHaveBeenCalledTimes(1); expect(disconnectRO).toHaveBeenCalledTimes(1); expect(mock.slots!.count).toBe(0);
  });
  it('does not import or fetch when disposed before idle', async () => {
    const s = setup(); s.life.dispose(); await paint();
    expect(mock.runtime).not.toHaveBeenCalled(); expect(mock.file).not.toHaveBeenCalled();
  });
  it('never creates an instance for a stale async completion', async () => {
    let resolve!: (runtime: RiveRuntime) => void;
    mock.runtime.mockImplementation(() => new Promise((r) => { resolve = r; }));
    const s = setup(); await paint(); expect(mock.slots!.count).toBe(1);
    s.life.dispose(); resolve({ Rive: Fake }); await Promise.resolve(); await Promise.resolve();
    expect(instances.length).toBe(0); expect(mock.slots!.count).toBe(0);
  });
  it('does not start a load in a hidden tab and defers binding if hidden during parsing', async () => {
    hidden = true; const s = setup(); await paint(); expect(mock.runtime).not.toHaveBeenCalled();
    hidden = false; document.dispatchEvent(new Event('visibilitychange')); await paint();
    const inst = instances.at(-1)!; hidden = true; document.dispatchEvent(new Event('visibilitychange')); inst.options.onLoad();
    expect(s.options.bind).not.toHaveBeenCalled(); expect(inst.startRendering).not.toHaveBeenCalled();
    hidden = false; document.dispatchEvent(new Event('visibilitychange'));
    expect(s.options.bind).toHaveBeenCalledTimes(1); expect(inst.startRendering).toHaveBeenCalledTimes(1);
    expect(s.options.ready).toHaveBeenCalledTimes(1);
  });
  it('releases failed loads and rejected contracts', async () => {
    mock.file.mockRejectedValueOnce(new Error('404'));
    const s = setup(); await paint(); await Promise.resolve();
    expect(s.options.error).toHaveBeenCalled(); expect(mock.slots!.count).toBe(0);
    const another = setup(); another.options.bind.mockImplementation(() => { throw new Error('bad contract'); });
    const inst = await load(); expect(inst.cleanup).toHaveBeenCalledTimes(1); expect(another.options.error).toHaveBeenCalled(); expect(mock.slots!.count).toBe(0);
  });
  it('rejects a third canvas and maintains ownership across twenty scenes', async () => {
    const icon = setup(); const iconInstance = await load();
    for (let i = 0; i < 20; i++) {
      const scene = setup(); const inst = await load(); expect(mock.slots!.count).toBe(2);
      if (i === 0) { const extra = setup(); await paint(); expect(extra.options.error).toHaveBeenCalledTimes(1); expect(mock.slots!.count).toBe(2); extra.life.dispose(); }
      scene.life.dispose(); expect(inst.cleanup).toHaveBeenCalledTimes(1); expect(mock.slots!.count).toBe(1);
    }
    icon.life.dispose(); expect(iconInstance.cleanup).toHaveBeenCalledTimes(1); expect(mock.slots!.count).toBe(0);
  });
});
