// J90 v0.3.1: real-axis bifurcation samples and finite-time derivative diagnostics.
// This is a deterministic *numerical* experiment, not a proof of chaos, life or agency.
import { state, checkedState, distance } from './core.mjs';

export const STABILITY_LIMITS = Object.freeze({
  minC: -2, maxC: 0.5, maxSamples: 64, maxBurnIn: 512, maxSteps: 320,
  maxDerivativeSteps: 12, maxEpsilon: 0.01
});

function integer(value, name, lower, upper) {
  if (!Number.isSafeInteger(value) || value < lower || value > upper)
    throw new RangeError(name + ' must be an integer in ' + lower + '..' + upper);
  return value;
}
function scalar(value, name, lower, upper) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < lower || value > upper)
    throw new RangeError(name + ' must be finite and in [' + lower + ', ' + upper + ']');
  return value;
}
export function candidatePeriod(tail, tolerance = 1e-8) {
  if (!Array.isArray(tail) || tail.length < 4 || tail.length > STABILITY_LIMITS.maxSamples)
    throw new TypeError('tail must contain 4..64 finite samples');
  scalar(tolerance, 'tolerance', 0, 0.01);
  for (const value of tail) scalar(value, 'tail value', -4, 4);
  for (const period of [1, 2, 4, 8]) {
    // Four or more cycle repetitions protect against one-off coincidences.
    if (tail.length < 4 * period) continue;
    let matches = true;
    for (let j = period; j < tail.length; j++) {
      if (Math.abs(tail[j] - tail[j - period]) >
          tolerance * Math.max(1, Math.abs(tail[j]), Math.abs(tail[j - period]))) {
        matches = false;
        break;
      }
    }
    if (matches) return period;
  }
  return null; // Not proof of chaos; only not identified in this finite window.
}

export function realOrbit({ c, burnIn = 160, samples = 32, tolerance = 1e-8 } = {}) {
  scalar(c, 'c', STABILITY_LIMITS.minC, STABILITY_LIMITS.maxC);
  integer(burnIn, 'burnIn', 0, STABILITY_LIMITS.maxBurnIn);
  integer(samples, 'samples', 4, STABILITY_LIMITS.maxSamples);
  scalar(tolerance, 'tolerance', 0, 0.01);
  let x = 0;
  let updates = 0;
  const tail = [];
  for (let i = 0; i < burnIn + samples; i++) {
    x = x * x + c;
    updates++;
    // A real-axis quadratic orbit exceeding 2 for these c ranges will escape.
    if (!Number.isFinite(x) || Math.abs(x) > 2) {
      return { c, escaped: true, escapeIteration: updates, tail: [],
        candidatePeriod: null, classification: 'escaped' };
    }
    if (i >= burnIn) tail.push(x);
  }
  return { c, escaped: false, escapeIteration: null, tail,
    candidatePeriod: candidatePeriod(tail, tolerance),
    classification: 'finite-window-only' };
}

export function realAxisSweep({
  cMin = -2, cMax = 0.35, steps = 241, burnIn = 160, samples = 32, tolerance = 1e-8
} = {}) {
  scalar(cMin, 'cMin', STABILITY_LIMITS.minC, STABILITY_LIMITS.maxC);
  scalar(cMax, 'cMax', STABILITY_LIMITS.minC, STABILITY_LIMITS.maxC);
  if (!(cMax > cMin)) throw new RangeError('cMax must exceed cMin');
  integer(steps, 'steps', 2, STABILITY_LIMITS.maxSteps);
  integer(burnIn, 'burnIn', 0, STABILITY_LIMITS.maxBurnIn);
  integer(samples, 'samples', 4, STABILITY_LIMITS.maxSamples);
  scalar(tolerance, 'tolerance', 0, 0.01);
  // Preserve caller-validated endpoints exactly. Interpolating the last point
  // can round past maxC (for example -1.7..0.5 yields 0.5000000000000002).
  const rows = Array.from({ length: steps }, (_, i) => {
    const c = i === 0 ? cMin : i === steps - 1 ? cMax
      : cMin + (cMax - cMin) * i / (steps - 1);
    return realOrbit({ c, burnIn, samples, tolerance });
  });
  const escaped = rows.filter(r => r.escaped).length;
  const counts = { '1': 0, '2': 0, '4': 0, '8': 0, undetermined: 0 };
  for (const row of rows) {
    if (!row.escaped) {
      if (row.candidatePeriod === null) counts.undetermined++;
      else counts[String(row.candidatePeriod)]++;
    }
  }
  return {
    model: 'real-slice-x2-plus-c', cMin, cMax, steps, burnIn, samples, tolerance,
    escaped, notEscapedWithinBudget: steps - escaped, periodCandidateCounts: counts, rows,
    caution: 'Periods are finite-window numerical candidates; undetermined is not a chaos classification.'
  };
}

function complexMultiply(a, b) {
  return state(a.x * b.x - a.y * b.y, a.x * b.y + a.y * b.x);
}
// Compares analytic tangent recurrence against an independent finite-difference orbit.
// Local finite-time growth is not an asymptotic Lyapunov exponent.
export function derivativeTrace({
  initial = state(0.75, 0), c = state(0, 0), epsilon = 1e-6, steps = 6
} = {}) {
  const z0 = checkedState(initial), parameter = checkedState(c);
  for (const v of [z0.x, z0.y, parameter.x, parameter.y])
    scalar(v, 'complex component', -4, 4);
  scalar(epsilon, 'epsilon', Number.MIN_VALUE, STABILITY_LIMITS.maxEpsilon);
  integer(steps, 'steps', 1, STABILITY_LIMITS.maxDerivativeSteps);
  const shifted = state(z0.x + epsilon, z0.y);
  if (shifted.x === z0.x || shifted.x > 4) throw new RangeError('perturbation not resolvable in float64 domain');
  const delta0 = distance(z0, shifted);
  let z = z0, perturbed = shifted, tangent = state(1, 0);
  const rows = [];
  const cutoff = Math.max(2, Math.hypot(parameter.x, parameter.y) + 1);
  for (let i = 1; i <= steps; i++) {
    if (Math.hypot(z.x, z.y) > cutoff || Math.hypot(perturbed.x, perturbed.y) > cutoff) break;
    tangent = complexMultiply(state(2 * z.x, 2 * z.y), tangent);
    // Calculate the finite-difference trajectory independently of the tangent.
    // Internal states may exceed user-input coordinate bounds before escape.
    const step = q => state(q.x * q.x - q.y * q.y + parameter.x,
      2 * q.x * q.y + parameter.y);
    z = step(z);
    perturbed = step(perturbed);
    const norm = Math.hypot(tangent.x, tangent.y);
    const observed = distance(z, perturbed) / delta0;
    if (!Number.isFinite(norm) || !Number.isFinite(observed))
      throw new RangeError('nonfinite derivative comparison');
    rows.push({
      step: i, analyticGain: norm, finiteDifferenceGain: observed,
      absoluteDifference: Math.abs(norm - observed),
      finiteTimeLogGain: norm > 0 ? Math.log(norm) / i : null
    });
  }
  return {
    initial: z0, c: parameter, epsilon, stepsRequested: steps, stepsCompleted: rows.length,
    cutoff, rows,
    classification: rows.length === steps ? 'completed' : 'terminated-after-escape',
    caution: 'Finite-difference and tangent gains are local finite-time estimates, not proof of chaotic dynamics.'
  };
}
