import { expect, test, type Page, type Request } from '@playwright/test';

/*
 * The app over HTTP: `?api` connects the real ApiSource (src/data/apiSource.ts, httpTransport) to
 * the backend stand-in (scripts/mock-api.mjs, started by playwright.config.ts and reached through
 * the preview's /api proxy). The stand-in runs the demo's evening and serves the contract
 * (docs/DATA-CONTRACT.md): `/feed` with an ETag, `/events` over SSE.
 */

const MOCK = 'http://127.0.0.1:8787/api';
const featured = (page: Page) => page.getByRole('button', { name: /France .* Argentina/ }).first();

function watchApi(page: Page) {
  const feeds: Request[] = [];
  const streams: Request[] = [];
  page.on('request', (r) => {
    const path = new URL(r.url()).pathname;
    if (path === '/api/feed') feeds.push(r);
    if (path === '/api/events') streams.push(r);
  });
  return { feeds, streams };
}

test('?api: the list comes from /feed and the stream from /events, through ApiSource', async ({ page }) => {
  const api = watchApi(page);
  const feed = page.waitForResponse((r) => new URL(r.url()).pathname === '/api/feed');
  await page.goto('/?api');
  const first = await feed;
  expect(first.status()).toBe(200);
  expect(first.headers()['etag']).toMatch(/^W\/"\d+"$/);
  // the first feed is unconditional (the stream isn't trusted yet)
  expect(first.request().headers()['if-none-match']).toBeUndefined();
  await expect(featured(page)).toBeVisible();
  await expect(page.getByText('No matches yet.')).toHaveCount(0);
  await expect(page.getByText('Loading the demo…')).toHaveCount(0);
  // one stream, and no demo source in the page
  await expect.poll(() => api.streams.length).toBe(1);
  expect(await page.evaluate(() => performance.getEntriesByType('resource').some((e) => /\/assets\/demo-/.test(e.name)))).toBe(false);
});

test('?api: a goal sent on the stream lands on the board at once', async ({ page, request }, info) => {
  test.skip(info.project.name !== 'phone-390x844', 'one shared backend: one project drives it');
  await page.goto('/?api');
  await expect(featured(page)).toBeVisible();
  const before = await featured(page).getAttribute('aria-label');
  const [, home] = /France (\d+)/.exec(before ?? '') ?? [];
  // the stand-in's trigger: the evening scores, and the event goes out on /events
  const res = await request.post(`${MOCK}/trigger?name=goalHome`);
  expect(res.status()).toBe(200);
  // the followed player's match: a goal there is a scene, even from the list
  await expect(page.getByTestId('moment-scene')).toBeVisible({ timeout: 5000 });
  await page.keyboard.press('Escape');
  await expect(featured(page)).toHaveAccessibleName(new RegExp(`France ${Number(home) + 1}`), { timeout: 5000 });
});

test('?api: polls are conditional once the stream is trusted, and an unchanged feed is a 304', async ({ page, request }, info) => {
  test.skip(info.project.name !== 'phone-390x844', 'a poll is 15 s: once is enough');
  test.setTimeout(60_000);
  const api = watchApi(page);
  await page.goto('/?api');
  await expect(featured(page)).toBeVisible();
  // the stream opening asks for a full feed (the resync, unconditional); once that has landed the
  // stream is trusted, and the next poll (15 s on) carries the ETag it was given
  await expect.poll(() => api.feeds.filter((r) => r.headers()['if-none-match']).length, { timeout: 35_000 }).toBeGreaterThan(0);
  const conditional = api.feeds.find((r) => r.headers()['if-none-match'])!;
  expect(api.feeds.indexOf(conditional)).toBeGreaterThan(0);
  expect(conditional.headers()['if-none-match']).toMatch(/^W\/"\d+"$/);
  const answer = await conditional.response();
  expect([200, 304]).toContain(answer?.status());
  // and the backend answers the current ETag with a 304
  const now = await request.get(`${MOCK}/feed`);
  const etag = now.headers()['etag']!;
  const again = await request.get(`${MOCK}/feed`, { headers: { 'If-None-Match': etag } });
  // an event may land in between; then the ETag has moved on
  expect([304, 200]).toContain(again.status());
  if (again.status() === 200) expect(again.headers()['etag']).not.toBe(etag);
});

test('the backend resumes the stream from Last-Event-ID', async ({ request }, info) => {
  test.skip(info.project.name !== 'phone-390x844', 'no page: once is enough');
  await request.post(`${MOCK}/trigger?name=goalAway`);
  // read what the stream has kept, then ask to resume from just before its last message
  const all = await streamText(`${MOCK}/events?lastEventId=0`);
  const ids = [...all.matchAll(/^id: (\d+)$/gm)].map((m) => Number(m[1]));
  expect(ids.length).toBeGreaterThan(0);
  const last = ids.at(-1)!;
  const resumed = await streamText(`${MOCK}/events`, { 'Last-Event-ID': String(last - 1) });
  const got = [...resumed.matchAll(/^id: (\d+)$/gm)].map((m) => Number(m[1]));
  expect(got[0]).toBe(last);
  // each message is one contract event, with its match's seq where the kind has one
  const data = [...resumed.matchAll(/^data: (.+)$/gm)].map((m) => JSON.parse(m[1]!) as { match: number; kind: string });
  expect(data[0]!.match).toEqual(expect.any(Number));
});

/** The first ~300 ms of an SSE response, as text. */
async function streamText(url: string, headers: Record<string, string> = {}): Promise<string> {
  const ctl = new AbortController();
  const res = await fetch(url, { headers, signal: ctl.signal });
  const reader = res.body!.getReader();
  const dec = new TextDecoder();
  let text = '';
  const stop = setTimeout(() => ctl.abort(), 300);
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      text += dec.decode(value);
    }
  } catch {
    // aborted: that is the end of the sample
  }
  clearTimeout(stop);
  return text;
}
