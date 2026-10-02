import { act, cleanup, render, screen } from '@testing-library/react';
import { Profiler, useState } from 'react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { MatchClock, type ClockMatch } from './MatchClock';
import { tickerListeners } from './ticker';

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-10-02T20:00:00.000Z'));
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const live = (minute: number, second: number): ClockMatch => ({ status: 'live', clock: { minute, second, at: Date.now() }, kickoff: '20:00' });

test('the clock turns without re-rendering its parent, and renders only when its label changes', () => {
  let parentRenders = 0;
  let clockCommits = 0;
  function Row({ match }: { match: ClockMatch }) {
    parentRenders++;
    return (
      <div>
        <Profiler id="clock" onRender={() => clockCommits++}>
          <MatchClock match={match} data-testid="clock" />
        </Profiler>
      </div>
    );
  }
  render(<Row match={live(58, 40)} />);
  expect(screen.getByTestId('clock').textContent).toBe("58'");
  expect(tickerListeners()).toBe(1);

  act(() => vi.advanceTimersByTime(15_000)); // 58:55, same label
  expect(screen.getByTestId('clock').textContent).toBe("58'");
  expect(clockCommits).toBe(1);

  act(() => vi.advanceTimersByTime(10_000)); // 59:05
  expect(screen.getByTestId('clock').textContent).toBe("59'");
  act(() => vi.advanceTimersByTime(60_000 * 33)); // 92:05
  expect(screen.getByTestId('clock').textContent).toBe("90+2'");

  expect(parentRenders).toBe(1);
  expect(clockCommits).toBe(3);
});

test('a clock that is not live shows FT or the kick-off and never listens', () => {
  const at = Date.now();
  render(
    <>
      <MatchClock match={{ status: 'finished', clock: { minute: 90, second: 0, at }, kickoff: '18:30' }} data-testid="ft" />
      <MatchClock match={{ status: 'scheduled', clock: { minute: 0, second: 0, at }, kickoff: '20:45' }} data-testid="ko" />
    </>,
  );
  expect(screen.getByTestId('ft').textContent).toBe('FT');
  expect(screen.getByTestId('ko').textContent).toBe('20:45');
  expect(tickerListeners()).toBe(0);
});

test('many clocks share one ticker, which stops when the last one goes', () => {
  function Two() {
    const [show, setShow] = useState(true);
    return (
      <>
        <MatchClock match={live(10, 0)} />
        {show && <MatchClock match={live(20, 0)} />}
        <button onClick={() => setShow(false)}>hide</button>
      </>
    );
  }
  const view = render(<Two />);
  expect(tickerListeners()).toBe(2);
  expect(vi.getTimerCount()).toBe(1);
  act(() => screen.getByText('hide').click());
  expect(tickerListeners()).toBe(1);
  view.unmount();
  expect(tickerListeners()).toBe(0);
  expect(vi.getTimerCount()).toBe(0);
});

test('a resynced clock (new match object) re-renders the clock from the new report', () => {
  const { rerender } = render(<MatchClock match={live(58, 40)} data-testid="c" />);
  rerender(<MatchClock match={live(70, 0)} data-testid="c" />);
  expect(screen.getByTestId('c').textContent).toBe("70'");
});
