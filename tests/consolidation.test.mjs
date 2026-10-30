import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, existsSync, rmSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runConsolidation, comparePython, BUDGETS, SCALES } from '../src/consolidation.mjs';

test('fixed consolidation corpus, monotone escape budgets and immutable receipts', () => {
  const a = runConsolidation(), b = runConsolidation();
  assert.deepEqual(b, a);
  assert.equal(a.protocol, 'j90-nonlinear-evidence-v1');
  assert.equal(a.result, 'PASS');
  assert.equal(a.totalGrids, 18);
  assert.deepEqual(BUDGETS, [48, 96, 160]);
  assert.deepEqual(SCALES, [2, 1, 0.5]);
  assert.equal(a.comparisons.pixelsChecked, 14850);
  assert.equal(a.comparisons.mismatches, 0);
  assert.match(a.reportSHA256, /^[0-9a-f]{64}$/);
  assert.equal(a.sourceDigests.length, 5);
  for (const model of a.models) {
    assert.equal(model.levels.length, 3);
    assert.equal(model.matchedScales.length, 2);
    for (const level of model.levels) {
      assert.equal(level.budgets.length, 3);
      assert.equal(level.budgets.every(row => row.escaped + row.unresolved === 825), true);
      assert.equal(level.transitions.length, 2);
      assert.equal(level.transitions.every(row => row.priorEscapesChanged === 0), true);
      assert.ok(level.budgets[0].unresolved >= level.budgets[1].unresolved);
      assert.ok(level.budgets[1].unresolved >= level.budgets[2].unresolved);
      assert.ok(level.budgets.every(row => /^[a-f0-9]{64}$/.test(row.pixelsSHA256)));
    }
    for (const pair of model.matchedScales) {
      assert.equal(pair.sampledPairs, 25);
      assert.equal(pair.exactCoordinateMatches + pair.coordinateDriftCount, 25);
      assert.equal(pair.escapeDisagreementsAtExactPoints, 0);
    }
  }
});
test('reject invalid or conflicting independent Python data', () => {
  const batch = [{ id: 'a', iterations: 48, pixels: Uint16Array.from([1, 65535, 48]) }];
  const ok = { protocol: 'j90-zoom-crosscheck-v1', runtime: 'python-stdlib',
    cases: [{ id: 'a', pixels: [1, 65535, 48] }] };
  assert.equal(comparePython(batch, ok).differences, 0);
  const mismatch = structuredClone(ok);
  mismatch.cases[0].pixels[0] = 2;
  const result = comparePython(batch, mismatch);
  assert.equal(result.differences, 1);
  assert.deepEqual(result.examples, [{ case: 'a', pixelIndex: 0, node: 1, python: 2 }]);
  assert.throws(() => comparePython(batch, { ...ok, runtime: 'unknown' }));
  assert.throws(() => comparePython(batch, { ...ok, cases: [{ id: 'other', pixels: [1, 65535, 48] }] }));
  assert.throws(() => comparePython(batch, { ...ok, cases: [{ id: 'a', pixels: [1, Infinity, 48] }] }));
  assert.throws(() => comparePython(batch, { ...ok, cases: [{ id: 'a', pixels: [1, 49, 48] }] }));
});
test('CLI emits immutable manifest and checksums; duplicate output fails closed', () => {
  // The generator allows only simple directory names in the current working directory.
  const parent = mkdtempSync(join(tmpdir(), 'j90-consolidation-'));
  try {
    const script = new URL('../src/consolidate-cli.mjs', import.meta.url).pathname;
    const run = (args = []) => spawnSync(process.execPath, [script, ...args],
      { cwd: parent, encoding: 'utf8', timeout: 20000, maxBuffer: 1024 * 1024 });
    const first = run(['--out', 'evidence-v0.3.3']);
    assert.equal(first.status, 0, first.stderr || first.error?.message);
    const output = join(parent, 'evidence-v0.3.3');
    assert.deepEqual(readdirSync(output).sort(), ['REPRODUCE.txt', 'SHA256SUMS.txt', 'manifest.json']);
    const json = readFileSync(join(output, 'manifest.json'), 'utf8');
    assert.equal(json, first.stdout);
    const record = JSON.parse(json);
    assert.equal(record.result, 'PASS');
    const digest = createHash('sha256').update(json).digest('hex');
    assert.ok(readFileSync(join(output, 'SHA256SUMS.txt'), 'utf8').includes(digest + '  manifest.json'));
    const duplicate = run(['--out', 'evidence-v0.3.3']);
    assert.notEqual(duplicate.status, 0);
    assert.equal(readFileSync(join(output, 'manifest.json'), 'utf8'), json);
    for (const dir of ['../unsafe', '.', '/tmp/unsafe']) {
      const bad = run(['--out', dir]);
      assert.notEqual(bad.status, 0);
    }
    assert.equal(existsSync(join(parent, 'unsafe')), false);
  } finally {
    rmSync(parent, { recursive: true, force: true });
  }
});
