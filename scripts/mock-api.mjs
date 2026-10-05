/* global console, process, setTimeout, clearTimeout, setInterval, clearInterval, URL */
// A small stand-in for the backend (docs/DATA-CONTRACT.md): the demo's evening (src/data/demo/sim.ts)
// served over HTTP, so the app's real ApiSource can be watched against it (`?api`).
//
//   node scripts/mock-api.mjs [--port 8787] [--speed 1|10] [--seed n]   (npm run api)
//
// GET  /api/feed     the whole feed (feedJson), with an ETag; `If-None-Match` on an unchanged one is a 304.
// GET  /api/events   SSE: one message per live event (messageJson), `id:` the stream's own counter;
//                    `Last-Event-ID` or `?lastEventId=` replays what came after it, if still kept.
// POST /api/trigger?name=goalHome   the dev panel's triggers (DEMO_TRIGGERS), for tests and demos.
// GET  /api/health   200 "ok".
//
// The SSE id is a counter over the whole stream, not one match's `seq`: a resume point has to be
// one number for every match. Each message still carries its match's `seq` (§4).
//
// The simulation is TypeScript; Vite's module loader runs it, so nothing here is a second copy.
import http from 'node:http';
import { createServer as createVite } from 'vite';

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i < 0 ? fallback : process.argv[i + 1];
};
const port = Number(arg('port', process.env.MOCK_API_PORT ?? '8787'));
const speed = Number(arg('speed', '1'));
const seed = arg('seed', undefined);

const vite = await createVite({ configFile: false, logLevel: 'error', appType: 'custom', server: { middlewareMode: true, hmr: false, ws: false }, optimizeDeps: { noDiscovery: true, include: [] } });
const { DemoSim, DEMO_TRIGGERS, TICK_SECONDS } = await vite.ssrLoadModule('/src/data/demo/sim.ts');
const { feedJson, messageJson } = await vite.ssrLoadModule('/src/data/demo/wire.ts');

const TICK_MS = TICK_SECONDS * 1000;
const FIRST_ACT_MS = 1200;
const KEEP = 500;

const sim = new DemoSim(seed === undefined ? {} : { seed: Number(seed) });
let simMs = 0;
let tickDue = TICK_MS;
let actDue = sim.followed ? FIRST_ACT_MS : Infinity;
/**
 * Bumps when the feed's content moves on (an event, a snapshot); the ETag is this. The clocks run
 * on without a bump, as the contract allows: the client runs its own between syncs.
 */
let version = 1;
/** The last KEEP messages, for resumes: [id, json]. */
const log = [];
let lastId = 0;
const clients = new Set();

function publish(out) {
  for (const o of out) {
    if (o.type === 'snapshot') {
      version += 1;
      continue;
    }
    const json = messageJson(o);
    if (!json) continue;
    version += 1;
    lastId += 1;
    const data = JSON.stringify(json);
    log.push([lastId, data]);
    if (log.length > KEEP) log.shift();
    for (const res of clients) res.write(`id: ${lastId}\ndata: ${data}\n\n`);
  }
}

// one timer: the next tick or the followed player's next action, as DemoSource runs it
let timer;
function schedule() {
  const due = Math.min(tickDue, actDue);
  timer = setTimeout(() => {
    simMs = due;
    const out = [];
    if (tickDue <= simMs) {
      out.push(...sim.tick());
      tickDue += TICK_MS;
    }
    if (actDue <= simMs) actDue = sim.followed ? simMs + sim.followStep(out) * 1000 : Infinity;
    publish(out);
    schedule();
  }, Math.max(0, (due - simMs) / speed));
}
schedule();

const send = (res, status, body, headers = {}) => {
  res.writeHead(status, { 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*', ...headers });
  res.end(body);
};

const server = http.createServer((req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost');
  const path = url.pathname.replace(/^\/api/, '');
  if (req.method === 'GET' && path === '/health') return send(res, 200, 'ok');
  if (req.method === 'GET' && path === '/feed') {
    const etag = `W/"${version}"`;
    if (req.headers['if-none-match'] === etag) return send(res, 304, undefined, { ETag: etag });
    return send(res, 200, JSON.stringify(feedJson(sim)), { 'Content-Type': 'application/json', ETag: etag });
  }
  if (req.method === 'GET' && path === '/events') {
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', Connection: 'keep-alive', 'Access-Control-Allow-Origin': '*', 'X-Accel-Buffering': 'no' });
    res.write(': scoreline mock api\nretry: 2000\n\n');
    const from = Number(req.headers['last-event-id'] ?? url.searchParams.get('lastEventId') ?? NaN);
    if (Number.isFinite(from)) for (const [id, data] of log) if (id > from) res.write(`id: ${id}\ndata: ${data}\n\n`);
    clients.add(res);
    const ping = setInterval(() => res.write(': ping\n\n'), 15000);
    req.on('close', () => {
      clearInterval(ping);
      clients.delete(res);
    });
    return undefined;
  }
  if (req.method === 'POST' && path === '/trigger') {
    const name = url.searchParams.get('name');
    if (!DEMO_TRIGGERS.includes(name)) return send(res, 400, `unknown trigger; one of ${DEMO_TRIGGERS.join(', ')}`);
    const out = [];
    const done = sim.trigger(name, out);
    publish(out);
    return send(res, done ? 200 : 409, done ? 'ok' : 'nothing to act on');
  }
  return send(res, 404, 'not found');
});

server.listen(port, '127.0.0.1', () => console.log(`mock api on http://127.0.0.1:${port}/api (speed ${speed})`));
const close = () => {
  clearTimeout(timer);
  for (const res of clients) res.end();
  server.close();
  void vite.close();
  process.exit(0);
};
process.on('SIGINT', close);
process.on('SIGTERM', close);
