// Public surface of the domain core.
export * from './types';
export { applyEvent, applyFeed, emptyState, playerKey } from './apply';
export { liveMinute, syncClock, type MatchTime } from './clock';
export { colorOf, feedSchema, liveEventSchema, parseEvent, parseFeed } from './schemas';
export { share } from './share';
