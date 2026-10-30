import test from 'node:test';
import assert from 'node:assert/strict';
import { state, rotate90, energy } from '../src/core.mjs';
import { quadraticStep, complexRotate90, escapeTime, gridEscapeTimes,
  compareSensitivity, NONLINEAR_LIMITS } from '../src/nonlinear.mjs';

test('90-degree operator satisfies J^2=-I, J^4=I and norm preservation', () => {
  let s = state(1, 2), t = s;
  assert.deepEqual(complexRotate90(s), state(-2, 1));
  assert.deepEqual(complexRotate90(complexRotate90(s)), state(-1, -2));
  for (let i = 0; i < 4; i++) t = complexRotate90(t);
  assert.deepEqual(t, s);
  assert.equal(energy(complexRotate90(s)), energy(s));
});
test('quadratic map uses complex square plus c, not i times z', () => {
  assert.deepEqual(quadraticStep(state(1, 1), state(-1, 0.5)), state(-1, 2.5));
  assert.notDeepEqual(quadraticStep(state(1, 1), state(0, 0)), rotate90(state(1, 1)));
  assert.deepEqual(quadraticStep(state(0, 0), state(-1, 0)), state(-1, 0));
});
test('canonical Mandelbrot probes and finite-budget membership caveat', () => {
  for (const c of [state(0, 0), state(-1, 0)]) {
    const result = escapeTime({ model: 'mandelbrot', point: c, maxIterations: 32 });
    assert.equal(result.escaped, false);
    assert.equal(result.classification, 'not-escaped-within-budget');
  }
  const out = escapeTime({ model: 'mandelbrot', point: state(2, 0), maxIterations: 16 });
  assert.equal(out.escaped, true);
  assert.equal(out.iterations, 2);
});
test('canonical Julia probes and escape convention', () => {
  assert.equal(escapeTime({ model: 'julia', point: state(1, 0), c: state(0, 0), maxIterations: 24 }).escaped, false);
  const out = escapeTime({ model: 'julia', point: state(2, 0), c: state(0, 0), maxIterations: 24 });
  assert.equal(out.escaped, true);
  assert.equal(out.iterations, 1);
  const alreadyOutside = escapeTime({ model: 'julia', point: state(3, 0), c: state(0, 0), maxIterations: 24 });
  assert.equal(alreadyOutside.iterations, 0);
  assert.equal(escapeTime({ model: 'julia', point: state(0, 0), c: state(-1, 0), maxIterations: 24 }).escaped, false);
});
test('large Julia parameters use a conservative escape radius rather than radius 2', () => {
  const point = state(2.5, 0);
  const result = escapeTime({ model: 'julia', point, c: state(-4, 0), maxIterations: 16 });
  assert.notEqual(result.iterations, 0);
});
test('linear sensitivity stays 1 while quadratic Jacobian and amplification differ', () => {
  const report = compareSensitivity();
  assert.ok(Math.abs(report.linearRatio - 1) < 1e-12);
  assert.ok(Math.abs(report.quadraticRatio - 2.01) < 1e-12);
  assert.equal(report.quadraticJacobianDeterminant, 4);
  const shrinking = compareSensitivity({ anchor: state(0, 0), epsilon: 0.01 });
  assert.ok(shrinking.quadraticRatio < 1);
  assert.equal(shrinking.quadraticJacobianDeterminant, 0);
});
test('fixed deterministic grids preserve dimensions and differ by model', () => {
  const opts = { width: 48, height: 32, maxIterations: 32 };
  const a = gridEscapeTimes({ ...opts, model: 'mandelbrot' });
  const b = gridEscapeTimes({ ...opts, model: 'julia', centre: state(0, 0) });
  assert.equal(a.escaped + a.notEscaped, 48 * 32);
  assert.equal(b.escaped + b.notEscaped, 48 * 32);
  assert.deepEqual(a.pixels, gridEscapeTimes({ ...opts, model: 'mandelbrot' }).pixels);
  assert.notDeepEqual(a.pixels, b.pixels);
  assert.equal(a.pixels.length, 1536);
  assert.ok(a.escaped > 0 && a.notEscaped > 0 && b.escaped > 0 && b.notEscaped > 0);
});
test('model boundaries fail closed without guessing unavailable evidence', () => {
  assert.throws(() => escapeTime({ model: 'other', point: state(0, 0) }));
  assert.throws(() => escapeTime({ model: 'julia', point: state(Infinity, 0) }));
  assert.throws(() => escapeTime({ model: 'julia', point: state(0, 0), maxIterations: 0 }));
  assert.throws(() => escapeTime({ model: 'julia', point: state(0, 0), maxIterations: 1.5 }));
  assert.throws(() => escapeTime({ model: 'julia', point: state(0, 0), maxIterations: NONLINEAR_LIMITS.maxIterations + 1 }));
  assert.throws(() => escapeTime({ model: 'mandelbrot', point: state(5, 0) }));
  assert.throws(() => quadraticStep(state(0, 0), state(5, 0)));
  assert.throws(() => gridEscapeTimes({ model: 'julia', width: 0 }));
  assert.throws(() => gridEscapeTimes({ model: 'julia', width: 321 }));
  assert.throws(() => gridEscapeTimes({ model: 'julia', span: 0 }));
  assert.throws(() => compareSensitivity({ epsilon: -1 }));
});
