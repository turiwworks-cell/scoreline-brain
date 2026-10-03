import type { RiveRuntime } from './types';

/** Coalesced, retryable imports. The import, WASM and two asset buffers are shared. */
export function createLoader(importRuntime: () => Promise<RiveRuntime>) {
  let runtime: Promise<RiveRuntime> | undefined;
  const files = new Map<string, Promise<ArrayBuffer>>();
  return {
    runtime() {
      if (!runtime) runtime = importRuntime().catch((error: unknown) => { runtime = undefined; throw error; });
      return runtime;
    },
    file(source: string) {
      let file = files.get(source);
      if (!file) {
        file = fetch(source).then(async (response) => {
          if (!response.ok) throw new Error(`Rive asset: HTTP ${response.status}`);
          const bytes = await response.arrayBuffer();
          if (bytes.byteLength === 0) throw new Error('Empty Rive asset');
          return bytes;
        }).catch((error: unknown) => { files.delete(source); throw error; });
        files.set(source, file);
      }
      return file;
    },
  };
}

export const riveLoader = createLoader(async () => (await import('./runtime')).loadRuntime());

/** One icon and one word. A stale async mount must not create a third instance. */
export function createSlots(limit = 2) {
  let count = 0;
  return {
    take(): (() => void) | null {
      if (count >= limit) return null;
      count++;
      let released = false;
      return () => { if (!released) { released = true; count--; } };
    },
    get count() { return count; },
  };
}
export const riveSlots = createSlots();
