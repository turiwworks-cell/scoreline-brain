import { useCallback } from 'react';
import { followPref, useFollowed } from '../../features/matchList';
import { MomentStage, type StageSlot } from '../../features/moments';
import { demoFollowed } from '../followed';
import { useNav } from '../nav/useNav';

/**
 * Where the toast and the scenes play (Part 18): the shell mounts one per layout slot and gives
 * the stage the navigation (a tapped toast opens its match) and the followed player (his star).
 */
export function Stage({ slot }: { slot: StageSlot }) {
  const nav = useNav();
  const followed = useFollowed(followPref(demoFollowed()));
  const openMatch = useCallback((id: number) => nav.openMatch(id, { from: null }), [nav]);
  const isFollowed = useCallback((team: string, n: number) => !!followed && followed.team === team && followed.n === n, [followed]);
  return <MomentStage slot={slot} onOpenMatch={openMatch} isFollowed={isFollowed} />;
}
