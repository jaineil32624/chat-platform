/**
 * TransportEvent validation.
 *
 * Shared protocol (must stay in lockstep with the web client):
 *   { id: string; type: string; payload: unknown; origin: string; ts: number; workspace?: string }
 */

export const EVENT_TYPES = Object.freeze([
  'message:new',
  'message:update',
  'message:delete',
  'reaction:toggle',
  'typing',
  'presence',
  'channel:upsert',
  'server:upsert',
  'user:upsert',
  'friend:update',
  'moderation',
  'poll:vote',
  'whiteboard:stroke',
  'whiteboard:clear',
]);

const EVENT_TYPE_SET = new Set(EVENT_TYPES);

/** Default max serialized size of a whole event, in bytes (256 KiB). */
export const DEFAULT_MAX_EVENT_BYTES = 256 * 1024;

export const DEFAULT_WORKSPACE = 'public';

const MAX_ID_LENGTH = 128;
const MAX_ORIGIN_LENGTH = 128;
const MAX_WORKSPACE_LENGTH = 64;
const WORKSPACE_PATTERN = /^[A-Za-z0-9_.:-]+$/;

/**
 * True if `value` is an acceptable workspace name.
 * @param {unknown} value
 */
export function isValidWorkspace(value) {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.length <= MAX_WORKSPACE_LENGTH &&
    WORKSPACE_PATTERN.test(value)
  );
}

/**
 * Normalise a workspace name. Anything missing or malformed falls back to "public".
 * @param {unknown} value
 * @returns {string}
 */
export function normalizeWorkspace(value) {
  if (typeof value !== 'string') return DEFAULT_WORKSPACE;
  const trimmed = value.trim();
  return isValidWorkspace(trimmed) ? trimmed : DEFAULT_WORKSPACE;
}

function isNonEmptyString(value, max) {
  return typeof value === 'string' && value.length > 0 && value.length <= max;
}

/**
 * Byte length of the JSON serialisation of `value`, or -1 if it cannot be serialised.
 * @param {unknown} value
 */
export function jsonByteLength(value) {
  try {
    const json = JSON.stringify(value);
    return json === undefined ? 0 : Buffer.byteLength(json, 'utf8');
  } catch {
    return -1;
  }
}

/**
 * Validate an inbound TransportEvent.
 *
 * @param {unknown} event
 * @param {{ maxBytes?: number }} [options]
 * @returns {{ ok: true, event: Record<string, unknown> } | { ok: false, error: string }}
 */
export function validateEvent(event, options = {}) {
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_EVENT_BYTES;

  if (event === null || typeof event !== 'object' || Array.isArray(event)) {
    return { ok: false, error: 'event must be an object' };
  }
  const e = /** @type {Record<string, unknown>} */ (event);

  if (!isNonEmptyString(e.id, MAX_ID_LENGTH)) {
    return { ok: false, error: `id must be a non-empty string (<= ${MAX_ID_LENGTH} chars)` };
  }
  if (typeof e.type !== 'string' || !EVENT_TYPE_SET.has(e.type)) {
    return { ok: false, error: `type must be one of: ${EVENT_TYPES.join(', ')}` };
  }
  if (!Object.prototype.hasOwnProperty.call(e, 'payload') || e.payload === undefined) {
    return { ok: false, error: 'payload is required (use null for an empty payload)' };
  }
  if (!isNonEmptyString(e.origin, MAX_ORIGIN_LENGTH)) {
    return { ok: false, error: `origin must be a non-empty string (<= ${MAX_ORIGIN_LENGTH} chars)` };
  }
  if (typeof e.ts !== 'number' || !Number.isFinite(e.ts) || e.ts < 0) {
    return { ok: false, error: 'ts must be a finite, non-negative number (epoch ms)' };
  }
  if (e.workspace !== undefined && !isValidWorkspace(e.workspace)) {
    return { ok: false, error: 'workspace must match /^[A-Za-z0-9_.:-]{1,64}$/' };
  }

  const size = jsonByteLength(e);
  if (size < 0) return { ok: false, error: 'event is not JSON-serialisable' };
  if (size > maxBytes) {
    return { ok: false, error: `event too large (${size} bytes > ${maxBytes})` };
  }

  return { ok: true, event: e };
}
