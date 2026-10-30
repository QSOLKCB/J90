import { checkedState, state, finite, parameters, evolve, distance } from './core.mjs';

// Fixed, inspectable nulls: do not derive null outcomes by fitting observations.
export const NULL_MODELS = Object.freeze([
  Object.freeze({ id: 'zero-gap', label: 'No interruption', description: 'A zero-duration gap cannot change the trajectory.', initial: Object.freeze({ x: 1, y: 0 }), omega: 1, damping: 0.1, before: 1, gap: 0, after: 1 }),
  Object.freeze({ id: 'zero-state', label: 'Zero-amplitude system', description: 'The origin is unchanged by rotation and damping.', initial: Object.freeze({ x: 0, y: 0 }), omega: 1.7, damping: 0.2, before: 1, gap: 2, after: 1 }),
  Object.freeze({ id: 'static', label: 'Static system', description: 'Zero angular frequency and damping give no evolution.', initial: Object.freeze({ x: 1, y: 0 }), omega: 0, damping: 0, before: 1, gap: 2, after: 1 }),
  Object.freeze({ id: 'phase-alias', label: 'Full-turn alias', description: 'An undamped full revolution returns to the same observable phase (up to rounding).', initial: Object.freeze({ x: 1, y: 0 }), omega: 2 * Math.PI, damping: 0, before: 0, gap: 1, after: 0 }),
  Object.freeze({ id: 'quarter-turn', label: 'Quarter-turn difference', description: 'A 90° continuation changes an otherwise stationary snapshot.', initial: Object.freeze({ x: 1, y: 0 }), omega: Math.PI / 2, damping: 0, before: 0, gap: 1, after: 0 }),
  Object.freeze({ id: 'pure-decay', label: 'Damping without rotation', description: 'Amplitude changes even when angular frequency is zero.', initial: Object.freeze({ x: 1, y: 0 }), omega: 0, damping: 0.4, before: 0, gap: 2, after: 0 }),
  Object.freeze({ id: 'generic', label: 'Rotating and damping', description: 'A nonzero gap affects phase and amplitude.', initial: Object.freeze({ x: 1, y: 0 }), omega: 1, damping: 0.05, before: 1, gap: 2, after: 1 })
]);

function plain(value, name, allowed) {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      Object.keys(value).some(key => !allowed.includes(key))) {
    throw new TypeError(name + ' has invalid fields');
  }
}
function nonnegative(value, name) {
  finite(value, name);
  if (value < 0) throw new RangeError(name + ' must be nonnegative');
  return value;
}
function validInputs({ initial, omega, damping, before, gap, after }) {
  const s = checkedState(initial);
  nonnegative(before, 'before');
  nonnegative(gap, 'gap');
  nonnegative(after, 'after');
  // Check each potentially overflowing sum before using it.
  const total = before + gap + after;
  if (!Number.isFinite(total)) throw new RangeError('total time overflows');
  parameters(omega, damping, total);
  if (!Number.isFinite(Math.hypot(s.x, s.y))) throw new RangeError('initial amplitude overflows');
  return s;
}

export function errorBudget(value = { absolute: 1e-12, relative: 1e-12 }) {
  plain(value, 'error budget', ['absolute', 'relative']);
  const absolute = nonnegative(value.absolute ?? 1e-12, 'absolute');
  const relative = nonnegative(value.relative ?? 1e-12, 'relative');
  return Object.freeze({ absolute, relative });
}

function tolerance(predicted, observed, budget) {
  const threshold = budget.absolute + budget.relative * Math.max(predicted, observed);
  return finite(threshold, 'error threshold');
}

// Analytical, stable prediction for ||e^(A(gap+after))s_pre - e^(A after)s_pre||.
// Unlike observedDistance, this uses only the initial amplitude and scalar trigonometry.
// There is no oscillator-state evolution in this oracle.
export function oracleGapDistance({ initial = state(1, 0), omega = 1, damping = 0.05,
  before = 1, gap = 2, after = 1 } = {}) {
  const s = validInputs({ initial, omega, damping, before, gap, after });
  const phase = omega * gap;
  const gain = Math.exp(-damping * gap);
  const halfSin = Math.sin(phase / 2);
  const real = Math.expm1(-damping * gap) - 2 * gain * halfSin * halfSin;
  const imag = gain * Math.sin(phase);
  const baseline = Math.hypot(s.x, s.y) * Math.exp(-damping * (before + after));
  return finite(baseline * Math.hypot(real, imag), 'oracle distance');
}

// All information is caller-provided. No Date, performance.now, network, or hidden log.
export function observeExternal(channels = {}, budget = errorBudget()) {
  plain(channels, 'channels', ['clock', 'sensor', 'memory']);
  const b = errorBudget(budget);
  let clock = null;
  let sensor = null;
  let memory = null;
  if (Object.hasOwn(channels, 'clock')) {
    const c = channels.clock;
    plain(c, 'clock', ['atPause', 'atResume']);
    if (!Object.hasOwn(c, 'atPause') || !Object.hasOwn(c, 'atResume')) {
      throw new TypeError('clock requires two explicit readings');
    }
    const atPause = finite(c.atPause, 'clock.atPause');
    const atResume = finite(c.atResume, 'clock.atResume');
    if (atResume < atPause) throw new RangeError('clock readings must not run backward');
    const elapsed = finite(atResume - atPause, 'clock elapsed');
    clock = Object.freeze({ elapsed, elapsedTimeObserved: elapsed > 0 });
  }
  if (Object.hasOwn(channels, 'sensor')) {
    const c = channels.sensor;
    plain(c, 'sensor', ['before', 'after']);
    if (!Object.hasOwn(c, 'before') || !Object.hasOwn(c, 'after')) {
      throw new TypeError('sensor requires two explicit states');
    }
    const delta = distance(c.before, c.after);
    const scale = finite(Math.max(Math.hypot(c.before.x, c.before.y),
      Math.hypot(c.after.x, c.after.y)), 'sensor amplitude');
    const threshold = finite(b.absolute + b.relative * scale, 'sensor threshold');
    sensor = Object.freeze({ stateDistance: delta, stateChangedWithinBudget: delta > threshold });
  }
  if (Object.hasOwn(channels, 'memory')) {
    const c = channels.memory;
    plain(c, 'memory', ['interruptionRecorded']);
    if (typeof c.interruptionRecorded !== 'boolean') {
      throw new TypeError('memory.interruptionRecorded must be a boolean');
    }
    memory = Object.freeze({ interruptionReported: c.interruptionRecorded });
  }
  return Object.freeze({ clock, sensor, memory,
    interpretation: 'Elapsed time, state difference, and an explicit interruption report are different observations; none alone demonstrates awareness or identifies the cause of a gap.' });
}

export function evaluateControl(options = {}) {
  plain(options, 'case options', ['id', 'initial', 'omega', 'damping', 'before', 'gap', 'after', 'budget', 'channels']);
  const { id = 'custom', initial = state(1, 0), omega = 1, damping = 0.05,
    before = 1, gap = 2, after = 1, budget = errorBudget(), channels = {} } = options;
  if (typeof id !== 'string' || id.length === 0) throw new TypeError('id must be nonempty text');
  validInputs({ initial, omega, damping, before, gap, after });
  const b = errorBudget(budget);
  const s = checkedState(initial);
  const pre = evolve(s, { omega, damping, duration: before });
  const paused = evolve(pre, { omega, damping, duration: after });
  const continued = evolve(pre, { omega, damping, duration: gap + after });
  const observed = distance(paused, continued);
  const predicted = oracleGapDistance({ initial: s, omega, damping, before, gap, after });
  const error = Math.abs(observed - predicted);
  const allowedError = tolerance(predicted, observed, b);
  return Object.freeze({
    id, parameters: Object.freeze({ initial: s, omega, damping, before, gap, after }),
    observedDistance: observed, oracleDistance: predicted,
    absoluteError: error, allowedError,
    matchesOracle: error <= allowedError,
    observableDifference: observed > (b.absolute + b.relative * Math.hypot(s.x, s.y)),
    external: observeExternal(channels, b),
    verdict: 'Geometrical state differences are not evidence of awareness, life, or a universal transposition operator.'
  });
}

export function getNullModel(id) {
  const value = NULL_MODELS.find(item => item.id === id);
  if (!value) throw new RangeError('unknown null model: ' + String(id));
  return value;
}

export function runNullRegistry() {
  return NULL_MODELS.map(item => {
    const { id, initial, omega, damping, before, gap, after } = item;
    const report = evaluateControl({ id, initial, omega, damping, before, gap, after });
    return Object.freeze({ ...report, label: item.label, description: item.description });
  });
}

// Fixed sweep ordered as omega -> damping -> gap. No generated randomness.
export function runBoundarySweep() {
  const results = [];
  for (const omega of [0, Math.PI / 2, Math.PI, 2 * Math.PI]) {
    for (const damping of [0, 0.2]) {
      for (const gap of [0, 1, 2]) {
        const id = 'grid-' + results.length.toString().padStart(2, '0');
        results.push(evaluateControl({ id, initial: state(1, 0),
          omega, damping, before: 0, gap, after: 0 }));
      }
    }
  }
  return results;
}
