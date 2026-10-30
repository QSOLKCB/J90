import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { state, checkedState, evolve, distance, finite, parameters } from './core.mjs';
import { saveCheckpoint, loadCheckpoint, canonical } from './checkpoint.mjs';
import { errorBudget } from './adversarial.mjs';

const PYTHON_SCRIPT = fileURLToPath(new URL('../scripts/python_replay.py', import.meta.url));
const MAX_BUFFER = 1024 * 1024;

// Hard-coded, reviewable scenarios; no random numbers, networking or wall clocks.
export const REPLAY_CASES = Object.freeze([
  Object.freeze({ id: 'zero-gap', initial: state(1, 0), omega: 1, damping: 0,
    durations: Object.freeze([0, 0, 0, 0]) }),
  Object.freeze({ id: 'zero-vector', initial: state(0, 0), omega: 1.5, damping: 0.7,
    durations: Object.freeze([0.25, 0.5, 0.125, 1]) }),
  Object.freeze({ id: 'full-turn-alias', initial: state(1, 0), omega: 2 * Math.PI, damping: 0,
    durations: Object.freeze([1, 1, 1, 1]) }),
  Object.freeze({ id: 'quarter-turn', initial: state(0.5, 0.25), omega: Math.PI / 2, damping: 0,
    durations: Object.freeze([1, 1, 1, 1]) }),
  Object.freeze({ id: 'damped', initial: state(1, -0.5), omega: 0.7, damping: 0.125,
    durations: Object.freeze([0.125, 0.375, 0.5, 1]) }),
  Object.freeze({ id: 'tiny-steps', initial: state(3, 4), omega: 1e-7, damping: 1e-7,
    durations: Object.freeze([0.001, 0.1, 0.4, 0.5]) }),
  Object.freeze({ id: 'static', initial: state(-2, 1), omega: 0, damping: 0,
    durations: Object.freeze([0, 0.125, 0.5, 1]) }),
  Object.freeze({ id: 'pure-decay', initial: state(1, 0), omega: 0, damping: 0.4,
    durations: Object.freeze([0.125, 0.375, 0.5, 1]) })
]);

export function makeFixture(cases = REPLAY_CASES) {
  if (!Array.isArray(cases) || cases.length < 1 || cases.length > 32) {
    throw new RangeError('case count must be 1..32');
  }
  const ids = new Set();
  const items = cases.map(item => {
    if (!item || typeof item !== 'object' ||
        Object.keys(item).sort().join(',') !== 'damping,durations,id,initial,omega') {
      throw new TypeError('fixture case schema invalid');
    }
    const { id, initial, omega, damping, durations } = item;
    if (typeof id !== 'string' || !/^[a-z0-9-]{1,40}$/.test(id) || ids.has(id)) {
      throw new TypeError('invalid or duplicate case id');
    }
    ids.add(id);
    const initialState = checkedState(initial);
    if (!Array.isArray(durations) || durations.length < 1 || durations.length > 20) {
      throw new RangeError('segment count must be 1..20');
    }
    const total = durations.reduce((sum, duration) => {
      finite(duration, 'duration');
      if (duration < 0) throw new RangeError('duration must be nonnegative');
      const next = sum + duration;
      return finite(next, 'logical time');
    }, 0);
    parameters(omega, damping, total);
    let s = initialState;
    let logicalTime = 0;
    const states = [s];
    const checkpoints = [saveCheckpoint({ state: s, step: 0, logicalTime, omega, damping })];
    for (const duration of durations) {
      s = evolve(s, { omega, damping, duration });
      logicalTime += duration;
      states.push(s);
      checkpoints.push(saveCheckpoint({
        state: s, step: states.length - 1, logicalTime, omega, damping
      }));
    }
    for (const receipt of checkpoints) loadCheckpoint(receipt);
    return { id, initial: initialState, omega, damping,
      durations: [...durations], checkpoints, states };
  });
  const request = { protocol: 'j90-cross-runtime-v1',
    cases: items.map(({ id, initial, omega, damping, durations, checkpoints }) =>
      ({ id, initial, omega, damping, durations, checkpoints })) };
  return { request, expected: items };
}

function compareState(left, right, budget, label) {
  const a = checkedState(left), b = checkedState(right);
  const delta = distance(a, b);
  const scale = Math.max(Math.hypot(a.x, a.y), Math.hypot(b.x, b.y));
  const allowance = finite(budget.absolute + budget.relative * scale, 'error allowance');
  return { label, delta, allowance, passed: delta <= allowance };
}

export function compareReplay(fixture, response, requestedBudget = errorBudget()) {
  const budget = errorBudget(requestedBudget);
  if (!response || response.protocol !== 'j90-cross-runtime-v1' ||
      response.runtime !== 'python-stdlib' || !Array.isArray(response.cases) ||
      response.cases.length !== fixture.expected.length) {
    throw new TypeError('invalid Python response schema/count');
  }
  let maxError = 0;
  let comparisonCount = 0;
  const cases = fixture.expected.map((expected, index) => {
    const candidate = response.cases[index];
    if (!candidate || candidate.id !== expected.id || !Array.isArray(candidate.steps) ||
        candidate.steps.length !== expected.states.length) {
      throw new TypeError('Python case identity/step mismatch');
    }
    const comparisons = [];
    for (let stepIndex = 0; stepIndex < candidate.steps.length; stepIndex++) {
      const step = candidate.steps[stepIndex];
      if (!step || step.step !== stepIndex) throw new TypeError('Python step index mismatch');
      const here = expected.states[stepIndex];
      comparisons.push(compareState(here, step.restored, budget, 'restored-' + stepIndex));
      comparisons.push(compareState(here, step.independent, budget, 'independent-' + stepIndex));
      if (stepIndex + 1 < candidate.steps.length) {
        comparisons.push(compareState(expected.states[stepIndex + 1], step.resumed,
          budget, 'resumed-' + stepIndex));
      } else if (step.resumed !== null) {
        throw new TypeError('last step must not resume');
      }
    }
    for (const comparison of comparisons) {
      comparisonCount++;
      maxError = Math.max(maxError, comparison.delta);
    }
    return { id: expected.id, segments: expected.durations.length,
      checkpointCount: expected.checkpoints.length,
      passed: comparisons.every(row => row.passed),
      maxAbsoluteError: Math.max(...comparisons.map(row => row.delta)),
      comparisons };
  });
  const success = cases.every(item => item.passed);
  const report = {
    protocol: 'j90-cross-runtime-v1',
    version: '0.2.1',
    result: success ? 'PASS' : 'FAIL',
    runtimes: ['node-esm', 'python-stdlib'],
    tolerances: budget,
    fixtureSHA256: createHash('sha256').update(canonical(fixture.request)).digest('hex'),
    caseCount: cases.length,
    segmentCount: cases.reduce((n, item) => n + item.segments, 0),
    checkpointCount: cases.reduce((n, item) => n + item.checkpointCount, 0),
    comparisonCount,
    maxAbsoluteError: maxError,
    cases,
    scope: [
      'Python independently integrates the equations and verifies SHA-256 over exact Node-issued payload bytes.',
      'Checkpoint canonical JSON encoding remains defined by JavaScript; Python does not independently issue canonical v1 checkpoints.',
      'IEEE-754 transcendentals can differ across runtimes; comparisons have explicit finite numerical tolerances.',
      'No clock, physical process, consciousness, life or dimensional-transposition claim is tested by parity alone.'
    ]
  };
  return { ...report,
    receiptSHA256: createHash('sha256').update(canonical(report)).digest('hex') };
}

export function runCrossRuntime(budget = errorBudget()) {
  const fixture = makeFixture();
  const requestText = JSON.stringify(fixture.request);
  const proc = spawnSync('python3', [PYTHON_SCRIPT], {
    input: requestText,
    encoding: 'utf8',
    timeout: 10000,
    maxBuffer: MAX_BUFFER,
    shell: false
  });
  if (proc.error || proc.status !== 0 || proc.signal) {
    throw new Error('Python replay failed: ' + (proc.error?.message || proc.stderr || proc.signal || proc.status));
  }
  let response;
  try {
    response = JSON.parse(proc.stdout);
  } catch {
    throw new TypeError('Python replay output was not valid JSON');
  }
  const report = compareReplay(fixture, response, budget);
  if (report.result !== 'PASS') throw new Error('Cross-runtime parity outside declared tolerance');
  return report;
}
