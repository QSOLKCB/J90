import test from 'node:test';
import assert from 'node:assert/strict';
import { state } from '../src/core.mjs';
import { canonical, saveCheckpoint, loadCheckpoint } from '../src/checkpoint.mjs';
import { runProtocol } from '../src/protocol.mjs';

test('canonical JSON orders object keys recursively', () => {
  assert.equal(canonical({ z: 2, a: { y: 1, b: 0 } }), '{"a":{"b":0,"y":1},"z":2}');
  assert.throws(() => canonical({ n: NaN }));
});
test('checkpoint replay is exact and byte-stable', () => {
  const options = { state: state(1, -2), step: 7, logicalTime: 0.25, omega: 3, damping: 0 };
  const bytes = saveCheckpoint(options);
  assert.equal(bytes, saveCheckpoint(options));
  assert.deepEqual(loadCheckpoint(bytes).state, options.state);
  assert.equal(loadCheckpoint(bytes).step, 7);
});
test('modified, duplicate-key, and nonfinite checkpoints fail closed', () => {
  const original = saveCheckpoint({ state: state(1, 0) });
  assert.throws(() => loadCheckpoint(original.replace('"x":1', '"x":2')), /mismatch/);
  assert.throws(() => loadCheckpoint(original.replace('"x":1', '"x":1,"x":1')), /canonical/);
  assert.throws(() => loadCheckpoint(original.replace('"x":1', '"x":1e999')), /finite/);
  assert.throws(() => loadCheckpoint('{}'));
});
test('suspension with no clock has identical replay', () => {
  const report = runProtocol();
  assert.equal(report.observations.noClockDistance, 0);
  assert.ok(report.observations.continuedEvolutionDistance > 0);
  assert.equal(report.observations.externalClockRevealsGap, true);
  assert.equal(JSON.stringify(report), JSON.stringify(runProtocol()));
});
test('zero gap has no observable difference under both models', () => {
  const report = runProtocol({ gap: 0 });
  assert.equal(report.observations.noClockDistance, 0);
  assert.equal(report.observations.continuedEvolutionDistance, 0);
  assert.equal(report.observations.externalClockRevealsGap, false);
});
test('invalid experiment inputs fail closed', () => {
  assert.throws(() => runProtocol({ gap: -1 }));
  assert.throws(() => runProtocol({ before: Infinity }));
  assert.throws(() => runProtocol({ omega: NaN }));
});
