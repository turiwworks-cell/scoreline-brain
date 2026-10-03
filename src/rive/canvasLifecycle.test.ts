import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mountCanvas } from './canvasLifecycle';
import { createSlots } from './loader';
import type { RiveInstance, RiveOptions, RiveRuntime } from './types';

const mock = vi.hoisted(() => ({ paints: [] as (() => void)[], runtime: vi.fn<() => Promise<RiveRuntime>>(), file: vi.fn<(source: string) => Promise<ArrayBuffer>>(), slots: null as ReturnType<typeof createSlots> | null }));
vi.mock('./afterPaint', () => ({ afterPaint: (fn: () => void) => { mock.paints.push(fn); return () => { mock.paints = mock.paints.filter((x) => x !== fn); }; } }));
vi.mock('./loader', async (original) => { const actual = await original<typeof import('./loader')>(); return { ...actual, riveLoader: { runtime: mock.runtime, file: mock.file }, riveSlots: { take: () => mock.slots!.take() } }; });

let hidden = false;
let intersect: IntersectionObserverCallback;
let resize: ResizeObserverCallback;
const disconnectIO = vi.fn();
const disconnectRO = vi.fn();
const instances: Fake[] = [];
class Fake implements RiveInstance {
  stateMachineNames = ['Moments'];
  viewModelInstance = null;
  play = vi.fn(); pause = vi.fn(); stopRendering = vi.fn(); startRendering = vi.fn(); resizeDrawingSurfaceToCanvas = vi.fn(); cleanup = vi.fn();
  constructor(public options: RiveOptions) { instances.push(this); }
}
const mounted: ReturnType<typeof mountCanvas>[] = [];
const paint = async () => { const all = mock.paints.splice(0); all.forEach((fn) => fn()); await Promise.resolve(); await Promise.resolve(); };
const setup = () => {
  const canvas = document.createElement('canvas');
  const binding = { cleanup: vi.fn(), resume: vi.fn() };
  const options = { source: '/rive/moments.riv', bind: vi.fn(() => binding), ready: vi.fn(), error: vi.fn() };
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
  vi.stubGlobal('ResizeObserver', class { constructor(fn: ResizeObserverCallback) { resize = fn; } observe() {} disconnect = disconnectRO; });
});
afterEach(() => { mounted.splice(0).forEach((life) => life.dispose()); vi.unstubAllGlobals(); vi.restoreAllMocks(); });
describe('Rive canvas ownership', () => {
  it('shares the offscreen renderer and configures before playback', async () => {
    const s = setup(); const inst = await load();
    expect(inst.options.useOffscreenRenderer).toBe(true);
    expect(inst.options.autoplay).toBe(false);
    expect(inst.options.autoBind).toBe(true);
    expect(inst.options.enableRiveAssetCDN).toBe(false);
    expect(s.options.bind).toHaveBeenCalledWith(inst);
    expect(s.binding.resume).toHaveBeenCalled(); expect(s.options.ready).toHaveBeenCalledTimes(1);
    expect(mock.slots!.count).toBe(1);
  });
  it('pauses offscreen and while hidden; hidden resizes never draw', async () => {
    const s = setup(); const inst = await load(); vi.clearAllMocks();
    intersect([{ target: s.canvas, isIntersecting: false } as IntersectionObserverEntry], {} as IntersectionObserver);
    expect(inst.pause).toHaveBeenCalled(); expect(inst.stopRendering).toHaveBeenCalled();
    hidden = true; document.dispatchEvent(new Event('visibilitychange'));
    resize([], {} as ResizeObserver);
    expect(inst.startRendering).not.toHaveBeenCalled(); expect(inst.resizeDrawingSurfaceToCanvas).not.toHaveBeenCalled();
    intersect([{ target: s.canvas, isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver);
    expect(inst.startRendering).not.toHaveBeenCalled();
    hidden = false; document.dispatchEvent(new Event('visibilitychange'));
    expect(inst.startRendering).toHaveBeenCalledTimes(1); expect(inst.resizeDrawingSurfaceToCanvas).toHaveBeenCalledTimes(1);
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
