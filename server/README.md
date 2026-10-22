# pulse-realtime-server

A small Socket.IO v4 relay for Pulse. Clients send `TransportEvent`s and the server fans each one out to every **other** socket in the same workspace. It has no database and keeps no state apart from in-memory presence counts.

```
client A ──emit('event', ev)──▶ relay ──validate ─ rate-limit ─▶ socket.to('ws:<workspace>').emit('event', ev) ──▶ clients B, C…
```

## Quick start

```bash
cd server
npm install
npm run dev        # node --watch, restarts on change
# or
npm start          # production
npm test           # node:test unit + integration tests
```

Requires Node 20 or later.

## Configuration

| Env var       | Default   | Description                                                                 |
| ------------- | --------- | --------------------------------------------------------------------------- |
| `PORT`        | `4000`    | HTTP / WebSocket port                                                       |
| `HOST`        | `0.0.0.0` | Bind address                                                                |
| `CORS_ORIGIN` | `*`       | `*` or a comma-separated list, e.g. `https://pulse.app,http://localhost:3000` |
| `LOG_LEVEL`   | `info`    | `debug` \| `info` \| `warn` \| `error` \| `silent` (JSON lines on stdout/stderr) |

On the client, set `NEXT_PUBLIC_SOCKET_URL` to this server's URL, for example `http://localhost:4000`.

## Protocol

```ts
type TransportEvent = {
  id: string;        // unique per event (≤128 chars)
  type: string;      // one of the 14 types below
  payload: unknown;  // required; use null for "nothing"
  origin: string;    // sender client id (≤128 chars)
  ts: number;        // epoch ms
  workspace?: string // if present, must equal the socket's workspace
};
```

Allowed `type`s: `message:new`, `message:update`, `message:delete`, `reaction:toggle`, `typing`, `presence`, `channel:upsert`, `server:upsert`, `user:upsert`, `friend:update`, `moderation`, `poll:vote`, `whiteboard:stroke`, `whiteboard:clear`.

The full payload reference is in [`../api/EVENTS.md`](../api/EVENTS.md).

### Connecting

```ts
import { io } from 'socket.io-client';
const socket = io(process.env.NEXT_PUBLIC_SOCKET_URL!, {
  auth: { clientId, userId, workspace }, // workspace defaults to "public"
});
```

- `workspace` must match `/^[A-Za-z0-9_.:-]{1,64}$/`. Anything else, or a missing value, falls back to `"public"`.
- `userId` is optional. Without it the socket can still send and receive events but has no presence.

### Server → client

| Event                 | Payload                                                     | When                                          |
| --------------------- | ----------------------------------------------------------- | --------------------------------------------- |
| `event`               | `TransportEvent`                                            | Relayed from another socket in the workspace  |
| `event` (`presence`)  | `{ userId, status: 'online' \| 'offline', lastSeen }`       | A user's first socket connects or last socket disconnects. `origin: "server"` |
| `presence:snapshot`   | `{ userIds: string[] }`                                     | Sent once to each new socket. Includes the socket's own user |
| `error:invalid_event` | `{ id: string \| null, error: string }`                     | Event failed validation and was not relayed   |
| `error:rate_limited`  | `{ id, retryAfterMs, limit: { ratePerSec, burst } }`        | Event dropped. Sent at most once per second   |

### Acknowledgements (optional)

If the client passes an ack callback, the server answers it:

```ts
const res = await socket.timeout(5000).emitWithAck('event', ev);
// { ok: true } | { ok: false, code: 'invalid_event' | 'rate_limited', error, retryAfterMs? }
```

Plain `socket.emit('event', ev)` without an ack also works.

### Limits

- **Rate limit:** each socket gets a token bucket of 20 events/sec with a burst of 40. You can change this through `createRelay(io, { ratePerSec, burst })`.
- **Size:** each event can be at most 256 KiB of serialized JSON. Socket.IO's `maxHttpBufferSize` is set slightly higher, and anything above it closes the connection.
- Multiple tabs from the same `userId` are reference-counted, so presence only changes on the first connect and the last disconnect.

## HTTP

`GET /health` (alias `/healthz`) returns:

```json
{ "status": "ok", "uptime": 123, "connections": 4, "rooms": 2 }
```

`uptime` is in seconds. `rooms` counts the workspaces that have at least one socket.

## Layout

```
src/
  index.js      bootstrap: node:http server, /health, Socket.IO, graceful shutdown; exports startServer()
  relay.js      createRelay(io, opts): connection/event/disconnect handlers
  validate.js   TransportEvent validation, allowed types, size cap, workspace normalisation
  rateLimit.js  token bucket
  presence.js   per-workspace userId → socket count, lastSeen
test/           node:test suites (unit + socket.io-client integration on an ephemeral port)
```

## Deploying

### Docker

```bash
docker build -t pulse-realtime ./server
docker run -p 4000:4000 -e CORS_ORIGIN=http://localhost:3000 pulse-realtime
```

The image is based on `node:20-alpine`, runs as the non-root `node` user, and has a `HEALTHCHECK` against `/health`.

### Render

`render.yaml` is a Blueprint. In Render, go to **New → Blueprint**, select the repo, and set `CORS_ORIGIN` when prompted. The service builds from `server/` and uses `/health` as its health check.

### Fly.io

```bash
cd server
fly launch --no-deploy --copy-config   # adjust app name / region in fly.toml
fly secrets set CORS_ORIGIN=https://your-client.example
fly deploy
```

### Scaling out

All state lives in memory, so a single instance is the simplest deployment. To run more than one instance, add [`@socket.io/redis-adapter`](https://socket.io/docs/v4/redis-adapter/) and turn on sticky sessions. Presence counts would then also have to move to Redis.

## Security notes

The relay does not authenticate anyone. `userId` and `clientId` are whatever the client sends, and `origin` is not checked against `clientId`. That is fine for a demo or simulation. For production, verify a Supabase JWT in an `io.use()` middleware and take `userId` from the token.
