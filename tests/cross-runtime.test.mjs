import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { makeFixture, compareReplay, runCrossRuntime, REPLAY_CASES } from '../src/cross-runtime.mjs';

const script = fileURLToPath(new URL('../scripts/python_replay.py', import.meta.url));
function pythonRequest(request) {
  return spawnSync('python3', [script], {
    input: typeof request === 'string' ? request : JSON.stringify(request),
    encoding: 'utf8', shell: false, timeout: 10000, maxBuffer: 1024 * 1024
  });
}

test('fixed corpus has eight cases and repeated deterministic integrity-checked checkpoints', () => {
  const fixture = makeFixture();
  assert.equal(REPLAY_CASES.length, 8);
  assert.equal(fixture.expected.length, 8);
  for (const item of fixture.expected) {
    assert.equal(item.states.length, 5);
    assert.equal(item.checkpoints.length, 5);
    assert.equal(new Set(item.checkpoints).size >= 1, true);
  }
  assert.deepEqual(makeFixture().request, fixture.request);
});

test('Python independently verifies and resumes each Node-issued checkpoint', () => {
  const fixture = makeFixture();
  const result = pythonRequest(fixture.request);
  assert.equal(result.status, 0, result.stderr || result.error?.message);
  const response = JSON.parse(result.stdout);
  const report = compareReplay(fixture, response);
  assert.equal(report.result, 'PASS');
  assert.equal(report.checkpointCount, 40);
  assert.equal(report.segmentCount, 32);
  assert.equal(report.comparisonCount, 112);
  assert.equal(report.cases.every(item => item.passed), true);
  assert.match(report.fixtureSHA256, /^[a-f0-9]{64}$/);
  assert.match(report.receiptSHA256, /^[a-f0-9]{64}$/);
});

test('parity report is byte-reproducible on the same runtimes and numeric inputs', () => {
  const first = runCrossRuntime();
  const second = runCrossRuntime();
  assert.equal(first.result, 'PASS');
  assert.deepEqual(second, first);
});

test('caller-controlled error budgets cannot silently hide explicit disagreements', () => {
  const fixture = makeFixture();
  const result = pythonRequest(fixture.request);
  assert.equal(result.status, 0, result.stderr);
  const response = JSON.parse(result.stdout);
  response.cases[0].steps[0].independent.x += 0.001;
  const report = compareReplay(fixture, response);
  assert.equal(report.result, 'FAIL');
  assert.equal(report.cases[0].passed, false);
  assert.throws(() => compareReplay(fixture, response, { absolute: -1, relative: 0 }));
  assert.throws(() => compareReplay(fixture, { protocol: 'wrong' }));
});

test('Python rejects altered checkpoint bytes with intact old digest', () => {
  const fixture = makeFixture().request;
  const original = fixture.cases[0].checkpoints[0];
  assert.match(original, /"x":1/);
  fixture.cases[0].checkpoints[0] = original.replace('"x":1', '"x":2');
  const run = pythonRequest(fixture);
  assert.notEqual(run.status, 0);
  assert.match(run.stderr, /SHA-256 mismatch/);
});

test('Python rejects duplicate JSON keys and nonfinite numeric overflow', () => {
  const fixture = JSON.stringify(makeFixture().request);
  const duplicate = fixture.replace('"protocol":', '"protocol":"j90-cross-runtime-v1","protocol":');
  const d = pythonRequest(duplicate);
  assert.notEqual(d.status, 0);
  assert.match(d.stderr, /duplicate JSON key/);
  const overflow = fixture.replace('"omega":1,', '"omega":1e999,');
  const o = pythonRequest(overflow);
  assert.notEqual(o.status, 0);
  assert.match(o.stderr, /nonfinite JSON number/);
});

test('Python rejects checkpoint metadata drift even if original receipts are valid', () => {
  const fixture = makeFixture().request;
  fixture.cases[0].durations[0] = 2;
  const run = pythonRequest(fixture);
  assert.notEqual(run.status, 0);
  assert.match(run.stderr, /metadata does not match replay schedule/);
});

test('input validation fails closed before invoking a runtime', () => {
  assert.throws(() => makeFixture([]));
  assert.throws(() => makeFixture([{ ...REPLAY_CASES[0], durations: [-1] }]));
  assert.throws(() => makeFixture([{ ...REPLAY_CASES[0], id: 'BAD ID' }]));
  assert.throws(() => makeFixture([{ ...REPLAY_CASES[0], omega: Infinity }]));
});
