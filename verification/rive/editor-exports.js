/* global document, location, window, URLSearchParams */
import { Rive } from '@rive-app/webgl2';
import { riveLoader } from '../../src/rive/loader';

// Inspection page only. It loads the actual signed editor export, not the Luau fixture.
await riveLoader.runtime();
const which = new URLSearchParams(location.search).get('asset') === 'live' ? 'live' : 'moments';
const source = which === 'live' ? '/verification/rive/exports/live-icon.original.riv' : '/rive/moments.riv';
const canvas = document.querySelector('#asset');
canvas.style.width = which === 'live' ? '443px' : '390px';
canvas.style.height = which === 'live' ? '152px' : '340px';
const probe = { ready: false, errors: [], phases: [], contents: null, properties: null, bounds: null, advances: 0 };
window.editorProbe = probe;
const buffer = await riveLoader.file(source);
const instance = new Rive({
  canvas, buffer, autoBind: true, autoplay: false, enableRiveAssetCDN: false,
  shouldDisableRiveListeners: true,
  onAdvance: () => { probe.advances++; },
  onLoadError: (error) => { probe.errors.push(String(error)); },
  onLoad() {
    const machine = instance.stateMachineNames[0];
    instance.reset({ stateMachine: machine, autoplay: false, autoBind: true });
    instance.resizeDrawingSurfaceToCanvas();
    const vm = instance.viewModelInstance;
    probe.contents = instance.contents;
    probe.properties = vm?.properties;
    probe.bounds = instance.bounds;
    if (which === 'moments') {
      const p = vm.number('phase');
      p.on(() => { probe.phases.push(p.value); });
    }
    instance.play(machine);
    probe.ready = true;
  },
});
window.editorAsset = {
  play(kind, color1 = 0xff0055a4, color2 = 0xffef4135) {
    const vm = instance.viewModelInstance;
    vm.string('kind').value = kind;
    vm.color('color1').value = color1;
    vm.color('color2').value = color2;
    vm.trigger('play').trigger();
  },
  phase() { return instance.viewModelInstance?.number('phase')?.value; },
  live(value) { instance.viewModelInstance.boolean('islive').value = value; },
  liveValue() { return instance.viewModelInstance?.boolean('islive')?.value; },
  cleanup() { instance.cleanup(); },
};
