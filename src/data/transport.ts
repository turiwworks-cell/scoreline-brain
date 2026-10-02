// The network edge of ApiSource: one conditional GET for `/feed` and one SSE stream for
// `/events`. Kept behind an interface so the sync logic is tested against a fake.

export type FeedResponse =
  | { readonly status: 'ok'; readonly body: unknown; readonly etag?: string }
  | { readonly status: 'not-modified' };

export interface FeedRequest {
  /** Sent as `If-None-Match`. Absent for an unconditional (full) fetch. */
  readonly etag?: string;
  readonly signal: AbortSignal;
}

export interface StreamCallbacks {
  /** Resume point: the id of the last message received, sent back on a new connection. */
  readonly lastEventId?: string;
  onOpen(): void;
  /** One SSE message. `id` is the SSE id, when the message had one. */
  onMessage(data: string, id?: string): void;
  /** The connection failed or dropped. The caller closes the handle and decides when to retry. */
  onError(): void;
}

export interface StreamHandle {
  close(): void;
}

export interface Transport {
  /** Rejects on a network error, an HTTP error or a body that isn't JSON. */
  fetchFeed(request: FeedRequest): Promise<FeedResponse>;
  openStream(callbacks: StreamCallbacks): StreamHandle;
}

export interface HttpTransportOptions {
  readonly feedUrl: string;
  readonly eventsUrl: string;
  readonly fetch?: typeof globalThis.fetch;
  readonly EventSource?: typeof globalThis.EventSource;
}

/**
 * `fetch` + `EventSource`. Reconnecting is ApiSource's job (backoff, jitter, resync), so the
 * native EventSource's own retry is cut off on the first error. A native EventSource can't set
 * the `Last-Event-ID` header on a fresh connection, so the resume point goes in the
 * `lastEventId` query parameter (docs/DATA-CONTRACT.md §3).
 */
export function httpTransport({ feedUrl, eventsUrl, fetch: fetchImpl, EventSource: ES }: HttpTransportOptions): Transport {
  return {
    async fetchFeed({ etag, signal }) {
      const doFetch = fetchImpl ?? globalThis.fetch;
      // no-store: the browser's HTTP cache must not answer for us; we revalidate by hand.
      const res = await doFetch(feedUrl, { headers: etag ? { 'If-None-Match': etag } : {}, signal, cache: 'no-store' });
      if (res.status === 304) return { status: 'not-modified' };
      if (!res.ok) throw new Error(`feed: HTTP ${res.status}`);
      const body: unknown = await res.json();
      const tag = res.headers.get('ETag');
      return tag ? { status: 'ok', body, etag: tag } : { status: 'ok', body };
    },
    openStream({ lastEventId, onOpen, onMessage, onError }) {
      const Impl = ES ?? globalThis.EventSource;
      const url = new URL(eventsUrl, globalThis.location?.href);
      if (lastEventId !== undefined) url.searchParams.set('lastEventId', lastEventId);
      const es = new Impl(url.toString());
      es.onopen = () => onOpen();
      es.onmessage = (e: MessageEvent<string>) => onMessage(e.data, e.lastEventId || undefined);
      es.onerror = () => onError();
      return {
        close() {
          es.onopen = null;
          es.onmessage = null;
          es.onerror = null;
          es.close();
        },
      };
    },
  };
}
