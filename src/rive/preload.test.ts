import { beforeEach, describe, expect, it, vi } from 'vitest';
import { preloadRive } from './preload';

const mock = vi.hoisted(() => ({
  paints: [] as (() => void)[],
  warm: vi.fn(), free: vi.fn(), word: vi.fn(), runtime: vi.fn(), file: vi.fn(),
}));
vi.mock('./afterPaint', () => ({ afterPaint: (fn: () => void) => {
  mock.paints.push(fn);
  return () => { mock.paints = mock.paints.filter((p) => p !== fn); };
} }));
vi.mock('./assets', () => ({ liveIconSource: '/rive/live-icon.riv', momentsSource: '/rive/moments.riv' }));
vi.mock('./wordStage', () => ({ warmWord: mock.warm, freeWord: mock.free }));
vi.mock('./wordChunk', () => ({ preloadWord: mock.word }));
vi.mock('./loader', () => ({ riveLoader: { runtime: mock.runtime, file: mock.file } }));

beforeEach(() => { mock.paints = []; vi.clearAllMocks(); });

describe('lazy warm word ownership', () => {
  it('warms after paint and frees the loaded stage when the live match goes away', async () => {
    const dispose = preloadRive(true);
    expect(mock.warm).not.toHaveBeenCalled();
    mock.paints.splice(0).forEach((paint) => paint());
    await vi.waitFor(() => expect(mock.warm).toHaveBeenCalledWith('/rive/moments.riv'));
    expect(mock.word).toHaveBeenCalledTimes(1);
    dispose();
    expect(mock.free).toHaveBeenCalledTimes(1);
  });

  it('does not create a stage after the owner goes away while its chunk is loading', async () => {
    const dispose = preloadRive(true);
    mock.paints.splice(0).forEach((paint) => paint());
    dispose();
    await import('./wordStage');
    await Promise.resolve();
    expect(mock.warm).not.toHaveBeenCalled();
    expect(mock.free).not.toHaveBeenCalled();
  });
});
