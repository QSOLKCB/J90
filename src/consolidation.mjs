// J90 v0.3.3: deterministic convergence studies and independently checked evidence.
// No network, time-dependent inputs, runtime-specific output claims or external libraries.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { canonical } from './checkpoint.mjs';
import { state } from './core.mjs';
import { gridEscapeTimes, NOT_ESCAPED } from './nonlinear.mjs';
import { defaultViewport, precisionReport, pixelPoint } from './zoom.mjs';

export const CONSOLIDATION_PROTOCOL = 'j90-nonlinear-evidence-v1';
export const BUDGETS = Object.freeze([48, 96, 160]);
export const SCALES = Object.freeze([2, 1, 0.5]);
export const GRID = Object.freeze({ width: 33, height: 25 });
const MAX_WORK = 9_000_000;
const SOURCES = Object.freeze([
  'src/consolidation.mjs', 'src/nonlinear.mjs', 'src/zoom.mjs',
  'src/checkpoint.mjs', 'scripts/zoom_oracle.py'
]);
const PYTHON = fileURLToPath(new URL('../scripts/zoom_oracle.py', import.meta.url));
const SOURCE_ROOT = new URL('../', import.meta.url);
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
function pixelBytes(values) {
  const bytes = Buffer.alloc(values.length * 2);
  for (let i = 0; i < values.length; i++) bytes.writeUInt16LE(values[i], 2 * i);
  return bytes;
}
function fixtures() {
  return [
    { id: 'mandelbrot-boundary', ...defaultViewport('mandelbrot', GRID.width, GRID.height),
      centre: state(-0.7435, 0.1314) },
    { id: 'julia-fixed', ...defaultViewport('julia', GRID.width, GRID.height),
      centre: state(0, 0) }
  ];
}
function assertMonotone(low, high, label) {
  if (low.length !== high.length) throw new TypeError('comparison size mismatch');
  let newlyEscaped = 0, escapeTimeDrift = 0;
  for (let i = 0; i < low.length; i++) {
    if (low[i] === NOT_ESCAPED && high[i] !== NOT_ESCAPED) newlyEscaped++;
    if (low[i] !== NOT_ESCAPED && low[i] !== high[i]) escapeTimeDrift++;
  }
  if (escapeTimeDrift) throw new Error(label + ': prior escape times changed with higher cap');
  return { newlyEscaped, priorEscapesChanged: 0 };
}
// Validate independent output without trusting a reported pass flag.
export function comparePython(batch, response) {
  if (!response || response.protocol !== 'j90-zoom-crosscheck-v1' ||
      response.runtime !== 'python-stdlib' || !Array.isArray(response.cases) ||
      response.cases.length !== batch.length) {
    throw new TypeError('invalid independent oracle response');
  }
  let differences = 0, comparedPixels = 0;
  const examples = [];
  const cases = batch.map((entry, index) => {
    const candidate = response.cases[index];
    if (!candidate || candidate.id !== entry.id || !Array.isArray(candidate.pixels) ||
        candidate.pixels.length !== entry.pixels.length) {
      throw new TypeError('independent case identity/shape mismatch');
    }
    let mismatches = 0;
    for (let i = 0; i < entry.pixels.length; i++) {
      const value = candidate.pixels[i];
      if (!Number.isSafeInteger(value) || value < 0 ||
          (value > entry.iterations && value !== NOT_ESCAPED)) {
        throw new TypeError('invalid independent iteration count');
      }
      if (value !== entry.pixels[i]) {
        mismatches++;
        if (examples.length < 8) examples.push({
          case: entry.id, pixelIndex: i, node: entry.pixels[i], python: value
        });
      }
    }
    differences += mismatches;
    comparedPixels += entry.pixels.length;
    return { id: entry.id, mismatches, comparedPixels: entry.pixels.length };
  });
  return { comparedPixels, differences, cases, examples };
}
function runPython(batch) {
  const request = { protocol: 'j90-zoom-crosscheck-v1',
    cases: batch.map(row => ({
      id: row.id, model: row.view.model, width: row.view.width,
      height: row.view.height, centre: row.view.centre, span: row.view.span,
      c: row.view.c, iterations: row.iterations
    }))
  };
  const proc = spawnSync('python3', [PYTHON], {
    input: JSON.stringify(request), encoding: 'utf8', shell: false,
    maxBuffer: 1024 * 1024, timeout: 10000
  });
  if (proc.error || proc.status !== 0 || proc.signal)
    throw new Error('Python oracle failed: ' +
      (proc.error?.message || proc.stderr || proc.signal || proc.status));
  let response;
  try { response = JSON.parse(proc.stdout); }
  catch { throw new TypeError('invalid Python oracle JSON'); }
  return comparePython(batch, response);
}
// Comparing identical physical pixel centres, not different pixels at different zooms.
// Width/height odd => a shared central pixel and 25 matched offsets for 2x zoom.
function compareMatchedScales(coarse, fine) {
  const x0 = (coarse.view.width - 1) / 2, y0 = (coarse.view.height - 1) / 2;
  let exactCoordinateMatches = 0, coordinateDriftCount = 0;
  let maxCoordinateDrift = 0, escapeDisagreementsAtExactPoints = 0;
  for (let dy = -2; dy <= 2; dy++) {
    for (let dx = -2; dx <= 2; dx++) {
      const xA = x0 + dx, yA = y0 + dy;
      const xB = x0 + dx * 2, yB = y0 + dy * 2;
      const a = pixelPoint(coarse.view, xA + 0.5, yA + 0.5);
      const b = pixelPoint(fine.view, xB + 0.5, yB + 0.5);
      const drift = Math.hypot(a.x - b.x, a.y - b.y);
      if (!Number.isFinite(drift)) throw new RangeError('nonfinite sample drift');
      maxCoordinateDrift = Math.max(maxCoordinateDrift, drift);
      if (a.x === b.x && a.y === b.y) {
        exactCoordinateMatches++;
        const idxA = yA * coarse.view.width + xA;
        const idxB = yB * fine.view.width + xB;
        if (coarse.pixels[idxA] !== fine.pixels[idxB]) escapeDisagreementsAtExactPoints++;
      } else coordinateDriftCount++;
    }
  }
  return {
    coarse: coarse.id, finer: fine.id, sampledPairs: 25,
    exactCoordinateMatches, coordinateDriftCount, maxCoordinateDrift,
    escapeDisagreementsAtExactPoints,
    note: 'Only exactly equal Float64 complex coordinates support same-point comparisons. Nearby-but-unequal points are counted separately.'
  };
}
export function runConsolidation() {
  const images = [];
  const collections = [];
  for (const initial of fixtures()) {
    const levels = [];
    for (let level = 0; level < SCALES.length; level++) {
      const view = { model: initial.model, width: GRID.width, height: GRID.height,
        centre: initial.centre, c: initial.c, span: SCALES[level] };
      const precision = precisionReport(view);
      if (precision.duplicateX || precision.duplicateY)
        throw new Error('fixture contains a collapsed pixel coordinate');
      const renders = [];
      for (const iterations of BUDGETS) {
        if (view.width * view.height * iterations > MAX_WORK)
          throw new RangeError('fixed study exceeds work ceiling');
        const grid = gridEscapeTimes({ ...view, maxIterations: iterations });
        const id = initial.id + '-s' + level + '-n' + iterations;
        const item = { id, view, iterations, pixels: grid.pixels,
          escaped: grid.escaped, unresolved: grid.notEscaped,
          pixelsSHA256: sha(pixelBytes(grid.pixels)) };
        images.push(item);
        renders.push(item);
      }
      const transitions = renders.slice(1).map((next, index) => ({
        from: renders[index].iterations, to: next.iterations,
        ...assertMonotone(renders[index].pixels, next.pixels, next.id)
      }));
      levels.push({ level, span: view.span, precision, renders, transitions });
    }
    const matched = levels.slice(1).map((level, index) =>
      compareMatchedScales(levels[index].renders[2], level.renders[2]));
    collections.push({ id: initial.id, levels, matched });
  }
  const batches = BUDGETS.map(iterations =>
    runPython(images.filter(item => item.iterations === iterations)));
  const sourceDigests = SOURCES.map(path => ({
    path, sha256: sha(readFileSync(new URL(path, SOURCE_ROOT)))
  }));
  const report = {
    protocol: CONSOLIDATION_PROTOCOL, version: '0.3.3',
    grid: GRID, budgets: BUDGETS, spans: SCALES,
    sourceDigests,
    totalGrids: images.length,
    comparisons: { batches: batches.map((batch, i) => ({
      iterations: BUDGETS[i], ...batch
    })),
      pixelsChecked: batches.reduce((n, x) => n + x.comparedPixels, 0),
      mismatches: batches.reduce((n, x) => n + x.differences, 0) },
    models: collections.map(model => ({
      id: model.id,
      levels: model.levels.map(level => ({
        level: level.level, span: level.span, precision: level.precision,
        budgets: level.renders.map(r => ({
          iterations: r.iterations, escaped: r.escaped,
          unresolved: r.unresolved, pixelsSHA256: r.pixelsSHA256
        })),
        transitions: level.transitions
      })),
      matchedScales: model.matched
    })),
    interpretation: [
      'Escape-time iteration counts must remain unchanged when iteration budgets increase.',
      'New escapes at larger caps do not establish prior membership or asymptotic convergence.',
      'Different zooms sample different coordinates; matched-point comparison is restricted to exactly coincident float64 points.',
      'Cross-runtime disagreements, if present, are reported rather than reclassified as mathematical or physical discoveries.',
      'This is a deterministic software experiment, not evidence of consciousness or a universal dimensional-transposition law.'
    ]
  };
  const result = report.comparisons.mismatches === 0 &&
    report.models.every(m => m.matchedScales.every(pair =>
      pair.escapeDisagreementsAtExactPoints === 0)) ? 'PASS' : 'FAIL';
  return { ...report, result,
    reportSHA256: sha(canonical({ ...report, result })) };
}
