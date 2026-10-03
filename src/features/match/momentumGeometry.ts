import type { MatchEvent, Team } from '../../domain';
import { sideColors } from './colors';

// Port of luau:4828–4908. These are chart coordinates, independent of the pane width.
export const MOMENTUM_WIDTH = 322;
export const MOMENTUM_HEIGHT = 156;
const MID = MOMENTUM_HEIGHT / 2;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const valueAt = (values: readonly number[], i: number) => Number.isFinite(values[i]) ? values[i]! : 0;
export const minuteX = (minute: number) => clamp(minute, 0, 90) / 90 * MOMENTUM_WIDTH;

export interface MomentumPaths {
  readonly home: string;
  readonly away: string;
  readonly line: string;
  readonly ys: readonly number[];
}

// Structural sharing is the invalidation key, not the clock or the whole match object.
// Weak keys also let old snapshots be collected instead of growing a global chart cache.
const paths = new WeakMap<readonly number[], MomentumPaths>();
export function momentumPaths(values: readonly number[]): MomentumPaths {
  const cached = paths.get(values);
  if (cached) return cached;
  const last = clamp(values.length - 1, 0, 90);
  const xs: number[] = [], ys: number[] = [];
  for (let i = 0; i <= last; i++) {
    let sum = 0, weight = 0;
    for (let j = Math.max(0, i - 2); j <= Math.min(last, i + 2); j++) {
      const w = 3 - Math.abs(j - i);
      sum += valueAt(values, j) * w;
      weight += w;
    }
    xs.push(minuteX(i));
    ys.push(MID - clamp(sum / weight * 1.25, -1, 1) * 0.44 * MOMENTUM_HEIGHT);
  }
  const endX = xs[last]!;
  const home = `M 0 ${MID} ${xs.map((x, i) => `L ${x} ${Math.min(ys[i]!, MID)}`).join(' ')} L ${endX} ${MID} Z`;
  const away = `M 0 ${MID} L ${endX} ${MID} ${xs.map((_, i) => {
    const j = last - i;
    return `L ${xs[j]} ${Math.max(ys[j]!, MID)}`;
  }).join(' ')} Z`;
  const line = xs.map((x, i) => `${i === 0 ? 'M' : 'L'} ${x} ${ys[i]}`).join(' ');
  const result = { home, away, line, ys };
  paths.set(values, result);
  return result;
}

export function pressure(values: readonly number[], minute: number): { share: number; lead: 'home' | 'away' | null } {
  let home = 0, away = 0;
  const end = clamp(Math.floor(minute), 0, 96);
  for (let i = Math.max(0, Math.floor(minute) - 10); i < end; i++) {
    const v = valueAt(values, i);
    if (v > 0) home += v; else away -= v;
  }
  const share = home + away > 0 ? Math.floor(home / (home + away) * 100 + 0.5) : 50;
  return { share, lead: share >= 58 ? 'home' : share <= 42 ? 'away' : null };
}

/** Same contrast fallback as possession in the Lua: away primary → secondary → neutral. */
export function momentumColors(home: Team, away: Team): readonly [string, string] {
  return sideColors(home, away);
}

/** luau:7827–7841, when the provider has no explicit momentum series. */
const derived = new WeakMap<readonly MatchEvent[], Map<number, readonly number[]>>();
export function derivedMomentum(events: readonly MatchEvent[], minute = 95): readonly number[] {
  const end = clamp(Math.floor(minute), 0, 95);
  const cache = derived.get(events) ?? new Map<number, readonly number[]>();
  const cached = cache.get(end);
  if (cached) return cached;
  const pushes = new Map<number, number>();
  for (const e of events) {
    if (e.cancelled) continue;
    const weight = e.kind === 'goal' ? 1.4 : e.kind === 'bigChance' ? 0.9 : e.kind === 'shot' ? 0.6
      : e.kind === 'miss' || e.kind === 'blocked' ? 0.4 : e.kind === 'corner' ? 0.35 : 0;
    pushes.set(e.minute, (pushes.get(e.minute) ?? 0) + (e.side === 'home' ? weight : -weight));
  }
  // End at the synchronized minute, just like the Lua: smoothing must not peek ahead.
  // The ticking leaf clock is never passed here. A new data minute creates a new series.
  const values = [0];
  for (let minute = 1; minute <= end; minute++) values.push(clamp(values[minute - 1]! * 0.82 + (pushes.get(minute) ?? 0) * 0.45, -1, 1));
  cache.set(end, values);
  derived.set(events, cache);
  return values;
}

export function momentumGoals(events: readonly MatchEvent[]): readonly MatchEvent[] {
  return events.filter((e) => e.kind === 'goal' && !e.cancelled).sort((a, b) => a.minute - b.minute);
}
