'use strict';

/**
 * Metro middleware that makes Expo Go load much faster over a tunnel.
 *
 * Only active when EXPO_TUNNEL_BOOST=1, which the expo-control daemon sets when
 * it launches `expo start`, so a plain `npm start` behaves exactly as before.
 *
 * - Compresses JS bundles and source maps (brotli/gzip). A dev bundle is tens
 *   of MB of text and shrinks by ~80-90%; tunnel bandwidth is the bottleneck
 *   when the phone is not on the same network.
 * - Asks Metro for a single response instead of the multipart progress stream
 *   (a multipart stream cannot be compressed as one body). Expo Go falls back
 *   to a plain download automatically; only the % progress text is lost.
 * - Reports every bundle served as one structured stdout line so the web
 *   console can show sizes and timings in real time.
 */

const REPORT_MARKER = '[expo-control:bundle]';
const BUNDLE_PATH = /\.(bundle|map)(\?|$)/;

function report(payload) {
  try {
    process.stdout.write(`${REPORT_MARKER} ${JSON.stringify(payload)}\n`);
  } catch (_) {
    // stdout closed; nothing to report to
  }
}

/** Wrap res.write/res.end to count the bytes that pass through at this layer. */
function countBytes(res) {
  const counter = { bytes: 0 };
  const write = res.write;
  const end = res.end;
  const add = (chunk, encoding) => {
    if (chunk == null || typeof chunk === 'function') return;
    counter.bytes += Buffer.isBuffer(chunk)
      ? chunk.length
      : Buffer.byteLength(chunk, typeof encoding === 'string' ? encoding : 'utf8');
  };
  res.write = function patchedWrite(chunk, encoding, ...rest) {
    add(chunk, encoding);
    return write.call(this, chunk, encoding, ...rest);
  };
  res.end = function patchedEnd(chunk, encoding, ...rest) {
    add(chunk, encoding);
    return end.call(this, chunk, encoding, ...rest);
  };
  return counter;
}

function createBoostMiddleware(metroMiddleware, compression) {
  const compress = compression({ threshold: 1024 });

  return (req, res, next) => {
    const url = req.url || '';
    if (!BUNDLE_PATH.test(url)) {
      metroMiddleware(req, res, next);
      return;
    }

    const acceptsCompression = /\b(br|gzip)\b/i.test(req.headers['accept-encoding'] || '');
    if (acceptsCompression && /multipart\/mixed/i.test(req.headers.accept || '')) {
      req.headers.accept = 'application/javascript, */*';
    }

    const started = Date.now();
    // Installed before compression so it sees the bytes that go on the wire.
    const sent = countBytes(res);
    let raw = { bytes: 0 };

    res.once('finish', () => {
      let query;
      try {
        query = new URL(url, 'http://localhost').searchParams;
      } catch (_) {
        query = new URLSearchParams();
      }
      report({
        path: url.split('?')[0],
        kind: url.includes('.map') ? 'sourcemap' : 'bundle',
        platform: query.get('platform') || 'unknown',
        dev: query.get('dev') !== 'false',
        status: res.statusCode,
        rawBytes: raw.bytes,
        sentBytes: sent.bytes,
        encoding: String(res.getHeader('content-encoding') || 'identity'),
        ms: Date.now() - started,
        viaTunnel: Boolean(req.headers['x-forwarded-for'] || req.headers['x-forwarded-proto']),
        prewarm: req.headers['x-expo-control-prewarm'] === '1',
        at: Date.now(),
      });
    });

    compress(req, res, (error) => {
      if (error) {
        next(error);
        return;
      }
      // Installed after compression so it sees the uncompressed bundle.
      raw = countBytes(res);
      metroMiddleware(req, res, next);
    });
  };
}

/** Enable the tunnel boost on a Metro config when running under expo-control. */
function withTunnelBoost(config) {
  if (process.env.EXPO_TUNNEL_BOOST !== '1') return config;

  let compression;
  try {
    compression = require('compression');
  } catch (_) {
    console.warn('[expo-control] "compression" is not installed; bundles will not be compressed.');
    return config;
  }

  const previousEnhance = config.server && config.server.enhanceMiddleware;
  config.server = {
    ...config.server,
    enhanceMiddleware: (metroMiddleware, server) => {
      const base = previousEnhance ? previousEnhance(metroMiddleware, server) : metroMiddleware;
      return createBoostMiddleware(base, compression);
    },
  };
  return config;
}

module.exports = { withTunnelBoost, REPORT_MARKER };
