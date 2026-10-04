import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { motionValue } from 'motion/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LiveIcon } from './LiveIcon';
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
  it('replaces the whole glass button and counter only after native artwork is ready', async () => {
    mock.source = '/rive/live-icon.riv';
    const view = render(<LiveIcon live count={8} onChange={vi.fn()} className="m-glass live" fallback={<span>Live</span>}><span>8</span></LiveIcon>);
    await waitFor(() => expect(view.container.querySelector('canvas')).not.toBeNull());
    const button = view.getByRole('button', { name: 'Live, 8 in play' });
    expect(button.classList.contains('m-glass')).toBe(true);
    act(() => mock.canvas!.onReady?.());
    expect(button.classList.contains('m-glass')).toBe(false);
    expect(button.getAttribute('data-rive-live')).toBe('true');
    expect(view.queryByText('8')).toBeNull(); expect(view.queryByText('Live')).toBeNull();
    // the capsule, not the artboard, is the round button's 40 px (luau:8352)
    expect(parseFloat(button.style.height)).toBe(40);
    expect(parseFloat(button.style.width)).toBeCloseTo((410.5 - 32.5) * 40 / 137.5, 1);
    act(() => mock.canvas!.onError?.(new Error('renderer failed')));
    expect(button.classList.contains('m-glass')).toBe(true);
    expect(view.getByText('8')).toBeTruthy(); expect(view.getByText('Live')).toBeTruthy();
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
  const setup = () => {
    const f = fixture(); const time = motionValue(0); const onPhase = vi.fn(); const onWaiting = vi.fn(); const onFallback = vi.fn();
    const view = render(<WordGraphic source="/rive/moments.riv" kind="goal" colors={['#123456', '#654321']} time={time} start={0.1} full={4} skipped={false} onWaiting={onWaiting} onPhase={onPhase} onFallback={onFallback} fallback={<span>GOAAAL</span>} />);
    const binding = mock.canvas!.bind(f.instance, () => { if (!document.hidden) binding.resume?.(); })!;
    return { ...f, time, onPhase, onWaiting, onFallback, view, binding };
  };
  it('sets kind and ARGB colors before firing play once on the stage beat', () => {
    const s = setup();
    expect(s.kind.value).toBe('goal'); expect(s.c1.value).toBe(0xff123456); expect(s.c2.value).toBe(0xff654321);
    expect(s.trigger).not.toHaveBeenCalled(); expect(s.binding.shouldPlay?.()).toBe(false);
    act(() => s.time.set(0.1)); expect(s.trigger).toHaveBeenCalledTimes(1);
    act(() => s.time.set(0.2)); expect(s.trigger).toHaveBeenCalledTimes(1); expect(s.onWaiting).toHaveBeenCalledTimes(1);
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
    const s = setup(); act(() => s.time.set(4));
    expect(s.onFallback).toHaveBeenCalled(); expect(s.view.container.querySelector('canvas')).toBeNull();
    expect(s.trigger).not.toHaveBeenCalled(); s.binding.cleanup?.();
  });
  it('does not fire play while hidden and resumes from the current stage time', () => {
    let hidden = true; vi.spyOn(document, 'hidden', 'get').mockImplementation(() => hidden);
    const s = setup(); act(() => s.time.set(0.5)); expect(s.trigger).not.toHaveBeenCalled();
    hidden = false; s.binding.resume?.(); expect(s.trigger).toHaveBeenCalledTimes(1); s.binding.cleanup?.();
  });
});
