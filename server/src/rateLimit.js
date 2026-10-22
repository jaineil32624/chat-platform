/**
 * Token-bucket rate limiter. The relay keeps one bucket per socket.
 *
 * Tokens refill continuously at `ratePerSec`, capped at `burst`. Each event costs one token.
 */

export const DEFAULT_RATE_PER_SEC = 20;
export const DEFAULT_BURST = 40;

/**
 * @param {{ ratePerSec?: number, burst?: number, now?: () => number }} [options]
 *   `now` returns a monotonic time in milliseconds (injectable for tests).
 */
export function createTokenBucket(options = {}) {
  const ratePerSec = options.ratePerSec ?? DEFAULT_RATE_PER_SEC;
  const burst = options.burst ?? DEFAULT_BURST;
  const now = options.now ?? (() => performance.now());

  if (!(ratePerSec > 0)) throw new RangeError('ratePerSec must be > 0');
  if (!(burst >= 1)) throw new RangeError('burst must be >= 1');

  let tokens = burst;
  let last = now();

  function refill() {
    const t = now();
    const elapsedMs = t - last;
    if (elapsedMs > 0) {
      tokens = Math.min(burst, tokens + (elapsedMs / 1000) * ratePerSec);
      last = t;
    }
  }

  return {
    /**
     * Try to consume `cost` tokens. Returns true if the action is allowed.
     * @param {number} [cost]
     */
    tryRemove(cost = 1) {
      refill();
      if (tokens >= cost) {
        tokens -= cost;
        return true;
      }
      return false;
    },

    /** Milliseconds until `cost` tokens are available (0 if available now). */
    retryAfterMs(cost = 1) {
      refill();
      if (tokens >= cost) return 0;
      return Math.ceil(((cost - tokens) / ratePerSec) * 1000);
    },

    /** Current (fractional) token count — for tests and metrics. */
    get tokens() {
      refill();
      return tokens;
    },
  };
}
