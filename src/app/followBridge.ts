import { createDemoSource, type DemoSource, type DemoSourceOptions } from '../data/demo';
import { followPref, type FollowPref } from '../features/matchList/follow/pref';
import { demoFollowed } from './followed';

/** Sync the demo to the stored Follow selection, then every change. Loaded only with the demo. */
export function bridgeFollow(source: Pick<DemoSource, 'follow'>, pref: FollowPref = followPref(demoFollowed())): () => void {
  const sync = () => source.follow(pref.get());
  sync();
  return pref.subscribe(sync);
}

/** Prepare both demo and Follow wiring in the same lazy import, before its first feed. */
export function createFollowedDemo(options: DemoSourceOptions): DemoSource {
  const source = createDemoSource(options);
  bridgeFollow(source);
  return source;
}
