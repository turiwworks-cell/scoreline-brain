import { describe, expect, it } from 'vitest';
import { liveMinute, syncClock } from './clock';

const T0 = 1_760_000_000_000;

describe('liveMinute', () => {
  it('runs a live clock from its last sync', () => {
    expect(liveMinute({ status: 'live', clock: { minute: 64, second: 20, at: T0 } }, T0 + 75_500)).toEqual({ minute: 65, second: 35 });
  });

  it('holds a clock that is not running', () => {
    expect(liveMinute({ status: 'finished', clock: { minute: 94, second: 0, at: T0 } }, T0 + 600_000)).toEqual({ minute: 94, second: 0 });
  });
});

describe('syncClock', () => {
  const clock = { minute: 64, second: 20, at: T0 };

  it('keeps a clock that already agrees', () => {
    expect(syncClock(clock, 'live', 'live', 64, 35, T0 + 15_000)).toBe(clock);
    expect(syncClock(clock, 'live', 'live', 64, 0, T0 + 15_000)).toBe(clock);
  });

  it('resyncs a clock that drifted', () => {
    expect(syncClock(clock, 'live', 'live', 66, 10, T0 + 15_000)).toEqual({ minute: 66, second: 10, at: T0 + 15_000 });
  });

  it('starts fresh when the match goes live', () => {
    const idle = { minute: 0, second: 0, at: T0 - 3_600_000 };
    expect(syncClock(idle, 'scheduled', 'live', 0, 0, T0)).toEqual({ minute: 0, second: 0, at: T0 });
  });
});
