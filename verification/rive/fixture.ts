import { RuntimeLoader } from '@rive-app/webgl2';
import { mountCanvas } from '../../src/rive/canvasLifecycle';
import { liveIconSource, momentsSource } from '../../src/rive/assets';
import { riveLoader, riveSlots } from '../../src/rive/loader';

// Test entry only. The production app never imports this page.
const heap: { runtime?: { HEAPU8?: Uint8Array } } = {};
const probe = {
  pendingAssets: !momentsSource,
  diagnosticIcon: !liveIconSource,
  bound: 0, cleaned: 0, advances: 0, ready: 0, landed: 0, completed: 0, errors: [] as string[],
  get slots() { return riveSlots.count; },
  get wasmBytes() { return heap.runtime?.HEAPU8?.byteLength ?? null; },
};
declare global { interface Window { riveProbe: typeof probe; } }
window.riveProbe = probe;
async function main() {
  if (!momentsSource) return;
  const iconSource = liveIconSource ?? '/verification/rive/exports/live-icon.original.riv';
  const wordSource = momentsSource;
  await riveLoader.runtime();
  heap.runtime = await RuntimeLoader.awaitInstance() as { HEAPU8?: Uint8Array };
  const host = document.querySelector<HTMLDivElement>('#canvases')!;
  type Mount = ReturnType<typeof mountCanvas>;
  function create(source: string, goal: boolean, kindValue = 'goal') {
    const canvas = document.createElement('canvas');
    canvas.style.cssText = 'width:120px;height:72px;pointer-events:none';
    canvas.setAttribute('aria-hidden', 'true');
    canvas.tabIndex = -1;
    host.append(canvas);
    const life = mountCanvas(canvas, {
      source,
      artboard: goal ? undefined : 'aniamtion',
      bind: (instance) => {
        const vm = instance.viewModelInstance;
        if (!vm) throw new Error('Part 20 asset has no default View Model');
        probe.bound++;
        if (!goal) {
          const live = vm.boolean('islive');
          if (!live) throw new Error('Live icon has no islive');
          const count = vm.string('count');
          if (!probe.diagnosticIcon && !count) throw new Error('Production Live icon has no count');
          if (count) count.value = '12';
          live.value = true;
          return { cleanup: () => { probe.cleaned++; } };
        }
        const kind = vm.string('kind'), c1 = vm.color('color1'), c2 = vm.color('color2');
        const phase = vm.number('phase'), play = vm.trigger('play');
        if (!kind || !c1 || !c2 || !phase || !play) throw new Error('Moments View Model contract is incomplete');
        kind.value = kindValue; c1.value = 0xff123456; c2.value = 0xff654321; phase.value = 0;
        let played = false, landed = false, done = false;
        const changed = () => {
          if (phase.value === 1 && !landed) { landed = true; probe.landed++; }
          if (phase.value === 2 && !done) { probe.completed++; done = true; instance.pause(); instance.stopRendering(); }
        };
        phase.on(changed);
        return {
          shouldPlay: () => !done,
          resume: () => { if (!played) { played = true; play.trigger(); } },
          cleanup: () => { phase.off(changed); probe.cleaned++; },
        };
      },
      ready: () => { probe.ready++; },
      error: (error) => { probe.errors.push(String(error)); },
      advance: () => { probe.advances++; },
    });
    return { ...life, dispose() { life.dispose(); canvas.remove(); } };
  }
  const icon = create(iconSource, false);
  let scene: Mount | undefined;
  let sceneIndex = 0;
  document.querySelector('#next')!.addEventListener('click', () => { scene?.dispose(); scene = create(wordSource, true, sceneIndex++ % 2 === 0 ? 'goal' : 'red'); });
  document.querySelector('#close')!.addEventListener('click', () => { scene?.dispose(); scene = undefined; });
  document.querySelector('#offscreen')!.addEventListener('click', () => { host.style.transform = host.style.transform ? '' : 'translateY(3000px)'; });
  window.addEventListener('pagehide', () => { scene?.dispose(); icon.dispose(); });
}
void main();
