// J90: mathematical model. No dependencies, I/O, randomness, or hidden clocks.
export const J = Object.freeze([Object.freeze([0, -1]), Object.freeze([1, 0])]);

export function finite(value, name) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new TypeError(name + ' must be a finite number');
  }
  return value;
}
export function state(x, y) {
  finite(x, 'x'); finite(y, 'y');
  return Object.freeze({ x, y });
}
export function checkedState(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      Object.keys(value).sort().join(',') !== 'x,y') {
    throw new TypeError('state must have exactly numeric x and y');
  }
  return state(value.x, value.y);
}
export function parameters(omega, damping = 0, duration = 0) {
  finite(omega, 'omega'); finite(damping, 'damping'); finite(duration, 'duration');
  if (damping < 0 || duration < 0) throw new RangeError('damping and duration must be nonnegative');
  if (!Number.isFinite(omega * duration) || !Number.isFinite(damping * duration)) {
    throw new RangeError('computed phase or damping exponent overflows');
  }
}
export function rotate90(value) {
  const s = checkedState(value);
  return state(-s.y, s.x);
}
export function rotate(value, angle) {
  const s = checkedState(value);
  finite(angle, 'angle');
  const c = Math.cos(angle), v = Math.sin(angle);
  return state(c * s.x - v * s.y, v * s.x + c * s.y);
}
export function energy(value) {
  const s = checkedState(value);
  return finite(s.x * s.x + s.y * s.y, 'energy');
}
export function evolve(value, { omega = 1, damping = 0, duration = 0 } = {}) {
  parameters(omega, damping, duration);
  const s = checkedState(value);
  const phase = omega * duration;
  const amplitude = Math.exp(-damping * duration);
  const r = rotate(s, phase);
  return state(amplitude * r.x, amplitude * r.y);
}
export function distance(left, right) {
  const a = checkedState(left), b = checkedState(right);
  return finite(Math.hypot(a.x - b.x, a.y - b.y), 'distance');
}
