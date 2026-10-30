// J90 v0.3.2 precision-aware viewport. Pure, deterministic, browser-safe.
import { state, checkedState } from './core.mjs';
import { gridEscapeTimes, escapeTime, JULIA_DEFAULT, NOT_ESCAPED } from './nonlinear.mjs';

export const ZOOM_LIMITS = Object.freeze({
  minSpan: 1e-15, maxSpan: 6, minWidth: 8, maxWidth: 320,
  minHeight: 8, maxHeight: 240, maxIterations: 192,
  maxWork: 9_000_000, defaultSpan: 3.2
});
const integer = (v, name, low, high) => {
  if (!Number.isSafeInteger(v) || v < low || v > high)
    throw new RangeError(name + ' must be an integer in ' + low + '..' + high);
  return v;
};
const finite = (v, name) => {
  if (typeof v !== 'number' || !Number.isFinite(v))
    throw new TypeError(name + ' must be a finite number');
  return v;
};
export function defaultViewport(model = 'mandelbrot', width = 176, height = 112) {
  if (!['mandelbrot', 'julia'].includes(model)) throw new RangeError('unknown model');
  return { model, width, height, centre: model === 'mandelbrot' ? state(-0.5, 0) : state(0, 0),
    span: ZOOM_LIMITS.defaultSpan, c: state(JULIA_DEFAULT.x, JULIA_DEFAULT.y) };
}
export function pixelPoint(view, x, y) {
  finite(x, 'x'); finite(y, 'y');
  if (x < 0 || x > view.width || y < 0 || y > view.height)
    throw new RangeError('pixel coordinates outside viewport');
  return state(view.centre.x + (x - view.width / 2) * view.span / view.width,
    view.centre.y + (view.height / 2 - y) * view.span / view.width);
}
// Portable float64 ULP scale estimate (powers-of-two bins, subnormal clamp).
function ulp(v) {
  const magnitude = Math.abs(v);
  if (magnitude < 2 ** -1022) return Number.MIN_VALUE;
  const estimate = 2 ** (Math.floor(Math.log2(magnitude)) - 52);
  return Math.max(Number.MIN_VALUE, estimate);
}
export function validateViewport(view) {
  if (!view || typeof view !== 'object' || Array.isArray(view) ||
      Object.keys(view).sort().join(',') !== 'c,centre,height,model,span,width')
    throw new TypeError('viewport requires exact model, width, height, centre, span and c fields');
  if (!['mandelbrot', 'julia'].includes(view.model)) throw new RangeError('unknown model');
  integer(view.width, 'width', ZOOM_LIMITS.minWidth, ZOOM_LIMITS.maxWidth);
  integer(view.height, 'height', ZOOM_LIMITS.minHeight, ZOOM_LIMITS.maxHeight);
  finite(view.span, 'span');
  if (view.span < ZOOM_LIMITS.minSpan || view.span > ZOOM_LIMITS.maxSpan)
    throw new RangeError('span outside bounded zoom range');
  const centre = checkedState(view.centre);
  const c = checkedState(view.c);
  for (const v of [centre.x, centre.y, c.x, c.y])
    if (Math.abs(v) > 4) throw new RangeError('coordinate outside [-4,4]');
  const corner1 = pixelPoint(view, 0, 0);
  const corner2 = pixelPoint(view, view.width, view.height);
  for (const v of [corner1.x, corner1.y, corner2.x, corner2.y])
    if (!Number.isFinite(v) || Math.abs(v) > 4)
      throw new RangeError('viewport extends outside supported complex coordinate domain');
  return view;
}
export function precisionReport(view) {
  validateViewport(view);
  const pitch = view.span / view.width;
  let duplicateX = 0, duplicateY = 0;
  let previousX, previousY;
  for (let x = 0; x < view.width; x++) {
    const current = pixelPoint(view, x + 0.5, view.height / 2).x;
    if (x > 0 && current === previousX) duplicateX++;
    previousX = current;
  }
  for (let y = 0; y < view.height; y++) {
    const current = pixelPoint(view, view.width / 2, y + 0.5).y;
    if (y > 0 && current === previousY) duplicateY++;
    previousY = current;
  }
  const coordinateUlp = Math.max(ulp(view.centre.x), ulp(view.centre.y));
  const ratio = pitch / coordinateUlp;
  const collided = duplicateX + duplicateY > 0;
  return {
    pitch, coordinateUlpEstimate: coordinateUlp, pixelPitchToUlp: ratio,
    duplicateX, duplicateY, status: collided ? 'BLOCKED_COORDINATE_COLLISION'
      : ratio < 8 ? 'NEAR_FLOAT64_RESOLUTION' : 'RESOLVED',
    caveat: 'ULP is an approximate local float64 spacing indicator; collisions are tested with actual pixel coordinates, not inferred from this ratio.'
  };
}
export function adaptiveIterations(view) {
  validateViewport(view);
  const depth = Math.max(0, Math.log2(ZOOM_LIMITS.defaultSpan / view.span));
  return Math.min(ZOOM_LIMITS.maxIterations, 64 + 8 * Math.floor(depth));
}
export function zoomAt(view, x, y, factor) {
  validateViewport(view);
  finite(factor, 'factor');
  if (factor < 0.5 || factor > 4) throw new RangeError('zoom factor must be within 0.5..4');
  const anchor = pixelPoint(view, x, y);
  const span = view.span / factor;
  const offset = state((x - view.width / 2) / view.width,
    (view.height / 2 - y) / view.width);
  const next = { ...view, span,
    centre: state(anchor.x - offset.x * span, anchor.y - offset.y * span) };
  if (precisionReport(next).status === 'BLOCKED_COORDINATE_COLLISION')
    throw new RangeError('zoom blocked: adjacent float64 pixel coordinates collide');
  return next;
}
export function panBy(view, dx, dy) {
  validateViewport(view);
  finite(dx, 'dx'); finite(dy, 'dy');
  if (Math.abs(dx) > view.width || Math.abs(dy) > view.height)
    throw new RangeError('pan delta too large');
  const pitch = view.span / view.width;
  const next = { ...view, centre: state(view.centre.x - dx * pitch,
    view.centre.y + dy * pitch) };
  if (precisionReport(next).status === 'BLOCKED_COORDINATE_COLLISION')
    throw new RangeError('pan blocked at float64 precision limit');
  return next;
}
export function centreAt(view, x, y) {
  validateViewport(view);
  const next = { ...view, centre: pixelPoint(view, x, y) };
  if (precisionReport(next).status === 'BLOCKED_COORDINATE_COLLISION')
    throw new RangeError('re-centering blocked at float64 precision limit');
  return next;
}
export function renderZoom(view) {
  const p = precisionReport(view);
  if (p.status === 'BLOCKED_COORDINATE_COLLISION')
    throw new RangeError('render refused: adjacent pixel coordinates collide');
  const iterations = adaptiveIterations(view);
  if (view.width * view.height * iterations > ZOOM_LIMITS.maxWork)
    throw new RangeError('render exceeds deterministic operation budget');
  const grid = gridEscapeTimes({ model: view.model, c: view.c, centre: view.centre,
    span: view.span, width: view.width, height: view.height, maxIterations: iterations });
  return { ...grid, precision: p, depthOctaves: Math.max(0, Math.log2(ZOOM_LIMITS.defaultSpan / view.span)),
    workUpperBound: view.width * view.height * iterations };
}
// One-quarter-pixel shift, same iteration budget and dimensions, to identify
// classification/escape-time changes. This measures numerical sensitivity only.
export function compareBoundary(view, baseline = null) {
  const base = baseline ?? renderZoom(view);
  const shifted = panBy(view, -0.25, 0);
  const other = renderZoom(shifted);
  if (base.maxIterations !== other.maxIterations) throw new Error('comparison budget mismatch');
  const mask = new Uint8Array(base.pixels.length);
  let classificationChanges = 0, iterationChanges = 0;
  for (let i = 0; i < mask.length; i++) {
    const a = base.pixels[i], b = other.pixels[i];
    if ((a === NOT_ESCAPED) !== (b === NOT_ESCAPED)) {
      mask[i] = 2; classificationChanges++;
    } else if (a !== b) {
      mask[i] = 1; iterationChanges++;
    }
  }
  return { mask, classificationChanges, iterationChanges, comparedPixels: mask.length,
    comparisonShiftPixels: 0.25,
    note: 'Changes under a quarter-pixel viewport perturbation do not prove mathematical chaos or physical instability.' };
}
