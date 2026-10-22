import http from 'node:http';
import { pathToFileURL } from 'node:url';
import { Server } from 'socket.io';
import { createRelay } from './relay.js';
import { DEFAULT_MAX_EVENT_BYTES } from './validate.js';

const LOG_LEVELS = { debug: 10, info: 20, warn: 30, error: 40, silent: 100 };

export function createLogger(level = process.env.LOG_LEVEL ?? 'info') {
  const threshold = LOG_LEVELS[level] ?? LOG_LEVELS.info;
  const write = (lvl, msg, meta) => {
    if (LOG_LEVELS[lvl] < threshold) return;
    const line = JSON.stringify({ level: lvl, time: new Date().toISOString(), msg, ...meta });
    (lvl === 'error' || lvl === 'warn' ? process.stderr : process.stdout).write(`${line}\n`);
  };
  return {
    debug: (msg, meta) => write('debug', msg, meta),
    info: (msg, meta) => write('info', msg, meta),
    warn: (msg, meta) => write('warn', msg, meta),
    error: (msg, meta) => write('error', msg, meta),
  };
}

/**
 * Parse CORS_ORIGIN: "*" (default) or a comma-separated list of origins.
 * @param {string | undefined} value
 * @returns {'*' | string[]}
 */
export function parseCorsOrigin(value) {
  if (!value || value.trim() === '' || value.trim() === '*') return '*';
  const list = value
    .split(',')
    .map((s) => s.trim().replace(/\/+$/, ''))
    .filter(Boolean);
  return list.length ? list : '*';
}

/**
 * CORS headers for plain HTTP routes (Socket.IO handles its own).
 * @param {'*' | string[]} corsOrigin
 * @param {string | undefined} requestOrigin
 */
function corsHeaders(corsOrigin, requestOrigin) {
  if (corsOrigin === '*') return { 'access-control-allow-origin': '*' };
  if (requestOrigin && corsOrigin.includes(requestOrigin)) {
    return { 'access-control-allow-origin': requestOrigin, vary: 'Origin' };
  }
  return { vary: 'Origin' };
}

/**
 * Create and start the HTTP + Socket.IO server.
 *
 * @param {{
 *   port?: number,
 *   host?: string,
 *   corsOrigin?: '*' | string[],
 *   logger?: ReturnType<typeof createLogger>,
 *   relay?: Parameters<typeof createRelay>[1],
 * }} [options]
 * @returns {Promise<{ httpServer: http.Server, io: Server, relay: ReturnType<typeof createRelay>, port: number, close: () => Promise<void> }>}
 */
export async function startServer(options = {}) {
  const port = options.port ?? Number(process.env.PORT ?? 4000);
  const host = options.host ?? process.env.HOST ?? '0.0.0.0';
  const corsOrigin = options.corsOrigin ?? parseCorsOrigin(process.env.CORS_ORIGIN);
  const logger = options.logger ?? createLogger();
  const startedAt = Date.now();

  /** @type {ReturnType<typeof createRelay> | undefined} */
  let relay;

  const httpServer = http.createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    if (req.method === 'GET' && (url.pathname === '/health' || url.pathname === '/healthz')) {
      const stats = relay?.stats() ?? { connections: 0, rooms: 0 };
      const body = JSON.stringify({
        status: 'ok',
        uptime: Math.round((Date.now() - startedAt) / 1000),
        connections: stats.connections,
        rooms: stats.rooms,
      });
      res.writeHead(200, {
        'content-type': 'application/json; charset=utf-8',
        'cache-control': 'no-store',
        ...corsHeaders(corsOrigin, req.headers.origin),
      });
      res.end(body);
      return;
    }
    if (req.method === 'GET' && url.pathname === '/') {
      res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('pulse-realtime-server\n');
      return;
    }
    res.writeHead(404, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ error: 'not_found' }));
  });

  const maxEventBytes = options.relay?.maxEventBytes ?? DEFAULT_MAX_EVENT_BYTES;
  const io = new Server(httpServer, {
    cors: { origin: corsOrigin, methods: ['GET', 'POST'] },
    // Leave headroom over the event cap for Socket.IO packet framing.
    maxHttpBufferSize: maxEventBytes + 16 * 1024,
    pingInterval: 25_000,
    pingTimeout: 20_000,
  });

  relay = createRelay(io, { logger, ...options.relay });

  await new Promise((resolve, reject) => {
    httpServer.once('error', reject);
    httpServer.listen(port, host, () => {
      httpServer.off('error', reject);
      resolve();
    });
  });

  const address = httpServer.address();
  const boundPort = typeof address === 'object' && address ? address.port : port;
  logger.info('listening', { port: boundPort, host, corsOrigin });

  let closing;
  const close = () => {
    closing ??= new Promise((resolve) => {
      io.close(() => resolve());
    });
    return closing;
  };

  return { httpServer, io, relay, port: boundPort, close };
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  const logger = createLogger();
  startServer({ logger })
    .then(({ close }) => {
      const shutdown = (signal) => {
        logger.info('shutting down', { signal });
        const force = setTimeout(() => process.exit(1), 10_000);
        force.unref();
        close().then(() => process.exit(0));
      };
      process.on('SIGTERM', () => shutdown('SIGTERM'));
      process.on('SIGINT', () => shutdown('SIGINT'));
    })
    .catch((err) => {
      logger.error('failed to start', { error: err?.message ?? String(err) });
      process.exit(1);
    });
}
