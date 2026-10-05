import type { ComponentType } from 'react';
import type { InsightsProps } from '../../features/insights/Insights';

/*
 * The desktop's Tables / Leaders pane is its own chunk. Loaded on the first switch to it, the
 * switch waited for the download before anything mounted, and only then did the rows' own
 * entrance (motion: squad, 0.3 s in) begin (review of 2026-10-04: "Leaders comes with a lot of
 * delay"). The three-pane layout fetches it once it has painted.
 */

type Module = { default: ComponentType<InsightsProps> };

const load = () => import('../../features/insights/Insights') as Promise<Module>;
let ready: Module | null = null;

/** Fetches the chunk in the background; safe to call more than once. */
export function preloadInsights(): void {
  void load().then((m) => {
    ready = m;
  });
}

/**
 * The loader React.lazy calls on the pane's first render. Once the chunk is in, it hands back a
 * thenable that answers at once, which React takes without suspending; before that, the import.
 */
export function loadInsights(): Promise<Module> {
  const m = ready;
  if (m) return { then: (done: (v: Module) => unknown) => done(m) } as unknown as Promise<Module>;
  return load();
}
