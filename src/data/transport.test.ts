import { describe, expect, it, vi } from 'vitest';
import { httpTransport } from './transport';

class FakeES {
  static last: FakeES | undefined;
  onopen: (() => void) | null = null;
  onmessage: ((e: MessageEvent<string>) => void) | null = null;
  onerror: (() => void) | null = null;
  closed = false;
  constructor(readonly url: string) {
    FakeES.last = this;
  }
  close() {
    this.closed = true;
  }
}

const signal = new AbortController().signal;

describe('httpTransport', () => {
  it('sends If-None-Match and reads a 304 as not modified', async () => {
    const fetch = vi.fn(async () => new Response(null, { status: 304 }));
    const t = httpTransport({ feedUrl: 'https://x.test/feed', eventsUrl: 'https://x.test/events', fetch });
    expect(await t.fetchFeed({ etag: '"v1"', signal })).toEqual({ status: 'not-modified' });
    expect(fetch).toHaveBeenCalledWith('https://x.test/feed', { headers: { 'If-None-Match': '"v1"' }, signal, cache: 'no-store' });
  });

  it('returns the body and ETag of a 200, and rejects HTTP errors and non-JSON', async () => {
    const ok = httpTransport({
      feedUrl: '/feed',
      eventsUrl: '/events',
      fetch: async () => new Response('{"version":2}', { status: 200, headers: { ETag: '"v2"' } }),
    });
    expect(await ok.fetchFeed({ signal })).toEqual({ status: 'ok', body: { version: 2 }, etag: '"v2"' });
    const down = httpTransport({ feedUrl: '/feed', eventsUrl: '/events', fetch: async () => new Response('nope', { status: 503 }) });
    await expect(down.fetchFeed({ signal })).rejects.toThrow('503');
    const html = httpTransport({ feedUrl: '/feed', eventsUrl: '/events', fetch: async () => new Response('<html>', { status: 200 }) });
    await expect(html.fetchFeed({ signal })).rejects.toThrow();
  });

  it('resumes the stream with lastEventId and detaches on close', () => {
    const onOpen = vi.fn();
    const onMessage = vi.fn();
    const onError = vi.fn();
    const t = httpTransport({ feedUrl: '/feed', eventsUrl: 'https://x.test/events', EventSource: FakeES as unknown as typeof EventSource });
    const h = t.openStream({ lastEventId: '42', onOpen, onMessage, onError });
    const es = FakeES.last as FakeES;
    expect(es.url).toBe('https://x.test/events?lastEventId=42');
    es.onopen?.();
    es.onmessage?.({ data: '{"a":1}', lastEventId: '43' } as MessageEvent<string>);
    es.onerror?.();
    expect(onOpen).toHaveBeenCalledOnce();
    expect(onMessage).toHaveBeenCalledWith('{"a":1}', '43');
    expect(onError).toHaveBeenCalledOnce();
    h.close();
    expect(es.closed).toBe(true);
    expect(es.onmessage).toBeNull();
  });

  it('opens a first stream without a resume point', () => {
    const t = httpTransport({ feedUrl: '/feed', eventsUrl: 'https://x.test/events', EventSource: FakeES as unknown as typeof EventSource });
    t.openStream({ onOpen() {}, onMessage() {}, onError() {} });
    expect(FakeES.last?.url).toBe('https://x.test/events');
  });
});
