import test from 'node:test';
import assert from 'node:assert/strict';
import { state } from '../src/core.mjs';
import { runProtocol } from '../src/protocol.mjs';
import {
  NULL_MODELS, getNullModel, errorBudget, observeExternal,
  oracleGapDistance, evaluateControl, runNullRegistry, runBoundarySweep
} from '../src/adversarial.mjs';

const close = (actual, expected, tolerance = 1e-12) =>
  assert.ok(Math.abs(actual - expected) <= tolerance, String(actual) + ' != ' + String(expected));

test('the declared null registry contains unique and stable cases', () => {
  assert.deepEqual(NULL_MODELS.map(c => c.id), [
    'zero-gap', 'zero-state', 'static', 'phase-alias', 'quarter-turn',
    'pure-decay', 'generic'
  ]);
  assert.equal(new Set(NULL_MODELS.map(c => c.id)).size, NULL_MODELS.length);
  assert.throws(() => getNullModel('imaginary'), /unknown null model/);
  assert.equal(getNullModel('zero-state').initial.x, 0);
});

test('zero gap, zero vector, no dynamics, and a full-turn alias are indistinguishable at budget', () => {
  for (const id of ['zero-gap', 'zero-state', 'static', 'phase-alias']) {
    const c = getNullModel(id);
    const result = evaluateControl({ id: c.id, initial: c.initial, omega: c.omega,
      damping: c.damping, before: c.before, gap: c.gap, after: c.after });
    assert.equal(result.matchesOracle, true);
    assert.equal(result.observableDifference, false, id);
  }
});

test('quarter-turn has Euclidean distance sqrt(2) and decay obeys exponential oracle', () => {
  const quarter = getNullModel('quarter-turn');
  const turn = evaluateControl(quarterToOptions(quarter));
  close(turn.observedDistance, Math.SQRT2);
  close(turn.oracleDistance, Math.SQRT2);
  assert.equal(turn.observableDifference, true);

  const decay = getNullModel('pure-decay');
  const report = evaluateControl(quarterToOptions(decay));
  close(report.oracleDistance, 1 - Math.exp(-0.8));
  assert.equal(report.observableDifference, true);
});

function quarterToOptions(c) {
  return { id: c.id, initial: c.initial, omega: c.omega, damping: c.damping,
    before: c.before, gap: c.gap, after: c.after };
}

test('oracle and simulated dynamics agree across fixed 24-point boundary grid', () => {
  const grid = runBoundarySweep();
  assert.equal(grid.length, 24);
  assert.equal(grid.every(row => row.matchesOracle), true);
  assert.equal(grid.filter(row => row.parameters.gap === 0).length, 8);
  assert.equal(grid.filter(row => row.parameters.omega === 0 && row.parameters.damping === 0)
    .every(row => !row.observableDifference), true);
  assert.equal(JSON.stringify(grid), JSON.stringify(runBoundarySweep()));
});

test('checkpoint-based v0.1 protocol matches the independent oracle', () => {
  const rows = runNullRegistry();
  assert.equal(rows.length, NULL_MODELS.length);
  for (const row of rows) {
    const p = runProtocol(row.parameters);
    assert.equal(p.observations.noClockDistance, 0);
    close(p.observations.continuedEvolutionDistance, row.oracleDistance);
    assert.equal(row.matchesOracle, true);
  }
});

test('no external channels means no available evidence', () => {
  const data = observeExternal();
  assert.equal(data.clock, null);
  assert.equal(data.sensor, null);
  assert.equal(data.memory, null);
  assert.equal(evaluateControl().external.memory, null);
});

test('clock, sensor and memory are explicit independent evidence channels', () => {
  const observed = observeExternal({
    clock: { atPause: 10, atResume: 12.25 },
    sensor: { before: state(1, 0), after: state(0, 1) },
    memory: { interruptionRecorded: true }
  });
  assert.equal(observed.clock.elapsed, 2.25);
  assert.equal(observed.clock.elapsedTimeObserved, true);
  assert.equal(observed.sensor.stateChangedWithinBudget, true);
  assert.equal(observed.memory.interruptionReported, true);
  const silent = observeExternal({
    clock: { atPause: 0, atResume: 0 },
    sensor: { before: state(1, 0), after: state(1, 0) },
    memory: { interruptionRecorded: false }
  });
  assert.equal(silent.clock.elapsedTimeObserved, false);
  assert.equal(silent.sensor.stateChangedWithinBudget, false);
  assert.equal(silent.memory.interruptionReported, false);
});

test('reject invalid budgets, missing readings, backward clock, and nonfinite sensor values', () => {
  assert.throws(() => errorBudget({ absolute: -1 }));
  assert.throws(() => errorBudget({ relative: Infinity }));
  assert.throws(() => errorBudget({ extra: 1 }));
  assert.throws(() => observeExternal({ clock: { atPause: 10 } }));
  assert.throws(() => observeExternal({ clock: { atPause: 3, atResume: 2 } }));
  assert.throws(() => observeExternal({ sensor: { before: state(0, 0), after: { x: Infinity, y: 1 } } }));
  assert.throws(() => observeExternal({ memory: { interruptionRecorded: 1 } }));
  assert.throws(() => observeExternal({ inventedChannel: true }));
  assert.throws(() => evaluateControl({ invented: 42 }));
});

test('oracle validates overflow, invalid numbers and backwards durations', () => {
  assert.throws(() => oracleGapDistance({ omega: Infinity }));
  assert.throws(() => oracleGapDistance({ gap: -1 }));
  assert.throws(() => oracleGapDistance({ initial: state(1e308, 1e308) }));
  assert.throws(() => oracleGapDistance({ before: 1e308, gap: 1e308 }));
  assert.throws(() => evaluateControl({ channels: { clock: { atPause: 4, atResume: 1 } } }));
});

test('sub-degree and damped distances agree to strict tolerances', () => {
  for (const omega of [1e-8, 1e-4, 0.1, Math.PI / 2, 2 * Math.PI]) {
    for (const damping of [0, 0.00001, 0.5]) {
      const result = evaluateControl({ initial: state(3, 4),
        omega, damping, before: 0.25, gap: 0.75, after: 0.5 });
      assert.equal(result.matchesOracle, true, 'omega=' + omega + ', gamma=' + damping);
    }
  }
});
