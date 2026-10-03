import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { afterPaint } from './afterPaint';

let hidden = false;
let next = 0;
const frames = new Map<number, FrameRequestCallback>();
const idles = new Map<number, IdleRequestCallback>();
const frame = () => { const batch = [...frames.values()]; frames.clear(); batch.forEach((fn) => fn(0)); };
const idle = () => { const batch = [...idles.values()]; idles.clear(); batch.forEach((fn) => fn({ didTimeout: false, timeRemaining: () => 30 })); };
beforeEach(() => {
  frames.clear(); idles.clear(); hidden = false;
  vi.spyOn(document, 'hidden', 'get').mockImplementation(() => hidden);
  vi.stubGlobal('requestAnimationFrame', (fn: FrameRequestCallback) => { frames.set(++next, fn); return next; });
  vi.stubGlobal('cancelAnimationFrame', (id: number) => frames.delete(id));
  vi.stubGlobal('requestIdleCallback', (fn: IdleRequestCallback) => { idles.set(++next, fn); return next; });
  vi.stubGlobal('cancelIdleCallback', (id: number) => idles.delete(id));
});
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });
describe('after first paint', () => {
  it('waits for two frames and an idle slot', () => {
    const run = vi.fn();
    afterPaint(run);
    frame(); expect(run).not.toHaveBeenCalled();
    frame(); expect(run).not.toHaveBeenCalled();
    idle(); expect(run).toHaveBeenCalledTimes(1);
    document.dispatchEvent(new Event('visibilitychange'));
    frame(); frame(); idle(); expect(run).toHaveBeenCalledTimes(1);
  });
  it('holds hidden work, cancels a pending idle and restarts on return', () => {
    hidden = true;
    const run = vi.fn();
    const cancel = afterPaint(run);
    expect(frames.size).toBe(0);
    hidden = false; document.dispatchEvent(new Event('visibilitychange'));
    frame(); frame();
    hidden = true; document.dispatchEvent(new Event('visibilitychange')); idle();
    expect(run).not.toHaveBeenCalled();
    hidden = false; document.dispatchEvent(new Event('visibilitychange'));
    frame(); frame(); idle(); expect(run).toHaveBeenCalledTimes(1);
    cancel();
  });
  it('cancels at either frame and after scheduling idle', () => {
    const run = vi.fn();
    const a = afterPaint(run); a(); frame(); frame(); idle();
    const b = afterPaint(run); frame(); b(); frame(); idle();
    const c = afterPaint(run); frame(); frame(); c(); idle();
    expect(run).not.toHaveBeenCalled();
    expect(frames.size + idles.size).toBe(0);
  });
  it('uses a cancellable timer on browsers without idle callbacks', () => {
    vi.useFakeTimers();
    vi.stubGlobal('requestIdleCallback', undefined);
    const run = vi.fn();
    const cancel = afterPaint(run); frame(); frame(); cancel();
    vi.runAllTimers(); expect(run).not.toHaveBeenCalled();
    afterPaint(run); frame(); frame(); vi.runAllTimers(); expect(run).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });
});
