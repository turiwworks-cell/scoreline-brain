import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { createDemoSource, DEMO_TRIGGERS, TICK_MS, type DemoSource } from '../data/demo';
import { activeDemoSource } from '../data/demo/active';
import { FakeScheduler } from '../data/testing/fakes';
import { MOTION_DEF, motionTokens, resetMotion, TIMING_DEF } from '../motion';
import { mountDevPanel, unmountDevPanel } from './bootstrap';
import { DevPanel } from './DevPanel';
import { tokensJson } from './motionEdit';

let scheduler: FakeScheduler;
let source: DemoSource;
let events: string[];

beforeEach(() => {
  scheduler = new FakeScheduler();
  source = createDemoSource({ scheduler, autoGoals: false, seed: 2026 });
  events = [];
  source.start(
    () => events.push('feed'),
    (e) => events.push(e.kind),
  );
});
afterEach(() => {
  cleanup();
  unmountDevPanel();
  source.stop();
  resetMotion();
  vi.restoreAllMocks();
});

const open = () => fireEvent.click(screen.getByRole('button', { name: 'Dev' }));
const field = (label: string) => screen.getByLabelText(label) as HTMLInputElement;

test('is collapsed until opened, with a keyboard-operable toggle that Escape closes', () => {
  render(<DevPanel />);
  const toggle = screen.getByRole('button', { name: 'Dev' });
  expect(toggle.getAttribute('aria-expanded')).toBe('false');
  expect(screen.queryByRole('region', { name: 'Dev panel' })).toBeNull();
  open();
  expect(toggle.getAttribute('aria-expanded')).toBe('true');
  expect(screen.getByRole('region', { name: 'Dev panel' })).toBeTruthy();
  fireEvent.keyDown(window, { key: 'Escape' });
  expect(toggle.getAttribute('aria-expanded')).toBe('false');
});

test('the seven trigger buttons fire the app’s own DemoSource', () => {
  render(<DevPanel />);
  open();
  expect(activeDemoSource()).toBe(source);
  for (const name of DEMO_TRIGGERS) {
    const before = events.length;
    fireEvent.click(screen.getByRole('button', { name }));
    expect(events.length, name).toBeGreaterThan(before);
  }
  expect(events).toContain('goal');
  expect(events).toContain('red');
  expect(events).toContain('fulltime');
});

test('says so when a trigger had nothing to act on', () => {
  render(<DevPanel />);
  open();
  fireEvent.click(screen.getByRole('button', { name: 'fullTime' }));
  fireEvent.click(screen.getByRole('button', { name: 'fullTime' }));
  expect(screen.getAllByRole('status').some((s) => s.textContent === 'fullTime: nothing to act on right now')).toBe(true);
});

test('pause and resume drive the same source without adding timers', () => {
  render(<DevPanel />);
  open();
  expect(scheduler.pending).toBe(1);
  fireEvent.click(screen.getByRole('button', { name: 'Pause' }));
  expect(source.paused).toBe(true);
  expect(scheduler.pending).toBe(0);
  fireEvent.click(screen.getByRole('button', { name: 'Resume' }));
  expect(source.paused).toBe(false);
  expect(scheduler.pending).toBe(1);
  const feeds = events.filter((e) => e === 'feed').length;
  fireEvent.click(screen.getByRole('button', { name: 'Restart evening' }));
  expect(events.filter((e) => e === 'feed').length).toBe(feeds + 1);
  expect(scheduler.pending).toBe(1);
  act(() => scheduler.advance(TICK_MS));
  expect(scheduler.pending).toBe(1);
});

test('without a demo the controls are disabled and say how to start one', () => {
  source.stop();
  render(<DevPanel />);
  open();
  expect(screen.getByText(/No demo is running/)).toBeTruthy();
  for (const name of DEMO_TRIGGERS) expect((screen.getByRole('button', { name }) as HTMLButtonElement).disabled).toBe(true);
});

test('picks up a source that starts after the panel mounted, and drops one that stops', () => {
  source.stop();
  render(<DevPanel />);
  open();
  expect((screen.getByRole('button', { name: 'goalHome' }) as HTMLButtonElement).disabled).toBe(true);
  act(() => source.start(() => {}, () => {}));
  expect((screen.getByRole('button', { name: 'goalHome' }) as HTMLButtonElement).disabled).toBe(false);
  act(() => source.stop());
  expect((screen.getByRole('button', { name: 'goalHome' }) as HTMLButtonElement).disabled).toBe(true);
});

test('editing a token changes motionTokens(); bad values are refused and flagged; reset restores the defaults', () => {
  render(<DevPanel />);
  open();
  fireEvent.change(field('dur s'), { target: { value: '1.25' } });
  expect(motionTokens().timing.cards.dur).toBe(1.25);
  fireEvent.change(field('y1'), { target: { value: '1.4' } });
  expect(motionTokens().timing.cards.ease[1]).toBe(1.4);
  expect(motionTokens().timing.cards.ease[0]).toBe(TIMING_DEF.cards.ease[0]);
  fireEvent.change(field('speed ×'), { target: { value: '2' } });
  expect(motionTokens().speed).toBe(2);

  // refused: out of range, empty, not a number
  fireEvent.change(field('x1'), { target: { value: '1.5' } });
  expect(field('x1').getAttribute('aria-invalid')).toBe('true');
  expect(motionTokens().timing.cards.ease[0]).toBe(TIMING_DEF.cards.ease[0]);
  fireEvent.change(field('dur s'), { target: { value: '0' } });
  expect(field('dur s').getAttribute('aria-invalid')).toBe('true');
  expect(motionTokens().timing.cards.dur).toBe(1.25);
  fireEvent.change(field('delay s'), { target: { value: '' } });
  expect(motionTokens().timing.cards.delay).toBe(TIMING_DEF.cards.delay);
  fireEvent.change(field('x1'), { target: { value: '0.5' } });
  expect(field('x1').getAttribute('aria-invalid')).toBeNull();

  // switching section shows that section's numbers
  fireEvent.change(screen.getByLabelText('section'), { target: { value: 'player' } });
  expect(field('dur s').value).toBe(String(TIMING_DEF.player.dur));

  fireEvent.click(screen.getByRole('button', { name: 'Reset tokens' }));
  expect(motionTokens().timing).toEqual(TIMING_DEF);
  expect(motionTokens().speed).toBe(MOTION_DEF.speed);
  expect(field('speed ×').value).toBe('1');
  expect(screen.getAllByRole('status').some((s) => s.textContent === 'Reset to the approved values')).toBe(true);
});

test('the approved defaults are untouched by merely opening the panel', () => {
  render(<DevPanel />);
  open();
  expect(motionTokens().timing).toEqual(TIMING_DEF);
});

test('Copy as JSON puts the current tokens on the clipboard and says so; failure is reported', async () => {
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
  render(<DevPanel />);
  open();
  fireEvent.change(field('dur s'), { target: { value: '2' } });
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Copy as JSON' })));
  const copied = JSON.parse(writeText.mock.calls[0]?.[0] as string);
  expect(copied.timing.cards).toEqual({ dur: 2, delay: 0.1, stagger: 0.06, ease: [0.16, 1, 0.3, 1] });
  expect(copied).toMatchObject({ speed: 1, toastHold: 4.5, goalHold: 7.5 });
  expect(Object.keys(copied.timing)).toHaveLength(14);
  expect(screen.getAllByRole('status').some((s) => s.textContent === 'Copied JSON')).toBe(true);

  writeText.mockRejectedValue(new Error('denied'));
  document.execCommand = vi.fn().mockReturnValue(false);
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Copy as JSON' })));
  expect(screen.getAllByRole('status').some((s) => /Copy failed/.test(s.textContent ?? ''))).toBe(true);
});

test('tokensJson of the defaults round-trips the approved values', () => {
  expect(JSON.parse(tokensJson())).toEqual({ ...MOTION_DEF, timing: Object.fromEntries(Object.entries(TIMING_DEF).map(([k, d]) => [k, { ...d, ease: [...d.ease] }])) });
});

test('mounting twice adds one panel; unmounting removes it and its listeners', () => {
  const removeSpy = vi.spyOn(window, 'removeEventListener');
  let off = () => {};
  act(() => {
    off = mountDevPanel();
    mountDevPanel();
  });
  expect(document.querySelectorAll('#dev-panel-root')).toHaveLength(1);
  fireEvent.click(screen.getByRole('button', { name: 'Dev' }));
  act(() => off());
  expect(document.querySelector('#dev-panel-root')).toBeNull();
  expect(removeSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
  // nothing is left listening to the source
  expect(() => source.pause()).not.toThrow();
});
