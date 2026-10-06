import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { motionValue } from 'motion/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LiveIcon } from './LiveIcon';
import { RiveStartContext } from './startGate';
import LiveGraphic from './LiveGraphic';
import WordGraphic from './WordGraphic';
import type { RiveCanvasProps } from './RiveCanvas';
import type { Property, RiveInstance, ViewModel } from './types';

const mock = vi.hoisted(() => ({ canvas: null as RiveCanvasProps | null, source: null as string | null }));
vi.mock('./RiveCanvas', () => ({ RiveCanvas: (props: RiveCanvasProps) => { mock.canvas = props; return <canvas aria-hidden="true" style={{ pointerEvents: 'none' }} />; } }));
vi.mock('./assets', () => ({ get liveIconSource() { return mock.source; }, momentsSource: null }));

function property<T>(value: T) {
  const listeners = new Set<() => void>();
  const p: Property<T> & { emit(): void; listeners: Set<() => void> } = { value, listeners, on: (fn) => { listeners.add(fn); }, off: (fn) => { listeners.delete(fn); }, emit: () => { for (const fn of listeners) fn(); } };
  return p;
}
function fixture() {
  const live = property(false); const kind = property(''); const c1 = property(0); const c2 = property(0); const phase = property(0); const textCount = property('12');
  const trigger = vi.fn();
  const vm: ViewModel = { boolean: () => live, string: (name) => name === 'count' ? textCount : kind, color: (name) => name === 'color1' ? c1 : c2, number: () => phase, trigger: () => ({ trigger }) };
  const instance: RiveInstance = { stateMachineNames: ['State Machine 1'], viewModelInstance: vm, reset: vi.fn(), play: vi.fn(), pause: vi.fn(), startRendering: vi.fn(), stopRendering: vi.fn(), resizeDrawingSurfaceToCanvas: vi.fn(), cleanup: vi.fn() };
  return { instance, live, kind, c1, c2, phase, trigger, textCount };
}
afterEach(() => { cleanup(); mock.canvas = null; mock.source = null; vi.restoreAllMocks(); });
describe('Live icon binding and hit target', () => {
  it('shows no second Live design: nothing until the art has drawn and settled, the DOM button only if it fails', async () => {
    mock.source = '/rive/live-icon.riv';
    const view = render(<LiveIcon live count={8} onChange={vi.fn()} className="m-glass live" fallback={<span>Live</span>}><span>8</span></LiveIcon>);
    const button = view.getByRole('button', { name: 'Live, 8 in play' });
    // while the art is on its way: the art's box, no glass, no DOM pill, but the art's still with the count
    expect(button.classList.contains('m-glass')).toBe(false);
    expect(view.queryByText('8')).toBeNull(); expect(view.queryByText('Live')).toBeNull();
    const still = () => button.querySelector('[data-live-still]');
    expect([...still()!.querySelectorAll('use')].map((u) => u.getAttribute('href'))).toEqual(['#live-still', '#ld8']);
    // the capsule, not the artboard, is the round button's 40 px (luau:8352)
    expect(parseFloat(button.style.height)).toBe(40);
    expect(parseFloat(button.style.width)).toBeCloseTo((410.5 - 32.5) * 40 / 137.5, 1);
    await waitFor(() => expect(view.container.querySelector('canvas')).not.toBeNull());
    act(() => mock.canvas!.onReady?.());
    // Rive's first frame plays the opening timeline: the art stays hidden through it
    expect(button.getAttribute('data-rive-live')).toBeNull();
    expect(mock.canvas!.style?.opacity).toBe(0);
    expect(still()).not.toBeNull();
    await waitFor(() => expect(button.getAttribute('data-rive-live')).toBe('true'), { timeout: 1500 });
    // Rive takes the still's place in the same frame
    expect(mock.canvas!.style?.opacity).toBe(1);
    expect(still()).toBeNull();
    expect(view.queryByText('8')).toBeNull(); expect(view.queryByText('Live')).toBeNull();
    act(() => mock.canvas!.onError?.(new Error('renderer failed')));
    expect(button.classList.contains('m-glass')).toBe(true);
    expect(view.getByText('8')).toBeTruthy(); expect(view.getByText('Live')).toBeTruthy();
  });
  it('is an empty button until the shell lets Rive start, and the same button after', async () => {
    mock.source = '/rive/live-icon.riv';
    const icon = (start: boolean) => (
      <RiveStartContext.Provider value={start}>
        <LiveIcon live={false} count={4} onChange={vi.fn()} fallback={<span>Live</span>}><span>4</span></LiveIcon>
      </RiveStartContext.Provider>
    );
    const view = render(icon(false));
    const button = view.getByRole('button', { name: 'Live, 4 in play' });
    button.focus();
    // nothing of Rive has been asked for: no graphic chunk, no canvas; and no DOM pill, and with
    // Live off no still either (the still is the art with Live on)
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(view.container.querySelector('canvas')).toBeNull();
    expect(mock.canvas).toBeNull();
    expect(view.queryByText('Live')).toBeNull(); expect(view.queryByText('4')).toBeNull();
    expect(button.querySelector('[data-live-still]')).toBeNull();
    view.rerender(icon(true));
    await waitFor(() => expect(view.container.querySelector('canvas')).not.toBeNull());
    // the artwork starts in the button that was there, still focused
    expect(view.getByRole('button', { name: 'Live, 4 in play' })).toBe(button);
    expect(document.activeElement).toBe(button);
    act(() => mock.canvas!.onReady?.());
    await waitFor(() => expect(button.getAttribute('data-rive-live')).toBe('true'), { timeout: 1500 });
  });
  it('plays the art\'s own timeline on the hover light on every toggle, its clock on Rive\'s first frame', async () => {
    mock.source = '/rive/live-icon.riv';
    const motions: { keyframes: Keyframe[]; duration: number; cancel: ReturnType<typeof vi.fn>; startTime: number | null }[] = [];
    const animate = vi.fn(function (keyframes: Keyframe[], options: KeyframeAnimationOptions) {
      const motion = { keyframes, duration: Number(options.duration), cancel: vi.fn(), startTime: null as number | null };
      motions.push(motion);
      return motion as unknown as Animation;
    });
    Object.defineProperty(HTMLElement.prototype, 'animate', { value: animate, configurable: true, writable: true });
    Object.defineProperty(document, 'timeline', { value: { currentTime: 1000 }, configurable: true });
    try {
      const icon = (live: boolean) => <LiveIcon live={live} count={2} onChange={vi.fn()} lightClassName="light" fallback={<span>Live</span>} />;
      const view = render(icon(false));
      await waitFor(() => expect(view.container.querySelector('canvas')).not.toBeNull());
      act(() => mock.canvas!.onReady?.());
      await waitFor(() => expect(view.container.querySelector('.light')).not.toBeNull(), { timeout: 1500 });
      const light = view.container.querySelector<HTMLElement>('.light')!;
      // the art appears settled: the light has nothing to play
      await new Promise((resolve) => setTimeout(resolve, 40));
      expect(animate).not.toHaveBeenCalled();
      const open = (frame: Keyframe | undefined) => Number(frame?.['--open']);
      view.rerender(icon(true));
      await waitFor(() => expect(motions).toHaveLength(1));
      expect(animate.mock.contexts[0]).toBe(light);
      expect(motions[0]!.startTime).toBe(1000);
      expect(open(motions[0]!.keyframes[0])).toBe(0);
      expect(open(motions[0]!.keyframes.at(-1))).toBe(1);
      view.rerender(icon(false));
      await waitFor(() => expect(motions).toHaveLength(2));
      expect(motions[0]!.cancel).toHaveBeenCalled();
      expect(open(motions[1]!.keyframes[0])).toBe(1);
      expect(open(motions[1]!.keyframes.at(-1))).toBe(0);
      // as small as the round button's light beside it: a 40 px control's, not the 110 px button's
      expect(light.style.getPropertyValue('--spot-r')).toBe('26px');
    } finally {
      delete (HTMLElement.prototype as Partial<HTMLElement>).animate;
      Reflect.deleteProperty(document, 'timeline');
    }
  });
  it('keeps a DOM button, static fallback and controlled pressed state', () => {
    const change = vi.fn();
    const view = render(<LiveIcon live={false} count={3} onChange={change} fallback={<svg aria-hidden="true" />} />);
    const button = view.getByRole('button', { name: 'Live, 3 in play' });
    expect(button.getAttribute('aria-pressed')).toBe('false');
    expect(button.querySelector('svg')).not.toBeNull(); expect(button.querySelector('canvas')).toBeNull();
    fireEvent.click(button); expect(change).toHaveBeenCalledWith(true);
    view.rerender(<LiveIcon live count={4} onChange={change} fallback={<svg />} />);
    expect(button.getAttribute('aria-pressed')).toBe('true');
  });
  it('syncs the URL to islive one way: a late echo from Rive never switches Live back', () => {
    const f = fixture();
    const graphic = render(<LiveGraphic source="/rive/live-icon.riv" count={3} live={false} fallback={<svg />} />);
    expect(mock.canvas!.artboard).toBe('aniamtion');
    const binding = mock.canvas!.bind(f.instance, () => {})!;
    expect(f.live.listeners.size).toBe(0); expect(f.textCount.value).toBe('3');
    graphic.rerender(<LiveGraphic source="/rive/live-icon.riv" count={4} live fallback={<svg />} />);
    expect(f.live.value).toBe(true); expect(f.textCount.value).toBe('4');
    // Rive holding an older value (two quick taps) is overwritten by the app's, never the reverse
    f.live.value = false; f.live.emit();
    binding.resume?.(); expect(f.live.value).toBe(true);
    binding.cleanup?.();
  });
  it('rejects a full button with no dynamic count, keeping the complete DOM fallback', () => {
    const view = render(<LiveGraphic source="/rive/live-icon.riv" count={7} live={false} fallback={<span>Live 7</span>} />);
    const f = fixture();
    const vm = { ...f.instance.viewModelInstance!, string: () => null };
    expect(() => mock.canvas!.bind({ ...f.instance, viewModelInstance: vm }, () => {})).toThrow('String count');
    act(() => mock.canvas!.onError?.(new Error('missing count')));
    expect(view.getByText('Live 7')).toBeTruthy(); expect(view.container.querySelector('canvas')).toBeNull();
    expect(f.live.listeners.size).toBe(0);
  });
  it('fails closed on a missing Boolean contract and keeps the fallback', () => {
    const view = render(<LiveGraphic source="/rive/live-icon.riv" count={3} live={false} fallback={<span>Static live</span>} />);
    const f = fixture(); const invalid = { ...f.instance, viewModelInstance: null };
    expect(() => mock.canvas!.bind(invalid, () => {})).toThrow('islive');
    act(() => mock.canvas!.onError?.(new Error('no WebGL')));
    expect(view.getByText('Static live')).toBeTruthy(); expect(view.container.querySelector('canvas')).toBeNull();
  });
});
describe('goal word View Model contract', () => {
  const props = (time: ReturnType<typeof motionValue<number>>, elapsed: ReturnType<typeof motionValue<number>>, fns: { onPhase: () => void; onBound: () => void; onFallback: () => void }, skipped = false) => (
    <WordGraphic source="/rive/moments.riv" kind="goal" colors={['#123456', '#654321']} time={time} elapsed={elapsed} start={0.1} late={(e) => e >= 0.3} full={4} skipped={skipped} {...fns} fallback={<span>GOAAAL</span>} />
  );
  const mount = () => {
    const f = fixture(); const time = motionValue(0); const elapsed = motionValue(0); const fns = { onPhase: vi.fn(), onBound: vi.fn(), onFallback: vi.fn() };
    const view = render(props(time, elapsed, fns));
    return { ...f, ...fns, time, elapsed, view, rerender: (skipped: boolean) => view.rerender(props(time, elapsed, fns, skipped)) };
  };
  const setup = () => {
    const m = mount();
    const binding = mock.canvas!.bind(m.instance, () => { if (!document.hidden) binding.resume?.(); })!;
    return { ...m, binding };
  };
  it('sets kind and ARGB colors before firing play once on the stage beat', () => {
    const s = setup();
    expect(s.kind.value).toBe('goal'); expect(s.c1.value).toBe(0xff123456); expect(s.c2.value).toBe(0xff654321);
    expect(s.onBound).toHaveBeenCalledTimes(1);
    expect(s.trigger).not.toHaveBeenCalled(); expect(s.binding.shouldPlay?.()).toBe(false);
    act(() => s.time.set(0.1)); expect(s.trigger).toHaveBeenCalledTimes(1);
    act(() => s.time.set(0.2)); expect(s.trigger).toHaveBeenCalledTimes(1);
    s.binding.cleanup?.();
  });
  it('reports phases, freezes the landed word on done, and removes listeners', () => {
    const s = setup(); act(() => s.time.set(0.1));
    s.phase.value = 1; s.phase.emit(); expect(s.onPhase).toHaveBeenCalledWith(1);
    s.phase.value = 2; s.phase.emit(); expect(s.onPhase).toHaveBeenCalledWith(2);
    expect(s.instance.pause).toHaveBeenCalled(); expect(s.instance.stopRendering).toHaveBeenCalled(); expect(s.binding.shouldPlay?.()).toBe(false);
    s.binding.cleanup?.(); expect(s.phase.listeners.size).toBe(0); expect(s.onFallback).toHaveBeenCalled();
  });
  it('falls back at the scene deadline if the phase handshake never arrives', () => {
    const s = setup(); act(() => s.elapsed.set(4));
    expect(s.onFallback).toHaveBeenCalled(); expect(s.view.container.querySelector('canvas')).toBeNull();
    expect(s.trigger).not.toHaveBeenCalled(); s.binding.cleanup?.();
  });
  it('leaves the headline to the DOM word when it is not bound by the deadline', () => {
    const m = mount();
    act(() => m.elapsed.set(0.3));
    expect(m.onFallback).toHaveBeenCalled(); expect(m.view.container.querySelector('canvas')).toBeNull();
    expect(m.view.getByText('GOAAAL')).toBeTruthy(); expect(m.onBound).not.toHaveBeenCalled();
  });
  it('refuses a late binding, so the two words never swap mid-flight', () => {
    const m = mount();
    const canvas = mock.canvas!;
    m.elapsed.set(0.35);
    expect(() => canvas.bind(m.instance, () => {})).toThrow('before the Rive word was ready');
    expect(m.onBound).not.toHaveBeenCalled();
  });
  it('a first tap before it lands shows the DOM word; once landed it stays', () => {
    const a = setup(); act(() => a.time.set(0.1));
    act(() => a.rerender(true));
    expect(a.onFallback).toHaveBeenCalled(); expect(a.view.container.querySelector('canvas')).toBeNull();
    a.binding.cleanup?.(); cleanup();
    const b = setup(); act(() => b.time.set(0.1));
    b.phase.value = 1; b.phase.emit();
    act(() => b.rerender(true));
    expect(b.onFallback).not.toHaveBeenCalled(); expect(b.view.container.querySelector('canvas')).not.toBeNull();
    b.binding.cleanup?.();
  });
  it('does not fire play while hidden and resumes from the current stage time', () => {
    let hidden = true; vi.spyOn(document, 'hidden', 'get').mockImplementation(() => hidden);
    const s = setup(); act(() => s.time.set(0.5)); expect(s.trigger).not.toHaveBeenCalled();
    hidden = false; s.binding.resume?.(); expect(s.trigger).toHaveBeenCalledTimes(1); s.binding.cleanup?.();
  });
});
