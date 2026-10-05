// Public surface of the domain core.
export * from './types';
export { applyEvent, applyFeed, emptyState, playerKey } from './apply';
export { liveMinute, syncClock, type MatchTime } from './clock';
export { colorOf } from './colorOf';
export { createFeedParser, feedSchema, liveEventSchema, parseEvent, parseFeed } from './schemas';
export { share } from './share';
export { leaders, lineupOf, type Leader } from './leaders';
export { liveMatches } from './live';
export { onPitch, playerFlags, playerStats, type Flags, type PStats } from './playerStats';
export { standings, type LeagueBase, type PriorResult, type StandingRow } from './standings';
export { minLabel, minText, nameOf, plainLine, scoreStr } from './text';
