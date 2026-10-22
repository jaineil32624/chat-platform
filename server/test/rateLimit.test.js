import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createTokenBucket, DEFAULT_BURST, DEFAULT_RATE_PER_SEC } from '../src/rateLimit.js';

function fakeClock(start = 0) {
  let t = start;
  return { now: () => t, advance: (ms) => (t += ms) };
}

describe('createTokenBucket', () => {
  it('uses 20/sec with burst 40 by default', () => {
    assert.equal(DEFAULT_RATE_PER_SEC, 20);
    assert.equal(DEFAULT_BURST, 40);
    const clock = fakeClock();
    const bucket = createTokenBucket({ now: clock.now });
    for (let i = 0; i < 40; i++) assert.equal(bucket.tryRemove(), true, `event ${i}`);
    assert.equal(bucket.tryRemove(), false);
  });

  it('refills at the configured rate', () => {
    const clock = fakeClock();
    const bucket = createTokenBucket({ ratePerSec: 10, burst: 2, now: clock.now });
    assert.equal(bucket.tryRemove(), true);
    assert.equal(bucket.tryRemove(), true);
    assert.equal(bucket.tryRemove(), false);

    clock.advance(50); // 0.5 token
    assert.equal(bucket.tryRemove(), false);
    clock.advance(50); // 1 token total
    assert.equal(bucket.tryRemove(), true);
    assert.equal(bucket.tryRemove(), false);
  });

  it('never exceeds burst capacity', () => {
    const clock = fakeClock();
    const bucket = createTokenBucket({ ratePerSec: 100, burst: 5, now: clock.now });
    clock.advance(60_000);
    assert.equal(bucket.tokens, 5);
  });

  it('sustains the steady rate', () => {
    const clock = fakeClock();
    const bucket = createTokenBucket({ ratePerSec: 20, burst: 40, now: clock.now });
    // Drain the burst, then send exactly 20/sec for 5 seconds — all should pass.
    for (let i = 0; i < 40; i++) bucket.tryRemove();
    let allowed = 0;
    for (let i = 0; i < 100; i++) {
      clock.advance(50);
      if (bucket.tryRemove()) allowed++;
    }
    assert.equal(allowed, 100);
  });

  it('reports retryAfterMs', () => {
    const clock = fakeClock();
    const bucket = createTokenBucket({ ratePerSec: 4, burst: 1, now: clock.now });
    assert.equal(bucket.retryAfterMs(), 0);
    bucket.tryRemove();
    assert.equal(bucket.retryAfterMs(), 250);
    clock.advance(100);
    assert.equal(bucket.retryAfterMs(), 150);
  });

  it('supports weighted costs', () => {
    const clock = fakeClock();
    const bucket = createTokenBucket({ ratePerSec: 1, burst: 5, now: clock.now });
    assert.equal(bucket.tryRemove(3), true);
    assert.equal(bucket.tryRemove(3), false);
    assert.equal(bucket.tryRemove(2), true);
  });

  it('validates options', () => {
    assert.throws(() => createTokenBucket({ ratePerSec: 0 }), RangeError);
    assert.throws(() => createTokenBucket({ burst: 0 }), RangeError);
  });
});
