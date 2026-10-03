import { RuntimeLoader } from '@rive-app/webgl2';
import { mountCanvas } from '../../src/rive/canvasLifecycle';
import { riveLoader, riveSlots } from '../../src/rive/loader';

// Test entry only. The legacy file is not imported by the production application.
const heap: { runtime?: { HEAPU8?: Uint8Array } } = {};
const probe = {
  bound: 0, cleaned: 0, advances: 0, ready: 0, errors: [] as string[],
  get slots() { return riveSlots.count; },
  get wasmBytes() { return heap.runtime?.HEAPU8?.byteLength ?? null; },
};
declare global { interface Window { riveProbe: typeof probe; } }
window.riveProbe = probe;
await riveLoader.runtime();
heap.runtime = await RuntimeLoader.awaitInstance() as { HEAPU8?: Uint8Array };
const host = document.querySelector<HTMLDivElement>('#canvases')!;
type Mount = ReturnType<typeof mountCanvas>;
function create() {
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'width:120px;height:72px;pointer-events:none';
  canvas.setAttribute('aria-hidden', 'true');
  canvas.tabIndex = -1;
  host.append(canvas);
  const life = mountCanvas(canvas, {
    source: '/legacy/scoreline.riv',
    artboard: 'FOTMOB Live Icon',
    bind: () => {
      probe.bound++;
      return { cleanup: () => { probe.cleaned++; } };
    },
    ready: () => { probe.ready++; },
    error: (error) => { probe.errors.push(String(error)); },
    advance: () => { probe.advances++; },
  });
  return { ...life, dispose() { life.dispose(); canvas.remove(); } };
}
const icon = create();
let scene: Mount | undefined;
document.querySelector('#next')!.addEventListener('click', () => { scene?.dispose(); scene = create(); });
document.querySelector('#close')!.addEventListener('click', () => { scene?.dispose(); scene = undefined; });
document.querySelector('#offscreen')!.addEventListener('click', () => { host.style.transform = host.style.transform ? '' : 'translateY(3000px)'; });
window.addEventListener('pagehide', () => { scene?.dispose(); icon.dispose(); });
