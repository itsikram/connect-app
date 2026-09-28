#!/usr/bin/env node
'use strict';

/**
 * Expo control daemon.
 *
 * Runs on this machine (127.0.0.1 only) and lets the web console at /expo
 * start, stop and restart the Expo Go dev server + tunnel, and follow its URL,
 * health and logs in real time over Server-Sent Events.
 *
 *   npm run control            (from expo-connect-app)
 *
 * The web dev server (`npm start` in /web) also starts it automatically and
 * proxies /__expo-control to it.
 *
 * Env:
 *   EXPO_CONTROL_PORT               default 19010
 *   EXPO_CONTROL_METRO_PORT         default 8081 (the Expo WS tunnel requires 8081)
 *   EXPO_CONTROL_ACCESS_KEY         key required for remote (tunnel) requests
 *   EXPO_CONTROL_ALLOWED_ORIGINS    live-site origins allowed remotely
 * The last two fall back to home-cobalt/live.env (see remoteAccess.js).
 *
 * Live site: PM2 (home-cobalt/ecosystem.config.cjs) runs this daemon plus a
 * Cloudflare quick tunnel and a URL sync worker, like Cobalt and face login.
 */

const http = require('http');
const path = require('path');
const { ExpoController, HttpError } = require('./ExpoController');
const { createRemoteAccess } = require('./remoteAccess');
const sys = require('./system');

const VERSION = 1;
const HOST = '127.0.0.1';
const PORT = Number(process.env.EXPO_CONTROL_PORT) || 19010;
const SERVICE = 'expo-control';
const projectRoot = path.resolve(__dirname, '..', '..');
const remoteAccess = createRemoteAccess({ projectRoot });

const controller = new ExpoController({ projectRoot, version: VERSION });

// ------------------------------------------------------------------ security

function applyCors(req, res) {
  const origin = req.headers.origin;
  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Expo-Control, X-Expo-Control-Key, Authorization');
    res.setHeader('Access-Control-Max-Age', '600');
    res.setHeader('Access-Control-Allow-Private-Network', 'true');
  }
}

// ------------------------------------------------------------------ helpers

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Content-Length': Buffer.byteLength(body),
  });
  res.end(body);
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > 64 * 1024) {
        reject(new HttpError(413, 'Request body too large', 'TOO_LARGE'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (!chunks.length) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')) || {});
      } catch (_) {
        reject(new HttpError(400, 'Invalid JSON body', 'BAD_JSON'));
      }
    });
    req.on('error', reject);
  });
}

// ------------------------------------------------------------------ SSE

const clients = new Set();

function openEventStream(req, res) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    // no-transform keeps the web dev server's gzip middleware from buffering events.
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.flushHeaders();

  const client = { res, pendingLogs: [], stateQueued: false, logTimer: null, stateTimer: null };
  const write = (event, data) => {
    if (!res.writableEnded) res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };
  client.write = write;

  res.write('retry: 2000\n\n');
  write('hello', { service: SERVICE, version: VERSION });
  write('state', controller.getState());
  write('logs', controller.getLogs(0, 500));

  clients.add(client);
  const heartbeat = setInterval(() => res.write(': ping\n\n'), 15000);
  req.on('close', () => {
    clearInterval(heartbeat);
    clearTimeout(client.logTimer);
    clearTimeout(client.stateTimer);
    clients.delete(client);
  });
}

// Coalesce bursts (Metro can print hundreds of lines a second) into batches.
controller.on('state', () => {
  for (const client of clients) {
    if (client.stateQueued) continue;
    client.stateQueued = true;
    client.stateTimer = setTimeout(() => {
      client.stateQueued = false;
      client.write('state', controller.getState());
    }, 100);
  }
});

controller.on('log', (entry) => {
  for (const client of clients) {
    client.pendingLogs.push(entry);
    if (client.logTimer) continue;
    client.logTimer = setTimeout(() => {
      client.logTimer = null;
      const batch = client.pendingLogs.splice(0);
      client.write('logs', batch.slice(-500));
    }, 150);
  }
});

controller.on('logs-cleared', () => {
  for (const client of clients) {
    client.pendingLogs = [];
    client.write('logs-cleared', {});
  }
});

// ------------------------------------------------------------------ routes

const routes = {
  'GET /api/health': () => ({ ok: true, service: SERVICE, version: VERSION }),
  // Lets the local console show the key to copy into the live site. Remote
  // callers never reach this without already holding the key.
  'GET /api/access-key': () => ({ key: remoteAccess.getAccessKey() || null, liveEnv: remoteAccess.liveEnvFile }),
  'GET /api/status': () => controller.getState(),
  'GET /api/logs': (req, url) => controller.getLogs(Number(url.searchParams.get('since')) || 0, 1000),
  // Polling alternative to /api/events for the live site: Cloudflare quick
  // tunnels hold back event streams, so the browser polls this instead.
  'GET /api/snapshot': (req, url) => ({
    state: controller.getState(),
    logs: controller.getLogs(Number(url.searchParams.get('since')) || 0, 500),
    lastLogId: controller.logSeq,
  }),
  'DELETE /api/logs': () => {
    controller.clearLogs();
    return { ok: true };
  },
  'POST /api/start': async (req) => controller.start(await readJson(req)),
  'POST /api/stop': () => controller.stop(),
  'POST /api/restart': async (req) => controller.restart(await readJson(req)),
  'POST /api/options': async (req) => ({ options: controller.updateOptions(await readJson(req)) }),
  'POST /api/free-port': () => controller.freePort(),
  'POST /api/prewarm': () => {
    controller.prewarm().catch(() => {});
    return { ok: true };
  },
  'POST /api/apps/reload': () => controller.sendToApps('reload'),
  'POST /api/apps/dev-menu': () => controller.sendToApps('devMenu'),
};

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${HOST}:${PORT}`);

  // Anything that is not a plain request from this machine (tunnel traffic,
  // other Host names, which also covers DNS rebinding) needs the access key.
  const remote = remoteAccess.isRemote(req);
  if (!remoteAccess.isAllowedOrigin(req.headers.origin, remote)) {
    sendJson(res, 403, { error: 'Origin not allowed. Add it to EXPO_CONTROL_ALLOWED_ORIGINS.', code: 'FORBIDDEN_ORIGIN' });
    return;
  }
  applyCors(req, res);

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const isHealth = req.method === 'GET' && url.pathname === '/api/health';
  if (remote && !isHealth) {
    if (!remoteAccess.getAccessKey()) {
      sendJson(res, 503, { error: 'Remote access is not set up on this PC. Run home-cobalt/install-expo-control.ps1.', code: 'REMOTE_DISABLED' });
      return;
    }
    if (!remoteAccess.isAuthorized(req)) {
      sendJson(res, 401, { error: 'Invalid or missing access key.', code: 'BAD_KEY' });
      return;
    }
  }

  if (req.method === 'GET' && url.pathname === '/api/events') {
    openEventStream(req, res);
    return;
  }

  const handler = routes[`${req.method} ${url.pathname}`];
  if (!handler) {
    sendJson(res, 404, { error: 'Not found', code: 'NOT_FOUND' });
    return;
  }

  // A custom header forces a CORS preflight, so other sites cannot fire
  // "simple" cross-origin POSTs at the daemon.
  if (req.method !== 'GET' && req.headers['x-expo-control'] !== '1') {
    sendJson(res, 403, { error: 'Missing X-Expo-Control header', code: 'CSRF' });
    return;
  }

  try {
    sendJson(res, 200, await handler(req, url));
  } catch (error) {
    const status = error instanceof HttpError ? error.status : 500;
    sendJson(res, status, { error: error.message, code: error.code || 'INTERNAL' });
    if (status === 500) console.error('[expo-control]', error);
  }
});

let standingBy = false;
server.on('error', async (error) => {
  if (error.code === 'EADDRINUSE') {
    const existing = await sys.request(`http://${HOST}:${PORT}/api/health`, { timeoutMs: 1500 }).catch(() => null);
    if (existing && existing.body.includes(SERVICE)) {
      // Another instance (PM2 or the web dev server's autostart) is serving.
      // Stand by and take over if it goes away, instead of exiting and making
      // PM2 restart-loop.
      if (!standingBy) console.log(`[expo-control] Another instance is running on http://${HOST}:${PORT}; standing by.`);
      standingBy = true;
      setTimeout(() => server.listen(PORT, HOST), 15000);
      return;
    }
    console.error(`[expo-control] Port ${PORT} is used by another program. Set EXPO_CONTROL_PORT to change it.`);
    process.exit(1);
  }
  console.error('[expo-control]', error);
  process.exit(1);
});

server.listen(PORT, HOST, () => {
  console.log(`[expo-control] Listening on http://${HOST}:${PORT} (project: ${projectRoot})`);
  console.log('[expo-control] Open the web console at http://localhost:3000/expo');
});

let shuttingDown = false;
async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`[expo-control] ${signal} received, stopping Expo…`);
  for (const client of clients) client.res.end();
  server.close();
  await controller.shutdown().catch(() => {});
  process.exit(0);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGHUP', () => shutdown('SIGHUP'));
