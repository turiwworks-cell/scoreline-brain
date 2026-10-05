// Public surface of the data layer.
export type { EventHandler, FeedHandler, Source, StatusHandler, SyncPhase, SyncStatus } from './source';
export { IDLE_STATUS } from './source';
export { createApiSource, POLL_MS, type ApiSourceOptions } from './apiSource';
export { backoffDelay, DEFAULT_BACKOFF, type BackoffOptions } from './backoff';
export { browserEnvironment, realScheduler, type EnvironmentChange, type Scheduler, type SyncEnvironment } from './environment';
export { httpTransport, type FeedRequest, type FeedResponse, type HttpTransportOptions, type StreamCallbacks, type StreamHandle, type Transport } from './transport';
export { connectSource, type Connection, type SyncTarget } from './sync';
// The demo itself is imported from './demo' (on demand, it is large); reading the URL is cheap.
export { apiMode, demoMode, FAST_SPEED, sourceExpected, type DemoMode } from './demo/mode';
