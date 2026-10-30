import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { state } from '../src/core.mjs';
import { makeFixture, compareReplay } from '../src/cross-runtime.mjs';

const PYTHON = fileURLToPath(new URL('../scripts/python_replay.py', import.meta.url));
const segments = Object.freeze([0.125, 0.25, 0.5, 1]);
const cases = [
  { id: 'small-angle', initial: state(1e-150, -1e-150),
    omega: 1e-12, damping: 1e-12, durations: [...segments] },
  { id: 'subnormal', initial: state(Number.MIN_VALUE, 0),
    omega: 1, damping: 0, durations: [...segments] },
  { id: 'underflow', initial: state(1, 0),
    omega: 0, damping: 710, durations: [...segments] },
  { id: 'high-phase', initial: state(1, 0),
    omega: 1e6, damping: 0.125, durations: [...segments] },
  { id: 'near-alias', initial: state(1, -1),
    omega: 2 * Math.PI * (1 + 1e-12), damping: 0, durations: [...segments] },
  { id: 'tiny-time', initial: state(1, 0),
    omega: 1, damping: 0, durations: [Number.MIN_VALUE, 0.125, 0.25, 0.5] }
];

test('adversarial cross-runtime replay: 6 new edge cases / 30 checkpoints / 84 comparisons', () => {
  const fixture = makeFixture(cases);
  const proc = spawnSync('python3', [PYTHON], {
    input: JSON.stringify(fixture.request), encoding: 'utf8',
    shell: false, timeout: 10000, maxBuffer: 1024 * 1024
  });
  assert.equal(proc.status, 0, proc.stderr || proc.error?.message);
  const data = JSON.parse(proc.stdout);
  const report = compareReplay(fixture, data, { absolute: 1e-9, relative: 1e-9 });
  assert.equal(report.caseCount, 6);
  assert.equal(report.checkpointCount, 30);
  assert.equal(report.segmentCount, 24);
  assert.equal(report.comparisonCount, 84);
  assert.equal(report.result, 'PASS');
  assert.equal(report.cases.every(item => item.passed), true);
});
