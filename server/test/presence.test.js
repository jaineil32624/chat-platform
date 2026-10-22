import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createPresence } from '../src/presence.js';

describe('createPresence', () => {
  it('reports first connection and last disconnection', () => {
    const p = createPresence();
    assert.deepEqual(p.add('public', 'u1'), { firstConnection: true, count: 1 });
    assert.deepEqual(p.add('public', 'u1'), { firstConnection: false, count: 2 });
    assert.equal(p.remove('public', 'u1').lastDisconnection, false);
    assert.equal(p.isOnline('public', 'u1'), true);
    assert.equal(p.remove('public', 'u1').lastDisconnection, true);
    assert.equal(p.isOnline('public', 'u1'), false);
  });

  it('isolates workspaces', () => {
    const p = createPresence();
    p.add('a', 'u1');
    p.add('b', 'u2');
    assert.deepEqual(p.list('a'), ['u1']);
    assert.deepEqual(p.list('b'), ['u2']);
    assert.equal(p.isOnline('b', 'u1'), false);
  });

  it('lists online users and cleans up empty workspaces', () => {
    const p = createPresence();
    p.add('w', 'u1');
    p.add('w', 'u2');
    p.add('w', 'u2');
    assert.deepEqual(p.list('w').sort(), ['u1', 'u2']);
    assert.equal(p.socketCount('w', 'u2'), 2);
    p.remove('w', 'u1');
    p.remove('w', 'u2');
    p.remove('w', 'u2');
    assert.deepEqual(p.list('w'), []);
    assert.deepEqual(p.workspaces(), []);
  });

  it('ignores removal of unknown users', () => {
    const p = createPresence();
    const r = p.remove('w', 'ghost');
    assert.equal(r.lastDisconnection, false);
    assert.equal(r.count, 0);
    assert.equal(p.lastSeen('w', 'ghost'), null);
  });

  it('tracks lastSeen', () => {
    let t = 1000;
    const p = createPresence({ now: () => t });
    p.add('w', 'u1');
    assert.equal(p.lastSeen('w', 'u1'), 1000);
    t = 5000;
    const r = p.remove('w', 'u1');
    assert.equal(r.lastSeen, 5000);
    assert.equal(p.lastSeen('w', 'u1'), 5000);
  });
});
