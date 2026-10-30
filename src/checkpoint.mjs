import { createHash } from 'node:crypto';
import { checkedState, finite, parameters } from './core.mjs';

export const CHECKPOINT_VERSION = 1;

// Canonical JSON: lexicographic object keys, no whitespace, finite numbers only.
// Unicode and numeric spelling follow JavaScript JSON.stringify. Not cross-language canonical JSON.
export function canonical(value) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') {
    return JSON.stringify(value);
  }
  if (typeof value === 'number') {
    finite(value, 'JSON number');
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value && typeof value === 'object') {
    const keys = Object.keys(value).sort();
    return '{' + keys.map(k => JSON.stringify(k) + ':' + canonical(value[k])).join(',') + '}';
  }
  throw new TypeError('unsupported canonical JSON value');
}

function sha256(content) {
  return createHash('sha256').update(content, 'utf8').digest('hex');
}
function keysEqual(value, keys) {
  return value && typeof value === 'object' && !Array.isArray(value) &&
    Object.keys(value).sort().join(',') === [...keys].sort().join(',');
}
function validatePayload(p) {
  if (!keysEqual(p, ['version', 'step', 'logicalTime', 'omega', 'damping', 'state'])) {
    throw new TypeError('invalid checkpoint payload keys');
  }
  if (p.version !== CHECKPOINT_VERSION || !Number.isSafeInteger(p.step) || p.step < 0) {
    throw new RangeError('unsupported version or invalid step');
  }
  finite(p.logicalTime, 'logicalTime');
  if (p.logicalTime < 0) throw new RangeError('logicalTime must be nonnegative');
  parameters(p.omega, p.damping, p.logicalTime);
  checkedState(p.state);
}

export function saveCheckpoint({ state, step = 0, logicalTime = 0, omega = 1, damping = 0 }) {
  const payload = { version: CHECKPOINT_VERSION, step, logicalTime, omega, damping,
    state: checkedState(state) };
  validatePayload(payload);
  const digest = sha256(canonical(payload));
  return canonical({ algorithm: 'sha256', digest, payload });
}

export function loadCheckpoint(serialized) {
  if (typeof serialized !== 'string') throw new TypeError('checkpoint must be text');
  let record;
  try {
    record = JSON.parse(serialized);
  } catch {
    throw new TypeError('invalid checkpoint JSON');
  }
  if (!keysEqual(record, ['algorithm', 'digest', 'payload']) ||
      record.algorithm !== 'sha256' ||
      typeof record.digest !== 'string' || !/^[a-f0-9]{64}$/.test(record.digest)) {
    throw new TypeError('invalid checkpoint envelope');
  }
  validatePayload(record.payload);
  if (serialized !== canonical(record)) throw new TypeError('checkpoint is not canonical JSON');
  if (record.digest !== sha256(canonical(record.payload))) {
    throw new Error('checkpoint SHA-256 mismatch');
  }
  return Object.freeze({
    version: record.payload.version,
    step: record.payload.step,
    logicalTime: record.payload.logicalTime,
    omega: record.payload.omega,
    damping: record.payload.damping,
    state: checkedState(record.payload.state)
  });
}
