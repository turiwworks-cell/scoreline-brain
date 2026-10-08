import { sourceExpected } from '../data';
import type { DemoSource } from '../data/demo';
import { followPref, type FollowPref } from '../features/matchList/follow/pref';

// the player followed until prefs exist: the demo follows Argentina's 10 (DemoSource, luau:8915),
// and so does the mock API, which runs the same evening
export const DEMO_FOLLOWED = { team: 'arg', n: 10 };

/** The player followed before anyone has been chosen: the demo's, or nobody. */
export const demoFollowed = () => (sourceExpected(window.location.search) ? DEMO_FOLLOWED : null);

/**
 * Keeps the demo's simulation on the player the user follows: whoever is chosen in the picker or
 * on a player's page, and whoever was chosen last visit, is the one whose acts the card is told.
 * Returns the call that lets go.
 */
export function bridgeFollow(source: Pick<DemoSource, 'follow'>, pref: FollowPref = followPref(demoFollowed())): () => void {
  const sync = () => source.follow(pref.get());
  sync();
  return pref.subscribe(sync);
}
