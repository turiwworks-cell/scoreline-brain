import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { subscribeSecond, tickerListeners } from './ticker';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

test('a listener that subscribes another during a tick leaves one timer, not two', () => {
  const offs: (() => void)[] = [];
  let added = false;
  offs.push(
    subscribeSecond(() => {
      if (!added) {
        added = true;
        offs.push(subscribeSecond(() => {}));
      }
    }),
  );
  vi.advanceTimersByTime(1000);
  expect(tickerListeners()).toBe(2);
  expect(vi.getTimerCount()).toBe(1);
  for (const off of offs) off();
  expect(vi.getTimerCount()).toBe(0);
});
