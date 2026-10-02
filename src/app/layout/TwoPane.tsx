import { MatchPane } from './MatchPane';
import type { Resolved } from './resolve';

/** Tablet, 768–1199 px (ARCHITECTURE §6): list · match; the player opens as a sheet over the match pane. */
export function TwoPane({ r }: { r: Resolved }) {
  return <MatchPane r={r} sheet />;
}
