// The DemoSource the app is running right now, for tools that act on it (the dev panel, Part 16).
// A source registers itself in start() and leaves in stop(), so the panel always drives the same
// instance the store is connected to, never a second one with its own timers.

import type { DemoSource } from './demoSource';

let active: DemoSource | null = null;
const listeners = new Set<() => void>();

export function activeDemoSource(): DemoSource | null {
  return active;
}

export function setActiveDemoSource(source: DemoSource): void {
  active = source;
  listeners.forEach((l) => l());
}

/** Clears the registration, but only if `source` still holds it. */
export function clearActiveDemoSource(source: DemoSource): void {
  if (active !== source) return;
  active = null;
  listeners.forEach((l) => l());
}

/** Calls `listener` when the active source changes. Returns the call that removes it. */
export function subscribeActiveDemoSource(listener: () => void): () => void {
  listeners.add(listener);
  return () => void listeners.delete(listener);
}
