import type { ComponentType } from 'react';
import type { GoalWordProps } from './GoalWord';

/*
 * The goal word's chunk. React.lazy suspends on the first render even when the import has
 * already finished, and a suspended reveal is held back for a moment: the word mounted half a
 * second into its scene, past its window (wordClock.ts). The preload (preload.ts) fetches it while
 * a match is live; from then on the scene mounts it in its own first commit.
 */

type Module = { default: ComponentType<GoalWordProps & { source: string }> };

let ready: Module | null = null;
const load = () =>
  (import('./WordGraphic') as Promise<Module>).then((m) => {
    ready = m;
    return m;
  });

/** Fetches the chunk in the background; safe to call more than once. */
export function preloadWord(): Promise<Module> {
  return load();
}

/** The loader React.lazy calls: once the chunk is in, a thenable React takes without suspending. */
export function loadWord(): Promise<Module> {
  const m = ready;
  if (m) return { then: (done: (v: Module) => unknown) => done(m) } as unknown as Promise<Module>;
  return load();
}
