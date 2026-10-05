import { useMemo } from 'react';
import { followPref, useFollowed } from '../../features/matchList';
import { useMomentAnnouncement, useMomentView } from '../../motion';
import { selectMatchIdOfTeam, useScoreline } from '../../store';
import { demoFollowed } from '../followed';
import type { Resolved } from './resolve';

/**
 * Runs the app's MomentDirector for the shell's lifetime and tells it what is on screen: the match
 * whose screen is up, whether anything covers it (onTop, luau:7351: the phone's player layer, the
 * tablet's player sheet; the desktop's player pane sits beside it), and the followed player's
 * match. Returns the latest announcement for the shell's aria-live region.
 */
export function useMoments(r: Resolved) {
  const followed = useFollowed(followPref(demoFollowed()));
  const followedMatch = useScoreline(selectMatchIdOfTeam(followed?.team ?? ''));
  const openId = r.match?.id;
  const front = !!r.match && (r.layout === 'three' || !r.player);
  const followedMatchId = followed ? followedMatch : undefined;
  const view = useMemo(() => ({ openId, front, followedMatchId }), [openId, front, followedMatchId]);
  useMomentView(view);
  return useMomentAnnouncement();
}
