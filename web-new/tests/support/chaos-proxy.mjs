// Flaky-mobile-network simulator. Sits in front of an origin (e.g. tests/support/range-server.mjs)
// and, per request, injects the failures phones actually see. Deterministic: a seeded RNG, so a
// failing run can be reproduced exactly.
//
// usage: node tests/support/chaos-proxy.mjs <listenPort> <targetPort> [profile=flaky] [seed=1]
// change profile at runtime:  GET /__chaos?profile=clean|flaky|brutal|offline|hang
// read counters:              GET /__chaos/stats
//
// Fault kinds:
//   reset-early  destroy the socket before any response (fetch -> TypeError, like a dropped radio)
//   reset-mid    send headers + part of the body, then destroy (short read)
//   stall        send headers + a little body, then go silent for 25 s (beats a 15 s idle timeout)
//   http-503     a 503 with CORS headers (server/edge hiccup)
//   http-429     a 429 (rate limited)
//   latency      1–3 s delay before forwarding normally (slow cell, not a failure)
import http from 'node:http';

const [, , listenArg, targetArg, profileArg = 'flaky', seedArg = '1'] = process.argv;
const LISTEN = Number(listenArg);
const TARGET = Number(targetArg);

const PROFILES = {
  clean: [],
  // ~35% of requests misbehave; most are survivable with retries.
  flaky: [['latency', 0.15], ['reset-early', 0.06], ['reset-mid', 0.06], ['http-503', 0.05], ['stall', 0.02], ['http-429', 0.01]],
  // Half the requests fail outright.
  brutal: [['reset-early', 0.15], ['reset-mid', 0.15], ['http-503', 0.12], ['stall', 0.05], ['latency', 0.1], ['http-429', 0.03]],
  offline: [['reset-early', 1]],
  // Accept the request and never answer or close: a round that stays alive with no bytes moving,
  // the way a locked phone on battery saver held one at 10% overnight.
  hang: [['hang', 1]],
  // Every request 1-3 s late but healthy: a slow download that keeps moving.
  slow: [['latency', 1]],
};
let profile = profileArg;

// mulberry32: tiny seeded RNG
let seed = Number(seedArg) >>> 0;
const rand = () => {
  seed = (seed + 0x6d2b79f5) >>> 0;
  let t = seed;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
function pickFault() {
  let r = rand();
  for (const [kind, p] of PROFILES[profile] ?? []) {
    if (r < p) return kind;
    r -= p;
  }
  return null;
}

const stats = { requests: 0, faults: {} };
const cors = { 'Access-Control-Allow-Origin': '*' };

http
  .createServer((req, res) => {
    const url = new URL(req.url, 'http://x');
    if (url.pathname === '/__chaos') {
      if (url.searchParams.get('profile')) profile = url.searchParams.get('profile');
      res.writeHead(200, { ...cors, 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ profile }));
    }
    if (url.pathname === '/__chaos/stats') {
      res.writeHead(200, { ...cors, 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ profile, ...stats }));
    }
    stats.requests++;
    const fault = req.method === 'OPTIONS' ? null : pickFault();
    if (fault) stats.faults[fault] = (stats.faults[fault] ?? 0) + 1;

    if (fault === 'reset-early') return req.socket.destroy();
    if (fault === 'hang') return; // silent forever
    if (fault === 'http-503' || fault === 'http-429') {
      res.writeHead(fault === 'http-503' ? 503 : 429, cors);
      return res.end('chaos');
    }

    const forward = () => {
      const upstream = http.request({ host: '127.0.0.1', port: TARGET, path: req.url, method: req.method, headers: req.headers }, (up) => {
        res.writeHead(up.statusCode ?? 502, up.headers);
        if (fault === 'reset-mid' || fault === 'stall') {
          const cutAt = Math.max(1, Math.floor(Number(up.headers['content-length'] ?? 1000) * (0.1 + rand() * 0.5)));
          let sent = 0;
          up.on('data', (chunk) => {
            if (sent >= cutAt) return;
            const part = chunk.subarray(0, Math.min(chunk.length, cutAt - sent));
            sent += part.length;
            res.write(part);
            if (sent >= cutAt) {
              up.destroy();
              if (fault === 'reset-mid') req.socket.destroy();
              else setTimeout(() => req.socket.destroy(), 25_000); // silent stall, then drop
            }
          });
          return;
        }
        up.pipe(res);
      });
      upstream.on('error', () => req.socket.destroy());
      req.pipe(upstream);
    };
    if (fault === 'latency') setTimeout(forward, 1000 + rand() * 2000);
    else forward();
  })
  .listen(LISTEN, () => console.log(`chaos-proxy :${LISTEN} -> :${TARGET} profile=${profile} seed=${seedArg}`));
