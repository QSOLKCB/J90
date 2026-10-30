import test from 'node:test';
import assert from 'node:assert/strict';
import { state } from '../src/core.mjs';
import { candidatePeriod, realOrbit, realAxisSweep, derivativeTrace } from '../src/stability.mjs';

test('known real-axis fixed and period-two windows', () => {
  assert.equal(realOrbit({ c: 0 }).candidatePeriod, 1);
  assert.equal(realOrbit({ c: -1 }).candidatePeriod, 2);
  assert.equal(realOrbit({ c: 0.5 }).escaped, true);
  assert.equal(realOrbit({ c: 0.5 }).tail.length, 0);
});
test('period candidate is window-bounded and not a chaos certificate', () => {
  assert.equal(candidatePeriod(Array.from({ length: 32 }, (_, i) => i % 2)), 2);
  assert.equal(candidatePeriod(Array.from({ length: 32 }, (_, i) => i % 4)), 4);
  assert.equal(candidatePeriod(Array.from({ length: 32 }, (_, i) => i / 32)), null);
  assert.throws(() => candidatePeriod([1,2,3]));
  assert.throws(() => candidatePeriod([1,2,3,Infinity]));
});
test('fixed sweep is deterministic with complete budget accounting', () => {
  const a = realAxisSweep({ steps: 80, samples: 32 });
  const b = realAxisSweep({ steps: 80, samples: 32 });
  assert.deepEqual(a, b);
  assert.equal(a.rows.length, 80);
  assert.equal(a.escaped + a.notEscapedWithinBudget, 80);
  assert.equal(Object.values(a.periodCandidateCounts).reduce((x,y)=>x+y,0), a.notEscapedWithinBudget);
  assert.ok(a.rows.some(row => row.escaped));
  assert.ok(a.rows.some(row => !row.escaped));
});
test('finite-time tangent and independent perturbation agree for stable probes', () => {
  const expanding = derivativeTrace({ initial: state(1,0), c: state(0,0), steps: 6 });
  assert.equal(expanding.rows.length, 6);
  for (const row of expanding.rows) {
    assert.ok(Math.abs(row.analyticGain - row.finiteDifferenceGain) < 0.005);
    assert.equal(row.analyticGain, 2 ** row.step);
  }
  const contracting = derivativeTrace({ initial: state(0.5,0), c: state(0,0), steps: 3 });
  assert.ok(contracting.rows.every(row => row.analyticGain <= 1));
  assert.ok(contracting.rows.every(row => row.finiteDifferenceGain < 1));
});
test('zero derivative is finite and a tiny perturbation fails closed', () => {
  const critical = derivativeTrace({ initial: state(0,0), c: state(0,0), steps: 2 });
  assert.equal(critical.rows[0].analyticGain, 0);
  assert.equal(critical.rows[0].finiteTimeLogGain, null);
  assert.throws(() => derivativeTrace({ initial: state(1,0), epsilon: 1e-20 }), /resolvable/);
});
test('refuse input overflow, invalid resolution, and unbounded computations', () => {
  assert.throws(() => realOrbit({ c: 99 }));
  assert.throws(() => realOrbit({ c: NaN }));
  assert.throws(() => realAxisSweep({ steps: 321 }));
  assert.throws(() => realAxisSweep({ cMin: 0.2, cMax: 0.1 }));
  assert.throws(() => realAxisSweep({ samples: 65 }));
  assert.throws(() => candidatePeriod(Array(32).fill(0), -1));
  assert.throws(() => derivativeTrace({ steps: 13 }));
  assert.throws(() => derivativeTrace({ epsilon: 0.2 }));
});
