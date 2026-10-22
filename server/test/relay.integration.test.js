import assert from 'node:assert/strict';
import { once } from 'node:events';
import { after, before, describe, it } from 'node:test';
import { io as ioClient } from 'socket.io-client';
import { startServer } from '../src/index.js';

const silent = { debug() {}, info() {}, warn() {}, error() {} };

let seq = 0;
const makeEvent = (overrides = {}) => ({
  id: `evt_${++seq}`,
  type: 'message:new',
  payload: { channelId: 'general', content: 'hello' },
  origin: 'client',
  ts: Date.now(),
  ...overrides,
});

/** Wait for `event` on `socket`, failing after `ms`. */
function waitFor(socket, event, ms = 2000, predicate = () => true) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off(event, handler);
      reject(new Error(`timed out waiting for "${event}"`));
    }, ms);
    function handler(data) {
      if (!predicate(data)) return;
      clearTimeout(timer);
      socket.off(event, handler);
      resolve(data);
    }
    socket.on(event, handler);
  });
}

/** Resolve true if `event` does NOT arrive within `ms`. */
function expectSilence(socket, event, ms = 200, predicate = () => true) {
  return new Promise((resolve, reject) => {
    function handler(data) {
      if (!predicate(data)) return;
      clearTimeout(timer);
      socket.off(event, handler);
      reject(new Error(`unexpected "${event}": ${JSON.stringify(data)}`));
    }
    const timer = setTimeout(() => {
      socket.off(event, handler);
      resolve(true);
    }, ms);
    socket.on(event, handler);
  });
}

async function startTestServer(relay) {
  return startServer({ port: 0, host: '127.0.0.1', corsOrigin: '*', logger: silent, relay });
}

function makeConnector(getUrl, sockets) {
  return async function connect(auth) {
    const socket = ioClient(getUrl(), {
      auth,
      transports: ['websocket'],
      forceNew: true,
      reconnection: false,
      autoConnect: false,
    });
    sockets.push(socket);
    const snapshot = once(socket, 'presence:snapshot');
    socket.connect();
    await once(socket, 'connect');
    const [data] = await snapshot;
    socket.snapshot = data;
    return socket;
  };
}

describe('relay (integration)', () => {
  let server;
  let url;
  const sockets = [];
  const connect = makeConnector(() => url, sockets);

  before(async () => {
    server = await startTestServer();
    url = `http://127.0.0.1:${server.port}`;
  });

  after(async () => {
    for (const s of sockets) s.disconnect();
    await server.close();
  });

  it('serves /health', async () => {
    const res = await fetch(`${url}/health`);
    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type'), /application\/json/);
    const body = await res.json();
    assert.equal(body.status, 'ok');
    assert.equal(typeof body.uptime, 'number');
    assert.equal(typeof body.connections, 'number');
    assert.equal(typeof body.rooms, 'number');
  });

  it('returns 404 JSON for unknown routes', async () => {
    const res = await fetch(`${url}/nope`);
    assert.equal(res.status, 404);
    assert.deepEqual(await res.json(), { error: 'not_found' });
  });

  it('relays events to other sockets in the same workspace only', async () => {
    const a = await connect({ clientId: 'ca', userId: 'ua', workspace: 'relay-ws' });
    const b = await connect({ clientId: 'cb', userId: 'ub', workspace: 'relay-ws' });
    const other = await connect({ clientId: 'cx', userId: 'ux', workspace: 'elsewhere' });

    const ev = makeEvent({ origin: 'ca', workspace: 'relay-ws' });
    const received = waitFor(b, 'event', 2000, (e) => e.id === ev.id);
    const senderSilent = expectSilence(a, 'event', 300, (e) => e.id === ev.id);
    const otherSilent = expectSilence(other, 'event', 300, (e) => e.id === ev.id);

    const ack = await a.timeout(2000).emitWithAck('event', ev);
    assert.deepEqual(ack, { ok: true });
    assert.deepEqual(await received, ev);
    await senderSilent;
    await otherSilent;
  });

  it('defaults to the "public" workspace', async () => {
    const a = await connect({ clientId: 'p1', userId: 'pu1' });
    const b = await connect({ clientId: 'p2', userId: 'pu2', workspace: 'public' });
    const ev = makeEvent({ origin: 'p1', type: 'typing', payload: { channelId: 'c', userId: 'pu1' } });
    const received = waitFor(b, 'event', 2000, (e) => e.id === ev.id);
    a.emit('event', ev);
    assert.equal((await received).type, 'typing');
  });

  it('sends a presence snapshot and broadcasts online/offline', async () => {
    const ws = 'presence-ws';
    const a = await connect({ clientId: 'c1', userId: 'alice', workspace: ws });
    assert.deepEqual(a.snapshot, { userIds: ['alice'] });

    const online = waitFor(a, 'event', 2000, (e) => e.type === 'presence' && e.payload.userId === 'bob');
    const b = await connect({ clientId: 'c2', userId: 'bob', workspace: ws });
    assert.deepEqual([...b.snapshot.userIds].sort(), ['alice', 'bob']);

    const onlineEvt = await online;
    assert.equal(onlineEvt.payload.status, 'online');
    assert.equal(onlineEvt.origin, 'server');
    assert.equal(onlineEvt.workspace, ws);
    assert.equal(typeof onlineEvt.id, 'string');
    assert.equal(typeof onlineEvt.ts, 'number');
    assert.equal(typeof onlineEvt.payload.lastSeen, 'number');

    // A second tab for bob must not re-announce, and closing one tab must not go offline.
    const noDup = expectSilence(a, 'event', 300, (e) => e.type === 'presence' && e.payload.userId === 'bob');
    const b2 = await connect({ clientId: 'c3', userId: 'bob', workspace: ws });
    await noDup;

    const noOffline = expectSilence(a, 'event', 300, (e) => e.type === 'presence' && e.payload.status === 'offline');
    b2.disconnect();
    await noOffline;

    const offline = waitFor(a, 'event', 2000, (e) => e.type === 'presence' && e.payload.status === 'offline');
    b.disconnect();
    const offlineEvt = await offline;
    assert.equal(offlineEvt.payload.userId, 'bob');
  });

  it('rejects invalid events with error:invalid_event and does not relay them', async () => {
    const a = await connect({ clientId: 'i1', userId: 'iu1', workspace: 'invalid-ws' });
    const b = await connect({ clientId: 'i2', userId: 'iu2', workspace: 'invalid-ws' });

    const errorEvt = waitFor(a, 'error:invalid_event');
    const silent = expectSilence(b, 'event', 300, (e) => e.type !== 'presence');
    const ack = await a.timeout(2000).emitWithAck('event', { id: 'bad', type: 'nope', payload: 1, origin: 'i1', ts: 1 });
    assert.equal(ack.ok, false);
    assert.equal(ack.code, 'invalid_event');
    const err = await errorEvt;
    assert.equal(err.id, 'bad');
    assert.match(err.error, /type/);
    await silent;
  });

  it('rejects events whose workspace differs from the connection', async () => {
    const a = await connect({ clientId: 'm1', userId: 'mu1', workspace: 'ws-one' });
    const ack = await a.timeout(2000).emitWithAck('event', makeEvent({ origin: 'm1', workspace: 'ws-two' }));
    assert.equal(ack.ok, false);
    assert.match(ack.error, /workspace mismatch/);
  });

  it('reports connections and rooms in /health', async () => {
    const body = await (await fetch(`${url}/health`)).json();
    assert.ok(body.connections >= 1);
    assert.ok(body.rooms >= 1);
  });
});

describe('relay rate limiting (integration)', () => {
  let server;
  let url;
  const sockets = [];
  const connect = makeConnector(() => url, sockets);

  before(async () => {
    server = await startTestServer({ ratePerSec: 1, burst: 3 });
    url = `http://127.0.0.1:${server.port}`;
  });

  after(async () => {
    for (const s of sockets) s.disconnect();
    await server.close();
  });

  it('drops events over the limit and emits error:rate_limited', async () => {
    const a = await connect({ clientId: 'r1', userId: 'ru1', workspace: 'rl' });
    const b = await connect({ clientId: 'r2', userId: 'ru2', workspace: 'rl' });

    const relayed = [];
    b.on('event', (e) => e.type !== 'presence' && relayed.push(e.id));
    const limited = waitFor(a, 'error:rate_limited');

    const acks = [];
    for (let i = 0; i < 6; i++) {
      acks.push(a.timeout(2000).emitWithAck('event', makeEvent({ origin: 'r1' })));
    }
    const results = await Promise.all(acks);
    assert.equal(results.filter((r) => r.ok).length, 3);
    assert.equal(results.filter((r) => r.code === 'rate_limited').length, 3);

    const notice = await limited;
    assert.ok(notice.retryAfterMs > 0);
    assert.deepEqual(notice.limit, { ratePerSec: 1, burst: 3 });

    await new Promise((r) => setTimeout(r, 200));
    assert.equal(relayed.length, 3);
  });
});
