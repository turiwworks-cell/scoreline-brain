import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { attachedFrame } from './hostBridge';
import { Review } from './Review';
import { fitScale, PHONE, startRoute } from './view';
import type { ReviewFrame, ReviewFrameState, ReviewHost, ReviewWindow } from './protocol';

const origin = window.location.origin;

describe('where the review page starts', () => {
  it('uses the route in the link, else the page that linked here, else the list', () => {
    expect(startRoute('?to=%2Fmatch%2F1%2Flineup', `${origin}/`, origin)).toBe('/match/1/lineup');
    expect(startRoute('', `${origin}/?day=1`, origin)).toBe('/?day=1');
    expect(startRoute('', '', origin)).toBe('/');
    expect(startRoute('', 'https://example.com/?day=1', origin)).toBe('/');
    expect(startRoute('?to=https%3A%2F%2Fexample.com', `${origin}/?day=1`, origin)).toBe('/');
  });
  it('fits the phone whole, and never enlarges it', () => {
    expect(fitScale(1920, 1200)).toBe(1);
    const k = fitScale(1280, 700);
    expect(k).toBeLessThan(1);
    expect((PHONE.h + 20) * k).toBeLessThanOrEqual(700 - 188 + 1);
    expect(fitScale(100, 100)).toBe(0.3);
  });
});

function fakeFrame(initial: Partial<ReviewFrameState> = {}) {
  let state: ReviewFrameState = { ready: true, paused: false, route: '/match/1/facts', ...initial };
  const listeners = new Set<() => void>();
  const frame: ReviewFrame & { set(next: Partial<ReviewFrameState>): void } = {
    state: () => state,
    scene: vi.fn(async (kind) => `${kind} said`),
    pause: vi.fn(() => frame.set({ paused: true })),
    resume: vi.fn(() => frame.set({ paused: false })),
    restart: vi.fn(),
    subscribe(l) {
      listeners.add(l);
      return () => void listeners.delete(l);
    },
    set(next) {
      state = { ...state, ...next };
      listeners.forEach((l) => l());
    },
  };
  return { frame, listeners };
}
const host = () => (window as ReviewWindow).scorelineReviewHost as ReviewHost;

afterEach(cleanup);
beforeEach(() => window.history.replaceState(null, '', '/review.html?to=%2F%3Fday%3D1'));

describe('the review page', () => {
  it('shows the app at the phone’s size, at the route it was opened for', () => {
    render(<Review />);
    const frame = screen.getByTitle('Scoreline on a phone') as HTMLIFrameElement;
    expect(frame.getAttribute('src')).toBe('/?day=1');
    expect([frame.width, frame.height]).toEqual(['390', '844']);
    expect(document.querySelectorAll('iframe')).toHaveLength(1);
  });
  it('keeps the controls off until the app in the frame has its demo, and says it is starting', () => {
    render(<Review />);
    expect((screen.getByRole('button', { name: 'Trigger goal' }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByRole('status').textContent).toMatch(/Starting/);
    const { frame } = fakeFrame();
    act(() => host().attach(frame));
    expect((screen.getByRole('button', { name: 'Trigger goal' }) as HTMLButtonElement).disabled).toBe(false);
    expect((screen.getByRole('button', { name: 'Trigger red card' }) as HTMLButtonElement).disabled).toBe(false);
  });
  it('explains a frame that has no demo', () => {
    render(<Review />);
    act(() => host().attach(fakeFrame({ ready: false }).frame));
    expect((screen.getByRole('button', { name: 'Trigger goal' }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByRole('status').textContent).toMatch(/not running/);
  });
  it('asks the frame for a goal or a red card, and shows what it says', async () => {
    render(<Review />);
    const { frame } = fakeFrame();
    act(() => host().attach(frame));
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Trigger goal' })));
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Trigger red card' })));
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Trigger goal' })));
    expect(vi.mocked(frame.scene).mock.calls.map((c) => c[0])).toEqual(['goal', 'red', 'goal']);
    expect(screen.getByRole('status').textContent).toBe('goal said');
  });
  it('pauses and resumes the one demo, and the button follows its state', () => {
    render(<Review />);
    const { frame } = fakeFrame();
    act(() => host().attach(frame));
    fireEvent.click(screen.getByRole('button', { name: 'Pause' }));
    expect(frame.pause).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Resume' }).getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: 'Resume' }));
    expect(frame.resume).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Pause' }).getAttribute('aria-pressed')).toBe('false');
    // a pause made elsewhere (the frame’s own state changing) shows too
    act(() => frame.set({ paused: true }));
    expect(screen.getByRole('button', { name: 'Resume' })).toBeTruthy();
  });
  it('restarts the evening on request', () => {
    render(<Review />);
    const { frame } = fakeFrame();
    act(() => host().attach(frame));
    fireEvent.click(screen.getByRole('button', { name: 'Restart evening' }));
    expect(frame.restart).toHaveBeenCalledTimes(1);
  });
  it('links back to the ordinary app at the route the frame has reached, and keeps its own address in step', () => {
    render(<Review />);
    expect(screen.getByRole('link', { name: 'Normal view' }).getAttribute('href')).toBe('/?day=1');
    act(() => host().attach(fakeFrame({ route: '/match/1/lineup?live=0' }).frame));
    expect(screen.getByRole('link', { name: 'Normal view' }).getAttribute('href')).toBe('/match/1/lineup?live=0');
    expect(window.location.search).toBe(`?to=${encodeURIComponent('/match/1/lineup?live=0')}`);
  });
  it('listens to the frame only while it is attached, and lets go when it leaves or the page does', () => {
    const view = render(<Review />);
    const { frame, listeners } = fakeFrame();
    act(() => host().attach(frame));
    expect(listeners.size).toBe(1);
    act(() => host().detach(frame));
    expect(listeners.size).toBe(0);
    expect(attachedFrame()).toBeNull();
    // a frame that attaches again (a reload) replaces the old one, with one listener
    const next = fakeFrame();
    act(() => host().attach(frame));
    act(() => host().attach(next.frame));
    expect(next.listeners.size).toBe(1);
    view.unmount();
    expect((window as ReviewWindow).scorelineReviewHost).toBeUndefined();
    expect(next.listeners.size).toBe(0);
  });
  it('is never a page inside a page', () => {
    const real = Object.getOwnPropertyDescriptor(window, 'parent');
    Object.defineProperty(window, 'parent', { configurable: true, value: {} });
    try {
      render(<Review />);
      expect(document.querySelector('iframe')).toBeNull();
      expect((window as ReviewWindow).scorelineReviewHost).toBeUndefined();
    } finally {
      if (real) Object.defineProperty(window, 'parent', real);
      else delete (window as { parent?: unknown }).parent;
    }
  });
});
