/* global document, window */
import { Rive } from '@rive-app/webgl2';
import { riveLoader } from '../../src/rive/loader';

await riveLoader.runtime();
const artboard = 'aniamtion';
const source = '/verification/rive/exports/live-icon.candidate.riv';
const canvas = document.querySelector('#asset');
canvas.style.width = '443px'; canvas.style.height = '152px';
const probe = { ready: false, errors: [], properties: null, contents: null, bounds: null, selectedArtboard: artboard };
window.editorProbe = probe;
const buffer = await riveLoader.file(source);
const instance = new Rive({
  canvas, buffer, artboard, autoBind: true, autoplay: false,
  enableRiveAssetCDN: false, shouldDisableRiveListeners: true,
  onLoadError(error) { probe.errors.push(String(error)); },
  onLoad() {
    const machine = instance.stateMachineNames[0];
    instance.reset({ artboard, stateMachine: machine, autoplay: false, autoBind: true });
    instance.resizeDrawingSurfaceToCanvas();
    probe.contents = instance.contents;
    probe.properties = instance.viewModelInstance?.properties;
    probe.bounds = instance.bounds;
    instance.play(machine);
    probe.ready = true;
  },
});
window.editorAsset = {
  live(value) { instance.viewModelInstance.boolean('islive').value = value; },
  liveValue() { return instance.viewModelInstance?.boolean('islive')?.value; },
  count(value) { instance.viewModelInstance.string('count').value = value; },
  countValue() { return instance.viewModelInstance?.string('count')?.value; },
  cleanup() { instance.cleanup(); },
};
