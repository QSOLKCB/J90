import test from 'node:test';
import assert from 'node:assert/strict';
import { state } from '../src/core.mjs';
import { NULL_MODELS } from '../src/adversarial.mjs';
import {
  OBSERVATION_ROLES, sealObservationLog, verifyObservationLog,
  projectObservation, makeObservationFixture, runObservationMatrix
} from '../src/observations.mjs';
import { STRESS_GRID, runNumericStress } from '../src/numeric-stress.mjs';

test('every observation role has a distinct, explicit access grant', () => {
  assert.deepEqual(OBSERVATION_ROLES.map(r => r.id),
    ['oscillator', 'timekeeper', 'sensor-reader', 'event-reader', 'external-observer']);
  const matrix = runObservationMatrix();
  assert.equal(matrix.caseCount, 7);
  assert.equal(matrix.profileCount, 5);
  assert.equal(matrix.projectionCount, 35);
  assert.equal(matrix.cases.length, NULL_MODELS.length);
  assert.match(matrix.reportSHA256, /^[a-f0-9]{64}$/);
  assert.equal(JSON.stringify(runObservationMatrix()), JSON.stringify(matrix));
  for (const scenario of matrix.cases) {
    assert.equal(scenario.log.length, 3);
    const osc = scenario.projections[0].observation;
    assert.equal(osc.clock, null);
    assert.equal(osc.sensor, null);
    assert.equal(osc.memory, null);
    const timekeeper = scenario.projections[1].observation;
    assert.equal(timekeeper.sensor, null);
    assert.equal(timekeeper.memory, null);
    const sensor = scenario.projections[2].observation;
    assert.equal(sensor.clock, null);
    assert.equal(sensor.memory, null);
    const recorder = scenario.projections[3].observation;
    assert.equal(recorder.clock, null);
    assert.equal(recorder.sensor, null);
  }
});

test('elapsed clock time, sensor difference and recorded interruption remain distinct', () => {
  const log = makeObservationFixture('phase-alias');
  const time = projectObservation(log, 'timekeeper');
  const sensor = projectObservation(log, 'sensor-reader');
  const recorder = projectObservation(log, 'event-reader');
  assert.equal(time.observation.clock.elapsed, 1);
  assert.equal(time.observation.clock.elapsedTimeObserved, true);
  assert.equal(sensor.observation.sensor.stateChangedWithinBudget, false);
  assert.equal(recorder.observation.memory.interruptionReported, true);
  const zero = makeObservationFixture('zero-gap');
  assert.equal(projectObservation(zero, 'timekeeper').observation.clock.elapsed, 0);
  assert.equal(projectObservation(zero, 'event-reader').observation.memory.interruptionReported, false);
});

test('tampering, reversing records, mismatching provenance and missing channels fail closed', () => {
  const log = makeObservationFixture('generic');
  const copy = () => JSON.parse(JSON.stringify(log));
  const changed = copy();
  changed[0].payload.atResume += 1;
  assert.throws(() => verifyObservationLog(changed), /digest mismatch/);
  const swapped = copy();
  [swapped[0], swapped[1]] = [swapped[1], swapped[0]];
  assert.throws(() => verifyObservationLog(swapped), /sequence/);
  const forgedSource = copy();
  forgedSource[1].source = 'other-source';
  assert.throws(() => verifyObservationLog(forgedSource), /provenance/);
  assert.throws(() => verifyObservationLog(log.slice(0, 2)));
  assert.throws(() => projectObservation(log, 'secret-admin'));
  assert.throws(() => sealObservationLog([
    { channel: 'clock', source: 'synthetic-clock-v1',
      payload: { atPause: 0, atResume: 1 } }
  ]));
  assert.throws(() => projectObservation(log, 'external-observer', { absolute: -1 }));
});

test('a consistent hash chain cannot authenticate its asserted source', () => {
  const log = makeObservationFixture('zero-gap');
  const source = log.map(e => ({
    channel: e.channel, source: e.source, payload: structuredClone(e.payload)
  }));
  source[0].payload.atResume = 123;
  const freshlySealed = sealObservationLog(source);
  assert.doesNotThrow(() => verifyObservationLog(freshlySealed));
  assert.equal(projectObservation(freshlySealed, 'timekeeper').observation.clock.elapsed, 113);
  assert.notEqual(verifyObservationLog(log).rootDigest, verifyObservationLog(freshlySealed).rootDigest);
});

test('sweep covers float64 boundaries with zero-tolerance comparisons', () => {
  assert.equal(STRESS_GRID.amplitudes.length, 3);
  const report = runNumericStress();
  assert.equal(report.count, 450);
  assert.equal(report.cases.length, 450);
  assert.equal(report.groups.length, 3);
  assert.equal(report.unexpectedDisagreements, 0);
  assert.equal(report.guardrailMatches, 450);
  assert.equal(report.knownBoundaryDisagreements, report.count - report.oracleMatches);
  assert.ok(report.knownBoundaryDisagreements > 0);
  assert.ok(report.underflowedGainCases > 0);
  assert.ok(report.exactFloatAgreements <= report.count);
  assert.ok(report.groups.find(g => g.id === 'subnormal').zeroObserved > 0);
  assert.equal(JSON.stringify(runNumericStress()), JSON.stringify(report));
  assert.match(report.reportSHA256, /^[a-f0-9]{64}$/);
});

test('numeric budgets change classification; invalid/overflowing thresholds reject', () => {
  const report = runNumericStress({ absolute: 0, relative: 0 });
  assert.equal(report.count, 450);
  assert.equal(report.oracleMatches, report.exactFloatAgreements);
  assert.throws(() => runNumericStress({ absolute: -1, relative: 0 }));
  assert.throws(() => runNumericStress({ absolute: NaN, relative: 0 }));
  assert.throws(() => runNumericStress({ absolute: 1e308, relative: 1e308 }));
});

test('forbidden sensor types and malformed memory fail validation before hashing', () => {
  const entries = makeObservationFixture('zero-gap').map(e =>
    ({ channel: e.channel, source: e.source, payload: structuredClone(e.payload) }));
  entries[1].payload.before = { x: NaN, y: 0 };
  assert.throws(() => sealObservationLog(entries));
  entries[1].payload.before = state(0, 0);
  entries[2].payload.interruptionRecorded = 'yes';
  assert.throws(() => sealObservationLog(entries));
});
