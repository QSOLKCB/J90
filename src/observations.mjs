// J90 v0.2.2 — explicit, caller-provided evidence and provenance-labelled access.
// The log is tamper-evident, NOT authenticated. No implicit clock, sensors or AI.
import { createHash } from 'node:crypto';
import { canonical } from './checkpoint.mjs';
import { checkedState, evolve, finite } from './core.mjs';
import { getNullModel, NULL_MODELS, observeExternal, errorBudget } from './adversarial.mjs';

const GENESIS = '0'.repeat(64);
export const OBSERVATION_ROLES = Object.freeze([
  Object.freeze({ id: 'oscillator', channels: Object.freeze([]) }),
  Object.freeze({ id: 'timekeeper', channels: Object.freeze(['clock']) }),
  Object.freeze({ id: 'sensor-reader', channels: Object.freeze(['sensor']) }),
  Object.freeze({ id: 'event-reader', channels: Object.freeze(['memory']) }),
  Object.freeze({ id: 'external-observer', channels: Object.freeze(['clock', 'sensor', 'memory']) })
]);
const SOURCES = Object.freeze({
  clock: 'synthetic-clock-v1',
  sensor: 'synthetic-sensor-v1',
  memory: 'synthetic-event-log-v1'
});
const CHANNELS = Object.freeze(['clock', 'sensor', 'memory']);
function sha(payload) { return createHash('sha256').update(canonical(payload), 'utf8').digest('hex'); }
function keys(value, expected, name) {
  if (value === null || typeof value !== 'object' || Array.isArray(value) ||
      Object.keys(value).sort().join(',') !== [...expected].sort().join(',')) {
    throw new TypeError('invalid ' + name + ' fields');
  }
  return value;
}
function checkedPayload(channel, payload) {
  if (channel === 'clock') {
    keys(payload, ['atPause', 'atResume'], 'clock');
    finite(payload.atPause, 'clock.atPause');
    finite(payload.atResume, 'clock.atResume');
    if (payload.atResume < payload.atPause || !Number.isFinite(payload.atResume - payload.atPause)) {
      throw new RangeError('invalid clock interval');
    }
    return { atPause: payload.atPause, atResume: payload.atResume };
  }
  if (channel === 'sensor') {
    keys(payload, ['before', 'after'], 'sensor');
    return { before: checkedState(payload.before), after: checkedState(payload.after) };
  }
  if (channel === 'memory') {
    keys(payload, ['interruptionRecorded'], 'memory');
    if (typeof payload.interruptionRecorded !== 'boolean') {
      throw new TypeError('memory flag must be boolean');
    }
    return { interruptionRecorded: payload.interruptionRecorded };
  }
  throw new TypeError('unknown observation channel');
}
export function sealObservationLog(entries) {
  if (!Array.isArray(entries) || entries.length !== 3) {
    throw new TypeError('expected three channel observations');
  }
  const seen = new Set();
  let previous = GENESIS;
  return entries.map((entry, sequence) => {
    keys(entry, ['channel', 'source', 'payload'], 'observation input');
    const { channel, source } = entry;
    if (!CHANNELS.includes(channel) || seen.has(channel)) throw new TypeError('duplicate/unknown channel');
    seen.add(channel);
    if (source !== SOURCES[channel]) throw new TypeError('source does not match channel');
    const event = { sequence, channel, source, payload: checkedPayload(channel, entry.payload),
      previousDigest: previous };
    const digest = sha(event);
    previous = digest;
    return Object.freeze({ ...event, digest });
  });
}
export function verifyObservationLog(log) {
  if (!Array.isArray(log) || log.length !== 3) throw new TypeError('invalid observation log size');
  const seen = new Set();
  let previous = GENESIS;
  const events = log.map((event, sequence) => {
    keys(event, ['sequence', 'channel', 'source', 'payload', 'previousDigest', 'digest'], 'event');
    if (event.sequence !== sequence || !CHANNELS.includes(event.channel) || seen.has(event.channel)) {
      throw new TypeError('invalid event sequence/channel');
    }
    seen.add(event.channel);
    if (event.source !== SOURCES[event.channel] || event.previousDigest !== previous ||
        typeof event.digest !== 'string' || !/^[a-f0-9]{64}$/.test(event.digest)) {
      throw new TypeError('invalid event provenance/chain');
    }
    const normalized = {
      sequence, channel: event.channel, source: event.source,
      payload: checkedPayload(event.channel, event.payload), previousDigest: previous
    };
    const computed = sha(normalized);
    if (event.digest !== computed) throw new Error('observation digest mismatch');
    previous = computed;
    return Object.freeze({ ...normalized, digest: computed });
  });
  return Object.freeze({ events: Object.freeze(events), rootDigest: previous,
    provenance: 'SHA-256 chain verifies consistency only. Origin names and events are caller-supplied assertions, not authenticated measurements.' });
}
export function projectObservation(log, role, budget = errorBudget()) {
  const verified = verifyObservationLog(log);
  const found = OBSERVATION_ROLES.find(candidate => candidate.id === role);
  if (!found) throw new RangeError('unknown observer role');
  const b = errorBudget(budget);
  const selected = Object.fromEntries(verified.events
    .filter(e => found.channels.includes(e.channel))
    .map(e => [e.channel, e.payload]));
  const observed = observeExternal(selected, b);
  return Object.freeze({
    role, channels: found.channels, rootDigest: verified.rootDigest,
    observation: observed,
    assertion: 'Only explicitly permitted channels are projected. An external report does not prove interruption causality or awareness.'
  });
}
export function makeObservationFixture(id) {
  const model = getNullModel(id);
  const { initial, omega, damping, before, gap } = model;
  const atPause = evolve(initial, { omega, damping, duration: before });
  const atResume = evolve(atPause, { omega, damping, duration: gap });
  return sealObservationLog([
    { channel: 'clock', source: SOURCES.clock, payload: { atPause: 10, atResume: 10 + gap } },
    { channel: 'sensor', source: SOURCES.sensor, payload: { before: atPause, after: atResume } },
    { channel: 'memory', source: SOURCES.memory, payload: { interruptionRecorded: gap > 0 } }
  ]);
}
export function runObservationMatrix(budget = errorBudget()) {
  const b = errorBudget(budget);
  const cases = NULL_MODELS.map(model => {
    const log = makeObservationFixture(model.id);
    const verified = verifyObservationLog(log);
    const projections = OBSERVATION_ROLES.map(role => projectObservation(log, role.id, b));
    return { id: model.id, log, rootDigest: verified.rootDigest, projections };
  });
  const report = { protocol: 'j90-observation-access-v1', version: '0.2.2',
    cases, caseCount: cases.length, profileCount: OBSERVATION_ROLES.length,
    projectionCount: cases.length * OBSERVATION_ROLES.length, budget: b,
    limitation: 'All observations are synthetic inputs; SHA-256 is not a signature or authentication of an event source.' };
  return { ...report, reportSHA256: sha(report) };
}
