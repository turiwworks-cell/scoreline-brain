import { useEffect, useLayoutEffect, useRef } from 'react';
import { fly, landAll } from '../../motion';
import { takePendingTrigger, triggerFor } from '../nav/focusMemory';
import { planFlights, type Resolved } from './resolve';

/**
 * Runs the shared-element flights for each navigation (resolve.ts plans them, motion/flight.ts
 * flies them). It runs in the shell's layout effect, after the screens have mounted and restored
 * their scroll, before paint: the destination is in place, the leaving screen is still there.
 *
 * Only a change of location flies. New data (the featured match arriving) or a resize doesn't.
 */
export function useSharedFlights(r: Resolved, locationKey: string) {
  const prev = useRef<{ r: Resolved; key: string } | null>(null);

  useLayoutEffect(() => {
    const p = prev.current;
    prev.current = { r, key: locationKey };
    if (!p || p.key === locationKey) return;
    // opening: from inside what was pressed; closing: back into what opened the screen
    const pressed = takePendingTrigger();
    const opener = triggerFor(locationKey);
    for (const plan of planFlights(p.r, r)) {
      fly({ ...plan, fromWithin: plan.direction === 'open' ? pressed : null, toWithin: plan.direction === 'close' ? opener : null });
    }
  }, [r, locationKey]);

  useEffect(() => () => landAll(), []);
}
