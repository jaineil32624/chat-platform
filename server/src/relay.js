import { randomUUID } from 'node:crypto';
import { createPresence } from './presence.js';
import { createTokenBucket, DEFAULT_BURST, DEFAULT_RATE_PER_SEC } from './rateLimit.js';
import { DEFAULT_MAX_EVENT_BYTES, normalizeWorkspace, validateEvent } from './validate.js';

/** Origin used for events the server synthesises (e.g. presence). */
export const SERVER_ORIGIN = 'server';

const MAX_AUTH_ID_LENGTH = 128;

/** Socket.IO room name for a workspace. Prefixed so it can never collide with a socket id. */
export const roomFor = (workspace) => `ws:${workspace}`;

const noopLogger = { info() {}, warn() {}, error() {}, debug() {} };

function readAuthId(value) {
  return typeof value === 'string' && value.length > 0 && value.length <= MAX_AUTH_ID_LENGTH
    ? value
    : null;
}

/**
 * Attach the Pulse relay to a Socket.IO server.
 *
 * Behaviour:
 *  - Each socket joins the room of its workspace (handshake `auth.workspace`, default "public").
 *  - `'event'` from a socket is validated, rate limited, then broadcast as `'event'` to every
 *    OTHER socket in that workspace. The event is relayed unchanged.
 *  - On connect the socket receives `'presence:snapshot'` `{ userIds }`; the first socket of a
 *    user broadcasts a synthesized `presence` event (online), the last one to leave broadcasts
 *    `presence` (offline).
 *  - Invalid events get `'error:invalid_event'`; over-limit events are dropped and the sender
 *    gets `'error:rate_limited'` (throttled to at most one notice per `rateLimitNoticeMs`).
 *  - If the client passes an ack callback as the last emit argument it receives
 *    `{ ok: true }` or `{ ok: false, error, code }`.
 *
 * @param {import('socket.io').Server} io
 * @param {{
 *   ratePerSec?: number,
 *   burst?: number,
 *   maxEventBytes?: number,
 *   rateLimitNoticeMs?: number,
 *   logger?: { info: Function, warn: Function, error: Function, debug: Function },
 *   now?: () => number,
 * }} [opts]
 */
export function createRelay(io, opts = {}) {
  const ratePerSec = opts.ratePerSec ?? DEFAULT_RATE_PER_SEC;
  const burst = opts.burst ?? DEFAULT_BURST;
  const maxEventBytes = opts.maxEventBytes ?? DEFAULT_MAX_EVENT_BYTES;
  const rateLimitNoticeMs = opts.rateLimitNoticeMs ?? 1000;
  const logger = opts.logger ?? noopLogger;
  const now = opts.now ?? (() => Date.now());

  const presence = createPresence({ now });
  /** @type {Map<string, number>} workspace -> connected socket count */
  const workspaceSockets = new Map();
  const counters = { relayed: 0, rejected: 0, rateLimited: 0 };

  function presenceEvent(workspace, userId, status, lastSeen) {
    return {
      id: randomUUID(),
      type: 'presence',
      payload: { userId, status, lastSeen },
      origin: SERVER_ORIGIN,
      ts: now(),
      workspace,
    };
  }

  function onConnection(socket) {
    const auth = socket.handshake.auth ?? {};
    const workspace = normalizeWorkspace(auth.workspace);
    const clientId = readAuthId(auth.clientId) ?? socket.id;
    const userId = readAuthId(auth.userId);
    const room = roomFor(workspace);
    const bucket = createTokenBucket({ ratePerSec, burst });
    let lastRateLimitNotice = -Infinity;

    socket.data.workspace = workspace;
    socket.data.clientId = clientId;
    socket.data.userId = userId;

    socket.join(room);
    workspaceSockets.set(workspace, (workspaceSockets.get(workspace) ?? 0) + 1);

    if (userId) {
      const { firstConnection } = presence.add(workspace, userId);
      if (firstConnection) {
        socket.to(room).emit('event', presenceEvent(workspace, userId, 'online', now()));
      }
    }
    socket.emit('presence:snapshot', { userIds: presence.list(workspace) });

    logger.debug('connect', { socketId: socket.id, workspace, clientId, userId });

    socket.on('event', (...args) => {
      const ack = typeof args[args.length - 1] === 'function' ? args.pop() : null;
      const raw = args[0];

      if (!bucket.tryRemove()) {
        counters.rateLimited += 1;
        const retryAfterMs = bucket.retryAfterMs();
        const t = now();
        if (t - lastRateLimitNotice >= rateLimitNoticeMs) {
          lastRateLimitNotice = t;
          socket.emit('error:rate_limited', {
            id: raw && typeof raw === 'object' ? raw.id ?? null : null,
            retryAfterMs,
            limit: { ratePerSec, burst },
          });
        }
        ack?.({ ok: false, code: 'rate_limited', error: 'rate limited', retryAfterMs });
        return;
      }

      const result = validateEvent(raw, { maxBytes: maxEventBytes });
      if (!result.ok) {
        counters.rejected += 1;
        socket.emit('error:invalid_event', {
          id: raw && typeof raw === 'object' ? raw.id ?? null : null,
          error: result.error,
        });
        ack?.({ ok: false, code: 'invalid_event', error: result.error });
        return;
      }

      // Events are always scoped to the socket's own workspace; a mismatching
      // `workspace` field is rejected rather than silently cross-posted.
      if (result.event.workspace !== undefined && result.event.workspace !== workspace) {
        counters.rejected += 1;
        const error = `workspace mismatch (connected to "${workspace}")`;
        socket.emit('error:invalid_event', { id: result.event.id, error });
        ack?.({ ok: false, code: 'invalid_event', error });
        return;
      }

      counters.relayed += 1;
      socket.to(room).emit('event', result.event);
      ack?.({ ok: true });
    });

    socket.on('disconnect', (reason) => {
      const remaining = (workspaceSockets.get(workspace) ?? 1) - 1;
      if (remaining <= 0) workspaceSockets.delete(workspace);
      else workspaceSockets.set(workspace, remaining);

      if (userId) {
        const { lastDisconnection, lastSeen } = presence.remove(workspace, userId);
        if (lastDisconnection) {
          io.to(room).emit('event', presenceEvent(workspace, userId, 'offline', lastSeen));
        }
      }
      logger.debug('disconnect', { socketId: socket.id, workspace, userId, reason });
    });
  }

  io.on('connection', onConnection);

  return {
    presence,
    /** Snapshot of relay metrics for /health. */
    stats() {
      return {
        connections: io.engine?.clientsCount ?? [...workspaceSockets.values()].reduce((a, b) => a + b, 0),
        rooms: workspaceSockets.size,
        workspaces: Object.fromEntries(workspaceSockets),
        ...counters,
      };
    },
    /** Detach the connection handler (existing sockets are left alone). */
    detach() {
      io.off('connection', onConnection);
    },
  };
}
