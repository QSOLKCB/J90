// J90 v0.3.0: distinct linear and quadratic dynamical systems, no shared physics claim.
// Float64, deterministic, dependency-free, with finite bounded input domain.
import { state, checkedState, rotate90, distance } from './core.mjs';

export const NONLINEAR_LIMITS = Object.freeze({ maxIterations: 512, maxWidth: 320, maxHeight: 240, maxCoordinate: 4, bailout: 2 });
export const JULIA_DEFAULT = Object.freeze({ x: -0.8, y: 0.156 });

function boundedComplex(value, label) {
  const v = checkedState(value);
  if (Math.abs(v.x) > NONLINEAR_LIMITS.maxCoordinate ||
      Math.abs(v.y) > NONLINEAR_LIMITS.maxCoordinate) {
    throw new RangeError(label + ' components must be within [-4, 4]');
  }
  return v;
}
function count(value, label, max) {
  if (!Number.isSafeInteger(value) || value < 1 || value > max) {
    throw new RangeError(label + ' must be an integer in 1..' + max);
  }
  return value;
}
function modeCheck(mode) {
  if (mode !== 'mandelbrot' && mode !== 'julia') throw new RangeError('unknown nonlinear model');
}

// This is z -> z² + c, NOT multiplication by i.
export function quadraticStep(z, c) {
  const a = boundedComplex(z, 'z'), b = boundedComplex(c, 'c');
  return state(a.x * a.x - a.y * a.y + b.x, 2 * a.x * a.y + b.y);
}
export function complexRotate90(value) {
  return rotate90(boundedComplex(value, 'z'));
}

// For Mandelbrot, point is c and z0 = 0. For Julia, point is z0, c is fixed.
// A non-escape after maxIterations is NOT a mathematical proof of boundedness.
export function escapeTime({ model, point, c = JULIA_DEFAULT, maxIterations = 80 } = {}) {
  modeCheck(model);
  count(maxIterations, 'maxIterations', NONLINEAR_LIMITS.maxIterations);
  const p = boundedComplex(point, 'point');
  const parameter = model === 'mandelbrot' ? p : boundedComplex(c, 'c');
  let z = model === 'mandelbrot' ? state(0, 0) : p;
  for (let k = 0; k <= maxIterations; k++) {
    if (Math.hypot(z.x, z.y) > NONLINEAR_LIMITS.bailout) {
      return { model, escaped: true, iterations: k, classification: 'escaped', final: z };
    }
    if (k === maxIterations) break;
    // Prior norm check ensures intermediate magnitudes are safely small.
    z = quadraticStep(z, parameter);
  }
  return { model, escaped: false, iterations: maxIterations,
    classification: 'not-escaped-within-budget', final: z };
}

export function gridEscapeTimes({ model, c = JULIA_DEFAULT, width = 180, height = 120,
  maxIterations = 80, centre = state(-0.5, 0), span = 3 } = {}) {
  modeCheck(model);
  count(width, 'width', NONLINEAR_LIMITS.maxWidth);
  count(height, 'height', NONLINEAR_LIMITS.maxHeight);
  count(maxIterations, 'maxIterations', NONLINEAR_LIMITS.maxIterations);
  const focus = boundedComplex(centre, 'centre');
  if (typeof span !== 'number' || !Number.isFinite(span) || span <= 0 || span > 6) {
    throw new RangeError('span must be finite in (0, 6]');
  }
  const parameter = boundedComplex(c, 'c');
  const pixels = new Uint16Array(width * height);
  let escaped = 0, notEscaped = 0;
  const verticalSpan = span * height / width;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const point = state(focus.x + (x + 0.5 - width / 2) * span / width,
        focus.y + (height / 2 - y - 0.5) * verticalSpan / height);
      const outcome = escapeTime({ model, point, c: parameter, maxIterations });
      pixels[y * width + x] = outcome.escaped ? outcome.iterations : maxIterations;
      if (outcome.escaped) escaped++; else notEscaped++;
    }
  }
  return { model, width, height, maxIterations, pixels, escaped, notEscaped,
    note: 'Pixels at the iteration cap are not proven members of the fractal set.' };
}

export function compareSensitivity({ anchor = state(1, 0), epsilon = 0.01,
  c = state(0, 0) } = {}) {
  const base = boundedComplex(anchor, 'anchor');
  const parameter = boundedComplex(c, 'c');
  if (typeof epsilon !== 'number' || !Number.isFinite(epsilon) ||
      epsilon <= 0 || epsilon > 0.25) {
    throw new RangeError('epsilon must be finite in (0, 0.25]');
  }
  const perturbed = state(base.x + epsilon, base.y);
  boundedComplex(perturbed, 'perturbed anchor');
  const initial = distance(base, perturbed);
  const linear = distance(complexRotate90(base), complexRotate90(perturbed));
  const nonlinear = distance(quadraticStep(base, parameter), quadraticStep(perturbed, parameter));
  return { initialDistance: initial, linearDistance: linear, quadraticDistance: nonlinear,
    linearRatio: linear / initial, quadraticRatio: nonlinear / initial,
    quadraticJacobianDeterminant: 4 * (base.x * base.x + base.y * base.y),
    interpretation: 'Orthogonal rotation preserves pairwise distance. The quadratic map has a state-dependent Jacobian; its distance can expand or contract.' };
}
