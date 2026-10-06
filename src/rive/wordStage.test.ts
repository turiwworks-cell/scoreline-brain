import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mountCanvas } from './canvasLifecycle';
import { createSlots } from './loader';
import type { RiveInstance, RiveLayout, RiveOptions, RiveRuntime } from './types';
import { borrowWord, freeWord, resetWordStage, warmWord } from './wordStage';

/* Issue #6: with a live match the goal word is made once, and a scene's mount neither creates a Rive instance nor parses the file. */

const mock = vi.hoisted(() => ({ paints: [] as (() => void)[], runtime: vi.fn<() => Promise<RiveRuntime>>(), file: vi.fn<(source: string) => Promise<ArrayBuffer>>(), slots: null as ReturnType<typeof createSlots> | null }));
vi.mock('./afterPaint', () => ({ afterPaint: (fn: () => void) => { mock.paints.push(fn); return () => { mock.paints = mock.paints.filter((x) => x !== fn); }; } }));
vi.mock('./loader', async (original) => { const actual = await original<typeof import('./loader')>(); return { ...actual, riveLoader: { runtime: mock.runtime, file: mock.file }, riveSlots: { take: () => mock.slots!.take() } }; });

const SOURCE = '/rive/moments.riv';
const instances: Fake[] = [];
let resize: ResizeObserverCallback;
const layoutOf = (b: { minX: number; minY: number; maxX: number; maxY: number }): RiveLayout => ({ ...b, copyWith: layoutOf });
class Fake implements RiveInstance {
  stateMachineNames = ['Moments'];
  viewModelInstance = null;
  layout = layoutOf({ minX: 0, minY: 0, maxX: 0, maxY: 0 });
  reset = vi.fn(); play = vi.fn(); pause = vi.fn(); stopRendering = vi.fn(); startRendering = vi.fn(); resizeDrawingSurfaceToCanvas = vi.fn(); cleanup = vi.fn();
  constructor(public options: RiveOptions) { instances.push(this); }
}
const flush = async () => { for (let i = 0; i < 6; i++) await Promise.resolve(); };
const paint = async () => { mock.paints.splice(0).forEach((fn) => fn()); await flush(); };
/** Warms the word and lets it load: the one instance a session makes. */
const warm = async () => { warmWord(SOURCE); await paint(); const inst = instances.at(-1)!; inst.options.onLoad(); await flush(); return inst; };
/** A scene's word mount: its own canvas in a box, borrowing the warm word. */
const scene = () => {
  const box = document.createElement('span');
  const canvas = document.createElement('canvas');
  canvas.style.opacity = '0';
  box.append(canvas);
  document.body.append(box);
  const binding = { cleanup: vi.fn(), resume: vi.fn(), resized: vi.fn() };
  const options = { source: SOURCE, eager: true, bind: vi.fn<(instance: RiveInstance, sync: () => void) => typeof binding>(() => binding), ready: vi.fn(), error: vi.fn(), borrow: () => borrowWord(SOURCE) };
  const life = mountCanvas(canvas, options);
  return { box, canvas, binding, options, life };
};

beforeEach(() => {
  instances.length = 0; mock.paints = []; mock.slots = createSlots(); vi.clearAllMocks(); resetWordStage();
  document.body.innerHTML = '';
  mock.runtime.mockResolvedValue({ Rive: Fake });
  mock.file.mockResolvedValue(new Uint8Array([82, 73, 86, 69]).buffer);
  vi.stubGlobal('IntersectionObserver', class { observe() {} unobserve() {} disconnect() {} });
  vi.stubGlobal('ResizeObserver', class { constructor(fn: ResizeObserverCallback) { resize = fn; } observe() {} unobserve() {} disconnect() {} });
});
afterEach(() => { vi.unstubAllGlobals(); });

describe('the warm goal word', () => {
  it('is made once, at idle, parked off-screen and not rendering', async () => {
    warmWord(SOURCE);
    expect(instances).toHaveLength(0);
    const inst = await warm();
    expect(instances).toHaveLength(1);
    expect(inst.stopRendering).toHaveBeenCalled();
    expect(inst.options.drawingOptions).toBe('alwaysDraw');
    expect(inst.options.canvas.parentElement?.id).toBe('rive-word-parking');
    expect(mock.slots!.count).toBe(1);
  });

  it('a scene borrows it: no new Rive, no parse; its canvas moves into the scene and back', async () => {
    const inst = await warm();
    const parsed = mock.file.mock.calls.length;
    const s = scene();
    await flush();
    expect(instances).toHaveLength(1);
    expect(mock.file.mock.calls.length).toBe(parsed);
    // in the scene's box, with the scene canvas's styles; the scene's own canvas stands aside
    expect(inst.options.canvas.parentElement).toBe(s.box);
    expect(inst.options.canvas.style.opacity).toBe('0');
    expect(s.canvas.style.display).toBe('none');
    // and follows them: the word fades in when it is ready
    s.canvas.style.opacity = '1';
    await flush();
    expect(inst.options.canvas.style.opacity).toBe('1');
    expect(inst.options.canvas.style.display).toBe('');
    // a fresh state machine and view model for this scene, then the scene's binding
    expect(inst.reset).toHaveBeenCalledWith({ artboard: undefined, stateMachine: 'Moments', autoplay: false, autoBind: true });
    expect(s.options.bind).toHaveBeenCalledWith(inst, expect.any(Function));
    expect(s.options.ready).toHaveBeenCalledTimes(1);
    s.life.dispose();
    expect(s.binding.cleanup).toHaveBeenCalledTimes(1);
    expect(inst.cleanup).not.toHaveBeenCalled();
    expect(inst.pause).toHaveBeenCalled();
    expect(inst.options.canvas.parentElement?.id).toBe('rive-word-parking');
  });

  it('two scenes in a row rebind the same instance', async () => {
    const inst = await warm();
    const a = scene(); await flush(); a.life.dispose();
    const b = scene(); await flush();
    expect(instances).toHaveLength(1);
    expect(inst.reset).toHaveBeenCalledTimes(2);
    expect(b.options.bind).toHaveBeenCalledWith(inst, expect.any(Function));
    b.life.dispose();
  });

  it('uses the borrowed surface and its observed pixel size for the word rise', async () => {
    const inst = await warm();
    const s = scene(); await flush();
    const drawn = inst.options.canvas;
    // The React placeholder is hidden; only the borrowed canvas owns a drawing surface.
    drawn.width = 780; drawn.height = 1080;
    vi.spyOn(drawn, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 390, 540));
    vi.spyOn(s.canvas, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 0, 0));
    resize([{ target: drawn, devicePixelContentBoxSize: [{ inlineSize: 780, blockSize: 1080 }], contentBoxSize: [{ inlineSize: 390, blockSize: 540 }] } as unknown as ResizeObserverEntry], {} as ResizeObserver);
    expect(s.binding.resized).toHaveBeenLastCalledWith(780, 1080);
    expect(inst.resizeDrawingSurfaceToCanvas.mock.calls.at(-1)![0]).toBeCloseTo(2, 4);
    s.life.dispose();
  });

  it('a scene that mounts while it is still loading waits for it', async () => {
    warmWord(SOURCE); await paint();
    const s = scene(); await flush();
    expect(s.options.bind).not.toHaveBeenCalled();
    instances[0]!.options.onLoad(); await flush();
    expect(s.options.bind).toHaveBeenCalledTimes(1);
    expect(instances).toHaveLength(1);
    s.life.dispose();
  });

  it('is freed when no match is live; one lent is freed when the scene gives it back', async () => {
    const inst = await warm();
    const s = scene(); await flush();
    freeWord();
    expect(inst.cleanup).not.toHaveBeenCalled();
    s.life.dispose();
    expect(inst.cleanup).toHaveBeenCalledTimes(1);
    expect(mock.slots!.count).toBe(0);
    // with none warm, a scene makes its own as before
    const own = scene(); await paint(); instances.at(-1)!.options.onLoad(); await flush();
    expect(instances).toHaveLength(2);
    own.life.dispose();
  });
});

describe('the warm goal word, mounted twice before it is ready (StrictMode)', () => {
  it('goes to the second mount', async () => {
    warmWord(SOURCE); await paint();
    const first = scene(); first.life.dispose();
    const second = scene();
    instances[0]!.options.onLoad(); await flush();
    expect(first.options.bind).not.toHaveBeenCalled();
    expect(second.options.bind).toHaveBeenCalledTimes(1);
    expect(second.options.error).not.toHaveBeenCalled();
    expect(instances).toHaveLength(1);
    second.life.dispose();
  });
});
