import * as webgl2 from '@rive-app/webgl2';
import wasmURL from '@rive-app/webgl2/rive.wasm?url';
import fallbackURL from '@rive-app/webgl2/rive_fallback.wasm?url';
import type { RiveRuntime } from './types';

/** This entire module is behind loader.ts's dynamic import; WASM stays on our own origin. */
export async function loadRuntime(): Promise<RiveRuntime> {
  webgl2.RuntimeLoader.setWasmUrl(wasmURL);
  webgl2.RuntimeLoader.setWasmFallbackUrl(fallbackURL);
  await webgl2.RuntimeLoader.awaitInstance();
  return webgl2;
}
