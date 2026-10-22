import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  DEFAULT_MAX_EVENT_BYTES,
  EVENT_TYPES,
  normalizeWorkspace,
  validateEvent,
} from '../src/validate.js';

const base = () => ({
  id: 'evt_1',
  type: 'message:new',
  payload: { channelId: 'c1', content: 'hi' },
  origin: 'client_a',
  ts: 1_700_000_000_000,
});

describe('validateEvent', () => {
  it('accepts a well-formed event', () => {
    const result = validateEvent(base());
    assert.equal(result.ok, true);
  });

  it('accepts every protocol event type', () => {
    assert.equal(EVENT_TYPES.length, 14);
    for (const type of EVENT_TYPES) {
      assert.equal(validateEvent({ ...base(), type }).ok, true, type);
    }
  });

  it('accepts an optional valid workspace and null payload', () => {
    assert.equal(validateEvent({ ...base(), workspace: 'team-42', payload: null }).ok, true);
  });

  for (const [label, value] of [
    ['null', null],
    ['array', []],
    ['string', 'event'],
    ['number', 42],
  ]) {
    it(`rejects non-object input (${label})`, () => {
      assert.equal(validateEvent(value).ok, false);
    });
  }

  it('rejects unknown types', () => {
    const r = validateEvent({ ...base(), type: 'admin:nuke' });
    assert.equal(r.ok, false);
    assert.match(r.error, /type must be one of/);
  });

  it('rejects missing or invalid id', () => {
    assert.equal(validateEvent({ ...base(), id: '' }).ok, false);
    assert.equal(validateEvent({ ...base(), id: 7 }).ok, false);
    assert.equal(validateEvent({ ...base(), id: 'x'.repeat(129) }).ok, false);
    const { id, ...noId } = base();
    assert.equal(validateEvent(noId).ok, false);
  });

  it('rejects missing payload', () => {
    const { payload, ...noPayload } = base();
    assert.equal(validateEvent(noPayload).ok, false);
  });

  it('rejects invalid origin', () => {
    assert.equal(validateEvent({ ...base(), origin: '' }).ok, false);
    assert.equal(validateEvent({ ...base(), origin: null }).ok, false);
  });

  it('rejects invalid ts', () => {
    for (const ts of ['1', NaN, Infinity, -1, null]) {
      assert.equal(validateEvent({ ...base(), ts }).ok, false, String(ts));
    }
  });

  it('rejects malformed workspace', () => {
    for (const workspace of ['', 'has space', 'x'.repeat(65), 12]) {
      assert.equal(validateEvent({ ...base(), workspace }).ok, false, String(workspace));
    }
  });

  it('enforces the size cap (default ~256KB)', () => {
    const big = { ...base(), payload: { blob: 'a'.repeat(DEFAULT_MAX_EVENT_BYTES) } };
    const r = validateEvent(big);
    assert.equal(r.ok, false);
    assert.match(r.error, /too large/);

    const justUnder = { ...base(), payload: { blob: 'a'.repeat(DEFAULT_MAX_EVENT_BYTES - 500) } };
    assert.equal(validateEvent(justUnder).ok, true);
  });

  it('respects a custom maxBytes', () => {
    assert.equal(validateEvent(base(), { maxBytes: 10 }).ok, false);
  });

  it('counts multi-byte characters by UTF-8 bytes', () => {
    const emoji = '\u{1F600}'; // 4 bytes in UTF-8
    const ev = { ...base(), payload: emoji.repeat(100) };
    const size = Buffer.byteLength(JSON.stringify(ev));
    assert.equal(validateEvent(ev, { maxBytes: size }).ok, true);
    assert.equal(validateEvent(ev, { maxBytes: size - 1 }).ok, false);
  });

  it('rejects non-serialisable payloads', () => {
    const circular = { ...base(), payload: {} };
    circular.payload.self = circular.payload;
    assert.equal(validateEvent(circular).ok, false);
  });
});

describe('normalizeWorkspace', () => {
  it('defaults to "public"', () => {
    assert.equal(normalizeWorkspace(undefined), 'public');
    assert.equal(normalizeWorkspace(''), 'public');
    assert.equal(normalizeWorkspace('bad name!'), 'public');
    assert.equal(normalizeWorkspace({}), 'public');
  });

  it('keeps valid names (trimmed)', () => {
    assert.equal(normalizeWorkspace('  acme  '), 'acme');
    assert.equal(normalizeWorkspace('team_1.dev:alpha'), 'team_1.dev:alpha');
  });
});
