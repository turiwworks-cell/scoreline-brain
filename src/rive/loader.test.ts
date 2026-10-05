import { describe, expect, it, vi } from 'vitest';
import { createLoader, createSlots } from './loader';
import type { RiveRuntime } from './types';

describe('Rive lazy loader', () => {
  it('does not import on construction and coalesces concurrent runtime requests', async () => {
    const runtime = {} as RiveRuntime;
    const load = vi.fn(async () => runtime);
    const loader = createLoader(load);
    expect(load).not.toHaveBeenCalled();
    const first = loader.runtime();
    expect(loader.runtime()).toBe(first);
    expect(await first).toBe(runtime);
    expect(load).toHaveBeenCalledTimes(1);
  });
  it('retries a rejected import', async () => {
    const load = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue({});
    const loader = createLoader(load);
    await expect(loader.runtime()).rejects.toThrow('offline');
    await expect(loader.runtime()).resolves.toEqual({});
    expect(load).toHaveBeenCalledTimes(2);
  });
  it('shares one file fetch and evicts failed file requests', async () => {
    const bytes = new Uint8Array([82, 73, 86, 69]).buffer;
    const fetcher = vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true, arrayBuffer: async () => bytes } as Response);
    const loader = createLoader(vi.fn());
    const a = loader.file('/rive/a.riv');
    expect(loader.file('/rive/a.riv')).toBe(a);
    expect(await a).toBe(bytes);
    expect(fetcher).toHaveBeenCalledTimes(1);
    fetcher.mockResolvedValueOnce({ ok: false, status: 404 } as Response);
    await expect(loader.file('/rive/missing.riv')).rejects.toThrow('404');
    expect(await loader.file('/rive/missing.riv')).toBe(bytes);
    fetcher.mockRestore();
  });
  it('rejects an empty asset without caching it', async () => {
    const fetcher = vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true, arrayBuffer: async () => new ArrayBuffer(0) } as Response);
    const loader = createLoader(vi.fn());
    await expect(loader.file('/rive/empty.riv')).rejects.toThrow('Empty');
    await expect(loader.file('/rive/empty.riv')).rejects.toThrow('Empty');
    expect(fetcher).toHaveBeenCalledTimes(2);
    fetcher.mockRestore();
  });
  it('holds at most two leases and release is idempotent', () => {
    const slots = createSlots();
    const a = slots.take()!;
    const b = slots.take()!;
    expect(slots.take()).toBeNull();
    a(); a();
    expect(slots.count).toBe(1);
    const c = slots.take()!;
    expect(slots.count).toBe(2);
    b(); c();
    expect(slots.count).toBe(0);
  });
});
