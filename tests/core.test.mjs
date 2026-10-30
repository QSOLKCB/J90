import test from 'node:test';
import assert from 'node:assert/strict';
import { J, state, rotate90, rotate, evolve, distance, energy } from '../src/core.mjs';

test('J is the exact counterclockwise quarter-turn operator', () => {
  assert.deepEqual(J, [[0, -1], [1, 0]]);
  const s = state(3, 4);
  assert.deepEqual(rotate90(s), state(-4, 3));
  assert.deepEqual(rotate90(rotate90(s)), state(-3, -4));
  let v = s;
  for (let i = 0; i < 4; i++) v = rotate90(v);
  assert.deepEqual(v, s);
});
test('90-degree rotation and energy preservation', () => {
  const initial = state(3, -4);
  assert.ok(distance(rotate(initial, Math.PI / 2), rotate90(initial)) < 1e-12);
  for (const angle of [0, 0.2, Math.PI / 2, Math.PI, -7.2]) {
    assert.ok(Math.abs(energy(rotate(initial, angle)) - 25) < 1e-12);
  }
});
test('closed-form damping and rotation', () => {
  const initial = state(3, 4);
  const out = evolve(initial, { omega: 0.7, damping: 0.2, duration: 2 });
  assert.ok(Math.abs(energy(out) - 25 * Math.exp(-0.8)) < 1e-12);
  const part1 = evolve(initial, { omega: 0.7, damping: 0.2, duration: 0.5 });
  const part2 = evolve(part1, { omega: 0.7, damping: 0.2, duration: 1.5 });
  assert.ok(distance(out, part2) < 1e-12);
});
test('nonfinite, invalid shape and backwards time fail closed', () => {
  assert.throws(() => state(Infinity, 0));
  assert.throws(() => rotate({ x: 1, y: 2, z: 3 }, 0));
  assert.throws(() => evolve(state(1, 0), { duration: -1 }));
  assert.throws(() => evolve(state(1, 0), { damping: -1 }));
  assert.throws(() => evolve(state(1, 0), { omega: 1e308, duration: 1e308 }));
});
