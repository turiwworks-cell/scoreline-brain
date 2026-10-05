// The match clock is computed, not stored: the minute last synced plus the time since.

import type { Clock, Match } from './types';

export interface MatchTime {
  readonly minute: number;
  readonly second: number;
}

/** The clock right now. Only a live match's clock runs. */
export function liveMinute(match: Pick<Match, 'status' | 'clock'>, now: number): MatchTime {
  const { minute, second, at } = match.clock;
  if (match.status !== 'live') return { minute, second };
  const total = minute * 60 + second + Math.max(0, Math.floor((now - at) / 1000));
  return { minute: Math.floor(total / 60), second: total % 60 };
}

/** A clock that already agrees with this is kept, so an on-time sync doesn't change identity. */
const DRIFT_S = 5;

/**
 * The clock after a sync reports `minute:second` at `now`. Returns `prev` (same object) when its
 * projection already agrees: within a few seconds, or, for a source that only sends whole
 * minutes (`second` 0), anywhere inside the reported minute.
 */
export function syncClock(
  prev: Clock | undefined,
  prevStatus: Match['status'] | undefined,
  status: Match['status'],
  minute: number,
  second: number,
  now: number,
): Clock {
  // A clock that wasn't running can't be projected forward: start it from the report.
  if (prev && (status !== 'live' || prevStatus === 'live')) {
    if (status !== 'live') {
      if (prev.minute === minute && prev.second === second) return prev;
    } else {
      const p = liveMinute({ status, clock: prev }, now);
      const projected = p.minute * 60 + p.second;
      const reported = minute * 60 + second;
      const agrees = second === 0 ? p.minute === minute : Math.abs(projected - reported) <= DRIFT_S;
      if (agrees) return prev;
    }
  }
  return { minute, second, at: now };
}
