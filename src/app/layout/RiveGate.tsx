import { useEffect, type ReactNode } from 'react';
import { demoMode } from '../../data';
import { preloadRive } from '../../rive/preload';
import { RiveStartContext, useRiveStartAfter } from '../../rive/startGate';
import { selectLiveMatchIds, selectLoaded, useScoreline } from '../../store';

/** Whether any data is on its way: no ApiSource is wired yet (Part 22), so without ?demo nothing will arrive. */
const dataExpected = () => typeof window !== 'undefined' && demoMode(window.location.search) !== null;

/**
 * Holds Rive back until the first data is drawn and painted (rive/startGate.ts), then warms it. A
 * page with no data on its way has nothing to wait for: the gate opens once its first frame has
 * painted, as Rive started before the gate existed.
 *
 * The gate's state lives here, not in the shell: opening it re-renders this component and the
 * Live button that reads it, and nothing else. `children` are the same elements as before, so
 * React leaves them alone. In the shell the latch was a whole-app render (the header, the day
 * tabs and every row) in a task of its own, just after the first data had painted.
 */
export function RiveGate({ children, waitForData = dataExpected() }: { children: ReactNode; waitForData?: boolean }) {
  const hasLiveMatch = useScoreline(selectLiveMatchIds).length > 0;
  const loaded = useScoreline(selectLoaded);
  const open = useRiveStartAfter(loaded || !waitForData);
  useEffect(() => (open ? preloadRive(hasLiveMatch) : undefined), [open, hasLiveMatch]);
  return <RiveStartContext.Provider value={open}>{children}</RiveStartContext.Provider>;
}
